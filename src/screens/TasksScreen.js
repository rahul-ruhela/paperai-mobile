import React, { useEffect, useState } from "react";
import {
    View,
    Text,
    TextInput,
    FlatList,
    Alert,
    Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import GradientScreen from "../ui/GradientScreen";
import Card from "../ui/Card";
import AppButton from "../ui/AppButton";
import AiHeader from "../ui/AiHeader";

import { useLegacyTheme } from "../ui/theme";
import { makeCommon, makeTaskStyles } from "../ui/styles";
import useThemedStyles from "../ui/useThemedStyles";
import { useTheme } from "../ui/ThemeProvider";

import { listTasks, createTask, updateTask } from "../api/tasks";

export default function TasksScreen() {
    const { theme } = useTheme();
    const Theme = useLegacyTheme();
    const Common = useThemedStyles(makeCommon);
    const S = useThemedStyles(makeTaskStyles);
    const [tasks, setTasks] = useState([]);
    const [title, setTitle] = useState("");
    const [expandedId, setExpandedId] = useState(null);
    const [streak, setStreak] = useState(0);

    async function load() {
        const data = await listTasks();
        setTasks(Array.isArray(data) ? data : []);
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
            <SafeAreaView style={Common.flex1}>
                <View style={Common.screen}>
                    <AiHeader title="AI Action Hub" subtitle={`🔥 ${streak}-task streak`} />

                    {/* Add Task (FIX: padding + consistent) */}
                    <Card style={S.addCard}>
                        <View style={S.addRow}>
                            <TextInput
                                placeholder="Ask AI to track an action…"
                                placeholderTextColor={Theme.colors.muted}
                                keyboardAppearance={theme.keyboardAppearance}
                                value={title}
                                onChangeText={setTitle}
                                style={S.input}
                            />
                            <AppButton title="Add" icon="add" onPress={add} disabled={!title.trim()} />
                        </View>
                    </Card>

                    <FlatList
                        data={tasks}
                        keyExtractor={(x) => x.id}
                        contentContainerStyle={{ paddingBottom: 90 }}
                        ListEmptyComponent={
                            <View style={{ marginTop: 40, alignItems: "center" }}>
                                <Ionicons name="checkbox-outline" size={34} color={Theme.colors.primary2} />
                                <Text style={{ marginTop: 10, color: Theme.colors.text, fontWeight: "950", fontSize: 16 }}>
                                    No tasks yet
                                </Text>
                                <Text style={{ marginTop: 6, color: Theme.colors.text2, fontWeight: "750", textAlign: "center" }}>
                                    Add a task to build your AI action list.
                                </Text>
                            </View>
                        }
                        renderItem={({ item }) => {
                            const expanded = expandedId === item.id;
                            const isAi = item.isAiSuggested === true;

                            return (
                                <Card style={S.taskCard}>
                                    <Pressable onPress={() => toggleDone(item)} style={({ pressed }) => pressed && { opacity: 0.92 }}>
                                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                                            <Ionicons
                                                name={item.status === "DONE" ? "checkmark-circle" : "ellipse-outline"}
                                                size={20}
                                                color={item.status === "DONE" ? Theme.colors.ok : Theme.colors.primary2}
                                            />
                                            <Text style={S.taskTitle} numberOfLines={2}>
                                                {item.title}
                                            </Text>
                                        </View>
                                    </Pressable>

                                    <View style={S.metaRow}>
                                        {isAi ? (
                                            <View style={Common.chip}>
                                                <Text style={Common.chipText}>AI suggested</Text>
                                            </View>
                                        ) : null}

                                        {item.priority ? (
                                            <View style={Common.chip}>
                                                <Text style={Common.chipText}>{String(item.priority).toUpperCase()}</Text>
                                            </View>
                                        ) : null}

                                        <Text style={S.due}>Due: Soon</Text>
                                    </View>

                                    {isAi && item.aiReason ? (
                                        <>
                                            <Pressable onPress={() => setExpandedId(expanded ? null : item.id)}>
                                                <Text style={S.why}>Why this task? →</Text>
                                            </Pressable>
                                            {expanded ? <Text style={S.explain}>{item.aiReason}</Text> : null}
                                        </>
                                    ) : null}
                                </Card>
                            );
                        }}
                    />
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}
