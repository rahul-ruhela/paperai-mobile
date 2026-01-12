import React, { useState, useCallback } from "react";
import {
    View,
    Text,
    FlatList,
    RefreshControl,
    StyleSheet,
    Pressable,
    Modal,
    Alert,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import GradientScreen from "../ui/GradientScreen";
import Card from "../ui/Card";
import AiHeader from "../ui/AiHeader";
import AppButton from "../ui/AppButton";
import BottomFade from "../ui/BottomFade";

import { listDocuments, deleteDocument } from "../api/documents";

export default function HomeScreen({ navigation }) {
    const [docs, setDocs] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState(null);

    const load = useCallback(async () => {
        setRefreshing(true);
        try {
            const data = await listDocuments();
            setDocs(data.filter(d => d.status !== "DELETED"));
        } finally {
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    function openDoc(doc) {
        closeMenu();
        navigation.navigate(doc.hasAiResult ? "Analysis" : "Process", {
            docId: doc.id,
            title: doc.title,
        });
    }

    function closeMenu() {
        setSelectedDoc(null);
    }

    function confirmDelete() {
        const doc = selectedDoc;
        closeMenu();

        Alert.alert(
            "Delete document?",
            `"${doc.title}" will be permanently deleted.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        setDocs(d => d.filter(x => x.id !== doc.id));
                        await deleteDocument(doc.id);
                    },
                },
            ]
        );
    }

    function renderItem({ item }) {
        return (
            <Card style={styles.card}>
                <Pressable onPress={() => openDoc(item)}>
                    <View style={styles.row}>
                        <Ionicons name="document-text-outline" size={20} color="#A5B4FC" />
                        <Text style={styles.title} numberOfLines={2}>
                            {item.title}
                        </Text>

                        <Pressable
                            onPress={() => setSelectedDoc(item)}
                            hitSlop={10}
                        >
                            <Ionicons name="ellipsis-horizontal" size={20} color="#64748B" />
                        </Pressable>
                    </View>

                    <Text style={styles.action}>
                        {item.hasAiResult ? "Open AI Analysis →" : "Run AI Analysis →"}
                    </Text>
                </Pressable>
            </Card>
        );
    }

    return (
        <GradientScreen>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.container}>
                    <AiHeader
                        title="Documents"
                        subtitle="Your AI document workspace"
                    />

                    <FlatList
                        data={docs}
                        keyExtractor={i => i.id}
                        renderItem={renderItem}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={load} />
                        }
                        contentContainerStyle={{ paddingBottom: 80 }}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <Text style={styles.emptyTitle}>No documents yet</Text>
                                <AppButton
                                    title="Upload document"
                                    onPress={() => navigation.navigate("Upload")}
                                />
                            </View>
                        }
                    />
                </View>
            </SafeAreaView>

            {/* ACTION SHEET */}
            <Modal
                visible={!!selectedDoc}
                transparent
                animationType="slide"
                onRequestClose={closeMenu}
            >
                <Pressable style={styles.overlay} onPress={closeMenu} />

                <View style={styles.sheet}>
                    <Text style={styles.sheetTitle}>
                        {selectedDoc?.title}
                    </Text>

                    <SheetAction
                        icon="sparkles-outline"
                        text="Open AI Analysis"
                        onPress={() => openDoc(selectedDoc)}
                    />

                    <SheetAction
                        icon="trash-outline"
                        text="Delete Document"
                        danger
                        onPress={confirmDelete}
                    />

                    <SheetAction
                        icon="close"
                        text="Cancel"
                        onPress={closeMenu}
                    />
                </View>
            </Modal>

            <BottomFade />
        </GradientScreen>
    );
}

function SheetAction({ icon, text, onPress, danger }) {
    return (
        <Pressable onPress={onPress} style={styles.sheetAction}>
            <Ionicons
                name={icon}
                size={20}
                color={danger ? "#EF4444" : "#020c45"}
            />
            <Text
                style={[
                    styles.sheetText,
                    danger && { color: "#EF4444" },
                ]}
            >
                {text}
            </Text>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 18 },

    card: {
        backgroundColor: "rgba(255,255,255,0.08)",
        borderRadius: 22,
        marginBottom: 12,
        ...(Platform.OS === "ios"
            ? {
                shadowColor: "#000",
                shadowOpacity: 0.08,
                shadowRadius: 10,
                shadowOffset: { height: 4 },
            }
            : {}),
    },

    row: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },

    title: {
        flex: 1,
        fontSize: 15,
        fontWeight: "900",
        color: "#020c45",
    },

    action: {
        marginTop: 14,
        fontWeight: "800",
        color: "#004aad",
    },

    empty: {
        marginTop: 60,
        alignItems: "center",
    },

    emptyTitle: {
        color: "#fff",
        fontWeight: "900",
        fontSize: 20,
        marginBottom: 14,
    },

    overlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
    },

    sheet: {
        backgroundColor: "#fff",
        padding: 20,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
    },

    sheetTitle: {
        fontWeight: "900",
        fontSize: 16,
        marginBottom: 12,
    },

    sheetAction: {
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 14,
    },

    sheetText: {
        fontSize: 15,
        fontWeight: "700",
    },
});
