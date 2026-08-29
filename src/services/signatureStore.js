/**
 * signatureStore — persists saved signatures so repeat signing is one tap.
 *
 * Signatures are stored as raw stroke data (not images) in the app's document
 * directory. Stroke JSON is a few KB, which is well past SecureStore's practical
 * limit on Android, and a signature is not a credential — the document directory
 * is the right home for it.
 *
 * Uses the legacy expo-file-system API deliberately: it is stable across SDK
 * versions and the rest of the app has no filesystem code to be consistent with.
 *
 * Entries are { id, name, strokes, createdAt, updatedAt }. `name` is optional and
 * may be empty — an unnamed signature is displayed by its drawing, which is how
 * every signature saved before naming existed still reads.
 */

import * as FileSystem from "expo-file-system/legacy";

const FILE = "signatures.json";

/**
 * How many signatures are kept. Saving past this drops the oldest, so the UI
 * reads the limit from here to warn before that happens rather than after.
 */
export const MAX_SAVED = 5;

function path() {
    return `${FileSystem.documentDirectory}${FILE}`;
}

async function write(entries) {
    await FileSystem.writeAsStringAsync(path(), JSON.stringify(entries));
    return entries;
}

/**
 * A unique id for a new entry.
 *
 * The timestamp alone was not enough: two signatures saved in the same
 * millisecond got the same id, and since every edit and delete looks an entry up
 * by id, one of them would then rename or delete the other. The random suffix is
 * what makes the lookup refer to exactly one signature.
 */
function newId() {
    return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Trims a user-supplied name to something that fits a chip label. */
export function normaliseName(name) {
    return String(name ?? "").trim().slice(0, 40);
}

/** @returns {Promise<Array<{ id, name, strokes, createdAt, updatedAt }>>} */
export async function listSignatures() {
    try {
        const info = await FileSystem.getInfoAsync(path());
        if (!info.exists) return [];
        const raw = await FileSystem.readAsStringAsync(path());
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        // Entries written before names existed are read, not migrated in place —
        // a read must never rewrite the file it was only asked to look at.
        return parsed
            .filter((s) => s && s.id && Array.isArray(s.strokes))
            .map((s) => ({ name: "", updatedAt: s.createdAt ?? null, ...s }));
    } catch {
        // A corrupt file must not brick signing — start over rather than throw.
        return [];
    }
}

/** Saves a signature, newest first, keeping at most MAX_SAVED. */
export async function saveSignature(strokes, name = "") {
    if (!strokes || strokes.length === 0) return null;

    const now = new Date().toISOString();
    const entry = {
        id: newId(),
        name: normaliseName(name),
        strokes,
        createdAt: now,
        updatedAt: now,
    };

    const existing = await listSignatures();
    await write([entry, ...existing].slice(0, MAX_SAVED));
    return entry;
}

/**
 * Edits a saved signature in place: its name, its strokes, or both.
 *
 * The entry keeps its id and its position in the list, so renaming or redrawing
 * does not shuffle the chips someone has learned the order of. `createdAt` is
 * left alone and `updatedAt` moves — the record of when it was first made is not
 * ours to overwrite.
 *
 * Returns the full updated list, or null when there is no such id.
 */
export async function updateSignature(id, { name, strokes } = {}) {
    const existing = await listSignatures();
    const index = existing.findIndex((s) => s.id === id);
    if (index === -1) return null;

    const current = existing[index];
    const next = [...existing];
    next[index] = {
        ...current,
        ...(name !== undefined ? { name: normaliseName(name) } : null),
        ...(strokes && strokes.length > 0 ? { strokes } : null),
        updatedAt: new Date().toISOString(),
    };

    return write(next);
}

/** Convenience wrapper for the rename-only case. */
export async function renameSignature(id, name) {
    return updateSignature(id, { name });
}

export async function deleteSignature(id) {
    const existing = await listSignatures();
    return write(existing.filter((s) => s.id !== id));
}

export async function clearSignatures() {
    try {
        await FileSystem.deleteAsync(path(), { idempotent: true });
    } catch {
        // Nothing to clear.
    }
}
