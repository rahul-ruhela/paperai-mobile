import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TextInput,
    FlatList,
    Alert,
    StyleSheet,
    Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import GradientScreen from "../ui/GradientScreen";
import Card from "../ui/Card";
import AppButton from "../ui/AppButton";
import AiHeader from "../ui/AiHeader";
import { listTasks, createTask, updateTask } from "../api/tasks";

export default function TasksScreen() {
    const [tasks, setTasks] = useState([]);
    const [title, setTitle] = useState("");
    const [expandedId, setExpandedId] = useState(null);
    const [streak, setStreak] = useState(0);

    async function load() {
        const data = await listTasks();
        setTasks(data);
    }

    useEffect(() => {
        load();
    }, []);

    async function add() {
        try {
            if (!title.trim()) return;
            await createTask(title.trim(), null);
            setTitle("");
            await load();
        } catch (e) {
            Alert.alert("Create task failed", e?.response?.data || e.message);
        }
    }

    async function toggleDone(t) {
        try {
            const next = t.status === "DONE" ? "OPEN" : "DONE";
            await updateTask(t.id, { status: next });
            if (next === "DONE") setStreak((s) => s + 1);
            await load();
        } catch (e) {
            Alert.alert("Update task failed", e?.response?.data || e.message);
        }
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <AiHeader
                        title="AI Action Hub"
                        subtitle={`🔥 ${streak}-task completion streak`}
                    />

                    <Card style={styles.card}>
                        <TextInput
                            placeholder="Ask AI to track an action…"
                            placeholderTextColor="rgba(255,255,255,0.5)"
                            value={title}
                            onChangeText={setTitle}
                            style={styles.input}
                        />
                        <AppButton title="Add task" onPress={add} />
                    </Card>

                    <FlatList
                        data={tasks}
                        keyExtractor={(x) => x.id}
                        contentContainerStyle={{ paddingBottom: 60 }}
                        renderItem={({ item }) => {
                            const expanded = expandedId === item.id;
                            const isAi = item.isAiSuggested === true;

                            return (
                                <Card style={styles.card}>
                                    <Pressable onPress={() => toggleDone(item)}>
                                        <View style={styles.row}>
                                            <Ionicons
                                                name={
                                                    item.status === "DONE"
                                                        ? "checkmark-circle"
                                                        : "ellipse-outline"
                                                }
                                                size={20}
                                                color={
                                                    item.status === "DONE"
                                                        ? "#22C55E"
                                                        : "#A5B4FC"
                                                }
                                            />
                                            <Text style={styles.taskTitle}>
                                                {item.title}
                                            </Text>
                                        </View>
                                    </Pressable>

                                    <View style={styles.metaRow}>
                                        {isAi && <Badge text="AI suggested" />}
                                        {isAi && item.priority && (
                                            <PriorityBadge level={item.priority} />
                                        )}
                                        <Text style={styles.due}>Due: Soon</Text>
                                    </View>

                                    {isAi && item.aiReason && (
                                        <>
                                            <Pressable
                                                onPress={() =>
                                                    setExpandedId(
                                                        expanded ? null : item.id
                                                    )
                                                }
                                            >
                                                <Text style={styles.why}>
                                                    Why this task? →
                                                </Text>
                                            </Pressable>

                                            {expanded && (
                                                <Text style={styles.explain}>
                                                    {item.aiReason}
                                                </Text>
                                            )}
                                        </>
                                    )}
                                </Card>
                            );
                        }}
                    />
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

function Badge({ text }) {
    return (
        <View style={styles.badge}>
            <Text style={styles.badgeText}>{text}</Text>
        </View>
    );
}

function PriorityBadge({ level }) {
    const map = {
        HIGH: "#EF4444",
        MEDIUM: "#F59E0B",
        LOW: "#22C55E",
    };
    return (
        <View style={[styles.badge, { backgroundColor: map[level] + "40" }]}>
            <Text style={styles.badgeText}>{level}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 18 },

    card: {
        backgroundColor: "transparent",
        borderColor: "rgba(255,255,255,0.15)",
    },

    input: {
        backgroundColor: "transparent",
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
        color: "black",
        fontWeight: "600",
        borderWidth: 1,
    },

    row: {
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
    },

    taskTitle: {
        flex: 1,
        fontSize: 15,
        fontWeight: "900",
        color: "black",
    },

    metaRow: {
        marginTop: 10,
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
    },

    badge: {
        backgroundColor: "rgba(99,102,241,0.3)",
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
    },

    badgeText: {
        color: "black",
        fontWeight: "800",
        fontSize: 11,
    },

    due: {
        color: "rgba(255,255,255,0.6)",
        fontWeight: "600",
    },

    why: {
        marginTop: 10,
        color: "#004aad",
        fontWeight: "700",
    },

    explain: {
        marginTop: 6,
        color: "grey",
        fontWeight: "600",
        lineHeight: 20,
    },
});
