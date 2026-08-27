// The scan history is the only thing a Storage Studio run leaves on disk, and
// docs/smart-cleaner-spec.md §5 pins exactly what it may contain. These tests
// hold that line: the file lives in the app's document directory, which is
// included in device backups, so anything that leaks into it leaks off-device.

const mockFiles = new Map();

jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///docs/",
    getInfoAsync: jest.fn(async (path) => ({ exists: mockFiles.has(path) })),
    readAsStringAsync: jest.fn(async (path) => mockFiles.get(path)),
    writeAsStringAsync: jest.fn(async (path, contents) => {
        mockFiles.set(path, contents);
    }),
    deleteAsync: jest.fn(async (path) => {
        mockFiles.delete(path);
    }),
    getFreeDiskStorageAsync: jest.fn(async () => 1234),
    getTotalDiskCapacityAsync: jest.fn(async () => 9999),
}));

const FS = require("expo-file-system/legacy");
const {
    MAX_ENTRIES,
    clearHistory,
    freeDiskBytes,
    lastScan,
    listHistory,
    recordScan,
    totalDiskBytes,
} = require("../src/services/cleanerHistory");

beforeEach(() => {
    mockFiles.clear();
    jest.clearAllMocks();
});

describe("listHistory", () => {
    it("is empty before the first scan", async () => {
        expect(await listHistory()).toEqual([]);
    });

    it("returns empty rather than throwing on a corrupt file", async () => {
        mockFiles.set("file:///docs/cleaner-history.json", "{ not json");
        expect(await listHistory()).toEqual([]);
    });

    it("returns empty when the file holds something that is not a list", async () => {
        mockFiles.set("file:///docs/cleaner-history.json", '{"scannedAt":"2026-01-01"}');
        expect(await listHistory()).toEqual([]);
    });
});

describe("recordScan", () => {
    it("writes only the whitelisted aggregate fields", async () => {
        // The shape is pinned in the service, not trusted from the call site, so
        // a screen cannot start persisting asset data by spreading a scan result.
        await recordScan({
            totalAssets: 3,
            totalBytes: 900,
            duplicateBytes: 100,
            freeBytes: 50,
            assetIds: ["ph-1", "ph-2"],
            filenames: ["IMG_4823.HEIC"],
            hashes: ["1010"],
        });

        const [entry] = await listHistory();
        expect(Object.keys(entry).sort()).toEqual([
            "duplicateBytes",
            "freeBytes",
            "scannedAt",
            "totalAssets",
            "totalBytes",
        ]);

        const written = FS.writeAsStringAsync.mock.calls[0][1];
        expect(written).not.toMatch(/IMG_4823/);
        expect(written).not.toMatch(/ph-\d/);
        expect(written).not.toMatch(/1010/);
    });

    it("records null free space rather than a placeholder when the OS will not say", async () => {
        await recordScan({ totalAssets: 1, totalBytes: 1, freeBytes: undefined });
        expect((await lastScan()).freeBytes).toBeNull();
    });

    it("defaults every missing figure to zero instead of undefined", async () => {
        const entry = (await recordScan())[0];
        expect(entry.totalAssets).toBe(0);
        expect(entry.totalBytes).toBe(0);
        expect(entry.duplicateBytes).toBe(0);
    });

    it("puts the newest scan first", async () => {
        await recordScan({ totalAssets: 1 });
        await recordScan({ totalAssets: 2 });
        expect((await lastScan()).totalAssets).toBe(2);
    });

    it("caps the file so a daily scanner cannot grow it without bound", async () => {
        for (let i = 0; i < MAX_ENTRIES + 6; i++) {
            await recordScan({ totalAssets: i });
        }
        const all = await listHistory();
        expect(all).toHaveLength(MAX_ENTRIES);
        expect(all[0].totalAssets).toBe(MAX_ENTRIES + 5); // newest kept
    });

    it("still returns the history when the write fails", async () => {
        // A failed write costs a data point in the forecast. It must never take
        // down a scan that already succeeded.
        FS.writeAsStringAsync.mockRejectedValueOnce(new Error("disk full"));
        await expect(recordScan({ totalAssets: 1 })).resolves.toHaveLength(1);
    });
});

describe("clearHistory", () => {
    it("removes the file and swallows the case where there is none", async () => {
        await recordScan({ totalAssets: 1 });
        await clearHistory();
        expect(await listHistory()).toEqual([]);
        await expect(clearHistory()).resolves.toBeUndefined();
    });
});

describe("disk readings", () => {
    it("passes through the OS figures", async () => {
        expect(await freeDiskBytes()).toBe(1234);
        expect(await totalDiskBytes()).toBe(9999);
    });

    it("reports null rather than zero when the platform refuses", async () => {
        // Zero would render as "0 B free", which is a lie about the device.
        FS.getFreeDiskStorageAsync.mockRejectedValueOnce(new Error("nope"));
        expect(await freeDiskBytes()).toBeNull();
        FS.getTotalDiskCapacityAsync.mockResolvedValueOnce(NaN);
        expect(await totalDiskBytes()).toBeNull();
    });
});
