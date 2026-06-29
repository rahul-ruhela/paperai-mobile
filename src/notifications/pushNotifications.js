import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { api } from "../api/client";

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

export async function registerForPushNotifications() {
    if (!Device.isDevice) return;

    const { status: existingStatus } =
        await Notifications.getPermissionsAsync();



    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== "granted") return;

    const token = (await Notifications.getExpoPushTokenAsync()).data;

    await api.post("api/notifications/register-token", {
        token,
    });

    console.log("🔔 registerForPushNotifications called");

   
    console.log("🔥 EXPO PUSH TOKEN:", token);
}
