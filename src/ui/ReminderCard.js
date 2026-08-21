import React, { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, Modal, Alert, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
    detectDates,
    scheduleReminder,
    ensurePermission,
    hasReminderFor,
    formatDate,
    LEAD_OPTIONS,
} from "../services/reminderService";
import { useTheme } from "./ThemeProvider";
import useThemedStyles from "./useThemedStyles";

/**
 * ReminderCard — shown on a processed document when an actionable date is found.
 * Free feature: no credits, no network. See spec docs/roadmap/tier-1/02-smart-reminders.md
 *
 * Renders nothing at all when no date is detected, so it never occupies space
 * on documents it has nothing to say about.
 */
export default function ReminderCard({ doc }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);

    const [dates, setDates] = useState([]);
    const [existing, setExisting] = useState({});
    const [picking, setPicking] = useState(null); // the date being scheduled

    const refresh = useCallback(async (found) => {
        const map = {};
        for (const d of found) {
            map[d.dateUtc] = await hasReminderFor(doc.id, d.dateUtc);
        }
        setExisting(map);
    }, [doc?.id]);

    useEffect(() => {
        if (!doc) return;
        const found = detectDates(doc).filter((d) => !d.expired || d.daysAway > -60);
        setDates(found);
        refresh(found);
    }, [doc, refresh]);

    if (!doc || dates.length === 0) return null;

    async function confirm(lead) {
        const target = picking;
        setPicking(null);

        const granted = await ensurePermission();
        if (!granted) {
            Alert.alert(
                "Notifications Are Off",
                "Turn on notifications for Paper AI Assistant so we can remind you before this date.",
                [
                    { text: "Not now", style: "cancel" },
                    { text: "Open Settings", onPress: () => Linking.openSettings() },
                ]
            );
            return;
        }

        const record = await scheduleReminder({
            docId: doc.id,
            docTitle: doc.title || "Document",
            label: target.label,
            dateUtc: target.dateUtc,
            leadDays: lead.days,
        });

        if (!record) {
            Alert.alert(
                "Too Late To Remind",
                `${lead.label} for this date has already passed. Choose a shorter lead time.`
            );
            return;
        }

        setExisting((m) => ({ ...m, [target.dateUtc]: true }));
        Alert.alert("Reminder Set", `We'll notify you on ${formatDate(record.fireAtUtc)} at 9:00 AM.`);
    }

    return (
        <View style={styles.card}>
            <View style={styles.head}>
                <Ionicons name="alarm-outline" size={17} color={theme.colors.warningText} />
                <Text style={styles.title}>Dates found in this document</Text>
                <View style={styles.freeBadge}>
                    <Text style={styles.freeText}>FREE</Text>
                </View>
            </View>

            {dates.map((d) => {
                const done = existing[d.dateUtc];
                return (
                    <View key={d.dateUtc} style={styles.row}>
                        <View style={styles.rowMain}>
                            <Text style={styles.rowLabel}>{d.label}</Text>
                            <Text style={styles.rowDate}>
                                {formatDate(d.date)}
                                {d.expired
                                    ? " · expired"
                                    : d.daysAway === 0
                                        ? " · today"
                                        : ` · in ${d.daysAway} day${d.daysAway === 1 ? "" : "s"}`}
                            </Text>
                        </View>

                        {d.expired ? (
                            <View style={styles.expiredPill}>
                                <Text style={styles.expiredText}>Passed</Text>
                            </View>
                        ) : done ? (
                            <View style={styles.setPill}>
                                <Ionicons name="checkmark" size={13} color={theme.colors.successText} />
                                <Text style={styles.setText}>Set</Text>
                            </View>
                        ) : (
                            <Pressable
                                onPress={() => setPicking(d)}
                                style={styles.remindBtn}
                                accessibilityRole="button"
                                accessibilityLabel={`Set a reminder for ${d.label} on ${formatDate(d.date)}`}
                            >
                                <Text style={styles.remindText}>Remind me</Text>
                            </Pressable>
                        )}
                    </View>
                );
            })}

            {/* Lead-time picker */}
            <Modal visible={!!picking} transparent animationType="fade" onRequestClose={() => setPicking(null)}>
                <Pressable style={styles.overlay} onPress={() => setPicking(null)}>
                    <Pressable style={styles.sheet} onPress={() => {}}>
                        <Text style={styles.sheetTitle}>When should we remind you?</Text>
                        <Text style={styles.sheetSub}>
                            {picking?.label} · {picking ? formatDate(picking.date) : ""}
                        </Text>

                        {LEAD_OPTIONS.map((opt) => (
                            <Pressable
                                key={opt.key}
                                onPress={() => confirm(opt)}
                                style={styles.option}
                                accessibilityRole="button"
                            >
                                <Ionicons name="notifications-outline" size={17} color={theme.colors.accentText} />
                                <Text style={styles.optionText}>{opt.label}</Text>
                            </Pressable>
                        ))}

                        <Pressable onPress={() => setPicking(null)} style={styles.cancel} accessibilityRole="button">
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const makeStyles = (t) =>
    StyleSheet.create({
        card: {
            marginTop: 12,
            padding: 14,
            borderRadius: t.radius.lg,
            borderWidth: 1,
            borderColor: t.colors.warningBorder,
            backgroundColor: t.colors.warningBg,
            gap: 10,
        },
        head: { flexDirection: "row", alignItems: "center", gap: 8 },
        title: { flex: 1, color: t.colors.textPrimary, fontWeight: "900", fontSize: 14 },
        freeBadge: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: t.colors.successBg,
            borderWidth: 1,
            borderColor: t.colors.successBorder,
        },
        freeText: { color: t.colors.successText, fontWeight: "900", fontSize: 9.5, letterSpacing: 0.4 },

        row: { flexDirection: "row", alignItems: "center", gap: 10 },
        rowMain: { flex: 1, minWidth: 0 },
        rowLabel: { color: t.colors.textPrimary, fontWeight: "800", fontSize: 13 },
        rowDate: { color: t.colors.textMuted, fontWeight: "600", fontSize: 11.5, marginTop: 2 },

        remindBtn: {
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 999,
            backgroundColor: t.colors.primary,
        },
        remindText: { color: t.colors.white, fontWeight: "900", fontSize: 12 },

        setPill: { flexDirection: "row", alignItems: "center", gap: 4 },
        setText: { color: t.colors.successText, fontWeight: "800", fontSize: 12 },

        expiredPill: { paddingHorizontal: 10, paddingVertical: 6 },
        expiredText: { color: t.colors.textMuted, fontWeight: "700", fontSize: 11.5 },

        overlay: { flex: 1, backgroundColor: t.colors.overlay, justifyContent: "center", padding: 28 },
        sheet: { backgroundColor: t.colors.sheet, borderRadius: 20, padding: 18, gap: 8 },
        sheetTitle: { color: t.colors.textPrimary, fontWeight: "900", fontSize: 16 },
        sheetSub: { color: t.colors.textMuted, fontWeight: "600", fontSize: 12.5, marginBottom: 6 },
        option: {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 13,
            paddingHorizontal: 12,
            borderRadius: t.radius.md,
            backgroundColor: t.colors.glassSoft,
        },
        optionText: { color: t.colors.textPrimary, fontWeight: "800", fontSize: 14 },
        cancel: { paddingVertical: 12, alignItems: "center" },
        cancelText: { color: t.colors.textMuted, fontWeight: "800", fontSize: 13 },
    });
