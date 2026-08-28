import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
    Clipboard,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as SecureStore from "expo-secure-store";

import GradientScreen from "../ui/GradientScreen";
import CreditConfirmModal from "../ui/CreditConfirmModal";
import { getCreditsBalance, getFeatureConfigs, reserveCredits, completeTransaction, refundTransaction } from "../api/credits";
import { authedFetch } from "../api/client";
import { API } from "../constants/api";

import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";
import { showEntitlementDenial } from "../ui/FeatureLock";
const FK = {
    OCR: "image_ocr_extract_text",
    SUMMARIZE: "summarize_text",
    EXPLAIN: "explain_text_detail",
    SCAN_AI: "document_scan_ai_ready",
};

export default function UploadScreen({ navigation }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const [credits, setCredits] = useState(null);
    const [featureConfigs, setFeatureConfigs] = useState({});
    const [busy, setBusy] = useState(false);

    const [ocrImage, setOcrImage] = useState(null);
    const [ocrText, setOcrText] = useState(null);
    const [ocrRunning, setOcrRunning] = useState(false);

    const [modal, setModal] = useState({
        visible: false, featureKey: null, title: "", message: "",
        creditCost: 0, confirmText: null, loading: false, onConfirm: null,
    });

    const lift = useRef(new Animated.Value(0)).current;

    const refreshCredits = useCallback(async () => {
        try { const r = await getCreditsBalance(); setCredits(r.credits); } catch { }
    }, []);

    const loadFeatureConfigs = useCallback(async () => {
        try {
            const arr = await getFeatureConfigs();
            const map = {};
            arr.forEach(c => { map[c.featureKey] = c; });
            setFeatureConfigs(map);
        } catch { }
    }, []);

    useEffect(() => {
        const unsub = navigation.addListener("focus", () => {
            refreshCredits();
            loadFeatureConfigs();
        });
        refreshCredits();
        loadFeatureConfigs();
        return unsub;
    }, [navigation, refreshCredits, loadFeatureConfigs]);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(lift, { toValue: -4, duration: 1400, useNativeDriver: true }),
                Animated.timing(lift, { toValue: 0, duration: 1400, useNativeDriver: true }),
            ])
        ).start();
    }, [lift]);

    function configFor(key) {
        return featureConfigs[key] ?? { creditCost: 0, userNoticeTitle: "Credits Required", userNoticeMessage: "", isEnabled: true };
    }

    function showCreditModal({ featureKey, onConfirm, extraMessage }) {
        const cfg = configFor(featureKey);
        setModal({
            visible: true, featureKey,
            title: cfg.userNoticeTitle || "Credits Required",
            message: extraMessage ?? cfg.userNoticeMessage ?? "",
            creditCost: cfg.creditCost,
            confirmText: null, loading: false, onConfirm,
        });
    }

    function closeModal() {
        setModal(m => ({ ...m, visible: false, loading: false }));
    }

    // ── Upload helper (shared by PDF, image, camera) ─────────────────────────
    async function uploadFile(uri, name, mimeType) {
        const form = new FormData();
        form.append("file", { uri, name: name || "upload", type: mimeType || "application/octet-stream" });
        const res = await authedFetch(`/api/documents/upload`, {
            method: "POST",
            body: form,
        });
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch { data = {}; }
        if (!res.ok) throw new Error(data?.message || `Upload failed (${res.status})`);
        return data;
    }

    // ── Upload PDF / document ────────────────────────────────────────────────
    async function pickDocument() {
        if (busy) return;
        const picked = await DocumentPicker.getDocumentAsync({
            copyToCacheDirectory: true,
            multiple: false,
            type: ["application/pdf", "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        });
        if (picked.canceled) return;
        const file = picked.assets[0];
        try {
            setBusy(true);
            const data = await uploadFile(file.uri, file.name, file.mimeType || "application/pdf");
            navigation.navigate("Process", { docId: data.id, title: data.title });
        } catch (err) {
            Alert.alert("Upload failed", err.message);
        } finally {
            setBusy(false);
            refreshCredits();
        }
    }

    // ── Pick image for OCR (free — credits charged on Extract) ──────────────
    async function pickImageForOCR() {
        if (busy) return;
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            Alert.alert("Permission required", "Please allow photo library access in Settings to select images.");
            return;
        }
        const picked = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.9,
            allowsEditing: false,
        });
        if (picked.canceled) return;
        const asset = picked.assets[0];
        const ext = (asset.uri.split(".").pop() || "jpg").toLowerCase();
        setOcrImage({
            uri: asset.uri,
            name: asset.fileName || `photo.${ext}`,
            mimeType: asset.mimeType || `image/${ext}`,
        });
        setOcrText(null);
    }

    function requestOCR() {
        if (!ocrImage) return;
        showCreditModal({ featureKey: FK.OCR, onConfirm: runOCR });
    }

    async function runOCR() {
        closeModal();
        const cfg = configFor(FK.OCR);
        let txnId = null;
        try {
            setOcrRunning(true);
            // 1. Upload image (free)
            const uploaded = await uploadFile(ocrImage.uri, ocrImage.name, ocrImage.mimeType);
            // 2. Reserve credits
            const reservation = await reserveCredits(FK.OCR, uploaded.id);
            txnId = reservation.transactionId;
            // 3. Call OCR-only endpoint (no full AI analysis)
            const res = await authedFetch(`/api/documents/${uploaded.id}/ocr`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Transaction-Id": txnId,
                },
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err?.message || `OCR failed (${res.status})`);
            }
            const data = await res.json();
            await completeTransaction(txnId);
            txnId = null;
            setOcrText(data.extractedText || "No text could be extracted from this image.");
            refreshCredits();
        } catch (e) {
            if (txnId) await refundTransaction(txnId, e.message).catch(() => {});
            if (showEntitlementDenial(e, navigation, "image_ocr")) return;

            if (e?.response?.status === 402 || e?.message?.includes("402")) {
                Alert.alert(
                    "Not enough credits",
                    `You need ${cfg.creditCost} credits for OCR. Choose a plan to get more credits.`,
                    [
                        { text: "Not now", style: "cancel" },
                        { text: "View plans", onPress: () => navigation.navigate("Paywall") },
                    ]
                );
            } else {
                Alert.alert("OCR failed", e.message || "Processing failed. Your credits were not charged or have been refunded.");
            }
        } finally {
            setOcrRunning(false);
        }
    }

    function requestAiAction(label) {
        Alert.alert(label, "This AI action is coming soon. Stay tuned!");
    }

    function copyOcrText() {
        if (!ocrText) return;
        Clipboard.setString(ocrText);
        Alert.alert("Copied", "Extracted text copied to clipboard.");
    }

    function openJunkWiper() {
        navigation.navigate("JunkWiper");
    }

    function openCameraScanner() {
        navigation.navigate("CameraScanner");
    }

    function openCodeScanner() {
        navigation.navigate("CodeScanner");
    }

    function openSignature() {
        navigation.navigate("Signature");
    }

    function openReceipts() {
        navigation.navigate("ReceiptCapture");
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView
                    contentContainerStyle={styles.container}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.hTitle}>Upload</Text>
                        <Pressable style={styles.creditBadge} onPress={() => navigation.navigate("Paywall")}>
                            <Ionicons name="flash" size={14} color={theme.colors.warning} />
                            <Text style={styles.creditText}>{credits === null ? "…" : `${credits} credits`}</Text>
                        </Pressable>
                    </View>

                    {/* Free, on-device tools first — nothing here costs a credit. */}

                    {/* ── FREE TOOLS ── */}
                    <View style={styles.sectionDivider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.sectionLabel}>FREE TOOLS</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* 1. Scan Document — FREE (scan + save/PDF; AI optional) */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.cardIcon, { backgroundColor: theme.colors.infoBg }]}>
                                <Ionicons name="camera-outline" size={20} color={theme.colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>Scan Document</Text>
                                <Text style={styles.cardSubtitle}>
                                    Capture pages with your camera, then save to Photos or export as PDF
                                </Text>
                            </View>
                            <FreeBadge />
                        </View>
                        <ActionBtn icon="camera-outline" label="Open Document Scanner"
                            onPress={openCameraScanner} color={theme.colors.primary} full />
                    </View>


                    {/* 2. Scan QR & Codes — FREE general utility */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.cardIcon, { backgroundColor: theme.colors.infoBg }]}>
                                <Ionicons name="qr-code-outline" size={20} color={theme.colors.accentText} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>Scan QR &amp; Codes</Text>
                                <Text style={styles.cardSubtitle}>
                                    Read QR codes and barcodes — view, copy, and open links instantly
                                </Text>
                            </View>
                            <FreeBadge />
                        </View>
                        <ActionBtn icon="scan-outline" label="Open Code Scanner"
                            onPress={openCodeScanner} color={theme.colors.accentText} full />
                    </View>


                    {/* 3. Sign & Fill — FREE, fully on-device */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.cardIcon, { backgroundColor: theme.colors.successBg }]}>
                                <Ionicons name="create-outline" size={20} color={theme.colors.successText} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>Sign &amp; Fill</Text>
                                <Text style={styles.cardSubtitle}>
                                    Draw your signature, place it on a page, add text and export a PDF
                                </Text>
                            </View>
                            <FreeBadge />
                        </View>
                        <ActionBtn icon="create-outline" label="Sign a Document"
                            onPress={openSignature} color={theme.colors.successText} full />
                    </View>


                    {/* ── AI FEATURES ── */}
                    <View style={styles.sectionDivider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.sectionLabel}>AI FEATURES</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* Everything below spends credits. */}

                    {/* Scan Receipt — 1 credit per successful extraction */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.cardIcon, { backgroundColor: theme.colors.warningBg }]}>
                                <Ionicons name="receipt-outline" size={20} color={theme.colors.warningText} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>Scan Receipt</Text>
                                <Text style={styles.cardSubtitle}>
                                    Pull out merchant, date, total and tax — then export the month as CSV
                                </Text>
                            </View>
                            {/* configFor falls back to 0 when the backend has no row for this key
                                yet, which would read as "free" — default to the real 1-credit cost. */}
                            <CreditBadge cost={configFor("receipt_extract").creditCost || 1} />
                        </View>
                        <ActionBtn icon="receipt-outline" label="Scan a Receipt"
                            onPress={openReceipts} color={theme.colors.warningText} full />
                    </View>


                    {/* 3. Upload Document (PDF) — costs credits */}
                    <SectionCard
                        icon="document-text-outline"
                        title="Upload Document"
                        subtitle="Select a PDF — AI will extract text and analyse it"
                        onPress={pickDocument}
                        disabled={busy}
                        actionLabel={busy ? "Uploading…" : "Select PDF"}
                        actionIcon="cloud-upload-outline"
                    />


                    {/* 4. Extract Text from Image (OCR) — costs credits */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.cardIcon, { backgroundColor: theme.colors.warningBg }]}>
                                <Ionicons name="scan-outline" size={20} color={theme.colors.warning} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>Extract Text from Image</Text>
                                <Text style={styles.cardSubtitle}>Select a photo — Paper AI reads the text inside it</Text>
                            </View>
                            <CreditBadge cost={configFor(FK.OCR).creditCost} />
                        </View>

                        {ocrImage && (
                            <View style={styles.ocrPreviewRow}>
                                <Ionicons name="image" size={16} color={theme.colors.accentText} />
                                <Text style={styles.ocrFileName} numberOfLines={1}>{ocrImage.name}</Text>
                                <Pressable onPress={() => { setOcrImage(null); setOcrText(null); }} hitSlop={10}>
                                    <Ionicons name="close-circle" size={18} color={theme.colors.placeholder} />
                                </Pressable>
                            </View>
                        )}

                        <View style={styles.cardActions}>
                            <ActionBtn
                                icon="images-outline"
                                label={ocrImage ? "Change Image" : "Select Image"}
                                onPress={pickImageForOCR}
                                color={theme.colors.accentText}
                            />
                            {ocrImage && !ocrText && (
                                <ActionBtn
                                    icon="text-outline"
                                    label={ocrRunning ? "Extracting…" : "Extract Text"}
                                    onPress={requestOCR}
                                    color={theme.colors.warning}
                                    disabled={ocrRunning}
                                />
                            )}
                        </View>

                        {ocrRunning && (
                            <View style={styles.ocrLoading}>
                                <ActivityIndicator size="small" color={theme.colors.warning} />
                                <Text style={styles.ocrLoadingText}>Extracting text…</Text>
                            </View>
                        )}

                        {ocrText && (
                            <View style={styles.ocrResultBox}>
                                <View style={styles.ocrResultHeader}>
                                    <Text style={styles.ocrResultLabel}>Extracted Text</Text>
                                    <Pressable
                                        onPress={copyOcrText}
                                        hitSlop={10}
                                        style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.65 }]}
                                    >
                                        <Ionicons name="copy-outline" size={16} color={theme.colors.accentText} />
                                        <Text style={styles.copyBtnText}>Copy</Text>
                                    </Pressable>
                                </View>
                                <ScrollView
                                    style={styles.ocrScrollArea}
                                    nestedScrollEnabled
                                    showsVerticalScrollIndicator
                                >
                                    <Text style={styles.ocrResultText}>{ocrText}</Text>
                                </ScrollView>
                                {/* Summarize / Explain / Ask AI are hidden until their
                                    backend endpoints ship. They rendered a "soon" badge and
                                    answered with a "coming soon" alert, which is a guideline
                                    2.1 rejection (App Completeness — no placeholder features).
                                    Re-enable this block once the actions actually run.
                                <View style={styles.aiActionsRow}>
                                    <AiActionBtn icon="sparkles-outline" label="Summarize"
                                        onPress={() => requestAiAction("Summarize")} />
                                    <AiActionBtn icon="bulb-outline" label="Explain"
                                        onPress={() => requestAiAction("Explain in Detail")} />
                                    <AiActionBtn icon="chatbubble-ellipses-outline" label="Ask AI"
                                        onPress={() => requestAiAction("Ask AI")} />
                                </View> */}
                            </View>
                        )}
                    </View>

                    {/* ── Advanced ── */}
                    <View style={styles.sectionDivider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.sectionLabel}>ADVANCED</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    {/* 5. Junk Wiper — advanced, credit-based */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.cardIcon, { backgroundColor: theme.colors.dangerBg }]}>
                                <Ionicons name="trash-bin-outline" size={20} color={theme.colors.danger} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>Junk Wiper</Text>
                                <Text style={styles.cardSubtitle}>Smart Duplicate Cleaner — scan your permitted photos</Text>
                            </View>
                            <CreditBadge cost={configFor("junk_wiper_scan_report").creditCost} />
                        </View>
                        <View style={styles.safetyNote}>
                            <Ionicons name="shield-checkmark-outline" size={13} color={theme.colors.primary} />
                            <Text style={styles.safetyText}>Nothing is deleted without your review and confirmation.</Text>
                        </View>
                        <ActionBtn icon="search-outline" label="Start Duplicate Scan"
                            onPress={openJunkWiper} color={theme.colors.danger} full />
                    </View>

                    <Pressable
                        style={({ pressed }) => [styles.upgradeBanner, pressed && { opacity: 0.8 }]}
                        onPress={() => navigation.navigate("Paywall")}
                    >
                        <Ionicons name="sparkles-outline" size={16} color={theme.colors.accentText} />
                        <Text style={styles.upgradeText}>Need more credits? Upgrade your plan →</Text>
                    </Pressable>
                </ScrollView>
            </SafeAreaView>

            <CreditConfirmModal
                visible={modal.visible}
                title={modal.title}
                message={modal.message}
                creditCost={modal.creditCost}
                confirmText={modal.confirmText}
                loading={modal.loading}
                onConfirm={modal.onConfirm}
                onCancel={closeModal}
            />
        </GradientScreen>
    );
}

function SectionCard({ icon, title, subtitle, onPress, disabled, actionLabel, actionIcon, accentColor }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    // Default from the theme rather than a literal so the accent follows the
    // active appearance when a caller doesn't override it.
    const accent = accentColor ?? theme.colors.accentText;
    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: `${accent}18` }]}>
                    <Ionicons name={icon} size={20} color={accent} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardSubtitle}>{subtitle}</Text>
                </View>
            </View>
            <ActionBtn icon={actionIcon} label={actionLabel} onPress={onPress}
                disabled={disabled} color={accent} full />
        </View>
    );
}

function ActionBtn({ icon, label, onPress, disabled, color, full }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const tint = color ?? theme.colors.accentText;
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.actionBtn,
                full && { alignSelf: "stretch" },
                pressed && !disabled && { opacity: 0.75 },
                disabled && { opacity: 0.45 },
                { borderColor: `${tint}55` },
            ]}
        >
            <Ionicons name={icon} size={16} color={tint} />
            <Text style={[styles.actionBtnText, { color: tint }]}>{label}</Text>
        </Pressable>
    );
}

function AiActionBtn({ icon, label, onPress }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    return (
        <Pressable onPress={onPress}
            style={({ pressed }) => [styles.aiBtn, pressed && { opacity: 0.75 }]}>
            <Ionicons name={icon} size={15} color={theme.colors.accentText} />
            <Text style={styles.aiBtnLabel}>{label}</Text>
            <Text style={styles.aiBtnSoon}>soon</Text>
        </Pressable>
    );
}

function CreditBadge({ cost }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    if (!cost) return null;
    return (
        <View style={styles.creditBadgeSmall}>
            <Ionicons name="flash" size={11} color={theme.colors.warning} />
            <Text style={styles.creditBadgeSmallText}>{cost}</Text>
        </View>
    );
}

function FreeBadge() {
    const styles = useThemedStyles(makeStyles);
    return (
        <View style={styles.freeBadge}>
            <Text style={styles.freeBadgeText}>FREE</Text>
        </View>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
    container: { padding: 16, gap: 14, paddingBottom: 40 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
    hTitle: { color: t.colors.textPrimary, fontSize: 26, fontWeight: "800" },
    creditBadge: {
        flexDirection: "row", alignItems: "center", gap: 5,
        backgroundColor: t.colors.accentBg,
        borderWidth: 1, borderColor: t.colors.warningBorder,
        paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
    },
    creditText: { color: t.colors.warningText, fontWeight: "700", fontSize: 13 },
    card: {
        backgroundColor: t.colors.glass,
        borderWidth: 1, borderColor: t.colors.glassBorder,
        borderRadius: 20, padding: 14, gap: 12,
        shadowColor: t.colors.primary, shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1, shadowRadius: 18, elevation: 4,
    },
    cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    cardIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    cardTitle: { color: t.colors.textPrimary, fontWeight: "700", fontSize: 15 },
    cardSubtitle: { color: t.colors.textMuted, fontWeight: "500", fontSize: 12, marginTop: 3, lineHeight: 16 },
    cardActions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    actionBtn: {
        flexDirection: "row", alignItems: "center", gap: 7,
        backgroundColor: t.colors.glassButton,
        borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
        minHeight: 44,
        alignSelf: "flex-start",
    },
    actionBtnText: { fontWeight: "700", fontSize: 13 },
    ocrPreviewRow: {
        flexDirection: "row", alignItems: "center", gap: 8,
        backgroundColor: t.colors.infoBg, borderRadius: 10, padding: 8,
    },
    ocrFileName: { flex: 1, color: t.colors.accentText, fontWeight: "700", fontSize: 13 },
    ocrLoading: { flexDirection: "row", alignItems: "center", gap: 8 },
    ocrLoadingText: { color: t.colors.warningText, fontWeight: "700", fontSize: 13 },
    ocrResultBox: { backgroundColor: t.colors.glassButton, borderWidth: 1, borderColor: t.colors.border, borderRadius: 14, padding: 12, gap: 10 },
    ocrResultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    ocrResultLabel: { color: t.colors.accentText, fontWeight: "800", fontSize: 13 },
    copyBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5,
        backgroundColor: t.colors.infoBg, borderRadius: 8,
        borderWidth: 1, borderColor: t.colors.infoBorder },
    copyBtnText: { color: t.colors.accentText, fontWeight: "700", fontSize: 12 },
    ocrScrollArea: { maxHeight: 240, backgroundColor: t.colors.glassSoft, borderWidth: 1, borderColor: t.colors.border, borderRadius: 10, padding: 10 },
    ocrResultText: { color: t.colors.textSecondary, fontWeight: "500", fontSize: 13, lineHeight: 20 },
    aiActionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    aiBtn: {
        flexDirection: "row", alignItems: "center", gap: 5,
        backgroundColor: t.colors.infoBg,
        borderWidth: 1, borderColor: t.colors.infoBorder,
        borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
    },
    aiBtnLabel: { color: t.colors.accentText, fontWeight: "700", fontSize: 12 },
    aiBtnSoon: { color: t.colors.textMuted, fontWeight: "600", fontSize: 10, fontStyle: "italic" },
    safetyNote: {
        flexDirection: "row", alignItems: "center", gap: 6,
        backgroundColor: t.colors.infoBg, borderRadius: 10, padding: 8,
    },
    safetyText: { flex: 1, color: t.colors.textMuted, fontWeight: "600", fontSize: 12 },
    creditBadgeSmall: {
        flexDirection: "row", alignItems: "center", gap: 2,
        backgroundColor: t.colors.accentBg, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
    },
    creditBadgeSmallText: { color: t.colors.warningText, fontWeight: "800", fontSize: 11 },
    freeBadge: {
        backgroundColor: t.colors.infoBg, borderWidth: 1, borderColor: t.colors.infoBorder,
        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
    },
    freeBadgeText: { color: t.colors.accentText, fontWeight: "800", fontSize: 11, letterSpacing: 0.5 },
    sectionDivider: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6, marginBottom: 2 },
    dividerLine: { flex: 1, height: 1, backgroundColor: t.colors.separator },
    sectionLabel: { color: t.colors.textMuted, fontWeight: "700", fontSize: 11, letterSpacing: 1.5 },
    upgradeBanner: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        backgroundColor: t.colors.infoBg,
        borderWidth: 1, borderColor: t.colors.infoBorder,
        borderRadius: 16, paddingVertical: 14,
    },
    upgradeText: { color: t.colors.accentText, fontWeight: "700" },
});
