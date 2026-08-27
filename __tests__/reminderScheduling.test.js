// Scheduling rules, with a fake in-memory filesystem standing in for the JSON
// store. The duplicate guard is the reason this file exists: the same day could
// be added over and over from the custom-date path, because the only check lived
// in the card's UI state and that path never consulted it.

// `mock` prefix is required: jest.mock factories are hoisted above the file,
// and only variables matching that convention may be referenced from them.
let mockFiles = {};

jest.mock("expo-notifications", () => ({
    getPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    scheduleNotificationAsync: jest.fn(async () => `notif_${Math.random()}`),
    cancelScheduledNotificationAsync: jest.fn(async () => {}),
}));
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///docs/",
    getInfoAsync: jest.fn(async (p) => ({ exists: p in mockFiles })),
    readAsStringAsync: jest.fn(async (p) => mockFiles[p]),
    writeAsStringAsync: jest.fn(async (p, c) => {
        mockFiles[p] = c;
    }),
}));

import * as Notifications from "expo-notifications";
import {
    scheduleReminder,
    snoozeReminder,
    cancelReminder,
    hasReminderFor,
    listReminders,
    SNOOZE_OPTIONS,
} from "../src/services/reminderService";

/** A date `days` from now at 09:00 local. */
const inDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
};

const base = { docId: "doc-1", docTitle: "Electricity bill", label: "Due" };

beforeEach(() => {
    mockFiles = {};
    jest.clearAllMocks();
});

describe("duplicate reminders", () => {
    test("a second reminder for the same day is refused", async () => {
        const when = inDays(10);

        const first = await scheduleReminder({ ...base, dateUtc: when, leadDays: 0 });
        expect(first.id).toBeTruthy();

        const second = await scheduleReminder({ ...base, dateUtc: when, leadDays: 0 });
        expect(second).toEqual({ error: "duplicate" });

        expect(await listReminders()).toHaveLength(1);
    });

    test("refused regardless of the time of day on that date", async () => {
        // The custom-date path sets 09:00; a detected date can carry any time.
        // Both describe the same calendar day and must collide.
        const day = new Date();
        day.setDate(day.getDate() + 5);

        const morning = new Date(day);
        morning.setHours(9, 0, 0, 0);
        const evening = new Date(day);
        evening.setHours(21, 30, 0, 0);

        await scheduleReminder({ ...base, dateUtc: morning.toISOString(), leadDays: 0 });
        const dupe = await scheduleReminder({ ...base, dateUtc: evening.toISOString(), leadDays: 0 });

        expect(dupe).toEqual({ error: "duplicate" });
    });

    test("refused even when the lead time differs", async () => {
        // Same due date, different lead — still one reminder for that date.
        const when = inDays(20);
        await scheduleReminder({ ...base, dateUtc: when, leadDays: 1 });
        const dupe = await scheduleReminder({ ...base, dateUtc: when, leadDays: 7 });

        expect(dupe).toEqual({ error: "duplicate" });
        expect(await listReminders()).toHaveLength(1);
    });

    test("a different day on the same document is allowed", async () => {
        await scheduleReminder({ ...base, dateUtc: inDays(10), leadDays: 0 });
        const other = await scheduleReminder({ ...base, dateUtc: inDays(11), leadDays: 0 });

        expect(other.id).toBeTruthy();
        expect(await listReminders()).toHaveLength(2);
    });

    test("the same day on a different document is allowed", async () => {
        const when = inDays(10);
        await scheduleReminder({ ...base, dateUtc: when, leadDays: 0 });
        const other = await scheduleReminder({ ...base, docId: "doc-2", dateUtc: when, leadDays: 0 });

        expect(other.id).toBeTruthy();
        expect(await listReminders()).toHaveLength(2);
    });

    test("cancelling frees the day again", async () => {
        const when = inDays(10);
        const first = await scheduleReminder({ ...base, dateUtc: when, leadDays: 0 });

        expect(await hasReminderFor("doc-1", when)).toBe(true);
        await cancelReminder(first.id);
        expect(await hasReminderFor("doc-1", when)).toBe(false);

        const again = await scheduleReminder({ ...base, dateUtc: when, leadDays: 0 });
        expect(again.id).toBeTruthy();
    });

    test("no OS notification is scheduled for a refused duplicate", async () => {
        const when = inDays(10);
        await scheduleReminder({ ...base, dateUtc: when, leadDays: 0 });
        Notifications.scheduleNotificationAsync.mockClear();

        await scheduleReminder({ ...base, dateUtc: when, leadDays: 0 });
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
});

describe("past dates", () => {
    test("a lead time that has already passed is refused", async () => {
        const result = await scheduleReminder({ ...base, dateUtc: inDays(1), leadDays: 7 });
        expect(result).toEqual({ error: "past" });
    });

    test("refusing a past date does not store anything", async () => {
        await scheduleReminder({ ...base, dateUtc: inDays(1), leadDays: 7 });
        expect(await listReminders()).toHaveLength(0);
    });
});

describe("snooze", () => {
    test("moves the fire time and does not create a second reminder", async () => {
        const rec = await scheduleReminder({ ...base, dateUtc: inDays(10), leadDays: 0 });
        const before = new Date(rec.fireAtUtc).getTime();

        const snoozed = await snoozeReminder(rec.id, { minutes: 60 });

        expect(await listReminders()).toHaveLength(1);
        expect(new Date(snoozed.fireAtUtc).getTime()).not.toBe(before);
        expect(snoozed.snoozeCount).toBe(1);
    });

    test("cancels the previous OS notification so it cannot fire twice", async () => {
        const rec = await scheduleReminder({ ...base, dateUtc: inDays(10), leadDays: 0 });
        await snoozeReminder(rec.id, { minutes: 60 });

        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(rec.notificationId);
    });

    test("snoozing twice counts twice", async () => {
        const rec = await scheduleReminder({ ...base, dateUtc: inDays(10), leadDays: 0 });
        await snoozeReminder(rec.id, { minutes: 60 });
        const twice = await snoozeReminder(rec.id, { minutes: 60 });

        expect(twice.snoozeCount).toBe(2);
        expect(await listReminders()).toHaveLength(1);
    });

    test("'tomorrow morning' lands at 9am tomorrow", async () => {
        const rec = await scheduleReminder({ ...base, dateUtc: inDays(10), leadDays: 0 });
        const opt = SNOOZE_OPTIONS.find((o) => o.nextMorning);

        const snoozed = await snoozeReminder(rec.id, opt);
        const fire = new Date(snoozed.fireAtUtc);
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        expect(fire.getHours()).toBe(9);
        expect(fire.getDate()).toBe(tomorrow.getDate());
    });

    test("an unknown reminder is reported, not thrown", async () => {
        expect(await snoozeReminder("nope", { minutes: 60 })).toEqual({ error: "missing" });
    });

    test("snoozing does not change the due date, only the fire time", async () => {
        // The bill is still due when it is due — snooze moves the nudge.
        const due = inDays(10);
        const rec = await scheduleReminder({ ...base, dateUtc: due, leadDays: 0 });
        const snoozed = await snoozeReminder(rec.id, { minutes: 60 });

        expect(snoozed.dateUtc).toBe(rec.dateUtc);
    });
});
