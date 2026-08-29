// The Voice Companion panel has THREE states, and conflating two of them is a
// bug that shipped once already.
//
//   unlocked     Advance — everything works.
//   previewOnly  a real tier lock — sample plays, controls prompt to upgrade.
//   unavailable  the settings could not be LOADED (network, server down).
//
// The regression this guards: a failed load used to be represented as
// `available: false`, which is indistinguishable from "below Advance". Every
// control then routed to the upgrade sheet, so an Advance subscriber with a
// flaky connection was told to buy the plan they already pay for.
//
// The resolution is pure and worth testing on its own, without rendering.

/** Mirrors the derivation in VoiceSettingsSection. */
function resolve({ prefsFailed, available }) {
    const unavailable = !!prefsFailed;
    const unlocked = !unavailable && available === true;
    const previewOnly = !unavailable && !unlocked;
    return { unavailable, unlocked, previewOnly };
}

describe("voice panel state", () => {
    it("unlocks an Advance subscriber", () => {
        expect(resolve({ prefsFailed: false, available: true })).toEqual({
            unavailable: false,
            unlocked: true,
            previewOnly: false,
        });
    });

    it("shows a preview lock below Advance", () => {
        expect(resolve({ prefsFailed: false, available: false })).toEqual({
            unavailable: false,
            unlocked: false,
            previewOnly: true,
        });
    });

    // The regression guard. A load failure must NOT look like a tier lock,
    // whatever `available` happens to say.
    it.each([true, false, undefined, null])(
        "never offers an upgrade when the settings failed to load (available=%p)",
        (available) => {
            const state = resolve({ prefsFailed: true, available });
            expect(state.unavailable).toBe(true);
            expect(state.previewOnly).toBe(false);
            expect(state.unlocked).toBe(false);
        }
    );

    it("is always in exactly one state", () => {
        for (const prefsFailed of [true, false]) {
            for (const available of [true, false, undefined]) {
                const s = resolve({ prefsFailed, available });
                const on = [s.unavailable, s.unlocked, s.previewOnly].filter(Boolean);
                expect(on).toHaveLength(1);
            }
        }
    });
});
