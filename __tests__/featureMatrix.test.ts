import { isFeatureAllowed, getFeature, TIER_ORDER, FEATURES } from "../src/config/featureMatrix";

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

    it("fails CLOSED on an unknown key", () => {
        // This used to return true. That default is how the five Storage Studio
        // features shipped rendering unlocked to Free users: the backend gated
        // them, the mirror had never heard of them, and the UI failed open until
        // the server refused mid-action. Locked-with-a-CTA is recoverable;
        // walking someone into a paid action that then 403s is not.
        expect(isFeatureAllowed("some_unlisted_on_device_thing", "free")).toBe(false);
        expect(isFeatureAllowed("typo_in_a_feature_key", "advance")).toBe(false);
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

// ---------------------------------------------------------------------------
// Backend parity
//
// Snapshot of Services/FeatureMatrix.cs in the API repo (c:\workpis\PaperAiApis).
// The two files are a cross-repo contract: a key the backend gates but the
// mirror omits falls through isFeatureAllowed's unknown-key default of `true`,
// so a paid feature renders unlocked until the server refuses it. That is how
// storage_studio, screenshot_cleaner, large_video_finder, blurry_detector and
// similar_photos shipped unlocked for Free users.
//
// When you change FeatureMatrix.cs, update THIS list and the mirror together.
// ---------------------------------------------------------------------------
const BACKEND_FEATURES: { key: string; requiredTier: string; creditFeatureKey?: string }[] = [
    { key: "upload_hub", requiredTier: "free" },
    { key: "document_scanner", requiredTier: "free" },
    { key: "code_scanner", requiredTier: "free" },
    { key: "signature_editor", requiredTier: "free" },
    { key: "usage_dashboard", requiredTier: "free" },
    { key: "document_ai_analysis", requiredTier: "essential", creditFeatureKey: "document_scan_ai_ready" },
    { key: "image_ocr", requiredTier: "essential", creditFeatureKey: "image_ocr_extract_text" },
    { key: "summarize_text", requiredTier: "essential", creditFeatureKey: "summarize_text" },
    { key: "receipt_extraction", requiredTier: "essential", creditFeatureKey: "receipt_extract" },
    { key: "smart_reminders", requiredTier: "essential" },
    { key: "explain_text_detail", requiredTier: "plus", creditFeatureKey: "explain_text_detail" },
    { key: "ai_chat", requiredTier: "plus", creditFeatureKey: "document_ai_chat" },
    { key: "deep_clean", requiredTier: "plus", creditFeatureKey: "junk_wiper_scan_report" },
    { key: "storage_studio", requiredTier: "free" },
    { key: "screenshot_cleaner", requiredTier: "free" },
    { key: "large_video_finder", requiredTier: "free" },
    { key: "blurry_detector", requiredTier: "essential", creditFeatureKey: "blurry_photo_scan" },
    { key: "similar_photos", requiredTier: "plus", creditFeatureKey: "similar_photo_scan" },
    { key: "ai_storage_analysis", requiredTier: "advance", creditFeatureKey: "ai_storage_analysis" },
    { key: "screenshot_intelligence", requiredTier: "advance", creditFeatureKey: "screenshot_intelligence" },
    { key: "storage_prediction", requiredTier: "advance" },
    { key: "advanced_reminders", requiredTier: "advance" },
    { key: "household_assistant", requiredTier: "advance" },
    { key: "smart_recall", requiredTier: "advance", creditFeatureKey: "recall_extract" },
    { key: "voice_companion", requiredTier: "advance" },
];

describe("backend parity", () => {
    it("mirrors every feature key the backend gates", () => {
        const missing = BACKEND_FEATURES.map((f) => f.key).filter((k) => !getFeature(k));
        expect(missing).toEqual([]);
    });

    it("agrees with the backend on the required tier of every feature", () => {
        for (const backend of BACKEND_FEATURES) {
            expect(getFeature(backend.key)?.requiredTier).toBe(backend.requiredTier);
        }
    });

    it("agrees with the backend on every credit feature key", () => {
        for (const backend of BACKEND_FEATURES) {
            expect(getFeature(backend.key)?.creditFeatureKey).toBe(backend.creditFeatureKey);
        }
    });

    it("does not gate a key the backend has never heard of", () => {
        // The reverse direction: a mirror-only key would deny a feature the
        // server is happy to serve.
        const backendKeys = new Set(BACKEND_FEATURES.map((f) => f.key));
        const extra = FEATURES.map((f) => f.key).filter((k) => !backendKeys.has(k));
        expect(extra).toEqual([]);
    });

    it("locks the Advance features declared ahead of their modules", () => {
        // smart_recall and voice_companion are registered before Modules 6 and 7
        // are built, so that the gate is decided once. A declared-but-unbuilt
        // feature must read as locked at every tier below Advance — never as an
        // unknown key that some future screen would fall through.
        for (const key of ["smart_recall", "voice_companion"]) {
            expect(isFeatureAllowed(key, "free")).toBe(false);
            expect(isFeatureAllowed(key, "plus")).toBe(false);
            expect(isFeatureAllowed(key, "advance")).toBe(true);
        }
    });

    it("keeps a Free user out of the paid Storage Studio scans", () => {
        expect(isFeatureAllowed("storage_studio", "free")).toBe(true);
        expect(isFeatureAllowed("blurry_detector", "free")).toBe(false);
        expect(isFeatureAllowed("similar_photos", "free")).toBe(false);
        expect(isFeatureAllowed("similar_photos", "essential")).toBe(false);
        expect(isFeatureAllowed("similar_photos", "plus")).toBe(true);
    });
});
