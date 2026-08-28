/**
 * sensitiveStore — where a sensitive-document detection is remembered
 * (Module 5, §3).
 *
 * On device, and only on device. The detected type is never sent to the server
 * and never logged: a record saying "document 4f2a is a passport" is itself a
 * disclosure, and it would be one the user never agreed to make. So it lives in
 * a JSON file in the app's document directory and nowhere else.
 *
 * Two things are kept:
 *
 *   detections  documentId → { type, label, signals, detectedAt }
 *   dismissed   documentIds the user has said no to
 *
 * `dismissed` is what makes the banner honest. The spec's rule is that a
 * suggestion never repeats for the same document once dismissed, and the only
 * way to keep that promise across launches is to write it down.
 */

import * as FileSystem from "expo-file-system/legacy";

import { detectSensitiveType } from "./sensitiveDetection";

const FILE = "sensitive-flags.json";

function path() {
    return `${FileSystem.documentDirectory}${FILE}`;
}

const EMPTY = { detections: {}, dismissed: [] };

export async function readFlags() {
    try {
        const info = await FileSystem.getInfoAsync(path());
        if (!info.exists) return { ...EMPTY };
        const parsed = JSON.parse(await FileSystem.readAsStringAsync(path()));
        return {
            detections: parsed?.detections ?? {},
            dismissed: Array.isArray(parsed?.dismissed) ? parsed.dismissed : [],
        };
    } catch {
        return { ...EMPTY };
    }
}

async function write(flags) {
    try {
        await FileSystem.writeAsStringAsync(path(), JSON.stringify(flags));
    } catch {
        // A failed write costs a remembered detection, nothing more. It must
        // never break the screen that was merely passing text through.
    }
    return flags;
}

/**
 * Classifies `text` for `documentId` and records the result.
 *
 * Called from wherever the app already holds a document's text — analysis
 * output, OCR result. It makes no network call: `detectSensitiveType` is pure
 * regex over a string that is already in memory.
 *
 * A document the user has already dismissed is re-classified but not
 * resurrected; `unsecuredSensitive` filters it out. Storing the detection anyway
 * keeps the privacy score's denominator honest — the document IS sensitive, the
 * user has simply chosen not to vault it.
 */
export async function recordDetection(documentId, text) {
    if (!documentId) return null;
    const found = detectSensitiveType(text);
    const flags = await readFlags();

    if (!found) {
        // A document that no longer looks sensitive stops being counted rather
        // than keeping a stale flag from an earlier, worse pass.
        if (!flags.detections[documentId]) return null;
        delete flags.detections[documentId];
        await write(flags);
        return null;
    }

    flags.detections[documentId] = { ...found, detectedAt: new Date().toISOString() };
    await write(flags);
    return found;
}

/** Records that the user does not want to be asked about this document again. */
export async function dismissDetection(documentId) {
    const flags = await readFlags();
    if (!flags.dismissed.includes(documentId)) flags.dismissed.push(documentId);
    return write(flags);
}

/** Clears every stored detection and dismissal. Offered in the Privacy Centre. */
export async function clearFlags() {
    try {
        await FileSystem.deleteAsync(path(), { idempotent: true });
    } catch {
        // Nothing to clear.
    }
    return { ...EMPTY };
}
