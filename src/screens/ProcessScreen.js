import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    Alert,
    ActivityIndicator,
    StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AppButton from "../ui/AppButton";
import Card from "../ui/Card";
import GradientScreen from "../ui/GradientScreen";
import CreditConfirmModal from "../ui/CreditConfirmModal";
import { processDocumentWithTransaction } from "../api/documents";
import { getFeatureConfig, reserveCredits, completeTransaction, refundTransaction } from "../api/credits";

// document_scan_ai_ready covers the "save as AI-ready + analyze" action
const FEATURE_KEY = "document_scan_ai_ready";

export default function ProcessScreen({ route, navigation }) {
    const { docId, title } = route.params;

    const [status, setStatus] = useState("IDLE"); // IDLE | QUEUED | PROCESSING | DONE
    const [result, setResult] = useState(null);
    const [dots, setDots] = useState("");
    const [featureCfg, setFeatureCfg] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [modalLoading, setModalLoading] = useState(false);
    const [reservedTxnId, setReservedTxnId] = useState(null);

    // Load feature config from backend on mount
    useEffect(() => {
        getFeatureConfig(FEATURE_KEY)
            .then(setFeatureCfg)
            .catch(() => {
                // Fallback: allow processing with generic copy
                setFeatureCfg({
                    featureKey: FEATURE_KEY,
                    creditCost: 10,
                    userNoticeTitle: "Credits Required",
                    userNoticeMessage: "Running AI analysis on this document will use credits. Your document is processed securely.",
                    isEnabled: true,
                });
            });
    }, []);

    // Animated dots
    useEffect(() => {
        if (status !== "QUEUED" && status !== "PROCESSING") return;
        const id = setInterval(() => {
            setDots(d => (d.length >= 3 ? "" : d + "."));
        }, 350);
        return () => clearInterval(id);
    }, [status]);

    // ── Step 1: user taps "Run AI Analysis" → show credit modal ──────────────
    function handleRunAI() {
        if (!featureCfg) return;
        setShowModal(true);
    }

    // ── Step 2: user confirms in modal → reserve + process ───────────────────
    async function handleConfirmedRun() {
        setModalLoading(true);
        let txnId = null;
        try {
            // Reserve credits before processing starts
            const reservation = await reserveCredits(FEATURE_KEY, docId);
            txnId = reservation.transactionId;
            setReservedTxnId(txnId);
            setShowModal(false);
            setModalLoading(false);

            // Run AI analysis — pass transaction ID so backend skips double-charging
            setStatus("PROCESSING");
            const res = await processDocumentWithTransaction(docId, txnId);

            if (res?.status === "QUEUED" || res?.status === "PROCESSING") {
                // Background mode — credits stay reserved until worker completes
                setStatus(res.status);
                return;
            }

            // Synchronous success — complete the transaction
            await completeTransaction(txnId);
            setReservedTxnId(null);
            setResult(res);
            setStatus("DONE");
        } catch (e) {
            setModalLoading(false);
            setShowModal(false);

            // Refund reserved credits on any failure
            if (txnId) {
                await refundTransaction(txnId, e?.message || "processing_failed").catch(() => {});
                setReservedTxnId(null);
            }

            const code = e?.response?.status;
            if (code === 402) {
                const payload = e.response.data;
                Alert.alert(
                    "Not enough credits",
                    `You need ${payload.requiredCredits} credits but have ${payload.credits}.\n\nYour credits were not charged.`,
                    [
                        { text: "Cancel" },
                        { text: "Upgrade", onPress: () => navigation.navigate("Paywall") },
                    ]
                );
            } else {
                Alert.alert(
                    "Processing failed",
                    "Processing failed. Your credits were not charged or have been refunded."
                );
            }
            setStatus("IDLE");
        }
    }

    const creditCost = featureCfg?.creditCost ?? 10;
    const modalTitle = featureCfg?.userNoticeTitle ?? "Credits Required";
    const modalMessage = featureCfg?.userNoticeMessage ?? "";

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <Text style={styles.title}>{title}</Text>

                    <Card>
                        <Text style={styles.cardTitle}>AI Analysis</Text>

                        {status === "IDLE" && (
                            <View style={styles.idleBox}>
                                <Ionicons name="sparkles-outline" size={22} color="#A5B4FC" />
                                <Text style={styles.idleText}>
                                    Ready to analyze your document using AI.
                                </Text>
                                <View style={styles.costRow}>
                                    <Ionicons name="flash-outline" size={13} color="#FBBF24" />
                                    <Text style={styles.costText}>
                                        {creditCost} credits will be used
                                    </Text>
                                </View>
                            </View>
                        )}

                        {(status === "QUEUED" || status === "PROCESSING") && (
                            <View style={styles.loadingBox}>
                                <ActivityIndicator size="large" color="#A5B4FC" />
                                <Text style={styles.loadingText}>
                                    {status === "QUEUED"
                                        ? `⏳ Waiting in queue${dots}`
                                        : `🤖 AI is analyzing your document${dots}`}
                                </Text>
                                {status === "QUEUED" && (
                                    <Text style={styles.helper}>
                                        You can leave this screen. We'll notify you when it's ready.
                                    </Text>
                                )}
                            </View>
                        )}

                        {status === "DONE" && (
                            <Text style={styles.doneText}>✅ Analysis complete</Text>
                        )}
                    </Card>

                    {status === "DONE" ? (
                        <AppButton
                            title="View AI Result"
                            onPress={() => navigation.navigate("Analysis", { docId, title })}
                        />
                    ) : (
                        <AppButton
                            title={
                                status === "QUEUED" ? "Queued…"
                                : status === "PROCESSING" ? "Analyzing…"
                                : "Run AI Analysis"
                            }
                            onPress={handleRunAI}
                            disabled={status === "QUEUED" || status === "PROCESSING" || !featureCfg}
                        />
                    )}

                    {result && (
                        <Card>
                            <Text style={styles.cardTitle}>Usage</Text>
                            <Text style={styles.usage}>Credits used: {result.creditsUsed ?? creditCost}</Text>
                            <Text style={styles.usage}>Credits left: {result.creditsLeft ?? "—"}</Text>
                        </Card>
                    )}
                </View>
            </SafeAreaView>

            <CreditConfirmModal
                visible={showModal}
                title={modalTitle}
                message={modalMessage}
                creditCost={creditCost}
                confirmText={`Analyze and Use ${creditCost} Credits`}
                loading={modalLoading}
                onConfirm={handleConfirmedRun}
                onCancel={() => { setShowModal(false); setModalLoading(false); }}
            />
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 18, gap: 14 },
    title: { color: "#fff", fontSize: 22, fontWeight: "900" },
    cardTitle: { fontWeight: "900", color: "#A5B4FC", marginBottom: 8 },
    idleBox: { alignItems: "flex-start", gap: 8 },
    idleText: { color: "rgba(255,255,255,0.75)", fontWeight: "700" },
    costRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    costText: { color: "#FBBF24", fontWeight: "800", fontSize: 13 },
    loadingBox: { marginTop: 8, alignItems: "center", gap: 12 },
    loadingText: { color: "#E0E7FF", fontWeight: "800", textAlign: "center" },
    helper: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "600", textAlign: "center" },
    doneText: { marginTop: 8, color: "#22C55E", fontWeight: "800" },
    usage: { marginTop: 4, color: "rgba(255,255,255,0.65)", fontWeight: "700" },
});
