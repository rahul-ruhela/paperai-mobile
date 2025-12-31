import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";

export default function IAPSetupScreen() {
    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <Text style={styles.title}>Apple IAP </Text>
                    <Text style={styles.subtitle}>
                        This is a UI checklist for enabling subscriptions via Dev Client / TestFlight.
                    </Text>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Checklist</Text>

                        <Check text="Create products in App Store Connect (subscriptions)" />
                        <Check text="Create subscription group + pricing" />
                        <Check text="Enable In-App Purchase capability in Xcode" />
                        <Check text="Build Expo Dev Client (not Expo Go)" />
                        <Check text="Test with Sandbox tester accounts" />
                        <Check text="Ship to TestFlight for final validation" />
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Notes</Text>
                        <Text style={styles.text}>
                            Your backend code exists but UI is disabled. This screen is only for UX and navigation.
                        </Text>
                    </View>
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

function Check({ text }) {
    return (
        <View style={styles.row}>
            <View style={styles.dot} />
            <Text style={styles.text}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 18, gap: 14 },
    title: { color: "#fff", fontSize: 26, fontWeight: "900" },
    subtitle: { color: "rgba(255,255,255,0.7)", fontWeight: "700" },

    card: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 22,
        padding: 16,
        gap: 10,
    },
    cardTitle: { color: "#A5B4FC", fontWeight: "900" },

    row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    dot: {
        marginTop: 7,
        width: 8,
        height: 8,
        borderRadius: 999,
        backgroundColor: "#A5B4FC",
    },
    text: { color: "rgba(255,255,255,0.78)", fontWeight: "700", flex: 1 },
});
