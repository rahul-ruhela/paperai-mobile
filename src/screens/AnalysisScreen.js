import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import GradientScreen from "../ui/GradientScreen";
import Card from "../ui/Card";
import AiHeader from "../ui/AiHeader";
import { listTasks } from "../api/tasks";
import api from "../api/client";
import AppButton from "../ui/AppButton";
export default function AnalysisScreen({ route }) {
    const { docId, title } = route.params;

    const [loading, setLoading] = useState(true);
    const [doc, setDoc] = useState(null);
    const [tasks, setTasks] = useState([]);

    useEffect(() => {
        load();
    }, []);

    async function load() {
        try {
            setLoading(true);

            const docRes = await api.get(`/documents/${docId}`);
            setDoc(docRes.data);

            const allTasks = await listTasks();
            setTasks(
                allTasks.filter(
                    t => t.sourceDocumentId === docId
                )
            );
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <GradientScreen>
                <SafeAreaView style={styles.center}>
                    <ActivityIndicator size="large" color="#A5B4FC" />
                </SafeAreaView>
            </GradientScreen>
        );
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.container}>
                    <AiHeader title="AI Analysis" subtitle={title} />

                    <Card style={styles.card}>
                        <Text style={styles.heading}>Summary</Text>
                        <Text style={styles.body}>
                            {doc?.summary || "No summary available."}
                        </Text>
                    </Card>

                    <Card style={styles.card}>
                        <Text style={styles.heading}>AI Action Tasks</Text>

                        {tasks.length === 0 && (
                            <Text style={styles.muted}>
                                No AI tasks generated.
                            </Text>
                        )}

                        {tasks.map(t => (
                            <View key={t.id} style={styles.task}>
                                <Text style={styles.taskTitle}>
                                    • {t.title}
                                </Text>
                                {t.aiReason && (
                                    <Text style={styles.taskReason}>
                                        {t.aiReason}
                                    </Text>
                                )}
                            </View>
                        ))}
                    </Card>

                    <Card style={styles.card}>
                        <Text style={styles.heading}>Extracted Text</Text>
                        <Text style={styles.body}>
                            {doc?.extractedText || "No extracted text."}
                        </Text>

                        <AppButton
                            title="Re-run AI Analysis (uses credits)"
                            onPress={async () => {
                                setLoading(true);
                                await api.post(`/documents/${docId}/reprocess`);
                                await load();
                            }}
                        />
                    </Card>
                </ScrollView>
            </SafeAreaView>
        </GradientScreen>
    );
}

const styles = StyleSheet.create({
    container: { padding: 18, paddingBottom: 60 },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    card: {
        marginBottom: 16,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderColor: "rgba(255,255,255,0.15)",
    },
    heading: {
        fontSize: 16,
        fontWeight: "900",
        marginBottom: 6,
        color: "#020c45",
    },
    body: {
        fontSize: 14,
        lineHeight: 20,
        color: "rgba(255,255,255,0.85)",
    },
    muted: {
        color: "rgba(255,255,255,0.6)",
        fontWeight: "600",
    },
    task: { marginBottom: 10 },
    taskTitle: {
        fontWeight: "800",
        color: "rgba(255,255,255,0.9)",
    },
    taskReason: {
        marginTop: 4,
        color: "rgba(255,255,255,0.75)",
    },
});
