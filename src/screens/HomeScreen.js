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
import AppButton from "../ui/AppButton";
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

    function handleOpen(doc) {
        if (doc.hasAiResult === true) {
            navigation.navigate("Analysis", {
                docId: doc.id,
                title: doc.title,
            });
        } else {
            navigation.navigate("Process", {
                docId: doc.id,
                title: doc.title,
            });
        }
    }

    function renderItem({ item }) {
        const processed = item.hasAiResult === true;

        return (
            <Pressable
                onPress={() => handleOpen(item)}
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
                            text={processed ? "Processed" : "Pending"}
                            success={processed}
                        />
                        {item.category && (
                            <Text style={styles.category}>
                                {item.category}
                            </Text>
                        )}
                    </View>

                    <Text style={styles.action}>
                        {processed
                            ? "Open AI Analysis →"
                            : "Run AI Analysis →"}
                    </Text>
                </Card>
            </Pressable>
        );
    }

    const isFirstTime = docs.length === 0;

    // 🔹 NEW: split documents safely (no mutation)
    const processedDocs = docs.filter(d => d.hasAiResult === true);
    const pendingDocs = docs.filter(d => d.hasAiResult !== true);

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <AiHeader
                        title="PaperAI"
                        subtitle="Your AI document intelligence hub"
                    />

                    {isFirstTime ? (
                        <View style={styles.welcomeWrap}>
                            <Text style={styles.welcomeTitle}>
                                Welcome to PaperAI 👋
                            </Text>

                            <Text style={styles.welcomeText}>
                                Upload documents and let AI instantly summarize,
                                extract insights, and save your reading time.
                            </Text>

                            <View style={styles.features}>
                                <Feature
                                    icon="document-text-outline"
                                    text="Smart summaries & key points"
                                />
                                <Feature
                                    icon="flash-outline"
                                    text="Instant AI-powered analysis"
                                />
                                <Feature
                                    icon="lock-closed-outline"
                                    text="Private & secure processing"
                                />
                            </View>

                            <AppButton
                                title="Upload your first document"
                                onPress={() => navigation.navigate("Upload")}
                            />

                            <Text style={styles.helper}>
                                Supported: PDF, images, scans & text files
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={[
                                ...(processedDocs.length
                                    ? [{ _type: "header", title: "Previous AI Analysis" }]
                                    : []),
                                ...processedDocs,
                                ...(pendingDocs.length
                                    ? [{ _type: "header", title: "Pending Documents" }]
                                    : []),
                                ...pendingDocs,
                            ]}
                            keyExtractor={(item, index) =>
                                item._type ? `h-${index}` : item.id
                            }
                            refreshControl={
                                <RefreshControl
                                    refreshing={refreshing}
                                    onRefresh={load}
                                    tintColor="#A5B4FC"
                                />
                            }
                            contentContainerStyle={{ paddingBottom: 60 }}
                            renderItem={({ item }) => {
                                if (item._type === "header") {
                                    return (
                                        <Text style={styles.sectionHeader}>
                                            {item.title}
                                        </Text>
                                    );
                                }
                                return renderItem({ item });
                            }}
                        />
                    )}
                </View>
            </SafeAreaView>
        </GradientScreen>
    );
}

function Feature({ icon, text }) {
    return (
        <View style={styles.featureRow}>
            <Ionicons
                name={icon}
                size={18}
                color="#A5B4FC"
                style={{ marginTop: 2 }}
            />
            <Text style={styles.featureText}>{text}</Text>
        </View>
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

    /* ===== SECTION HEADERS ===== */

    sectionHeader: {
        marginTop: 18,
        marginBottom: 8,
        color: "rgba(255,255,255,0.7)",
        fontWeight: "900",
        fontSize: 13,
        letterSpacing: 0.5,
        textTransform: "uppercase",
    },

    /* ===== DOCUMENT LIST ===== */

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

    /* ===== FIRST-TIME WELCOME ===== */

    welcomeWrap: {
        marginTop: 40,
        alignItems: "center",
        paddingHorizontal: 8,
    },

    welcomeTitle: {
        fontSize: 24,
        fontWeight: "900",
        color: "#fff",
        marginBottom: 12,
        textAlign: "center",
    },

    welcomeText: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 15,
        fontWeight: "600",
        textAlign: "center",
        marginBottom: 26,
        lineHeight: 22,
    },

    features: {
        width: "100%",
        gap: 14,
        marginBottom: 28,
    },

    featureRow: {
        flexDirection: "row",
        gap: 12,
        alignItems: "flex-start",
    },

    featureText: {
        flex: 1,
        color: "rgba(255,255,255,0.85)",
        fontWeight: "700",
        lineHeight: 20,
    },

    helper: {
        marginTop: 16,
        color: "rgba(255,255,255,0.55)",
        fontSize: 12,
        textAlign: "center",
        fontWeight: "600",
    },
});
