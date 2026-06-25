import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Animated,
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
import { API } from "../constants/api";

const FK = {
    OCR: "image_ocr_extract_text",
    SUMMARIZE: "summarize_text",
    EXPLAIN: "explain_text_detail",
    SCAN_AI: "document_scan_ai_ready",
};

export default function UploadScreen({ navigation }) {
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
        const token = await SecureStore.getItemAsync("accessToken");
        if (!token) throw new Error("Authentication required. Please log in again.");
        const form = new FormData();
        form.append("file", { uri, name: name || "upload", type: mimeType || "application/octet-stream" });
        const res = await fetch(`${API.BASE_URL}/api/documents/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
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
            const token = await SecureStore.getItemAsync("accessToken");
            const res = await fetch(`${API.BASE_URL}/api/documents/${uploaded.id}/ocr`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
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
            if (e?.response?.status === 402 || e?.message?.includes("402")) {
                Alert.alert("Not enough credits", `You need ${cfg.creditCost} credits for OCR. Please top up.`);
            } else {
                Alert.alert("OCR failed", e.message || "Processing failed. Your credits were not charged or have been refunded.");
            }
        } finally {
            setOcrRunning(false);
        }
    }

    function requestAiAction(featureKey, label) {
        if (!ocrText) return;
        showCreditModal({
            featureKey,
            onConfirm: () => {
                closeModal();
                Alert.alert(label, "AI action coming soon.");
            },
        });
    }

    function openJunkWiper() {
        navigation.navigate("JunkWiper");
    }

    function openCameraScanner() {
        navigation.navigate("CameraScanner");
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
                            <Ionicons name="flash" size={14} color="#FBBF24" />
                            <Text style={styles.creditText}>{credits === null ? "…" : `${credits} credits`}</Text>
                        </Pressable>
                    </View>

                    {/* 1. Upload Document (PDF) */}
                    <SectionCard
                        icon="document-text-outline"
                        title="Upload Document"
                        subtitle="Select a PDF — AI will extract text and analyse it"
                        onPress={pickDocument}
                        disabled={busy}
                        actionLabel={busy ? "Uploading…" : "Select PDF"}
                        actionIcon="cloud-upload-outline"
                    />

                    {/* 2. Extract Text from Image (OCR) */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.cardIcon, { backgroundColor: "rgba(251,191,36,0.12)" }]}>
                                <Ionicons name="scan-outline" size={20} color="#FBBF24" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>Extract Text from Image</Text>
                                <Text style={styles.cardSubtitle}>Select a photo — Paper AI reads the text inside it</Text>
                            </View>
                            <CreditBadge cost={configFor(FK.OCR).creditCost} />
                        </View>

                        {ocrImage && (
                            <View style={styles.ocrPreviewRow}>
                                <Ionicons name="image" size={16} color="#A5B4FC" />
                                <Text style={styles.ocrFileName} numberOfLines={1}>{ocrImage.name}</Text>
                                <Pressable onPress={() => { setOcrImage(null); setOcrText(null); }} hitSlop={10}>
                                    <Ionicons name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
                                </Pressable>
                            </View>
                        )}

                        <View style={styles.cardActions}>
                            <ActionBtn
                                icon="images-outline"
                                label={ocrImage ? "Change Image" : "Select Image"}
                                onPress={pickImageForOCR}
                                color="#A5B4FC"
                            />
                            {ocrImage && !ocrText && (
                                <ActionBtn
                                    icon="text-outline"
                                    label={ocrRunning ? "Extracting…" : "Extract Text"}
                                    onPress={requestOCR}
                                    color="#FBBF24"
                                    disabled={ocrRunning}
                                />
                            )}
                        </View>

                        {ocrRunning && (
                            <View style={styles.ocrLoading}>
                                <ActivityIndicator size="small" color="#FBBF24" />
                                <Text style={styles.ocrLoadingText}>Extracting text…</Text>
                            </View>
                        )}

                        {ocrText && (
                            <View style={styles.ocrResultBox}>
                                <Text style={styles.ocrResultLabel}>Extracted Text</Text>
                                <Text style={styles.ocrResultText} numberOfLines={6}>{ocrText}</Text>
                                <View style={styles.aiActionsRow}>
                                    <AiActionBtn icon="sparkles-outline" label="Summarize"
                                        onPress={() => requestAiAction(FK.SUMMARIZE, "Summarize")}
                                        cost={configFor(FK.SUMMARIZE).creditCost} />
                                    <AiActionBtn icon="bulb-outline" label="Explain"
                                        onPress={() => requestAiAction(FK.EXPLAIN, "Explain in Detail")}
                                        cost={configFor(FK.EXPLAIN).creditCost} />
                                    <AiActionBtn icon="chatbubble-ellipses-outline" label="Ask AI"
                                        onPress={() => Alert.alert("Ask AI", "Coming soon.")} cost={0} />
                                    <AiActionBtn icon="book-outline" label="Study Notes"
                                        onPress={() => Alert.alert("Study Notes", "Coming soon.")} cost={0} />
                                </View>
                            </View>
                        )}
                    </View>

                    {/* 3. Junk Wiper */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.cardIcon, { backgroundColor: "rgba(239,68,68,0.12)" }]}>
                                <Ionicons name="trash-bin-outline" size={20} color="#F87171" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>Junk Wiper</Text>
                                <Text style={styles.cardSubtitle}>Smart Duplicate Cleaner — scan your permitted photos</Text>
                            </View>
                            <CreditBadge cost={configFor("junk_wiper_scan_report").creditCost} />
                        </View>
                        <View style={styles.safetyNote}>
                            <Ionicons name="shield-checkmark-outline" size={13} color="#34D399" />
                            <Text style={styles.safetyText}>Nothing is deleted without your review and confirmation.</Text>
                        </View>
                        <ActionBtn icon="search-outline" label="Start Duplicate Scan"
                            onPress={openJunkWiper} color="#F87171" full />
                    </View>

                    {/* 4. Camera Document Scanner (last — in progress) */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.cardIcon, { backgroundColor: "rgba(52,211,153,0.12)" }]}>
                                <Ionicons name="camera-outline" size={20} color="#34D399" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.cardTitle}>Scan Document</Text>
                                <Text style={styles.cardSubtitle}>
                                    Use camera to capture a document — AI will analyse it
                                    {configFor(FK.SCAN_AI).creditCost > 0
                                        ? ` · ${configFor(FK.SCAN_AI).creditCost} credits on analysis`
                                        : ""}
                                </Text>
                            </View>
                        </View>
                        <ActionBtn icon="camera-outline" label="Open Camera Scanner"
                            onPress={openCameraScanner} color="#34D399" full />
                    </View>

                    <Pressable
                        style={({ pressed }) => [styles.upgradeBanner, pressed && { opacity: 0.8 }]}
                        onPress={() => navigation.navigate("Paywall")}
                    >
                        <Ionicons name="sparkles-outline" size={16} color="#FBCFE8" />
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

function SectionCard({ icon, title, subtitle, onPress, disabled, actionLabel, actionIcon, accentColor = "#A5B4FC" }) {
    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: `${accentColor}18` }]}>
                    <Ionicons name={icon} size={20} color={accentColor} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text style={styles.cardSubtitle}>{subtitle}</Text>
                </View>
            </View>
            <ActionBtn icon={actionIcon} label={actionLabel} onPress={onPress}
                disabled={disabled} color={accentColor} full />
        </View>
    );
}

function ActionBtn({ icon, label, onPress, disabled, color = "#A5B4FC", full }) {
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.actionBtn,
                full && { alignSelf: "stretch" },
                pressed && !disabled && { opacity: 0.75 },
                disabled && { opacity: 0.45 },
                { borderColor: `${color}55` },
            ]}
        >
            <Ionicons name={icon} size={16} color={color} />
            <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
        </Pressable>
    );
}

function AiActionBtn({ icon, label, onPress, cost }) {
    return (
        <Pressable onPress={onPress}
            style={({ pressed }) => [styles.aiBtn, pressed && { opacity: 0.75 }]}>
            <Ionicons name={icon} size={15} color="#A5B4FC" />
            <Text style={styles.aiBtnLabel}>{label}</Text>
            {cost > 0 && <Text style={styles.aiBtnCost}>{cost}cr</Text>}
        </Pressable>
    );
}

function CreditBadge({ cost }) {
    if (!cost) return null;
    return (
        <View style={styles.creditBadgeSmall}>
            <Ionicons name="flash" size={11} color="#FBBF24" />
            <Text style={styles.creditBadgeSmallText}>{cost}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16, gap: 14, paddingBottom: 40 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
    hTitle: { color: "#fff", fontSize: 26, fontWeight: "900" },
    creditBadge: {
        flexDirection: "row", alignItems: "center", gap: 5,
        backgroundColor: "rgba(251,191,36,0.12)",
        borderWidth: 1, borderColor: "rgba(251,191,36,0.25)",
        paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999,
    },
    creditText: { color: "#FBBF24", fontWeight: "800", fontSize: 13 },
    card: {
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
        borderRadius: 20, padding: 14, gap: 12,
    },
    cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    cardIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center" },
    cardTitle: { color: "#fff", fontWeight: "900", fontSize: 15 },
    cardSubtitle: { color: "rgba(255,255,255,0.60)", fontWeight: "700", fontSize: 12, marginTop: 3, lineHeight: 16 },
    cardActions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
    actionBtn: {
        flexDirection: "row", alignItems: "center", gap: 7,
        backgroundColor: "rgba(255,255,255,0.06)",
        borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
        alignSelf: "flex-start",
    },
    actionBtnText: { fontWeight: "800", fontSize: 13 },
    ocrPreviewRow: {
        flexDirection: "row", alignItems: "center", gap: 8,
        backgroundColor: "rgba(165,180,252,0.08)", borderRadius: 10, padding: 8,
    },
    ocrFileName: { flex: 1, color: "#A5B4FC", fontWeight: "700", fontSize: 13 },
    ocrLoading: { flexDirection: "row", alignItems: "center", gap: 8 },
    ocrLoadingText: { color: "#FBBF24", fontWeight: "700", fontSize: 13 },
    ocrResultBox: { backgroundColor: "rgba(0,0,0,0.22)", borderRadius: 14, padding: 12, gap: 10 },
    ocrResultLabel: { color: "#A5B4FC", fontWeight: "900", fontSize: 13 },
    ocrResultText: { color: "rgba(255,255,255,0.80)", fontWeight: "700", fontSize: 13, lineHeight: 19 },
    aiActionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    aiBtn: {
        flexDirection: "row", alignItems: "center", gap: 5,
        backgroundColor: "rgba(99,102,241,0.15)",
        borderWidth: 1, borderColor: "rgba(165,180,252,0.25)",
        borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7,
    },
    aiBtnLabel: { color: "#A5B4FC", fontWeight: "800", fontSize: 12 },
    aiBtnCost: { color: "#FBBF24", fontWeight: "800", fontSize: 11 },
    safetyNote: {
        flexDirection: "row", alignItems: "center", gap: 6,
        backgroundColor: "rgba(52,211,153,0.07)", borderRadius: 10, padding: 8,
    },
    safetyText: { flex: 1, color: "rgba(255,255,255,0.60)", fontWeight: "700", fontSize: 12 },
    creditBadgeSmall: {
        flexDirection: "row", alignItems: "center", gap: 2,
        backgroundColor: "rgba(251,191,36,0.12)", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
    },
    creditBadgeSmallText: { color: "#FBBF24", fontWeight: "900", fontSize: 11 },
    upgradeBanner: {
        flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        backgroundColor: "rgba(251,207,232,0.06)",
        borderWidth: 1, borderColor: "rgba(251,207,232,0.15)",
        borderRadius: 16, paddingVertical: 13,
    },
    upgradeText: { color: "#FBCFE8", fontWeight: "900" },
});
