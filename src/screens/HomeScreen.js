import React, { useState, useCallback, useMemo } from "react";
import {
    View,
    Text,
    FlatList,
    RefreshControl,
    Pressable,
    Modal,
    Alert,
    Image,
    TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import GradientScreen from "../ui/GradientScreen";
import Card from "../ui/Card";
import AiHeader from "../ui/AiHeader";
import BottomFade from "../ui/BottomFade";

import { Theme } from "../ui/theme";
import { Common, HomeStyles as S } from "../ui/styles";

import { listDocuments, deleteDocument } from "../api/documents";

const TABS = {
    INBOX: "inbox",
    AI_READY: "ai",
    PENDING: "pending",
    PINNED: "pinned",
};

function safeStr(x) {
    return typeof x === "string" ? x : "";
}
function parseDateMaybe(x) {
    const d = new Date(x);
    return isNaN(d.getTime()) ? null : d;
}
function getDocDate(doc) {
    return parseDateMaybe(doc.createdAt) || parseDateMaybe(doc.uploadedAt) || parseDateMaybe(doc.updatedAt) || null;
}
function isProcessed(doc) {
    return doc.status === "PROCESSED" || doc.hasAiResult === true;
}
function isPending(doc) {
    return !isProcessed(doc);
}
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function HomeScreen({ navigation }) {
    const [docs, setDocs] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    const [query, setQuery] = useState("");
    const [tab, setTab] = useState(TABS.INBOX);

    const [selectedDoc, setSelectedDoc] = useState(null);
    const [pinnedIds, setPinnedIds] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await listDocuments();
            setDocs((data || []).filter((d) => d.status !== "DELETED"));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { load(); }, [load]));

    function togglePin(id) {
        setPinnedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }

    function closeMenu() {
        setSelectedDoc(null);
    }

    function openDoc(doc) {
        closeMenu();
        navigation.navigate(doc.hasAiResult ? "Analysis" : "Process", {
            docId: doc.id,
            title: doc.title,
        });
    }

    function confirmDelete(ids) {
        closeMenu();
        Alert.alert("Delete document(s)?", "This action cannot be undone.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    setDocs((d) => d.filter((x) => !ids.includes(x.id)));
                    for (const id of ids) await deleteDocument(id);
                },
            },
        ]);
    }

    const visibleDocs = useMemo(() => {
        let filtered = docs;

        if (tab === TABS.AI_READY) filtered = filtered.filter(isProcessed);
        if (tab === TABS.PENDING) filtered = filtered.filter(isPending);
        if (tab === TABS.PINNED) filtered = filtered.filter((d) => pinnedIds.includes(d.id));

        const q = query.trim().toLowerCase();
        if (q) {
            filtered = filtered.filter((d) => {
                const t = safeStr(d.title).toLowerCase();
                const s = safeStr(d.summary).toLowerCase();
                return t.includes(q) || s.includes(q);
            });
        }

        filtered = [...filtered].sort((a, b) => {
            const ap = pinnedIds.includes(a.id);
            const bp = pinnedIds.includes(b.id);
            if (ap !== bp) return ap ? -1 : 1;

            const ad = getDocDate(a);
            const bd = getDocDate(b);
            if (!ad && !bd) return 0;
            if (!ad) return 1;
            if (!bd) return -1;
            return bd.getTime() - ad.getTime();
        });

        return filtered;
    }, [docs, tab, query, pinnedIds]);

    function highlightText(text) {
        const t = safeStr(text);
        const q = query.trim();
        if (!q) return <Text>{t}</Text>;

        const re = new RegExp(`(${escapeRegExp(q)})`, "ig");
        const parts = t.split(re);

        return (
            <Text>
                {parts.map((p, i) => {
                    const match = p.toLowerCase() === q.toLowerCase();
                    return (
                        <Text key={i} style={match ? S.highlight : null}>
                            {p}
                        </Text>
                    );
                })}
            </Text>
        );
    }

    function renderThumbnail(doc) {
        if (doc.thumbnailUrl) {
            return <Image source={{ uri: doc.thumbnailUrl }} style={S.thumbImg} />;
        }
        return (
            <View style={S.thumb}>
                <Ionicons name={isProcessed(doc) ? "sparkles" : "document-text-outline"} size={18} color={Theme.colors.primary2} />
            </View>
        );
    }

    function renderStatusBadge(doc) {
        if (isProcessed(doc)) {
            return (
                <View style={[S.badge, { backgroundColor: "rgba(34,197,94,0.20)", borderColor: "rgba(34,197,94,0.30)" }]}>
                    <Text style={[S.badgeText, { color: Theme.colors.ok }]}>AI READY</Text>
                </View>
            );
        }

        const status = doc.status || "PENDING";
        const label =
            status === "PROCESSING" ? "PROCESSING" :
                status === "QUEUED" ? "QUEUED" :
                    status === "FAILED" ? "FAILED" :
                        "PENDING";

        const color =
            status === "FAILED" ? Theme.colors.danger :
                Theme.colors.warn;

        return (
            <View style={[S.badge, { backgroundColor: "rgba(245,158,11,0.18)", borderColor: "rgba(245,158,11,0.28)" }]}>
                <Text style={[S.badgeText, { color }]}>{label}</Text>
            </View>
        );
    }

    function renderConfidence(doc) {
        const level = doc.aiConfidence;
        if (!level) return null;

        const map = { HIGH: Theme.colors.ok, MEDIUM: Theme.colors.warn, LOW: Theme.colors.danger };
        const c = map[level] || Theme.colors.muted;

        return (
            <View style={S.conf}>
                <View style={[S.dot, { backgroundColor: c }]} />
                <Text style={S.confText}>{level}</Text>
            </View>
        );
    }

    function renderItem({ item }) {
        const pinned = pinnedIds.includes(item.id);

        return (
            <Card style={S.card}>
                <Pressable onPress={() => openDoc(item)} style={({ pressed }) => pressed && { opacity: 0.93 }}>
                    <View style={[Common.row, { gap: 10 }]}>
                        {renderThumbnail(item)}

                        <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={S.title} numberOfLines={1}>
                                {highlightText(item.title)}
                            </Text>

                            {item.summary ? (
                                <Text style={S.preview} numberOfLines={1}>
                                    {highlightText(item.summary)}
                                </Text>
                            ) : (
                                <Text style={S.previewMuted} numberOfLines={1}>
                                    {isProcessed(item) ? "AI summary ready" : "AI is working…"}
                                </Text>
                            )}

                            <View style={S.metaRow}>
                                {renderStatusBadge(item)}
                                {renderConfidence(item)}
                            </View>
                        </View>

                        {/* Pin (FIX: stopPropagation so it doesn't open the doc) */}
                        <Pressable
                            onPress={(e) => {
                                e?.stopPropagation?.();
                                togglePin(item.id);
                            }}
                            hitSlop={10}
                            style={S.iconBtn}
                        >
                            <Ionicons name={pinned ? "pin" : "pin-outline"} size={18} color={pinned ? Theme.colors.primary2 : Theme.colors.text2} />
                        </Pressable>

                        {/* 3-dot menu (FIX: visible + stopPropagation) */}
                        <Pressable
                            onPress={(e) => {
                                e?.stopPropagation?.();
                                setSelectedDoc(item);
                            }}
                            hitSlop={10}
                            style={S.iconBtn}
                        >
                            <Ionicons name="ellipsis-horizontal" size={18} color={Theme.colors.text} />
                        </Pressable>
                    </View>
                </Pressable>
            </Card>
        );
    }

    const isEmpty = !loading && visibleDocs.length === 0;

    return (
        <GradientScreen>
            <SafeAreaView style={Common.flex1}>
                <View style={Common.screen}>
                    <AiHeader title="Document AI" subtitle="Workspace" />

                    {/* Search */}
                    <View style={S.searchBox}>
                        <Ionicons name="search" size={14} color={Theme.colors.muted} />
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Search"
                            placeholderTextColor={Theme.colors.muted}
                            style={S.searchInput}
                        />
                        {!!query && (
                            <Pressable onPress={() => setQuery("")} hitSlop={10}>
                                <Ionicons name="close-circle" size={18} color={Theme.colors.muted} />
                            </Pressable>
                        )}
                    </View>

                    {/* Tabs */}
                    <View style={S.tabsRow}>
                        <TabPill active={tab === TABS.INBOX} text="Inbox" onPress={() => setTab(TABS.INBOX)} />
                        <TabPill active={tab === TABS.AI_READY} text="AI-ready" onPress={() => setTab(TABS.AI_READY)} />
                        <TabPill active={tab === TABS.PENDING} text="Pending" onPress={() => setTab(TABS.PENDING)} />
                        <TabPill active={tab === TABS.PINNED} text="Pinned" onPress={() => setTab(TABS.PINNED)} />
                    </View>

                    <FlatList
                        data={visibleDocs}
                        keyExtractor={(i) => i.id}
                        renderItem={renderItem}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => {
                                    setRefreshing(true);
                                    load();
                                }}
                                tintColor={Theme.colors.primary2}
                            />
                        }
                        contentContainerStyle={{ paddingBottom: 110 }}
                        ListEmptyComponent={
                            isEmpty ? (
                                <EmptyState
                                    title={tab === TABS.AI_READY ? "No AI-ready docs yet" : tab === TABS.PENDING ? "No pending docs" : "No documents"}
                                    subtitle={tab === TABS.AI_READY ? "Process a document to see results here." : "Upload your first document to get started."}
                                    icon={tab === TABS.AI_READY ? "sparkles-outline" : "document-text-outline"}
                                    onUpload={() => navigation.navigate("Upload")}
                                />
                            ) : null
                        }
                    />
                </View>
            </SafeAreaView>

            {/* Apply Intelligence (RESTORED) */}
            <Pressable onPress={() => navigation.navigate("Upload")} style={S.fab}>
                <Ionicons name="add" size={22} color="#0B1220" />
                <Text style={S.fabText}>Apply Intelligence</Text>
            </Pressable>

            {/* Action Sheet */}
            <Modal visible={!!selectedDoc} transparent animationType="slide" onRequestClose={closeMenu}>
                <Pressable style={S.overlay} onPress={closeMenu} />
                <View style={S.sheet}>
                    <View style={S.sheetTop}>
                        <Text style={S.sheetTitle} numberOfLines={1}>
                            {selectedDoc?.title || "Document"}
                        </Text>
                        <Pressable onPress={closeMenu} hitSlop={10}>
                            <Ionicons name="close" size={22} color="#0B1220" />
                        </Pressable>
                    </View>

                    {selectedDoc?.summary ? (
                        <View style={S.aiPreview}>
                            <Ionicons name="sparkles" size={16} color={Theme.colors.primary} />
                            <Text style={S.aiText} numberOfLines={3}>
                                {selectedDoc.summary}
                            </Text>
                        </View>
                    ) : null}

                    <SheetAction icon="sparkles-outline" text="Open" onPress={() => openDoc(selectedDoc)} />
                    <SheetAction
                        icon="trash-outline"
                        text="Delete"
                        danger
                        onPress={() => confirmDelete([selectedDoc.id])}
                    />
                    <SheetAction icon="close" text="Cancel" onPress={closeMenu} />
                </View>
            </Modal>

            <BottomFade />
        </GradientScreen>
    );
}

function TabPill({ text, active, onPress }) {
    return (
        <Pressable onPress={onPress} style={[S.tab, active && S.tabActive]}>
            <Text style={[S.tabText, active && S.tabTextActive]}>{text}</Text>
        </Pressable>
    );
}

function SheetAction({ icon, text, onPress, danger }) {
    return (
        <Pressable onPress={onPress} style={S.sheetAction}>
            <Ionicons name={icon} size={20} color={danger ? Theme.colors.danger : "#0B1220"} />
            <Text style={[S.sheetText, danger && { color: Theme.colors.danger }]}>{text}</Text>
        </Pressable>
    );
}

function EmptyState({ title, subtitle, icon, onUpload }) {
    return (
        <View style={S.emptyWrap}>
            <View style={S.emptyIcon}>
                <Ionicons name={icon} size={26} color={Theme.colors.primary2} />
            </View>
            <Text style={S.emptyTitle}>{title}</Text>
            <Text style={S.emptySub}>{subtitle}</Text>

            <Pressable onPress={onUpload} style={S.emptyBtn}>
                <Ionicons name="cloud-upload-outline" size={18} color="#0B1220" />
                <Text style={S.emptyBtnText}>Upload & Analyze</Text>
            </Pressable>
        </View>
    );
}
