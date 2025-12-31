import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";
import AppButton from "../ui/AppButton";

export default function PaywallScreen({ navigation }) {
    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <Text style={styles.title}>Upgrade to Pro</Text>

                    <Text style={styles.subtitle}>
                        Unlock unlimited AI document processing and premium features.
                    </Text>

                    <View style={styles.card}>
                        <Text style={styles.feature}>✔ Unlimited AI processing</Text>
                        <Text style={styles.feature}>✔ Faster analysis</Text>
                        <Text style={styles.feature}>✔ Priority access</Text>
                    </View>

                    <Text style={styles.note}>
                        Subscriptions are disabled in development.
                        Credits are granted manually for testing.
                    </Text>

                    <AppButton
                        title="Go Back"
                        onPress={() => navigation.goBack()}
                    />
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        justifyContent: "center",
        gap: 16,
    },
    title: {
        fontSize: 26,
        fontWeight: "900",
        color: "#fff",
        textAlign: "center",
    },
    subtitle: {
        color: "rgba(255,255,255,0.75)",
        textAlign: "center",
        fontWeight: "700",
    },
    card: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderRadius: 20,
        padding: 16,
        gap: 10,
    },
    feature: {
        color: "#E0E7FF",
        fontWeight: "800",
    },
    note: {
        fontSize: 12,
        color: "rgba(255,255,255,0.55)",
        textAlign: "center",
    },
});
