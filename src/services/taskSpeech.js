import * as Speech from "expo-speech";

/**
 * taskSpeech — reads a task aloud.
 *
 * Device-only text-to-speech: no request, no credits, and nothing leaves the
 * phone, so it stays on every tier. `expo-speech` is a thin wrapper over
 * AVSpeechSynthesizer / Android TTS, both of which are always present.
 *
 * The synthesiser is a single shared resource: asking it to speak while it is
 * already speaking queues the new utterance behind the old one on iOS, so every
 * entry point stops first. That also makes the speaker button a toggle, which
 * is what a user expects from one.
 */

const OPTIONS = {
    // Left to the platform so the phone's own accessibility language and speed
    // settings are respected. Pitch/rate overrides here would fight them.
    language: undefined,
};

/** Longest description we read out. Past this it stops being a reminder. */
const MAX_DESCRIPTION = 400;

/**
 * Builds the sentence spoken for a task.
 *
 * Exported for tests and kept pure — the phrasing is the part worth pinning
 * down, and it can be checked without a synthesiser.
 */
export function taskSpeechText(task) {
    if (!task) return "";

    const parts = [];

    const title = String(task.title ?? "").trim();
    if (title) parts.push(title);

    const description = String(task.description ?? "").trim();
    if (description) parts.push(description.slice(0, MAX_DESCRIPTION));

    const due = dueSentence(task);
    if (due) parts.push(due);

    // Only worth saying when it is not the middle of the road; "medium priority"
    // on every second task is noise.
    const priority = String(task.priority ?? "").trim().toUpperCase();
    if (priority === "HIGH") parts.push("High priority.");
    if (priority === "LOW") parts.push("Low priority.");

    const repeat = String(task.repeat ?? "").trim().toUpperCase();
    const repeatWord = {
        DAILY: "Repeats daily.",
        WEEKLY: "Repeats weekly.",
        MONTHLY: "Repeats monthly.",
        YEARLY: "Repeats yearly.",
    }[repeat];
    if (repeatWord) parts.push(repeatWord);

    if (task.status === "DONE") parts.push("This one is already done.");

    // Each part is a sentence, so the synthesiser pauses between them instead of
    // running the title into the description.
    return parts
        .map((part) => (/[.!?]$/.test(part) ? part : `${part}.`))
        .join(" ")
        .trim();
}

/**
 * "Due on 5 September at 2:30 PM." — or date-only when the user never picked a
 * time, matching how the card and the notification present it.
 */
function dueSentence(task) {
    if (!task?.dueAtUtc) return "";

    const due = new Date(task.dueAtUtc);
    if (isNaN(due.getTime())) return "";

    const day = due.toLocaleDateString(undefined, { day: "numeric", month: "long" });

    if (task.dueTimeSet !== true) return `Due on ${day}`;

    const time = due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `Due on ${day} at ${time}`;
}

/** True while the synthesiser has something to say. */
export async function isSpeaking() {
    try {
        return await Speech.isSpeakingAsync();
    } catch {
        return false;
    }
}

/** Stops whatever is being spoken. Safe to call when nothing is. */
export async function stopSpeaking() {
    try {
        await Speech.stop();
    } catch {
        // A synthesiser that will not stop is not worth an alert.
    }
}

/**
 * Speaks a task, or stops if that same task is already being spoken.
 *
 * Returns `{ spoken: boolean }` so the caller can drive a play/stop icon
 * without keeping its own copy of the synthesiser's state.
 */
export async function speakTask(task, { onDone } = {}) {
    const text = taskSpeechText(task);
    if (!text) return { spoken: false };

    // Always clear the queue first — see the note at the top of this file.
    await stopSpeaking();

    try {
        Speech.speak(text, {
            ...OPTIONS,
            onDone: () => onDone?.(),
            // A stopped utterance fires onStopped, not onDone, on both platforms;
            // without this the caller's icon would stay stuck on "playing".
            onStopped: () => onDone?.(),
            onError: () => onDone?.(),
        });
        return { spoken: true };
    } catch {
        onDone?.();
        return { spoken: false };
    }
}
