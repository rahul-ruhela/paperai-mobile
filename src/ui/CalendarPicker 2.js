import React, { useMemo, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "./ThemeProvider";
import useThemedStyles from "./useThemedStyles";

/**
 * CalendarPicker — a month grid for choosing a single date.
 *
 * Deliberately hand-rolled rather than pulling in a calendar package or
 * @react-native-community/datetimepicker. Both are native modules, which would
 * force every developer and every tester onto a fresh dev-client build before
 * they could run the app at all. This is a few dozen Views and behaves
 * identically in Expo Go, a development build and TestFlight — so what you test
 * is what ships.
 *
 * Dates before `minDate` (today by default) are not selectable: a reminder in
 * the past can never fire, and offering it would be a dead end.
 *
 * Props:
 *   value      Date | null   currently selected day
 *   onChange   (Date) => void
 *   minDate    Date          earliest selectable day, inclusive (default: today)
 *   maxDate    Date          latest selectable day, inclusive (default: +2 years)
 *   markedDates string[]     "YYYY-MM-DD" days that already have a reminder
 */

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/** Local-time YYYY-MM-DD. `toISOString()` would shift the day for anyone east or west of UTC. */
export function dayKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

export default function CalendarPicker({ value, onChange, minDate, maxDate, markedDates = [] }) {
    const { theme } = useTheme();
    const s = useThemedStyles(makeStyles);

    const min = useMemo(() => startOfDay(minDate ?? new Date()), [minDate]);
    const max = useMemo(() => {
        if (maxDate) return startOfDay(maxDate);
        const d = new Date();
        d.setFullYear(d.getFullYear() + 2);
        return startOfDay(d);
    }, [maxDate]);

    // The visible month. Starts on the selected date's month so reopening the
    // picker returns you to where you were, not to today.
    const [cursor, setCursor] = useState(() => {
        const base = value ?? min;
        return new Date(base.getFullYear(), base.getMonth(), 1);
    });

    const marked = useMemo(() => new Set(markedDates), [markedDates]);
    const selectedKey = value ? dayKey(value) : null;
    const todayKey = dayKey(new Date());

    const cells = useMemo(() => {
        const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
        const lead = first.getDay(); // 0 = Sunday

        const out = [];
        for (let i = 0; i < lead; i++) out.push(null);
        for (let d = 1; d <= daysInMonth; d++) {
            out.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
        }
        return out;
    }, [cursor]);

    // A month is reachable if ANY of its days falls in range — checking only the
    // 1st would wrongly disable the current month from the 2nd onwards.
    const canGoBack = useMemo(() => {
        const lastOfPrev = new Date(cursor.getFullYear(), cursor.getMonth(), 0);
        return lastOfPrev.getTime() >= min.getTime();
    }, [cursor, min]);

    const canGoForward = useMemo(() => {
        const firstOfNext = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
        return firstOfNext.getTime() <= max.getTime();
    }, [cursor, max]);

    function shiftMonth(delta) {
        setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
    }

    return (
        <View style={s.wrap}>
            <View style={s.header}>
                <Pressable
                    onPress={() => shiftMonth(-1)}
                    disabled={!canGoBack}
                    hitSlop={10}
                    style={[s.navBtn, !canGoBack && s.navDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel="Previous month"
                    accessibilityState={{ disabled: !canGoBack }}
                >
                    <Ionicons name="chevron-back" size={18} color={theme.colors.textPrimary} />
                </Pressable>

                <Text style={s.monthLabel}>
                    {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
                </Text>

                <Pressable
                    onPress={() => shiftMonth(1)}
                    disabled={!canGoForward}
                    hitSlop={10}
                    style={[s.navBtn, !canGoForward && s.navDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel="Next month"
                    accessibilityState={{ disabled: !canGoForward }}
                >
                    <Ionicons name="chevron-forward" size={18} color={theme.colors.textPrimary} />
                </Pressable>
            </View>

            <View style={s.weekRow}>
                {WEEKDAYS.map((w, i) => (
                    <Text key={i} style={s.weekday}>
                        {w}
                    </Text>
                ))}
            </View>

            <View style={s.grid}>
                {cells.map((d, i) => {
                    if (!d) return <View key={`pad-${i}`} style={s.cell} />;

                    const key = dayKey(d);
                    const disabled = d.getTime() < min.getTime() || d.getTime() > max.getTime();
                    const selected = key === selectedKey;
                    const isToday = key === todayKey;
                    const hasReminder = marked.has(key);

                    return (
                        <Pressable
                            key={key}
                            onPress={() => !disabled && onChange?.(d)}
                            disabled={disabled}
                            style={s.cell}
                            accessibilityRole="button"
                            accessibilityState={{ selected, disabled }}
                            accessibilityLabel={
                                `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` +
                                (hasReminder ? ", reminder already set" : "")
                            }
                        >
                            <View style={[s.day, selected && s.daySelected, !selected && isToday && s.dayToday]}>
                                <Text
                                    style={[
                                        s.dayText,
                                        disabled && s.dayTextDisabled,
                                        selected && s.dayTextSelected,
                                    ]}
                                >
                                    {d.getDate()}
                                </Text>
                            </View>
                            {/* A dot, not just a colour — the "already has a reminder"
                                state has to be visible without relying on hue. */}
                            {hasReminder ? <View style={[s.dot, selected && s.dotOnSelected]} /> : <View style={s.dotSpacer} />}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        wrap: { gap: 6 },

        header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4 },
        navBtn: { padding: 8, borderRadius: 999 },
        navDisabled: { opacity: 0.25 },
        monthLabel: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 15 },

        weekRow: { flexDirection: "row", marginTop: 2 },
        weekday: {
            flex: 1,
            textAlign: "center",
            color: t.colors.textMuted,
            fontWeight: "800",
            fontSize: 11,
        },

        grid: { flexDirection: "row", flexWrap: "wrap" },
        // Seven per row. Percentage width rather than a computed pixel size so it
        // holds up on every screen width without measuring.
        cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 },

        day: {
            width: 34,
            height: 34,
            borderRadius: 34,
            alignItems: "center",
            justifyContent: "center",
        },
        daySelected: { backgroundColor: t.colors.primary },
        dayToday: { borderWidth: 1, borderColor: t.colors.border },
        dayText: { color: t.colors.textPrimary, fontWeight: "700", fontSize: 14 },
        dayTextDisabled: { color: t.colors.textMuted, opacity: 0.4 },
        dayTextSelected: { color: t.colors.white, fontWeight: "900" },

        dot: { width: 5, height: 5, borderRadius: 5, backgroundColor: t.colors.warningText, marginTop: 2 },
        dotOnSelected: { backgroundColor: t.colors.white },
        dotSpacer: { height: 7, marginTop: 2 },
    });
