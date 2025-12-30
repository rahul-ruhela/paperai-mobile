import React, { useEffect, useState } from "react";
import { View, Text, TextInput, FlatList, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Card from "../ui/Card";
import AppButton from "../ui/AppButton";
import { listTasks, createTask, updateTask } from "../api/tasks";

export default function TasksScreen() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");

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
      await load();
    } catch (e) {
      Alert.alert("Update task failed", e?.response?.data || e.message);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 12 }}>
          Tasks
        </Text>

        <Card>
          <TextInput
            placeholder="New task..."
            value={title}
            onChangeText={setTitle}
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 12,
              padding: 12,
              marginBottom: 10,
            }}
          />
          <AppButton title="Add task" onPress={add} />
        </Card>

        <FlatList
          data={tasks}
          keyExtractor={(x) => x.id}
          renderItem={({ item }) => (
            <Card>
              <Text style={{ fontWeight: "700" }}>{item.title}</Text>
              <Text style={{ marginTop: 6, color: "#555" }}>
                Status: {item.status}
              </Text>
              <Text
                onPress={() => toggleDone(item)}
                style={{ marginTop: 10, fontWeight: "600" }}
              >
                Toggle Done →
              </Text>
            </Card>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
