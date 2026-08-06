import { api } from "./client";

export async function getEntitlement() {
    const { data } = await api.get("/api/billing/entitlement");
    return data;
}

export async function verifyIosReceipt(receiptDataBase64) {
    const { data } = await api.post("/api/billing/ios/verify-receipt", {
        receiptDataBase64,
    });
    return data;
}

// OPTIONAL but recommended:
// Call on app launch if you cache last receipt locally
export async function syncIosReceipt(receiptDataBase64) {
    const { data } = await api.post("/api/billing/ios/sync-receipt", {
        receiptDataBase64,
    });
    return data;
}


// Preferred for StoreKit 2: auto-detects sandbox vs production by transactionId
export async function verifyIosTransactionAuto(transactionId) {
    const { data } = await api.post("/api/billing/ios/verify-transaction-auto", {
        transactionId,
    });
    return data;
}

// A 5xx or a dropped connection here means the server never gave a verdict, so
// the same request is safe to send again. A 4xx is a verdict — retrying it just
// makes the user wait longer for the same answer.
function isRetriableVerifyError(err) {
    const status = err?.response?.status;
    if (status == null) return true; // timeout / no connection
    return status >= 500;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * verifyIosTransactionAuto with bounded backoff.
 *
 * Apple has already taken the money by the time this runs, so a transient
 * backend failure must not be the thing that decides whether the user gets
 * their subscription.
 */
export async function verifyIosTransactionAutoWithRetry(transactionId, { attempts = 3 } = {}) {
    let lastErr;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await verifyIosTransactionAuto(transactionId);
        } catch (err) {
            lastErr = err;
            if (!isRetriableVerifyError(err) || attempt === attempts) throw err;

            // Surface the server's real message — the axios interceptor replaces
            // it with a generic string before any screen ever sees it.
            console.warn(
                `[IAP] verify attempt ${attempt}/${attempts} failed`,
                `status=${err?.response?.status ?? "none"}`,
                `body=${JSON.stringify(err?.response?.data ?? null)}`
            );

            await sleep(1000 * 2 ** (attempt - 1)); // 1s, 2s
        }
    }

    throw lastErr;
}

export async function mockSubscribe(productId) {
    const { data } = await api.post(
        "/api/billing/mock-subscribe", // ✅ correct route
        {
            productId, // ✅ correct payload
        }
    );
    return data;
}
