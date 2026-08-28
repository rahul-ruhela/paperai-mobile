import {
    BANNER_MAX,
    MIN_SPEAKABLE_CONFIDENCE,
    composeTaskBody,
    speakable,
    truncate,
} from "../src/services/recallNotification";

// Module 6 §7. The notification body is the one place a memory leaves the app,
// and a lock screen is visible to whoever is holding the phone. These tests are
// about what must NOT reach it.

const memories = [
    { content: "Bring blood reports and insurance card", confidence: 0.95 },
    { content: "Ask about the referral", confidence: 0.7 },
    { content: "Might be about the knee", confidence: 0.2 },
];

describe("speakable", () => {
    it("drops anything below the confidence line", () => {
        expect(speakable(memories).map((m) => m.confidence)).toEqual([0.95, 0.7]);
    });

    it("treats a missing confidence as not confident", () => {
        expect(speakable([{ content: "something" }])).toEqual([]);
    });

    it("drops empty content and copes with no input", () => {
        expect(speakable([{ content: "   ", confidence: 1 }])).toEqual([]);
        expect(speakable(null)).toEqual([]);
        expect(speakable()).toEqual([]);
    });
});

describe("composeTaskBody", () => {
    it("shows only the task's own description when details are hidden", () => {
        // The default, and the whole point of the preference.
        const body = composeTaskBody({
            description: "Doctor appointment",
            memories,
            hideDetails: true,
        });
        expect(body).toBe("Doctor appointment");
        expect(body).not.toMatch(/blood reports/);
    });

    it("hides details when the preference is not passed at all", () => {
        // A caller that forgets the flag must get the private answer, not the
        // revealing one.
        const body = composeTaskBody({ description: "Doctor appointment", memories });
        expect(body).not.toMatch(/blood reports/);
    });

    it("folds confident memories in when the user has allowed it", () => {
        const body = composeTaskBody({
            description: "Doctor appointment",
            memories,
            hideDetails: false,
        });
        expect(body).toMatch(/Bring blood reports and insurance card/);
        expect(body).toMatch(/Ask about the referral/);
    });

    it("never surfaces a low-confidence memory, even when details are allowed", () => {
        const body = composeTaskBody({ description: "Doctor appointment", memories, hideDetails: false });
        expect(body).not.toMatch(/knee/);
    });

    it("leads with the memory it is most sure about", () => {
        const body = composeTaskBody({
            description: "d",
            memories: [
                { content: "Less certain thing", confidence: 0.65 },
                { content: "Certain thing", confidence: 0.99 },
            ],
            hideDetails: false,
        });
        expect(body.indexOf("Certain thing")).toBeLessThan(body.indexOf("Less certain thing"));
    });

    it("falls back to the description when nothing is confident enough", () => {
        const body = composeTaskBody({
            description: "Doctor appointment",
            memories: [{ content: "vague", confidence: 0.1 }],
            hideDetails: false,
        });
        expect(body).toBe("Doctor appointment");
    });

    it("says something useful for a task with no description and no memories", () => {
        expect(composeTaskBody({})).toBe("Task due now.");
    });

    it("keeps the banner within its limit", () => {
        const body = composeTaskBody({
            description: "d",
            memories: [{ content: "x ".repeat(200), confidence: 0.9 }],
            hideDetails: false,
        });
        expect(body.length).toBeLessThanOrEqual(BANNER_MAX);
    });

    it("mirrors the server's confidence threshold", () => {
        // Drifting from RecallMemory.MinSpeakableConfidence would mean the app
        // pushes memories the server considers unsafe to push.
        expect(MIN_SPEAKABLE_CONFIDENCE).toBe(0.6);
    });
});

describe("truncate", () => {
    it("ends on a word rather than mid-syllable", () => {
        expect(truncate("bring the blood reports please", 20)).toBe("bring the blood…");
    });

    it("leaves short text alone", () => {
        expect(truncate("short", 20)).toBe("short");
    });

    it("copes with nothing", () => {
        expect(truncate(null)).toBe("");
        expect(truncate(undefined)).toBe("");
    });
});
