import React, { useState, useEffect } from "react";
import {
    View,
    Text,
    Alert,
    ActivityIndicator,
    StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppButton from "../ui/AppButton";
import Card from "../ui/Card";
import GradientScreen from "../ui/GradientScreen";
import { processDocument } from "../api/documents";

export default function ProcessScreen({ route, navigation }) {
    const { docId, title } = route.params;

    const [status, setStatus] = useState("IDLE"); // IDLE | QUEUED | PROCESSING | DONE
    const [result, setResult] = useState(null);
    const [dots, setDots] = useState("");

    // Animated dots for queued / processing
    useEffect(() => {
        if (status !== "QUEUED" && status !== "PROCESSING") return;
        const id = setInterval(() => {
            setDots((d) => (d.length >= 3 ? "" : d + "."));
        }, 350);
        return () => clearInterval(id);
    }, [status]);

    async function runAI() {
        try {
            // Optimistic UI: user initiated analysis
            setStatus("PROCESSING");

            const res = await processDocument(docId);

            // 🟡 BACKGROUND MODE (202 Accepted)
            if (res?.status === "QUEUED" || res?.status === "PROCESSING") {
                setStatus(res.status); // QUEUED or PROCESSING
                return;
            }

            // 🟢 SYNCHRONOUS MODE (200 OK)
            setResult(res);
            setStatus("DONE");
        } catch (e) {
            const code = e?.response?.status;

            if (code === 402) {
                const payload = e.response.data;
                Alert.alert(
                    "Not enough credits",
                    `You have ${payload.credits} credits but need ${payload.requiredCredits}.`,
                    [
                        { text: "Cancel" },
                        {
                            text: "Upgrade",
                            onPress: () => navigation.navigate("Paywall"),
                        },
                    ]
                );
                setStatus("IDLE");
                return;
            }

            Alert.alert(
                "AI processing failed",
                e?.response?.data || e.message
            );
            setStatus("IDLE");
        }
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <Text style={styles.title}>{title}</Text>

                    <Card>
                        <Text style={styles.cardTitle}>AI Status</Text>

                        {status === "IDLE" && (
                            <Text style={styles.idleText}>
                                Ready to analyze your document using AI.
                            </Text>
                        )}

                        {status === "QUEUED" && (
                            <View style={styles.loadingBox}>
                                <ActivityIndicator size="large" color="#FBBF24" />
                                <Text style={styles.loadingText}>
                                    ⏳ Your document is waiting in queue{dots}
                                </Text>
                                <Text style={styles.helper}>
                                    You can leave this screen. We’ll notify you when it’s ready.
                                </Text>
                            </View>
                        )}

                        {status === "PROCESSING" && (
                            <View style={styles.loadingBox}>
                                <ActivityIndicator size="large" color="#A5B4FC" />
                                <Text style={styles.loadingText}>
                                    🤖 AI is analyzing your document{dots}
                                </Text>
                            </View>
                        )}

                        {status === "DONE" && (
                            <Text style={styles.doneText}>
                                ✅ Analysis complete
                            </Text>
                        )}
                    </Card>

                    {status === "DONE" ? (
                        <AppButton
                            title="View AI Result"
                            onPress={() =>
                                navigation.navigate("Analysis", {
                                    docId,
                                    title,
                                })
                            }
                        />
                    ) : (
                        <AppButton
                            title={
                                status === "QUEUED"
                                    ? "Queued"
                                    : status === "PROCESSING"
                                        ? "Analyzing…"
                                        : "Run AI Analysis"
                            }
                            onPress={runAI}
                            disabled={status === "QUEUED" || status === "PROCESSING"}
                        />
                    )}

                    {result && (
                        <Card>
                            <Text style={styles.cardTitle}>Usage</Text>
                            <Text style={styles.usage}>
                                Credits used: {result.creditsUsed ?? "-"}
                            </Text>
                            <Text style={styles.usage}>
                                Credits left: {result.creditsLeft ?? "-"}
                            </Text>
                        </Card>
                    )}
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 18,
        gap: 14,
    },
    title: {
        color: "#fff",
        fontSize: 22,
        fontWeight: "900",
    },
    cardTitle: {
        fontWeight: "900",
        color: "#004aad",
    },
    idleText: {
        marginTop: 8,
        color: "rgba(255,255,255,0.7)",
        fontWeight: "700",
    },
    loadingBox: {
        marginTop: 16,
        alignItems: "center",
        gap: 12,
    },
    loadingText: {
        color: "#E0E7FF",
        fontWeight: "800",
        textAlign: "center",
    },
    helper: {
        color: "rgba(255,255,255,0.6)",
        fontSize: 12,
        fontWeight: "600",
        textAlign: "center",
    },
    doneText: {
        marginTop: 10,
        color: "#22C55E",
        fontWeight: "800",
    },
    usage: {
        marginTop: 6,
        color: "grey",
        fontWeight: "700",
    },
});
