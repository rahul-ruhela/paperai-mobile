// Regression: a repeating task must keep alerting after it is completed.
//
// Completing a repeating task makes the server close the current row and return
// the successor it created as `next`. The notification is LOCAL, so nothing is
// scheduled for that successor unless the client does it. Before this was
// wired, a WEEKLY task alerted exactly once and then went silent for ever —
// the rows kept appearing in the list, so the repeat looked like it worked.
//
// This pins the client half of that contract: the shape the screen relies on,
// and the scheduling call it must make.

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
import { scheduleTaskAlert, cancelTaskAlert, taskAlertMap } from "../src/services/reminderService";

const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString();

beforeEach(() => {
    mockFiles = {};
    jest.clearAllMocks();
});

/**
 * The exact sequence AssistantScreen.toggleDone performs when completing a
 * task. Kept as a helper so the assertions below describe behaviour rather than
 * re-stating the screen's internals in every case.
 */
async function completeAndReschedule(task, serverResponse) {
    await cancelTaskAlert(task.id);

    const next = serverResponse?.next;
    if (next?.id && next?.dueAtUtc) {
        return scheduleTaskAlert({
            taskId: next.id,
            title: next.title,
            description: next.description,
            dueAtUtc: next.dueAtUtc,
        });
    }
    return null;
}

describe("completing a repeating task", () => {
    it("schedules an alert for the successor the server created", async () => {
        const task = { id: "task-1", title: "Water the plants", repeat: "WEEKLY" };
        await scheduleTaskAlert({ taskId: task.id, title: task.title, dueAtUtc: inDays(1) });
        Notifications.scheduleNotificationAsync.mockClear();

        const nextDue = inDays(8);
        const record = await completeAndReschedule(task, {
            task: { ...task, status: "DONE" },
            next: { id: "task-2", title: "Water the plants", dueAtUtc: nextDue, repeat: "WEEKLY" },
        });

        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
        expect(record.taskId).toBe("task-2");
        expect(record.fireAtUtc).toBe(new Date(nextDue).toISOString());

        // The successor is the one that must be armed now.
        const map = await taskAlertMap();
        expect(map["task-2"]).toBeTruthy();
    });

    it("carries the description into the successor's notification body", async () => {
        const record = await completeAndReschedule(
            { id: "task-1" },
            {
                next: {
                    id: "task-2",
                    title: "Pay rent",
                    description: "Standing order, check it cleared",
                    dueAtUtc: inDays(30),
                },
            }
        );

        expect(record).toBeTruthy();
        const [[payload]] = Notifications.scheduleNotificationAsync.mock.calls;
        expect(payload.content.body).toBe("Standing order, check it cleared");
        expect(payload.content.data).toEqual({ type: "task", taskId: "task-2" });
    });

    it("clears the completed task's own alert so it cannot still fire", async () => {
        await scheduleTaskAlert({ taskId: "task-1", title: "A", dueAtUtc: inDays(1) });

        await completeAndReschedule(
            { id: "task-1" },
            { next: { id: "task-2", title: "A", dueAtUtc: inDays(8) } }
        );

        const map = await taskAlertMap();
        expect(map["task-1"]).toBeUndefined();
        expect(map["task-2"]).toBeTruthy();
    });

    it("schedules nothing for a non-repeating task, whose next is null", async () => {
        await scheduleTaskAlert({ taskId: "task-1", title: "A", dueAtUtc: inDays(1) });
        Notifications.scheduleNotificationAsync.mockClear();

        const record = await completeAndReschedule({ id: "task-1" }, { task: {}, next: null });

        expect(record).toBeNull();
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        expect(await taskAlertMap()).toEqual({});
    });

    it("schedules nothing when the successor has no due date", async () => {
        const record = await completeAndReschedule(
            { id: "task-1" },
            { next: { id: "task-2", title: "A", dueAtUtc: null } }
        );

        expect(record).toBeNull();
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it("reports 'past' rather than arming an already-overdue successor", async () => {
        const record = await completeAndReschedule(
            { id: "task-1" },
            { next: { id: "task-2", title: "A", dueAtUtc: inDays(-1) } }
        );

        expect(record).toEqual({ error: "past" });
        expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
});
