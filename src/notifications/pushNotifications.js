import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

import { registerPushToken, deletePushToken } from "../api/push";
import { isExpoGo } from "../api/dev";

/**
 * Remote push registration.
 *
 * NOTE: the notification *handler* is registered in App.js, not here. It used to
 * live in this file, and because nothing ever imported this module it never ran —
 * so any notification arriving while the app was in the foreground was dropped.
 *
 * Every failure returns a distinct `reason` rather than a bare null. An earlier
 * version collapsed "simulator", "Expo Go can't do this", "permission denied",
 * "no project id" and "the server 404'd" into one silent null, which made a
 * failure impossible to diagnose from the app — you got "could not get a push
 * token" and no way to tell which of five very different problems it was.
 */

/** @typedef {"ok"|"simulator"|"expo-go"|"denied"|"no-project-id"|"token-failed"|"server-failed"} PushReason */

/**
 * The EAS project id. `getExpoPushTokenAsync` can sometimes infer it, but throws
 * when it can't, so it is passed explicitly.
 */
function projectId() {
    return (
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId ??
        null
    );
}

/**
 * Requests permission, fetches the Expo push token and registers it with the
 * backend. Safe to call on every launch — re-registering the same token is a
 * no-op server-side.
 *
 * @returns {Promise<{ token: string|null, reason: PushReason, detail?: string }>}
 * Never throws: push is a nice-to-have and must not block sign-in.
 */
export async function registerForPushNotifications() {
    // A simulator has no APNs connection, so there is no token to get.
    if (!Device.isDevice) {
        return { token: null, reason: "simulator" };
    }

    // Remote push was REMOVED from Expo Go in SDK 53 — `expo-notifications`
    // warns about exactly this. Local notifications (Smart Reminders) still work
    // in Expo Go; push tokens do not. A development build or TestFlight is
    // required. Checked before asking for permission so we don't burn the
    // one-shot iOS prompt on a client that cannot use the answer.
    if (isExpoGo()) {
        return { token: null, reason: "expo-go" };
    }

    let status;
    try {
        const existing = await Notifications.getPermissionsAsync();
        status = existing.status;

        // Only prompt if not already answered — re-asking after a denial does
        // nothing on iOS except waste the call.
        if (status !== "granted") {
            const req = await Notifications.requestPermissionsAsync();
            status = req.status;
        }
    } catch (e) {
        return { token: null, reason: "token-failed", detail: e?.message };
    }

    if (status !== "granted") {
        return { token: null, reason: "denied" };
    }

    const id = projectId();
    if (!id) {
        return { token: null, reason: "no-project-id" };
    }

    let token;
    try {
        const res = await Notifications.getExpoPushTokenAsync({ projectId: id });
        token = res?.data;
    } catch (e) {
        return { token: null, reason: "token-failed", detail: e?.message };
    }

    if (!token) {
        return { token: null, reason: "token-failed", detail: "Expo returned no token" };
    }

    // Getting a token and storing it are separate failures. A 404 here means the
    // push endpoints are not deployed yet — which is a very different problem
    // from the device refusing to issue a token, and used to look identical.
    try {
        await registerPushToken(token);
    } catch (e) {
        return {
            token,
            reason: "server-failed",
            detail: e?.response?.status
                ? `HTTP ${e.response.status}`
                : e?.userMessage || e?.message || "no response",
        };
    }

    return { token, reason: "ok" };
}

/**
 * Clears the token server-side on logout, so the next person to sign in on this
 * device does not receive the previous account's notifications.
 */
export async function unregisterPushNotifications() {
    try {
        await deletePushToken();
    } catch {
        // Logout must never be blocked by this.
    }
}
