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
