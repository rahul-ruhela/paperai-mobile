import React from "react";
import { ScrollView, Text, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";

export default function HelpCenterScreen() {
    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container}>
                    <Text style={styles.title}>Help Center</Text>

                    <FAQ q="Why is my document pending?" a="AI analysis may take a few seconds. Tap the document to retry." />
                    <FAQ q="Why did credits reduce?" a="Credits are consumed based on document size and AI usage." />
                    <FAQ q="Upload failed?" a="Check file size and internet connection." />
                </ScrollView>
            </SafeAreaView>
        </GradientScreen>
    );
}

function FAQ({ q, a }) {
    return (
        <View style={styles.card}>
            <Text style={styles.q}>{q}</Text>
            <Text style={styles.a}>{a}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: 18, gap: 14 },
    title: { color: "#fff", fontSize: 24, fontWeight: "900" },
    card: {
        backgroundColor: "rgba(255,255,255,0.06)",
        padding: 14,
        borderRadius: 18,
    },
    q: { color: "#A5B4FC", fontWeight: "900" },
    a: { marginTop: 6, color: "rgba(255,255,255,0.8)", fontWeight: "700" },
});
