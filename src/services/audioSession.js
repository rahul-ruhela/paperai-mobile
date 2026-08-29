import { setAudioModeAsync } from "expo-audio";

/**
 * audioSession — configures the iOS audio session once, at launch.
 *
 * WHY THIS EXISTS
 *
 * iOS gives an app the "ambient" audio session by default, and ambient audio
 * is silenced by the hardware ring/silent switch. AVSpeechSynthesizer — which
 * is what expo-speech drives — plays through that session. So with the phone
 * on silent, every spoken reminder, the task card's speaker button and the
 * Voice Companion sample produced nothing at all, with no error and no
 * callback to tell us. It looked exactly like a broken feature.
 *
 * playsInSilentMode moves us to the playback category, which the mute switch
 * does not silence.
 *
 * THE TRADE-OFF, STATED PLAINLY
 *
 * This means the app can now make noise while the phone is muted. That is the
 * point of a spoken reminder, and it is what an alarm does — but it is a real
 * choice, not an oversight. It only ever fires for audio the user asked for:
 * pressing the speaker button, pressing "Play sample", or a reminder they
 * scheduled with speech enabled. Nothing here plays audio on its own.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO
 *
 * shouldPlayInBackground stays FALSE. Turning it on would require adding
 * `audio` to UIBackgroundModes, and an app that declares background audio
 * without being a media player is a straightforward App Review rejection.
 * It would also not buy anything: iOS does not run our code when a
 * notification is delivered in the background, so there is nothing to play.
 *
 * duckOthers rather than doNotMix: a ten-word reminder should dip someone's
 * podcast for a moment, not stop it and hand playback back silent.
 */

let _configured = false;

export async function configureAudioSession() {
    if (_configured) return true;
    try {
        await setAudioModeAsync({
            playsInSilentMode: true,
            shouldPlayInBackground: false,
            interruptionMode: "duckOthers",
        });
        _configured = true;
        return true;
    } catch {
        // A session we could not configure is not worth blocking launch over:
        // speech still works, it just goes back to obeying the mute switch.
        return false;
    }
}

/** Test seam — lets a test assert the one-shot behaviour. */
export function _resetAudioSessionForTests() {
    _configured = false;
}
