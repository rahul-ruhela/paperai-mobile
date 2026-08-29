// Every screenshot in Storage Studio reported "0 MB" because `getAssetInfoAsync`
// fills in `fileSize` on Android but not on iOS, where the Photos framework
// exposes no size on the asset. These tests cover the disk-stat fallback that
// replaces that zero with a real number — and the cases where it must stay
// unknown rather than become an invented one.

const mockInfo = { exists: true, size: 4 * 1024 * 1024 };

jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///docs/",
    getInfoAsync: jest.fn(async () => mockInfo),
}));

jest.mock("expo-media-library", () => ({
    MediaType: { photo: "photo", video: "video" },
    SortBy: { creationTime: "creationTime" },
    getAssetsAsync: jest.fn(),
    getAssetInfoAsync: jest.fn(),
}));

const FS = require("expo-file-system/legacy");
const MediaLibrary = require("expo-media-library");
const {
    enrichAssets,
    formatItemSize,
    measureAssetSize,
} = require("../src/services/cleanerService");

beforeEach(() => {
    jest.clearAllMocks();
    mockInfo.exists = true;
    mockInfo.size = 4 * 1024 * 1024;
});

describe("measureAssetSize", () => {
    it("trusts a size the media API already gave, without touching the disk", async () => {
        expect(await measureAssetSize({ fileSize: 123, localUri: "file:///a.jpg" })).toBe(123);
        expect(FS.getInfoAsync).not.toHaveBeenCalled();
    });

    it("stats the local file when the media API reported nothing", async () => {
        expect(await measureAssetSize({ fileSize: 0, localUri: "file:///a.jpg" })).toBe(
            4 * 1024 * 1024
        );
        expect(FS.getInfoAsync).toHaveBeenCalledWith("file:///a.jpg", { size: true });
    });

    it("falls back to `uri` when there is no localUri", async () => {
        expect(await measureAssetSize({ uri: "file:///b.jpg" })).toBe(4 * 1024 * 1024);
    });

    it("reports unknown for a ph:// asset with no local file", async () => {
        expect(await measureAssetSize({ uri: "ph://ABC" })).toBe(0);
        expect(FS.getInfoAsync).not.toHaveBeenCalled();
    });

    it("reports unknown for an asset with no uri at all", async () => {
        expect(await measureAssetSize({})).toBe(0);
    });

    it("reports unknown for a file that is not there", async () => {
        mockInfo.exists = false;
        expect(await measureAssetSize({ uri: "file:///gone.jpg" })).toBe(0);
    });

    it("reports unknown rather than throwing when the stat fails", async () => {
        FS.getInfoAsync.mockRejectedValueOnce(new Error("unreadable"));
        expect(await measureAssetSize({ uri: "file:///a.jpg" })).toBe(0);
    });
});

describe("enrichAssets", () => {
    it("fills in the size iOS withheld", async () => {
        MediaLibrary.getAssetInfoAsync.mockImplementation(async (a) => ({
            ...a,
            localUri: "file:///shot.png",
            mediaSubtypes: ["screenshot"],
        }));

        const [asset] = await enrichAssets([{ id: "a", filename: "Screenshot.png" }]);

        expect(asset.fileSize).toBe(4 * 1024 * 1024);
        expect(formatItemSize(asset.fileSize)).toBe("4.0 MB");
    });

    it("keeps a size the media API did give, without re-measuring", async () => {
        MediaLibrary.getAssetInfoAsync.mockImplementation(async (a) => ({ ...a, fileSize: 999 }));

        const [asset] = await enrichAssets([{ id: "a" }]);

        expect(asset.fileSize).toBe(999);
        expect(FS.getInfoAsync).not.toHaveBeenCalled();
    });

    it("keeps an unmeasurable asset in the scan instead of dropping it", async () => {
        MediaLibrary.getAssetInfoAsync.mockImplementation(async (a) => ({ ...a, uri: "ph://X" }));

        const [asset] = await enrichAssets([{ id: "a", filename: "cloud.jpg" }]);

        expect(asset.id).toBe("a");
        expect(asset.fileSize ?? 0).toBe(0);
    });

    it("keeps the bare asset when the info call itself fails", async () => {
        MediaLibrary.getAssetInfoAsync.mockRejectedValue(new Error("denied"));

        const [asset] = await enrichAssets([{ id: "a", filename: "x.jpg" }]);

        expect(asset).toEqual({ id: "a", filename: "x.jpg" });
    });
});

describe("formatItemSize", () => {
    it("says so instead of claiming a file is empty", () => {
        expect(formatItemSize(0)).toBe("Size unavailable");
        expect(formatItemSize(undefined)).toBe("Size unavailable");
    });

    it("formats a real size", () => {
        expect(formatItemSize(2 * 1024 * 1024)).toBe("2.0 MB");
    });
});
