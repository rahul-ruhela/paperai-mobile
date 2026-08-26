import { isFeatureAllowed, getFeature, TIER_ORDER } from "../src/config/featureMatrix";

// This file is the mobile mirror of the backend's Services/FeatureMatrix.cs and
// decides which upsell a user sees. It is a UX hint — the backend re-authorizes
// every paid action — but a wrong answer here either hides a feature someone
// paid for, or advertises one they cannot use.

describe("tier ordering", () => {
    it("ranks tiers least → most capable", () => {
        expect(TIER_ORDER.free).toBeLessThan(TIER_ORDER.essential);
        expect(TIER_ORDER.essential).toBeLessThan(TIER_ORDER.plus);
        expect(TIER_ORDER.plus).toBeLessThan(TIER_ORDER.advance);
    });
});

describe("isFeatureAllowed", () => {
    it("grants a free feature to every tier, free included", () => {
        for (const tier of ["free", "essential", "plus", "advance"] as const) {
            expect(isFeatureAllowed("document_scanner", tier)).toBe(true);
        }
    });

    it("denies a paid feature to a free user", () => {
        expect(isFeatureAllowed("document_ai_analysis", "free")).toBe(false);
        expect(isFeatureAllowed("ai_chat", "free")).toBe(false);
    });

    it("grants a feature at exactly its required tier", () => {
        expect(isFeatureAllowed("document_ai_analysis", "essential")).toBe(true);
        expect(isFeatureAllowed("ai_chat", "plus")).toBe(true);
        expect(isFeatureAllowed("household_assistant", "advance")).toBe(true);
    });

    it("grants a lower-tier feature to a higher-tier user", () => {
        // An Advance subscriber must never be denied an Essential feature.
        expect(isFeatureAllowed("document_ai_analysis", "advance")).toBe(true);
        expect(isFeatureAllowed("image_ocr", "plus")).toBe(true);
    });

    it("denies a higher-tier feature to a lower-tier user", () => {
        expect(isFeatureAllowed("ai_chat", "essential")).toBe(false);
        expect(isFeatureAllowed("household_assistant", "plus")).toBe(false);
    });

    it("defaults unknown keys to allowed, matching the documented contract", () => {
        // On-device-only features are not listed here and must not be gated.
        expect(isFeatureAllowed("some_unlisted_on_device_thing", "free")).toBe(true);
    });
});

describe("credit feature keys", () => {
    it("keeps a creditFeatureKey on every feature that charges credits", () => {
        // These keys are the cross-repo contract with the backend's credit
        // ledger. A typo here charges the wrong bucket or nothing at all.
        for (const key of ["document_ai_analysis", "image_ocr", "summarize_text", "deep_clean"]) {
            expect(getFeature(key)?.creditFeatureKey).toBeTruthy();
        }
    });
});
