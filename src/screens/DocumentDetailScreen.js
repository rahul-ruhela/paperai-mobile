import React from "react";
import { ScrollView, Text, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";

export default function DocumentDetailScreen({ route, navigation }) {
    const { result, title } = route.params || {};

    function Section({ title, children }) {
        return (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{title}</Text>
                {children}
            </View>
        );
    }

    // 🔹 NEW: Defensive guard (QUEUED / PROCESSING case)
    if (!result) {
        return (
            <GradientScreen>
                <SafeAreaView style={{ flex: 1 }}>
                    <View style={styles.container}>
                        <Text style={styles.header}>{title}</Text>

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                Analysis in progress
                            </Text>
                            <Text style={styles.text}>
                                Your document is still being analyzed.
                            </Text>
                            <Text style={styles.text}>
                                You can go back and check again in a few moments.
                            </Text>
                        </View>
                    </View>
                </SafeAreaView>
            </GradientScreen>
        );
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container}>
                    <Text style={styles.header}>{title}</Text>

                    <Section title="Summary">
                        <Text style={styles.text}>
                            {result.summary || "No summary available yet."}
                        </Text>
                    </Section>

                    <Section title="Action Items">
                        {Array.isArray(result.actionItems) &&
                            result.actionItems.length > 0 ? (
                            result.actionItems.map((a, i) => (
                                <Text key={i} style={styles.bullet}>
                                    • {a}
                                </Text>
                            ))
                        ) : (
                            <Text style={styles.text}>
                                No action items detected.
                            </Text>
                        )}
                    </Section>

                    <Section title="Category">
                        <Text style={styles.text}>
                            {result.category || "—"}
                        </Text>
                    </Section>

                    <Section title="Usage">
                        <Text style={styles.text}>
                            Credits used: {result.creditsUsed ?? "-"}
                        </Text>
                        <Text style={styles.text}>
                            Credits left: {result.creditsLeft ?? "-"}
                        </Text>
                    </Section>
                </ScrollView>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 18,
        gap: 16,
    },
    header: {
        color: "#111111",
        fontSize: 22,
        fontWeight: "800",
    },
    section: {
        backgroundColor: "rgba(255,255,255,0.74)",
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.90)",
        shadowColor: "#4F8CFF", shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    sectionTitle: {
        color: "#2563EB",
        fontWeight: "800",
        marginBottom: 8,
    },
    text: {
        color: "#374151",
        fontWeight: "500",
        lineHeight: 22,
    },
    bullet: {
        color: "#374151",
        fontWeight: "500",
        marginBottom: 6,
    },
});
