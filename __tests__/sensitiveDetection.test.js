import {
    MIN_SIGNALS,
    SENSITIVE_TYPE,
    detectSensitiveType,
    suggestionFor,
    unsecuredSensitive,
} from "../src/services/sensitiveDetection";

// Module 5 §3. This classifier decides whether a user is shown "this looks like
// your passport". It runs on text the app already holds and reaches nothing —
// so what these tests are really protecting is the false-positive rate and the
// advisory framing, not recall.

describe("detectSensitiveType", () => {
    it("says nothing about empty or non-text input", () => {
        expect(detectSensitiveType("")).toBeNull();
        expect(detectSensitiveType("   ")).toBeNull();
        expect(detectSensitiveType(null)).toBeNull();
        expect(detectSensitiveType(undefined)).toBeNull();
        expect(detectSensitiveType(42)).toBeNull();
    });

    it("needs more than one signal before claiming anything", () => {
        // "Patient" alone appears in plenty of letters that are not medical
        // records. A banner that fires on every third document is one the user
        // learns to dismiss without reading.
        expect(detectSensitiveType("Dear patient, thank you for your enquiry.")).toBeNull();
        expect(detectSensitiveType("Please renew your passport soon.")).toBeNull();
        expect(MIN_SIGNALS).toBe(2);
    });

    it("leaves an ordinary invoice alone", () => {
        const invoice = `INVOICE 4471
            Bill to: Acme Ltd
            Description: consulting services, March
            Subtotal 1200.00  VAT 240.00  Total due 1440.00
            Payment terms: 30 days`;
        expect(detectSensitiveType(invoice)).toBeNull();
    });

    it("flags a passport, and can say why", () => {
        const passport = `PASSPORT
            Nationality: BRITISH CITIZEN
            Date of expiry: 12 MAR 2031
            P<GBRSMITH<<JOHN<<<<<<<<<<<<<<<<<<<<<<<<<<<<`;
        const found = detectSensitiveType(passport);
        expect(found.type).toBe(SENSITIVE_TYPE.PASSPORT);
        expect(found.signals).toContain("a machine-readable zone");
        expect(found.signals).toContain("a nationality field");
    });

    it("flags a bank statement", () => {
        const statement = `Statement period: 1 Jan – 31 Jan 2026
            Account number: 12345678
            Sort code: 20-00-00
            Opening balance 1,204.55`;
        expect(detectSensitiveType(statement).type).toBe(SENSITIVE_TYPE.BANK_STATEMENT);
    });

    it("flags an IBAN-bearing statement without any English keyword help", () => {
        const statement = `IBAN GB29NWBK60161331926819
            Closing balance: 402.10`;
        expect(detectSensitiveType(statement).type).toBe(SENSITIVE_TYPE.BANK_STATEMENT);
    });

    it("flags a medical record", () => {
        const record = `Patient: J. Smith
            Diagnosis: iron deficiency anaemia
            Haemoglobin 9.8 g/dL`;
        expect(detectSensitiveType(record).type).toBe(SENSITIVE_TYPE.MEDICAL);
    });

    it("flags a government ID", () => {
        const id = `DRIVING LICENCE
            Licence number: SMITH901234JD9AB
            Date of birth: 04.09.1990
            Issued by: DVLA`;
        expect(detectSensitiveType(id).type).toBe(SENSITIVE_TYPE.GOVERNMENT_ID);
    });

    it("picks the type with the most evidence when a document matches two", () => {
        // A bank statement that mentions a date of birth should not be filed as
        // an ID document on the strength of one shared field.
        const mixed = `Statement period: March 2026
            Account number: 99887766
            Sort code: 11-22-33
            Opening balance 50.00
            Date of birth: 01.01.1980`;
        expect(detectSensitiveType(mixed).type).toBe(SENSITIVE_TYPE.BANK_STATEMENT);
    });
});

describe("suggestionFor", () => {
    it("offers an observation the user can overrule, not a verdict", () => {
        const text = suggestionFor(detectSensitiveType("Passport. Nationality: BRITISH"));
        expect(text).toBe("This looks like a passport. Keep it in your Vault?");
        expect(text).toMatch(/looks like/);
        expect(text).not.toMatch(/warning|risk|unsafe|exposed/i);
    });

    it("says nothing when there is no detection", () => {
        expect(suggestionFor(null)).toBe("");
    });
});

describe("unsecuredSensitive", () => {
    const detections = {
        "doc-1": { type: SENSITIVE_TYPE.PASSPORT, label: "passport" },
        "doc-2": { type: SENSITIVE_TYPE.MEDICAL, label: "medical record" },
        "doc-3": null,
    };

    it("lists only what is detected, outside the vault, and not already refused", () => {
        expect(unsecuredSensitive({ detections }).map((d) => d.id)).toEqual(["doc-1", "doc-2"]);
    });

    it("drops a document once it is in the vault", () => {
        const out = unsecuredSensitive({ detections, vaultSourceIds: ["doc-1"] });
        expect(out.map((d) => d.id)).toEqual(["doc-2"]);
    });

    it("never re-suggests a document the user has dismissed", () => {
        // The spec makes this explicit: a dismissed banner stays dismissed.
        const out = unsecuredSensitive({ detections, dismissed: ["doc-2"] });
        expect(out.map((d) => d.id)).toEqual(["doc-1"]);
    });

    it("copes with no input at all", () => {
        expect(unsecuredSensitive()).toEqual([]);
        expect(unsecuredSensitive({})).toEqual([]);
    });
});
