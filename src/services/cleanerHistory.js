/**
 * cleanerHistory — the rolling local record of what each Storage Studio scan
 * found, and the only thing any cleaner run persists.
 *
 * Per docs/smart-cleaner-spec.md §5, a scan's results live in memory for the
 * session. What survives is an aggregate per scan and nothing else:
 *
 *     { scannedAt, totalAssets, totalBytes, duplicateBytes, freeBytes }
 *
 * No filenames, no paths, no asset identifiers, no hashes, no thumbnails. That
 * is a privacy requirement first — this file sits in the app's document
 * directory, which is included in device backups — and the reason the storage
 * estimate can be computed without keeping any record of the user's photos.
 *
 * Capped at MAX_ENTRIES so the file cannot grow without bound on a device that
 * scans daily for years.
 */

import * as FileSystem from "expo-file-system/legacy";

const FILE = "cleaner-history.json";
export const MAX_ENTRIES = 24;

function path() {
    return `${FileSystem.documentDirectory}${FILE}`;
}

/** Every recorded scan, newest first. Returns [] on any read or parse failure. */
export async function listHistory() {
    try {
        const info = await FileSystem.getInfoAsync(path());
        if (!info.exists) return [];
        const parsed = JSON.parse(await FileSystem.readAsStringAsync(path()));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Records one completed scan and returns the trimmed history.
 *
 * Only the whitelisted aggregate fields are written, whatever the caller passes:
 * the shape is pinned here rather than trusted from the call site, so a screen
 * cannot accidentally start persisting asset data by spreading a scan result in.
 */
export async function recordScan({ totalAssets, totalBytes, duplicateBytes, freeBytes } = {}) {
    const entry = {
        scannedAt: new Date().toISOString(),
        totalAssets: totalAssets ?? 0,
        totalBytes: totalBytes ?? 0,
        duplicateBytes: duplicateBytes ?? 0,
        freeBytes: Number.isFinite(freeBytes) ? freeBytes : null,
    };
    const next = [entry, ...(await listHistory())].slice(0, MAX_ENTRIES);
    try {
        await FileSystem.writeAsStringAsync(path(), JSON.stringify(next));
    } catch {
        // A failed write costs the user a data point in the estimate, nothing
        // more. It must never take down a scan that has already succeeded.
    }
    return next;
}

/** The most recent scan, or null. Drives the "last scanned" line on the hub. */
export async function lastScan() {
    const all = await listHistory();
    return all[0] ?? null;
}

/** Deletes the history. Offered in the UI so the estimate can be reset. */
export async function clearHistory() {
    try {
        await FileSystem.deleteAsync(path(), { idempotent: true });
    } catch {
        // Nothing to clear.
    }
}

/** Current free space in bytes, or null when the platform will not say. */
export async function freeDiskBytes() {
    try {
        const bytes = await FileSystem.getFreeDiskStorageAsync();
        return Number.isFinite(bytes) ? bytes : null;
    } catch {
        return null;
    }
}

/** Total device capacity in bytes, or null. */
export async function totalDiskBytes() {
    try {
        const bytes = await FileSystem.getTotalDiskCapacityAsync();
        return Number.isFinite(bytes) ? bytes : null;
    } catch {
        return null;
    }
}
