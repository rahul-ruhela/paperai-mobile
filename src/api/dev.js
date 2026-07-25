import Constants from "expo-constants";
import { api } from "./client";
import { getCreditsBalance } from "./credits";

// Amount of test credits handed to a brand-new tester account inside Expo Go.
const EXPO_GO_TEST_CREDITS = 500;

// True only when the JS is running inside the Expo Go sandbox app — never in a
// real Dev Client, TestFlight, or App Store build. `appOwnership === "expo"`
// is the classic signal; `executionEnvironment === "storeClient"` is the SDK 50+
// equivalent. We treat either as Expo Go.
export function isExpoGo() {
    return (
        Constants.appOwnership === "expo" ||
        Constants.executionEnvironment === "storeClient"
    );
}

// Grants test credits to the authenticated user via the backend dev endpoint.
// The server hard-blocks this in Production (DevMode:AllowTestCredits + non-prod
// env) and returns 404 there, so this is safe to ship — it simply no-ops in a
// production build/API.
export async function grantDevCredits(amount = EXPO_GO_TEST_CREDITS) {
    const { data } = await api.post("/api/dev/grant-credits", { amount });
    return data; // { granted, balance }
}

// For Expo Go testing only: if this looks like a fresh account (zero balance),
// top it up with dummy credits so the tester can exercise paid features. Never
// stacks — once the balance is non-zero it does nothing. Silently no-ops when
// not in Expo Go or when the backend dev endpoint is unavailable (prod/404).
export async function ensureExpoGoTestCredits() {
    if (!isExpoGo()) return;
    try {
        const { credits } = await getCreditsBalance();
        if (credits > 0) return; // existing user — leave their balance alone
        await grantDevCredits(EXPO_GO_TEST_CREDITS);
    } catch {
        // No connection, prod endpoint disabled (404), etc. — ignore, this is
        // a best-effort testing convenience only.
    }
}
