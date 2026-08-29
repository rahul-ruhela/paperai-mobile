import React from "react";
import { Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "./ThemeProvider";
import useThemedStyles from "./useThemedStyles";

/**
 * PhotoPermissionSheet — the photo-library counterpart to CameraPermissionGate.
 *
 * WHY A PRE-PROMPT AT ALL
 *
 * iOS shows the photo dialog exactly once. Before this, Junk Wiper and Storage
 * Scan called MediaLibrary.requestPermissionsAsync() cold — the system dialog
 * arrived with no context beyond the purpose string, and the only explanation
 * the user ever saw was an Alert AFTER they had already said no, by which point
 * the decision could only be undone in Settings. That is the flow guideline
 * 5.1.1(i) is about: say why before you ask.
 *
 * THE RULES THIS FILE INHERITS
 *
 * These come from the real 5.1.1(iv) rejection documented in
 * CameraPermissionGate (submission 850bc1f5-b8f4-4b6b-9062-ec84463554ac), and
 * they are not stylistic:
 *
 *   1. Neutral button wording. "Continue", never "Allow" / "Grant Access" /
 *      "Enable Photos". A pre-prompt may explain; it may not campaign.
 *   2. In the `undetermined` state there is NO cancel, back or skip control.
 *      The user must always arrive at the system dialog after reading the
 *      message. A dismissible explainer is the exact thing Apple rejected.
 *
 * Hence `dismissable` is false for the explainer: the hardware back button and
 * the backdrop are both inert there, and the sheet renders a single control.
 *
 * The `denied` state has the opposite shape on purpose. The system dialog has
 * already been shown and answered, so there is nothing left to funnel the user
 * into — a Settings link and a way out are both allowed and are the only
 * genuinely useful things left to offer.
 */
export default function PhotoPermissionSheet({
    visible,
    // "explain" → pre-prompt, before the system dialog.
    // "denied"  → the dialog has been answered; only Settings can change it.
    mode = "explain",
    title,
    reason,
    onContinue,
    onDismiss,
}) {
    const { theme } = useTheme();
    const c = theme.colors;
    const styles = useThemedStyles(makeStyles);

    const denied = mode === "denied";

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            // Only the denied state may be dismissed without acting. See above.
            onRequestClose={denied ? onDismiss : undefined}
        >
            <View style={styles.backdrop}>
                <View style={styles.card}>
                    <View style={styles.iconWrap}>
                        <Ionicons
                            name={denied ? "lock-closed-outline" : "images-outline"}
                            size={26}
                            color={c.primary}
                        />
                    </View>

                    <Text style={styles.title}>
                        {title || (denied ? "Photo access is turned off" : "Photo access")}
                    </Text>
                    <Text style={styles.reason}>{reason}</Text>

                    <View style={styles.assurance}>
                        <Ionicons name="shield-checkmark-outline" size={14} color={c.primary} />
                        <Text style={styles.assuranceText}>
                            Photos are read on this device. Nothing is uploaded, and nothing is
                            deleted without you confirming it.
                        </Text>
                    </View>

                    {denied ? (
                        <>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Open Settings"
                                onPress={() => Linking.openSettings()}
                                style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                            >
                                <Ionicons name="settings-outline" size={16} color={c.onPrimary} />
                                <Text style={styles.primaryBtnText}>Open Settings</Text>
                            </Pressable>
                            <Pressable
                                accessibilityRole="button"
                                onPress={onDismiss}
                                style={styles.ghostBtn}
                            >
                                <Text style={styles.ghostBtnText}>Not now</Text>
                            </Pressable>
                        </>
                    ) : (
                        /* Neutral label, and the ONLY control in this state.
                           Do not add a cancel here — see the header comment. */
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Continue"
                            onPress={onContinue}
                            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                        >
                            <Text style={styles.primaryBtnText}>Continue</Text>
                        </Pressable>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        backdrop: {
            flex: 1,
            backgroundColor: "rgba(2,6,23,0.62)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
        },
        card: {
            width: "100%",
            maxWidth: 420,
            backgroundColor: t.colors.surface,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: t.colors.border,
            padding: 22,
            alignItems: "center",
            gap: 10,
        },
        iconWrap: {
            width: 54,
            height: 54,
            borderRadius: 27,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.colors.infoBg,
            marginBottom: 2,
        },
        title: {
            color: t.colors.textPrimary,
            fontSize: 19,
            fontWeight: "800",
            textAlign: "center",
        },
        reason: {
            color: t.colors.textMuted,
            fontSize: 14,
            lineHeight: 20,
            textAlign: "center",
        },
        assurance: {
            flexDirection: "row",
            gap: 8,
            alignItems: "flex-start",
            backgroundColor: t.colors.infoBg,
            borderRadius: 12,
            padding: 10,
            marginTop: 2,
        },
        assuranceText: {
            flex: 1,
            color: t.colors.textMuted,
            fontSize: 12,
            lineHeight: 17,
            fontWeight: "500",
        },
        primaryBtn: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            alignSelf: "stretch",
            backgroundColor: t.colors.primary,
            paddingVertical: 14,
            borderRadius: 14,
            marginTop: 8,
        },
        primaryBtnText: { color: t.colors.onPrimary, fontSize: 16, fontWeight: "800" },
        pressed: { opacity: 0.78 },
        ghostBtn: { paddingVertical: 10, paddingHorizontal: 18 },
        ghostBtnText: { color: t.colors.textMuted, fontSize: 15, fontWeight: "700" },
    });
