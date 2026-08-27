import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

import { registerPushToken, deletePushToken } from "../api/push";

/**
 * Remote push registration.
 *
 * NOTE: the notification *handler* is registered in App.js, not here. It used to
 * live in this file, and because nothing ever imported this module it never ran —
 * which meant any notification arriving while the app was in the foreground was
 * dropped silently.
 */

/**
 * The EAS project id. `getExpoPushTokenAsync` can usually infer this, but it
 * throws when it can't — and it can't in a bare workflow or when the manifest is
 * served in a shape it doesn't recognise. Passing it explicitly removes that
 * whole class of launch-time failure.
 */
function projectId() {
    return (
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId ??
        undefined
    );
}

/**
 * Requests permission, fetches the Expo push token and registers it with the
 * backend. Safe to call on every launch — registering the same token again is a
 * no-op server-side.
 *
 * Returns the token, or null when push isn't available (simulator, permission
 * denied, no network). Never throws: push is a nice-to-have, and a failure here
 * must not block sign-in.
 */
export async function registerForPushNotifications() {
    // A simulator has no APNs connection, so there is no token to get.
    if (!Device.isDevice) return null;

    try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;

        // Only prompt if we have not already been answered. Asking again after
        // a denial does nothing on iOS except waste the call.
        if (status !== "granted") {
            const req = await Notifications.requestPermissionsAsync();
            status = req.status;
        }

        if (status !== "granted") return null;

        const id = projectId();
        const { data: token } = await Notifications.getExpoPushTokenAsync(
            id ? { projectId: id } : undefined
        );

        if (!token) return null;

        await registerPushToken(token);
        return token;
    } catch {
        // Offline, endpoint unavailable, entitlement missing in a dev build —
        // all best-effort. The next launch tries again.
        return null;
    }
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
