import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    View,
    Text,
    TextInput,
    FlatList,
    Alert,
    Pressable,
    Modal,
    StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import GradientScreen from "../ui/GradientScreen";
import Card from "../ui/Card";
import AppButton from "../ui/AppButton";
import AiHeader from "../ui/AiHeader";
import SegmentedTabs from "../ui/SegmentedTabs";
import TaskCard from "../ui/TaskCard";
import TaskEditorSheet from "../ui/TaskEditorSheet";

import { useLegacyTheme } from "../ui/theme";
import { makeCommon, makeTaskStyles } from "../ui/styles";
import useThemedStyles from "../ui/useThemedStyles";
import { useTheme } from "../ui/ThemeProvider";

import { listTasks, createTask, completeTask, updateTask, deleteTask, snoozeTask } from "../api/tasks";
import {
    groupedReminders,
    cancelReminder,
    snoozeReminder,
    scheduleTaskAlert,
    cancelTaskAlert,
    taskAlertMap,
    formatDate,
    SNOOZE_OPTIONS,
} from "../services/reminderService";
import { useFeatureAccess } from "../hooks/useFeatureAccess";
import { speakTask, stopSpeaking } from "../services/taskSpeech";

/**
 * AssistantScreen — the Assistant tab.
 *
 * Two views over ONE task system (`/api/tasks`):
 *   AI Tasks  — generated from documents (isAiSuggested === true)
 *   My Tasks  — created by the user
 *
 * The list is fetched once and partitioned here rather than fetching per tab:
 * switching tabs is then instant and costs no request. The server's ?source
 * filter still exists for callers that want one side only.
 *
 * Document reminders (created over on the Analysis screen) keep their own
 * section below the tabs, exactly as they appeared on the old Tasks screen.
 */

const TAB_AI = "ai";
const TAB_MINE = "mine";
const TAB_REMINDERS = "reminders";

// How long a loaded list stays fresh. Re-fetching on every tab focus made four
// tab switches cost four full loads; this keeps the list warm and still picks up
// tasks created elsewhere.
const STALE_AFTER_MS = 60_000;

const EMPTY_STATES = {
    [TAB_MINE]: {
        icon: "checkbox-outline",
        title: "No tasks yet",
        body: "Add a task above, or use “Add with details” for a due date and priority.",
    },
    [TAB_AI]: {
        icon: "sparkles-outline",
        title: "No AI tasks yet",
        body: "Analyse a document and Paper AI will suggest the actions it finds.",
    },
    [TAB_REMINDERS]: {
        icon: "alarm-outline",
        title: "No document reminders",
        body: "Open a document and set a reminder — it will show up here.",
    },
};

const makeStyles = (t) =>
    StyleSheet.create({
        empty: { marginTop: 44, alignItems: "center", paddingHorizontal: 24 },
        emptyTitle: { marginTop: 10, color: t.colors.textPrimary, fontWeight: "900", fontSize: 16 },
        emptyBody: {
            marginTop: 6,
            color: t.colors.textMuted,
            fontWeight: "700",
            fontSize: 13,
            textAlign: "center",
            lineHeight: 19,
        },
    });

export default function AssistantScreen({ navigation }) {
    const { theme } = useTheme();
    const Theme = useLegacyTheme();
    const Common = useThemedStyles(makeCommon);
    const S = useThemedStyles(makeTaskStyles);
    const styles = useThemedStyles(makeStyles);

    const [tab, setTab] = useState(TAB_MINE);
    const [tasks, setTasks] = useState([]);
    const [alerts, setAlerts] = useState({});
    const [title, setTitle] = useState("");
    const [expandedId, setExpandedId] = useState(null);

    const [editor, setEditor] = useState({ visible: false, task: null });
    const [saving, setSaving] = useState(false);

    // id of the task being read aloud, so exactly one card shows a stop icon.
    const [speakingId, setSpeakingId] = useState(null);

    const [reminders, setReminders] = useState({ upcoming: [], past: [] });
    const [showPast, setShowPast] = useState(false);
    // { kind: "reminder" | "task", item } — one sheet serves both.
    const [snoozing, setSnoozing] = useState(null);

    const loadedAt = useRef(0);

    // Per-tab scroll offset (spec §8.7).
    //
    // One FlatList serves all three tabs, so swapping `data` leaves the single
    // scroll offset untouched: scrolling deep into AI Tasks and switching to My
    // Tasks landed you in the middle of a list you had never scrolled. The
    // offsets are kept per tab and restored on switch.
    //
    // A ref, not state: these change on every scroll frame and must never
    // trigger a re-render of the list they describe.
    const listRef = useRef(null);
    const scrollOffsets = useRef({});
    // Set while a restore is in flight, so the programmatic scroll — and the
    // clamped offset the list reports mid-swap — cannot overwrite the value we
    // are on our way to restoring.
    const restoringScroll = useRef(false);

    // Custom dates, repeat and snooze are Advance-tier; the controls stay visible
    // and prompt instead of vanishing.
    const { allowed: advanced } = useFeatureAccess("advanced_reminders");

    const load = useCallback(async () => {
        try {
            const [data, alertMap] = await Promise.all([listTasks(), taskAlertMap()]);
            setTasks(Array.isArray(data) ? data : []);
            setAlerts(alertMap);
            loadedAt.current = Date.now();
        } catch (e) {
            Alert.alert("Could not load tasks", e?.userMessage || e?.message || "Please try again.");
        }
    }, []);

    const loadReminders = useCallback(async () => {
        setReminders(await groupedReminders());
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    // On focus, not on mount: reminders are created over on the Analysis screen,
    // and this tab stays mounted the whole session — a mount-only load would show
    // a stale list until the app restarted. Tasks refresh only once they are
    // stale, so tab switching stays instant.
    useFocusEffect(
        useCallback(() => {
            loadReminders();
            if (Date.now() - loadedAt.current > STALE_AFTER_MS) load();

            // Navigating away mid-sentence must not leave the phone talking to
            // a screen nobody is looking at.
            return () => {
                stopSpeaking();
                setSpeakingId(null);
            };
        }, [loadReminders, load])
    );

    // Restore this tab's offset once the swapped-in rows have been laid out.
    // A frame later, not synchronously: at switch time the list still holds the
    // outgoing tab's content height, and scrolling against that gets clamped.
    useEffect(() => {
        restoringScroll.current = true;
        const offset = scrollOffsets.current[tab] ?? 0;

        const frame = requestAnimationFrame(() => {
            // A shorter list clamps the offset itself, which is the right
            // behaviour — the tab simply lands at its own end.
            listRef.current?.scrollToOffset({ offset, animated: false });
            restoringScroll.current = false;
        });

        return () => {
            cancelAnimationFrame(frame);
            restoringScroll.current = false;
        };
    }, [tab]);

    const { aiTasks, myTasks, doneToday } = useMemo(() => {
        const ai = [];
        const mine = [];
        let done = 0;

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        for (const task of tasks) {
            (task.isAiSuggested === true ? ai : mine).push(task);

            if (task.completedAt && new Date(task.completedAt).getTime() >= startOfToday.getTime()) {
                done += 1;
            }
        }

        return { aiTasks: ai, myTasks: mine, doneToday: done };
    }, [tasks]);

    // The reminders tab renders through ListHeaderComponent, so its task list
    // is deliberately empty.
    const visibleTasks = tab === TAB_AI ? aiTasks : tab === TAB_MINE ? myTasks : [];
    const reminderCount = reminders.upcoming.length + reminders.past.length;

    function requireAdvanced(what) {
        Alert.alert(
            "Advance Plan Feature",
            `${what} is part of the Advance plan. You can still create, edit and complete tasks on your current plan.`,
            [
                { text: "Not now", style: "cancel" },
                { text: "View plans", onPress: () => navigation?.navigate("Paywall") },
            ]
        );
    }

    /* ── tasks ──────────────────────────────────────────────────────────────*/

    async function quickAdd() {
        const clean = title.trim();
        if (!clean) return;

        try {
            setTitle("");
            await createTask(clean, null);
            await load();
        } catch (e) {
            setTitle(clean);
            Alert.alert("Create task failed", e?.userMessage || e?.message || "Please try again.");
        }
    }

    const toggleDone = useCallback(
        async (task) => {
            const completing = task.status !== "DONE";

            try {
                const result = await completeTask(task.id, completing);
                // A completed task must not still buzz. Reopening does not restore
                // the alert: the due time has usually passed by then, and a silent
                // reschedule behind the user's back is worse than none.
                if (completing) await cancelTaskAlert(task.id);

                // Completing a repeating task makes the server create the next
                // occurrence and hand it back as `next`. Its alert has to be
                // scheduled here, because the notification is local: without this
                // a WEEKLY task fired once and then went silent for ever, which
                // looked like the repeat itself was broken.
                const next = result?.next;
                if (next?.id && next?.dueAtUtc) {
                    const scheduled = await scheduleTaskAlert({
                        taskId: next.id,
                        title: next.title,
                        description: next.description,
                        dueAtUtc: next.dueAtUtc,
                    });
                    // `past` only means the next occurrence is already overdue —
                    // not worth interrupting a tick-the-box gesture with an alert.
                    if (scheduled && !scheduled.error) {
                        setAlerts((map) => ({ ...map, [next.id]: scheduled }));
                    }
                }

                await load();
            } catch (e) {
                Alert.alert("Update task failed", e?.userMessage || e?.message || "Please try again.");
            }
        },
        [load]
    );

    const confirmDelete = useCallback(
        (task) => {
            Alert.alert("Delete task?", `"${task.title}" will be removed.`, [
                { text: "Keep", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        // Optimistic: the row disappears at once and comes back if
                        // the request fails, so a flaky network cannot silently
                        // lose a task.
                        const previous = tasks;
                        setTasks((list) => list.filter((t) => t.id !== task.id));

                        try {
                            await deleteTask(task.id);
                            await cancelTaskAlert(task.id);
                            setAlerts((map) => {
                                const next = { ...map };
                                delete next[task.id];
                                return next;
                            });
                        } catch (e) {
                            setTasks(previous);
                            Alert.alert("Delete failed", e?.userMessage || e?.message || "Please try again.");
                        }
                    },
                },
            ]);
        },
        [tasks]
    );

    const openActions = useCallback(
        (task) => {
            const buttons = [
                { text: "Edit", onPress: () => setEditor({ visible: true, task }) },
                {
                    text: "Snooze reminder",
                    onPress: () => {
                        if (!advanced) return requireAdvanced("Snoozing a task");
                        if (!task.dueAtUtc) {
                            Alert.alert("No due date", "Give this task a due date first, then you can snooze it.");
                            return;
                        }
                        setSnoozing({ kind: "task", item: task });
                    },
                },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: () => confirmDelete(task),
                },
                { text: "Cancel", style: "cancel" },
            ];

            Alert.alert(task.title, task.description || undefined, buttons);
        },
        [advanced, confirmDelete]
    );

    const toggleWhy = useCallback((task) => {
        setExpandedId((current) => (current === task.id ? null : task.id));
    }, []);

    // Tapping the row opens the editor. The "..." menu still offers Edit, but a
    // task row that does nothing when tapped reads as a broken list.
    const openTask = useCallback((task) => {
        setEditor({ visible: true, task });
    }, []);

    /**
     * Reads a task aloud, or stops if that task is already being read.
     * On-device TTS: no request, no credits, so it is not gated by plan.
     */
    const speak = useCallback(
        async (task) => {
            if (speakingId === task.id) {
                await stopSpeaking();
                setSpeakingId(null);
                return;
            }

            setSpeakingId(task.id);
            const { spoken } = await speakTask(task, {
                // Fires on finish, stop and error alike, so the icon can never
                // stay stuck showing "playing".
                onDone: () => setSpeakingId((current) => (current === task.id ? null : current)),
            });
            if (!spoken) setSpeakingId(null);
        },
        [speakingId]
    );

    async function saveTask(fields) {
        setSaving(true);
        try {
            const existing = editor.task;
            let saved;

            if (existing) {
                const patch = {
                    title: fields.title,
                    description: fields.description,
                    priority: fields.priority,
                    repeat: fields.repeat,
                };
                if (fields.clearDueAt) {
                    patch.clearDueAt = true;
                } else if (fields.dueAtUtc) {
                    patch.dueAtUtc = fields.dueAtUtc;
                    patch.dueTimeSet = fields.dueTimeSet;
                }
                saved = await updateTask(existing.id, patch);
            } else {
                saved = await createTask(fields.title, null, {
                    description: fields.description,
                    priority: fields.priority,
                    repeat: fields.repeat,
                    dueAtUtc: fields.dueAtUtc ?? undefined,
                    dueTimeSet: fields.dueAtUtc ? fields.dueTimeSet : undefined,
                });
            }

            const taskId = saved?.id ?? existing?.id;

            // The notification is local, so it is scheduled from the saved task —
            // never from the form — and cleared whenever the date goes away.
            if (taskId) {
                if (fields.dueAtUtc) {
                    const result = await scheduleTaskAlert({
                        taskId,
                        title: fields.title,
                        description: fields.description,
                        dueAtUtc: fields.dueAtUtc,
                    });
                    if (result?.error === "past") {
                        Alert.alert(
                            "Saved without an alert",
                            "That due time has already passed, so no reminder was scheduled."
                        );
                    }
                } else {
                    await cancelTaskAlert(taskId);
                }
            }

            setEditor({ visible: false, task: null });
            await load();
        } catch (e) {
            Alert.alert("Save failed", e?.userMessage || e?.message || "Please try again.");
        } finally {
            setSaving(false);
        }
    }

    /* ── reminders (documents) ──────────────────────────────────────────────*/

    function openReminderSnooze(reminder) {
        if (!advanced) return requireAdvanced("Snoozing a reminder");
        setSnoozing({ kind: "reminder", item: reminder });
    }

    async function applySnooze(option) {
        const target = snoozing;
        setSnoozing(null);
        if (!target) return;

        if (target.kind === "reminder") {
            const result = await snoozeReminder(target.item.id, option);

            if (result?.error === "past") {
                Alert.alert("Too Soon", "That snooze time has already passed. Pick a longer one.");
                return;
            }
            if (result?.error === "missing") {
                Alert.alert("Reminder Gone", "That reminder no longer exists.");
                await loadReminders();
                return;
            }

            await loadReminders();
            Alert.alert(
                "Snoozed",
                `We'll remind you again on ${formatDate(result.fireAtUtc)} at ${new Date(
                    result.fireAtUtc
                ).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}.`
            );
            return;
        }

        // Task snooze: the due date itself is left alone — only the alert moves,
        // mirrored server-side so it survives a reinstall.
        const task = target.item;
        const until = snoozeUntil(option);

        if (!until || until.getTime() <= Date.now()) {
            Alert.alert("Too Soon", "That snooze time has already passed. Pick a longer one.");
            return;
        }

        try {
            await snoozeTask(task.id, until.toISOString());
            const result = await scheduleTaskAlert({
                taskId: task.id,
                title: task.title,
                description: task.description,
                dueAtUtc: until.toISOString(),
            });

            if (result?.error === "past") {
                Alert.alert("Too Soon", "That snooze time has already passed. Pick a longer one.");
                return;
            }

            setAlerts((map) => ({ ...map, [task.id]: result }));
            Alert.alert(
                "Snoozed",
                `We'll remind you again on ${formatDate(until)} at ${until.toLocaleTimeString(undefined, {
                    hour: "numeric",
                    minute: "2-digit",
                })}.`
            );
        } catch (e) {
            Alert.alert("Snooze failed", e?.userMessage || e?.message || "Please try again.");
        }
    }

    function removeReminder(reminder) {
        Alert.alert("Cancel reminder?", `${reminder.label} · ${formatDate(reminder.dateUtc)}`, [
            { text: "Keep", style: "cancel" },
            {
                text: "Cancel reminder",
                style: "destructive",
                onPress: async () => {
                    await cancelReminder(reminder.id);
                    await loadReminders();
                },
            },
        ]);
    }

    /* ── render ─────────────────────────────────────────────────────────────*/

    const renderItem = useCallback(
        ({ item }) => (
            <TaskCard
                task={item}
                expanded={expandedId === item.id}
                hasAlert={!!alerts[item.id]}
                speaking={speakingId === item.id}
                onToggleDone={toggleDone}
                onOpenActions={openActions}
                onToggleWhy={toggleWhy}
                onPress={openTask}
                onSpeak={speak}
            />
        ),
        [expandedId, alerts, speakingId, toggleDone, openActions, toggleWhy, openTask, speak]
    );

    const keyExtractor = useCallback((item) => String(item.id), []);

    const onScroll = useCallback(
        (event) => {
            if (restoringScroll.current) return;
            scrollOffsets.current[tab] = event.nativeEvent.contentOffset.y;
        },
        [tab]
    );

    /**
     * Document reminders — created over on the Analysis screen.
     *
     * These are not tasks and never were: they belong to a document, they carry
     * no status and cannot be completed. Rendering them as the task list's
     * header put the identical block above BOTH task tabs, which read as a
     * duplicate and left them belonging to neither. They now own a tab.
     */
    const remindersSection = (
        <View style={S.remWrap}>
            <View style={S.remHead}>
                <Ionicons name="alarm-outline" size={16} color={theme.colors.warningText} />
                <Text style={S.remHeadTitle}>Document reminders</Text>
                {reminders.past.length > 0 ? (
                    <Pressable
                        onPress={() => setShowPast((v) => !v)}
                        hitSlop={8}
                        accessibilityRole="button"
                    >
                        <Text style={S.remToggle}>
                            {showPast ? "Hide past" : `Past (${reminders.past.length})`}
                        </Text>
                    </Pressable>
                ) : null}
            </View>

            {(showPast ? reminders.past : reminders.upcoming).map((r) => (
                <Card key={r.id} style={S.remCard}>
                    <View style={S.remRow}>
                        <Ionicons
                            name={showPast ? "time-outline" : "notifications-outline"}
                            size={18}
                            color={showPast ? theme.colors.textMuted : theme.colors.warningText}
                        />
                        <View style={S.remMain}>
                            <Text style={S.remTitle} numberOfLines={1}>
                                {r.docTitle}
                            </Text>
                            <Text style={S.remMeta}>
                                {r.label} · {formatDate(r.dateUtc)}
                            </Text>
                        </View>
                        {!showPast && (
                            <Pressable
                                onPress={() => openReminderSnooze(r)}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={
                                    advanced
                                        ? `Snooze the reminder for ${r.docTitle}`
                                        : "Snooze. Advance plan feature."
                                }
                            >
                                <Ionicons
                                    name="alarm-outline"
                                    size={19}
                                    color={advanced ? theme.colors.accentText : theme.colors.textMuted}
                                />
                            </Pressable>
                        )}
                        <Pressable
                            onPress={() => removeReminder(r)}
                            hitSlop={8}
                            accessibilityRole="button"
                            accessibilityLabel={`Cancel the reminder for ${r.docTitle}`}
                        >
                            <Ionicons
                                name="close-circle-outline"
                                size={19}
                                color={theme.colors.textMuted}
                            />
                        </Pressable>
                    </View>
                </Card>
            ))}

            {showPast && reminders.past.length === 0 ? (
                <Text style={S.remEmpty}>No past reminders.</Text>
            ) : null}
        </View>
    );

    return (
        <GradientScreen>
            <SafeAreaView style={Common.flex1}>
                <View style={Common.screen}>
                    <AiHeader
                        title="Assistant"
                        subtitle={doneToday > 0 ? `🔥 ${doneToday} done today` : "Your tasks and reminders"}
                    />

                    {/* Reminders are created on a document, not here, so the
                        task composer would be a dead end on that tab. */}
                    {tab !== TAB_REMINDERS ? (
                    <Card style={S.addCard}>
                        <View style={S.addRow}>
                            <TextInput
                                placeholder="Add a task…"
                                placeholderTextColor={Theme.colors.muted}
                                keyboardAppearance={theme.keyboardAppearance}
                                value={title}
                                onChangeText={setTitle}
                                onSubmitEditing={quickAdd}
                                returnKeyType="done"
                                style={S.input}
                                accessibilityLabel="New task title"
                            />
                            <AppButton title="Add" icon="add" onPress={quickAdd} disabled={!title.trim()} />
                        </View>

                        <Pressable
                            onPress={() => setEditor({ visible: true, task: null })}
                            hitSlop={6}
                            accessibilityRole="button"
                            style={{ marginTop: 10 }}
                        >
                            <Text style={S.remToggle}>+ Add with details</Text>
                        </Pressable>
                    </Card>
                    ) : null}

                    <SegmentedTabs
                        value={tab}
                        onChange={setTab}
                        options={[
                            { key: TAB_MINE, label: "My Tasks", badge: myTasks.length },
                            { key: TAB_AI, label: "AI Tasks", badge: aiTasks.length },
                            { key: TAB_REMINDERS, label: "Reminders", badge: reminderCount },
                        ]}
                    />

                    <FlatList
                        ref={listRef}
                        data={visibleTasks}
                        keyExtractor={keyExtractor}
                        renderItem={renderItem}
                        onScroll={onScroll}
                        scrollEventThrottle={16}
                        contentContainerStyle={{ paddingBottom: 90 }}
                        initialNumToRender={8}
                        maxToRenderPerBatch={8}
                        windowSize={7}
                        removeClippedSubviews
                        ListHeaderComponent={tab === TAB_REMINDERS ? remindersSection : null}
                        ListEmptyComponent={
                            // On the reminders tab the section above IS the content,
                            // so an empty task list must not draw a second empty state
                            // underneath a list of reminders.
                            tab === TAB_REMINDERS && reminderCount > 0 ? null : (
                                <View style={styles.empty}>
                                    <Ionicons
                                        name={EMPTY_STATES[tab].icon}
                                        size={34}
                                        color={Theme.colors.primary2}
                                    />
                                    <Text style={styles.emptyTitle}>{EMPTY_STATES[tab].title}</Text>
                                    <Text style={styles.emptyBody}>{EMPTY_STATES[tab].body}</Text>
                                </View>
                            )
                        }
                    />
                </View>
            </SafeAreaView>

            <TaskEditorSheet
                visible={editor.visible}
                task={editor.task}
                advanced={advanced}
                saving={saving}
                onClose={() => setEditor({ visible: false, task: null })}
                onSave={saveTask}
                onRequestUpgrade={() => requireAdvanced("Due dates and repeats")}
            />

            {/* Snooze picker — Advance tier. Reached only through the two openers,
                which show the upsell instead when the plan does not include it. */}
            <Modal visible={!!snoozing} transparent animationType="fade" onRequestClose={() => setSnoozing(null)}>
                <Pressable style={S.snoozeOverlay} onPress={() => setSnoozing(null)}>
                    <Pressable style={S.snoozeSheet} onPress={() => {}}>
                        <Text style={S.snoozeTitle}>
                            {snoozing?.kind === "task" ? "Snooze task" : "Snooze reminder"}
                        </Text>
                        <Text style={S.snoozeSub} numberOfLines={1}>
                            {snoozing?.kind === "task" ? snoozing?.item?.title : snoozing?.item?.docTitle}
                        </Text>

                        {SNOOZE_OPTIONS.map((opt) => (
                            <Pressable
                                key={opt.key}
                                onPress={() => applySnooze(opt)}
                                style={S.snoozeOption}
                                accessibilityRole="button"
                            >
                                <Ionicons name="alarm-outline" size={17} color={theme.colors.accentText} />
                                <Text style={S.snoozeOptionText}>{opt.label}</Text>
                            </Pressable>
                        ))}

                        <Pressable onPress={() => setSnoozing(null)} style={S.snoozeCancel} accessibilityRole="button">
                            <Text style={S.snoozeCancelText}>Cancel</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>
        </GradientScreen>
    );
}

/**
 * Absolute time for a snooze option. Mirrors what snoozeReminder does internally
 * for document reminders, so both kinds of snooze mean the same thing.
 */
function snoozeUntil(option) {
    if (option?.nextMorning) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        return tomorrow;
    }
    if (typeof option?.minutes === "number") {
        return new Date(Date.now() + option.minutes * 60000);
    }
    return null;
}
