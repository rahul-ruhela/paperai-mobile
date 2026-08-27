import { api } from "../api/client";
import { isFeatureAllowed } from "../config/featureMatrix";

// entitlementService — thin wrapper over GET /api/entitlements/me with a short
// in-memory cache so multiple hooks/screens on one render don't each hit the
// network. The backend remains the authority; this only drives UX.

const CACHE_TTL_MS = 30_000;

let _cache = null; // { snapshot, fetchedAt }
let _inFlight = null;

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
            const { data } = await api.get("/api/entitlements/me");
            const snapshot = { ...FREE_SNAPSHOT, ...data };
            _cache = { snapshot, fetchedAt: Date.now() };
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
export function invalidateEntitlements() {
    _cache = null;
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
