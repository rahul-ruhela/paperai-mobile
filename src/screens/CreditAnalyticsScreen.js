import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientScreen from "../ui/GradientScreen";
import { getCreditsBalance, getFeatureConfigs } from "../api/credits";

import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";
// Friendly display name for a feature config.
function featureLabel(f) {
    return f.userNoticeTitle || prettify(f.featureKey);
}
function prettify(key = "") {
    return String(key)
        .replace(/[_\-.]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CreditAnalyticsScreen() {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(false);
    const [balance, setBalance] = useState(null);
    const [features, setFeatures] = useState([]);

    async function load() {
        setError(false);
        try {
            const [bal, configs] = await Promise.all([
                getCreditsBalance().catch(() => null),
                getFeatureConfigs().catch(() => []),
            ]);
            setBalance(typeof bal?.credits === "number" ? bal.credits : bal?.credits ?? null);
            const list = Array.isArray(configs) ? configs : [];
            // Only paid, enabled features with a positive cost.
            setFeatures(
                list
                    .filter((f) => (f?.creditCost ?? 0) > 0 && f?.isEnabled !== false)
                    .sort((a, b) => (b.creditCost ?? 0) - (a.creditCost ?? 0))
            );
        } catch {
            setError(true);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    function onRefresh() {
        setRefreshing(true);
        load();
    }

    // Derived insights.
    const costs = features.map((f) => f.creditCost);
    const maxCost = costs.length ? Math.max(...costs) : 0;
    const minCost = costs.length ? Math.min(...costs) : 0;
    const avgCost = costs.length ? Math.round((costs.reduce((s, c) => s + c, 0) / costs.length) * 10) / 10 : 0;
    const cheapest = features.length ? features[features.length - 1] : null;
    const dearest = features.length ? features[0] : null;
    const runsWithBalance =
        balance != null && cheapest && cheapest.creditCost > 0
            ? Math.floor(balance / cheapest.creditCost)
            : null;

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView
                    contentContainerStyle={styles.container}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
                >
                    <Text style={styles.title}>Credit Analytics</Text>
                    <Text style={styles.subtitle}>Your balance and how features consume credits.</Text>

                    {loading ? (
                        <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>
                    ) : (
                        <>
                            {/* Balance hero */}
                            <View style={styles.hero}>
                                <Text style={styles.heroLabel}>Current balance</Text>
                                <Text style={styles.heroValue}>{balance != null ? balance : "—"}</Text>
                                <Text style={styles.heroHint}>credits available</Text>
                            </View>

                            {/* Stat grid */}
                            <View style={styles.grid}>
                                <StatCard title="Paid features" value={String(features.length || "—")} hint="Enabled" />
                                <StatCard title="Avg cost" value={features.length ? String(avgCost) : "—"} hint="Credits / feature" />
                                <StatCard title="Lowest cost" value={features.length ? String(minCost) : "—"} hint={cheapest ? featureLabel(cheapest) : "—"} />
                                <StatCard title="Highest cost" value={features.length ? String(maxCost) : "—"} hint={dearest ? featureLabel(dearest) : "—"} />
                            </View>

                            {/* Insight banner */}
                            {runsWithBalance != null && cheapest && (
                                <View style={styles.insight}>
                                    <Text style={styles.insightText}>
                                        With {balance} credits you can run{" "}
                                        <Text style={styles.insightStrong}>{featureLabel(cheapest)}</Text> about{" "}
                                        <Text style={styles.insightStrong}>{runsWithBalance}</Text> time{runsWithBalance === 1 ? "" : "s"}.
                                    </Text>
                                </View>
                            )}

                            {/* Cost-per-feature bar chart */}
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Credit cost by feature</Text>
                                {features.length === 0 ? (
                                    <Text style={styles.cardText}>
                                        {error
                                            ? "Couldn't load analytics right now. Pull down to retry."
                                            : "No paid features are configured yet."}
                                    </Text>
                                ) : (
                                    features.map((f) => {
                                        const pct = maxCost > 0 ? Math.max(8, Math.round((f.creditCost / maxCost) * 100)) : 0;
                                        return (
                                            <View key={f.featureKey} style={styles.barRow}>
                                                <View style={styles.barHeader}>
                                                    <Text style={styles.barLabel} numberOfLines={1}>{featureLabel(f)}</Text>
                                                    <Text style={styles.barValue}>{f.creditCost}</Text>
                                                </View>
                                                <View style={styles.barTrack}>
                                                    <View style={[styles.barFill, { width: `${pct}%` }]} />
                                                </View>
                                            </View>
                                        );
                                    })
                                )}
                            </View>

                            {/* Affordability chart: how many runs your balance buys per feature */}
                            {balance != null && features.length > 0 && (
                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>Runs you can afford</Text>
                                    {(() => {
                                        const runs = features.map((f) => ({
                                            key: f.featureKey,
                                            label: featureLabel(f),
                                            n: f.creditCost > 0 ? Math.floor(balance / f.creditCost) : 0,
                                        }));
                                        const maxRuns = Math.max(1, ...runs.map((r) => r.n));
                                        return runs.map((r) => {
                                            const pct = Math.max(6, Math.round((r.n / maxRuns) * 100));
                                            return (
                                                <View key={r.key} style={styles.barRow}>
                                                    <View style={styles.barHeader}>
                                                        <Text style={styles.barLabel} numberOfLines={1}>{r.label}</Text>
                                                        <Text style={styles.barValue}>{r.n}×</Text>
                                                    </View>
                                                    <View style={styles.barTrack}>
                                                        <View style={[styles.barFill, styles.barFillAlt, { width: `${pct}%` }]} />
                                                    </View>
                                                </View>
                                            );
                                        });
                                    })()}
                                </View>
                            )}

                            <Text style={styles.note}>Pull down to refresh. Costs are read live from your account.</Text>
                        </>
                    )}
                </ScrollView>
            </SafeAreaView>
        </GradientScreen>
    );
}

function StatCard({ title, value, hint }) {
    const styles = useThemedStyles(makeStyles);
    return (
        <View style={styles.stat}>
            <Text style={styles.statTitle}>{title}</Text>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statHint} numberOfLines={1}>{hint}</Text>
        </View>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
    container: { padding: 18, gap: 14, paddingBottom: 40 },
    title: { color: t.colors.textPrimary, fontSize: 26, fontWeight: "800" },
    subtitle: { color: t.colors.textMuted, fontWeight: "500" },
    center: { paddingVertical: 40, alignItems: "center" },

    hero: {
        backgroundColor: t.colors.infoBg,
        borderWidth: 1,
        borderColor: t.colors.infoBorder,
        borderRadius: 22,
        padding: 18,
        alignItems: "center",
    },
    heroLabel: { color: t.colors.textMuted, fontWeight: "700", fontSize: 13 },
    heroValue: { color: t.colors.textPrimary, fontSize: 44, fontWeight: "800", marginVertical: 2 },
    heroHint: { color: t.colors.accentText, fontWeight: "700", fontSize: 12 },

    grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    stat: {
        width: "47%",
        backgroundColor: t.colors.glass,
        borderWidth: 1,
        borderColor: t.colors.glassBorder,
        borderRadius: 18,
        padding: 14,
        gap: 4,
        shadowColor: t.colors.primary, shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    statTitle: { color: t.colors.textMuted, fontWeight: "700", fontSize: 12 },
    statValue: { color: t.colors.textPrimary, fontSize: 22, fontWeight: "800" },
    statHint: { color: t.colors.textMuted, fontWeight: "500", fontSize: 11 },

    insight: {
        backgroundColor: t.colors.infoBg,
        borderWidth: 1,
        borderColor: t.colors.infoBorder,
        borderRadius: 16,
        padding: 14,
    },
    insightText: { color: t.colors.textSecondary, fontWeight: "500", lineHeight: 20 },
    insightStrong: { color: t.colors.accentText, fontWeight: "800" },

    card: {
        backgroundColor: t.colors.glass,
        borderWidth: 1,
        borderColor: t.colors.glassBorder,
        borderRadius: 22,
        padding: 16,
        gap: 12,
        shadowColor: t.colors.primary, shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    cardTitle: { color: t.colors.accentText, fontWeight: "800" },
    cardText: { color: t.colors.textMuted, fontWeight: "500" },

    barRow: { gap: 6 },
    barHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
    barLabel: { color: t.colors.textSecondary, fontWeight: "700", flex: 1, fontSize: 13 },
    barValue: { color: t.colors.textPrimary, fontWeight: "800", fontSize: 13 },
    barTrack: { height: 10, borderRadius: 999, backgroundColor: t.colors.separator, overflow: "hidden" },
    barFill: { height: 10, borderRadius: 999, backgroundColor: t.colors.primary },
    barFillAlt: { backgroundColor: t.colors.accent },

    note: { textAlign: "center", color: t.colors.textMuted, fontSize: 12, fontWeight: "500" },
});
