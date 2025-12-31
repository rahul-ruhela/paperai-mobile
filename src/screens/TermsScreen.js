import React from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";

export default function TermsScreen() {
    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container}>
                    <Text style={styles.title}>Terms of Service</Text>
                    <Text style={styles.text}>
                        By using PaperAI, you agree to use the service responsibly and not
                        misuse AI-generated content.
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
