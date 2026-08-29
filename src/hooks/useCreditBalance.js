import { useCallback, useEffect, useState } from "react";
import { getCreditsBalance } from "../api/credits";
import {
    cachedEntitlements,
    fetchEntitlements,
    invalidateEntitlements,
    subscribeEntitlements,
} from "../services/entitlementService";

// useCreditBalance — returns the user's verified credit balance.
//
// Seeds from the entitlement snapshot (avoids a second round-trip on launch)
// and exposes a refresh() to re-read the authoritative balance after a
// credit-spending action.
//
// It also SUBSCRIBES to the snapshot, which is the part that used to be
// missing. Before, the balance was read once on mount and then only ever
// changed if that same screen called refresh(). Screens that spend credits
// (AI Chat, Receipt Capture) do call it, so they looked right — but the Home
// screen never spends, so its pill kept showing the launch value while the
// real balance moved underneath it. Spending anywhere now updates it
// everywhere, because every spender already invalidates the snapshot.
export function useCreditBalance() {
    // Paint from the cached snapshot when there is one, so a remount does not
    // flash a dash before the fetch lands.
    const [credits, setCredits] = useState(() => cachedEntitlements()?.credits ?? null);
    const [loading, setLoading] = useState(() => cachedEntitlements() == null);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const { credits: bal } = await getCreditsBalance();
            // Re-fetches the snapshot, which publishes to every other consumer
            // of this hook — that is what keeps the Home pill in step.
            invalidateEntitlements();
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

        const unsubscribe = subscribeEntitlements((snap) => {
            if (!alive) return;
            // A null snapshot means "invalidated, refetch in flight". Keep
            // showing the last known number rather than blanking the pill.
            if (snap && typeof snap.credits === "number") {
                setCredits(snap.credits);
                setLoading(false);
            }
        });

        (async () => {
            const snap = await fetchEntitlements();
            if (alive) {
                setCredits(snap?.credits ?? 0);
                setLoading(false);
            }
        })();

        return () => {
            alive = false;
            unsubscribe();
        };
    }, []);

    return { credits, loading, refresh };
}
