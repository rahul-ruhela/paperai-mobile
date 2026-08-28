// Module 5 §2. The vault's index is encrypted too, and that is the whole reason
// it is a separate file rather than a plain manifest: a vault whose contents are
// ciphertext but whose listing reads "passport.pdf, 2.1 MB" has published the
// thing worth hiding. These tests assert against the BYTES that reach disk.

const mockFiles = new Map();
const mockDirs = new Set();

jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///docs/",
    cacheDirectory: "file:///cache/",
    EncodingType: { Base64: "base64", UTF8: "utf8" },
    getInfoAsync: jest.fn(async (path) => ({
        exists: mockFiles.has(path) || mockDirs.has(path),
        size: mockFiles.has(path) ? Buffer.from(mockFiles.get(path), "base64").length : 0,
    })),
    readAsStringAsync: jest.fn(async (path) => {
        if (!mockFiles.has(path)) throw new Error("ENOENT");
        return mockFiles.get(path);
    }),
    writeAsStringAsync: jest.fn(async (path, contents) => {
        mockFiles.set(path, contents);
    }),
    deleteAsync: jest.fn(async (path) => {
        mockFiles.delete(path);
        for (const key of [...mockFiles.keys()]) if (key.startsWith(path)) mockFiles.delete(key);
    }),
    makeDirectoryAsync: jest.fn(async (path) => {
        mockDirs.add(path);
    }),
}));

jest.mock("expo-crypto", () => {
    let n = 0;
    return {
        getRandomBytes: jest.fn((size) => Uint8Array.from({ length: size }, (_, i) => (i + ++n) % 256)),
        randomUUID: jest.fn(() => `item-${++n}`),
    };
});

jest.mock("expo-secure-store", () => ({
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "whenUnlockedThisDeviceOnly",
    canUseBiometricAuthentication: jest.fn(() => true),
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

const FS = require("expo-file-system/legacy");
const {
    MAX_ITEM_BYTES,
    VAULT_PATHS,
    addItem,
    destroyVault,
    openItem,
    readIndex,
    releaseAllTempFiles,
    removeItem,
    vaultExists,
} = require("../src/services/vaultStore");

const KEY = new Uint8Array(32).fill(3);
const OTHER_KEY = new Uint8Array(32).fill(4);

/** Puts a plaintext file where addItem can read it. */
function seedSource(uri, text) {
    mockFiles.set(uri, Buffer.from(text, "utf8").toString("base64"));
}

/** Everything written to disk, concatenated, as a searchable string. */
function diskContents() {
    return [...mockFiles.entries()]
        .filter(([path]) => path.startsWith(VAULT_PATHS.DIR))
        .map(([, value]) => Buffer.from(value, "base64").toString("binary"))
        .join("\n");
}

beforeEach(() => {
    mockFiles.clear();
    mockDirs.clear();
    jest.clearAllMocks();
});

describe("adding", () => {
    it("stores the file and lists it back", async () => {
        seedSource("file:///src/passport.pdf", "MRZ CONTENT HERE");
        const entry = await addItem(KEY, {
            uri: "file:///src/passport.pdf",
            name: "passport.pdf",
            mimeType: "application/pdf",
            sourceId: "doc-1",
        });

        const index = await readIndex(KEY);
        expect(index).toHaveLength(1);
        expect(index[0].name).toBe("passport.pdf");
        expect(index[0].sourceId).toBe("doc-1");
        expect(entry.id).toBeTruthy();
    });

    it("writes no plaintext to disk — not the contents, not even the name", async () => {
        // A failed unlock must reveal no names, counts or thumbnails (spec §7.2),
        // and it cannot, because without the key there is nothing here but noise.
        seedSource("file:///src/passport.pdf", "SMITH<<JOHN MRZ CONTENT");
        await addItem(KEY, { uri: "file:///src/passport.pdf", name: "passport.pdf" });

        const disk = diskContents();
        expect(disk).not.toMatch(/SMITH/);
        expect(disk).not.toMatch(/MRZ CONTENT/);
        expect(disk).not.toMatch(/passport\.pdf/);
    });

    it("keeps the newest item first", async () => {
        seedSource("file:///a", "one");
        seedSource("file:///b", "two");
        await addItem(KEY, { uri: "file:///a", name: "a" });
        await addItem(KEY, { uri: "file:///b", name: "b" });
        expect((await readIndex(KEY)).map((e) => e.name)).toEqual(["b", "a"]);
    });

    it("refuses a file over the size limit, and says which limit", async () => {
        // Pure-JS AES on the JS thread: past this point the wait stops feeling
        // like a save and starts feeling like a hang.
        const big = "x".repeat(MAX_ITEM_BYTES + 1);
        seedSource("file:///src/huge.pdf", big);
        await expect(
            addItem(KEY, { uri: "file:///src/huge.pdf", name: "huge.pdf" })
        ).rejects.toMatchObject({ code: "TOO_LARGE", limit: MAX_ITEM_BYTES });
    });

    it("refuses a source file that is not there", async () => {
        await expect(addItem(KEY, { uri: "file:///gone", name: "gone" })).rejects.toThrow(
            "MISSING_FILE"
        );
    });

    it("never deletes the user's original", async () => {
        // Adding to the vault encrypts a COPY. The app cannot remove a photo
        // from the user's library and must not imply that it did.
        seedSource("file:///src/original.jpg", "photo bytes");
        await addItem(KEY, { uri: "file:///src/original.jpg", name: "original.jpg" });
        expect(mockFiles.has("file:///src/original.jpg")).toBe(true);
        expect(FS.deleteAsync).not.toHaveBeenCalledWith(
            "file:///src/original.jpg",
            expect.anything()
        );
    });
});

describe("reading", () => {
    it("returns an empty vault to the wrong key rather than throwing", async () => {
        seedSource("file:///src/a.pdf", "secret");
        await addItem(KEY, { uri: "file:///src/a.pdf", name: "a.pdf" });
        expect(await readIndex(OTHER_KEY)).toEqual([]);
    });

    it("is empty before anything is added", async () => {
        expect(await readIndex(KEY)).toEqual([]);
        expect(await vaultExists()).toBe(false);
    });

    it("decrypts an item to a temp file inside the sandbox", async () => {
        seedSource("file:///src/a.pdf", "the actual contents");
        const { id } = await addItem(KEY, { uri: "file:///src/a.pdf", name: "a.pdf" });

        const { uri } = await openItem(KEY, id);
        expect(uri.startsWith(VAULT_PATHS.TEMP_DIR)).toBe(true);
        expect(Buffer.from(mockFiles.get(uri), "base64").toString("utf8")).toBe(
            "the actual contents"
        );
    });

    it("refuses to open an item that is not in the index", async () => {
        await expect(openItem(KEY, "nope")).rejects.toThrow("NOT_FOUND");
    });
});

describe("clearing up", () => {
    it("removes every decrypted temp file when the vault re-locks", async () => {
        seedSource("file:///src/a.pdf", "contents");
        const { id } = await addItem(KEY, { uri: "file:///src/a.pdf", name: "a.pdf" });
        const { uri } = await openItem(KEY, id);
        expect(mockFiles.has(uri)).toBe(true);

        await releaseAllTempFiles();
        expect(mockFiles.has(uri)).toBe(false);
    });

    it("removes an item from both the index and the disk", async () => {
        seedSource("file:///src/a.pdf", "contents");
        const { id } = await addItem(KEY, { uri: "file:///src/a.pdf", name: "a.pdf" });

        expect(await removeItem(KEY, id)).toEqual([]);
        expect(mockFiles.has(`${VAULT_PATHS.DIR}${id}.enc`)).toBe(false);
    });

    it("still drops the index row when the encrypted file cannot be deleted", async () => {
        // Otherwise a file that refuses to go strands a row the user can no
        // longer open and cannot get rid of.
        seedSource("file:///src/a.pdf", "contents");
        const { id } = await addItem(KEY, { uri: "file:///src/a.pdf", name: "a.pdf" });
        FS.deleteAsync.mockRejectedValueOnce(new Error("locked"));
        expect(await removeItem(KEY, id)).toEqual([]);
    });

    it("destroys the whole vault directory", async () => {
        seedSource("file:///src/a.pdf", "contents");
        await addItem(KEY, { uri: "file:///src/a.pdf", name: "a.pdf" });
        await destroyVault();
        expect(await readIndex(KEY)).toEqual([]);
        expect(await vaultExists()).toBe(false);
    });
});

describe("network", () => {
    it("reaches nothing", async () => {
        // Spec §7.7. Vault contents are never uploaded, so there must be no
        // fetch on any path through this module — asserted rather than assumed.
        const spy = jest.spyOn(global, "fetch").mockImplementation(() => {
            throw new Error("the vault must not make network calls");
        });
        seedSource("file:///src/a.pdf", "contents");
        const { id } = await addItem(KEY, { uri: "file:///src/a.pdf", name: "a.pdf" });
        await openItem(KEY, id);
        await readIndex(KEY);
        await removeItem(KEY, id);
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
