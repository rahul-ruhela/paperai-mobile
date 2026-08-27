import { isEntitlementDenial } from "../src/api/client";

// A tier denial and a permissions failure are both 403, and they must not read
// the same. "You don't have permission to do this" is a dead end; a paywall is
// something the user can act on. Telling them apart is what this predicate does,
// and getting it wrong in either direction is a visible bug: a real permissions
// error rendered as an upsell, or an upsell rendered as a wall.

const denial = (code) => ({ response: { status: 403, data: { code, requiredTier: "plus" } } });

describe("isEntitlementDenial", () => {
    it("recognises the two codes the entitlement service emits", () => {
        expect(isEntitlementDenial(denial("FEATURE_NOT_INCLUDED"))).toBe(true);
        expect(isEntitlementDenial(denial("SUBSCRIPTION_EXPIRED"))).toBe(true);
    });

    it("ignores a 403 that carries no code", () => {
        // The admin routes 403 without a body like this; they are not paywalls.
        expect(isEntitlementDenial({ response: { status: 403, data: {} } })).toBe(false);
        expect(isEntitlementDenial({ response: { status: 403 } })).toBe(false);
    });

    it("ignores a 403 carrying an unrelated code", () => {
        expect(isEntitlementDenial(denial("ADMIN_ONLY"))).toBe(false);
    });

    it("ignores every other status, including the 402 that means credits", () => {
        // 402 is a top-up prompt, not a lock — policy §5 keeps them distinct.
        for (const status of [400, 401, 402, 404, 500]) {
            expect(isEntitlementDenial({ response: { status, data: { code: "FEATURE_NOT_INCLUDED" } } })).toBe(false);
        }
    });

    it("survives a network error with no response at all", () => {
        expect(isEntitlementDenial({})).toBe(false);
        expect(isEntitlementDenial(null)).toBe(false);
        expect(isEntitlementDenial(undefined)).toBe(false);
    });
});
