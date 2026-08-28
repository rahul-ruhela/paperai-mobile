// Module 7 §4 and §8. This is the bridge between a delivered notification and
// the synthesiser, and almost everything worth testing here is a reason NOT to
// speak: the wrong tier, the feature off, the tap preference off, or the same
// reminder already spoken a second ago.

const mockGetVoicePreferences = jest.fn();
const mockSpeak = jest.fn(async () => ({ spoken: true }));
const mockIsSpeaking = jest.fn(async () => false);

jest.mock("../src/api/voice", () => ({
    getVoicePreferences: (...a) => mockGetVoicePreferences(...a),
    updateVoicePreferences: jest.fn(),
}));

jest.mock("../src/services/voiceService", () => ({
    speak: (...a) => mockSpeak(...a),
    isSpeaking: (...a) => mockIsSpeaking(...a),
}));

const { speakFromPayload, resetPlaybackState } = require("../src/services/voicePlayback");

const PAYLOAD = { type: "task", taskId: "t1", spoken: "This is a reminder about your task." };

const ON = { available: true, enabled: true, speakOnTap: true, rate: 1, voiceId: null };

beforeEach(() => {
    jest.clearAllMocks();
    resetPlaybackState();
    mockGetVoicePreferences.mockResolvedValue(ON);
    mockIsSpeaking.mockResolvedValue(false);
});

describe("speakFromPayload", () => {
    it("speaks the sentence composed at schedule time", async () => {
        const result = await speakFromPayload(PAYLOAD);
        expect(result.spoken).toBe(true);
        expect(mockSpeak).toHaveBeenCalledWith(PAYLOAD.spoken, expect.anything());
    });

    it("passes the user's voice and rate through", async () => {
        mockGetVoicePreferences.mockResolvedValue({ ...ON, voiceId: "v1", rate: 1.25 });
        await speakFromPayload(PAYLOAD);
        expect(mockSpeak).toHaveBeenCalledWith(
            PAYLOAD.spoken,
            expect.objectContaining({ voiceId: "v1", rate: 1.25 })
        );
    });

    it("says nothing when the payload carries no sentence", async () => {
        // Every reminder scheduled before this feature existed looks like this.
        expect(await speakFromPayload({ type: "task", taskId: "t1" })).toEqual({
            spoken: false,
            reason: "no-payload",
        });
        expect(mockSpeak).not.toHaveBeenCalled();
    });

    it("says nothing below the tier, whatever the local settings claim", async () => {
        mockGetVoicePreferences.mockResolvedValue({ ...ON, available: false });
        expect((await speakFromPayload(PAYLOAD)).reason).toBe("not-available");
        expect(mockSpeak).not.toHaveBeenCalled();
    });

    it("says nothing when voice is switched off", async () => {
        mockGetVoicePreferences.mockResolvedValue({ ...ON, enabled: false });
        expect((await speakFromPayload(PAYLOAD)).reason).toBe("disabled");
    });

    it("respects speak-on-tap separately from the main switch", async () => {
        mockGetVoicePreferences.mockResolvedValue({ ...ON, speakOnTap: false });

        // A tap must stay silent...
        expect((await speakFromPayload(PAYLOAD, { onTap: true })).reason).toBe("tap-disabled");
        // ...while a foreground delivery still speaks.
        expect((await speakFromPayload(PAYLOAD)).spoken).toBe(true);
    });

    it("does not repeat itself when you tap the banner it just spoke", async () => {
        // Spec §9.4: a foreground fire speaks once, never twice when the user
        // also taps it.
        await speakFromPayload(PAYLOAD);
        mockIsSpeaking.mockResolvedValue(true);

        const second = await speakFromPayload(PAYLOAD, { onTap: true });
        expect(second.reason).toBe("already-speaking");
        expect(mockSpeak).toHaveBeenCalledTimes(1);
    });

    it("does speak on tap once the first utterance has finished", async () => {
        await speakFromPayload(PAYLOAD);
        mockIsSpeaking.mockResolvedValue(false);

        expect((await speakFromPayload(PAYLOAD, { onTap: true })).spoken).toBe(true);
        expect(mockSpeak).toHaveBeenCalledTimes(2);
    });

    it("stays silent rather than guessing when preferences cannot be read", async () => {
        // Speaking when we cannot confirm the user asked for it is worse than
        // not speaking when they did.
        mockGetVoicePreferences.mockRejectedValue(new Error("offline"));
        expect((await speakFromPayload(PAYLOAD)).reason).toBe("no-prefs");
        expect(mockSpeak).not.toHaveBeenCalled();
    });

    it("caches preferences so playback never waits on a second request", async () => {
        await speakFromPayload(PAYLOAD);
        await speakFromPayload({ ...PAYLOAD, taskId: "t2" });
        expect(mockGetVoicePreferences).toHaveBeenCalledTimes(1);
    });

    it("never throws, whatever it is handed", async () => {
        // It runs inside the notification handler; an exception there would
        // delay or break the banner itself.
        mockSpeak.mockRejectedValue(new Error("synthesiser exploded"));
        expect((await speakFromPayload(PAYLOAD)).spoken).toBe(false);

        await expect(speakFromPayload(null)).resolves.toBeTruthy();
        await expect(speakFromPayload(undefined)).resolves.toBeTruthy();
    });
});
