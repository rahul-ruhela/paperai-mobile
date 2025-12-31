import React from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";

export default function PrivacyScreen() {
    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container}>
                    <Text style={styles.title}>Privacy Policy</Text>
                    <Text style={styles.text}>
                        Your documents are processed securely. We do not share your data
                        with third parties. All AI processing is scoped to your account.
                    </Text>
                </ScrollView>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: { padding: 18 },
    title: { color: "#fff", fontSize: 24, fontWeight: "900", marginBottom: 12 },
    text: { color: "rgba(255,255,255,0.8)", lineHeight: 22, fontWeight: "700" },
});
