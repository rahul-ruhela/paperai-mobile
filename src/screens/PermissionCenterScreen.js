import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    Pressable,
    Linking,
    AppState,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import GradientScreen from "../ui/GradientScreen";
import StatusBadge from "../ui/StatusBadge";
import { PrimaryButton } from "../ui/buttons";
import useThemedStyles from "../ui/useThemedStyles";
import { useTheme } from "../ui/ThemeProvider";

import { getAllStatuses, manageLimitedPhotos, STATE } from "../services/permissionStatus";

/**
 * PermissionCenterScreen — a read-only view of the permissions Paper AI can use.
 *
 * This screen shows state and never asks for it. Two reasons, and both are
 * load-bearing:
 *
 *   1. iOS shows a permission prompt ONCE per install. After that, calling
 *      request*Async resolves as denied without displaying anything — so a
 *      "Try again" button here would be a control that visibly does nothing.
 *   2. App Store guideline 5.1.1 wants the prompt at the point of use, with a
 *      purpose string that matches what is about to happen. A settings panel is
 *      not a point of use.
 *
 * So the only escape hatch is Settings. The one exception is the iOS limited
 * photo library, where the system picker — not the app — changes the selection.
 *
 * Status is re-read on mount and on every foreground: iOS lets the user change
 * a permission while the app is backgrounded, which is exactly what happens
 * when they follow the Open Settings button, so a cached value would show them
 * the state they just left behind.
 */

const BADGE = {
    [STATE.GRANTED]: { label: "Allowed", tone: "success", icon: "checkCircle" },
    [STATE.LIMITED]: { label: "Limited access", tone: "warning", icon: "warning" },
    [STATE.DENIED]: { label: "Denied", tone: "danger", icon: "error" },
    [STATE.UNDETERMINED]: { label: "Not asked", tone: "neutral" },
    [STATE.UNKNOWN]: { label: "Unknown", tone: "neutral" },
    [STATE.NOT_USED]: { label: "Not used by this app", tone: "neutral" },
};

const ICON = {
    camera: "camera-outline",
    photos: "images-outline",
    notifications: "notifications-outline",
    microphone: "mic-off-outline",
    location: "location-outline",
};

// What each state means for the user, in the row itself. "Not asked" is the one
// that needs saying most: it is not a problem to fix, it just has not come up.
const EXPLAIN = {
    [STATE.LIMITED]:
        "Paper AI can only see the photos you picked, so a scan covers those and nothing else.",
    [STATE.DENIED]: "Turn this on in Settings if you want to use the features below.",
    [STATE.UNDETERMINED]: "Paper AI will ask the first time you use one of these features.",
    [STATE.UNKNOWN]: "This permission could not be read on this device.",
};

export default function PermissionCenterScreen() {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);

    const [rows, setRows] = useState(null);
    const mounted = useRef(true);

    const refresh = useCallback(async () => {
        const next = await getAllStatuses();
        if (mounted.current) setRows(next);
    }, []);

    useEffect(() => {
        mounted.current = true;
        refresh();

        const sub = AppState.addEventListener("change", (next) => {
            if (next === "active") refresh();
        });

        return () => {
            mounted.current = false;
            sub.remove();
        };
    }, [refresh]);

    const onManage = useCallback(async () => {
        try {
            await manageLimitedPhotos();
        } catch {
            // The picker was dismissed or is unavailable — either way the only
            // sensible response is to re-read and show what is true now.
        }
        refresh();
    }, [refresh]);

    function Row({ row }) {
        const badge = BADGE[row.state] ?? BADGE[STATE.UNKNOWN];
        const explain = EXPLAIN[row.state];

        return (
            <View
                style={styles.row}
                accessible
                accessibilityLabel={`${row.label}, ${badge.label}. ${row.why}`}
            >
                <View style={styles.rowHead}>
                    <View style={[styles.rowIcon, !row.usedByApp && styles.rowIconMuted]}>
                        <Ionicons
                            name={ICON[row.key] ?? "help-circle-outline"}
                            size={18}
                            color={row.usedByApp ? theme.colors.accentText : theme.colors.textMuted}
                        />
                    </View>
                    <Text style={styles.rowTitle}>{row.label}</Text>
                    <StatusBadge label={badge.label} tone={badge.tone} icon={badge.icon} />
                </View>

                <Text style={styles.rowWhy}>{row.why}</Text>

                {explain ? <Text style={styles.rowExplain}>{explain}</Text> : null}

                {row.features.length ? (
                    <Text style={styles.rowFeatures}>
                        {row.state === STATE.DENIED ? "Turned off: " : "Used by: "}
                        {row.features.join(" · ")}
                    </Text>
                ) : null}

                {row.canManage ? (
                    <Pressable
                        onPress={onManage}
                        accessibilityRole="button"
                        accessibilityLabel="Manage selected photos"
                        style={({ pressed }) => [styles.manageBtn, pressed && { opacity: 0.75 }]}
                    >
                        <Ionicons
                            name="options-outline"
                            size={15}
                            color={theme.colors.accentText}
                        />
                        <Text style={styles.manageText}>Manage selection</Text>
                    </Pressable>
                ) : null}
            </View>
        );
    }

    return (
        <GradientScreen>
            <SafeAreaView style={styles.safe} edges={["bottom"]}>
                <ScrollView
                    contentContainerStyle={styles.container}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.card}>
                        <Text style={styles.section}>Permissions</Text>
                        <Text style={styles.sectionHint}>
                            What Paper AI is allowed to use on this device. Nothing here changes a
                            setting — only you can, in the iPhone Settings app.
                        </Text>

                        {rows === null ? (
                            <View style={styles.loading}>
                                <ActivityIndicator color={theme.colors.primary} />
                            </View>
                        ) : (
                            rows.map((row) => <Row key={row.key} row={row} />)
                        )}
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.section}>Change a permission</Text>
                        {/* iOS has no public API to deep-link to a single toggle,
                            so the copy names the step rather than promising a
                            jump that will not happen. */}
                        <Text style={styles.sectionHint}>
                            Open Settings, then tap the permission you want to change. Paper AI
                            keeps working with everything switched off — the features that need a
                            permission will explain what they need when you open them.
                        </Text>
                        <PrimaryButton
                            title="Open Settings"
                            icon="settings"
                            onPress={() => Linking.openSettings()}
                        />
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
            gap: 6,
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
            marginBottom: 6,
            textTransform: "uppercase",
            letterSpacing: 0.4,
        },
        sectionHint: {
            color: t.colors.textMuted,
            fontSize: 12,
            fontWeight: "500",
            lineHeight: 17,
            marginBottom: 10,
        },

        loading: { paddingVertical: 24, alignItems: "center" },

        row: {
            gap: 6,
            paddingVertical: 12,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
        },
        rowHead: { flexDirection: "row", alignItems: "center", gap: 10 },
        rowIcon: {
            width: 34,
            height: 34,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.colors.infoBg,
            borderWidth: 1,
            borderColor: t.colors.infoBorder,
        },
        rowIconMuted: {
            backgroundColor: t.colors.glassSoft,
            borderColor: t.colors.border,
        },
        rowTitle: { flex: 1, color: t.colors.textPrimary, fontWeight: "800", fontSize: 15 },
        rowWhy: { color: t.colors.textSecondary, fontSize: 12, fontWeight: "600", lineHeight: 17 },
        rowExplain: { color: t.colors.textMuted, fontSize: 12, fontWeight: "500", lineHeight: 17 },
        rowFeatures: { color: t.colors.textMuted, fontSize: 11, fontWeight: "600", lineHeight: 16 },

        manageBtn: {
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
            gap: 6,
            marginTop: 4,
            minHeight: 44,
            paddingHorizontal: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: t.colors.infoBorder,
            backgroundColor: t.colors.infoBg,
        },
        manageText: { color: t.colors.accentText, fontWeight: "800", fontSize: 13 },
    });
