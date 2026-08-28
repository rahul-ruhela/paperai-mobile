/**
 * recallNotification — composes the one line where a Smart Recall memory leaves
 * the app (roadmap Module 6, docs/smart-recall-engine.md §4 and §7).
 *
 * A notification body lands on a lock screen, which is the single real exposure
 * this feature has: a memory can carry medical or financial detail, and a lock
 * screen is visible to anyone holding the phone. So the rules are strict and
 * they live here, pure, rather than being spelled out at the scheduling site.
 *
 *   1. `hideDetails` wins over everything. On, and the body is the task's own
 *      description — never a memory. It defaults to ON server-side.
 *   2. Only confident memories are surfaced unprompted. Below
 *      MIN_SPEAKABLE_CONFIDENCE a memory is stored and visible in the memories
 *      list, but never pushed — a low-confidence guess arriving on a lock screen
 *      is a much worse failure than one the user went looking for.
 *   3. Truncated at BANNER_MAX so the banner shows a whole thought rather than a
 *      severed one. The full set is in the task detail.
 *
 * Nothing here reaches the network or storage: the body is composed at schedule
 * time and lives inside the local notification and nowhere else (§3).
 */

/** Mirrors RecallMemory.MinSpeakableConfidence on the server. */
export const MIN_SPEAKABLE_CONFIDENCE = 0.6;

/** Spec §4: truncated at 140 chars for the banner. */
export const BANNER_MAX = 140;

/** Memories confident enough to be pushed without the user asking. */
export function speakable(memories) {
    return (memories ?? []).filter(
        (m) => m && typeof m.content === "string" && m.content.trim().length > 0 &&
            (m.confidence ?? 0) >= MIN_SPEAKABLE_CONFIDENCE
    );
}

/**
 * Truncates on a word boundary and appends an ellipsis, so the banner ends on a
 * word rather than mid-syllable.
 */
export function truncate(text, max = BANNER_MAX) {
    const clean = String(text ?? "").trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max - 1);
    const lastSpace = cut.lastIndexOf(" ");
    return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * The notification body for a task alert.
 *
 * @param description   the task's own description — the fallback, and the whole
 *                      body when details are hidden.
 * @param memories      this task's memories, as returned by the API.
 * @param hideDetails   the user's lock-screen preference. Defaults TRUE, so a
 *                      caller that forgets to pass it gets the private answer.
 */
export function composeTaskBody({ description, memories, hideDetails = true } = {}) {
    const fallback = description
        ? truncate(description, 180)
        : "Task due now.";

    if (hideDetails) return fallback;

    const usable = speakable(memories);
    if (usable.length === 0) return fallback;

    // Highest confidence first: if only one memory fits the banner, it should be
    // the one we are most sure the user actually wrote.
    const ordered = [...usable].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));

    const joined = ordered.map((m) => m.content.trim()).join(" · ");
    return truncate(joined, BANNER_MAX);
}
