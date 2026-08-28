// H2 in docs/performance-optimization-plan.md.
//
// Before this, every consumer of useAccessTier held its own copy of the
// snapshot. Refreshing after a purchase in one screen left every other screen
// showing the old tier until its own 30 s cache lapsed — the user had paid and
// the app still said no. These tests are about the publish reaching everyone.

const mockGet = jest.fn();

jest.mock("../src/api/client", () => ({
    api: { get: (...a) => mockGet(...a) },
    FAST: { timeout: 10000 },
}));

const {
    fetchEntitlements,
    invalidateEntitlements,
    subscribeEntitlements,
    cachedEntitlements,
} = require("../src/services/entitlementService");

const FREE = { data: { tier: "free", active: false } };
const ADVANCE = { data: { tier: "advance", active: true } };

beforeEach(() => {
    jest.clearAllMocks();
    // Clear the module cache without triggering the automatic re-fetch.
    invalidateEntitlements({ refetch: false });
    mockGet.mockResolvedValue(FREE);
});

describe("shared snapshot", () => {
    it("serves several consumers from one request", async () => {
        await Promise.all([fetchEntitlements(), fetchEntitlements(), fetchEntitlements()]);
        expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("does not re-request inside the cache window", async () => {
        await fetchEntitlements();
        await fetchEntitlements();
        expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("tells every subscriber when the snapshot changes", async () => {
        const a = jest.fn();
        const b = jest.fn();
        subscribeEntitlements(a);
        subscribeEntitlements(b);

        await fetchEntitlements();

        expect(a).toHaveBeenCalledWith(expect.objectContaining({ tier: "free" }));
        expect(b).toHaveBeenCalledWith(expect.objectContaining({ tier: "free" }));
    });

    it("pushes the new tier to every screen after a purchase", async () => {
        // The whole point: one screen invalidates, all of them update.
        const listener = jest.fn();
        await fetchEntitlements();
        subscribeEntitlements(listener);

        mockGet.mockResolvedValue(ADVANCE);
        invalidateEntitlements();
        await new Promise((r) => setImmediate(r));

        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ tier: "advance" }));
    });

    it("stops telling a subscriber that has unsubscribed", async () => {
        const listener = jest.fn();
        const unsubscribe = subscribeEntitlements(listener);
        unsubscribe();

        await fetchEntitlements();
        expect(listener).not.toHaveBeenCalled();
    });

    it("keeps notifying the others when one listener throws", async () => {
        const bad = jest.fn(() => {
            throw new Error("a screen unmounted badly");
        });
        const good = jest.fn();
        subscribeEntitlements(bad);
        subscribeEntitlements(good);

        await expect(fetchEntitlements()).resolves.toBeTruthy();
        expect(good).toHaveBeenCalled();
    });

    it("exposes the cache so a late screen paints its real tier immediately", async () => {
        // Otherwise a screen mounting after the first fetch flashes Free before
        // its own request lands — a paid feature briefly rendering locked.
        expect(cachedEntitlements()).toBeNull();
        await fetchEntitlements();
        expect(cachedEntitlements()).toMatchObject({ tier: "free" });
    });

    it("falls back to Free rather than failing the UI", async () => {
        mockGet.mockRejectedValue(new Error("offline"));
        expect(await fetchEntitlements()).toMatchObject({ tier: "free", active: false });
    });

    it("keeps serving the last good snapshot when a refresh fails", async () => {
        mockGet.mockResolvedValue(ADVANCE);
        await fetchEntitlements();

        mockGet.mockRejectedValue(new Error("offline"));
        expect(await fetchEntitlements({ force: true })).toMatchObject({ tier: "advance" });
    });
});
