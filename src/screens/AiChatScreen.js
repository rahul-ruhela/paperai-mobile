/**
 * AiChatScreen — ask questions about one document (spec 1.1).
 *
 * Tier: plus (`ai_chat`). Credits: 1 per message, with the first message of each
 * document free as a hook.
 *
 * The backend endpoints are not live yet — src/api/chat.js runs in stub mode
 * (USE_STUB) so the UI is complete and reviewable now. Credit handling is real
 * either way, so switching the flag needs no changes here.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    View,
    Text,
    TextInput,
    FlatList,
    Pressable,
    Alert,
    Share,
    Animated,
    Easing,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import GradientScreen from "../ui/GradientScreen";
import AiOrb from "../ui/AiOrb";
import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";
import useReduceMotion from "../ui/useReduceMotion";

import { getChatHistory, sendChatMessage, CHAT_FEATURE_KEY, USE_STUB } from "../api/chat";
import {
    getFeatureConfig,
    reserveCredits,
    completeTransaction,
    refundTransaction,
} from "../api/credits";
import { useFeatureAccess } from "../hooks/useFeatureAccess";
import { useCreditBalance } from "../hooks/useCreditBalance";

const MAX_CHARS = 1000;
const COUNTER_FROM = 800;

const SUGGESTIONS = [
    "Summarize this",
    "What are the key dates?",
    "Explain in simple words",
];

export default function AiChatScreen({ navigation, route }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { docId, title } = route.params || {};

    const { allowed, requiredTier, loading: accessLoading } = useFeatureAccess("ai_chat");
    const { credits, refresh: refreshCredits } = useCreditBalance();

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [cfg, setCfg] = useState({ creditCost: 1 });
    // The first message per document is free — the hook that gets people to try it.
    const [freeUsed, setFreeUsed] = useState(false);

    const listRef = useRef(null);

    useEffect(() => {
        let alive = true;
        (async () => {
            try {
                const [history, config] = await Promise.all([
                    getChatHistory(docId).catch(() => []),
                    getFeatureConfig(CHAT_FEATURE_KEY).catch(() => null),
                ]);
                if (!alive) return;
                setMessages(history);
                setFreeUsed(history.some((m) => m.role === "user"));
                if (config) setCfg(config);
            } finally {
                if (alive) setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, [docId]);

    const cost = cfg?.creditCost ?? 1;
    const isFree = !freeUsed;

    const send = useCallback(
        async (text) => {
            const body = (text ?? input).trim();
            if (!body || sending) return;

            setInput("");
            const localId = `local_${Date.now()}`;
            setMessages((m) => [
                ...m,
                { id: localId, role: "user", content: body, createdAt: new Date().toISOString() },
            ]);
            setSending(true);

            // ── Credits (CONTEXT §3). The free first message skips the reserve
            // entirely rather than reserving and refunding — cleaner ledger.
            let txnId = null;
            if (!isFree) {
                try {
                    const r = await reserveCredits(CHAT_FEATURE_KEY, docId, 0);
                    txnId = r.transactionId;
                } catch (e) {
                    setSending(false);
                    setMessages((m) => m.filter((x) => x.id !== localId));
                    setInput(body); // hand the text back so it isn't lost

                    if (e?.response?.status === 402) {
                        const p = e.response?.data;
                        Alert.alert(
                            "Not Enough Credits",
                            `You need ${p?.requiredCredits ?? cost} credit${
                                (p?.requiredCredits ?? cost) === 1 ? "" : "s"
                            } but have ${p?.credits ?? 0}.`,
                            [
                                { text: "Not now", style: "cancel" },
                                { text: "View plans", onPress: () => navigation.navigate("Paywall") },
                            ]
                        );
                    } else {
                        Alert.alert(
                            "Could Not Send",
                            "There was a problem starting this message. Please check your connection and try again."
                        );
                    }
                    return;
                }
            }

            try {
                const res = await sendChatMessage(docId, body, txnId);
                const answer = (res?.answer || "").trim();

                if (!answer) {
                    // Never charge for an empty answer.
                    if (txnId) await refundTransaction(txnId, "Empty answer").catch(() => {});
                    Alert.alert("No Answer", "The assistant couldn't answer that. You were not charged.");
                    return;
                }

                if (txnId) await completeTransaction(txnId).catch(() => {});
                setFreeUsed(true);
                setMessages((m) => [
                    ...m,
                    {
                        id: res.messageId || `a_${Date.now()}`,
                        role: "assistant",
                        content: answer,
                        citations: res.citations || [],
                        createdAt: new Date().toISOString(),
                    },
                ]);
                refreshCredits();
            } catch (err) {
                if (txnId) await refundTransaction(txnId, err?.message || "Send failed").catch(() => {});
                Alert.alert(
                    "Message Failed",
                    err?.userMessage || "Could not get an answer. Your credits were not used."
                );
            } finally {
                setSending(false);
            }
        },
        [input, sending, isFree, docId, cost, navigation, refreshCredits]
    );

    // ── Upsell for users below the required tier ──────────────────────────────
    if (!accessLoading && !allowed) {
        return (
            <GradientScreen>
                <SafeAreaView style={styles.flex}>
                    <Header title={title} navigation={navigation} credits={credits} />
                    <View style={styles.upsell}>
                        <AiOrb size={130} state="idle" />
                        <Text style={styles.upsellTitle}>AI Chat is a {cap(requiredTier)} feature</Text>
                        <Text style={styles.upsellSub}>
                            Ask anything about your documents and get answers drawn straight from
                            their contents.
                        </Text>
                        <Pressable
                            onPress={() => navigation.navigate("Paywall")}
                            style={styles.upsellBtn}
                            accessibilityRole="button"
                        >
                            <Ionicons name="sparkles" size={16} color={theme.colors.white} />
                            <Text style={styles.upsellBtnText}>View plans</Text>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </GradientScreen>
        );
    }

    const over = input.length > MAX_CHARS;

    return (
        <GradientScreen>
            <SafeAreaView style={styles.flex}>
                <Header title={title} navigation={navigation} credits={credits} />

                <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === "ios" ? "padding" : undefined}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
                >
                    {loading ? (
                        <View style={styles.center}>
                            <ActivityIndicator color={theme.colors.primary} />
                        </View>
                    ) : (
                        <FlatList
                            ref={listRef}
                            data={[...messages].reverse()}
                            inverted
                            keyExtractor={(m) => String(m.id)}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={styles.listContent}
                            renderItem={({ item }) => <Bubble message={item} />}
                            ListHeaderComponent={sending ? <TypingBubble /> : null}
                            ListFooterComponent={
                                messages.length === 0 ? (
                                    <EmptyChat onPick={send} isFree={isFree} />
                                ) : null
                            }
                        />
                    )}

                    {/* Composer */}
                    <View style={styles.composer}>
                        <View style={[styles.inputWrap, over && { borderColor: theme.colors.dangerBorder }]}>
                            <TextInput
                                value={input}
                                onChangeText={setInput}
                                placeholder="Ask about this document…"
                                placeholderTextColor={theme.colors.placeholder}
                                keyboardAppearance={theme.keyboardAppearance}
                                multiline
                                style={styles.input}
                                accessibilityLabel="Message input"
                            />
                            {input.length >= COUNTER_FROM && (
                                <Text style={[styles.counter, over && { color: theme.colors.dangerText }]}>
                                    {input.length}/{MAX_CHARS}
                                </Text>
                            )}
                        </View>

                        <Pressable
                            onPress={() => send()}
                            disabled={!input.trim() || sending || over}
                            style={[
                                styles.sendBtn,
                                (!input.trim() || sending || over) && { opacity: 0.45 },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={isFree ? "Send message, free" : `Send message, uses ${cost} credit`}
                        >
                            {sending ? (
                                <ActivityIndicator size="small" color={theme.colors.white} />
                            ) : (
                                <Ionicons name="arrow-up" size={18} color={theme.colors.white} />
                            )}
                        </Pressable>
                    </View>

                    <Text style={styles.costHint}>
                        {isFree
                            ? "First message is free"
                            : `Each message uses ${cost} credit${cost === 1 ? "" : "s"}`}
                        {USE_STUB ? " · demo mode" : ""}
                    </Text>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </GradientScreen>
    );
}

/* ── pieces ──────────────────────────────────────────────────────────────────*/

function Header({ title, navigation, credits }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    return (
        <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
                <Ionicons name="chevron-back" size={24} color={theme.colors.textPrimary} />
            </Pressable>
            <View style={styles.flex1}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                    {title || "Ask AI"}
                </Text>
                <Text style={styles.headerSub}>Answers from this document</Text>
            </View>
            <Pressable
                onPress={() => navigation.navigate("Paywall")}
                style={styles.creditPill}
                accessibilityRole="button"
                accessibilityLabel="Credit balance. Tap to view plans."
            >
                <Ionicons name="flash" size={12} color={theme.colors.accentText} />
                <Text style={styles.creditPillText}>{credits ?? "—"}</Text>
            </Pressable>
        </View>
    );
}

function Bubble({ message }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const mine = message.role === "user";

    function shareText() {
        Share.share({ message: message.content }).catch(() => {});
    }

    if (mine) {
        return (
            <View style={[styles.row, { justifyContent: "flex-end" }]}>
                <View style={styles.userBubble}>
                    <Text style={styles.userText}>{message.content}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.row}>
            <View style={styles.avatar}>
                <AiOrb size={28} state="idle" />
            </View>
            <Pressable
                onLongPress={shareText}
                style={styles.aiBubble}
                accessibilityRole="text"
                accessibilityHint="Long press to share this answer"
            >
                <Text style={styles.aiText}>{message.content}</Text>

                {message.citations?.length > 0 && (
                    <View style={styles.citations}>
                        {message.citations.map((c, i) => (
                            <View key={i} style={styles.citation}>
                                <Ionicons name="document-text-outline" size={11} color={theme.colors.textMuted} />
                                <Text style={styles.citationText} numberOfLines={2}>
                                    {c.text}
                                    {c.page ? ` · p.${c.page}` : ""}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}
            </Pressable>
        </View>
    );
}

/** Three dots that breathe while the answer is in flight. */
function TypingBubble() {
    const styles = useThemedStyles(makeStyles);
    const reduceMotion = useReduceMotion();
    const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];

    useEffect(() => {
        if (reduceMotion) return;
        const loops = dots.map((d, i) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(i * 160),
                    Animated.timing(d, { toValue: 1, duration: 380, easing: Easing.ease, useNativeDriver: true }),
                    Animated.timing(d, { toValue: 0.3, duration: 380, easing: Easing.ease, useNativeDriver: true }),
                ])
            )
        );
        loops.forEach((l) => l.start());
        return () => loops.forEach((l) => l.stop());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reduceMotion]);

    return (
        <View style={styles.row}>
            <View style={styles.avatar}>
                <AiOrb size={28} state="working" />
            </View>
            <View style={[styles.aiBubble, styles.typing]}>
                {dots.map((d, i) => (
                    <Animated.View key={i} style={[styles.dot, { opacity: d }]} />
                ))}
            </View>
        </View>
    );
}

function EmptyChat({ onPick, isFree }) {
    const styles = useThemedStyles(makeStyles);
    return (
        <View style={styles.empty}>
            <AiOrb size={120} state="idle" />
            <Text style={styles.emptyTitle}>Ask anything about this document</Text>
            <Text style={styles.emptySub}>
                {isFree ? "Your first question is free." : "Answers come from the document's contents."}
            </Text>
            <View style={styles.chips}>
                {SUGGESTIONS.map((s) => (
                    <Pressable key={s} onPress={() => onPick(s)} style={styles.chip} accessibilityRole="button">
                        <Text style={styles.chipText}>{s}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
}

function cap(s) {
    return String(s || "").charAt(0).toUpperCase() + String(s || "").slice(1);
}

const makeStyles = (t) =>
    StyleSheet.create({
        flex: { flex: 1 },
        flex1: { flex: 1, minWidth: 0 },
        center: { flex: 1, alignItems: "center", justifyContent: "center" },

        header: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 16,
            paddingVertical: 10,
        },
        headerTitle: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 16 },
        headerSub: { color: t.colors.textMuted, fontWeight: "700", fontSize: 11.5, marginTop: 1 },
        creditPill: {
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.glassSoft,
        },
        creditPillText: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 12 },

        listContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
        row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
        avatar: { width: 28, height: 28 },

        userBubble: {
            maxWidth: "82%",
            backgroundColor: t.colors.primary,
            borderRadius: 18,
            borderBottomRightRadius: 6,
            paddingHorizontal: 14,
            paddingVertical: 10,
        },
        userText: { color: t.colors.white, fontWeight: "600", fontSize: 14.5, lineHeight: 20 },

        aiBubble: {
            flex: 1,
            maxWidth: "86%",
            backgroundColor: t.colors.glassSoft,
            borderWidth: 1,
            borderColor: t.colors.border,
            borderRadius: 18,
            borderBottomLeftRadius: 6,
            paddingHorizontal: 14,
            paddingVertical: 11,
        },
        aiText: { color: t.colors.textPrimary, fontWeight: "500", fontSize: 14.5, lineHeight: 21 },

        typing: { flexDirection: "row", alignItems: "center", gap: 5, flex: 0, paddingVertical: 14 },
        dot: { width: 6, height: 6, borderRadius: 6, backgroundColor: t.colors.textMuted },

        citations: {
            marginTop: 10,
            paddingTop: 9,
            borderTopWidth: 1,
            borderTopColor: t.colors.separator,
            gap: 6,
        },
        citation: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
        citationText: { flex: 1, color: t.colors.textMuted, fontWeight: "600", fontSize: 11, lineHeight: 15 },

        empty: { alignItems: "center", paddingVertical: 30, gap: 8 },
        emptyTitle: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 16, marginTop: 8 },
        emptySub: { color: t.colors.textMuted, fontWeight: "600", fontSize: 12.5, textAlign: "center" },
        chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 12 },
        chip: {
            paddingHorizontal: 13,
            paddingVertical: 9,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.glassSoft,
        },
        chipText: { color: t.colors.textSecondary, fontWeight: "800", fontSize: 12.5 },

        composer: {
            flexDirection: "row",
            alignItems: "flex-end",
            gap: 10,
            paddingHorizontal: 16,
            paddingTop: 8,
        },
        inputWrap: {
            flex: 1,
            borderWidth: 1,
            borderColor: t.colors.inputBorder,
            backgroundColor: t.colors.inputBg,
            borderRadius: 22,
            paddingHorizontal: 15,
            paddingVertical: 10,
        },
        input: {
            color: t.colors.textPrimary,
            fontSize: 14.5,
            fontWeight: "500",
            maxHeight: 120,
            padding: 0,
        },
        counter: { color: t.colors.textMuted, fontWeight: "700", fontSize: 10.5, textAlign: "right", marginTop: 4 },

        sendBtn: {
            width: 42,
            height: 42,
            borderRadius: 42,
            backgroundColor: t.colors.primary,
            alignItems: "center",
            justifyContent: "center",
        },

        costHint: {
            color: t.colors.textMuted,
            fontWeight: "700",
            fontSize: 10.5,
            textAlign: "center",
            paddingVertical: 8,
        },

        upsell: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 10 },
        upsellTitle: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 18, marginTop: 10, textAlign: "center" },
        upsellSub: { color: t.colors.textMuted, fontWeight: "600", fontSize: 13.5, textAlign: "center", lineHeight: 19 },
        upsellBtn: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            marginTop: 14,
            paddingHorizontal: 22,
            paddingVertical: 13,
            borderRadius: 999,
            backgroundColor: t.colors.primary,
        },
        upsellBtnText: { color: t.colors.white, fontWeight: "900", fontSize: 14.5 },
    });
