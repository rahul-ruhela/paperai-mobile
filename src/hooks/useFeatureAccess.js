import { useMemo } from "react";
import { useAccessTier } from "./useAccessTier";
import { getFeature, isFeatureAllowed } from "../config/featureMatrix";

// useFeatureAccess — resolves whether the current user can use a given feature.
// The returned `allowed` is a UX hint computed from the cached snapshot; the
// backend still authorizes the actual action. `requiredTier` and `feature` help
// screens render the correct upsell.
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

        return {
            allowed,
            loading,
            tier,
            requiredTier: feature?.requiredTier ?? "free",
            feature,
            refresh,
        };
    }, [snapshot, tier, loading, featureKey, refresh]);
}
