// profileName — the shared first-name accessor.
//
// This exists because of a real bug: two call sites read `profile.name`, but
// /api/profile returns `fullName`. Nothing looked broken, because
// composeSentence drops the greeting when the name is empty — so every spoken
// reminder simply never said anyone's name. The field-name test below is the
// one that would have caught it.

const mockGet = jest.fn();
jest.mock("../src/api/client", () => ({ api: { get: (...a) => mockGet(...a) } }));

const {
    firstNameOf,
    getFirstName,
    cachedFirstName,
    clearFirstName,
} = require("../src/services/profileName");

beforeEach(() => {
    jest.clearAllMocks();
    clearFirstName();
});

describe("firstNameOf", () => {
    it.each([
        ["Rahul Ruhela", "Rahul"],
        ["Rahul", "Rahul"],
        ["  Priya   Sharma  ", "Priya"],
        ["Jean-Luc Picard", "Jean-Luc"],
    ])("takes the first word of %p", (full, expected) => {
        expect(firstNameOf(full)).toBe(expected);
    });

    it.each([[""], [null], [undefined], ["   "]])("returns empty for %p", (v) => {
        expect(firstNameOf(v)).toBe("");
    });
});

describe("getFirstName", () => {
    it("reads fullName, which is the field the API actually returns", async () => {
        mockGet.mockResolvedValue({ data: { fullName: "Rahul Ruhela", email: "x@y.z" } });
        expect(await getFirstName()).toBe("Rahul");
    });

    // The regression guard: `name` is NOT the field, and reading it was the bug.
    it("does not fall back to a `name` field", async () => {
        mockGet.mockResolvedValue({ data: { name: "Wrong Field" } });
        expect(await getFirstName()).toBe("");
    });

    it("fetches once and serves the rest from cache", async () => {
        mockGet.mockResolvedValue({ data: { fullName: "Rahul Ruhela" } });
        await getFirstName();
        await getFirstName();
        await getFirstName();
        expect(mockGet).toHaveBeenCalledTimes(1);
        expect(cachedFirstName()).toBe("Rahul");
    });

    it("shares one request between concurrent callers", async () => {
        mockGet.mockResolvedValue({ data: { fullName: "Rahul Ruhela" } });
        const [a, b] = await Promise.all([getFirstName(), getFirstName()]);
        expect(a).toBe("Rahul");
        expect(b).toBe("Rahul");
        expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("returns empty and never throws when the profile call fails", async () => {
        mockGet.mockRejectedValue(new Error("offline"));
        await expect(getFirstName()).resolves.toBe("");
    });

    // A name missed because the network was down should be retried; a name the
    // user has genuinely not set should not be re-requested forever.
    it("does not cache a failure", async () => {
        mockGet.mockRejectedValueOnce(new Error("offline"));
        expect(await getFirstName()).toBe("");

        mockGet.mockResolvedValue({ data: { fullName: "Rahul Ruhela" } });
        expect(await getFirstName()).toBe("Rahul");
    });

    it("caches a genuinely empty name", async () => {
        mockGet.mockResolvedValue({ data: { fullName: "" } });
        expect(await getFirstName()).toBe("");
        await getFirstName();
        expect(mockGet).toHaveBeenCalledTimes(1);
    });
});
