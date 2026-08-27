import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import useThemedStyles from "./useThemedStyles";
import { useTheme } from "./ThemeProvider";

/**
 * TaskCard — one row in either Assistant tab.
 *
 * Memoised, and every handler is passed in already-bound from the screen, so a
 * list of 200 tasks re-renders only the rows whose data actually changed.
 */

const PRIORITY_TONE = {
    HIGH: "danger",
    MEDIUM: "warning",
    LOW: "textMuted",
};

/** Due-date label: "Overdue · 3 Sep", "Today, 14:30", "3 Sep 2026". */
export function formatDue(dueAtUtc, dueTimeSet) {
    if (!dueAtUtc) return null;

    const due = new Date(dueAtUtc);
    if (isNaN(due.getTime())) return null;

    const time = dueTimeSet
        ? due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
        : null;

    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((startOfDay(due) - startOfDay(new Date())) / 86400000);

    let day;
    if (days === 0) day = "Today";
    else if (days === 1) day = "Tomorrow";
    else if (days === -1) day = "Yesterday";
    else day = due.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

    const label = time ? `${day}, ${time}` : day;
    return { label, overdue: due.getTime() < Date.now() };
}

const makeStyles = (t) =>
    StyleSheet.create({
        card: {
            ...t.glassCard,
            padding: 14,
            marginBottom: 10,
        },
        topRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
        titleWrap: { flex: 1, minWidth: 0 },
        title: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 14 },
        titleDone: { color: t.colors.textMuted, textDecorationLine: "line-through" },
        description: {
            marginTop: 4,
            color: t.colors.textSecondary,
            fontWeight: "600",
            fontSize: 12.5,
            lineHeight: 17,
        },
        metaRow: {
            marginTop: 10,
            flexDirection: "row",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
        },
        chip: {
            paddingHorizontal: 9,
            paddingVertical: 3,
            borderRadius: 9,
            backgroundColor: t.colors.glassSoft,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: t.colors.separator,
        },
        chipText: { fontWeight: "800", fontSize: 11, color: t.colors.textSecondary },
        due: { flexDirection: "row", alignItems: "center", gap: 4 },
        dueText: { fontWeight: "800", fontSize: 11.5, color: t.colors.textMuted },
        dueOverdue: { color: t.colors.danger },
        why: { marginTop: 10, color: t.colors.accentText, fontWeight: "800", fontSize: 12 },
        explain: {
            marginTop: 6,
            color: t.colors.textSecondary,
            fontWeight: "700",
            fontSize: 12.5,
            lineHeight: 18,
        },
    });

function TaskCard({
    task,
    expanded,
    hasAlert,
    speaking,
    onToggleDone,
    onOpenActions,
    onToggleWhy,
    onPress,
    onSpeak,
}) {
    const styles = useThemedStyles(makeStyles);
    const { colors } = useTheme();

    const done = task.status === "DONE";
    const isAi = task.isAiSuggested === true;
    const due = formatDue(task.dueAtUtc, task.dueTimeSet);
    const priority = task.priority ? String(task.priority).toUpperCase() : null;

    return (
        <View style={styles.card}>
            <View style={styles.topRow}>
                <Pressable
                    onPress={() => onToggleDone(task)}
                    hitSlop={8}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                    accessibilityLabel={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
                >
                    <Ionicons
                        name={done ? "checkmark-circle" : "ellipse-outline"}
                        size={22}
                        color={done ? colors.success : colors.accentText}
                    />
                </Pressable>

                {/* The title block opens the editor. Tapping a task row and
                    having nothing happen reads as a broken list, and the "..."
                    menu alone is not discoverable. */}
                <Pressable
                    style={styles.titleWrap}
                    onPress={() => onPress?.(task)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${task.title}`}
                >
                    <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
                        {task.title}
                    </Text>

                    {task.description ? (
                        <Text style={styles.description} numberOfLines={expanded ? undefined : 2}>
                            {task.description}
                        </Text>
                    ) : null}
                </Pressable>

                <Pressable
                    onPress={() => onSpeak?.(task)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={speaking ? `Stop reading ${task.title}` : `Read ${task.title} aloud`}
                >
                    <Ionicons
                        name={speaking ? "stop-circle" : "volume-high-outline"}
                        size={19}
                        color={speaking ? colors.accentText : colors.textMuted}
                    />
                </Pressable>

                <Pressable
                    onPress={() => onOpenActions(task)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Options for ${task.title}`}
                >
                    <Ionicons name="ellipsis-horizontal" size={19} color={colors.textMuted} />
                </Pressable>
            </View>

            <View style={styles.metaRow}>
                {isAi ? (
                    <View style={styles.chip}>
                        <Text style={styles.chipText}>AI suggested</Text>
                    </View>
                ) : null}

                {priority ? (
                    <View style={styles.chip}>
                        <Text style={[styles.chipText, { color: colors[PRIORITY_TONE[priority]] ?? colors.textSecondary }]}>
                            {priority}
                        </Text>
                    </View>
                ) : null}

                {task.repeat && task.repeat !== "NONE" ? (
                    <View style={styles.chip}>
                        <Text style={styles.chipText}>{`Repeats ${String(task.repeat).toLowerCase()}`}</Text>
                    </View>
                ) : null}

                {due ? (
                    <View style={styles.due}>
                        <Ionicons
                            name={hasAlert ? "alarm" : "calendar-outline"}
                            size={13}
                            color={due.overdue && !done ? colors.danger : colors.textMuted}
                        />
                        <Text style={[styles.dueText, due.overdue && !done && styles.dueOverdue]}>
                            {due.overdue && !done ? `Overdue · ${due.label}` : due.label}
                        </Text>
                    </View>
                ) : null}
            </View>

            {isAi && task.aiReason ? (
                <>
                    <Pressable onPress={() => onToggleWhy(task)} accessibilityRole="button">
                        <Text style={styles.why}>{expanded ? "Hide reason" : "Why this task? →"}</Text>
                    </Pressable>
                    {expanded ? <Text style={styles.explain}>{task.aiReason}</Text> : null}
                </>
            ) : null}
        </View>
    );
}

export default React.memo(TaskCard);
