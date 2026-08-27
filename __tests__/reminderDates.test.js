// Date detection decides when a reminder fires. Getting it wrong is not a
// cosmetic bug — it notifies the user on the wrong day, or not at all, for a
// bill they were relying on the app to catch.
//
// Three rules are easy to break silently:
//
//   1. A date with no intent word near it is noise, not a reminder.
//   2. "15/09/2026" and "09/15/2026" must both resolve to 15 September when one
//      of the two numbers cannot be a month.
//   3. A date later today is 0 days away, not 1.
//
// The expo native modules are mocked out — these tests are about the parsing,
// not about notifications or the filesystem.

jest.mock("expo-notifications", () => ({
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    scheduleNotificationAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn(),
}));
jest.mock("expo-device", () => ({ isDevice: true }));
jest.mock("expo-file-system/legacy", () => ({
    documentDirectory: "file:///docs/",
    getInfoAsync: jest.fn(async () => ({ exists: false })),
    readAsStringAsync: jest.fn(),
    writeAsStringAsync: jest.fn(async () => {}),
}));

import { extractDatesFromText, detectDates } from "../src/services/reminderService";

const iso = (d) => new Date(d).toISOString().slice(0, 10);

describe("extractDatesFromText", () => {
    test("ignores a date with no intent word near it", () => {
        expect(extractDatesFromText("Printed on 15/09/2026 at our office.")).toEqual([]);
    });

    test("picks up a date introduced by an intent word", () => {
        const found = extractDatesFromText("Payment due 15/09/2026.");
        expect(found).toHaveLength(1);
        expect(iso(found[0].dateUtc)).toBe("2026-09-15");
    });

    test("day-first when the first number cannot be a month", () => {
        const [d] = extractDatesFromText("Expires 15/09/2026.");
        expect(iso(d.dateUtc)).toBe("2026-09-15");
    });

    test("month-first when the second number cannot be a month", () => {
        const [d] = extractDatesFromText("Expires 09/15/2026.");
        expect(iso(d.dateUtc)).toBe("2026-09-15");
    });

    test("a genuinely ambiguous date is reported as LOW confidence", () => {
        const [d] = extractDatesFromText("Renewal 05/09/2026.");
        expect(d.confidence).toBe("LOW");
    });

    test("an unambiguous date keeps MEDIUM confidence", () => {
        const [d] = extractDatesFromText("Renewal 25/09/2026.");
        expect(d.confidence).toBe("MEDIUM");
    });

    test("reads ISO, '15 Sep 2026' and 'Sep 15, 2026'", () => {
        expect(iso(extractDatesFromText("Due 2026-09-15.")[0].dateUtc)).toBe("2026-09-15");
        expect(iso(extractDatesFromText("Due 15 September 2026.")[0].dateUtc)).toBe("2026-09-15");
        expect(iso(extractDatesFromText("Due Sep 15, 2026.")[0].dateUtc)).toBe("2026-09-15");
    });

    test("the same date written twice yields one entry", () => {
        const found = extractDatesFromText("Due 15/09/2026. Payment by 15 Sep 2026.");
        expect(found).toHaveLength(1);
    });

    test("results come back in chronological order", () => {
        const found = extractDatesFromText("Due 20/09/2026 and expires 15/09/2026.");
        expect(found.map((d) => iso(d.dateUtc))).toEqual(["2026-09-15", "2026-09-20"]);
    });
});

describe("detectDates", () => {
    test("prefers the backend's detectedDates over parsing the text", () => {
        const out = detectDates({
            detectedDates: [{ label: "Renewal", dateUtc: "2030-01-01T00:00:00.000Z" }],
            summary: "Due 15/09/2026.",
        });
        expect(out).toHaveLength(1);
        expect(out[0].source).toBe("server");
    });

    test("falls back to the summary when the backend sends nothing", () => {
        const out = detectDates({ summary: "Payment due 15/09/2030." });
        expect(out).toHaveLength(1);
        expect(out[0].source).toBe("client");
    });

    test("a date later today is 0 days away, not 1", () => {
        const later = new Date();
        later.setHours(23, 30, 0, 0);
        const [d] = detectDates({ detectedDates: [{ label: "Due", dateUtc: later.toISOString() }] });
        expect(d.daysAway).toBe(0);
        expect(d.expired).toBe(false);
    });

    test("a past date is flagged expired", () => {
        const [d] = detectDates({
            detectedDates: [{ label: "Due", dateUtc: "2001-01-01T00:00:00.000Z" }],
        });
        expect(d.expired).toBe(true);
        expect(d.daysAway).toBeLessThan(0);
    });

    test("drops entries with an unparseable date", () => {
        expect(detectDates({ detectedDates: [{ label: "Due", dateUtc: "not-a-date" }] })).toEqual([]);
    });
});
