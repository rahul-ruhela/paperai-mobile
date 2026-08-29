// Saved signatures are the one piece of the signing flow that outlives a session,
// so the edit path has to be non-destructive: renaming or redrawing must never
// lose the drawing, the id, or the entry's place in the list.

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
}));

const {
    MAX_SAVED,
    clearSignatures,
    deleteSignature,
    listSignatures,
    normaliseName,
    renameSignature,
    saveSignature,
    updateSignature,
} = require("../src/services/signatureStore");

const strokes = (n = 1) => [[{ x: n, y: n }]];

beforeEach(() => {
    mockFiles.clear();
    jest.clearAllMocks();
});

describe("saveSignature", () => {
    it("is empty before anything is saved", async () => {
        expect(await listSignatures()).toEqual([]);
    });

    it("saves strokes with an optional name", async () => {
        await saveSignature(strokes(1), "  Work  ");
        const [sig] = await listSignatures();
        expect(sig.name).toBe("Work");
        expect(sig.strokes).toEqual(strokes(1));
    });

    it("refuses an empty drawing rather than storing a blank entry", async () => {
        expect(await saveSignature([])).toBeNull();
        expect(await listSignatures()).toEqual([]);
    });

    it("keeps the newest first and never more than MAX_SAVED", async () => {
        for (let i = 0; i < MAX_SAVED + 2; i++) await saveSignature(strokes(i), `sig ${i}`);
        const all = await listSignatures();
        expect(all).toHaveLength(MAX_SAVED);
        expect(all[0].name).toBe(`sig ${MAX_SAVED + 1}`);
    });
});

describe("updateSignature", () => {
    it("renames without touching the drawing or the id", async () => {
        const saved = await saveSignature(strokes(7), "old");
        await renameSignature(saved.id, "new");
        const [sig] = await listSignatures();
        expect(sig.id).toBe(saved.id);
        expect(sig.name).toBe("new");
        expect(sig.strokes).toEqual(strokes(7));
    });

    it("redraws without touching the name or the id", async () => {
        const saved = await saveSignature(strokes(1), "Work");
        await updateSignature(saved.id, { strokes: strokes(2) });
        const [sig] = await listSignatures();
        expect(sig.id).toBe(saved.id);
        expect(sig.name).toBe("Work");
        expect(sig.strokes).toEqual(strokes(2));
    });

    it("keeps createdAt and moves updatedAt", async () => {
        const saved = await saveSignature(strokes(1));
        await updateSignature(saved.id, { name: "x" });
        const [sig] = await listSignatures();
        expect(sig.createdAt).toBe(saved.createdAt);
        expect(new Date(sig.updatedAt).getTime()).toBeGreaterThanOrEqual(
            new Date(saved.createdAt).getTime()
        );
    });

    it("leaves the entry where it was in the list", async () => {
        await saveSignature(strokes(1), "first");
        const middle = await saveSignature(strokes(2), "second");
        await saveSignature(strokes(3), "third");
        await updateSignature(middle.id, { name: "renamed" });
        expect((await listSignatures()).map((s) => s.name)).toEqual([
            "third",
            "renamed",
            "first",
        ]);
    });

    it("ignores an empty redraw rather than blanking the signature", async () => {
        const saved = await saveSignature(strokes(4), "Work");
        await updateSignature(saved.id, { strokes: [] });
        expect((await listSignatures())[0].strokes).toEqual(strokes(4));
    });

    it("allows clearing a name back to unnamed", async () => {
        const saved = await saveSignature(strokes(1), "Work");
        await renameSignature(saved.id, "   ");
        expect((await listSignatures())[0].name).toBe("");
    });

    it("returns null for an id that is not there", async () => {
        expect(await updateSignature("nope", { name: "x" })).toBeNull();
    });
});

describe("deleteSignature", () => {
    it("removes only the one asked for", async () => {
        const a = await saveSignature(strokes(1), "a");
        await saveSignature(strokes(2), "b");
        await deleteSignature(a.id);
        expect((await listSignatures()).map((s) => s.name)).toEqual(["b"]);
    });

    it("clears them all", async () => {
        await saveSignature(strokes(1));
        await clearSignatures();
        expect(await listSignatures()).toEqual([]);
    });
});

describe("reading older files", () => {
    it("reads pre-name entries as unnamed instead of dropping them", async () => {
        mockFiles.set(
            "file:///docs/signatures.json",
            JSON.stringify([{ id: "sig_1", strokes: strokes(1), createdAt: "2026-01-01T00:00:00Z" }])
        );
        const [sig] = await listSignatures();
        expect(sig.name).toBe("");
        expect(sig.updatedAt).toBe("2026-01-01T00:00:00Z");
    });

    it("survives a corrupt file rather than throwing", async () => {
        mockFiles.set("file:///docs/signatures.json", "{not json");
        expect(await listSignatures()).toEqual([]);
    });

    it("drops entries with no strokes", async () => {
        mockFiles.set("file:///docs/signatures.json", JSON.stringify([{ id: "sig_1" }, null]));
        expect(await listSignatures()).toEqual([]);
    });
});

describe("normaliseName", () => {
    it("trims and caps the length", () => {
        expect(normaliseName("  hi  ")).toBe("hi");
        expect(normaliseName("x".repeat(80))).toHaveLength(40);
        expect(normaliseName(null)).toBe("");
    });
});
