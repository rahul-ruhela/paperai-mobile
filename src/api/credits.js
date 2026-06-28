import { api } from "./client";

export async function getCreditsBalance() {
    const { data } = await api.get("/api/credits/balance");
    return data; // { credits }
}

// Returns all feature configs from backend — never hardcode credit costs in UI.
export async function getFeatureConfigs() {
    const { data } = await api.get("/api/credits/feature-configs");
    return data; // Array of { featureKey, creditCost, isEnabled, userNoticeTitle, userNoticeMessage, ... }
}

// Returns config for a single feature key.
export async function getFeatureConfig(featureKey) {
    const { data } = await api.get(`/api/credits/feature-configs/${featureKey}`);
    return data;
}

// Reserve credits before starting a paid operation.
// Returns { transactionId, creditsReserved, creditsLeft }
// Throws with err.response.status === 402 if insufficient credits.
export async function reserveCredits(featureKey, referenceId = null, creditCostOverride = 0) {
    const { data } = await api.post("/api/credits/reserve", {
        featureKey,
        referenceId,
        creditCostOverride,
    });
    return data;
}

// Call after the paid operation succeeds.
export async function completeTransaction(transactionId) {
    const { data } = await api.post("/api/credits/complete", { transactionId });
    return data;
}

// Call if the paid operation fails or is cancelled after reserve.
export async function refundTransaction(transactionId, reason = null) {
    const { data } = await api.post("/api/credits/refund", { transactionId, reason });
    return data;
}
