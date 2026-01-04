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


export async function mockSubscribe(productId) {
    const { data } = await api.post(
        "/api/billing/mock-subscribe", // ✅ correct route
        {
            productId, // ✅ correct payload
        }
    );
    return data;
}
