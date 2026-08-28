import { useMemo } from "react";
import { useAccessTier } from "./useAccessTier";
import { getFeature, isFeatureAllowed } from "../config/featureMatrix";
import {
    upgradeMessageFor,
    expiredMessageFor,
    tierBadgeFor,
    TIER_LABELS,
} from "../config/upgradeMessages";
import { isSubscriptionExpired } from "../services/entitlementService";

// useFeatureAccess — resolves whether the current user can use a given feature,
// and — when they cannot — everything a screen needs to say so consistently.
//
// `allowed` is a UX hint computed from the cached snapshot; the backend still
// authorizes the actual action. The rest of the return value exists so that no
// screen has to invent its own upsell copy: before this, seven screens each
// hand-rolled an Alert with different wording for the same lock.
//
// Two distinct locked states, per docs/subscription-entitlement-policy.md §5:
//   TIER_REQUIRED        — never had this tier. Ordinary upsell.
//   SUBSCRIPTION_EXPIRED — had a plan, it lapsed. Names the date, and must offer
//                          Restore Purchases, since an un-replayed receipt after
//                          a reinstall is indistinguishable from an expiry.
export function useFeatureAccess(featureKey) {
    const { snapshot, tier, loading, refresh } = useAccessTier();

    return useMemo(() => {
        const feature = getFeature(featureKey);

        // Prefer the server-computed allow map when present; fall back to the
        // local matrix comparison.
        const fromServer = snapshot?.features?.find((f) => f.key === featureKey);
        const allowed = fromServer
            ? !!fromServer.allowed
            : isFeatureAllowed(featureKey, tier);

        const requiredTier = feature?.requiredTier ?? "free";
        const expired = !allowed && isSubscriptionExpired(snapshot);
        const lockReason = allowed
            ? null
            : expired
              ? "SUBSCRIPTION_EXPIRED"
              : "TIER_REQUIRED";

        return {
            allowed,
            loading,
            tier,
            requiredTier,
            feature,
            refresh,

            // Presentation for the locked state. Empty strings when allowed, so
            // a screen can render them unconditionally without a guard.
            lockReason,
            lockTitle: allowed ? "" : `${TIER_LABELS[requiredTier]} feature`,
            lockMessage: allowed
                ? ""
                : expired
                  ? expiredMessageFor(snapshot?.expiresAtUtc)
                  : upgradeMessageFor(featureKey),
            tierBadge: tierBadgeFor(featureKey),
            // A lapsed plan is often just an un-replayed receipt, so the sheet
            // has to offer restore before it offers another purchase.
            showRestore: expired,
        };
    }, [snapshot, tier, loading, featureKey, refresh]);
}
