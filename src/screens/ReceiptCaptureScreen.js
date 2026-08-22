/**
 * ReceiptCaptureScreen — capture a receipt, extract structured fields, review
 * and save as an expense (spec 1.4).
 *
 * Credits: 1 per successful extraction, refunded when the read fails (no merchant
 * AND no total) — CONTEXT §3 rule 1. No subscription-tier gate; see the note
 * further down and in AiChatScreen.
 *
 * Every field is editable. OCR on a crumpled thermal receipt is wrong often
 * enough that a read-only result feels broken, so low-confidence fields are
 * pre-highlighted rather than presented as fact.
 */

import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TextInput,
    Pressable,
    Image,
    ScrollView,
    Alert,
    ActivityIndicator,
    StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

import GradientScreen from "../ui/GradientScreen";
import AiOrb from "../ui/AiOrb";
import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";

import { extractReceipt, isFailedRead, CATEGORIES, RECEIPT_FEATURE_KEY, USE_STUB } from "../api/receipts";
import {
    getFeatureConfig,
    reserveCredits,
    completeTransaction,
    refundTransaction,
} from "../api/credits";
import { saveExpense } from "../services/expenseStore";
import { useCreditBalance } from "../hooks/useCreditBalance";

export default function ReceiptCaptureScreen({ navigation }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);

    const { refresh: refreshCredits } = useCreditBalance();

    const [imageUri, setImageUri] = useState(null);
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const [cfg, setCfg] = useState({ creditCost: 1 });

    useEffect(() => {
        getFeatureConfig(RECEIPT_FEATURE_KEY)
            .then((c) => c && setCfg(c))
            .catch(() => {});
    }, []);

    const cost = cfg?.creditCost ?? 1;

    async function pick(fromCamera) {
        const perm = fromCamera
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!perm.granted) {
            Alert.alert(
                fromCamera ? "Camera Access Needed" : "Photo Access Needed",
                "Allow access so you can add a receipt."
            );
            return;
        }

        const res = fromCamera
            ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
            : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });

        if (!res.canceled && res.assets?.[0]?.uri) {
            setImageUri(res.assets[0].uri);
            setResult(null);
        }
    }

    async function runExtract() {
        if (!imageUri) return;
        setBusy(true);

        // ── Credits (CONTEXT §3) ──────────────────────────────────────────────
        let txnId = null;
        try {
            const r = await reserveCredits(RECEIPT_FEATURE_KEY, null, 0);
            txnId = r.transactionId;
        } catch (e) {
            setBusy(false);
            if (e?.response?.status === 402) {
                const p = e.response?.data;
                Alert.alert(
                    "Not Enough Credits",
                    `You need ${p?.requiredCredits ?? cost} credit${
                        (p?.requiredCredits ?? cost) === 1 ? "" : "s"
                    } but have ${p?.credits ?? 0}.`,
                    [
                        { text: "Not now", style: "cancel" },
                        { text: "View plans", onPress: () => navigation.navigate("Paywall") },
                    ]
                );
            } else {
                Alert.alert("Could Not Start", "There was a problem reading this receipt. Please try again.");
            }
            return;
        }

        try {
            const data = await extractReceipt(imageUri, txnId);

            if (isFailedRead(data)) {
                await refundTransaction(txnId, "Failed read — no merchant or total").catch(() => {});
                setResult({ ...data, refunded: true });
                Alert.alert(
                    "Couldn't Read That Receipt",
                    "No merchant or total was found, so no credits were used. You can still fill the details in by hand, or try a clearer photo."
                );
                return;
            }

            await completeTransaction(txnId).catch(() => {});
            setResult(data);
            refreshCredits();
        } catch (err) {
            await refundTransaction(txnId, err?.message || "Extract failed").catch(() => {});
            Alert.alert("Extraction Failed", err?.userMessage || "Could not read the receipt. Your credits were not used.");
        } finally {
            setBusy(false);
        }
    }

    async function save() {
        if (!result) return;
        if (!result.merchant?.trim() && !result.total) {
            Alert.alert("Add Some Details", "Enter at least a merchant or a total before saving.");
            return;
        }

        await saveExpense({
            merchant: result.merchant?.trim() || "Unknown",
            dateUtc: result.dateUtc || new Date().toISOString(),
            total: Number(result.total) || 0,
            taxAmount: Number(result.taxAmount) || 0,
            currency: result.currency || "USD",
            category: result.category || "Other",
            notes: result.notes || "",
            imageUri,
        });

        navigation.navigate("Expenses");
    }

    // NOTE: no tier gate here on purpose. Throughout this app CREDITS are the
    // entitlement — Junk Wiper (3 credits) and OCR both reserve credits without
    // checking a subscription tier, and the backend does the same. Adding a tier
    // check here would show an upsell to a user who already holds credits.
    const low = result?.confidence === "LOW" || result?.confidence === "MEDIUM";

    return (
        <GradientScreen>
            <SafeAreaView style={styles.flex}>
                <Header navigation={navigation} onExpenses={() => navigation.navigate("Expenses")} />

                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    {/* Image */}
                    {imageUri ? (
                        <View style={styles.previewWrap}>
                            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
                        </View>
                    ) : (
                        <View style={styles.pickWrap}>
                            <AiOrb size={120} state="idle" />
                            <Text style={styles.pickTitle}>Add a receipt</Text>
                            <Text style={styles.pickSub}>We'll pull out the merchant, date, total and tax.</Text>
                        </View>
                    )}

                    <View style={styles.pickRow}>
                        <PickBtn icon="camera-outline" label="Camera" onPress={() => pick(true)} />
                        <PickBtn icon="images-outline" label="Gallery" onPress={() => pick(false)} />
                    </View>

                    {/* Extract */}
                    {imageUri && !result && (
                        <Pressable
                            onPress={runExtract}
                            disabled={busy}
                            style={[styles.primary, busy && { opacity: 0.6 }]}
                            accessibilityRole="button"
                        >
                            {busy ? (
                                <ActivityIndicator size="small" color={theme.colors.white} />
                            ) : (
                                <>
                                    <Ionicons name="scan-outline" size={17} color={theme.colors.white} />
                                    <Text style={styles.primaryText}>
                                        Extract Details · {cost} credit{cost === 1 ? "" : "s"}
                                    </Text>
                                </>
                            )}
                        </Pressable>
                    )}

                    {/* Review */}
                    {result && (
                        <View style={styles.form}>
                            <View style={styles.formHead}>
                                <Text style={styles.formTitle}>Check the details</Text>
                                {result.refunded ? (
                                    <View style={styles.refundPill}>
                                        <Text style={styles.refundText}>NO CREDITS USED</Text>
                                    </View>
                                ) : low ? (
                                    <View style={styles.lowPill}>
                                        <Text style={styles.lowText}>CHECK THESE</Text>
                                    </View>
                                ) : null}
                            </View>

                            <Field
                                label="Merchant"
                                value={result.merchant}
                                onChange={(v) => setResult((r) => ({ ...r, merchant: v }))}
                                flag={low}
                                placeholder="Where did you spend?"
                            />
                            <Field
                                label="Total"
                                value={result.total == null ? "" : String(result.total)}
                                onChange={(v) => setResult((r) => ({ ...r, total: v.replace(/[^0-9.]/g, "") }))}
                                keyboardType="decimal-pad"
                                flag={low}
                                placeholder="0.00"
                            />
                            <Field
                                label="Tax"
                                value={result.taxAmount == null ? "" : String(result.taxAmount)}
                                onChange={(v) => setResult((r) => ({ ...r, taxAmount: v.replace(/[^0-9.]/g, "") }))}
                                keyboardType="decimal-pad"
                                placeholder="0.00"
                            />
                            <Field
                                label="Date"
                                value={(result.dateUtc || "").slice(0, 10)}
                                onChange={(v) => setResult((r) => ({ ...r, dateUtc: v }))}
                                placeholder="YYYY-MM-DD"
                            />
                            <Field
                                label="Notes"
                                value={result.notes || ""}
                                onChange={(v) => setResult((r) => ({ ...r, notes: v }))}
                                placeholder="Optional"
                            />

                            <Text style={styles.fieldLabel}>Category</Text>
                            <View style={styles.chips}>
                                {CATEGORIES.map((c) => {
                                    const active = (result.category || "Other") === c;
                                    return (
                                        <Pressable
                                            key={c}
                                            onPress={() => setResult((r) => ({ ...r, category: c }))}
                                            style={[styles.chip, active && styles.chipActive]}
                                            accessibilityRole="button"
                                            accessibilityState={{ selected: active }}
                                        >
                                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>

                            <Pressable onPress={save} style={styles.primary} accessibilityRole="button">
                                <Ionicons name="checkmark" size={18} color={theme.colors.white} />
                                <Text style={styles.primaryText}>Save Expense</Text>
                            </Pressable>
                        </View>
                    )}

                    {USE_STUB && (
                        <Text style={styles.stubNote}>
                            Extraction runs in demo mode until the receipts endpoint is live —
                            fill the fields in by hand for now.
                        </Text>
                    )}
                </ScrollView>
            </SafeAreaView>
        </GradientScreen>
    );
}

function Header({ navigation, onExpenses }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    return (
        <View style={styles.header}>
            <Pressable
                onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate("Upload"))}
                hitSlop={16}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                style={{ padding: 4 }}
            >
                <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
            </Pressable>
            <View style={styles.flex1}>
                <Text style={styles.headerTitle}>Scan Receipt</Text>
                <Text style={styles.headerSub}>Merchant, date, total and tax</Text>
            </View>
            {onExpenses && (
                <Pressable onPress={onExpenses} style={styles.headerLink} accessibilityRole="button">
                    <Text style={styles.headerLinkText}>Expenses</Text>
                </Pressable>
            )}
        </View>
    );
}

function Field({ label, value, onChange, keyboardType, flag, placeholder }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    return (
        <View style={{ marginBottom: 12 }}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
                value={value ?? ""}
                onChangeText={onChange}
                keyboardType={keyboardType}
                placeholder={placeholder}
                placeholderTextColor={theme.colors.placeholder}
                keyboardAppearance={theme.keyboardAppearance}
                style={[styles.input, flag && styles.inputFlagged]}
                accessibilityLabel={label}
            />
        </View>
    );
}

function PickBtn({ icon, label, onPress }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    return (
        <Pressable onPress={onPress} style={styles.pickBtn} accessibilityRole="button" accessibilityLabel={label}>
            <Ionicons name={icon} size={18} color={theme.colors.accentText} />
            <Text style={styles.pickBtnText}>{label}</Text>
        </Pressable>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        flex: { flex: 1 },
        flex1: { flex: 1, minWidth: 0 },

        header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
        headerTitle: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 16 },
        headerSub: { color: t.colors.textMuted, fontWeight: "700", fontSize: 11.5, marginTop: 1 },
        headerLink: { paddingHorizontal: 10, paddingVertical: 6 },
        headerLinkText: { color: t.colors.accentText, fontWeight: "800", fontSize: 13 },

        scroll: { paddingHorizontal: 16, paddingBottom: 40 },

        pickWrap: { alignItems: "center", paddingVertical: 26, gap: 6 },
        pickTitle: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 17, marginTop: 8 },
        pickSub: { color: t.colors.textMuted, fontWeight: "600", fontSize: 12.5, textAlign: "center" },

        previewWrap: {
            height: 260,
            borderRadius: t.radius.lg,
            overflow: "hidden",
            backgroundColor: t.colors.glassSoft,
            borderWidth: 1,
            borderColor: t.colors.border,
            marginBottom: 14,
        },
        preview: { width: "100%", height: "100%" },

        pickRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
        pickBtn: {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            paddingVertical: 13,
            borderRadius: t.radius.lg,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.glassSoft,
        },
        pickBtnText: { color: t.colors.textSecondary, fontWeight: "800", fontSize: 13 },

        primary: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            paddingVertical: 15,
            borderRadius: t.radius.lg,
            backgroundColor: t.colors.primary,
            marginTop: 6,
        },
        primaryText: { color: t.colors.white, fontWeight: "900", fontSize: 14.5 },

        form: { marginTop: 18 },
        formHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
        formTitle: { flex: 1, color: t.colors.textPrimary, fontWeight: "900", fontSize: 15 },

        lowPill: {
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: t.colors.warningBg,
            borderWidth: 1,
            borderColor: t.colors.warningBorder,
        },
        lowText: { color: t.colors.warningText, fontWeight: "900", fontSize: 9.5, letterSpacing: 0.4 },

        refundPill: {
            paddingHorizontal: 9,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: t.colors.successBg,
            borderWidth: 1,
            borderColor: t.colors.successBorder,
        },
        refundText: { color: t.colors.successText, fontWeight: "900", fontSize: 9.5, letterSpacing: 0.4 },

        fieldLabel: { color: t.colors.textMuted, fontWeight: "800", fontSize: 11.5, marginBottom: 6 },
        input: {
            color: t.colors.textPrimary,
            backgroundColor: t.colors.inputBg,
            borderWidth: 1,
            borderColor: t.colors.inputBorder,
            borderRadius: t.radius.md,
            paddingHorizontal: 13,
            paddingVertical: 11,
            fontSize: 14.5,
            fontWeight: "600",
        },
        // Low-confidence fields are tinted so the eye goes straight to what needs checking.
        inputFlagged: { backgroundColor: t.colors.warningBg, borderColor: t.colors.warningBorder },

        chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
        chip: {
            paddingHorizontal: 13,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.glassSoft,
        },
        chipActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
        chipText: { color: t.colors.textSecondary, fontWeight: "800", fontSize: 12.5 },
        chipTextActive: { color: t.colors.white },

        stubNote: {
            color: t.colors.textMuted,
            fontWeight: "600",
            fontSize: 11.5,
            textAlign: "center",
            marginTop: 18,
            lineHeight: 16,
        },

    });
