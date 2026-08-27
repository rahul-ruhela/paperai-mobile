/**
 * reminderService — Smart Reminders (spec 1.2).
 *
 * Detects dates in a document's AI output and schedules local notifications so
 * the user is reminded before a bill, contract or warranty comes due. Free: no
 * credits, no server round-trip.
 *
 * Date source, in priority order:
 *   1. `doc.detectedDates` from the backend (preferred — far more accurate).
 *      Shape: [{ label, dateUtc, confidence }]
 *   2. Client-side extraction from the summary / extracted text (fallback below).
 *
 * When the backend ships `detectedDates`, nothing in the UI needs to change —
 * `detectDates()` already prefers it.
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import * as FileSystem from "expo-file-system/legacy";

const FILE = "reminders.json";

// Notifications fire at 09:00 local. Firing at the raw timestamp would wake
// people at midnight, which is how an app gets its notifications disabled.
const FIRE_HOUR = 9;

export const LEAD_OPTIONS = [
    { key: "1d", label: "1 day before", days: 1 },
    { key: "3d", label: "3 days before", days: 3 },
    { key: "1w", label: "1 week before", days: 7 },
    { key: "same", label: "On the day", days: 0 },
];

/**
 * Offsets for a reminder the user sets themselves, when the document has no
 * detectable due date. Relative to today and fired at 09:00 like every other
 * reminder, so behaviour is identical in dev, TestFlight and production — there
 * is no build-flag-dependent path here to get wrong.
 */
/**
 * Snooze intervals offered when a reminder is already due or has fired.
 * Advance tier — see `advanced_reminders` in featureMatrix.ts.
 */
export const SNOOZE_OPTIONS = [
    { key: "1h", label: "1 hour", minutes: 60 },
    { key: "3h", label: "3 hours", minutes: 180 },
    { key: "tomorrow", label: "Tomorrow 9am", minutes: null, nextMorning: true },
    { key: "3d", label: "In 3 days", minutes: 60 * 24 * 3 },
    { key: "1w", label: "In 1 week", minutes: 60 * 24 * 7 },
];

export const CUSTOM_OFFSETS = [
    { key: "tomorrow", label: "Tomorrow", days: 1 },
    { key: "3d", label: "In 3 days", days: 3 },
    { key: "1w", label: "In 1 week", days: 7 },
    { key: "1m", label: "In 1 month", days: 30 },
];

/* ── date detection ──────────────────────────────────────────────────────────*/

const MONTHS = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Words that signal a date is actionable rather than incidental (e.g. the date
// a document was printed). Only dates near one of these become reminders.
const KEYWORDS = [
    "due", "expires", "expiry", "expiration", "valid until", "valid till",
    "renewal", "renew", "payment by", "pay by", "last date", "deadline",
    "before", "maturity", "settle by",
];

/**
 * Is this device's locale month-first (US-style) or day-first (most of the world)?
 *
 * "05/09/2026" is genuinely ambiguous — 5 Sep or 9 May depending on where the
 * reader lives. Guessing wrong schedules the reminder months off, so ask the
 * platform rather than hardcoding either convention: format a date whose month
 * and day cannot be confused and see which number the locale puts first.
 */
const MONTH_FIRST = (() => {
    try {
        // 2000-12-25 — day 25 can never be read as a month.
        const parts = new Intl.DateTimeFormat(undefined, {
            day: "numeric",
            month: "numeric",
            year: "numeric",
        }).formatToParts(new Date(2000, 11, 25));
        const first = parts.find((p) => p.type === "day" || p.type === "month");
        return first?.type === "month";
    } catch {
        return false; // day-first is the majority convention
    }
})();

function makeDate(y, m, d) {
    if (y < 100) y += 2000;
    const dt = new Date(y, m, d, FIRE_HOUR, 0, 0, 0);
    return isNaN(dt.getTime()) || dt.getFullYear() < 1990 || dt.getFullYear() > 2100 ? null : dt;
}

/**
 * Pull candidate dates out of free text along with the phrase around them,
 * so the UI can show "Payment due · 15 Sep 2026" rather than a bare date.
 */
export function extractDatesFromText(text) {
    if (!text || typeof text !== "string") return [];

    const found = [];
    const seen = new Set();

    const push = (date, index, ambiguous = false) => {
        if (!date) return;
        const key = date.toISOString().slice(0, 10);
        if (seen.has(key)) return;

        // Look at the 60 characters before the match for an intent keyword.
        const before = text.slice(Math.max(0, index - 60), index).toLowerCase();
        const hit = KEYWORDS.find((k) => before.includes(k));
        if (!hit) return; // a date with no intent word is noise

        seen.add(key);
        found.push({
            label: titleCase(hit),
            dateUtc: date.toISOString(),
            // Client-side parsing is never HIGH; a date whose day/month order we
            // had to guess from the locale is lower still.
            confidence: ambiguous ? "LOW" : "MEDIUM",
            source: "client",
        });
    };

    // 15/09/2026 or 09/15/2026 — separator-delimited, order decided below.
    for (const m of text.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g)) {
        const a = +m[1], b = +m[2], y = +m[3];

        // One of the two numbers being > 12 settles it outright. Only when both
        // could be a month does the device locale get a say — and that case is
        // downgraded to LOW confidence because we are guessing.
        let date;
        let ambiguous = false;
        if (a > 12) {
            date = makeDate(y, b - 1, a); // day-first
        } else if (b > 12) {
            date = makeDate(y, a - 1, b); // month-first
        } else {
            ambiguous = true;
            date = MONTH_FIRST ? makeDate(y, a - 1, b) : makeDate(y, b - 1, a);
        }
        push(date, m.index, ambiguous);
    }

    // 2026-09-15 (ISO)
    for (const m of text.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)) {
        push(makeDate(+m[1], +m[2] - 1, +m[3]), m.index);
    }

    // 15 Sep 2026 / 15 September 2026
    for (const m of text.matchAll(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{2,4})\b/g)) {
        const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
        if (mo === undefined) continue;
        push(makeDate(+m[3], mo, +m[1]), m.index);
    }

    // Sep 15, 2026 / September 15 2026
    for (const m of text.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})\b/g)) {
        const mo = MONTHS[m[1].slice(0, 3).toLowerCase()];
        if (mo === undefined) continue;
        push(makeDate(+m[3], mo, +m[2]), m.index);
    }

    return found.sort((a, b) => new Date(a.dateUtc) - new Date(b.dateUtc));
}

function titleCase(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Detect actionable dates for a document. Prefers the backend field when present.
 * Past dates are returned too, flagged `expired`, so the UI can say "this already
 * lapsed" instead of silently showing nothing.
 */
/** Whole calendar days from today to `when`, in local time. */
function daysUntil(when) {
    const a = new Date();
    a.setHours(0, 0, 0, 0);
    const b = new Date(when);
    b.setHours(0, 0, 0, 0);
    return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function detectDates(doc) {

    const raw =
        Array.isArray(doc?.detectedDates) && doc.detectedDates.length
            ? doc.detectedDates.map((d) => ({ ...d, source: "server" }))
            : extractDatesFromText(
                  [doc?.summary, doc?.extractedText].filter(Boolean).join("\n")
              );

    return raw
        .filter((d) => d?.dateUtc && !isNaN(new Date(d.dateUtc).getTime()))
        .map((d) => {
            const when = new Date(d.dateUtc);
            // Calendar days, not a rounded-up millisecond delta: a date later
            // today is 0 days away, and `Math.ceil` on the raw delta reported it
            // as 1 so "today" never appeared in the UI.
            const days = daysUntil(when);
            return { ...d, date: when, daysAway: days, expired: days < 0 };
        });
}

/* ── persistence ─────────────────────────────────────────────────────────────*/

function path() {
    return `${FileSystem.documentDirectory}${FILE}`;
}

export async function listReminders() {
    try {
        const info = await FileSystem.getInfoAsync(path());
        if (!info.exists) return [];
        const parsed = JSON.parse(await FileSystem.readAsStringAsync(path()));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// Every mutation is a read-modify-write of one JSON file. Two of them in flight
// at once (two "Remind me" taps, or a tap while the Tasks tab is loading) would
// both read the same list and the second write would drop the first record.
// Chaining through one promise makes the sequence safe without a real lock.
let writeChain = Promise.resolve();

function serialise(fn) {
    const next = writeChain.then(fn, fn);
    // Keep the chain alive even if one link rejects.
    writeChain = next.catch(() => {});
    return next;
}

async function writeAll(list) {
    await FileSystem.writeAsStringAsync(path(), JSON.stringify(list));
}

// A reminder is dead once its date is more than this far in the past. Without a
// sweep the file grows forever and — worse — `hasReminderFor` keeps reporting
// "Set" for a notification that fired months ago, so the user can never set a
// new one for that document and date.
const KEEP_PAST_DAYS = 60;

async function pruneStale(list) {
    const cutoff = Date.now() - KEEP_PAST_DAYS * 86400000;
    const live = list.filter((r) => {
        const t = new Date(r.dateUtc).getTime();
        return isNaN(t) || t >= cutoff;
    });
    if (live.length !== list.length) await writeAll(live);
    return live;
}

/* ── scheduling ──────────────────────────────────────────────────────────────*/

/**
 * Requests notification permission. Called only when the user taps "Remind me" —
 * never at launch, where prompts get denied and the channel is lost permanently.
 *
 * Returns a reason alongside the verdict: "simulator" and "denied" need
 * different copy, and offering "Open Settings" on a simulator sends the user
 * somewhere that cannot fix it.
 *
 * @returns {Promise<{ granted: boolean, reason?: "simulator" | "denied" }>}
 */
export async function ensurePermission() {
    if (!Device.isDevice) return { granted: false, reason: "simulator" };

    const { status } = await Notifications.getPermissionsAsync();
    if (status === "granted") return { granted: true };

    const req = await Notifications.requestPermissionsAsync();
    return req.status === "granted" ? { granted: true } : { granted: false, reason: "denied" };
}

/**
 * Schedules a reminder. Returns the stored record, or null when the computed
 * fire time is already in the past.
 */
/**
 * Schedules a reminder.
 *
 * @returns the stored record, or a `{ error }` object the caller can explain:
 *   { error: "duplicate" } — this document already has a reminder for that day
 *   { error: "past" }      — the computed fire time has already gone by
 *
 * The duplicate check lives HERE, not only in the UI. The card hides the button
 * once a date is marked set, but that state is a snapshot taken on mount: the
 * custom-date path never consulted it at all, so the same day could be added
 * over and over. Guarding at the only place that writes a record makes every
 * entry point safe, including ones added later.
 */
export async function scheduleReminder({ docId, docTitle, label, dateUtc, leadDays = 3, allowDuplicate = false }) {
    const due = new Date(dateUtc);

    if (!allowDuplicate && (await hasReminderFor(docId, dateUtc))) {
        return { error: "duplicate" };
    }

    const fire = new Date(due);
    fire.setDate(fire.getDate() - leadDays);
    fire.setHours(FIRE_HOUR, 0, 0, 0);

    if (fire.getTime() <= Date.now()) return { error: "past" };

    const body =
        leadDays === 0
            ? `${label} today — ${docTitle}`
            : `${label} in ${leadDays} day${leadDays === 1 ? "" : "s"} — ${docTitle}`;

    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title: docTitle || "PaperAI reminder",
            body,
            data: { type: "reminder", docId },
        },
        trigger: { type: "date", date: fire },
    });

    const record = {
        id: `rem_${Date.now()}`,
        notificationId,
        docId,
        docTitle,
        label,
        dateUtc: due.toISOString(),
        fireAtUtc: fire.toISOString(),
        leadDays,
        createdAt: new Date().toISOString(),
    };

    await serialise(async () => {
        const all = await pruneStale(await listReminders());
        await writeAll([...all, record]);
    });
    return record;
}

/**
 * Reschedules an existing reminder to fire later (Advance tier).
 *
 * Cancels the OS notification and replaces the record rather than adding a
 * second one — a snoozed reminder is the same reminder, and leaving the original
 * scheduled would fire it twice.
 *
 * @returns the new record, or { error: "past" } / { error: "missing" }
 */
export async function snoozeReminder(id, option) {
    const all = await listReminders();
    const target = all.find((r) => r.id === id);
    if (!target) return { error: "missing" };

    let fire;
    if (option?.nextMorning) {
        fire = new Date();
        fire.setDate(fire.getDate() + 1);
        fire.setHours(FIRE_HOUR, 0, 0, 0);
    } else {
        fire = new Date(Date.now() + (option?.minutes ?? 60) * 60000);
    }

    if (fire.getTime() <= Date.now()) return { error: "past" };

    if (target.notificationId) {
        await Notifications.cancelScheduledNotificationAsync(target.notificationId).catch(() => {});
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title: target.docTitle || "PaperAI reminder",
            body: `${target.label} — ${target.docTitle}`,
            data: { type: "reminder", docId: target.docId },
        },
        trigger: { type: "date", date: fire },
    });

    return serialise(async () => {
        const list = await listReminders();
        const next = list.map((r) =>
            r.id === id
                ? {
                      ...r,
                      notificationId,
                      fireAtUtc: fire.toISOString(),
                      snoozedAtUtc: new Date().toISOString(),
                      snoozeCount: (r.snoozeCount ?? 0) + 1,
                  }
                : r
        );
        await writeAll(next);
        return next.find((r) => r.id === id);
    });
}

/** Cancels a reminder, including the OS-level scheduled notification. */
export async function cancelReminder(id) {
    return serialise(async () => {
        const all = await listReminders();
        const target = all.find((r) => r.id === id);

        if (target?.notificationId) {
            await Notifications.cancelScheduledNotificationAsync(target.notificationId).catch(() => {});
        }

        const next = all.filter((r) => r.id !== id);
        await writeAll(next);
        return next;
    });
}

/** True when this document already has a reminder for that exact date. */
export async function hasReminderFor(docId, dateUtc) {
    const all = await listReminders();
    const day = new Date(dateUtc).toISOString().slice(0, 10);
    const cutoff = Date.now() - KEEP_PAST_DAYS * 86400000;
    // Ignore records old enough to be swept — otherwise a long-fired reminder
    // keeps the row showing "Set" and the user can never schedule a new one.
    return all.some(
        (r) =>
            r.docId === docId &&
            r.dateUtc.slice(0, 10) === day &&
            new Date(r.dateUtc).getTime() >= cutoff
    );
}

/** Splits stored reminders into upcoming and past, newest-first within each. */
export async function groupedReminders() {
    const all = await serialise(async () => pruneStale(await listReminders()));
    const now = Date.now();
    const upcoming = [];
    const past = [];

    for (const r of all) {
        (new Date(r.dateUtc).getTime() >= now ? upcoming : past).push(r);
    }

    upcoming.sort((a, b) => new Date(a.dateUtc) - new Date(b.dateUtc));
    past.sort((a, b) => new Date(b.dateUtc) - new Date(a.dateUtc));
    return { upcoming, past };
}

/** Human date used across the reminder UI. */
export function formatDate(d) {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/* ── task alerts ─────────────────────────────────────────────────────────────
 *
 * The Assistant's due-date notifications. Same mechanism as document reminders —
 * same permission gate, same OS scheduling, same serialised read-modify-write —
 * but stored in their own file.
 *
 * Sharing `reminders.json` would put task records into `groupedReminders()`,
 * which every document-reminder screen renders assuming a `docTitle` and a
 * `label`. Separate storage keeps that proven path exactly as it was.
 *
 * A task alert always fires at its exact `dueAtUtc`. When the user picked a date
 * but no time, the Assistant sends 09:00 local for that day (matching FIRE_HOUR
 * above), so there is one absolute instant here and no timezone guessing.
 */

const TASK_FILE = "task-reminders.json";

function taskPath() {
    return `${FileSystem.documentDirectory}${TASK_FILE}`;
}

export async function listTaskAlerts() {
    try {
        const info = await FileSystem.getInfoAsync(taskPath());
        if (!info.exists) return [];
        const parsed = JSON.parse(await FileSystem.readAsStringAsync(taskPath()));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeAllTaskAlerts(list) {
    await FileSystem.writeAsStringAsync(taskPath(), JSON.stringify(list));
}

async function pruneStaleTaskAlerts(list) {
    const cutoff = Date.now() - KEEP_PAST_DAYS * 86400000;
    const live = list.filter((a) => {
        const time = new Date(a.fireAtUtc).getTime();
        return isNaN(time) || time >= cutoff;
    });
    if (live.length !== list.length) await writeAllTaskAlerts(live);
    return live;
}

/** Cancels the OS notification for a task and forgets the record. Safe to call twice. */
export async function cancelTaskAlert(taskId) {
    return serialise(async () => {
        const all = await listTaskAlerts();
        const target = all.find((a) => a.taskId === taskId);

        if (target?.notificationId) {
            await Notifications.cancelScheduledNotificationAsync(target.notificationId).catch(() => {});
        }

        const next = all.filter((a) => a.taskId !== taskId);
        if (next.length !== all.length) await writeAllTaskAlerts(next);
        return next;
    });
}

/**
 * Schedules (or reschedules) the alert for one task.
 *
 * Always replaces any existing alert for that task first: editing a due date
 * must move the notification, not add a second one.
 *
 * @returns the stored record, or { error: "past" } when the due time has gone by.
 */
export async function scheduleTaskAlert({ taskId, title, description, dueAtUtc }) {
    if (!taskId || !dueAtUtc) return { error: "past" };

    const fire = new Date(dueAtUtc);
    if (isNaN(fire.getTime()) || fire.getTime() <= Date.now()) {
        // Still clear any stale alert, so an overdue edit does not leave the old
        // notification scheduled.
        await cancelTaskAlert(taskId);
        return { error: "past" };
    }

    await cancelTaskAlert(taskId);

    const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
            title: title || "PaperAI task",
            // The description is what makes the reminder useful — it is the line
            // the user wrote to their future self.
            body: description ? String(description).slice(0, 180) : "Task due now.",
            data: { type: "task", taskId },
        },
        trigger: { type: "date", date: fire },
    });

    const record = {
        id: `task_${taskId}`,
        taskId,
        notificationId,
        title: title || "",
        fireAtUtc: fire.toISOString(),
        createdAt: new Date().toISOString(),
    };

    await serialise(async () => {
        const all = await pruneStaleTaskAlerts(await listTaskAlerts());
        await writeAllTaskAlerts([...all.filter((a) => a.taskId !== taskId), record]);
    });

    return record;
}

/** { [taskId]: record } — what the Assistant needs to show an alarm on a row. */
export async function taskAlertMap() {
    const all = await serialise(async () => pruneStaleTaskAlerts(await listTaskAlerts()));
    const map = {};
    for (const alert of all) map[alert.taskId] = alert;
    return map;
}
