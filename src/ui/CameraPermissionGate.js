import React from "react";
import { View, Text, Pressable, Linking, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

/**
 * CameraPermissionGate — App Review compliant camera permission flow.
 *
 * App Store guideline 5.1.1(iv) rejection, 2026-08-21 (submission
 * 850bc1f5-b8f4-4b6b-9062-ec84463554ac). The previous screen broke two rules:
 *
 *   1. The button said "Grant Permission". Apple requires neutral wording —
 *      "Continue" or "Next" — because a pre-prompt must not campaign for a yes.
 *   2. A "Go Back" button let the user dismiss the explainer WITHOUT ever
 *      reaching the system dialog. Apple requires that the user always proceeds
 *      to the permission request after the message.
 *
 * So the two states are strictly separated:
 *
 *   status "undetermined"  → explainer + "Continue" ONLY. No escape hatch. The
 *                            next tap always shows the iOS dialog.
 *   status "denied"        → the system dialog has already been answered, so a
 *                            Settings link and a way back are both allowed and
 *                            genuinely helpful here.
 *
 * Do not add a cancel/back/skip control to the undetermined branch. That is the
 * exact thing that was rejected.
 */
export default function CameraPermissionGate({
    permission,
    requestPermission,
    onGoBack,
    icon = "camera-outline",
    // Explains WHY the camera is needed, shown before the system dialog.
    reason = "Paper AI uses the camera for this feature.",
}) {
    if (!permission) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#A5B4FC" />
            </View>
        );
    }

    const undetermined = permission.status === "undetermined" || permission.canAskAgain;

    if (undetermined) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.box}>
                    <Ionicons name={icon} size={52} color="#A5B4FC" />
                    <Text style={styles.title}>Camera Access</Text>
                    <Text style={styles.subtitle}>{reason}</Text>

                    {/* Neutral label, and the ONLY control on this screen. */}
                    <Pressable
                        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.75 }]}
                        onPress={requestPermission}
                        accessibilityRole="button"
                        accessibilityLabel="Continue"
                    >
                        <Text style={styles.btnText}>Continue</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    // Denied — the system dialog has already been shown and answered.
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.box}>
                <Ionicons name={icon} size={52} color="#A5B4FC" />
                <Text style={styles.title}>Camera Is Turned Off</Text>
                <Text style={styles.subtitle}>
                    This feature needs the camera. You can turn it back on in Settings.
                </Text>

                <Pressable
                    style={({ pressed }) => [styles.btn, pressed && { opacity: 0.75 }]}
                    onPress={() => Linking.openSettings()}
                    accessibilityRole="button"
                    accessibilityLabel="Open Settings"
                >
                    <Ionicons name="settings-outline" size={16} color="#020617" />
                    <Text style={styles.btnText}>Open Settings</Text>
                </Pressable>

                <Pressable style={styles.cancelBtn} onPress={onGoBack} accessibilityRole="button">
                    <Text style={styles.cancelText}>Go Back</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#020617",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    box: { alignItems: "center", gap: 12, maxWidth: 420 },
    title: { color: "#FFFFFF", fontSize: 22, fontWeight: "800", marginTop: 6 },
    subtitle: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 15,
        textAlign: "center",
        lineHeight: 21,
        marginBottom: 6,
    },
    btn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "#A5B4FC",
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 14,
    },
    btnText: { color: "#020617", fontSize: 16, fontWeight: "800" },
    cancelBtn: { paddingVertical: 12, paddingHorizontal: 20, marginTop: 4 },
    cancelText: { color: "rgba(255,255,255,0.55)", fontSize: 15, fontWeight: "700" },
});
