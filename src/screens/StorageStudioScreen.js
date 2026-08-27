import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import GradientScreen from "../ui/GradientScreen";
import FeatureLock from "../ui/FeatureLock";
import useThemedStyles from "../ui/useThemedStyles";
import { useTheme } from "../ui/ThemeProvider";

import { formatSize, projectStorage } from "../services/cleanerService";
import {
    clearHistory,
    freeDiskBytes,
    listHistory,
    totalDiskBytes,
} from "../services/cleanerHistory";
import { useFeatureAccess } from "../hooks/useFeatureAccess";

/**
 * StorageStudioScreen — the Storage Studio hub (roadmap Module 4,
 * docs/smart-cleaner-spec.md §3).
 *
 * One entry point per cleaner layer, ordered free first. Every layer is listed
 * at every tier: a locked one renders dimmed under a lock badge with a CTA that
 * names the plan, which is the shared contract from the entitlement policy §5
 * and the reason FeatureLock exists rather than each screen hiding what it
 * cannot offer.
 *
 * The layers that need a backend route Module 4 does not add — AI storage
 * analysis and screenshot intelligence — are registered in the feature matrix
 * but have no card here. A locked card that leads nowhere for the subscriber who
 * paid for it is worse than no card, and it is the kind of thing App Review
 * opens a 2.3.1 on.
 *
 * The header is device storage, read from the OS, plus the forecast — which is
 * arithmetic over the local scan history and declines to answer far more often
 * than it speaks. See projectStorage.
 */

const LAYERS = [
    {
        key: "duplicates",
        featureKey: "deep_clean",
        title: "Duplicate Cleaner",
        subtitle: "Exact copies, repeated filenames and burst shots",
        icon: "duplicate-outline",
        route: "JunkWiper",
    },
    {
        key: "screenshots",
        featureKey: "screenshot_cleaner",
        title: "Screenshots",
        subtitle: "Every screenshot on this device, largest first",
        icon: "phone-portrait-outline",
        route: "StorageScan",
        params: { mode: "screenshots" },
    },
    {
        key: "large",
        featureKey: "large_video_finder",
        title: "Large Files",
        subtitle: "Photos and videos over 50 MB, grouped by size",
        icon: "film-outline",
        route: "StorageScan",
        params: { mode: "large" },
    },
    {
        key: "blurry",
        featureKey: "blurry_detector",
        title: "Blurry Photos",
        subtitle: "Out-of-focus shots, scored on this device",
        icon: "eye-off-outline",
        route: "StorageScan",
        params: { mode: "blurry" },
    },
    {
        key: "similar",
        featureKey: "similar_photos",
        title: "Similar Photos",
        subtitle: "Near-identical shots grouped so you keep the best one",
        icon: "copy-outline",
        route: "StorageScan",
        params: { mode: "similar" },
    },
];

function daysLabel(days) {
    if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
    if (days < 90) return `${Math.round(days / 7)} weeks`;
    return `${Math.round(days / 30)} months`;
}

export default function StorageStudioScreen({ navigation }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);

    const [disk, setDisk] = useState({ free: null, total: null });
    const [history, setHistory] = useState([]);
    const forecastAccess = useFeatureAccess("storage_prediction");

    const refresh = useCallback(async () => {
        const [free, total, entries] = await Promise.all([
            freeDiskBytes(),
            totalDiskBytes(),
            listHistory(),
        ]);
        setDisk({ free, total });
        setHistory(entries);
    }, []);

    // Re-read on focus: the numbers change the moment the user comes back from a
    // scan or a delete, and a stale ring is worse than no ring.
    useFocusEffect(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    const used = disk.total != null && disk.free != null ? disk.total - disk.free : null;
    const usedPct = used != null && disk.total ? Math.round((used / disk.total) * 100) : null;
    const last = history[0];
    const forecast = projectStorage(history, disk.free);

    function forecastLine() {
        if (!forecastAccess.allowed) {
            return "Storage Forecast estimates when your device runs out of space, from the scans you have already run.";
        }
        switch (forecast.status) {
            case "ok":
                return `At the rate your library has been growing, this device fills up in about ${daysLabel(forecast.daysUntilFull)}. That is an estimate from ${forecast.samples} scans, not a promise.`;
            case "not-growing":
                return "Your library has not grown across the scans on record, so there is nothing to project.";
            case "unknown-free-space":
                return `Your library is growing by about ${formatSize(forecast.bytesPerDay)} a day. This device will not report its free space, so there is no date to give.`;
            default:
                return "Run three or more scans, at least a day apart, and an estimate will appear here.";
        }
    }

    return (
        <GradientScreen>
            <SafeAreaView style={styles.safe} edges={["bottom"]}>
                <ScrollView contentContainerStyle={styles.container}>
                    <View style={styles.card}>
                        <Text style={styles.section}>This device</Text>
                        {usedPct == null ? (
                            <Text style={styles.hint}>
                                This device does not report how much storage is in use.
                            </Text>
                        ) : (
                            <>
                                <View style={styles.barTrack}>
                                    <View style={[styles.barFill, { width: `${usedPct}%` }]} />
                                </View>
                                <Text style={styles.diskText}>
                                    {formatSize(used)} used of {formatSize(disk.total)} ·{" "}
                                    {formatSize(disk.free)} free
                                </Text>
                            </>
                        )}
                        <Text style={styles.hint}>
                            {last
                                ? `Last scan ${new Date(last.scannedAt).toLocaleDateString()} · ${last.totalAssets} items`
                                : "No scan run yet."}
                        </Text>
                    </View>

                    <FeatureLock
                        featureKey="storage_prediction"
                        navigation={navigation}
                        label="Storage Forecast"
                        testID="lock-storage-prediction"
                    >
                        <View style={styles.card}>
                            <Text style={styles.section}>Storage Forecast</Text>
                            <Text style={styles.forecast}>{forecastLine()}</Text>
                            {forecastAccess.allowed && history.length > 0 ? (
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={async () => {
                                        await clearHistory();
                                        refresh();
                                    }}
                                    style={styles.clear}
                                >
                                    <Text style={styles.clearText}>Clear scan history</Text>
                                </Pressable>
                            ) : null}
                        </View>
                    </FeatureLock>

                    <View style={styles.card}>
                        <Text style={styles.section}>Cleaners</Text>
                        <Text style={styles.hint}>
                            Nothing here deletes anything on its own. Every cleaner shows you what
                            it found and waits for you to choose.
                        </Text>
                        {LAYERS.map((layer) => (
                            <FeatureLock
                                key={layer.key}
                                featureKey={layer.featureKey}
                                navigation={navigation}
                                label={layer.title}
                                testID={`lock-${layer.key}`}
                            >
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={`${layer.title}. ${layer.subtitle}`}
                                    onPress={() => navigation.navigate(layer.route, layer.params)}
                                    style={({ pressed }) => [
                                        styles.layer,
                                        pressed && { opacity: 0.8 },
                                    ]}
                                >
                                    <View style={styles.layerIcon}>
                                        <Ionicons
                                            name={layer.icon}
                                            size={18}
                                            color={theme.colors.accentText}
                                        />
                                    </View>
                                    <View style={styles.layerText}>
                                        <Text style={styles.layerTitle}>{layer.title}</Text>
                                        <Text style={styles.layerSub}>{layer.subtitle}</Text>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={18}
                                        color={theme.colors.textMuted}
                                    />
                                </Pressable>
                            </FeatureLock>
                        ))}
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.section}>What leaves this device</Text>
                        <Text style={styles.hint}>
                            Nothing. Every cleaner reads your library on the device itself — no
                            photo, filename or thumbnail is uploaded. What is saved between scans
                            is a count and a total size, so the forecast has something to work
                            from, and you can clear that above.
                        </Text>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </GradientScreen>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        safe: { flex: 1 },
        container: { padding: 18, paddingBottom: 60, gap: 16 },

        card: {
            backgroundColor: t.colors.glass,
            borderWidth: 1,
            borderColor: t.colors.glassBorder,
            borderRadius: 20,
            padding: 14,
            gap: 8,
            shadowColor: t.colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.1,
            shadowRadius: 18,
            elevation: 4,
        },
        section: {
            color: t.colors.textMuted,
            fontSize: 15,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.4,
        },
        hint: { color: t.colors.textMuted, fontSize: 12, fontWeight: "500", lineHeight: 17 },
        forecast: { color: t.colors.textSecondary, fontSize: 13, fontWeight: "600", lineHeight: 19 },

        barTrack: {
            height: 10,
            borderRadius: 999,
            backgroundColor: t.colors.glassSoft,
            overflow: "hidden",
        },
        barFill: { height: 10, borderRadius: 999, backgroundColor: t.colors.primary },
        diskText: { color: t.colors.textPrimary, fontSize: 13, fontWeight: "700" },

        clear: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
        clearText: { color: t.colors.accentText, fontWeight: "700", fontSize: 13 },

        layer: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
        },
        layerIcon: {
            width: 34,
            height: 34,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.colors.infoBg,
            borderWidth: 1,
            borderColor: t.colors.infoBorder,
        },
        layerText: { flex: 1 },
        layerTitle: { color: t.colors.textPrimary, fontWeight: "800", fontSize: 15 },
        layerSub: { color: t.colors.textMuted, fontWeight: "600", fontSize: 12, marginTop: 2 },
    });
