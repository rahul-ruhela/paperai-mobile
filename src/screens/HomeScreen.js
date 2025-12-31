import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    FlatList,
    RefreshControl,
    StyleSheet,
    Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import GradientScreen from "../ui/GradientScreen";
import Card from "../ui/Card";
import AiHeader from "../ui/AiHeader";
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

    function renderItem({ item }) {
        const done =
            item.status?.toUpperCase() === "DONE" ||
            item.status?.toUpperCase() === "PROCESSED";

        return (
            <Pressable
                onPress={() =>
                    navigation.navigate("Process", {
                        docId: item.id,
                        title: item.title,
                    })
                }
                style={({ pressed }) => pressed && { opacity: 0.85 }}
            >
                <Card style={styles.card}>
                    <View style={styles.row}>
                        <Ionicons
                            name="document-text-outline"
                            size={20}
                            color="#A5B4FC"
                        />
                        <Text style={styles.title} numberOfLines={2}>
                            {item.title}
                        </Text>
                    </View>

                    <View style={styles.metaRow}>
                        <Badge
                            text={done ? "Processed" : "Pending"}
                            success={done}
                        />
                        {item.category && (
                            <Text style={styles.category}>{item.category}</Text>
                        )}
                    </View>

                    <Text style={styles.action}>Open AI Analysis →</Text>
                </Card>
            </Pressable>
        );
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <AiHeader
                        title="PaperAI"
                        subtitle="Your AI document intelligence hub"
                    />

                    <FlatList
                        data={docs}
                        keyExtractor={(i) => i.id}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={load}
                                tintColor="#A5B4FC"
                            />
                        }
                        contentContainerStyle={{ paddingBottom: 60 }}
                        renderItem={renderItem}
                        ListEmptyComponent={
                            <Text style={styles.empty}>
                                Upload a document to get AI insights.
                            </Text>
                        }
                    />
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

function Badge({ text, success }) {
    return (
        <View
            style={[
                styles.badge,
                success ? styles.badgeSuccess : styles.badgePending,
            ]}
        >
            <Text style={styles.badgeText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 18 },

    card: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderColor: "rgba(255,255,255,0.15)",
    },

    row: {
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
    },

    title: {
        flex: 1,
        fontSize: 15,
        fontWeight: "900",
        color: "#020c45",
    },

    metaRow: {
        marginTop: 10,
        flexDirection: "row",
        gap: 10,
        alignItems: "center",
    },

    category: {
        color: "rgba(255,255,255,0.65)",
        fontWeight: "600",
    },

    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
    },

    badgeSuccess: {
        backgroundColor: "rgba(34,197,94,0.3)",
    },

    badgePending: {
        backgroundColor: "rgba(251,191,36,0.3)",
    },

    badgeText: {
        color: "#020c45",
        fontWeight: "800",
        fontSize: 12,
    },

    action: {
        marginTop: 14,
        fontWeight: "800",
        color: "#004aad",
    },

    empty: {
        marginTop: 120,
        textAlign: "center",
        color: "rgba(255,255,255,0.6)",
        fontWeight: "600",
    },
});
