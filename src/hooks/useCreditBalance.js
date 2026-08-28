import { useCallback, useEffect, useState } from "react";
import { getCreditsBalance } from "../api/credits";
import { fetchEntitlements, invalidateEntitlements } from "../services/entitlementService";

// useCreditBalance — returns the user's verified credit balance. Seeds from the
// entitlement snapshot (avoids a second round-trip on launch) and exposes a
// refresh() to re-read the authoritative balance after a credit-spending action.
export function useCreditBalance() {
    const [credits, setCredits] = useState(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const { credits: bal } = await getCreditsBalance();
            invalidateEntitlements(); // keep the snapshot's credits in sync
            setCredits(bal ?? 0);
            return bal ?? 0;
        } catch {
            return credits ?? 0;
        } finally {
            setLoading(false);
        }
    }, [credits]);

    useEffect(() => {
        let alive = true;
        (async () => {
            const snap = await fetchEntitlements();
            if (alive) {
                setCredits(snap?.credits ?? 0);
                setLoading(false);
            }
        })();
        return () => {
            alive = false;
        };
    }, []);

    return { credits, loading, refresh };
}
