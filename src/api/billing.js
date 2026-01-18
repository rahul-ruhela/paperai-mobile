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

export async function syncIosReceipt(receiptDataBase64) {
    const { data } = await api.post("/api/billing/ios/sync-receipt", {
        receiptDataBase64,
    });
    return data;
}

/**
 * ✅ StoreKit2-safe verification: verify via transactionId
 * We'll try sandbox first (dev/testflight), and if that fails, try production.
 */
export async function verifyIosTransaction(transactionId) {
    // try sandbox first
    try {
        const { data } = await api.post("/api/billing/ios/verify-transaction", {
            transactionId,
            sandbox: true,
        });
        return data;
    } catch (e) {
        // then production
        const { data } = await api.post("/api/billing/ios/verify-transaction", {
            transactionId,
            sandbox: false,
        });
        return data;
    }
}

export async function mockSubscribe(productId) {
    const { data } = await api.post("/api/billing/mock-subscribe", { productId });
    return data;
}
