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

// Four layers, not five.
//
// Blurry Photos and Similar Photos were two separate paid scans over the SAME
// photo library, and both already shared one 64x64 sample per photo — so
// running them apart charged twice for work that happens once. They are now a
// single "Photo Cleanup" pass at 3 credits.
//
// Screenshots stays its own FREE layer. It needs no image analysis at all (it
// is a filename check), so there is nothing to save by folding it in and a
// free feature would have been taken away to do it.
//
// The two old paid modes still exist in StorageScanScreen and their credit
// keys are still seeded server-side: the App Store build in review routes to
// them and reserves against them.
const LAYERS = [
    {
        key: "duplicates",
        featureKey: "deep_clean",
        title: "Duplicate Cleaner",
        subtitle: "Exact copies, repeated filenames and burst shots",
        // A wand, not "duplicate-outline": every other layer in this hub is
        // also about duplicates of some kind, so a duplicate glyph did not
        // distinguish it from Photo Cleanup sitting directly underneath.
        icon: "color-wand-outline",
        tone: "primary",
        route: "JunkWiper",
    },
    {
        key: "photos",
        featureKey: "photo_cleanup",
        title: "Photo Cleanup",
        subtitle: "Screenshots, blurry shots and near-identical photos in one scan",
        icon: "sparkles-outline",
        tone: "accentText",
        route: "StorageScan",
        params: { mode: "photos" },
    },
    {
        key: "screenshots",
        featureKey: "screenshot_cleaner",
        title: "Screenshots",
        subtitle: "Every screenshot on this device, largest first — free",
        icon: "phone-portrait-outline",
        tone: "successText",
        route: "StorageScan",
        params: { mode: "screenshots" },
    },
    {
        key: "large",
        featureKey: "large_video_finder",
        title: "Large Files",
        subtitle: "Your biggest photos and videos — choose 10, 20, 30 or 50 MB",
        icon: "film-outline",
        tone: "warningText",
        route: "StorageScan",
        params: { mode: "large" },
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

    // The bar says how urgent this is without needing a sentence. Thresholds
    // are the ones iOS itself starts warning at, not round numbers.
    const pressureColor =
        usedPct == null || usedPct < 75
            ? theme.colors.successText
            : usedPct < 90
              ? theme.colors.warningText
              : theme.colors.dangerText;

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
                                {/* Free space is the number someone opens this
                                    screen to find, so it is the number that is
                                    large. "Used of total" is the context, not
                                    the headline. */}
                                <View style={styles.diskRow}>
                                    <Text style={styles.diskFree}>{formatSize(disk.free)}</Text>
                                    <Text style={styles.diskFreeLabel}>free</Text>
                                    <View style={{ flex: 1 }} />
                                    <Text style={[styles.diskPct, { color: pressureColor }]}>
                                        {usedPct}% full
                                    </Text>
                                </View>
                                <View style={styles.barTrack}>
                                    <View
                                        style={[
                                            styles.barFill,
                                            { width: `${usedPct}%`, backgroundColor: pressureColor },
                                        ]}
                                    />
                                </View>
                                <Text style={styles.diskText}>
                                    {formatSize(used)} used of {formatSize(disk.total)}
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
                        {LAYERS.map((layer, i) => {
                            const tone = theme.colors[layer.tone] ?? theme.colors.accentText;
                            return (
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
                                        // The rule separates rows; above the
                                        // first one it was just a line under
                                        // the paragraph.
                                        i === 0 && styles.layerFirst,
                                        pressed && styles.layerPressed,
                                    ]}
                                >
                                    <View
                                        style={[
                                            styles.layerIcon,
                                            { backgroundColor: `${tone}18`, borderColor: `${tone}44` },
                                        ]}
                                    >
                                        <Ionicons name={layer.icon} size={18} color={tone} />
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
                            );
                        })}
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
            padding: 16,
            gap: 8,
            // Matches the Tools tab: a low neutral shadow instead of a blue
            // halo, which stacked into fog across a scroll of cards.
            shadowColor: "#0B1228",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 2,
        },
        // Was uppercase muted 15px — a heading wearing a caption's clothes.
        section: {
            color: t.colors.textPrimary,
            fontSize: 16,
            fontWeight: "800",
            letterSpacing: -0.2,
            marginBottom: 2,
        },
        hint: { color: t.colors.textMuted, fontSize: 12, fontWeight: "500", lineHeight: 17 },
        forecast: { color: t.colors.textSecondary, fontSize: 13, fontWeight: "600", lineHeight: 19 },

        barTrack: {
            height: 10,
            borderRadius: 999,
            backgroundColor: t.colors.glassSoft,
            overflow: "hidden",
        },
        barFill: { height: 10, borderRadius: 999 },
        diskRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
        diskFree: { color: t.colors.textPrimary, fontSize: 30, fontWeight: "800", letterSpacing: -1 },
        diskFreeLabel: { color: t.colors.textMuted, fontSize: 14, fontWeight: "700" },
        diskPct: { fontSize: 13, fontWeight: "800" },
        diskText: { color: t.colors.textMuted, fontSize: 12, fontWeight: "600" },

        clear: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
        clearText: { color: t.colors.accentText, fontWeight: "700", fontSize: 13 },

        layer: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingVertical: 13,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
        },
        layerFirst: { borderTopWidth: 0, marginTop: 2 },
        layerPressed: { opacity: 0.7, backgroundColor: t.colors.glassSoft, borderRadius: 12 },
        layerIcon: {
            width: 38,
            height: 38,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
        },
        layerText: { flex: 1 },
        layerTitle: { color: t.colors.textPrimary, fontWeight: "800", fontSize: 15 },
        layerSub: { color: t.colors.textMuted, fontWeight: "500", fontSize: 12, marginTop: 3, lineHeight: 16 },
    });
