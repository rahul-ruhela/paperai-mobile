import {
    MAX_DESCRIPTION,
    RATES,
    TONES,
    composeSentence,
    sampleSentence,
    shouldSpeak,
    speakableText,
    trimToSentence,
} from "../src/services/voiceService";

// Module 7 §9. The phrasing IS the product here, and it is pure — so it can be
// pinned down exactly, without a synthesiser. What these tests protect most is
// that nothing is generated: every word is a fixed template or a stored field.

const task = {
    title: "Submit report",
    description: "The final report needs to be sent before Friday.",
    priority: "HIGH",
};

describe("composeSentence", () => {
    it("speaks the spec's worked example", () => {
        expect(composeSentence(task, { firstName: "Rahul" })).toBe(
            "Hey Rahul, this is a reminder about your urgent task Submit report. " +
                "You mentioned that the final report needs to be sent before Friday."
        );
    });

    it("omits the greeting entirely when no name is set", () => {
        // "Hey , this is a reminder" is worse than no greeting at all.
        const said = composeSentence(task, { firstName: "" });
        expect(said).toMatch(/^This is a reminder about your urgent task/);
        expect(said).not.toMatch(/Hey/);
    });

    it("says 'urgent' only for HIGH priority", () => {
        expect(composeSentence({ ...task, priority: "LOW" }, {})).toMatch(/your task/);
        expect(composeSentence({ ...task, priority: "LOW" }, {})).not.toMatch(/urgent/);
        expect(composeSentence({ ...task, priority: undefined }, {})).not.toMatch(/urgent/);
        expect(composeSentence(task, {})).toMatch(/urgent task/);
    });

    it("drops the second sentence when there is no description", () => {
        const said = composeSentence({ title: "Call the bank" }, { firstName: "Sam" });
        expect(said).toBe("Hey Sam, this is a reminder about your task Call the bank.");
        expect(said).not.toMatch(/You mentioned/);
    });

    it("says nothing at all for a task with no title", () => {
        expect(composeSentence({ description: "orphan" }, {})).toBe("");
        expect(composeSentence(null, {})).toBe("");
    });

    it("changes only the wording between tones, never the facts", () => {
        const friendly = composeSentence(task, { firstName: "Rahul", tone: TONES.FRIENDLY });
        const neutral = composeSentence(task, { firstName: "Rahul", tone: TONES.NEUTRAL });
        const direct = composeSentence(task, { firstName: "Rahul", tone: TONES.DIRECT });

        expect(neutral).toMatch(/^Reminder: your urgent task Submit report\./);
        expect(direct).toMatch(/^Urgent: Submit report\./);

        // The name is a friendly-tone flourish; the other two drop it.
        expect(neutral).not.toMatch(/Rahul/);
        expect(direct).not.toMatch(/Rahul/);

        // But every tone still carries both facts.
        for (const said of [friendly, neutral, direct]) {
            expect(said).toMatch(/Submit report/);
            expect(said).toMatch(/final report needs to be sent/);
        }
    });

    it("truncates a very long description at a sentence boundary", () => {
        const long =
            "First sentence is short. " +
            "Second sentence carries the real detail and keeps going and going for quite a while indeed. " +
            "Third sentence sits past the two hundred character budget and must never be spoken. " +
            "Fourth sentence likewise. ";
        const said = composeSentence({ title: "Long one", description: long }, {});
        expect(said).toMatch(/First sentence is short/);
        expect(said).not.toMatch(/Third sentence/);
        expect(said).not.toMatch(/Fourth sentence/);
    });

    it("keeps a proper noun capitalised after 'You mentioned that'", () => {
        // "the final report" reads better lowered; "priya has the keys" mangles
        // someone's name. Only an allowlist of function words is lowered.
        const said = composeSentence(
            { title: "Call", description: "Priya has the keys." },
            { firstName: "Sam" }
        );
        expect(said).toMatch(/You mentioned that Priya has the keys\./);
    });
});

describe("speakableText", () => {
    it("replaces a URL rather than spelling it out", () => {
        // A URL read character by character is thirty seconds of noise.
        expect(speakableText("See https://example.com/x?y=1 for details")).toBe(
            "See a link for details"
        );
    });

    it("removes emoji", () => {
        expect(speakableText("Pay rent 🏠🔥 today")).toBe("Pay rent today");
    });

    it("collapses the whitespace that leaves behind", () => {
        expect(speakableText("  a   b  ")).toBe("a b");
    });

    it("copes with nothing", () => {
        expect(speakableText(null)).toBe("");
        expect(speakableText(undefined)).toBe("");
    });
});

describe("trimToSentence", () => {
    it("leaves short text alone", () => {
        expect(trimToSentence("Short.", 200)).toBe("Short.");
    });

    it("prefers a sentence end", () => {
        const text = "One sentence here. And a second one that pushes past the limit.";
        expect(trimToSentence(text, 30)).toBe("One sentence here.");
    });

    it("falls back to a word boundary when no sentence end fits", () => {
        const source = "aaaa bbbb cccc dddd eeee ffff";
        const out = trimToSentence(source, 20);
        expect(out.endsWith("…")).toBe(true);
        // Whatever it kept is a whole-word prefix of the original.
        const kept = out.slice(0, -1);
        expect(source.startsWith(kept)).toBe(true);
        expect(source[kept.length]).toBe(" ");
    });

    it("uses the documented 200-character budget by default", () => {
        expect(MAX_DESCRIPTION).toBe(200);
    });
});

describe("shouldSpeak", () => {
    it("stays silent for everyone without the feature, whatever the settings say", () => {
        expect(shouldSpeak({}, { enabled: true, available: false })).toBe(false);
        expect(shouldSpeak({ voiceEnabled: true }, { enabled: true, available: false })).toBe(false);
    });

    it("follows the global setting when the task has no opinion", () => {
        expect(shouldSpeak({ voiceEnabled: null }, { enabled: true, available: true })).toBe(true);
        expect(shouldSpeak({}, { enabled: false, available: true })).toBe(false);
    });

    it("lets a task overrule the global setting in both directions", () => {
        // Three states, and the middle one is the point.
        expect(shouldSpeak({ voiceEnabled: true }, { enabled: false, available: true })).toBe(true);
        expect(shouldSpeak({ voiceEnabled: false }, { enabled: true, available: true })).toBe(false);
    });
});

describe("sampleSentence", () => {
    it("is playable without a task, for the Plus preview", () => {
        // Plus can hear the feature before buying it — spec §2.
        expect(sampleSentence({ firstName: "Rahul" })).toMatch(/Hey Rahul/);
        expect(sampleSentence({})).toMatch(/Submit report/);
    });
});

describe("rates", () => {
    it("offers exactly the three documented speeds", () => {
        expect(RATES).toEqual([0.75, 1, 1.25]);
    });
});
