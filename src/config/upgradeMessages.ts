// Upgrade copy — one sentence per gated feature, per the rules in
// docs/subscription-entitlement-policy.md §4:
//
//   1. Name the tier and the benefit. Never just "Upgrade".
//   2. One sentence, sentence case, no exclamation marks.
//   3. Never state a price. Prices come from StoreKit, and a hardcoded one here
//      would be wrong in every currency but the one it was written in.
//
// It lives in config rather than in each screen because the same feature is
// gated from several places — smart_reminders is upsold from both ReminderCard
// and the document detail screen — and two screens quoting different copy for
// the same lock is how a paywall stops being trustworthy.

import { AccessTier, FEATURES, getFeature } from "./featureMatrix";

export const TIER_LABELS: Record<AccessTier, string> = {
    free: "Free",
    essential: "Essential",
    plus: "Plus",
    advance: "Advance",
};

// Keyed by feature key. Free-tier features are absent by design — there is
// nothing to upsell — and the parity test below enforces that every *gated*
// key has an entry.
export const UPGRADE_MESSAGES: Record<string, string> = {
    // Essential
    document_ai_analysis: "Analyse documents with AI on Essential.",
    image_ocr: "Pull text out of any photo with Essential.",
    summarize_text: "Get instant summaries with Essential.",
    receipt_extraction: "Turn receipts into expenses with Essential.",
    smart_reminders: "Never miss a due date with Essential.",
    photo_cleanup: "Clear screenshots, blurry shots and near-identical photos in one scan with Essential.",
    blurry_detector: "Find blurry shots automatically with Essential.",

    // Plus
    explain_text_detail: "Ask for a deeper explanation on Plus.",
    ai_chat: "Keep chatting about your documents with Plus.",
    deep_clean: "Deep Clean finds far more with Plus.",
    similar_photos: "Group near-identical photos with Plus.",

    // Advance
    advanced_reminders: "Custom dates and snooze are part of Advance.",
    household_assistant: "Run the household from one place with Advance.",
    smart_recall: "Advance remembers the details for you.",
    ai_storage_analysis: "Get a storage plan written for your device with Advance.",
    screenshot_intelligence: "Sort screenshots into receipts, chats and documents with Advance.",
    storage_prediction: "See when your storage runs out with Advance.",
    voice_companion: "Hear your reminders read aloud with Advance.",
};

// Every gated feature key, i.e. the ones that need copy. Exported so the test
// can assert coverage without re-deriving the rule.
export const GATED_FEATURE_KEYS: string[] = FEATURES.filter(
    (f) => f.requiredTier !== "free"
).map((f) => f.key);

/**
 * The one sentence to show when `key` is locked because the tier is too low.
 *
 * The fallback names the tier from the matrix rather than returning a generic
 * "Upgrade to continue", so a key added to the matrix without copy still
 * produces something honest and specific. The test keeps that path from
 * becoming the norm.
 */
export function upgradeMessageFor(key: string): string {
    const written = UPGRADE_MESSAGES[key];
    if (written) return written;

    const feature = getFeature(key);
    if (!feature || feature.requiredTier === "free") return "";
    return `${feature.name} is part of ${TIER_LABELS[feature.requiredTier]}.`;
}

/**
 * Copy for a subscription that lapsed, as opposed to one that was never bought.
 * Policy §5: this pairs with a Restore Purchases action, because the commonest
 * cause of a lapsed-looking subscription is a reinstall on a device that has
 * simply not replayed its receipts yet.
 */
export function expiredMessageFor(expiresAtUtc?: string | null): string {
    if (!expiresAtUtc) return "Your plan has ended. Renew to continue.";
    const when = new Date(expiresAtUtc);
    if (Number.isNaN(when.getTime())) return "Your plan has ended. Renew to continue.";
    const date = when.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
    return `Your plan ended on ${date}. Renew to continue.`;
}

/** Short badge text for a locked entry point, e.g. "PLUS". */
export function tierBadgeFor(key: string): string {
    const feature = getFeature(key);
    if (!feature || feature.requiredTier === "free") return "";
    return TIER_LABELS[feature.requiredTier].toUpperCase();
}
