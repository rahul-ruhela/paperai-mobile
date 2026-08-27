import React, { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, Alert, StyleSheet, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
    detectDates,
    scheduleReminder,
    ensurePermission,
    hasReminderFor,
    formatDate,
    listReminders,
    LEAD_OPTIONS,
    CUSTOM_OFFSETS,
} from "../services/reminderService";
import CalendarPicker, { dayKey } from "./CalendarPicker";
import { useFeatureAccess } from "../hooks/useFeatureAccess";
import { useTheme } from "./ThemeProvider";
import useThemedStyles from "./useThemedStyles";

/**
 * ReminderCard — schedule a local notification ahead of a date in a document.
 *
 * Two sources of dates, and both are real:
 *   1. Dates detected in the document's AI output (backend `detectedDates`, else
 *      the client-side parser in reminderService).
 *   2. A date the user picks themselves, relative to today.
 *
 * (2) exists because detection needs a date sitting next to an intent word, and
 * plenty of real documents don't have one. Without it the card is invisible on
 * those documents and the feature looks broken — and it is the only way to
 * exercise the feature on a TestFlight build, where no debug affordance exists.
 *
 * There is deliberately NO fake sample date. An earlier revision rendered one
 * under __DEV__ to make the card testable; a row that looks like it was found in
 * the document but wasn't is a misrepresentation, and it is not worth the risk of
 * it ever rendering in front of a reviewer.
 *
 * Gated on `smart_reminders` (Essential), matching both featureMatrix.ts and the
 * backend FeatureMatrix.cs. Free users get an upsell rather than a silent no-op.
 */
export default function ReminderCard({ doc, navigation }) {
    const { theme } = useTheme();
    const styles = useThemedStyles(makeStyles);
    const { allowed, loading: accessLoading } = useFeatureAccess("smart_reminders");
    // Custom dates and snooze are an Advance-tier upsell on top of reminders.
    const { allowed: advanced } = useFeatureAccess("advanced_reminders");

    const [dates, setDates] = useState([]);
    const [existing, setExisting] = useState({});
    const [picking, setPicking] = useState(null); // the date being scheduled
    const [customOpen, setCustomOpen] = useState(false);
    const [calendarOpen, setCalendarOpen] = useState(false);
    const [chosenDate, setChosenDate] = useState(null);
    // Days this document already has a reminder on, so the calendar can mark
    // them and the duplicate check has something to show.
    const [takenDays, setTakenDays] = useState([]);

    const docId = doc?.id;

    useEffect(() => {
        if (!doc) return;
        let alive = true;

        const found = detectDates(doc).filter((d) => !d.expired || d.daysAway > -60);
        setDates(found);

        (async () => {
            const entries = await Promise.all(
                found.map(async (d) => [d.dateUtc, await hasReminderFor(docId, d.dateUtc)])
            );
            // `alive` guards the case where the document changed while these
            // lookups were in flight — without it a stale map lands on the new
            // document and rows show the wrong "Set" state.
            if (alive) setExisting(Object.fromEntries(entries));

            const all = await listReminders();
            if (alive) {
                setTakenDays(
                    all
                        .filter((r) => r.docId === docId)
                        // Local-time day, matching CalendarPicker's dayKey —
                        // slicing the ISO string would shift the day for anyone
                        // not on UTC.
                        .map((r) => dayKey(new Date(r.dateUtc)))
                );
            }
        })();

        return () => {
            alive = false;
        };
    }, [doc, docId]);

    if (!doc) return null;
    // Never flash an upsell while the entitlement snapshot is still loading.
    if (accessLoading) return null;

    async function schedule({ label, dateUtc, lead }) {
        const { granted, reason } = await ensurePermission();
        if (!granted) {
            // A simulator can't deliver local notifications at all, and sending
            // someone to Settings to fix that is a dead end — so the two cases
            // get different copy and different buttons.
            if (reason === "simulator") {
                Alert.alert(
                    "Needs A Real Device",
                    "Reminders use local notifications, which the simulator can't deliver. Try this on your iPhone."
                );
            } else {
                Alert.alert(
                    "Notifications Are Off",
                    "Turn on notifications for Paper AI Assistant so we can remind you before this date.",
                    [
                        { text: "Not now", style: "cancel" },
                        { text: "Open Settings", onPress: () => Linking.openSettings() },
                    ]
                );
            }
            return;
        }

        let record;
        try {
            record = await scheduleReminder({
                docId: doc.id,
                docTitle: doc.title || "Document",
                label,
                dateUtc,
                leadDays: lead?.days ?? 0,
            });
        } catch {
            Alert.alert("Could Not Set Reminder", "Something went wrong scheduling that. Please try again.");
            return;
        }

        if (record?.error === "duplicate") {
            Alert.alert(
                "Reminder Already Set",
                `You already have a reminder for ${formatDate(dateUtc)} on this document. Cancel it in the Tasks tab first if you want to change it.`
            );
            return;
        }

        if (record?.error === "past" || !record) {
            Alert.alert(
                "Too Late To Remind",
                `${lead?.label ?? "That lead time"} for this date has already passed. Choose a shorter lead time.`
            );
            return;
        }

        setExisting((m) => ({ ...m, [dateUtc]: true }));
        setTakenDays((d) => [...new Set([...d, dayKey(new Date(dateUtc))])]);
        Alert.alert("Reminder Set", `We'll notify you on ${formatDate(record.fireAtUtc)} at 9:00 AM.`);
    }

    function confirm(lead) {
        const target = picking;
        setPicking(null);
        schedule({ label: target.label, dateUtc: target.dateUtc, lead });
    }

    function confirmCustom(offset) {
        setCustomOpen(false);
        const when = new Date();
        when.setDate(when.getDate() + offset.days);
        when.setHours(9, 0, 0, 0);
        // Fires on the day itself — the user picked when they want to be told,
        // so there is no lead time to subtract.
        schedule({ label: "Reminder", dateUtc: when.toISOString(), lead: { days: 0, label: "On the day" } });
    }

    function openCalendar() {
        setCustomOpen(false);
        if (!advanced) {
            Alert.alert(
                "Advance Plan Feature",
                "Picking an exact date and snoozing reminders are part of the Advance plan. The preset reminder times are included in your current plan.",
                [
                    { text: "Not now", style: "cancel" },
                    { text: "View plans", onPress: () => navigation?.navigate("Paywall") },
                ]
            );
            return;
        }
        setChosenDate(null);
        setCalendarOpen(true);
    }

    function confirmCalendar() {
        if (!chosenDate) return;
        setCalendarOpen(false);
        const when = new Date(chosenDate);
        when.setHours(9, 0, 0, 0);
        schedule({ label: "Reminder", dateUtc: when.toISOString(), lead: { days: 0, label: "On the day" } });
    }

    if (!allowed) {
        return (
            <View style={[styles.card, styles.lockedCard]}>
                <View style={styles.head}>
                    <Ionicons name="alarm-outline" size={17} color={theme.colors.textMuted} />
                    <Text style={styles.title}>Smart Reminders</Text>
                    <View style={styles.tierBadge}>
                        <Text style={styles.tierText}>ESSENTIAL</Text>
                    </View>
                </View>
                <Text style={styles.lockedSub}>
                    Get a notification before a bill, contract or warranty in this document comes due.
                </Text>
                <Pressable
                    onPress={() => navigation?.navigate("Paywall")}
                    style={styles.upsellBtn}
                    accessibilityRole="button"
                    accessibilityLabel="View plans to unlock Smart Reminders"
                >
                    <Text style={styles.upsellText}>View plans</Text>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            <View style={styles.head}>
                <Ionicons name="alarm-outline" size={17} color={theme.colors.warningText} />
                <Text style={styles.title}>
                    {dates.length > 0 ? "Dates found in this document" : "Remind me about this"}
                </Text>
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

            {dates.length === 0 ? (
                <Text style={styles.emptyNote}>
                    No due date was found in this document. You can still set your own reminder for it.
                </Text>
            ) : null}

            <Pressable
                onPress={() => setCustomOpen(true)}
                style={styles.customBtn}
                accessibilityRole="button"
                accessibilityLabel="Set your own reminder for this document"
            >
                <Ionicons name="add-circle-outline" size={16} color={theme.colors.accentText} />
                <Text style={styles.customText}>Set my own reminder</Text>
            </Pressable>

            {/* Lead-time picker for a detected date */}
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

            {/* Exact date picker — Advance tier */}
            <Modal visible={calendarOpen} transparent animationType="fade" onRequestClose={() => setCalendarOpen(false)}>
                <Pressable style={styles.overlay} onPress={() => setCalendarOpen(false)}>
                    <Pressable style={styles.sheet} onPress={() => {}}>
                        <Text style={styles.sheetTitle}>Pick a date</Text>
                        <Text style={styles.sheetSub}>
                            {doc.title || "This document"} · fires at 9:00 AM
                        </Text>

                        <CalendarPicker
                            value={chosenDate}
                            onChange={setChosenDate}
                            markedDates={takenDays}
                        />

                        {chosenDate && takenDays.includes(dayKey(chosenDate)) ? (
                            <Text style={styles.calWarn}>
                                A reminder is already set for this day.
                            </Text>
                        ) : null}

                        <Pressable
                            onPress={confirmCalendar}
                            disabled={!chosenDate || takenDays.includes(dayKey(chosenDate))}
                            style={[
                                styles.calConfirm,
                                (!chosenDate || takenDays.includes(dayKey(chosenDate))) && { opacity: 0.45 },
                            ]}
                            accessibilityRole="button"
                        >
                            <Text style={styles.calConfirmText}>
                                {chosenDate ? `Remind me on ${formatDate(chosenDate)}` : "Choose a day"}
                            </Text>
                        </Pressable>

                        <Pressable onPress={() => setCalendarOpen(false)} style={styles.cancel} accessibilityRole="button">
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* User-chosen reminder, relative to today */}
            <Modal visible={customOpen} transparent animationType="fade" onRequestClose={() => setCustomOpen(false)}>
                <Pressable style={styles.overlay} onPress={() => setCustomOpen(false)}>
                    <Pressable style={styles.sheet} onPress={() => {}}>
                        <Text style={styles.sheetTitle}>Remind me about this</Text>
                        <Text style={styles.sheetSub}>{doc.title || "This document"} · fires at 9:00 AM</Text>

                        {CUSTOM_OFFSETS.map((opt) => (
                            <Pressable
                                key={opt.key}
                                onPress={() => confirmCustom(opt)}
                                style={styles.option}
                                accessibilityRole="button"
                            >
                                <Ionicons name="time-outline" size={17} color={theme.colors.accentText} />
                                <Text style={styles.optionText}>{opt.label}</Text>
                            </Pressable>
                        ))}

                        {/* Shown to everyone rather than hidden from non-subscribers:
                            a feature nobody can see is a feature nobody upgrades for.
                            Tapping it explains the plan instead of failing silently. */}
                        <Pressable
                            onPress={openCalendar}
                            style={styles.option}
                            accessibilityRole="button"
                            accessibilityLabel={
                                advanced ? "Pick an exact date" : "Pick an exact date. Advance plan feature."
                            }
                        >
                            <Ionicons name="calendar-outline" size={17} color={theme.colors.accentText} />
                            <Text style={styles.optionText}>Pick a date…</Text>
                            {!advanced && (
                                <View style={styles.tierBadge}>
                                    <Text style={styles.tierText}>ADVANCE</Text>
                                </View>
                            )}
                        </Pressable>

                        <Pressable onPress={() => setCustomOpen(false)} style={styles.cancel} accessibilityRole="button">
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
            // marginBottom matches the 16 the surrounding Cards use, so this
            // does not sit tight against the AI Tasks card below it.
            marginTop: 4,
            marginBottom: 16,
            padding: 14,
            borderRadius: t.radius.lg,
            borderWidth: 1,
            borderColor: t.colors.warningBorder,
            backgroundColor: t.colors.warningBg,
            gap: 12,
        },
        lockedCard: { borderColor: t.colors.border, backgroundColor: t.colors.glassSoft },

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

        tierBadge: {
            paddingHorizontal: 8,
            paddingVertical: 3,
            borderRadius: 999,
            backgroundColor: t.colors.infoBg,
            borderWidth: 1,
            borderColor: t.colors.border,
        },
        tierText: { color: t.colors.accentText, fontWeight: "900", fontSize: 9.5, letterSpacing: 0.4 },

        lockedSub: { color: t.colors.textMuted, fontWeight: "600", fontSize: 12.5, lineHeight: 18 },
        upsellBtn: {
            alignSelf: "flex-start",
            paddingHorizontal: 14,
            paddingVertical: 9,
            borderRadius: 999,
            backgroundColor: t.colors.primary,
        },
        upsellText: { color: t.colors.white, fontWeight: "900", fontSize: 12.5 },

        row: { flexDirection: "row", alignItems: "center", gap: 10 },
        rowMain: { flex: 1, minWidth: 0 },
        rowLabel: { color: t.colors.textPrimary, fontWeight: "800", fontSize: 13 },
        rowDate: { color: t.colors.textMuted, fontWeight: "600", fontSize: 11.5, marginTop: 2 },

        emptyNote: { color: t.colors.textMuted, fontWeight: "600", fontSize: 12, lineHeight: 17 },

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

        customBtn: {
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 7,
            paddingVertical: 11,
            borderRadius: t.radius.md,
            borderWidth: 1,
            borderColor: t.colors.border,
            backgroundColor: t.colors.glassSoft,
        },
        customText: { color: t.colors.accentText, fontWeight: "800", fontSize: 13 },

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
        optionText: { flex: 1, color: t.colors.textPrimary, fontWeight: "800", fontSize: 14 },

        calWarn: {
            color: t.colors.warningText,
            fontWeight: "700",
            fontSize: 12,
            textAlign: "center",
            marginTop: 4,
        },
        calConfirm: {
            marginTop: 8,
            paddingVertical: 13,
            borderRadius: t.radius.md,
            backgroundColor: t.colors.primary,
            alignItems: "center",
        },
        calConfirmText: { color: t.colors.white, fontWeight: "900", fontSize: 14 },
        cancel: { paddingVertical: 12, alignItems: "center" },
        cancelText: { color: t.colors.textMuted, fontWeight: "800", fontSize: 13 },
    });
