import { api, FAST } from "./client";

/**
 * Voice Companion preferences (roadmap Module 7).
 *
 * Two routes and no audio: synthesis is on-device, so nothing here carries a
 * recording, a voice sample, or any spoken text. There is no credit key either —
 * charging for the system's own voices would be charging for nothing.
 */

/** { enabled, voiceId, rate, tone, speakOnTap, available, requiredTier } */
export async function getVoicePreferences() {
    const { data } = await api.get("/api/voice/preferences", FAST);
    return data;
}

/**
 * Patch any subset. Turning voice ON requires Advance and 403s below it;
 * reading, and turning it off, never do.
 */
export async function updateVoicePreferences(patch) {
    const { data } = await api.put("/api/voice/preferences", patch);
    return data;
}
