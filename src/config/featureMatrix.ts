// Centralized feature matrix — mobile mirror of the backend
// Services/FeatureMatrix.cs. The app uses this to control visibility and UX only.
// The backend is always the authority for actual authorization, credits and
// usage limits — never gate a paid action on this file alone. Keep the two files
// in sync (same keys, same requiredTier).

export type AccessTier = "free" | "essential" | "plus" | "advance";

// Least → most capable. Used to compare a user's tier against a feature's minimum.
export const TIER_ORDER: Record<AccessTier, number> = {
    free: 0,
    essential: 1,
    plus: 2,
    advance: 3,
};

export interface FeatureDefinition {
    key: string;
    name: string;
    requiredTier: AccessTier;
    onDevice: boolean;
    backendVerified: boolean;
    creditFeatureKey?: string;
}

export const FEATURES: FeatureDefinition[] = [
    // On-device / free base capabilities
    { key: "upload_hub", name: "Upload Hub", requiredTier: "free", onDevice: true, backendVerified: false },
    { key: "document_scanner", name: "Document Scanner", requiredTier: "free", onDevice: true, backendVerified: false },
    { key: "code_scanner", name: "QR / Barcode Scanner", requiredTier: "free", onDevice: true, backendVerified: false },
    { key: "signature_editor", name: "Signature Editor", requiredTier: "free", onDevice: true, backendVerified: false },
    { key: "usage_dashboard", name: "Usage Dashboard", requiredTier: "free", onDevice: false, backendVerified: true },

    // Essential tier
    { key: "document_ai_analysis", name: "AI Document Analysis", requiredTier: "essential", onDevice: false, backendVerified: true, creditFeatureKey: "document_scan_ai_ready" },
    { key: "image_ocr", name: "Image OCR", requiredTier: "essential", onDevice: false, backendVerified: true, creditFeatureKey: "image_ocr_extract_text" },
    { key: "summarize_text", name: "Summarize Text", requiredTier: "essential", onDevice: false, backendVerified: true, creditFeatureKey: "summarize_text" },
    { key: "receipt_extraction", name: "Receipt Extraction", requiredTier: "essential", onDevice: false, backendVerified: true, creditFeatureKey: "receipt_extract" },
    { key: "smart_reminders", name: "Smart Reminders", requiredTier: "essential", onDevice: false, backendVerified: true },

    // Plus tier
    { key: "explain_text_detail", name: "Explain in Detail", requiredTier: "plus", onDevice: false, backendVerified: true, creditFeatureKey: "explain_text_detail" },
    { key: "ai_chat", name: "AI Chat", requiredTier: "plus", onDevice: false, backendVerified: true, creditFeatureKey: "document_ai_chat" },
    { key: "deep_clean", name: "Deep Clean", requiredTier: "plus", onDevice: false, backendVerified: true, creditFeatureKey: "junk_wiper_scan_report" },

    // Storage Studio — mirrors Services/FeatureMatrix.cs. The hub and the two
    // free cleaners run entirely on-device; only the two AI-assisted scans are
    // credit-bearing and backend-verified.
    { key: "storage_studio", name: "Storage Studio", requiredTier: "free", onDevice: true, backendVerified: false },
    { key: "screenshot_cleaner", name: "Screenshot Cleaner", requiredTier: "free", onDevice: true, backendVerified: false },
    { key: "large_video_finder", name: "Large Video Finder", requiredTier: "free", onDevice: true, backendVerified: false },
    { key: "blurry_detector", name: "Blurry Photo Detector", requiredTier: "essential", onDevice: true, backendVerified: true, creditFeatureKey: "blurry_photo_scan" },
    { key: "similar_photos", name: "Similar Photo Grouping", requiredTier: "plus", onDevice: true, backendVerified: true, creditFeatureKey: "similar_photo_scan" },

    // Storage Studio, Advance layer (Module 4). `storage_prediction` carries no
    // credit key on purpose: the estimate is least-squares arithmetic over a
    // local history file, so there is no server work to bill and charging for it
    // would be a fee for nothing. The two that do call the server carry one.
    { key: "ai_storage_analysis", name: "AI Storage Analysis", requiredTier: "advance", onDevice: false, backendVerified: true, creditFeatureKey: "ai_storage_analysis" },
    { key: "screenshot_intelligence", name: "Screenshot Intelligence", requiredTier: "advance", onDevice: false, backendVerified: true, creditFeatureKey: "screenshot_intelligence" },
    { key: "storage_prediction", name: "Storage Forecast", requiredTier: "advance", onDevice: true, backendVerified: true },

    // Advance tier
    // On-device: reminders are local notifications, so there is no server call to
    // authorize. `backendVerified` is still true because the TIER is decided by
    // the entitlement snapshot, which is server-issued.
    { key: "advanced_reminders", name: "Custom Dates & Snooze", requiredTier: "advance", onDevice: true, backendVerified: true },
    { key: "household_assistant", name: "Household Assistant", requiredTier: "advance", onDevice: false, backendVerified: true },

    // Declared ahead of their modules (roadmap 6 and 7) so the gate is settled
    // once, here, rather than invented twice when those modules land. Both are
    // unreachable until their screens exist; a declared-but-unbuilt feature is
    // locked, not open — which is the whole point of the change below.
    { key: "smart_recall", name: "Smart Recall", requiredTier: "advance", onDevice: false, backendVerified: true, creditFeatureKey: "recall_extract" },
    { key: "voice_companion", name: "AI Voice Companion", requiredTier: "advance", onDevice: true, backendVerified: true },
];

const BY_KEY: Record<string, FeatureDefinition> = FEATURES.reduce(
    (acc, f) => ((acc[f.key] = f), acc),
    {} as Record<string, FeatureDefinition>
);

export function getFeature(key: string): FeatureDefinition | undefined {
    return BY_KEY[key];
}

// Client-side allow check. This is a UX hint only — the backend re-checks.
//
// An unknown key returns FALSE. This used to return true, and that is exactly
// how the five Storage Studio features shipped rendering unlocked to Free users:
// the backend gated them, the mirror had never heard of them, and the UI failed
// open until the server refused mid-action. Locked-with-a-CTA is the recoverable
// mistake; charging into a paid action that then 403s is not.
//
// The mirror is now complete and `__tests__/featureMatrix.test.ts` fails CI in
// both directions if it drifts from Services/FeatureMatrix.cs, so "unknown" here
// means a typo or a key someone forgot to register — both of which should be
// loud. A genuinely ungated on-device affordance must not call this at all.
export function isFeatureAllowed(key: string, userTier: AccessTier): boolean {
    const f = BY_KEY[key];
    if (!f) return false;
    return TIER_ORDER[userTier] >= TIER_ORDER[f.requiredTier];
}
