import { api, FAST } from "../api/client";
import { isFeatureAllowed } from "../config/featureMatrix";

// entitlementService — thin wrapper over GET /api/entitlements/me with a short
// in-memory cache so multiple hooks/screens on one render don't each hit the
// network. The backend remains the authority; this only drives UX.

const CACHE_TTL_MS = 30_000;

let _cache = null; // { snapshot, fetchedAt }
let _inFlight = null;

// H2 (performance-optimization-plan.md): every hook consumer used to hold its
// own copy of the snapshot, so a refresh after a purchase in one screen left
// every other screen showing the old tier until its own 30 s TTL lapsed.
//
// A subscriber set rather than the context provider the plan suggested. It
// reaches the same two outcomes — one snapshot shared by every consumer, and a
// refresh that propagates immediately — without adding a provider that every
// screen must then be rendered underneath. A gate that silently reads a default
// because it mounted outside a provider is a worse failure than the one being
// fixed, and this design cannot produce it.
const _subscribers = new Set();

/** Subscribe to snapshot changes. Returns an unsubscribe function. */
export function subscribeEntitlements(listener) {
    _subscribers.add(listener);
    return () => _subscribers.delete(listener);
}

function publish(snapshot) {
    for (const listener of _subscribers) {
        try {
            listener(snapshot);
        } catch {
            // One bad listener must not stop the others being told.
        }
    }
}

/** The cached snapshot, or null. Lets a consumer paint before its fetch lands. */
export function cachedEntitlements() {
    return _cache?.snapshot ?? null;
}

// Shape returned by the backend, defaulted so the app degrades to Free safely.
const FREE_SNAPSHOT = {
    tier: "free",
    active: false,
    productId: null,
    status: "inactive",
    expiresAtUtc: null,
    credits: 0,
    features: [],
};

export async function fetchEntitlements({ force = false } = {}) {
    const fresh = _cache && Date.now() - _cache.fetchedAt < CACHE_TTL_MS;
    if (!force && fresh) return _cache.snapshot;
    if (_inFlight) return _inFlight;

    _inFlight = (async () => {
        try {
            const { data } = await api.get("/api/entitlements/me", FAST);
            const snapshot = { ...FREE_SNAPSHOT, ...data };
            _cache = { snapshot, fetchedAt: Date.now() };
            publish(snapshot);
            return snapshot;
        } catch (err) {
            // Never hard-fail the UI on entitlement load — fall back to Free.
            if (_cache) return _cache.snapshot;
            return FREE_SNAPSHOT;
        } finally {
            _inFlight = null;
        }
    })();

    return _inFlight;
}

// Call after a purchase, refund, or credit-spending action to force a refresh.
//
// Re-fetches rather than only clearing, so every subscribed screen updates at
// once. Fire-and-forget: the caller has already done the thing that made the
// snapshot stale and has nothing to wait for.
export function invalidateEntitlements({ refetch = true } = {}) {
    _cache = null;
    if (refetch) fetchEntitlements({ force: true }).catch(() => {});
}

// Server-authoritative single-feature check. Returns
// { allowed: true } or { allowed: false, code, requiredTier, message }.
export async function checkFeatureAccess(featureKey) {
    try {
        const { data } = await api.get(`/api/entitlements/check/${featureKey}`);
        return { allowed: !!data?.allowed };
    } catch (err) {
        const status = err?.response?.status;
        if (status === 403 && err.response?.data) {
            const { code, requiredTier, message } = err.response.data;
            return { allowed: false, code, requiredTier, message };
        }
        throw err;
    }
}

// Local (optimistic) check from a cached snapshot — UX only.
export function isAllowedLocal(snapshot, featureKey) {
    const tier = snapshot?.tier ?? "free";
    return isFeatureAllowed(featureKey, tier);
}

// True only when the user HAD a plan and it lapsed — not when they never bought
// one. The two states get different copy (policy §5): a lapsed plan names its
// end date and offers Restore Purchases, because a reinstall that has not
// replayed its receipts looks exactly like an expiry and must be recoverable
// without a second purchase. A never-subscribed user gets the ordinary upsell.
export function isSubscriptionExpired(snapshot) {
    if (!snapshot) return false;
    if (snapshot.active) return false;
    // productId is the evidence a subscription once existed; the FREE fallback
    // snapshot and a brand-new account both leave it null.
    if (!snapshot.productId) return false;
    return snapshot.status !== "inactive";
}
