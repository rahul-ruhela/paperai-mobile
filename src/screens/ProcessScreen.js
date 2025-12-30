import React, { useState } from "react";
import { View, Text, Alert, ActivityIndicator } from "react-native";
import AppButton from "../ui/AppButton";
import Card from "../ui/Card";
import { processDocument } from "../api/documents";

export default function ProcessScreen({ route, navigation }) {
    const { docId, title } = route.params;

    const [status, setStatus] = useState("IDLE");
    const [result, setResult] = useState(null);

    async function runAI() {
        try {
            setStatus("ANALYZING");

            const data = await processDocument(docId);
            setResult(data);
            setStatus("DONE");
        } catch (e) {
            // handle credit block
            const code = e?.response?.status;
            if (code === 402) {
                const payload = e.response.data;
                Alert.alert(
                    "Not enough credits",
                    `You have ${payload.credits} credits but need ${payload.requiredCredits}.`,
                    [
                        { text: "Cancel" },
                        { text: "Upgrade", onPress: () => navigation.navigate("Paywall") },
                    ]
                );
                setStatus("IDLE");
                return;
            }

            Alert.alert("AI processing failed", e?.response?.data || e.message);
            setStatus("IDLE");
        }
    }

    return (
        <View style={{ flex: 1, padding: 16, backgroundColor: "#F9FAFB", gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: "800" }}>{title}</Text>

            <Card>
                <Text style={{ fontWeight: "800", color: "#6B7280" }}>AI Status</Text>

                {status === "IDLE" && <Text style={{ marginTop: 8 }}>Ready to analyze.</Text>}

                {status === "ANALYZING" && (
                    <View style={{ marginTop: 12, alignItems: "center", gap: 10 }}>
                        <ActivityIndicator size="large" color="#4F46E5" />
                        <Text style={{ color: "#4F46E5", fontWeight: "800" }}>
                            🧠 AI is analyzing your document…
                        </Text>
                    </View>
                )}

                {status === "DONE" && (
                    <Text style={{ marginTop: 8, color: "#16A34A", fontWeight: "700" }}>
                        ✅ Done
                    </Text>
                )}
            </Card>

            {status !== "DONE" ? (
                <AppButton
                    title={status === "ANALYZING" ? "Analyzing…" : "Run AI Analysis"}
                    onPress={runAI}
                    disabled={status === "ANALYZING"}
                />
            ) : (
                <AppButton
                    title="View Result"
                    onPress={() => navigation.navigate("Document", { title, result })}
                />
            )}

            {result && (
                <Card>
                    <Text style={{ fontWeight: "800", color: "#6B7280" }}>Usage</Text>
                    <Text style={{ marginTop: 8 }}>
                        Credits used: {result.creditsUsed ?? "-"}
                    </Text>
                    <Text style={{ marginTop: 6 }}>
                        Credits left: {result.creditsLeft ?? "-"}
                    </Text>
                </Card>
            )}
        </View>
    );
}
