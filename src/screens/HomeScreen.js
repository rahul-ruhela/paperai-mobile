import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
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
    Animated,
    Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";

import GradientScreen from "../ui/GradientScreen";
import Card from "../ui/Card";
import AiOrb from "../ui/AiOrb";
import BottomFade from "../ui/BottomFade";

import { useLegacyTheme } from "../ui/theme";
import { makeCommon, makeHomeStyles } from "../ui/styles";
import useThemedStyles from "../ui/useThemedStyles";
import { useTheme } from "../ui/ThemeProvider";
import useReduceMotion from "../ui/useReduceMotion";

import { listDocuments, deleteDocument } from "../api/documents";
import { useCreditBalance } from "../hooks/useCreditBalance";
import { useFirstName } from "../hooks/useFirstName";

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
/**
 * Actually in flight on the server right now — not merely "not processed yet".
 *
 * `isPending` covers every document that has no AI result, including ones that
 * were uploaded and never submitted, and ones that failed. Driving the orb off
 * that made the app say "Analyzing…" indefinitely for work nobody had started,
 * which is a claim the app cannot back up.
 */
function isAnalyzing(doc) {
    return doc.status === "QUEUED" || doc.status === "PROCESSING";
}
function greeting() {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
}
function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Only the first screenful is staggered. Past that the delay would be longer
// than the row takes to scroll into view, so later rows just fade straight in —
// and a row re-mounted by FlatList while scrolling back never stalls visibly.
const STAGGER_LIMIT = 8;
const STAGGER_STEP_MS = 55;

/**
 * A list row that rises and fades in on mount.
 *
 * Kept as its own component so each row owns one Animated.Value; hoisting them
 * into HomeScreen would mean re-creating the whole set on every re-render.
 * `reduceMotion` is passed in rather than read here — a hook per row would
 * register one AccessibilityInfo listener per visible document.
 */
function FadeInRow({ index, reduceMotion, children }) {
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (reduceMotion) {
            anim.setValue(1);
            return;
        }
        const a = Animated.timing(anim, {
            toValue: 1,
            duration: 320,
            delay: Math.min(index, STAGGER_LIMIT) * STAGGER_STEP_MS,
            useNativeDriver: true,
        });
        a.start();
        return () => a.stop();
    }, [reduceMotion, index, anim]);

    const style = useMemo(
        () => ({
            opacity: anim,
            transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
            ],
        }),
        [anim]
    );

    return <Animated.View style={style}>{children}</Animated.View>;
}

export default function HomeScreen({ navigation }) {
    const { theme } = useTheme();
    const Theme = useLegacyTheme();
    const Common = useThemedStyles(makeCommon);
    const S = useThemedStyles(makeHomeStyles);
    const [docs, setDocs] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    const [query, setQuery] = useState("");
    const [tab, setTab] = useState(TABS.INBOX);

    const [selectedDoc, setSelectedDoc] = useState(null);
    const [pinnedIds, setPinnedIds] = useState([]);
    const { credits } = useCreditBalance();
    const firstName = useFirstName();

    // Search field + tab pills settle in just ahead of the first rows, so the
    // screen assembles top-down instead of appearing all at once.
    const reduceMotion = useReduceMotion();
    const chrome = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (reduceMotion) {
            chrome.setValue(1);
            return;
        }
        const a = Animated.timing(chrome, { toValue: 1, duration: 380, useNativeDriver: true });
        a.start();
        return () => a.stop();
    }, [reduceMotion, chrome]);

    // Memoized: the search field re-renders this screen on every keystroke, and
    // a new interpolation node each time would rebuild the native animated node.
    const chromeEnter = useMemo(
        () => ({
            opacity: chrome,
            transform: [
                { translateY: chrome.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
            ],
        }),
        [chrome]
    );

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

    // Counts come off the full document set, not the filtered view — the strip
    // reports the library, so it must not change as the user types a search.
    const counts = useMemo(
        () => ({
            total: docs.length,
            ready: docs.filter(isProcessed).length,
            pending: docs.filter(isPending).length,
            analyzing: docs.filter(isAnalyzing).length,
        }),
        [docs]
    );

    // The search field re-renders this screen on every keystroke and the orb
    // sits in the same header, so its element is memoized on the only inputs it
    // actually depends on. Without this every character re-renders an animated
    // subtree of a dozen driven nodes.
    //
    // The orb only claims to be working when something really is queued or
    // processing on the server. Anything else — including documents sitting
    // un-analysed — is the idle, invitational state.
    const orb = useMemo(
        () => (
            <AiOrb
                size={132}
                state={counts.analyzing > 0 ? "working" : "idle"}
                onPress={() => navigation.navigate("Upload")}
                label={counts.analyzing > 0 ? "Analyzing…" : "Tap to analyze"}
                sublabel={
                    counts.analyzing > 0
                        ? `${counts.analyzing} ${counts.analyzing === 1 ? "document" : "documents"} being analyzed`
                        : "Scan, upload or sign a document"
                }
                style={S.orb}
            />
        ),
        [counts.analyzing, navigation, S.orb]
    );

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

    function renderItem({ item, index }) {
        const pinned = pinnedIds.includes(item.id);

        return (
            <FadeInRow index={index} reduceMotion={reduceMotion}>
                <Card style={S.card}>
                    <Pressable
                        onPress={() => openDoc(item)}
                        style={({ pressed }) => pressed && { opacity: 0.93, transform: [{ scale: 0.985 }] }}
                    >
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
            </FadeInRow>
        );
    }

    const isEmpty = !loading && visibleDocs.length === 0;

    return (
        <GradientScreen>
            <SafeAreaView style={Common.flex1}>
                <View style={Common.screen}>
                    <FlatList
                        data={visibleDocs}
                        keyExtractor={(i) => i.id}
                        renderItem={renderItem}
                        // C3 (performance-optimization-plan.md). Without these RN
                        // mounts far more rows than a screen shows. No
                        // getItemLayout: these rows have a variable height, and a
                        // wrong constant there causes scroll jumps that are worse
                        // than the measurement it saves.
                        initialNumToRender={8}
                        maxToRenderPerBatch={8}
                        windowSize={7}
                        removeClippedSubviews={Platform.OS === "android"}
                        // A React *element*, not a component function: passing a
                        // function defined inline would remount the header on
                        // every render and the search field would lose focus on
                        // each keystroke.
                        ListHeaderComponent={
                            <Animated.View style={[S.headerWrap, chromeEnter]}>
                                {/* Greeting + credit pill */}
                                <View style={S.greetRow}>
                                    <View style={{ flex: 1, minWidth: 0 }}>
                                        {/* The name is the greeting when we have
                                            one: "Good evening" / "Rahul". Until
                                            the profile lands — or when the user
                                            never set a name — it falls back to
                                            the app name rather than greeting an
                                            empty line. */}
                                        <Text style={S.greetHi}>{greeting()}</Text>
                                        <Text style={S.greetSub}>{firstName || "Paper AI Assistant"}</Text>
                                    </View>
                                    <Pressable
                                        onPress={() => navigation.navigate("Paywall")}
                                        style={S.creditPill}
                                        accessibilityRole="button"
                                        accessibilityLabel="Credits. Tap to view plans."
                                    >
                                        <Ionicons name="flash" size={13} color={Theme.colors.primary2} />
                                        <Text style={S.creditPillText}>{credits ?? "—"}</Text>
                                    </Pressable>
                                </View>

                                {/* The orb — tap to start */}
                                {orb}

                                {/* Quick actions */}
                                <View style={S.quickRow}>
                                    <QuickTile icon="camera-outline" label="Scan" onPress={() => navigation.navigate("CameraScanner")} />
                                    <QuickTile icon="create-outline" label="Sign" onPress={() => navigation.navigate("Signature")} />
                                    <QuickTile icon="receipt-outline" label="Receipt" onPress={() => navigation.navigate("ReceiptCapture")} />
                                    <QuickTile icon="qr-code-outline" label="Code" onPress={() => navigation.navigate("CodeScanner")} />
                                </View>

                                {/* Live stat strip */}
                                <View style={S.statStrip}>
                                    <StatCell value={counts.total} label="Documents" />
                                    <View style={S.statDivider} />
                                    <StatCell value={counts.ready} label="AI-ready" />
                                    <View style={S.statDivider} />
                                    <StatCell value={counts.pending} label="Pending" />
                                </View>

                                {/* Search */}
                                <View style={S.searchBox}>
                                    <Ionicons name="search" size={14} color={Theme.colors.muted} />
                                    <TextInput
                                        value={query}
                                        onChangeText={setQuery}
                                        placeholder="Search"
                                        placeholderTextColor={Theme.colors.muted}
                                        keyboardAppearance={theme.keyboardAppearance}
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
                            </Animated.View>
                        }
                        keyboardShouldPersistTaps="handled"
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
            <IntelligenceFab onPress={() => navigation.navigate("Upload")} />

            {/* Action Sheet */}
            <Modal visible={!!selectedDoc} transparent animationType="slide" onRequestClose={closeMenu}>
                <Pressable style={S.overlay} onPress={closeMenu} />
                <View style={S.sheet}>
                    <View style={S.sheetTop}>
                        <Text style={S.sheetTitle} numberOfLines={1}>
                            {selectedDoc?.title || "Document"}
                        </Text>
                        <Pressable onPress={closeMenu} hitSlop={10}>
                            <Ionicons name="close" size={22} color={Theme.colors.text} />
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

/**
 * The primary action. Springs up once the list has settled, and dips under the
 * finger on press. Scale only — the hit box never moves under the user's thumb.
 */
function IntelligenceFab({ onPress }) {
    const S = useThemedStyles(makeHomeStyles);
    const reduceMotion = useReduceMotion();
    const enter = useRef(new Animated.Value(0)).current;
    const press = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        if (reduceMotion) {
            enter.setValue(1);
            return;
        }
        const a = Animated.spring(enter, {
            toValue: 1,
            delay: 260,
            useNativeDriver: true,
            friction: 6,
            tension: 70,
        });
        a.start();
        return () => a.stop();
    }, [reduceMotion, enter]);

    const pressIn = () =>
        Animated.spring(press, { toValue: 0.94, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
    const pressOut = () =>
        Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 8 }).start();

    return (
        <Animated.View
            style={[
                S.fab,
                {
                    opacity: enter,
                    transform: [
                        { scale: Animated.multiply(enter, press) },
                        {
                            translateY: enter.interpolate({
                                inputRange: [0, 1],
                                outputRange: [18, 0],
                            }),
                        },
                    ],
                },
            ]}
        >
            <Pressable
                onPress={onPress}
                onPressIn={pressIn}
                onPressOut={pressOut}
                style={S.fabPressable}
                accessibilityRole="button"
                accessibilityLabel="Apply Intelligence"
            >
                <Ionicons name="add" size={22} color="#FFFFFF" />
                <Text style={S.fabText} numberOfLines={1}>
                    Apply Intelligence
                </Text>
            </Pressable>
        </Animated.View>
    );
}

function TabPill({ text, active, onPress }) {
    const S = useThemedStyles(makeHomeStyles);
    return (
        <Pressable onPress={onPress} style={[S.tab, active && S.tabActive]}>
            <Text style={[S.tabText, active && S.tabTextActive]}>{text}</Text>
        </Pressable>
    );
}

function QuickTile({ icon, label, onPress }) {
    const Theme = useLegacyTheme();
    const S = useThemedStyles(makeHomeStyles);
    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => [S.quickTile, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}
        >
            <View style={S.quickIcon}>
                <Ionicons name={icon} size={19} color={Theme.colors.primary2} />
            </View>
            <Text style={S.quickLabel} numberOfLines={1}>
                {label}
            </Text>
        </Pressable>
    );
}

function StatCell({ value, label }) {
    const S = useThemedStyles(makeHomeStyles);
    return (
        <View style={S.statCell}>
            <Text style={S.statValue}>{value}</Text>
            <Text style={S.statLabel}>{label}</Text>
        </View>
    );
}

function SheetAction({ icon, text, onPress, danger }) {
    const Theme = useLegacyTheme();
    const S = useThemedStyles(makeHomeStyles);
    return (
        <Pressable onPress={onPress} style={S.sheetAction}>
            <Ionicons name={icon} size={20} color={danger ? Theme.colors.danger : Theme.colors.text} />
            <Text style={[S.sheetText, danger && { color: Theme.colors.danger }]}>{text}</Text>
        </Pressable>
    );
}

function EmptyState({ title, subtitle, icon, onUpload }) {
    const Theme = useLegacyTheme();
    const S = useThemedStyles(makeHomeStyles);
    const reduceMotion = useReduceMotion();
    const float = useRef(new Animated.Value(0)).current;
    const fade = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (reduceMotion) {
            float.setValue(0);
            fade.setValue(1);
            return;
        }
        const fadeIn = Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true });
        const drift = Animated.loop(
            Animated.sequence([
                Animated.timing(float, { toValue: -7, duration: 1700, useNativeDriver: true }),
                Animated.timing(float, { toValue: 0, duration: 1700, useNativeDriver: true }),
            ])
        );
        fadeIn.start();
        drift.start();
        return () => {
            fadeIn.stop();
            drift.stop();
        };
    }, [reduceMotion, float, fade]);

    return (
        <Animated.View style={[S.emptyWrap, { opacity: fade }]}>
            <Animated.View style={[S.emptyIcon, { transform: [{ translateY: float }] }]}>
                <Ionicons name={icon} size={26} color={Theme.colors.primary2} />
            </Animated.View>
            <Text style={S.emptyTitle}>{title}</Text>
            <Text style={S.emptySub}>{subtitle}</Text>

            <Pressable onPress={onUpload} style={S.emptyBtn}>
                <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />
                <Text style={S.emptyBtnText}>Upload & Analyze</Text>
            </Pressable>
        </Animated.View>
    );
}
