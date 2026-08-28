import { getVoicePreferences } from "../api/voice";
import { isSpeaking, speak } from "./voiceService";

/**
 * voicePlayback — the bridge between a delivered notification and the
 * synthesiser (roadmap Module 7, docs/voice-assistant-spec.md §4).
 *
 * Separate from voiceService because it is the only part that touches app-wide
 * state: it caches preferences, and it enforces "speak this reminder once".
 *
 * Two entry points call it, and both live in App.js at module scope:
 *   1. the notification handler, when a reminder fires in the foreground;
 *   2. the response listener, when the user taps one — including the tap that
 *      cold-launched the app.
 *
 * Both hand it the same payload, and the sentence inside was composed at
 * SCHEDULE time. Nothing here composes, fetches text, or needs a network: iOS
 * will not run app code when a notification is delivered in the background, so
 * anything not already in the payload would simply not exist by now.
 *
 * Every failure is silent. A reminder that could not be spoken has still been
 * delivered as a banner, and an alert about a synthesiser is a worse
 * interruption than the silence it complains about (spec §8).
 */

/** Preferences are re-read at most this often; playback must not wait on a request. */
const PREFS_TTL_MS = 60_000;

let cached = null;
let cachedAt = 0;

/** The last payload spoken, so a fire and a tap of the same reminder speak once. */
let lastSpokenKey = null;

/** Dropped when the user changes a setting, so the next reminder uses it. */
export function invalidateVoicePrefs() {
    cached = null;
    cachedAt = 0;
}

async function loadPrefs() {
    if (cached && Date.now() - cachedAt < PREFS_TTL_MS) return cached;
    try {
        cached = await getVoicePreferences();
        cachedAt = Date.now();
    } catch {
        // Offline, or the request failed. Staying silent is the safe answer:
        // speaking when we cannot confirm the user asked for it is worse than
        // not speaking when they did.
        return cached ?? null;
    }
    return cached;
}

/**
 * Speaks the sentence carried in a notification payload, if the user has asked
 * for that.
 *
 * @param data     the notification's `content.data`
 * @param onTap    true when this came from the user tapping the notification,
 *                 which is governed by the separate `speakOnTap` preference.
 * @returns { spoken: boolean, reason?: string } — for tests, not for the user.
 */
export async function speakFromPayload(data, { onTap = false } = {}) {
    try {
        const sentence = data?.spoken;
        if (!sentence || typeof sentence !== "string") return { spoken: false, reason: "no-payload" };

        // A banner that speaks itself and is then tapped must not say it twice.
        const key = `${data.taskId ?? ""}:${sentence}`;
        if (onTap && lastSpokenKey === key && (await isSpeaking())) {
            return { spoken: false, reason: "already-speaking" };
        }

        const prefs = await loadPrefs();
        if (!prefs) return { spoken: false, reason: "no-prefs" };

        // The server is the authority on the tier; `available` comes from it.
        if (!prefs.available) return { spoken: false, reason: "not-available" };
        if (!prefs.enabled) return { spoken: false, reason: "disabled" };
        if (onTap && prefs.speakOnTap === false) return { spoken: false, reason: "tap-disabled" };

        lastSpokenKey = key;
        return await speak(sentence, { voiceId: prefs.voiceId, rate: prefs.rate });
    } catch {
        return { spoken: false, reason: "error" };
    }
}

/** Test seam: forget what was last spoken. */
export function resetPlaybackState() {
    lastSpokenKey = null;
    invalidateVoicePrefs();
}
