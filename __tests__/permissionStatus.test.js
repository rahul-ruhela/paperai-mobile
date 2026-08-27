// The permission panel's whole value is that it tells the truth about what the
// OS has granted. Two things can break that quietly, so both are pinned here:
// the response -> display-state mapping, and the promise that reading status
// never fires a prompt (iOS gives exactly one, and spending it on a settings
// screen spends it where the user has no reason to say yes).

const mockRequestSpies = {
    camera: jest.fn(),
    microphone: jest.fn(),
    mediaLibrary: jest.fn(),
    imagePicker: jest.fn(),
    notifications: jest.fn(),
};

const mockGetters = {
    camera: jest.fn(),
    mediaLibrary: jest.fn(),
    imagePicker: jest.fn(),
    notifications: jest.fn(),
};

jest.mock("expo-camera", () => ({
    getCameraPermissionsAsync: (...a) => mockGetters.camera(...a),
    requestCameraPermissionsAsync: (...a) => mockRequestSpies.camera(...a),
    getMicrophonePermissionsAsync: jest.fn(),
    requestMicrophonePermissionsAsync: (...a) => mockRequestSpies.microphone(...a),
}));

jest.mock("expo-media-library", () => ({
    getPermissionsAsync: (...a) => mockGetters.mediaLibrary(...a),
    requestPermissionsAsync: (...a) => mockRequestSpies.mediaLibrary(...a),
    presentPermissionsPickerAsync: jest.fn(),
}));

jest.mock("expo-image-picker", () => ({
    getMediaLibraryPermissionsAsync: (...a) => mockGetters.imagePicker(...a),
    requestMediaLibraryPermissionsAsync: (...a) => mockRequestSpies.imagePicker(...a),
}));

jest.mock("expo-notifications", () => ({
    getPermissionsAsync: (...a) => mockGetters.notifications(...a),
    requestPermissionsAsync: (...a) => mockRequestSpies.notifications(...a),
}));

const {
    toDisplayState,
    mergePhotoStates,
    getAllStatuses,
    STATE,
} = require("../src/services/permissionStatus");

// The shapes Expo actually returns on iOS.
const granted = { status: "granted", granted: true, canAskAgain: false };
const denied = { status: "denied", granted: false, canAskAgain: false };
const undetermined = { status: "undetermined", granted: false, canAskAgain: true };
const limited = { status: "granted", granted: true, canAskAgain: false, accessPrivileges: "limited" };

beforeEach(() => {
    for (const spy of Object.values(mockRequestSpies)) spy.mockClear();
    mockGetters.camera.mockResolvedValue(granted);
    mockGetters.mediaLibrary.mockResolvedValue(granted);
    mockGetters.imagePicker.mockResolvedValue(granted);
    mockGetters.notifications.mockResolvedValue(granted);
});

describe("toDisplayState", () => {
    it("maps the four states Expo reports", () => {
        expect(toDisplayState(granted)).toBe(STATE.GRANTED);
        expect(toDisplayState(denied)).toBe(STATE.DENIED);
        expect(toDisplayState(undetermined)).toBe(STATE.UNDETERMINED);
        expect(toDisplayState(limited)).toBe(STATE.LIMITED);
    });

    it("reports limited photo access as limited, not as allowed", () => {
        // iOS reports limited as granted:true. Reading only `granted` is what
        // makes a partial library scan look like it covered everything.
        expect(limited.granted).toBe(true);
        expect(toDisplayState(limited)).toBe(STATE.LIMITED);
    });

    it("falls back to canAskAgain when the status string is unrecognised", () => {
        expect(toDisplayState({ canAskAgain: true })).toBe(STATE.UNDETERMINED);
        expect(toDisplayState({ canAskAgain: false })).toBe(STATE.DENIED);
        expect(toDisplayState({ status: "provisional", granted: true })).toBe(STATE.GRANTED);
    });

    it("says unknown rather than guessing when there is no response", () => {
        expect(toDisplayState(null)).toBe(STATE.UNKNOWN);
        expect(toDisplayState(undefined)).toBe(STATE.UNKNOWN);
        expect(toDisplayState("granted")).toBe(STATE.UNKNOWN);
    });
});

describe("mergePhotoStates", () => {
    it("keeps the more restrictive of the two readers", () => {
        expect(mergePhotoStates(STATE.GRANTED, STATE.LIMITED)).toBe(STATE.LIMITED);
        expect(mergePhotoStates(STATE.GRANTED, STATE.DENIED)).toBe(STATE.DENIED);
        expect(mergePhotoStates(STATE.DENIED, STATE.LIMITED)).toBe(STATE.LIMITED);
        expect(mergePhotoStates(STATE.UNDETERMINED, STATE.GRANTED)).toBe(STATE.UNDETERMINED);
    });

    it("is order-independent", () => {
        expect(mergePhotoStates(STATE.LIMITED, STATE.GRANTED)).toBe(STATE.LIMITED);
        expect(mergePhotoStates(STATE.DENIED, STATE.GRANTED)).toBe(STATE.DENIED);
    });

    it("lets the working reader win when the other failed", () => {
        expect(mergePhotoStates(STATE.UNKNOWN, STATE.GRANTED)).toBe(STATE.GRANTED);
        expect(mergePhotoStates(STATE.DENIED, STATE.UNKNOWN)).toBe(STATE.DENIED);
        expect(mergePhotoStates(STATE.UNKNOWN, STATE.UNKNOWN)).toBe(STATE.UNKNOWN);
    });
});

describe("getAllStatuses", () => {
    it("never calls a request API", async () => {
        // Spec §5 / §6.2. This is the test that must not be relaxed.
        for (const state of [granted, denied, undetermined, limited]) {
            mockGetters.camera.mockResolvedValue(state);
            mockGetters.mediaLibrary.mockResolvedValue(state);
            mockGetters.imagePicker.mockResolvedValue(state);
            mockGetters.notifications.mockResolvedValue(state);
            await getAllStatuses();
        }

        for (const [name, spy] of Object.entries(mockRequestSpies)) {
            expect([name, spy.mock.calls.length]).toEqual([name, 0]);
        }
    });

    it("returns the five rows the panel renders, in order", async () => {
        const rows = await getAllStatuses();
        expect(rows.map((r) => r.key)).toEqual([
            "camera",
            "photos",
            "notifications",
            "microphone",
            "location",
        ]);
    });

    it("marks microphone and location as not used and reads no state for them", async () => {
        const rows = await getAllStatuses();
        for (const key of ["microphone", "location"]) {
            const row = rows.find((r) => r.key === key);
            expect(row.usedByApp).toBe(false);
            expect(row.state).toBe(STATE.NOT_USED);
            expect(row.canRequest).toBe(false);
        }
    });

    it("reports photos as limited when either reader says limited", async () => {
        mockGetters.mediaLibrary.mockResolvedValue(limited);
        mockGetters.imagePicker.mockResolvedValue(granted);

        const photos = (await getAllStatuses()).find((r) => r.key === "photos");
        expect(photos.state).toBe(STATE.LIMITED);
        // "Manage selection" is iOS-only; jest-expo reports ios by default.
        expect(photos.canManage).toBe(true);
    });

    it("offers Manage selection only while access is limited", async () => {
        const photos = (await getAllStatuses()).find((r) => r.key === "photos");
        expect(photos.state).toBe(STATE.GRANTED);
        expect(photos.canManage).toBe(false);
    });

    it("degrades one failed reader to unknown instead of rejecting", async () => {
        mockGetters.camera.mockRejectedValue(new Error("no native module"));

        const rows = await getAllStatuses();
        expect(rows.find((r) => r.key === "camera").state).toBe(STATE.UNKNOWN);
        // The rest of the panel still reports real values.
        expect(rows.find((r) => r.key === "notifications").state).toBe(STATE.GRANTED);
    });

    it("sets canRequest only where the prompt has genuinely never been answered", async () => {
        mockGetters.camera.mockResolvedValue(undetermined);
        mockGetters.notifications.mockResolvedValue(denied);

        const rows = await getAllStatuses();
        expect(rows.find((r) => r.key === "camera").canRequest).toBe(true);
        expect(rows.find((r) => r.key === "notifications").canRequest).toBe(false);
    });
});
