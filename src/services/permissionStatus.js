import { Platform } from "react-native";
import * as ExpoCamera from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as ImagePicker from "expo-image-picker";
import * as Notifications from "expo-notifications";

/**
 * permissionStatus — reads the OS permission state, and only reads it.
 *
 * Every call here is a **get** variant. Never add a request* call to this
 * module: the OS shows its prompt once per permission per install, and firing
 * it from a status panel burns that one chance somewhere the user has no
 * feature in front of them to say yes *for*. That is also what App Store
 * guideline 5.1.1 asks for — the prompt belongs at the point of use, which is
 * what src/utils/permissions.js does for the feature flows.
 *
 * Nothing is cached across calls. iOS lets the user change a permission while
 * the app is backgrounded, so a cached value is a value that lies; callers
 * re-read on foreground instead.
 */

/** Display states. `unknown` is ours — see toDisplayState. */
export const STATE = {
    GRANTED: "granted",
    LIMITED: "limited",
    DENIED: "denied",
    UNDETERMINED: "undetermined",
    UNKNOWN: "unknown",
    NOT_USED: "not_used",
};

/**
 * Collapses an Expo PermissionResponse into one display state.
 *
 * Pure, and exported for tests: the mapping is the part that can silently be
 * wrong, and getting it wrong shows a user "Denied" for a permission they
 * granted — which reads as the app lying about their own settings.
 *
 * `limited` is checked before `granted` on purpose. iOS reports limited photo
 * access as granted-with-accessPrivileges-"limited"; treating that as plain
 * "Allowed" is the bug that makes a partial library scan look complete.
 */
export function toDisplayState(response) {
    if (!response || typeof response !== "object") return STATE.UNKNOWN;

    if (response.accessPrivileges === "limited") return STATE.LIMITED;
    if (response.granted === true) return STATE.GRANTED;

    const status = String(response.status ?? "").toLowerCase();
    if (status === "granted") return STATE.GRANTED;
    if (status === "undetermined") return STATE.UNDETERMINED;
    if (status === "denied") return STATE.DENIED;

    // No status we recognise. canAskAgain is the only remaining signal, and it
    // is true only while the prompt has never been answered.
    return response.canAskAgain === true ? STATE.UNDETERMINED : STATE.DENIED;
}

// Most-restrictive-first. Used to reconcile the two photo readers below, so a
// disagreement is never resolved in the app's favour.
const PHOTO_PRECEDENCE = [
    STATE.LIMITED,
    STATE.DENIED,
    STATE.UNDETERMINED,
    STATE.GRANTED,
    STATE.UNKNOWN,
];

/**
 * expo-media-library and expo-image-picker both read the same iOS Photos
 * authorisation, but through different native shims and with different
 * granularity. When they disagree we report the more restrictive of the two:
 * claiming more access than we have is the failure that matters.
 *
 * Exported for tests.
 */
export function mergePhotoStates(a, b) {
    // A failed read carries no information, so the other reader wins outright.
    if (a === STATE.UNKNOWN) return b;
    if (b === STATE.UNKNOWN) return a;
    for (const state of PHOTO_PRECEDENCE) {
        if (a === state || b === state) return state;
    }
    return STATE.UNKNOWN;
}

async function readState(read) {
    try {
        return toDisplayState(await read());
    } catch {
        // A getter that throws (module missing in a bare runtime, an OS the
        // shim does not cover) must not take the whole panel down; the row
        // says "Unknown" instead.
        return STATE.UNKNOWN;
    }
}

/**
 * Reads every permission the panel shows.
 *
 * @returns {Promise<Array<{
 *   key: string, label: string, state: string, usedByApp: boolean,
 *   why: string, features: string[], canRequest: boolean, canManage: boolean
 * }>>}
 *
 * `canRequest` reports whether the OS *could* still prompt — it is descriptive
 * only. Nothing in this module or in PermissionCenterScreen acts on it; the
 * feature flows own the asking.
 */
export async function getAllStatuses() {
    const [camera, mediaLibrary, imagePicker, notifications] = await Promise.all([
        readState(() => ExpoCamera.getCameraPermissionsAsync()),
        readState(() => MediaLibrary.getPermissionsAsync(false)),
        readState(() => ImagePicker.getMediaLibraryPermissionsAsync()),
        readState(() => Notifications.getPermissionsAsync()),
    ]);

    const photos = mergePhotoStates(mediaLibrary, imagePicker);

    return [
        {
            key: "camera",
            label: "Camera",
            state: camera,
            usedByApp: true,
            why: "Scanning documents and receipts, and reading QR and barcodes.",
            features: ["Document scanner", "Receipt capture", "Code scanner"],
            canRequest: camera === STATE.UNDETERMINED,
            canManage: false,
        },
        {
            key: "photos",
            label: "Photos",
            state: photos,
            usedByApp: true,
            why: "Choosing images to extract text from or sign, and finding duplicates in Junk Wiper.",
            features: ["Upload from library", "Signature on a photo", "Junk Wiper duplicate scan"],
            canRequest: photos === STATE.UNDETERMINED,
            // presentPermissionsPickerAsync is the iOS limited-library picker
            // and exists nowhere else.
            canManage: Platform.OS === "ios" && photos === STATE.LIMITED,
        },
        {
            key: "notifications",
            label: "Notifications",
            state: notifications,
            usedByApp: true,
            why: "Delivering reminders you set and telling you when an analysis finishes.",
            features: ["Smart reminders", "Task alerts", "Analysis-complete alerts"],
            canRequest: notifications === STATE.UNDETERMINED,
            canManage: false,
        },
        // Microphone and Location are listed so the user can verify the app is
        // NOT using them. They are deliberately not read: app.json sets
        // microphonePermission:false (so the app ships without the usage
        // string) and expo-location is not a dependency at all. Showing a live
        // state for either would imply a use that does not exist.
        {
            key: "microphone",
            label: "Microphone",
            state: STATE.NOT_USED,
            usedByApp: false,
            why: "Paper AI never records audio. The microphone is not enabled in this build.",
            features: [],
            canRequest: false,
            canManage: false,
        },
        {
            key: "location",
            label: "Location",
            state: STATE.NOT_USED,
            usedByApp: false,
            why: "Paper AI never asks for or uses your location.",
            features: [],
            canRequest: false,
            canManage: false,
        },
    ];
}

/**
 * Opens the iOS limited-photo picker so the user can add or remove the assets
 * the app can see. This is the one state change the panel can make, and the
 * user makes it inside the system picker — the app only opens it.
 */
export async function manageLimitedPhotos() {
    await MediaLibrary.presentPermissionsPickerAsync();
}
