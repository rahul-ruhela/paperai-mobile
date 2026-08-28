import {
    COMPONENTS,
    STALE_AFTER_DAYS,
    computePrivacyScore,
    isStale,
    scoreBand,
} from "../src/services/privacyScore";

// Module 5 §4. An advisory number, not a security verdict — so these tests care
// about the weighting being right, about unread inputs never being scored as
// failures, and about the copy never turning into an alarm.

describe("weights", () => {
    it("sums to 100", () => {
        expect(COMPONENTS.reduce((a, c) => a + c.weight, 0)).toBe(100);
    });
});

describe("computePrivacyScore", () => {
    const perfect = {
        sensitiveTotal: 3,
        sensitiveInVault: 3,
        vaultConfigured: true,
        biometryAvailable: true,
        permissions: [{ key: "photos", granted: true, usedByApp: true }],
        totalDocuments: 10,
        staleDocuments: 0,
        lockScreenPreviewHidden: true,
    };

    it("gives 100 when everything measured is in order", () => {
        expect(computePrivacyScore(perfect).score).toBe(100);
    });

    it("offers no actions when there is nothing to fix", () => {
        expect(computePrivacyScore(perfect).actions).toEqual([]);
    });

    it("scores an empty app at 100 rather than punishing a new user", () => {
        // Nothing detected, nothing stored, nothing read yet. A brand-new
        // install has done nothing wrong.
        expect(computePrivacyScore({}).score).toBe(100);
    });

    it("never penalises an input that has not been read yet", () => {
        // null means "unknown", and an unknown must not read as a failure — the
        // user cannot fix a measurement we did not take.
        const unread = computePrivacyScore({
            biometryAvailable: null,
            permissions: null,
            lockScreenPreviewHidden: null,
        });
        expect(unread.score).toBe(100);
        expect(unread.actions).toEqual([]);
    });

    it("deducts the full weight when every sensitive document is unsecured", () => {
        const out = computePrivacyScore({ ...perfect, sensitiveInVault: 0 });
        expect(out.score).toBe(100 - 35);
        expect(out.components.find((c) => c.key === "sensitive_secured").points).toBe(0);
    });

    it("deducts proportionally for a partly secured library", () => {
        const out = computePrivacyScore({ ...perfect, sensitiveTotal: 4, sensitiveInVault: 3 });
        expect(out.components.find((c) => c.key === "sensitive_secured").points).toBe(26); // 0.75 × 35
    });

    it("does not penalise a device that has no biometrics to enrol", () => {
        // Not the user's fault and not fixable, so it must not sit as a
        // permanent deduction they can never clear.
        const out = computePrivacyScore({ ...perfect, biometryAvailable: false, vaultConfigured: false });
        expect(out.components.find((c) => c.key === "biometric_lock").points).toBe(20);
    });

    it("counts only granted-but-unused permissions as surplus", () => {
        const out = computePrivacyScore({
            ...perfect,
            permissions: [
                { key: "photos", granted: true, usedByApp: true },
                { key: "location", granted: true, usedByApp: false },
                { key: "microphone", granted: false, usedByApp: false },
            ],
        });
        // One of two granted permissions is surplus → half of 20.
        expect(out.components.find((c) => c.key === "permissions_minimal").points).toBe(10);
    });

    it("returns at most three actions, biggest available gain first", () => {
        const out = computePrivacyScore({
            sensitiveTotal: 2,
            sensitiveInVault: 0,
            vaultConfigured: false,
            biometryAvailable: true,
            permissions: [{ key: "location", granted: true, usedByApp: false }],
            totalDocuments: 4,
            staleDocuments: 4,
            lockScreenPreviewHidden: false,
        });
        expect(out.actions).toHaveLength(3);
        expect(out.actions[0].componentKey).toBe("sensitive_secured"); // 35 points
        expect(out.actions[1].componentKey).toBe("biometric_lock"); // 20
    });

    it("names a concrete, countable action rather than 'improve your privacy'", () => {
        const out = computePrivacyScore({ ...perfect, sensitiveTotal: 3, sensitiveInVault: 1 });
        expect(out.actions[0].label).toBe("Move 2 documents to your Vault");
    });

    it("keeps every component explained, whatever the score", () => {
        for (const c of computePrivacyScore({}).components) {
            expect(typeof c.detail).toBe("string");
            expect(c.detail.length).toBeGreaterThan(0);
        }
    });

    it("stays inside 0–100", () => {
        const worst = computePrivacyScore({
            sensitiveTotal: 9,
            sensitiveInVault: 0,
            vaultConfigured: false,
            biometryAvailable: true,
            permissions: [{ key: "location", granted: true, usedByApp: false }],
            totalDocuments: 9,
            staleDocuments: 9,
            lockScreenPreviewHidden: false,
        });
        expect(worst.score).toBe(0);
    });
});

describe("scoreBand", () => {
    it("never uses alarming language", () => {
        // Spec §4: an advisory number, not a security verdict. No "at risk",
        // no "critical" — a heuristic over five measurable things does not get
        // to tell someone they are in danger.
        for (const value of [0, 20, 34, 35, 59, 60, 84, 85, 100]) {
            expect(scoreBand(value).label).not.toMatch(
                /risk|critical|danger|unsafe|vulnerable|exposed|warning/i
            );
        }
    });

    it("bands the range", () => {
        expect(scoreBand(90).key).toBe("strong");
        expect(scoreBand(70).key).toBe("good");
        expect(scoreBand(40).key).toBe("fair");
        expect(scoreBand(10).key).toBe("basic");
    });
});

describe("isStale", () => {
    const now = Date.UTC(2026, 7, 28);
    const daysAgo = (n) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

    it("counts a document older than a year", () => {
        expect(isStale(daysAgo(STALE_AFTER_DAYS + 1), now)).toBe(true);
        expect(isStale(daysAgo(STALE_AFTER_DAYS - 1), now)).toBe(false);
    });

    it("treats an unreadable date as not stale rather than guessing", () => {
        expect(isStale(undefined, now)).toBe(false);
        expect(isStale("not a date", now)).toBe(false);
    });
});
