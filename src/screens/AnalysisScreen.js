import React, { useEffect, useState, useMemo } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
    Alert,
    Pressable,
    Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import GradientScreen from "../ui/GradientScreen";
import Card from "../ui/Card";
import AiHeader from "../ui/AiHeader";
import AppButton from "../ui/AppButton";
import { api } from "../api/client";
import { listTasks } from "../api/tasks";

export default function AnalysisScreen({ route }) {
    const { docId, title } = route.params;

    const [loading, setLoading] = useState(true);
    const [rerunning, setRerunning] = useState(false);
    const [doc, setDoc] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        loadFromDb();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function loadFromDb() {
        try {
            setLoading(true);

            const { data } = await api.get(`/api/documents/${docId}`);
            setDoc(data);

            const allTasks = await listTasks();
            setTasks(
                allTasks.filter(
                    t => String(t.sourceDocumentId) === String(docId)
                )
            );
        } catch (e) {
            Alert.alert(
                "Failed to load analysis",
                e?.response?.data || e.message
            );
        } finally {
            setLoading(false);
        }
    }

    async function rerunAnalysis() {
        try {
            setRerunning(true);
            await api.post(`/api/documents/${docId}/reprocess`);
            await loadFromDb();
        } catch (e) {
            Alert.alert(
                "Re-run failed",
                e?.response?.data || e.message
            );
        } finally {
            setRerunning(false);
        }
    }

    async function shareSummary() {
        if (!doc?.summary) return;
        await Share.share({
            message: doc.summary,
        });
    }

    const lastAnalyzedText = useMemo(() => {
        if (!doc?.updatedAt) return null;
        const diffMs = Date.now() - new Date(doc.updatedAt).getTime();
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return "Just now";
        if (mins < 60) return `${mins} min ago`;
        const hrs = Math.floor(mins / 60);
        return `${hrs} hr ago`;
    }, [doc?.updatedAt]);

    function renderTaskTitle(title) {
        const [first, ...rest] = title.split(" ");
        return (
            <Text style={styles.taskTitle}>
                <Text style={styles.verb}>{first} </Text>
                {rest.join(" ")}
            </Text>
        );
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={{ flex: 1 }}>
                    <ScrollView contentContainerStyle={styles.container}>
                        <AiHeader title="AI Analysis" subtitle={title} />

                        {lastAnalyzedText && (
                            <Text style={styles.timestamp}>
                                Last analyzed {lastAnalyzedText}
                            </Text>
                        )}

                        {/* SUMMARY */}
                        <Card style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.heading}>Summary</Text>
                                <Pressable onPress={shareSummary}>
                                    <Ionicons
                                        name="share-outline"
                                        size={18}
                                        color="#004aad"
                                    />
                                </Pressable>
                            </View>

                            <Text style={styles.body}>
                                {doc?.summary || "No summary available."}
                            </Text>
                        </Card>

                        {/* AI TASKS */}
                        <Card style={styles.card}>
                            <Text style={styles.heading}>AI Action Tasks</Text>

                            {tasks.length === 0 ? (
                                <Text style={styles.muted}>
                                    No AI tasks generated.
                                </Text>
                            ) : (
                                tasks.map(t => (
                                    <View key={t.id} style={styles.task}>
                                        {renderTaskTitle(t.title)}
                                        {t.aiReason && (
                                            <Text style={styles.taskReason}>
                                                {t.aiReason}
                                            </Text>
                                        )}
                                    </View>
                                ))
                            )}
                        </Card>

                        {/* EXTRACTED TEXT (COLLAPSIBLE) */}
                        <Card style={styles.card}>
                            <Pressable
                                style={styles.cardHeader}
                                onPress={() => setExpanded(v => !v)}
                            >
                                <Text style={styles.heading}>
                                    Extracted Text
                                </Text>
                                <Ionicons
                                    name={
                                        expanded
                                            ? "chevron-up"
                                            : "chevron-down"
                                    }
                                    size={18}
                                    color="#004aad"
                                />
                            </Pressable>

                            {expanded && (
                                <Text style={styles.body}>
                                    {doc?.extractedText ||
                                        "No extracted text."}
                                </Text>
                            )}
                        </Card>

                        <AppButton
                            title="Re-run AI Analysis (uses credits)"
                            onPress={rerunAnalysis}
                            disabled={rerunning}
                        />
                    </ScrollView>

                    {/* LOADER OVERLAY */}
                    {(loading || rerunning) && (
                        <View style={styles.overlay}>
                            <ActivityIndicator
                                size="large"
                                color="#A5B4FC"
                            />
                            <Text style={styles.overlayText}>
                                {rerunning
                                    ? "Re-running AI analysis…"
                                    : "Loading analysis…"}
                            </Text>
                        </View>
                    )}
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 18,
        paddingBottom: 80,
    },

    /* ===== Card ===== */

    card: {
        marginBottom: 16,
        backgroundColor: "rgba(255,255,255,0.94)",
        borderColor: "rgba(0,0,0,0.06)",
    },

    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
    },

    heading: {
        fontSize: 16,
        fontWeight: "900",
        color: "#020c45",
    },

    body: {
        fontSize: 14,
        lineHeight: 22,
        color: "#334155",
        fontWeight: "600",
    },

    muted: {
        color: "#64748B",
        fontWeight: "600",
    },

    timestamp: {
        marginBottom: 10,
        color: "rgba(255,255,255,0.65)",
        fontWeight: "700",
        fontSize: 12,
    },

    /* ===== Tasks ===== */

    task: {
        marginBottom: 12,
    },

    taskTitle: {
        fontWeight: "700",
        color: "#020c45",
    },

    verb: {
        color: "#004aad",
        fontWeight: "900",
    },

    taskReason: {
        marginTop: 4,
        color: "#475569",
        fontWeight: "600",
    },

    /* ===== Overlay ===== */

    overlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(15,23,42,0.35)",
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
    },

    overlayText: {
        color: "#E0E7FF",
        fontWeight: "800",
    },
});


