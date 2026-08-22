/**
 * ExpensesScreen — the saved receipt list, grouped by month with totals and a
 * CSV export (spec 1.4). Free to view; only extraction costs credits.
 */

import React, { useCallback, useState } from "react";
import {
    View,
    Text,
    SectionList,
    Pressable,
    Image,
    Alert,
    Modal,
    StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Sharing from "expo-sharing";

import GradientScreen from "../ui/GradientScreen";
import Card from "../ui/Card";
import BottomFade from "../ui/BottomFade";
import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";

import {
    listExpenses,
    groupByMonth,
    monthTotal,
    deleteExpense,
    writeCsvFile,
} from "../services/expenseStore";

export default function ExpensesScreen({ navigation }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);

    const [expenses, setExpenses] = useState([]);
    const [preview, setPreview] = useState(null);

    const load = useCallback(async () => {
        setExpenses(await listExpenses());
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    const sections = groupByMonth(expenses);
    const thisMonth = monthTotal(expenses);
    const currency = expenses[0]?.currency || "USD";

    async function exportCsv() {
        if (expenses.length === 0) {
            Alert.alert("Nothing To Export", "Save a receipt first.");
            return;
        }
        try {
            const uri = await writeCsvFile(expenses);
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: "text/csv",
                    dialogTitle: "Export expenses",
                    UTI: "public.comma-separated-values-text",
                });
            } else {
                Alert.alert("Saved", "The CSV was created but sharing is unavailable on this device.");
            }
        } catch (err) {
            Alert.alert("Export Failed", err?.message || "Could not create the CSV file.");
        }
    }

    function confirmDelete(item) {
        Alert.alert("Delete expense?", `${item.merchant} · ${fmtMoney(item.total, item.currency)}`, [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => setExpenses(await deleteExpense(item.id)),
            },
        ]);
    }

    return (
        <GradientScreen>
            <SafeAreaView style={styles.flex}>
                <View style={styles.header}>
                    <Pressable
                        onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Upload"))}
                        hitSlop={16}
                        style={{ padding: 4 }}
                        accessibilityRole="button"
                        accessibilityLabel="Go back"
                    >
                        <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
                    </Pressable>
                    <View style={styles.flex1}>
                        <Text style={styles.headerTitle}>Expenses</Text>
                        <Text style={styles.headerSub}>
                            {expenses.length} receipt{expenses.length === 1 ? "" : "s"}
                        </Text>
                    </View>
                    <Pressable onPress={exportCsv} style={styles.csvBtn} accessibilityRole="button" accessibilityLabel="Export as CSV">
                        <Ionicons name="download-outline" size={15} color={theme.colors.white} />
                        <Text style={styles.csvText}>CSV</Text>
                    </Pressable>
                </View>

                {/* This month */}
                <View style={styles.summary}>
                    <Text style={styles.summaryLabel}>This month</Text>
                    <Text style={styles.summaryValue}>{fmtMoney(thisMonth, currency)}</Text>
                </View>

                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    stickySectionHeadersEnabled
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 110 }}
                    renderSectionHeader={({ section }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{section.title}</Text>
                            <Text style={styles.sectionTotal}>{fmtMoney(section.total, section.currency)}</Text>
                        </View>
                    )}
                    renderItem={({ item }) => (
                        <Card style={styles.row}>
                            <Pressable
                                onPress={() => item.imageUri && setPreview(item.imageUri)}
                                onLongPress={() => confirmDelete(item)}
                                style={styles.rowInner}
                                accessibilityRole="button"
                                accessibilityLabel={`${item.merchant}, ${fmtMoney(item.total, item.currency)}. Tap to view receipt, long press to delete.`}
                            >
                                {item.imageUri ? (
                                    <Image source={{ uri: item.imageUri }} style={styles.thumb} />
                                ) : (
                                    <View style={[styles.thumb, styles.thumbEmpty]}>
                                        <Ionicons name="receipt-outline" size={16} color={theme.colors.textMuted} />
                                    </View>
                                )}

                                <View style={styles.flex1}>
                                    <Text style={styles.merchant} numberOfLines={1}>
                                        {item.merchant}
                                    </Text>
                                    <Text style={styles.meta}>
                                        {new Date(item.dateUtc || item.createdAt).toLocaleDateString(undefined, {
                                            day: "numeric",
                                            month: "short",
                                        })}
                                        {" · "}
                                        {item.category}
                                    </Text>
                                </View>

                                <Text style={styles.amount}>{fmtMoney(item.total, item.currency)}</Text>
                            </Pressable>
                        </Card>
                    )}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <Ionicons name="receipt-outline" size={34} color={theme.colors.accentText} />
                            <Text style={styles.emptyTitle}>No expenses yet</Text>
                            <Text style={styles.emptySub}>
                                Scan a receipt and it will be grouped here by month, ready to export.
                            </Text>
                            <Pressable
                                onPress={() => navigation.navigate("ReceiptCapture")}
                                style={styles.emptyBtn}
                                accessibilityRole="button"
                            >
                                <Ionicons name="camera-outline" size={17} color={theme.colors.white} />
                                <Text style={styles.emptyBtnText}>Scan a receipt</Text>
                            </Pressable>
                        </View>
                    }
                />
            </SafeAreaView>

            <Pressable
                onPress={() => navigation.navigate("ReceiptCapture")}
                style={styles.fab}
                accessibilityRole="button"
                accessibilityLabel="Scan a new receipt"
            >
                <Ionicons name="add" size={22} color={theme.colors.white} />
            </Pressable>

            {/* Receipt image preview */}
            <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
                <Pressable style={styles.previewOverlay} onPress={() => setPreview(null)}>
                    {preview && <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="contain" />}
                </Pressable>
            </Modal>

            <BottomFade />
        </GradientScreen>
    );
}

function fmtMoney(value, currency = "USD") {
    const n = Number(value) || 0;
    try {
        return n.toLocaleString(undefined, { style: "currency", currency });
    } catch {
        return `${currency} ${n.toFixed(2)}`;
    }
}

const makeStyles = (t) =>
    StyleSheet.create({
        flex: { flex: 1 },
        flex1: { flex: 1, minWidth: 0 },

        header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
        headerTitle: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 17 },
        headerSub: { color: t.colors.textMuted, fontWeight: "700", fontSize: 11.5, marginTop: 1 },
        csvBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            paddingHorizontal: 13,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: t.colors.primary,
        },
        csvText: { color: t.colors.white, fontWeight: "900", fontSize: 12.5 },

        summary: {
            marginHorizontal: 16,
            marginBottom: 12,
            padding: 14,
            borderRadius: t.radius.lg,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.glassSoft,
        },
        summaryLabel: { color: t.colors.textMuted, fontWeight: "800", fontSize: 11.5 },
        summaryValue: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 24, marginTop: 4 },

        sectionHeader: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 8,
            backgroundColor: t.colors.background,
        },
        sectionTitle: { color: t.colors.textSecondary, fontWeight: "900", fontSize: 12.5 },
        sectionTotal: { color: t.colors.accentText, fontWeight: "900", fontSize: 12.5 },

        row: { marginBottom: 8 },
        rowInner: { flexDirection: "row", alignItems: "center", gap: 11 },
        thumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: t.colors.glassSoft },
        thumbEmpty: { alignItems: "center", justifyContent: "center" },
        merchant: { color: t.colors.textPrimary, fontWeight: "800", fontSize: 14 },
        meta: { color: t.colors.textMuted, fontWeight: "600", fontSize: 11.5, marginTop: 2 },
        amount: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 14.5 },

        empty: { alignItems: "center", paddingVertical: 50, gap: 8 },
        emptyTitle: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 16, marginTop: 8 },
        emptySub: {
            color: t.colors.textMuted,
            fontWeight: "600",
            fontSize: 12.5,
            textAlign: "center",
            paddingHorizontal: 30,
            lineHeight: 18,
        },
        emptyBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 999,
            backgroundColor: t.colors.primary,
        },
        emptyBtnText: { color: t.colors.white, fontWeight: "900", fontSize: 14 },

        fab: {
            position: "absolute",
            right: 20,
            bottom: 96,
            width: 54,
            height: 54,
            borderRadius: 54,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.colors.primary,
            shadowColor: t.colors.primary,
            shadowOpacity: 0.4,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
            elevation: 8,
        },

        previewOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
        previewImg: { width: "94%", height: "84%" },
    });
