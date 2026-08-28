import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import GradientScreen from "../ui/GradientScreen";
import useThemedStyles from "../ui/useThemedStyles";
import { useTheme } from "../ui/ThemeProvider";
import { showEntitlementDenial } from "../ui/FeatureLock";
import { useUpgradePrompt } from "../ui/FeatureLock";

import {
    deleteMemory,
    forgetAllMemories,
    getRecallPreferences,
    listMemories,
    restoreMemory,
    updateRecallPreferences,
} from "../api/recall";

/**
 * MemoriesScreen — "What Paper AI remembers" (Module 6, §6).
 *
 * Everything Smart Recall has stored, plus every control for getting rid of it.
 * The controls are the point: a feature that quietly extracts statements from a
 * user's own documents has to be trivially switchable and trivially erasable, or
 * it should not exist.
 *
 * Three deliberate details:
 *
 *   • The master switch and the delete controls stay usable when the user is
 *     BELOW Advance. Someone whose plan lapsed must never be locked out of
 *     turning the feature off or deleting what it kept. Only turning it back ON
 *     needs the tier, and that is enforced server-side.
 *   • Deleting one memory is a soft delete with a visible undo, because the list
 *     is the only place these are shown and a mis-tap would otherwise be silent
 *     and permanent.
 *   • "Forget everything" requires typing the word. It is a hard delete with no
 *     undo, and a destructive-styled button alone is not enough friction for a
 *     control that erases the lot.
 */

const KIND_ICON = {
    bring_item: "bag-handle-outline",
    deadline: "time-outline",
    contact: "call-outline",
    location: "location-outline",
    amount: "cash-outline",
    note: "document-text-outline",
};

const KIND_LABEL = {
    bring_item: "Bring",
    deadline: "Deadline",
    contact: "Contact",
    location: "Place",
    amount: "Amount",
    note: "Note",
};

const CONFIRM_WORD = "FORGET";

export default function MemoriesScreen({ navigation }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { prompt: promptUpgrade } = useUpgradePrompt("smart_recall", navigation);

    const [loading, setLoading] = useState(true);
    const [prefs, setPrefs] = useState(null);
    const [memories, setMemories] = useState([]);
    const [undo, setUndo] = useState(null); // { id, content }
    const [confirmText, setConfirmText] = useState("");
    const [showConfirm, setShowConfirm] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const preferences = await getRecallPreferences();
            setPrefs(preferences);
            // The list is Advance-only; the preferences are not. A lapsed user
            // still sees the switch and the delete controls, just no list.
            setMemories(preferences.available ? await listMemories().catch(() => []) : []);
        } catch {
            setPrefs(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    async function toggleEnabled(next) {
        // Optimistic, then reconciled: the switch should not lag behind the tap.
        setPrefs((p) => ({ ...p, enabled: next }));
        try {
            const updated = await updateRecallPreferences({ enabled: next });
            setPrefs((p) => ({ ...p, ...updated }));
            if (next) load();
        } catch (err) {
            setPrefs((p) => ({ ...p, enabled: !next }));
            if (!showEntitlementDenial(err, navigation, "smart_recall")) {
                Alert.alert("Could not save", "That change was not saved. Please try again.");
            }
        }
    }

    async function toggleHideDetails(next) {
        setPrefs((p) => ({ ...p, hideDetailsOnLockScreen: next }));
        try {
            await updateRecallPreferences({ hideDetailsOnLockScreen: next });
        } catch {
            setPrefs((p) => ({ ...p, hideDetailsOnLockScreen: !next }));
        }
    }

    async function remove(memory) {
        setMemories((all) => all.filter((m) => m.id !== memory.id));
        setUndo({ id: memory.id, content: memory.content });
        try {
            await deleteMemory(memory.id);
        } catch (err) {
            setMemories((all) => [memory, ...all]);
            setUndo(null);
            if (!showEntitlementDenial(err, navigation, "smart_recall")) {
                Alert.alert("Could not delete", "That memory is still there. Please try again.");
            }
        }
    }

    async function undoRemove() {
        if (!undo) return;
        try {
            await restoreMemory(undo.id);
        } catch {
            Alert.alert("Could not undo", "That memory could not be brought back.");
        } finally {
            setUndo(null);
            load();
        }
    }

    async function forgetEverything() {
        try {
            const { forgotten } = await forgetAllMemories();
            setMemories([]);
            setShowConfirm(false);
            setConfirmText("");
            Alert.alert(
                "Forgotten",
                `${forgotten} ${forgotten === 1 ? "memory has" : "memories have"} been deleted. Your tasks and documents are untouched.`
            );
            load();
        } catch (err) {
            if (!showEntitlementDenial(err, navigation, "smart_recall")) {
                Alert.alert("Could not delete", "Nothing was deleted. Please try again.");
            }
        }
    }

    if (loading) {
        return (
            <GradientScreen>
                <View style={styles.centre}>
                    <ActivityIndicator color={theme.colors.primary} />
                </View>
            </GradientScreen>
        );
    }

    const available = prefs?.available ?? false;
    const enabled = prefs?.enabled ?? false;

    return (
        <GradientScreen>
            <SafeAreaView style={styles.safe} edges={["bottom"]}>
                <FlatList
                    data={enabled ? memories : []}
                    keyExtractor={(m) => m.id}
                    contentContainerStyle={styles.list}
                    ListHeaderComponent={
                        <View style={styles.headerBlock}>
                            <View style={styles.card}>
                                <Text style={styles.section}>Smart Recall</Text>
                                <Text style={styles.hint}>
                                    When you write a note on a task, Paper AI pulls the useful
                                    parts out of it and brings them back when the task is due. It
                                    only ever repeats what you wrote — it does not look anything up
                                    and it does not guess.
                                </Text>

                                <View style={styles.switchRow}>
                                    <View style={styles.switchText}>
                                        <Text style={styles.switchLabel}>Remember my notes</Text>
                                        <Text style={styles.hint}>
                                            {available
                                                ? "Off means nothing new is read or stored."
                                                : "Smart Recall is part of Advance. You can still turn it off and delete anything already stored."}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={enabled}
                                        onValueChange={(next) => {
                                            if (next && !available) {
                                                promptUpgrade();
                                                return;
                                            }
                                            toggleEnabled(next);
                                        }}
                                    />
                                </View>

                                <View style={styles.switchRow}>
                                    <View style={styles.switchText}>
                                        <Text style={styles.switchLabel}>
                                            Hide details on the lock screen
                                        </Text>
                                        <Text style={styles.hint}>
                                            On, a reminder shows only the task name. Off, it can
                                            show what you asked to be reminded of — which anyone
                                            holding your phone can read.
                                        </Text>
                                    </View>
                                    <Switch
                                        value={prefs?.hideDetailsOnLockScreen ?? true}
                                        onValueChange={toggleHideDetails}
                                    />
                                </View>
                            </View>

                            {undo ? (
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={undoRemove}
                                    style={styles.undo}
                                >
                                    <Ionicons
                                        name="arrow-undo-outline"
                                        size={16}
                                        color={theme.colors.accentText}
                                    />
                                    <Text style={styles.undoText}>
                                        Deleted. Tap to undo.
                                    </Text>
                                </Pressable>
                            ) : null}

                            {enabled && memories.length > 0 ? (
                                <Text style={styles.section}>What Paper AI remembers</Text>
                            ) : null}
                        </View>
                    }
                    renderItem={({ item }) => (
                        <View style={styles.row}>
                            <Ionicons
                                name={KIND_ICON[item.kind] ?? KIND_ICON.note}
                                size={17}
                                color={theme.colors.accentText}
                            />
                            <View style={styles.rowText}>
                                {/* Rendered as plain text, never as markup: this
                                    is model output derived from user content and
                                    is treated as untrusted (§7). */}
                                <Text style={styles.rowContent}>{item.content}</Text>
                                <Text style={styles.rowMeta}>
                                    {KIND_LABEL[item.kind] ?? "Note"} · from your{" "}
                                    {item.sourceType === "task" ? "task" : "document"}
                                    {item.confidence < 0.6 ? " · not used in reminders" : ""}
                                </Text>
                            </View>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel="Forget this"
                                onPress={() => remove(item)}
                                style={styles.rowDelete}
                            >
                                <Ionicons name="close" size={18} color={theme.colors.textMuted} />
                            </Pressable>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.card}>
                            <Text style={styles.hint}>
                                {!enabled
                                    ? "Smart Recall is off, so nothing is being remembered."
                                    : "Nothing remembered yet. Add a note to a task and Paper AI will pick out the useful parts."}
                            </Text>
                        </View>
                    }
                    ListFooterComponent={
                        <View style={styles.card}>
                            <Text style={styles.section}>Forget everything</Text>
                            <Text style={styles.hint}>
                                Deletes every memory Paper AI has stored, permanently and with no
                                undo. Your tasks and documents are not touched.
                            </Text>
                            {showConfirm ? (
                                <>
                                    <Text style={styles.hint}>
                                        Type {CONFIRM_WORD} to confirm.
                                    </Text>
                                    <TextInput
                                        value={confirmText}
                                        onChangeText={setConfirmText}
                                        autoCapitalize="characters"
                                        autoCorrect={false}
                                        style={styles.input}
                                        accessibilityLabel={`Type ${CONFIRM_WORD} to confirm`}
                                    />
                                    <Pressable
                                        accessibilityRole="button"
                                        disabled={confirmText.trim().toUpperCase() !== CONFIRM_WORD}
                                        onPress={forgetEverything}
                                        style={[
                                            styles.destructive,
                                            confirmText.trim().toUpperCase() !== CONFIRM_WORD &&
                                                styles.destructiveDisabled,
                                        ]}
                                    >
                                        <Text style={styles.destructiveText}>
                                            Delete every memory
                                        </Text>
                                    </Pressable>
                                </>
                            ) : (
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={() => setShowConfirm(true)}
                                    style={styles.destructive}
                                >
                                    <Text style={styles.destructiveText}>Forget everything</Text>
                                </Pressable>
                            )}
                        </View>
                    }
                />
            </SafeAreaView>
        </GradientScreen>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        safe: { flex: 1 },
        centre: { flex: 1, alignItems: "center", justifyContent: "center" },
        list: { padding: 18, paddingBottom: 60, gap: 12 },
        headerBlock: { gap: 12, marginBottom: 4 },

        card: {
            backgroundColor: t.colors.glass,
            borderWidth: 1,
            borderColor: t.colors.glassBorder,
            borderRadius: 20,
            padding: 14,
            gap: 10,
        },
        section: {
            color: t.colors.textMuted,
            fontSize: 15,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 0.4,
        },
        hint: { color: t.colors.textMuted, fontSize: 12, fontWeight: "500", lineHeight: 17 },

        switchRow: {
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingTop: 10,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
        },
        switchText: { flex: 1, gap: 3 },
        switchLabel: { color: t.colors.textPrimary, fontWeight: "800", fontSize: 14 },

        undo: {
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            minHeight: 44,
            paddingHorizontal: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: t.colors.infoBorder,
            backgroundColor: t.colors.infoBg,
        },
        undoText: { color: t.colors.accentText, fontWeight: "700", fontSize: 13 },

        row: {
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 11,
            padding: 12,
            borderRadius: 14,
            backgroundColor: t.colors.glass,
            borderWidth: 1,
            borderColor: t.colors.glassBorder,
        },
        rowText: { flex: 1, gap: 3 },
        rowContent: { color: t.colors.textPrimary, fontSize: 14, fontWeight: "600", lineHeight: 19 },
        rowMeta: { color: t.colors.textMuted, fontSize: 11, fontWeight: "600" },
        rowDelete: { minHeight: 40, minWidth: 36, alignItems: "flex-end" },

        input: {
            borderWidth: 1,
            borderColor: t.colors.border,
            borderRadius: 12,
            paddingHorizontal: 12,
            minHeight: 44,
            color: t.colors.textPrimary,
            fontWeight: "700",
        },
        destructive: { minHeight: 44, justifyContent: "center" },
        destructiveDisabled: { opacity: 0.4 },
        destructiveText: { color: t.colors.danger, fontWeight: "800", fontSize: 13 },
    });
