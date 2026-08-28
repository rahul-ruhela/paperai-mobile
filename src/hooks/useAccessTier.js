import { useCallback, useEffect, useState } from "react";

import {
    cachedEntitlements,
    fetchEntitlements,
    subscribeEntitlements,
} from "../services/entitlementService";

/**
 * useAccessTier — the user's resolved entitlement snapshot (tier, active,
 * credits, per-feature allow map).
 *
 * Every consumer now reads the SAME snapshot. Before this each mount held its
 * own copy, so refreshing after a purchase in one screen left every other screen
 * showing the old tier until its own 30 s cache lapsed — the user had paid and
 * the app still said no. Subscribing fixes that: one publish reaches everyone
 * (H2 in docs/performance-optimization-plan.md).
 *
 * The return shape is unchanged, deliberately. Nothing that uses this hook —
 * useFeatureAccess, FeatureLock, and every screen behind them — needed editing.
 */
export function useAccessTier() {
    // Seed from the shared cache so a screen that mounts after the first fetch
    // paints its correct tier immediately instead of flashing Free.
    const [snapshot, setSnapshot] = useState(() => cachedEntitlements());
    const [loading, setLoading] = useState(() => cachedEntitlements() == null);

    const load = useCallback(async (force = false) => {
        setLoading(true);
        try {
            const snap = await fetchEntitlements({ force });
            setSnapshot(snap);
            return snap;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let alive = true;

        // Published changes — including the refresh after a purchase — land here
        // without this screen asking for them.
        const unsubscribe = subscribeEntitlements((next) => {
            if (alive) {
                setSnapshot(next);
                setLoading(false);
            }
        });

        // Honours the service's TTL, so mounting several gated screens in a row
        // still costs one request.
        fetchEntitlements()
            .then((snap) => {
                if (alive) {
                    setSnapshot(snap);
                    setLoading(false);
                }
            })
            .catch(() => {
                if (alive) setLoading(false);
            });

        return () => {
            alive = false;
            unsubscribe();
        };
    }, []);

    return {
        snapshot,
        tier: snapshot?.tier ?? "free",
        active: snapshot?.active ?? false,
        loading,
        refresh: () => load(true),
    };
}
