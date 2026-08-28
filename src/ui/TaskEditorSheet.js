import React, { useEffect, useMemo, useState } from "react";
import {
    View,
    Text,
    TextInput,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import CalendarPicker from "./CalendarPicker";
import { PrimaryButton } from "./buttons";
import useThemedStyles from "./useThemedStyles";
import { useTheme } from "./ThemeProvider";

/**
 * TaskEditorSheet — create or edit one task.
 *
 * Everything about a task is edited here, so there is exactly one place where a
 * task's fields are assembled and exactly one shape sent to the API.
 *
 * Due date, time and repeat are Advance-tier (`advanced_reminders`). Locked
 * controls stay visible and tap through to the upgrade prompt rather than
 * disappearing — a feature the user cannot see is a feature they never buy.
 *
 * Time is chosen from presets rather than a native picker on purpose: a native
 * date/time module would force every developer and tester onto a fresh
 * dev-client build, which the hand-rolled CalendarPicker was written to avoid.
 */

const PRIORITIES = [
    { key: "", label: "None" },
    { key: "LOW", label: "Low" },
    { key: "MEDIUM", label: "Medium" },
    { key: "HIGH", label: "High" },
];

const REPEATS = [
    { key: "NONE", label: "Never" },
    { key: "DAILY", label: "Daily" },
    { key: "WEEKLY", label: "Weekly" },
    { key: "MONTHLY", label: "Monthly" },
    { key: "YEARLY", label: "Yearly" },
];

// Minutes past midnight, local time. `null` = a day with no specific time, which
// fires at 09:00 to match reminderService's FIRE_HOUR.
const TIMES = [
    { key: "none", label: "No time", minutes: null },
    { key: "0900", label: "9:00", minutes: 9 * 60 },
    { key: "1200", label: "12:00", minutes: 12 * 60 },
    { key: "1500", label: "15:00", minutes: 15 * 60 },
    { key: "1800", label: "18:00", minutes: 18 * 60 },
    { key: "2100", label: "21:00", minutes: 21 * 60 },
];

const DEFAULT_MINUTES = 9 * 60;

/** Local Y/M/D + minutes → the absolute instant to store. */
export function composeDueAt(date, minutes) {
    if (!date) return null;
    const due = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    due.setHours(0, minutes ?? DEFAULT_MINUTES, 0, 0);
    return due.toISOString();
}

/** Nearest preset for an existing due time, so reopening the editor shows what was saved. */
function timeKeyFor(dueAtUtc, dueTimeSet) {
    if (!dueAtUtc || !dueTimeSet) return "none";
    const due = new Date(dueAtUtc);
    if (isNaN(due.getTime())) return "none";

    const minutes = due.getHours() * 60 + due.getMinutes();
    const match = TIMES.find((t) => t.minutes === minutes);
    return match ? match.key : "custom";
}

const makeStyles = (t) =>
    StyleSheet.create({
        overlay: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: "flex-end" },
        sheet: {
            backgroundColor: t.colors.sheet,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            paddingHorizontal: 18,
            paddingTop: 16,
            paddingBottom: 26,
            maxHeight: "92%",
        },
        grabber: {
            alignSelf: "center",
            width: 38,
            height: 4,
            borderRadius: 2,
            backgroundColor: t.colors.separator,
            marginBottom: 14,
        },
        heading: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 17, marginBottom: 14 },
        label: {
            color: t.colors.textMuted,
            fontWeight: "800",
            fontSize: 11.5,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            marginBottom: 7,
            marginTop: 14,
        },
        labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
        input: {
            backgroundColor: t.colors.inputBg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.colors.separator,
            borderRadius: 12,
            paddingHorizontal: 13,
            paddingVertical: 11,
            color: t.colors.textPrimary,
            fontWeight: "700",
            fontSize: 14,
        },
        multiline: { minHeight: 84, textAlignVertical: "top" },
        chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
        chip: {
            paddingHorizontal: 13,
            paddingVertical: 8,
            borderRadius: 11,
            backgroundColor: t.colors.glassSoft,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.colors.separator,
        },
        chipActive: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
        chipText: { color: t.colors.textSecondary, fontWeight: "800", fontSize: 12.5 },
        chipTextActive: { color: "#FFFFFF" },
        chipLocked: { opacity: 0.55 },
        dueRow: { flexDirection: "row", alignItems: "center", gap: 10 },
        dueValue: { flex: 1, color: t.colors.textPrimary, fontWeight: "800", fontSize: 13.5 },
        link: { color: t.colors.accentText, fontWeight: "800", fontSize: 12.5 },
        calendarWrap: { marginTop: 10 },
        actions: { flexDirection: "row", gap: 10, marginTop: 22, alignItems: "center" },
        cancel: { paddingVertical: 13, paddingHorizontal: 16 },
        cancelText: { color: t.colors.textMuted, fontWeight: "800", fontSize: 13.5 },
        saveWrap: { flex: 1 },
        error: { marginTop: 10, color: t.colors.danger, fontWeight: "700", fontSize: 12.5 },
    });

export default function TaskEditorSheet({
    visible,
    task,
    advanced,
    saving,
    onClose,
    onSave,
    onRequestUpgrade,
}) {
    const styles = useThemedStyles(makeStyles);
    const { theme, colors } = useTheme();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("");
    const [dueDate, setDueDate] = useState(null); // local Date, midnight
    const [timeKey, setTimeKey] = useState("none");
    const [repeat, setRepeat] = useState("NONE");
    const [showCalendar, setShowCalendar] = useState(false);
    const [error, setError] = useState("");

    // Reset every time the sheet opens, so an abandoned edit never leaks into
    // the next task.
    useEffect(() => {
        if (!visible) return;

        setTitle(task?.title ?? "");
        setDescription(task?.description ?? "");
        setPriority(task?.priority ? String(task.priority).toUpperCase() : "");
        setRepeat(task?.repeat ? String(task.repeat).toUpperCase() : "NONE");
        setTimeKey(timeKeyFor(task?.dueAtUtc, task?.dueTimeSet));
        setShowCalendar(false);
        setError("");

        if (task?.dueAtUtc) {
            const due = new Date(task.dueAtUtc);
            setDueDate(isNaN(due.getTime()) ? null : new Date(due.getFullYear(), due.getMonth(), due.getDate()));
        } else {
            setDueDate(null);
        }
    }, [visible, task]);

    const dueLabel = useMemo(() => {
        if (!dueDate) return "Not set";

        const day = dueDate.toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
        const time = TIMES.find((t) => t.key === timeKey);
        return time?.minutes == null ? day : `${day}, ${time.label}`;
    }, [dueDate, timeKey]);

    function guardAdvanced() {
        if (advanced) return true;
        onRequestUpgrade?.();
        return false;
    }

    function submit() {
        const cleanTitle = title.trim();
        if (!cleanTitle) {
            setError("Give the task a title.");
            return;
        }

        const minutes = TIMES.find((t) => t.key === timeKey)?.minutes ?? null;
        const hadDueDate = !!task?.dueAtUtc;

        onSave({
            title: cleanTitle,
            description: description.trim(),
            priority,
            repeat,
            dueAtUtc: dueDate ? composeDueAt(dueDate, minutes) : null,
            dueTimeSet: dueDate ? minutes != null : null,
            // The API cannot tell "left alone" from "cleared" by a null, so say so.
            clearDueAt: hadDueDate && !dueDate,
        });
    }

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose} accessibilityRole="button">
                <Pressable style={styles.sheet} onPress={() => {}}>
                    <View style={styles.grabber} />

                    <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        <Text style={styles.heading}>{task ? "Edit task" : "New task"}</Text>

                        <TextInput
                            value={title}
                            onChangeText={(value) => {
                                setTitle(value);
                                if (error) setError("");
                            }}
                            placeholder="What needs doing?"
                            placeholderTextColor={colors.textMuted}
                            keyboardAppearance={theme.keyboardAppearance}
                            style={styles.input}
                            accessibilityLabel="Task title"
                        />

                        <Text style={styles.label}>Description</Text>
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder="Anything you want to remember about it…"
                            placeholderTextColor={colors.textMuted}
                            keyboardAppearance={theme.keyboardAppearance}
                            style={[styles.input, styles.multiline]}
                            multiline
                            maxLength={2000}
                            accessibilityLabel="Task description"
                        />

                        <Text style={styles.label}>Priority</Text>
                        <View style={styles.chipRow}>
                            {PRIORITIES.map((option) => {
                                const active = priority === option.key;
                                return (
                                    <Pressable
                                        key={option.key || "none"}
                                        onPress={() => setPriority(option.key)}
                                        style={[styles.chip, active && styles.chipActive]}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: active }}
                                    >
                                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                            {option.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <View style={[styles.labelRow, { marginTop: 14 }]}>
                            <Text style={[styles.label, { marginTop: 0 }]}>Due</Text>
                            {!advanced ? <Ionicons name="lock-closed" size={12} color={colors.textMuted} /> : null}
                        </View>

                        <View style={styles.dueRow}>
                            <Text style={styles.dueValue}>{dueLabel}</Text>

                            {dueDate ? (
                                <Pressable
                                    onPress={() => {
                                        setDueDate(null);
                                        setTimeKey("none");
                                        setShowCalendar(false);
                                    }}
                                    hitSlop={8}
                                    accessibilityRole="button"
                                >
                                    <Text style={styles.link}>Remove</Text>
                                </Pressable>
                            ) : null}

                            <Pressable
                                onPress={() => {
                                    if (!guardAdvanced()) return;
                                    setShowCalendar((open) => !open);
                                }}
                                hitSlop={8}
                                accessibilityRole="button"
                                accessibilityLabel={advanced ? "Choose a due date" : "Due dates are an Advance plan feature"}
                            >
                                <Text style={styles.link}>{showCalendar ? "Done" : dueDate ? "Change" : "Set date"}</Text>
                            </Pressable>
                        </View>

                        {showCalendar ? (
                            <View style={styles.calendarWrap}>
                                <CalendarPicker value={dueDate} onChange={setDueDate} />

                                <Text style={styles.label}>Time</Text>
                                <View style={styles.chipRow}>
                                    {TIMES.map((option) => {
                                        const active = timeKey === option.key;
                                        return (
                                            <Pressable
                                                key={option.key}
                                                onPress={() => setTimeKey(option.key)}
                                                style={[styles.chip, active && styles.chipActive]}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected: active }}
                                            >
                                                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                                    {option.label}
                                                </Text>
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            </View>
                        ) : null}

                        <View style={[styles.labelRow, { marginTop: 14 }]}>
                            <Text style={[styles.label, { marginTop: 0 }]}>Repeat</Text>
                            {!advanced ? <Ionicons name="lock-closed" size={12} color={colors.textMuted} /> : null}
                        </View>

                        <View style={styles.chipRow}>
                            {REPEATS.map((option) => {
                                const active = repeat === option.key;
                                return (
                                    <Pressable
                                        key={option.key}
                                        onPress={() => {
                                            if (option.key !== "NONE" && !guardAdvanced()) return;
                                            setRepeat(option.key);
                                        }}
                                        style={[
                                            styles.chip,
                                            active && styles.chipActive,
                                            !advanced && option.key !== "NONE" && styles.chipLocked,
                                        ]}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: active }}
                                    >
                                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                            {option.label}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        {error ? <Text style={styles.error}>{error}</Text> : null}

                        <View style={styles.actions}>
                            <Pressable onPress={onClose} style={styles.cancel} accessibilityRole="button">
                                <Text style={styles.cancelText}>Cancel</Text>
                            </Pressable>

                            <View style={styles.saveWrap}>
                                <PrimaryButton
                                    title={task ? "Save changes" : "Add task"}
                                    icon={task ? "checkmark" : "add"}
                                    onPress={submit}
                                    loading={saving}
                                    disabled={saving}
                                />
                            </View>
                        </View>
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}
