import { api } from "../api/client";

/**
 * profileName — the user's first name, fetched once and shared.
 *
 * Three places wanted this independently (the Home greeting, the Voice
 * Companion sample, and the sentence composed when a reminder is scheduled),
 * and two of them had the SAME bug: they read `profile.name`, but
 * /api/profile returns `fullName`. The greeting was therefore dropped from
 * every spoken sentence, silently — composeSentence omits it when empty, so
 * nothing ever looked broken.
 *
 * One accessor, one field name, one cache. A name is not worth three requests
 * on launch, and it changes about as often as never.
 */

let _cache = null; // string | null — the resolved first name ("" is a real answer)
let _inFlight = null;

/** Strips a full name down to its first word. */
export function firstNameOf(fullName) {
    return String(fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

/** The cached first name, or null if it has not been resolved yet. */
export function cachedFirstName() {
    return _cache;
}

/**
 * Resolves the user's first name, "" when they have not set one.
 *
 * Never throws: a failed profile fetch costs the greeting and nothing else,
 * which is exactly how composeSentence already treats an empty name.
 */
export async function getFirstName() {
    if (_cache != null) return _cache;
    if (_inFlight) return _inFlight;

    _inFlight = (async () => {
        try {
            const { data } = await api.get("/api/profile");
            _cache = firstNameOf(data?.fullName);
            return _cache;
        } catch {
            // Deliberately NOT cached: a name missed because the network was
            // down should be retried, unlike a name the user has not set.
            return "";
        } finally {
            _inFlight = null;
        }
    })();

    return _inFlight;
}

/** Call after the profile is edited so the greeting updates without a restart. */
export function clearFirstName() {
    _cache = null;
}
