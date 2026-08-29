/**
 * cleanerService — the Storage Studio scan engine (roadmap Module 4).
 *
 * Everything the cleaner screens do to decide what is junk lives here, extracted
 * out of JunkWiperScanScreen.js (1641 lines) so the new layers call the same code
 * instead of copying it. The screen keeps its UI and became a consumer.
 *
 * The file is split deliberately:
 *
 *   PURE section  — grouping, banding, hashing, sharpness, projection. No imports
 *                   from expo-media-library, no I/O. These are the parts worth
 *                   unit testing, and they are tested in
 *                   __tests__/cleanerService.test.js.
 *   NATIVE section— enumeration and enrichment. Thin wrappers over MediaLibrary
 *                   with paging, batching and cancellation.
 *
 * Two rules this module exists to keep honest, both of them App Review rules as
 * much as product ones (guideline 2.3.1, accurate functionality):
 *
 *   1. Nothing is ever synthesised. A clean library returns zero groups. No
 *      padding, no invented megabytes — a document has no size the API exposes,
 *      so document groups report none rather than a guess.
 *   2. Nothing here deletes anything. Deletion is the screen's job, always behind
 *      an explicit confirm and the OS sheet. This module only ever reports.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PURE — no native modules, no I/O
// ─────────────────────────────────────────────────────────────────────────────

/** Human-readable size from raw bytes. */
export function formatSize(bytes) {
    if (!bytes || bytes <= 0) return "0 MB";
    const mb = bytes / 1024 / 1024;
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
    if (mb >= 10) return `${mb.toFixed(0)} MB`;
    return `${mb.toFixed(1)} MB`;
}

/**
 * Size label for a single item, where 0 means "the API would not tell us".
 *
 * `formatSize` is right for totals — a total of nothing really is 0 MB — but on
 * one row it reads as a claim that the file is empty. An unmeasurable asset says
 * so instead.
 */
export function formatItemSize(bytes) {
    return bytes > 0 ? formatSize(bytes) : "Size unavailable";
}

/**
 * Duplicate strategies, in the order they are trusted. The order matters: an
 * asset is claimed by the first strategy that groups it, so the most reliable
 * signal must run first or a burst-shot guess would steal an exact match.
 *
 *   exact  — same byte size + same pixel dimensions + same media type.
 *   name   — same normalised filename, i.e. the same file in two albums.
 *   burst  — same dimensions, created inside the same few-second bucket.
 */
export const BURST_BUCKET_MS = 3000;

/** Groups assets by exact size + dimensions + type. Zero-size assets are skipped. */
export function groupByExact(assets) {
    const map = new Map();
    for (const a of assets) {
        const size = a.fileSize ?? 0;
        if (size === 0) continue; // fileSize unavailable — cannot claim it is a copy
        const key = `${size}__${a.width}__${a.height}__${a.mediaType}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(a);
    }
    return map;
}

/** Groups assets by normalised filename. */
export function groupByFilename(assets) {
    const map = new Map();
    for (const a of assets) {
        const name = (a.filename || "").toLowerCase().trim();
        if (!name) continue;
        if (!map.has(name)) map.set(name, []);
        map.get(name).push(a);
    }
    return map;
}

/** Groups assets by dimensions within a creation-time bucket (burst shots). */
export function groupByBurst(assets, bucketMs = BURST_BUCKET_MS) {
    const map = new Map();
    for (const a of assets) {
        if (!a.width || !a.height) continue;
        const bucket = Math.floor((a.creationTime ?? 0) / bucketMs);
        const key = `${a.width}__${a.height}__${bucket}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(a);
    }
    return map;
}

/**
 * Merges the three media strategies into one deduplicated list of groups.
 *
 * `isVideo(asset)` is injected rather than importing MediaLibrary here, so the
 * grouping stays testable without a native module. Within each group the newest
 * copy is the one kept and every older copy is offered for deletion — but the
 * screen still lets the user pick a different keeper (spec §7.4), so this is a
 * default, not a decision made on the user's behalf.
 *
 * `onGroup(groups)` fires after each group is built, for the live counter.
 */
export function buildDuplicateGroups(assets, { isVideo = () => false, onGroup } = {}) {
    const claimed = new Set();
    const groups = [];

    function build(items, strategy) {
        if (items.length < 2) return;
        const unique = items.filter((a, i, arr) => arr.findIndex((b) => b.id === a.id) === i);
        if (unique.length < 2) return;
        // Every member already claimed by an earlier, more reliable strategy.
        if (unique.every((a) => claimed.has(a.id))) return;
        unique.forEach((a) => claimed.add(a.id));

        const sorted = [...unique].sort((a, b) => (b.creationTime ?? 0) - (a.creationTime ?? 0));
        const dupes = sorted.slice(1);
        const totalBytes = dupes.reduce((acc, a) => acc + (a.fileSize ?? 0), 0);

        groups.push({
            id: `${strategy}__${sorted[0].id}`,
            label: sorted[0].filename || "Unknown",
            strategy,
            kind: isVideo(sorted[0]) ? "video" : "photo",
            count: dupes.length,
            totalBytes,
            saveMB: parseFloat((totalBytes / 1024 / 1024).toFixed(2)),
            assetIds: dupes.map((a) => a.id),
            keepId: sorted[0].id,
            memberIds: sorted.map((a) => a.id),
            allCount: unique.length,
        });
        onGroup?.(groups);
    }

    for (const items of groupByExact(assets).values()) build(items, "exact");
    for (const items of groupByFilename(assets).values()) build(items, "name");
    for (const items of groupByBurst(assets).values()) {
        // Burst is the weakest signal, so require a real size on both members.
        build(items.filter((a) => (a.fileSize ?? 0) > 0), "burst");
    }

    return groups.sort((a, b) => b.totalBytes - a.totalBytes);
}

/**
 * Duplicate PaperAI documents, matched on normalised title.
 *
 * These deliberately claim NO megabyte saving: the documents API exposes no size,
 * and reporting an invented one is precisely the dishonesty this engine avoids.
 */
export function buildDocumentDuplicateGroups(docs) {
    const byTitle = new Map();
    for (const d of docs ?? []) {
        const title = (d.title || "").toLowerCase().trim().replace(/\s+/g, " ");
        if (!title) continue;
        if (!byTitle.has(title)) byTitle.set(title, []);
        byTitle.get(title).push(d);
    }

    const groups = [];
    for (const items of byTitle.values()) {
        if (items.length < 2) continue;
        const sorted = [...items].sort(
            (a, b) =>
                new Date(b.createdAt ?? b.uploadedAt ?? 0) -
                new Date(a.createdAt ?? a.uploadedAt ?? 0)
        );
        const dupes = sorted.slice(1);
        groups.push({
            id: `document__${sorted[0].id}`,
            label: sorted[0].title || "Untitled document",
            strategy: "document",
            kind: "document",
            count: dupes.length,
            totalBytes: 0, // unknown — never guessed
            saveMB: 0,
            assetIds: [],
            docIds: dupes.map((d) => d.id),
            keepId: sorted[0].id,
            memberIds: sorted.map((d) => d.id),
            allCount: sorted.length,
        });
    }
    return groups;
}

// ── Free layer: screenshots ──────────────────────────────────────────────────

/**
 * True when an asset is a screenshot.
 *
 * iOS reports this properly in `mediaSubtypes` once `getAssetInfoAsync` has run;
 * Android has no equivalent, so the filename convention is the fallback. Both are
 * checked because the same build ships to both and a missing subtype must degrade
 * to "not a screenshot" rather than to a wrong guess.
 */
export function isScreenshot(asset) {
    const subtypes = asset?.mediaSubtypes;
    if (Array.isArray(subtypes) && subtypes.some((s) => String(s).toLowerCase() === "screenshot")) {
        return true;
    }
    const name = (asset?.filename || "").toLowerCase();
    return name.startsWith("screenshot") || name.startsWith("screen shot");
}

/** Screenshots, largest first. Free layer — on-device, no credits. */
export function findScreenshots(assets) {
    return assets
        .filter(isScreenshot)
        .sort((a, b) => (b.fileSize ?? 0) - (a.fileSize ?? 0));
}

// ── Free layer: large files ──────────────────────────────────────────────────

const MB = 1024 * 1024;

/**
 * Size bands for the large-file finder, largest first. The bands are fixed rather
 * than percentile-based so the same photo lands in the same band every scan.
 */
export const SIZE_BANDS = [
    { key: "huge", label: "Over 1 GB", minBytes: 1024 * MB },
    { key: "large", label: "500 MB – 1 GB", minBytes: 500 * MB },
    { key: "medium", label: "100 – 500 MB", minBytes: 100 * MB },
    { key: "small", label: "50 – 100 MB", minBytes: 50 * MB },
];

/**
 * Bands below the original 50 MB floor.
 *
 * 50 MB was too high a bar in practice: on a phone that mostly holds photos
 * rather than 4K video, almost nothing clears it and the scan reports an empty
 * library that plainly is not empty. The threshold is now the user's choice,
 * and these are the extra bands that appear as they lower it.
 */
const SMALL_BANDS = [
    { key: "sm30", label: "30 – 50 MB", minBytes: 30 * MB },
    { key: "sm20", label: "20 – 30 MB", minBytes: 20 * MB },
    { key: "sm10", label: "10 – 20 MB", minBytes: 10 * MB },
];

/** Thresholds offered in the UI, in megabytes. 50 stays the default. */
export const LARGE_FILE_THRESHOLDS_MB = [10, 20, 30, 50];

export const DEFAULT_LARGE_THRESHOLD_MB = 50;

/**
 * The bands in play for a given floor, largest first.
 *
 * An unrecognised threshold falls back to the default rather than producing an
 * empty ladder, which would silently report "nothing found" on a full device.
 */
export function bandsForThreshold(minMb = DEFAULT_LARGE_THRESHOLD_MB) {
    const floor = LARGE_FILE_THRESHOLDS_MB.includes(minMb)
        ? minMb
        : DEFAULT_LARGE_THRESHOLD_MB;
    return [...SIZE_BANDS, ...SMALL_BANDS].filter((b) => b.minBytes >= floor * MB);
}

/**
 * Buckets assets into SIZE_BANDS. Anything under the smallest band is not
 * reported at all — listing a 3 MB photo as a "large file" is noise that makes
 * the whole report less trustworthy.
 */
export function bandLargeAssets(assets, { minMb = DEFAULT_LARGE_THRESHOLD_MB } = {}) {
    const bands = bandsForThreshold(minMb).map((b) => ({ ...b, items: [], totalBytes: 0 }));
    for (const a of assets) {
        const size = a.fileSize ?? 0;
        const band = bands.find((b) => size >= b.minBytes);
        if (!band) continue;
        band.items.push(a);
        band.totalBytes += size;
    }
    for (const b of bands) b.items.sort((x, y) => (y.fileSize ?? 0) - (x.fileSize ?? 0));
    return bands.filter((b) => b.items.length > 0);
}

// ── Paid layer: perceptual similarity ────────────────────────────────────────

/**
 * Average hash (aHash) of a downsampled greyscale image: one bit per pixel, set
 * when that pixel is brighter than the frame's mean. 64 bits from an 8×8 sample
 * is enough to cluster burst shots and re-saves while staying cheap enough to run
 * over two thousand images on a phone.
 *
 * `gray` is a flat array of 0–255 luminance values, `size * size` long.
 */
export function averageHash(gray, size = 8) {
    const n = size * size;
    if (!gray || gray.length < n) return null;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += gray[i];
    const mean = sum / n;
    let bits = "";
    for (let i = 0; i < n; i++) bits += gray[i] > mean ? "1" : "0";
    return bits;
}

/** Number of differing bits between two equal-length hash strings. */
export function hammingDistance(a, b) {
    if (!a || !b || a.length !== b.length) return Infinity;
    let d = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
    return d;
}

/**
 * Clusters hashed items into groups of near-identical images.
 *
 * `threshold` is the maximum Hamming distance still considered "the same shot".
 * 5 of 64 bits is deliberately conservative: a false positive here shows the user
 * two unrelated photos and invites them to delete one, which is the worst failure
 * this feature has. Missing a pair is merely a smaller result.
 */
export const SIMILARITY_THRESHOLD = 5;

export function groupSimilarByHash(items, threshold = SIMILARITY_THRESHOLD) {
    const hashed = items.filter((i) => i.hash);
    const claimed = new Set();
    const groups = [];

    for (let i = 0; i < hashed.length; i++) {
        if (claimed.has(hashed[i].id)) continue;
        const cluster = [hashed[i]];
        for (let j = i + 1; j < hashed.length; j++) {
            if (claimed.has(hashed[j].id)) continue;
            if (hammingDistance(hashed[i].hash, hashed[j].hash) <= threshold) {
                cluster.push(hashed[j]);
                claimed.add(hashed[j].id);
            }
        }
        if (cluster.length < 2) continue;
        claimed.add(hashed[i].id);

        const sorted = [...cluster].sort((a, b) => (b.creationTime ?? 0) - (a.creationTime ?? 0));
        const dupes = sorted.slice(1);
        const totalBytes = dupes.reduce((acc, a) => acc + (a.fileSize ?? 0), 0);
        groups.push({
            id: `similar__${sorted[0].id}`,
            label: sorted[0].filename || "Similar shots",
            strategy: "similar",
            kind: "photo",
            count: dupes.length,
            totalBytes,
            saveMB: parseFloat((totalBytes / 1024 / 1024).toFixed(2)),
            assetIds: dupes.map((a) => a.id),
            keepId: sorted[0].id,
            memberIds: sorted.map((a) => a.id),
            allCount: sorted.length,
        });
    }

    return groups.sort((a, b) => b.totalBytes - a.totalBytes);
}

// ── Paid layer: sharpness ────────────────────────────────────────────────────

/**
 * Variance of the Laplacian over a greyscale frame — the standard cheap sharpness
 * estimate. A blurred image has little high-frequency energy, so the second
 * derivative stays near zero and its variance collapses.
 *
 * Returns null for a frame too small to convolve rather than a fabricated score.
 */
export function laplacianVariance(gray, width, height) {
    if (!gray || width < 3 || height < 3 || gray.length < width * height) return null;
    const values = [];
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            const v =
                4 * gray[i] -
                gray[i - 1] -
                gray[i + 1] -
                gray[i - width] -
                gray[i + width];
            values.push(v);
        }
    }
    if (values.length === 0) return null;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
}

/**
 * Sharpness bands. The thresholds are for a 64 px greyscale downsample and are
 * intentionally cautious — "blurry" is only claimed well below the point where a
 * photo is merely soft, because the user is being invited to delete it.
 *
 * "unknown" is a real answer: an image we could not decode is not called blurry.
 */
export const BLUR_THRESHOLD = 40;
export const SOFT_THRESHOLD = 120;

export function classifySharpness(score) {
    if (score == null || Number.isNaN(score)) return "unknown";
    if (score < BLUR_THRESHOLD) return "blurry";
    if (score < SOFT_THRESHOLD) return "soft";
    return "sharp";
}

// ── Advance layer: storage projection ────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Projects when the device runs out of space from the local scan history.
 *
 * Deliberately modest: a least-squares fit over the recorded totals, refusing to
 * answer at all below three data points spanning at least a day. "At this rate
 * you run out in N weeks" is a claim about someone's device, and the honest
 * version of it declines more often than it speaks — which is also why the UI
 * that renders this labels it an estimate rather than a prediction.
 *
 * history: [{ scannedAt: ISO, totalBytes }] oldest or newest first, either way.
 * freeBytes: current free space, or null when unknown.
 *
 * Returns { status, bytesPerDay, daysUntilFull, samples }.
 *   status: "ok" | "insufficient-history" | "not-growing" | "unknown-free-space"
 */
export function projectStorage(history, freeBytes) {
    const points = (history ?? [])
        .map((h) => ({ t: new Date(h.scannedAt).getTime(), bytes: h.totalBytes ?? 0 }))
        .filter((p) => Number.isFinite(p.t) && p.bytes > 0)
        .sort((a, b) => a.t - b.t);

    if (points.length < 3) return { status: "insufficient-history", samples: points.length };

    const spanDays = (points[points.length - 1].t - points[0].t) / DAY_MS;
    if (spanDays < 1) return { status: "insufficient-history", samples: points.length };

    // Least squares slope of bytes over days, relative to the first sample.
    const xs = points.map((p) => (p.t - points[0].t) / DAY_MS);
    const ys = points.map((p) => p.bytes);
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let den = 0;
    for (let i = 0; i < xs.length; i++) {
        num += (xs[i] - meanX) * (ys[i] - meanY);
        den += (xs[i] - meanX) ** 2;
    }
    const bytesPerDay = den === 0 ? 0 : num / den;

    if (bytesPerDay <= 0) {
        return { status: "not-growing", bytesPerDay, samples: points.length };
    }
    if (!Number.isFinite(freeBytes) || freeBytes == null) {
        return { status: "unknown-free-space", bytesPerDay, samples: points.length };
    }

    return {
        status: "ok",
        bytesPerDay,
        daysUntilFull: Math.max(0, Math.round(freeBytes / bytesPerDay)),
        samples: points.length,
    };
}

/**
 * The body sent to the AI storage analysis endpoint.
 *
 * Aggregates only — counts, byte totals, band and category sizes. Never a
 * filename, never a path, never an identifier that points back at one of the
 * user's photos, and never image data. This is a hard requirement from
 * docs/smart-cleaner-spec.md §5, for privacy and for App Review, and it is
 * enforced here rather than at each call site so there is one place to audit.
 * __tests__/cleanerService.test.js asserts the shape stays closed.
 */
export function buildAnalysisPayload({ totalAssets, totalBytes, freeBytes, duplicateGroups, screenshots, largeBands }) {
    return {
        totalAssets: totalAssets ?? 0,
        totalBytes: totalBytes ?? 0,
        freeBytes: Number.isFinite(freeBytes) ? freeBytes : null,
        duplicateGroups: duplicateGroups?.length ?? 0,
        duplicateBytes: (duplicateGroups ?? []).reduce((a, g) => a + (g.totalBytes ?? 0), 0),
        screenshotCount: screenshots?.length ?? 0,
        screenshotBytes: (screenshots ?? []).reduce((a, s) => a + (s.fileSize ?? 0), 0),
        bands: (largeBands ?? []).map((b) => ({
            key: b.key,
            count: b.items.length,
            totalBytes: b.totalBytes,
        })),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// NATIVE — MediaLibrary paging and enrichment
//
// Kept below the pure section and deliberately thin. Nothing here decides what
// is junk; it only fetches the metadata the functions above reason over.
// ─────────────────────────────────────────────────────────────────────────────

import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system/legacy";

export const PAGE_SIZE = 500;
/** getAssetInfoAsync batch size. Larger batches stall the JS thread (spec §6). */
export const INFO_BATCH = 100;

/** True for a video asset. Passed into buildDuplicateGroups so it stays pure. */
export function isVideoAsset(asset) {
    return asset?.mediaType === MediaLibrary.MediaType.video;
}

/** Raised by a scan the user cancelled, so callers can refund without alerting. */
export class ScanCancelled extends Error {
    constructor() {
        super("Scan cancelled");
        this.name = "ScanCancelled";
        this.cancelled = true;
    }
}

function checkCancelled(shouldCancel) {
    if (shouldCancel?.()) throw new ScanCancelled();
}

/**
 * Pages the whole media library. `onCount` fires per page so the UI can count up
 * while the enumeration is still running.
 */
export async function enumerateAssets({ onCount, shouldCancel } = {}) {
    let assets = [];
    let after;
    let hasMore = true;
    while (hasMore) {
        checkCancelled(shouldCancel);
        const page = await MediaLibrary.getAssetsAsync({
            mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
            first: PAGE_SIZE,
            after,
            sortBy: [MediaLibrary.SortBy.creationTime],
        });
        assets = assets.concat(page.assets);
        hasMore = page.hasNextPage;
        after = page.endCursor;
        onCount?.(assets.length);
    }
    return assets;
}

/**
 * The byte size of one enriched asset, measured off disk when the media API
 * declines to say.
 *
 * `getAssetInfoAsync` fills in `fileSize` on Android but not on iOS, where the
 * Photos framework exposes no size on the asset itself — which is why every
 * screenshot was reporting "0 MB". The honest way to get it is to stat the
 * file the asset resolves to: `localUri` is a real `file://` path once
 * `getAssetInfoAsync` has run, and `getInfoAsync({ size: true })` reads its
 * size without decoding the image.
 *
 * Returns 0 when the size genuinely cannot be read (a cloud-only asset that has
 * not been materialised, a `ph://` uri with no local file). 0 keeps the existing
 * contract: it means "unknown", and every strategy above already refuses to make
 * claims about an asset whose size is unknown rather than guessing one.
 */
export async function measureAssetSize(asset) {
    const reported = asset?.fileSize ?? 0;
    if (reported > 0) return reported;

    const uri = asset?.localUri || asset?.uri;
    if (!uri || !uri.startsWith("file://")) return 0;

    try {
        const info = await FileSystem.getInfoAsync(uri, { size: true });
        return info?.exists && Number.isFinite(info.size) ? info.size : 0;
    } catch {
        return 0; // unreadable — reported as unknown, never invented
    }
}

/**
 * Fills in `fileSize` (and, on iOS, `mediaSubtypes`) in batches. An asset whose
 * info call fails keeps its bare form rather than dropping out of the scan — it
 * simply cannot participate in the size-based strategies.
 *
 * Anything the media API leaves without a size is measured off disk by
 * `measureAssetSize`, in the same batch, so iOS results carry real megabytes
 * instead of a library-wide 0 MB.
 */
export async function enrichAssets(assets, { onProgress, shouldCancel } = {}) {
    const enriched = [];
    for (let i = 0; i < assets.length; i += INFO_BATCH) {
        checkCancelled(shouldCancel);
        const batch = assets.slice(i, i + INFO_BATCH);
        const infos = await Promise.all(
            batch.map(async (a) => {
                const info = await MediaLibrary.getAssetInfoAsync(a).catch(() => a);
                if ((info?.fileSize ?? 0) > 0) return info;
                const fileSize = await measureAssetSize(info);
                return fileSize > 0 ? { ...info, fileSize } : info;
            })
        );
        enriched.push(...infos);
        onProgress?.(Math.min(1, (i + INFO_BATCH) / Math.max(assets.length, 1)));
    }
    return enriched;
}
