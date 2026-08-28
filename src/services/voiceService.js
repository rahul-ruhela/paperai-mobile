import * as Speech from "expo-speech";

import { stopSpeaking, isSpeaking } from "./taskSpeech";

/**
 * voiceService — the AI Voice Companion (roadmap Module 7,
 * docs/voice-assistant-spec.md).
 *
 * Built ON TOP of taskSpeech.js rather than beside it. That file already owns
 * the synthesiser lifecycle — stop-before-speak, the toggle behaviour, the
 * onStopped/onError handling — and a second module doing the same thing to the
 * same shared AVSpeechSynthesizer is how you get utterances queued behind each
 * other. This module adds the companion's *phrasing* and its settings.
 *
 * ── The conflict the spec asked this module to resolve (§2) ──────────────────
 *
 * Module 3 shipped a speaker button on every task card, ungated, on every tier,
 * at the owner's explicit request. The spec's tier table says FREE and ESSENTIAL
 * get "no voice".
 *
 * Resolved in favour of what shipped: the speaker button stays FREE. Taking a
 * working feature away from users who already have it, in order to sell it back,
 * is a worse thing to do than leaving one tier boundary softer than a table
 * predicted — and pressing a button to hear the task in front of you is not the
 * companion anyway.
 *
 * `voice_companion` (ADVANCE) gates the thing that is actually new here:
 *   • reminders that speak themselves when they fire or are tapped
 *   • choosing a voice, a speed and a tone
 *   • the per-task override
 * PLUS gets a playable sample, so the feature is audible before purchase.
 *
 * Everything is on-device. No audio is recorded, nothing is uploaded, no
 * microphone permission exists anywhere in this path, and playback works in
 * airplane mode.
 */

export const TONES = {
    FRIENDLY: "FRIENDLY",
    NEUTRAL: "NEUTRAL",
    DIRECT: "DIRECT",
};

export const RATES = [0.75, 1, 1.25];

/** Spec §1: the description is trimmed to 200 chars at a sentence boundary. */
export const MAX_DESCRIPTION = 200;

/**
 * Trims to `max` characters, preferring to end on a sentence.
 *
 * Falls back to a word boundary, then to a hard cut. Cutting mid-word is
 * noticeable when it is spoken aloud in a way it is not when read.
 */
export function trimToSentence(text, max = MAX_DESCRIPTION) {
    const clean = String(text ?? "").trim();
    if (clean.length <= max) return clean;

    const window = clean.slice(0, max);
    const lastStop = Math.max(
        window.lastIndexOf(". "),
        window.lastIndexOf("! "),
        window.lastIndexOf("? ")
    );
    // Only honour a sentence break if it leaves most of the budget used —
    // otherwise a stray full stop near the start throws away the whole thing.
    if (lastStop > max * 0.5) return window.slice(0, lastStop + 1).trim();

    const lastSpace = window.lastIndexOf(" ");
    return `${(lastSpace > max * 0.5 ? window.slice(0, lastSpace) : window).trim()}…`;
}

/**
 * Strips what should not be read aloud.
 *
 * A URL spoken character by character is thirty seconds of noise, and emoji
 * either get announced by name ("smiling face with sunglasses") or produce a
 * dead pause. Neither belongs in a reminder.
 */
export function speakableText(text) {
    return String(text ?? "")
        .replace(/https?:\/\/\S+/gi, "a link")
        .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Builds the sentence the companion speaks for a task (spec §1).
 *
 * Pure, and exported for tests, because the phrasing is the whole product here
 * and it can be checked without a synthesiser.
 *
 * Nothing is generated. Every word is either a fixed template or a stored field,
 * which is what makes it safe to speak: there is no model in this path that
 * could invent a detail about someone's day.
 */
export function composeSentence(task, { firstName = "", tone = TONES.FRIENDLY } = {}) {
    if (!task) return "";

    const title = speakableText(task.title);
    if (!title) return "";

    const urgent = String(task.priority ?? "").toUpperCase() === "HIGH";
    const description = trimToSentence(speakableText(task.description));
    const name = speakableText(firstName);

    const sentences = [];

    if (tone === TONES.DIRECT) {
        // Direct: the task, and the thing you said about it. No preamble.
        sentences.push(urgent ? `Urgent: ${title}.` : `${title}.`);
        if (description) sentences.push(endWithStop(description));
        return sentences.join(" ");
    }

    if (tone === TONES.NEUTRAL) {
        sentences.push(
            `Reminder: your ${urgent ? "urgent task" : "task"} ${endWithStop(title)}`
        );
        if (description) sentences.push(endWithStop(description));
        return sentences.join(" ");
    }

    // Friendly (the default). Greeting only when a name is actually known —
    // "Hey , this is a reminder" is worse than no greeting at all.
    const greeting = name ? `Hey ${name}, this is` : "This is";
    sentences.push(
        `${greeting} a reminder about your ${urgent ? "urgent task" : "task"} ${endWithStop(title)}`
    );
    if (description) sentences.push(`You mentioned that ${lowerFirst(endWithStop(description))}`);

    return sentences.join(" ");
}

function endWithStop(text) {
    const clean = String(text ?? "").trim();
    if (!clean) return "";
    return /[.!?…]$/.test(clean) ? clean : `${clean}.`;
}

/**
 * Words safe to lowercase after "You mentioned that".
 *
 * An allowlist rather than a rule, because there is no reliable way to tell a
 * sentence-initial capital from a proper noun — and the two failure modes are
 * not symmetric. Leaving "The" capitalised reads very slightly stiffly; turning
 * "Priya" into "priya" mangles somebody's name. So only these are lowered, and
 * anything else is left exactly as the user typed it.
 */
const LOWERABLE_FIRST_WORDS = new Set([
    "the", "a", "an", "this", "that", "these", "those", "there", "it", "its",
    "i", "we", "you", "your", "yours", "they", "their", "he", "she", "his",
    "her", "my", "our", "if", "when", "after", "before", "everything",
    "something", "nothing", "all", "both", "please", "remember", "make",
    "bring", "call", "check", "send", "ask", "book", "pay", "get", "take",
]);

function lowerFirst(text) {
    if (!text) return text;
    const firstWord = text.split(/[\s,.;:!?]/, 1)[0] ?? "";
    if (!LOWERABLE_FIRST_WORDS.has(firstWord.toLowerCase())) return text;
    return text[0].toLowerCase() + text.slice(1);
}

/** A fixed sentence for the Settings "Play sample" button and the Plus preview. */
export function sampleSentence({ firstName = "", tone = TONES.FRIENDLY } = {}) {
    return composeSentence(
        {
            title: "Submit report",
            description: "The final report needs to be sent before Friday.",
            priority: "HIGH",
        },
        { firstName, tone }
    );
}

/**
 * Whether this task should be spoken, given the per-task override and the
 * global setting.
 *
 * Three states on the task, and the middle one is the point: `null` follows the
 * global setting, `true` and `false` overrule it in either direction.
 */
export function shouldSpeak(task, { enabled = false, available = false } = {}) {
    if (!available) return false;
    const override = task?.voiceEnabled;
    if (override === true) return true;
    if (override === false) return false;
    return !!enabled;
}

/** The installed system voices, grouped for the picker. Empty on failure. */
export async function listVoices() {
    try {
        const voices = await Speech.getAvailableVoicesAsync();
        return (voices ?? []).map((v) => ({
            id: v.identifier,
            name: v.name,
            language: v.language,
            quality: v.quality,
        }));
    } catch {
        // A device that will not enumerate voices still speaks with its default.
        return [];
    }
}

/**
 * Speaks `text` with the user's settings.
 *
 * Every failure is swallowed: a reminder that fails to speak has still been
 * delivered as a notification, and an alert about the synthesiser would be a
 * worse interruption than the silence it is complaining about (spec §8).
 *
 * A `voiceId` the OS no longer has is dropped rather than passed through —
 * expo-speech is silent for an unknown identifier on iOS, which would look
 * exactly like a broken feature.
 */
export async function speak(text, { voiceId, rate, availableVoiceIds, onDone } = {}) {
    const clean = speakableText(text);
    if (!clean) return { spoken: false };

    // taskSpeech owns the synthesiser lifecycle; go through it so the card
    // button and the companion cannot talk over one another.
    await stopSpeaking();

    const voiceKnown =
        voiceId && (!availableVoiceIds || availableVoiceIds.includes(voiceId));

    try {
        Speech.speak(clean, {
            ...(voiceKnown ? { voice: voiceId } : {}),
            ...(Number.isFinite(rate) ? { rate } : {}),
            onDone: () => onDone?.(),
            onStopped: () => onDone?.(),
            onError: () => onDone?.(),
        });
        return { spoken: true, usedVoice: voiceKnown ? voiceId : null };
    } catch {
        onDone?.();
        return { spoken: false };
    }
}

/** Speaks a task using the companion's phrasing. Convenience over speak(). */
export async function speakTaskReminder(task, prefs = {}) {
    return speak(composeSentence(task, prefs), prefs);
}

export { stopSpeaking, isSpeaking };
