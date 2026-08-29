import { createAudioPlayer } from "expo-audio";

import { configureAudioSession } from "./audioSession";

/**
 * cleanupSound — the whoosh that plays when a cleanup completes.
 *
 * One player, created lazily and reused. Creating a player per tap leaks native
 * resources, and a cleanup can finish several times in a session.
 *
 * The asset is synthesised (see the generator note in the repo history) rather
 * than sourced, so there is no licence attached to it and it adds 37 KB.
 *
 * Everything here is best-effort by design: a missing sound must never be able
 * to break a delete that has already happened. Every path returns rather than
 * throws, and the caller is not expected to await it.
 */

let _player = null;

function player() {
    if (_player) return _player;
    try {
        _player = createAudioPlayer(require("../../assets/sounds/cleanup.wav"));
    } catch {
        _player = null;
    }
    return _player;
}

/**
 * Plays the cleanup sound. Never throws, never rejects.
 *
 * @param {boolean} enabled  false skips playback entirely (user preference).
 */
export async function playCleanupSound(enabled = true) {
    if (!enabled) return false;
    try {
        // Without the playback session this is inaudible on a muted phone,
        // which is the same trap the voice feature fell into.
        await configureAudioSession();
        const p = player();
        if (!p) return false;
        // seekTo(0) so a second cleanup in the same session replays from the
        // start instead of resuming a finished clip.
        await p.seekTo(0);
        p.play();
        return true;
    } catch {
        return false;
    }
}

/** Frees the native player. Call on unmount of the last screen that uses it. */
export function releaseCleanupSound() {
    try {
        _player?.remove?.();
    } catch {
        // Nothing useful to do if the player has already gone.
    } finally {
        _player = null;
    }
}
