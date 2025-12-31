import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";

export default function CreditAnalyticsScreen() {
    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <Text style={styles.title}>Credit Analytics</Text>
                    <Text style={styles.subtitle}>Track how credits are used over time.</Text>

                    <View style={styles.grid}>
                        <StatCard title="This week" value="—" hint="Credits used" />
                        <StatCard title="This month" value="—" hint="Credits used" />
                        <StatCard title="Avg / doc" value="—" hint="Estimated" />
                        <StatCard title="Top category" value="—" hint="Most processed" />
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Usage timeline</Text>
                        <Text style={styles.cardText}>
                            UI placeholder. Later you can map real ledger data to a chart.
                        </Text>

                        <View style={styles.fakeBars}>
                            <View style={[styles.bar, { width: "45%" }]} />
                            <View style={[styles.bar, { width: "70%" }]} />
                            <View style={[styles.bar, { width: "35%" }]} />
                            <View style={[styles.bar, { width: "85%" }]} />
                            <View style={[styles.bar, { width: "55%" }]} />
                        </View>
                    </View>

                    <Text style={styles.note}>
                        This screen is UI-only and safe. Wire real metrics when backend is ready.
                    </Text>
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

function StatCard({ title, value, hint }) {
    return (
        <View style={styles.stat}>
            <Text style={styles.statTitle}>{title}</Text>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statHint}>{hint}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 18, gap: 14 },
    title: { color: "#fff", fontSize: 26, fontWeight: "900" },
    subtitle: { color: "rgba(255,255,255,0.7)", fontWeight: "700" },

    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    stat: {
        width: "47%",
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 18,
        padding: 14,
        gap: 6,
    },
    statTitle: { color: "rgba(255,255,255,0.65)", fontWeight: "900" },
    statValue: { color: "#E0E7FF", fontSize: 18, fontWeight: "900" },
    statHint: { color: "rgba(255,255,255,0.55)", fontWeight: "700", fontSize: 12 },

    card: {
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 22,
        padding: 16,
        gap: 10,
    },
    cardTitle: { color: "#A5B4FC", fontWeight: "900" },
    cardText: { color: "rgba(255,255,255,0.72)", fontWeight: "700" },

    fakeBars: { gap: 10, marginTop: 6 },
    bar: {
        height: 10,
        borderRadius: 999,
        backgroundColor: "rgba(165,180,252,0.55)",
    },

    note: {
        textAlign: "center",
        color: "rgba(255,255,255,0.55)",
        fontSize: 12,
        fontWeight: "700",
    },
});
