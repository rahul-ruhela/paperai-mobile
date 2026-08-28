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
import ReminderCard from "../ui/ReminderCard";
import { USE_STUB as CHAT_STUBBED } from "../api/chat";
import { api } from "../api/client";
import { listTasks } from "../api/tasks";
import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";
import { useFocusEffect } from "@react-navigation/native"; // 🔹 NEW
import { recordDetection } from "../services/sensitiveStore";


export default function AnalysisScreen({ route, navigation }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { docId, title } = route.params || {};

    const [loading, setLoading] = useState(true);
    const [rerunning, setRerunning] = useState(false);
    const [doc, setDoc] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [expanded, setExpanded] = useState(false);

    // 🔹 NEW: polling control
    const isInProgress =
        doc?.status === "QUEUED" || doc?.status === "PROCESSING";

    useFocusEffect(
        React.useCallback(() => {
            loadFromDb();
        }, [])
    );

    // 🔹 NEW: poll only while queued / processing
    useEffect(() => {
        if (!isInProgress) return;

        const id = setInterval(loadFromDb, 4000);
        return () => clearInterval(id);
    }, [isInProgress]);

    async function loadFromDb() {
        try {
            setLoading(true);

            const { data } = await api.get(`/api/documents/${docId}`);
            setDoc(data);

            // Sensitive-document detection (Module 5, §3) runs here because this
            // is where the app already holds the text — no extra fetch, and the
            // classifier is pure regex over a string in memory. The result is
            // written to a local file and nowhere else; it is never sent to the
            // server and never logged. Failures are swallowed on purpose: a
            // classifier is an advisory extra and must not break the screen the
            // user actually opened.
            recordDetection(docId, `${data?.title ?? ""}\n${data?.summary ?? ""}\n${data?.extractedText ?? ""}`)
                .catch(() => {});

            if (data?.status === "PROCESSED") {
                const allTasks = await listTasks();
                setTasks(
                    allTasks.filter(
                        t => String(t.sourceDocumentId) === String(docId)
                    )
                );
            }
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

                        {/* 🔹 NEW: QUEUED / PROCESSING STATE */}
                        {isInProgress && (
                            <Card style={styles.card}>
                                <View style={styles.centerBox}>
                                    <ActivityIndicator
                                        size="large"
                                        color={theme.colors.accentText}
                                    />
                                    <Text style={styles.inProgressTitle}>
                                        {doc.status === "QUEUED"
                                            ? "Waiting in queue"
                                            : "Analyzing document"}
                                    </Text>
                                    <Text style={styles.inProgressText}>
                                        This may take a few moments. You can
                                        leave this screen.
                                    </Text>
                                </View>
                            </Card>
                        )}

                        {/* 🔹 FAILED STATE */}
                        {doc?.status === "FAILED" && (
                            <Card style={styles.card}>
                                <Text style={styles.heading}>
                                    Analysis failed
                                </Text>
                                <Text style={styles.muted}>
                                    Something went wrong while analyzing this
                                    document.
                                </Text>
                            </Card>
                        )}

                        {/* 🔹 ONLY RENDER RESULTS WHEN PROCESSED */}
                        {doc?.status === "PROCESSED" && (
                            <>
                                {lastAnalyzedText && (
                                    <Text style={styles.timestamp}>
                                        Last analyzed {lastAnalyzedText}
                                    </Text>
                                )}

                                {/* SUMMARY */}
                                <Card style={styles.card}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.heading}>
                                            Summary
                                        </Text>
                                        <Pressable onPress={shareSummary}>
                                            <Ionicons
                                                name="share-outline"
                                                size={18}
                                                color={theme.colors.accentText}
                                            />
                                        </Pressable>
                                    </View>

                                    <Text style={styles.body}>
                                        {doc.summary ||
                                            "No summary available."}
                                    </Text>
                                </Card>

                                {/* Smart Reminders — renders nothing at all
                                    when no actionable date is detected. */}
                                <ReminderCard doc={doc} navigation={navigation} />

                                {/* AI TASKS */}
                                <Card style={styles.card}>
                                    <Text style={styles.heading}>
                                        AI Action Tasks
                                    </Text>

                                    {tasks.length === 0 ? (
                                        <Text style={styles.muted}>
                                            No AI tasks generated.
                                        </Text>
                                    ) : (
                                        tasks.map(t => (
                                            <View
                                                key={t.id}
                                                style={styles.task}
                                            >
                                                {renderTaskTitle(t.title)}
                                                {t.aiReason && (
                                                    <Text
                                                        style={
                                                            styles.taskReason
                                                        }
                                                    >
                                                        {t.aiReason}
                                                    </Text>
                                                )}
                                            </View>
                                        ))
                                    )}
                                </Card>

                                {/* EXTRACTED TEXT */}
                                <Card style={styles.card}>
                                    <Pressable
                                        style={styles.cardHeader}
                                        onPress={() =>
                                            setExpanded(v => !v)
                                        }
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
                                            color={theme.colors.accentText}
                                        />
                                    </Pressable>

                                    {expanded && (
                                        <Text style={styles.body}>
                                            {doc.extractedText ||
                                                "No extracted text."}
                                        </Text>
                                    )}
                                </Card>

                                {/* Hidden while chat runs against the stub. Shipping a
                                    visible feature that answers with placeholder text is an
                                    App Review 2.1 rejection — the same reason the OCR AI
                                    actions in UploadScreen stay commented out. Flip USE_STUB
                                    to false in src/api/chat.js once the endpoint is live and
                                    this button appears on its own. */}
                                <View style={styles.actions}>
                                    {!CHAT_STUBBED && (
                                        <AppButton
                                            title="Ask AI about this document"
                                            icon="chatbubble-ellipses-outline"
                                            onPress={() =>
                                                navigation.navigate("AiChat", {
                                                    docId,
                                                    title: doc?.title || title,
                                                })
                                            }
                                        />
                                    )}

                                    <AppButton
                                        title="Re-run AI Analysis (uses credits)"
                                        icon="refresh-outline"
                                        onPress={rerunAnalysis}
                                        disabled={rerunning}
                                    />
                                </View>
                            </>
                        )}
                    </ScrollView>

                    {/* LOADER OVERLAY (initial load / rerun) */}
                    {(loading || rerunning) && (
                        <View style={styles.overlay}>
                            <ActivityIndicator
                                size="large"
                                color={theme.colors.accentText}
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

const makeStyles = (t) =>
    StyleSheet.create({
    container: {
        padding: 18,
        paddingBottom: 80,
    },

    // Stacked AppButtons have no margin of their own — the spacing lives here so
    // every action on this screen sits on the same rhythm as the cards above.
    actions: { gap: 10, marginTop: 4 },

    card: {
        marginBottom: 16,
        backgroundColor: t.colors.surface,
        borderColor: t.colors.border,
    },

    cardHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
    },

    // Card headings ("Summary", "AI Action Tasks", "Extracted Text"). These were
    // a hardcoded navy that vanished against the dark card — they must follow
    // the theme, and stay distinct from the blue `verb` accent below.
    heading: {
        fontSize: 16,
        fontWeight: "900",
        color: t.colors.textPrimary,
    },

    body: {
        fontSize: 14,
        lineHeight: 22,
        color: t.colors.textSecondary,
        fontWeight: "600",
    },

    muted: {
        color: t.colors.textMuted,
        fontWeight: "600",
    },

    timestamp: {
        marginBottom: 10,
        color: t.colors.textMuted,
        fontWeight: "600",
        fontSize: 12,
    },

    task: {
        marginBottom: 12,
    },

    taskTitle: {
        fontWeight: "700",
        color: t.colors.textPrimary,
    },

    verb: {
        color: t.colors.accentText,
        fontWeight: "900",
    },

    taskReason: {
        marginTop: 0,
        color: t.colors.textMuted,
        fontWeight: "600",
    },

    centerBox: {
        alignItems: "center",
        gap: 1,
        paddingVertical: 2,
    },

    inProgressTitle: {
        fontWeight: "900",
        color: t.colors.textPrimary,
        fontSize: 16,
    },

    inProgressText: {
        color: t.colors.textMuted,
        fontWeight: "600",
        textAlign: "center",
    },

    overlay: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: t.colors.overlay,
        justifyContent: "center",
        alignItems: "center",
        gap: 12,
    },

    // Sits on the dark scrim above, so it stays light in BOTH themes.
    overlayText: {
        color: t.colors.white,
        fontWeight: "800",
    },
});
