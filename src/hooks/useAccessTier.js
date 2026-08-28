import { useCallback, useEffect, useState } from "react";
import { fetchEntitlements } from "../services/entitlementService";

// useAccessTier — loads the user's resolved entitlement snapshot (tier, active,
// credits, per-feature allow map) from the backend. Returns the whole snapshot
// plus loading state and a refresh() to force a re-fetch after a purchase.
export function useAccessTier() {
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(true);

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
        (async () => {
            const snap = await fetchEntitlements();
            if (alive) {
                setSnapshot(snap);
                setLoading(false);
            }
        })();
        return () => {
            alive = false;
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
