// Assistant task alerts: the local notification behind a task's due date.
//
// These share reminderService with document reminders but keep their own store
// file. The separation is the point of several assertions below — a task record
// leaking into reminders.json would land in groupedReminders(), which every
// document-reminder view renders assuming a docTitle and a label.

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
    scheduleTaskAlert,
    cancelTaskAlert,
    listTaskAlerts,
    taskAlertMap,
    listReminders,
} from "../src/services/reminderService";

const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString();

beforeEach(() => {
    mockFiles = {};
    jest.clearAllMocks();
});

describe("scheduleTaskAlert", () => {
    it("schedules a notification carrying the task id, and stores the record", async () => {
        const dueAtUtc = inDays(2);

        const record = await scheduleTaskAlert({
            taskId: "task-1",
            title: "Submit report",
            description: "Send the final report before Friday.",
            dueAtUtc,
        });

        expect(record.taskId).toBe("task-1");
        expect(record.fireAtUtc).toBe(new Date(dueAtUtc).toISOString());

        const [call] = Notifications.scheduleNotificationAsync.mock.calls;
        expect(call[0].content.data).toEqual({ type: "task", taskId: "task-1" });
        expect(call[0].content.title).toBe("Submit report");
        // The description is the line the user wrote to their future self — it is
        // what makes the notification worth reading.
        expect(call[0].content.body).toBe("Send the final report before Friday.");

        expect(await listTaskAlerts()).toHaveLength(1);
    });

    it("falls back to a plain body when the task has no description", async () => {
        await scheduleTaskAlert({ taskId: "task-1", title: "Call plumber", dueAtUtc: inDays(1) });

        const [call] = Notifications.scheduleNotificationAsync.mock.calls;
        expect(call[0].content.body).toBe("Task due now.");
    });

    it("replaces the previous alert instead of adding a second one", async () => {
        const movedTo = inDays(3);
        const first = await scheduleTaskAlert({ taskId: "task-1", title: "A", dueAtUtc: inDays(1) });

        await scheduleTaskAlert({ taskId: "task-1", title: "A", dueAtUtc: movedTo });

        // Editing a due date must move the notification, not leave the old one
        // scheduled to fire at the original time.
        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(first.notificationId);

        const alerts = await listTaskAlerts();
        expect(alerts).toHaveLength(1);
        expect(alerts[0].fireAtUtc).toBe(new Date(movedTo).toISOString());
    });

    it("refuses a due time that has already passed and schedules nothing", async () => {
        const result = await scheduleTaskAlert({ taskId: "task-1", title: "Late", dueAtUtc: inDays(-1) });

        expect(result).toEqual({ error: "past" });
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        expect(await listTaskAlerts()).toHaveLength(0);
    });

    it("clears a live alert when the task is edited to a past due time", async () => {
        const first = await scheduleTaskAlert({ taskId: "task-1", title: "A", dueAtUtc: inDays(2) });

        const result = await scheduleTaskAlert({ taskId: "task-1", title: "A", dueAtUtc: inDays(-2) });

        expect(result).toEqual({ error: "past" });
        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(first.notificationId);
        expect(await listTaskAlerts()).toHaveLength(0);
    });

    it("treats a missing task id or due date as nothing to schedule", async () => {
        expect(await scheduleTaskAlert({ taskId: "task-1" })).toEqual({ error: "past" });
        expect(await scheduleTaskAlert({ dueAtUtc: inDays(1) })).toEqual({ error: "past" });
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
});

describe("cancelTaskAlert", () => {
    it("cancels the OS notification and forgets the record", async () => {
        const record = await scheduleTaskAlert({ taskId: "task-1", title: "A", dueAtUtc: inDays(1) });

        await cancelTaskAlert("task-1");

        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(record.notificationId);
        expect(await listTaskAlerts()).toHaveLength(0);
    });

    it("is safe to call for a task that has no alert", async () => {
        await expect(cancelTaskAlert("never-scheduled")).resolves.toEqual([]);
        expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it("leaves other tasks' alerts alone", async () => {
        await scheduleTaskAlert({ taskId: "task-1", title: "A", dueAtUtc: inDays(1) });
        await scheduleTaskAlert({ taskId: "task-2", title: "B", dueAtUtc: inDays(2) });

        await cancelTaskAlert("task-1");

        const alerts = await listTaskAlerts();
        expect(alerts).toHaveLength(1);
        expect(alerts[0].taskId).toBe("task-2");
    });
});

describe("taskAlertMap", () => {
    it("keys live alerts by task id", async () => {
        await scheduleTaskAlert({ taskId: "task-1", title: "A", dueAtUtc: inDays(1) });
        await scheduleTaskAlert({ taskId: "task-2", title: "B", dueAtUtc: inDays(2) });

        const map = await taskAlertMap();

        expect(Object.keys(map).sort()).toEqual(["task-1", "task-2"]);
        expect(map["task-1"].title).toBe("A");
    });
});

describe("store isolation", () => {
    it("never writes task alerts into the document reminder file", async () => {
        await scheduleTaskAlert({ taskId: "task-1", title: "A", dueAtUtc: inDays(1) });

        expect(await listReminders()).toEqual([]);
        expect(Object.keys(mockFiles)).toEqual(["file:///docs/task-reminders.json"]);
    });
});
