import {
    BLUR_THRESHOLD,
    SIZE_BANDS,
    LARGE_FILE_THRESHOLDS_MB,
    bandsForThreshold,
    averageHash,
    bandLargeAssets,
    buildAnalysisPayload,
    buildDocumentDuplicateGroups,
    buildDuplicateGroups,
    classifySharpness,
    findScreenshots,
    formatSize,
    groupByExact,
    groupSimilarByHash,
    hammingDistance,
    isScreenshot,
    laplacianVariance,
    projectStorage,
} from "../src/services/cleanerService";

// The scan engine behind Storage Studio (roadmap Module 4). These are the parts
// that decide what the user is invited to delete, so the tests care less about
// finding every duplicate than about never claiming one that isn't there.

const MB = 1024 * 1024;

function photo(id, over = {}) {
    return {
        id,
        filename: `${id}.jpg`,
        fileSize: 1000,
        width: 100,
        height: 100,
        mediaType: "photo",
        creationTime: 1000,
        ...over,
    };
}

describe("formatSize", () => {
    it("reports zero and missing sizes as 0 MB rather than NaN", () => {
        expect(formatSize(0)).toBe("0 MB");
        expect(formatSize(undefined)).toBe("0 MB");
        expect(formatSize(-5)).toBe("0 MB");
    });

    it("switches units at a gigabyte", () => {
        expect(formatSize(5 * MB)).toBe("5.0 MB");
        expect(formatSize(50 * MB)).toBe("50 MB");
        expect(formatSize(2048 * MB)).toBe("2.00 GB");
    });
});

describe("groupByExact", () => {
    it("skips assets whose fileSize is unavailable", () => {
        // A missing size is not evidence of a copy. Grouping on it would pair
        // every unreadable asset with every other one.
        const map = groupByExact([photo("a", { fileSize: 0 }), photo("b", { fileSize: 0 })]);
        expect(map.size).toBe(0);
    });

    it("separates same-size assets of different dimensions", () => {
        const map = groupByExact([photo("a"), photo("b", { width: 200 })]);
        expect(map.size).toBe(2);
    });
});

describe("buildDuplicateGroups", () => {
    it("keeps the newest copy and offers only the older ones", () => {
        const [group] = buildDuplicateGroups([
            photo("old", { creationTime: 1000 }),
            photo("new", { creationTime: 5000 }),
        ]);
        expect(group.keepId).toBe("new");
        expect(group.assetIds).toEqual(["old"]);
        expect(group.count).toBe(1);
        expect(group.allCount).toBe(2);
    });

    it("counts only the deletable copies toward the reclaimable bytes", () => {
        // Reporting the keeper's bytes as reclaimable is the classic cleaner-app
        // exaggeration: three copies of a 1 KB file free 2 KB, not 3 KB.
        const [group] = buildDuplicateGroups([photo("a"), photo("b"), photo("c")]);
        expect(group.totalBytes).toBe(2000);
    });

    it("never emits a group of one", () => {
        expect(buildDuplicateGroups([photo("only")])).toEqual([]);
    });

    it("lets the most reliable strategy claim an asset first", () => {
        // Two identical files that also share a burst window must be reported
        // once, as an exact match — not once per strategy.
        const groups = buildDuplicateGroups([
            photo("a", { creationTime: 1000 }),
            photo("b", { creationTime: 1500 }),
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].strategy).toBe("exact");
    });

    it("does not group burst candidates whose size is unknown", () => {
        const groups = buildDuplicateGroups([
            photo("a", { fileSize: 0, filename: "one.jpg", creationTime: 1000 }),
            photo("b", { fileSize: 0, filename: "two.jpg", creationTime: 1200 }),
        ]);
        expect(groups).toEqual([]);
    });

    it("labels videos as videos via the injected predicate", () => {
        const [group] = buildDuplicateGroups([photo("a"), photo("b")], {
            isVideo: () => true,
        });
        expect(group.kind).toBe("video");
    });

    it("sorts the biggest reclaim first", () => {
        const groups = buildDuplicateGroups([
            photo("s1", { fileSize: 10, filename: "small.jpg" }),
            photo("s2", { fileSize: 10, filename: "small.jpg" }),
            photo("b1", { fileSize: 99999, width: 300, filename: "big.jpg" }),
            photo("b2", { fileSize: 99999, width: 300, filename: "big.jpg" }),
        ]);
        expect(groups[0].totalBytes).toBeGreaterThan(groups[1].totalBytes);
    });
});

describe("buildDocumentDuplicateGroups", () => {
    it("claims no megabytes for documents, whose size the API never exposes", () => {
        const [group] = buildDocumentDuplicateGroups([
            { id: "1", title: "Lease  Agreement", createdAt: "2026-01-01" },
            { id: "2", title: "lease agreement", createdAt: "2026-02-01" },
        ]);
        expect(group.totalBytes).toBe(0);
        expect(group.saveMB).toBe(0);
        expect(group.keepId).toBe("2"); // the newer upload is kept
        expect(group.docIds).toEqual(["1"]);
    });

    it("ignores untitled documents rather than grouping them together", () => {
        expect(
            buildDocumentDuplicateGroups([
                { id: "1", title: "" },
                { id: "2", title: "   " },
            ])
        ).toEqual([]);
    });
});

describe("isScreenshot", () => {
    it("trusts the iOS media subtype", () => {
        expect(isScreenshot({ mediaSubtypes: ["screenshot"], filename: "IMG_0001.PNG" })).toBe(true);
    });

    it("falls back to the filename convention where there is no subtype", () => {
        expect(isScreenshot({ filename: "Screenshot_20260101.png" })).toBe(true);
    });

    it("does not guess when neither signal is present", () => {
        expect(isScreenshot({ filename: "IMG_0001.HEIC" })).toBe(false);
        expect(isScreenshot({})).toBe(false);
    });

    it("sorts found screenshots largest first", () => {
        const found = findScreenshots([
            { id: "a", filename: "screenshot-a.png", fileSize: 10 },
            { id: "b", filename: "screenshot-b.png", fileSize: 900 },
            { id: "c", filename: "photo.jpg", fileSize: 5000 },
        ]);
        expect(found.map((f) => f.id)).toEqual(["b", "a"]);
    });
});

describe("bandLargeAssets", () => {
    it("ignores anything below the smallest band", () => {
        // Calling a 3 MB photo a "large file" is noise that makes the whole
        // report less believable.
        expect(bandLargeAssets([photo("a", { fileSize: 3 * MB })])).toEqual([]);
    });

    it("puts each asset in exactly one band, biggest band first", () => {
        const bands = bandLargeAssets([
            photo("huge", { fileSize: 2048 * MB }),
            photo("mid", { fileSize: 200 * MB }),
            photo("small", { fileSize: 60 * MB }),
        ]);
        expect(bands.map((b) => b.key)).toEqual(["huge", "medium", "small"]);
        expect(bands.every((b) => b.items.length === 1)).toBe(true);
        expect(bands[0].totalBytes).toBe(2048 * MB);
    });

    it("declares its bands in descending order, so the find-first lookup is sound", () => {
        const mins = SIZE_BANDS.map((b) => b.minBytes);
        expect([...mins].sort((a, b) => b - a)).toEqual(mins);
    });
});

describe("perceptual hashing", () => {
    it("returns null rather than a short hash for an undersized frame", () => {
        expect(averageHash([1, 2, 3], 8)).toBeNull();
        expect(averageHash(null, 8)).toBeNull();
    });

    it("sets a bit per pixel above the frame mean", () => {
        const gray = new Array(64).fill(0).map((_, i) => (i < 32 ? 0 : 255));
        expect(averageHash(gray, 8)).toBe("0".repeat(32) + "1".repeat(32));
    });

    it("treats hashes of different lengths as infinitely far apart", () => {
        expect(hammingDistance("101", "1010")).toBe(Infinity);
        expect(hammingDistance(null, "1010")).toBe(Infinity);
    });

    it("counts differing bits", () => {
        expect(hammingDistance("1111", "1011")).toBe(1);
    });
});

describe("groupSimilarByHash", () => {
    const base = "0".repeat(64);
    const near = "1".repeat(3) + "0".repeat(61); // 3 bits away
    const far = "1".repeat(40) + "0".repeat(24);

    it("clusters images inside the threshold and leaves the rest alone", () => {
        const groups = groupSimilarByHash([
            { id: "a", hash: base, fileSize: 100, creationTime: 2 },
            { id: "b", hash: near, fileSize: 100, creationTime: 1 },
            { id: "c", hash: far, fileSize: 100, creationTime: 3 },
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].keepId).toBe("a");
        expect(groups[0].assetIds).toEqual(["b"]);
    });

    it("skips images that could not be hashed instead of pairing them", () => {
        const groups = groupSimilarByHash([
            { id: "a", hash: null, fileSize: 100 },
            { id: "b", hash: null, fileSize: 100 },
        ]);
        expect(groups).toEqual([]);
    });
});

describe("sharpness", () => {
    function frame(fill, size = 8) {
        return { gray: new Array(size * size).fill(0).map(fill), size };
    }

    it("declines to score a frame too small to convolve", () => {
        expect(laplacianVariance([1, 2, 3, 4], 2, 2)).toBeNull();
        expect(laplacianVariance(null, 8, 8)).toBeNull();
    });

    it("scores a flat image at zero, and calls it blurry", () => {
        const { gray, size } = frame(() => 128);
        const score = laplacianVariance(gray, size, size);
        expect(score).toBe(0);
        expect(classifySharpness(score)).toBe("blurry");
    });

    it("scores a high-contrast checkerboard well above the blur threshold", () => {
        const { gray, size } = frame((_, i) => ((i + Math.floor(i / 8)) % 2 ? 255 : 0));
        const score = laplacianVariance(gray, size, size);
        expect(score).toBeGreaterThan(BLUR_THRESHOLD);
        expect(classifySharpness(score)).toBe("sharp");
    });

    it("reports an unscorable image as unknown, never as blurry", () => {
        // The user is being invited to delete these. "We could not read it" must
        // not turn into "it is bad".
        expect(classifySharpness(null)).toBe("unknown");
        expect(classifySharpness(NaN)).toBe("unknown");
    });
});

describe("projectStorage", () => {
    const day = 24 * 60 * 60 * 1000;
    const at = (n) => new Date(Date.UTC(2026, 0, 1) + n * day).toISOString();

    it("refuses to forecast from fewer than three scans", () => {
        const out = projectStorage(
            [{ scannedAt: at(0), totalBytes: 1 }, { scannedAt: at(1), totalBytes: 2 }],
            100
        );
        expect(out.status).toBe("insufficient-history");
    });

    it("refuses to forecast from scans that all happened the same day", () => {
        const out = projectStorage(
            [0, 0.1, 0.2].map((d, i) => ({ scannedAt: at(d), totalBytes: (i + 1) * MB })),
            100 * MB
        );
        expect(out.status).toBe("insufficient-history");
    });

    it("says nothing when storage is flat or shrinking", () => {
        const out = projectStorage(
            [0, 5, 10].map((d) => ({ scannedAt: at(d), totalBytes: 10 * MB })),
            100 * MB
        );
        expect(out.status).toBe("not-growing");
    });

    it("projects the days remaining from the fitted growth rate", () => {
        // 1 MB/day of growth against 10 MB free is ten days.
        const out = projectStorage(
            [0, 1, 2, 3].map((d) => ({ scannedAt: at(d), totalBytes: (100 + d) * MB })),
            10 * MB
        );
        expect(out.status).toBe("ok");
        expect(Math.round(out.bytesPerDay / MB)).toBe(1);
        expect(out.daysUntilFull).toBe(10);
    });

    it("gives the rate but not a date when free space is unknown", () => {
        const out = projectStorage(
            [0, 1, 2, 3].map((d) => ({ scannedAt: at(d), totalBytes: (100 + d) * MB })),
            null
        );
        expect(out.status).toBe("unknown-free-space");
        expect(out.daysUntilFull).toBeUndefined();
    });
});

describe("buildAnalysisPayload", () => {
    const scan = {
        totalAssets: 2,
        totalBytes: 500,
        freeBytes: 900,
        duplicateGroups: [
            { totalBytes: 120, label: "IMG_4823.HEIC", assetIds: ["ph-1"], keepId: "ph-2" },
        ],
        screenshots: [{ fileSize: 40, filename: "Screenshot 2026-01-01 at bankstatement.png", id: "ph-9" }],
        largeBands: [{ key: "huge", items: [{ id: "ph-3" }], totalBytes: 999 }],
    };

    it("sends aggregates and nothing else", () => {
        expect(buildAnalysisPayload(scan)).toEqual({
            totalAssets: 2,
            totalBytes: 500,
            freeBytes: 900,
            duplicateGroups: 1,
            duplicateBytes: 120,
            screenshotCount: 1,
            screenshotBytes: 40,
            bands: [{ key: "huge", count: 1, totalBytes: 999 }],
        });
    });

    it("carries no filename, path or asset id off the device", () => {
        // docs/smart-cleaner-spec.md §5 makes this a hard requirement, for
        // privacy and for App Review. Asserted on the serialised body, because
        // that is what actually leaves.
        const body = JSON.stringify(buildAnalysisPayload(scan));
        expect(body).not.toMatch(/IMG_4823/);
        expect(body).not.toMatch(/bankstatement/i);
        expect(body).not.toMatch(/ph-\d/);
    });

    it("survives a scan that found nothing without inventing figures", () => {
        expect(buildAnalysisPayload({})).toEqual({
            totalAssets: 0,
            totalBytes: 0,
            freeBytes: null,
            duplicateGroups: 0,
            duplicateBytes: 0,
            screenshotCount: 0,
            screenshotBytes: 0,
            bands: [],
        });
    });
});

describe("large-file size thresholds", () => {
    const MB = 1024 * 1024;

    it("defaults to the 50 MB floor, so a 12 MB photo is not a large file", () => {
        expect(bandLargeAssets([photo("a", { fileSize: 12 * MB })])).toEqual([]);
    });

    it("finds that same photo once the floor is lowered to 10 MB", () => {
        const bands = bandLargeAssets([photo("a", { fileSize: 12 * MB })], { minMb: 10 });
        expect(bands).toHaveLength(1);
        expect(bands[0].items).toHaveLength(1);
        expect(bands[0].label).toBe("10 – 20 MB");
    });

    it.each(LARGE_FILE_THRESHOLDS_MB)("never reports a file under the %i MB floor", (minMb) => {
        const under = photo("under", { fileSize: (minMb - 1) * MB });
        const over = photo("over", { fileSize: (minMb + 1) * MB });
        const bands = bandLargeAssets([under, over], { minMb });
        const ids = bands.flatMap((b) => b.items.map((i) => i.id));
        expect(ids).toContain("over");
        expect(ids).not.toContain("under");
    });

    it("keeps bands ordered largest first at every threshold", () => {
        for (const minMb of LARGE_FILE_THRESHOLDS_MB) {
            const mins = bandsForThreshold(minMb).map((b) => b.minBytes);
            expect([...mins].sort((a, b) => b - a)).toEqual(mins);
        }
    });

    // A bad threshold must not produce an empty ladder, which would report
    // "nothing found" on a device that is actually full.
    it.each([0, 7, 999, null, undefined, "10"])("falls back to the default for %p", (bad) => {
        expect(bandsForThreshold(bad)).toEqual(bandsForThreshold(50));
    });
});
