/**
 * Voice: what a task actually sounds like.
 *
 * The synthesiser itself is a platform service and not worth mocking beyond a
 * spy — the part that can regress is the sentence we hand it, so that is what
 * is pinned here.
 */

// jest.mock is hoisted above these, so the names must carry the `mock` prefix
// that marks them as safe to reference from the factory.
const mockSpeak = jest.fn();
const mockStop = jest.fn(() => Promise.resolve());
const mockIsSpeaking = jest.fn(() => Promise.resolve(false));

jest.mock(
    "expo-speech",
    () => ({ speak: mockSpeak, stop: mockStop, isSpeakingAsync: mockIsSpeaking }),
    { virtual: true }
);

const { taskSpeechText, speakTask, stopSpeaking } = require("../src/services/taskSpeech");

beforeEach(() => {
    mockSpeak.mockClear();
    mockStop.mockClear();
});

describe("taskSpeechText", () => {
    it("reads the title and the description", () => {
        const text = taskSpeechText({ title: "Call the plumber", description: "Leak under the sink" });
        expect(text).toBe("Call the plumber. Leak under the sink.");
    });

    it("does not double up punctuation the user already typed", () => {
        const text = taskSpeechText({ title: "Call the plumber!", description: "Is it urgent?" });
        expect(text).toBe("Call the plumber! Is it urgent?");
    });

    // Day/month order comes from the device locale, so these assert on the
    // pieces rather than on one region's ordering.
    it("says the date only when no time was picked", () => {
        const text = taskSpeechText({
            title: "Renew passport",
            dueAtUtc: new Date(2026, 8, 5, 9, 0).toISOString(),
            dueTimeSet: false,
        });
        expect(text).toContain("Due on ");
        expect(text).toContain("September");
        expect(text).toContain("5");
        expect(text).not.toMatch(/\bat\b/);
    });

    it("says the time when the user picked one", () => {
        const text = taskSpeechText({
            title: "Renew passport",
            dueAtUtc: new Date(2026, 8, 5, 14, 30).toISOString(),
            dueTimeSet: true,
        });
        expect(text).toContain("Due on ");
        expect(text).toContain("September");
        expect(text).toMatch(/\bat\b/);
        expect(text).toMatch(/\d:\d\d/);
    });

    it("mentions high and low priority but stays quiet about medium", () => {
        expect(taskSpeechText({ title: "A", priority: "HIGH" })).toContain("High priority.");
        expect(taskSpeechText({ title: "A", priority: "LOW" })).toContain("Low priority.");
        expect(taskSpeechText({ title: "A", priority: "MEDIUM" })).toBe("A.");
    });

    it("mentions a repeat rule", () => {
        expect(taskSpeechText({ title: "A", repeat: "WEEKLY" })).toContain("Repeats weekly.");
        expect(taskSpeechText({ title: "A", repeat: "NONE" })).toBe("A.");
    });

    it("flags a task that is already done", () => {
        expect(taskSpeechText({ title: "A", status: "DONE" })).toContain("already done");
    });

    it("ignores an unparseable due date instead of speaking gibberish", () => {
        expect(taskSpeechText({ title: "A", dueAtUtc: "not-a-date" })).toBe("A.");
    });

    it("truncates a very long description", () => {
        const text = taskSpeechText({ title: "A", description: "x".repeat(900) });
        expect(text.length).toBeLessThan(500);
    });

    it("returns nothing for an empty or missing task", () => {
        expect(taskSpeechText(null)).toBe("");
        expect(taskSpeechText({})).toBe("");
    });
});

describe("speakTask", () => {
    it("stops any current utterance before starting a new one", async () => {
        await speakTask({ title: "A" });
        expect(mockStop).toHaveBeenCalled();
        expect(mockSpeak).toHaveBeenCalledTimes(1);
        expect(mockSpeak.mock.calls[0][0]).toBe("A.");
    });

    it("reports spoken:false and never calls the synthesiser for an empty task", async () => {
        const result = await speakTask({ title: "   " });
        expect(result).toEqual({ spoken: false });
        expect(mockSpeak).not.toHaveBeenCalled();
    });

    it("calls onDone when the utterance is stopped, not just when it finishes", async () => {
        const onDone = jest.fn();
        await speakTask({ title: "A" }, { onDone });

        // The icon would stay stuck on "playing" if only onDone were wired.
        mockSpeak.mock.calls[0][1].onStopped();
        expect(onDone).toHaveBeenCalled();
    });

    it("calls onDone on error so the caller's state cannot get stuck", async () => {
        const onDone = jest.fn();
        await speakTask({ title: "A" }, { onDone });
        mockSpeak.mock.calls[0][1].onError();
        expect(onDone).toHaveBeenCalled();
    });

    it("survives a synthesiser that throws", async () => {
        mockSpeak.mockImplementationOnce(() => {
            throw new Error("no voice");
        });
        await expect(speakTask({ title: "A" })).resolves.toEqual({ spoken: false });
    });
});

describe("stopSpeaking", () => {
    it("does not reject when the synthesiser refuses to stop", async () => {
        mockStop.mockRejectedValueOnce(new Error("busy"));
        await expect(stopSpeaking()).resolves.toBeUndefined();
    });
});
