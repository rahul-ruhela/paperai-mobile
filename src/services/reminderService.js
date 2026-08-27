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
export async function scheduleReminder({ docId, docTitle, label, dateUtc, leadDays = 3 }) {
    const due = new Date(dateUtc);
    const fire = new Date(due);
    fire.setDate(fire.getDate() - leadDays);
    fire.setHours(FIRE_HOUR, 0, 0, 0);

    if (fire.getTime() <= Date.now()) return null;

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
