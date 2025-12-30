import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Card from "../ui/Card";
import { listDocuments } from "../api/documents";

export default function HomeScreen({ navigation }) {
  const [docs, setDocs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await listDocuments();
      setDocs(data);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: "#111827" }}>
          PaperAI
        </Text>

        <FlatList
          data={docs}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={load} />
          }
          renderItem={({ item }) => (
            <Card>
              <Text style={{ fontWeight: "700" }}>{item.title}</Text>
              <Text style={{ color: "#555", marginTop: 6 }}>
                Status: {item.status}
              </Text>
              <Text style={{ color: "#555" }}>
                Category: {item.category}
              </Text>
              <Text
                onPress={() =>
                  navigation.navigate("Process", {
                    docId: item.id,
                    title: item.title,
                  })
                }
                style={{ marginTop: 10, fontWeight: "600" }}
              >
                Open / Process →
              </Text>
            </Card>
          )}
        />
      </View>
    </SafeAreaView>
  );
}
