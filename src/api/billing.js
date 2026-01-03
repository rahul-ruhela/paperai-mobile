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

// Expo Go cannot run Apple IAP. Use this to test paywall + credits end-to-end.
// Backend only enables this when DevMode:BypassSubscription = true.
//export async function mockSubscribe(plan) {
//    debugger    
//    const { data } = await api.post("/api/billing/mock/subscribe", { plan });
//    return data;
//}


export async function mockSubscribe(productId) {
    const { data } = await api.post(
        "/api/billing/mock-subscribe", // ✅ correct route
        {
            productId, // ✅ correct payload
        }
    );
    return data;
}



//export async function verifyIosReceipt(receiptDataBase64) {
//    const { data } = await api.post("/api/billing/ios/verify-receipt", {
//        receiptDataBase64,
//    });
//    return data;
//}