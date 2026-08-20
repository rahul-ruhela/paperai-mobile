/**
 * signatureStore — persists up to 3 saved signatures so repeat signing is one tap.
 *
 * Signatures are stored as raw stroke data (not images) in the app's document
 * directory. Stroke JSON is a few KB, which is well past SecureStore's practical
 * limit on Android, and a signature is not a credential — the document directory
 * is the right home for it.
 *
 * Uses the legacy expo-file-system API deliberately: it is stable across SDK
 * versions and the rest of the app has no filesystem code to be consistent with.
 */

import * as FileSystem from "expo-file-system/legacy";

const FILE = "signatures.json";
const MAX_SAVED = 3;

function path() {
    return `${FileSystem.documentDirectory}${FILE}`;
}

/** @returns {Promise<Array<{ id, strokes, createdAt }>>} */
export async function listSignatures() {
    try {
        const info = await FileSystem.getInfoAsync(path());
        if (!info.exists) return [];
        const raw = await FileSystem.readAsStringAsync(path());
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        // A corrupt file must not brick signing — start over rather than throw.
        return [];
    }
}

/** Saves a signature, newest first, keeping at most MAX_SAVED. */
export async function saveSignature(strokes) {
    if (!strokes || strokes.length === 0) return null;

    const entry = {
        id: `sig_${Date.now()}`,
        strokes,
        createdAt: new Date().toISOString(),
    };

    const existing = await listSignatures();
    const next = [entry, ...existing].slice(0, MAX_SAVED);

    await FileSystem.writeAsStringAsync(path(), JSON.stringify(next));
    return entry;
}

export async function deleteSignature(id) {
    const existing = await listSignatures();
    const next = existing.filter((s) => s.id !== id);
    await FileSystem.writeAsStringAsync(path(), JSON.stringify(next));
    return next;
}

export async function clearSignatures() {
    try {
        await FileSystem.deleteAsync(path(), { idempotent: true });
    } catch {
        // Nothing to clear.
    }
}
