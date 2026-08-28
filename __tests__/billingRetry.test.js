// The retry loop around verify-transaction-auto is the last thing standing
// between "Apple took the money" and "the user has their subscription". Its
// two rules are easy to break silently:
//
//   1. A 5xx or a dropped connection means the server never rendered a verdict,
//      so the same request is safe to send again.
//   2. A 4xx IS a verdict. Retrying it only makes the user wait longer for the
//      same answer.
//
// The axios instance is mocked out entirely — these tests are about the loop,
// not about HTTP, and importing the real client drags in expo-secure-store.

jest.mock("../src/api/client", () => ({
    api: { post: jest.fn(), get: jest.fn() },
}));

import { api } from "../src/api/client";
import { verifyIosTransactionAutoWithRetry } from "../src/api/billing";

const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), {
    response: { status, data: { message: "boom" } },
});
const networkError = () => Object.assign(new Error("timeout of 60000ms exceeded"), {
    response: undefined,
});

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    // The loop sleeps 1s then 2s between attempts. Run them instantly.
    jest.useFakeTimers({ doNotFake: ["performance"] });
});

afterEach(() => {
    jest.useRealTimers();
    console.warn.mockRestore();
});

// Drives a promise to settlement while auto-advancing the fake timers the
// retry loop sleeps on.
async function settle(promise) {
    const result = promise.then(
        (value) => ({ ok: true, value }),
        (error) => ({ ok: false, error })
    );
    // Flush microtasks and timers until the promise settles.
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        jest.advanceTimersByTime(5000);
    }
    return result;
}

describe("verifyIosTransactionAutoWithRetry", () => {
    it("returns the payload on a first-attempt success without retrying", async () => {
        api.post.mockResolvedValueOnce({ data: { active: true, productId: "plus_monthly" } });

        const r = await settle(verifyIosTransactionAutoWithRetry("tx_1"));

        expect(r.ok).toBe(true);
        expect(r.value).toEqual({ active: true, productId: "plus_monthly" });
        expect(api.post).toHaveBeenCalledTimes(1);
    });

    it("retries a 500 and returns the payload when the retry succeeds", async () => {
        api.post
            .mockRejectedValueOnce(httpError(500))
            .mockResolvedValueOnce({ data: { active: true } });

        const r = await settle(verifyIosTransactionAutoWithRetry("tx_2"));

        expect(r.ok).toBe(true);
        expect(r.value).toEqual({ active: true });
        expect(api.post).toHaveBeenCalledTimes(2);
    });

    it("retries a timeout / dropped connection (no response at all)", async () => {
        api.post
            .mockRejectedValueOnce(networkError())
            .mockResolvedValueOnce({ data: { active: true } });

        const r = await settle(verifyIosTransactionAutoWithRetry("tx_3"));

        expect(r.ok).toBe(true);
        expect(api.post).toHaveBeenCalledTimes(2);
    });

    it("does NOT retry a 400 — a 4xx is a verdict, not a transient failure", async () => {
        api.post.mockRejectedValue(httpError(400));

        const r = await settle(verifyIosTransactionAutoWithRetry("tx_4"));

        expect(r.ok).toBe(false);
        expect(r.error.response.status).toBe(400);
        expect(api.post).toHaveBeenCalledTimes(1);
    });

    it("does NOT retry a 404", async () => {
        api.post.mockRejectedValue(httpError(404));

        const r = await settle(verifyIosTransactionAutoWithRetry("tx_5"));

        expect(r.ok).toBe(false);
        expect(api.post).toHaveBeenCalledTimes(1);
    });

    it("stops after the configured attempt budget and rethrows the last error", async () => {
        api.post.mockRejectedValue(httpError(503));

        const r = await settle(verifyIosTransactionAutoWithRetry("tx_6"));

        expect(r.ok).toBe(false);
        expect(r.error.response.status).toBe(503);
        // Default budget is 2 — deliberately not 3, because the server itself
        // polls Apple and a single call can legitimately take ~15s.
        expect(api.post).toHaveBeenCalledTimes(2);
    });

    it("honours an explicit attempts budget", async () => {
        api.post.mockRejectedValue(httpError(500));

        const r = await settle(verifyIosTransactionAutoWithRetry("tx_7", { attempts: 3 }));

        expect(r.ok).toBe(false);
        expect(api.post).toHaveBeenCalledTimes(3);
    });

    it("sends the transaction id to the right endpoint with a raised timeout", async () => {
        api.post.mockResolvedValueOnce({ data: {} });

        await settle(verifyIosTransactionAutoWithRetry("tx_8"));

        const [url, body, config] = api.post.mock.calls[0];
        expect(url).toBe("/api/billing/ios/verify-transaction-auto");
        expect(body).toEqual({ transactionId: "tx_8" });
        // The shared 30s default would abort a verification that was about to
        // succeed, which is how a paid subscription ends up unactivated.
        expect(config.timeout).toBeGreaterThan(30000);
    });
});
