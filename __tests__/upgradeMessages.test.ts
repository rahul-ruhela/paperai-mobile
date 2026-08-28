import {
    UPGRADE_MESSAGES,
    GATED_FEATURE_KEYS,
    upgradeMessageFor,
    expiredMessageFor,
    tierBadgeFor,
    TIER_LABELS,
} from "../src/config/upgradeMessages";
import { FEATURES, getFeature } from "../src/config/featureMatrix";
import { isSubscriptionExpired } from "../src/services/entitlementService";

// The rules being enforced here are docs/subscription-entitlement-policy.md §4.
// They are testable because they are mechanical, and they matter because this
// copy is the only explanation a user gets for why something they can see does
// not work.

describe("coverage", () => {
    it("has a written sentence for every gated feature", () => {
        const missing = GATED_FEATURE_KEYS.filter((k) => !UPGRADE_MESSAGES[k]);
        expect(missing).toEqual([]);
    });

    it("does not carry copy for a free feature", () => {
        // A free feature with an upsell sentence means either the copy or the
        // tier is wrong, and both mislead.
        const freeKeys = FEATURES.filter((f) => f.requiredTier === "free").map((f) => f.key);
        const overreach = freeKeys.filter((k) => UPGRADE_MESSAGES[k]);
        expect(overreach).toEqual([]);
    });

    it("does not carry copy for a key the matrix has never heard of", () => {
        const stale = Object.keys(UPGRADE_MESSAGES).filter((k) => !getFeature(k));
        expect(stale).toEqual([]);
    });
});

describe("policy §4 copy rules", () => {
    const entries = Object.entries(UPGRADE_MESSAGES);

    it("names the tier that unlocks the feature", () => {
        for (const [key, message] of entries) {
            const tier = getFeature(key)!.requiredTier;
            expect(message).toContain(TIER_LABELS[tier]);
        }
    });

    it("is one sentence, and never shouts", () => {
        for (const [, message] of entries) {
            expect(message).not.toContain("!");
            expect(message.trim().endsWith(".")).toBe(true);
            // One terminal full stop, at the end — anything more is two sentences.
            expect(message.slice(0, -1)).not.toContain(".");
        }
    });

    it("never quotes a price", () => {
        // Prices come from StoreKit and vary by storefront; a number baked in
        // here is wrong in every currency but the one it was written in, and
        // Apple rejects paywalls that misstate them.
        for (const [, message] of entries) {
            expect(message).not.toMatch(/[$£€₹]|\d/);
        }
    });

    it("never says only 'Upgrade'", () => {
        for (const [, message] of entries) {
            expect(message.toLowerCase()).not.toBe("upgrade.");
            expect(message.toLowerCase()).not.toBe("upgrade to continue.");
        }
    });
});

describe("upgradeMessageFor", () => {
    it("returns the written sentence when there is one", () => {
        expect(upgradeMessageFor("ai_chat")).toBe(UPGRADE_MESSAGES.ai_chat);
    });

    it("falls back to a specific sentence, not a generic one", () => {
        // Simulated by a key that exists in the matrix; if copy is ever dropped
        // the fallback must still name the feature and the tier.
        const message = upgradeMessageFor("household_assistant");
        expect(message).toContain("Advance");
    });

    it("returns nothing for a free or unknown feature", () => {
        expect(upgradeMessageFor("document_scanner")).toBe("");
        expect(upgradeMessageFor("not_a_real_key")).toBe("");
    });
});

describe("tierBadgeFor", () => {
    it("shouts the tier for a gated feature and stays silent for a free one", () => {
        expect(tierBadgeFor("ai_chat")).toBe("PLUS");
        expect(tierBadgeFor("smart_recall")).toBe("ADVANCE");
        expect(tierBadgeFor("document_scanner")).toBe("");
    });
});

describe("expiredMessageFor", () => {
    it("names the end date when there is one", () => {
        const message = expiredMessageFor("2026-08-01T00:00:00Z");
        expect(message).toMatch(/^Your plan ended on /);
        expect(message).toContain("2026");
    });

    it("degrades to a dateless sentence rather than printing garbage", () => {
        for (const bad of [null, undefined, "", "not-a-date"]) {
            expect(expiredMessageFor(bad as any)).toBe("Your plan has ended. Renew to continue.");
        }
    });
});

// ---------------------------------------------------------------------------
// Expired vs never-subscribed
//
// These two states look identical from `active: false` and must not be spoken
// about identically. Telling someone who has never bought anything that their
// plan ended is both wrong and alarming; the evidence a plan once existed is a
// productId on the snapshot.
// ---------------------------------------------------------------------------
describe("isSubscriptionExpired", () => {
    it("is false for a user who never subscribed", () => {
        expect(
            isSubscriptionExpired({ tier: "free", active: false, productId: null, status: "inactive" })
        ).toBe(false);
    });

    it("is false for an active subscriber", () => {
        expect(
            isSubscriptionExpired({ tier: "plus", active: true, productId: "sku.plus_monthly", status: "active" })
        ).toBe(false);
    });

    it("is true for a plan that lapsed", () => {
        expect(
            isSubscriptionExpired({
                tier: "free",
                active: false,
                productId: "sku.plus_monthly",
                status: "expired",
            })
        ).toBe(true);
    });

    it("is false for a missing snapshot, which is the offline FREE fallback", () => {
        expect(isSubscriptionExpired(null)).toBe(false);
        expect(isSubscriptionExpired(undefined)).toBe(false);
    });
});
