// The "try it" reminder (see reminderService.scheduleTestReminder).
//
// A visible feature for everyone rather than a hidden or account-gated one: a
// reminder is the one part of the app a user cannot evaluate without waiting for
// a real due date, and anything unlockable-by-secret would be a guideline 2.3.1
// problem for no product gain.

const mockNotifications = {
    scheduleNotificationAsync: jest.fn(async () => "notif-1"),
    cancelScheduledNotificationAsync: jest.fn(async () => {}),
    getPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
    getAllScheduledNotificationsAsync: jest.fn(async () => []),
    setNotificationHandler: jest.fn(),
    AndroidImportance: { DEFAULT: 3, HIGH: 4 },
    setNotificationChannelAsync: jest.fn(async () => {}),
};

jest.mock("expo-notifications", () => mockNotifications);
// A getter, because the babel ESM interop namespace object reminderService
// imports is not reliably writable from here.
const mockDevice = { isDevice: true };
jest.mock("expo-device", () => ({
    get isDevice() {
        return mockDevice.isDevice;
    },
}));
jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///docs/",
    getInfoAsync: jest.fn(async () => ({ exists: false })),
    readAsStringAsync: jest.fn(async () => "[]"),
    writeAsStringAsync: jest.fn(async () => {}),
    deleteAsync: jest.fn(async () => {}),
}));

const {
    TEST_REMINDER_DELAY_MS,
    TEST_REMINDER_CHOICES,
    scheduleTestReminder,
} = require("../src/services/reminderService");

beforeEach(() => {
    jest.clearAllMocks();
    mockDevice.isDevice = true;
    mockNotifications.getPermissionsAsync.mockResolvedValue({ status: "granted" });
});

describe("scheduleTestReminder", () => {
    it("fires a minute out", async () => {
        const before = Date.now();
        const result = await scheduleTestReminder();

        expect(result.ok).toBe(true);
        const delay = new Date(result.fireAt).getTime() - before;
        expect(delay).toBeGreaterThanOrEqual(TEST_REMINDER_DELAY_MS - 50);
        expect(delay).toBeLessThan(TEST_REMINDER_DELAY_MS + 2000);
    });

    it("schedules a real notification with a date trigger", async () => {
        await scheduleTestReminder();
        const [args] = mockNotifications.scheduleNotificationAsync.mock.calls[0];
        expect(args.trigger.type).toBe("date");
        expect(args.content.title).toBeTruthy();
        expect(args.content.data.type).toBe("test");
    });

    it("says what it is, so nobody mistakes it for a real task", async () => {
        await scheduleTestReminder();
        const [args] = mockNotifications.scheduleNotificationAsync.mock.calls[0];
        expect(`${args.content.title} ${args.content.body}`).toMatch(/reminder/i);
    });

    it("asks for permission at the point of use", async () => {
        mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: "undetermined" });
        await scheduleTestReminder();
        expect(mockNotifications.requestPermissionsAsync).toHaveBeenCalled();
    });

    it("reports a refusal instead of scheduling into the void", async () => {
        mockNotifications.getPermissionsAsync.mockResolvedValueOnce({ status: "denied" });
        mockNotifications.requestPermissionsAsync.mockResolvedValueOnce({ status: "denied" });

        const result = await scheduleTestReminder();
        expect(result).toEqual({ ok: false, reason: "denied" });
        expect(mockNotifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it("distinguishes a simulator from a refusal", async () => {
        // Telling someone to check their Settings when the real problem is that
        // notifications do not exist on a simulator sends them somewhere with
        // nothing to fix.
        mockDevice.isDevice = false;
        expect(await scheduleTestReminder()).toEqual({ ok: false, reason: "simulator" });
    });

    it("reports a scheduling failure rather than claiming success", async () => {
        mockNotifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error("nope"));
        expect(await scheduleTestReminder()).toEqual({ ok: false, reason: "failed" });
    });

    it("does not write itself into the task alert store", async () => {
        // It belongs to no task, so it must not show as an alarm on a row or be
        // cancelled when some unrelated task is edited.
        const FS = require("expo-file-system/legacy");
        await scheduleTestReminder();
        expect(FS.writeAsStringAsync).not.toHaveBeenCalled();
    });
});

describe("scheduleTestReminder delay choices", () => {
    it.each(TEST_REMINDER_CHOICES)("schedules %i minute(s) out when asked", async (minutes) => {
        const before = Date.now();
        const result = await scheduleTestReminder(minutes);

        expect(result.ok).toBe(true);
        expect(result.minutes).toBe(minutes);
        const delay = new Date(result.fireAt).getTime() - before;
        const expected = minutes * TEST_REMINDER_DELAY_MS;
        expect(delay).toBeGreaterThanOrEqual(expected - 50);
        expect(delay).toBeLessThan(expected + 2000);
    });

    // A delay the UI does not offer must not be schedulable: a "test" reminder
    // arriving hours later is one the user has stopped expecting.
    it.each([0, -5, 7, 120, 1.5, NaN, "10", null, undefined])(
        "falls back to one minute for %p",
        async (bad) => {
            const before = Date.now();
            const result = await scheduleTestReminder(bad);

            expect(result.ok).toBe(true);
            expect(result.minutes).toBe(1);
            const delay = new Date(result.fireAt).getTime() - before;
            expect(delay).toBeLessThan(TEST_REMINDER_DELAY_MS + 2000);
        }
    );

    it("says how long it will be in the notification body", async () => {
        await scheduleTestReminder(10);
        const [args] = mockNotifications.scheduleNotificationAsync.mock.calls[0];
        expect(args.content.body).toContain("10 minutes");

        mockNotifications.scheduleNotificationAsync.mockClear();
        await scheduleTestReminder(1);
        const [single] = mockNotifications.scheduleNotificationAsync.mock.calls[0];
        expect(single.content.body).toContain("1 minute");
        expect(single.content.body).not.toContain("1 minutes");
    });
});
