import { api } from "./client";

/**
 * Push notification client — device token + per-type preferences.
 *
 * Talks to /api/push (PushController), which is deliberately separate from the
 * legacy POST /api/notifications/register-token that shipped builds already
 * call. That old endpoint still works; this one adds preferences, token
 * removal, and the announcements opt-in.
 *
 * `announcements` is the marketing opt-in and defaults to FALSE server-side.
 * App Store guideline 4.5.4: accepting the OS permission prompt is consent for
 * transactional notifications only, never for promotions — so it has to be a
 * separate switch the user turns on themselves.
 */

export async function registerPushToken(token) {
    const { data } = await api.post("/api/push/token", { token });
    return data; // { registered: true }
}

export async function deletePushToken() {
    const { data } = await api.delete("/api/push/token");
    return data; // { registered: false }
}

export async function getPushPreferences() {
    const { data } = await api.get("/api/push/preferences");
    return data; // { analysisComplete, usageReminders, renewalReminders, announcements }
}

/** Only the keys passed are changed; omitted ones are left as they are. */
export async function updatePushPreferences(patch) {
    const { data } = await api.put("/api/push/preferences", patch);
    return data;
}

/**
 * Sends a test push to the calling account only.
 *
 * Admin-gated server-side (403 otherwise), so this is safe even if the UI that
 * calls it is ever visible outside a dev build. Useful for confirming the whole
 * chain end to end: token registered → Expo accepted it → APNs delivered it →
 * the app displayed it.
 */
export async function sendTestPush() {
    const { data } = await api.post("/api/push/test");
    return data; // { ok, tokenIsDead, error }
}
