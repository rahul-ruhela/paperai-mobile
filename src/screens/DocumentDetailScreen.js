import React from "react";
import { ScrollView, Text, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";

export default function DocumentDetailScreen({ route }) {
    const { result, title } = route.params;

    function Section({ title, children }) {
        return (
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>{title}</Text>
                {children}
            </View>
        );
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container}>
                    <Text style={styles.header}>{title}</Text>

                    <Section title="Summary">
                        <Text style={styles.text}>{result.summary}</Text>
                    </Section>

                    <Section title="Action Items">
                        {result.actionItems.map((a, i) => (
                            <Text key={i} style={styles.bullet}>
                                • {a}
                            </Text>
                        ))}
                    </Section>

                    <Section title="Category">
                        <Text style={styles.text}>{result.category}</Text>
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
        color: "#fff",
        fontSize: 22,
        fontWeight: "900",
    },
    section: {
        backgroundColor: "rgba(255,255,255,0.06)",
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
    },
    sectionTitle: {
        color: "#A5B4FC",
        fontWeight: "900",
        marginBottom: 8,
    },
    text: {
        color: "rgba(255,255,255,0.8)",
        fontWeight: "700",
        lineHeight: 22,
    },
    bullet: {
        color: "rgba(255,255,255,0.85)",
        fontWeight: "700",
        marginBottom: 6,
    },
});
