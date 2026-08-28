/**
 * sensitiveDetection — decides whether a document the user already has looks
 * like something they would rather keep in the Vault (Module 5, §3).
 *
 * Every rule here is a keyword or pattern match against text the app already
 * holds locally — the OCR or analysis output it produced earlier. Detection
 * makes no network call of its own, and the result is never sent anywhere or
 * logged. That is a hard requirement from the spec, and it is why this file is
 * pure: there is nothing to mock, because there is nothing to reach out to.
 *
 * The result is advisory. It produces a dismissible suggestion, never an action:
 * nothing is auto-moved, auto-hidden or auto-deleted on the strength of a
 * keyword match. False positives are expected and are meant to be cheap.
 *
 * Two signals are required before any type fires. One is not enough — the word
 * "patient" appears in plenty of letters that are not medical records, and a
 * banner that cries wolf on every third document is one the user learns to
 * dismiss without reading, which costs more than the misses.
 */

export const SENSITIVE_TYPE = {
    PASSPORT: "passport",
    BANK_STATEMENT: "bank_statement",
    MEDICAL: "medical_record",
    GOVERNMENT_ID: "government_id",
};

export const TYPE_LABELS = {
    [SENSITIVE_TYPE.PASSPORT]: "passport",
    [SENSITIVE_TYPE.BANK_STATEMENT]: "bank statement",
    [SENSITIVE_TYPE.MEDICAL]: "medical record",
    [SENSITIVE_TYPE.GOVERNMENT_ID]: "government ID",
};

/** Minimum matched signals before a type is claimed at all. */
export const MIN_SIGNALS = 2;

// Each signal is a named test so a detection can explain itself. The label is
// what the UI shows when the user asks why a document was flagged — "we saw a
// machine-readable zone" is answerable; "confidence 0.82" is not.
const RULES = [
    {
        type: SENSITIVE_TYPE.PASSPORT,
        signals: [
            { label: "the word passport", test: /\bpassports?\b/i },
            // The ICAO machine-readable zone: two 44-character lines of A–Z, digits
            // and filler chevrons. Nothing else in an ordinary document looks
            // remotely like this, so it is the strongest single signal here.
            // Tolerates surrounding spaces/tabs but not newlines: OCR output is
            // routinely indented, and anchoring hard to column zero would miss
            // the strongest passport signal there is on most real scans.
            { label: "a machine-readable zone", test: /^[ \t]*[A-Z0-9<]{30,44}[ \t]*$/m },
            { label: "an expiry date field", test: /date of expiry|expiry date|date d.expiration/i },
            { label: "a nationality field", test: /\bnationality\b/i },
            { label: "a place of birth field", test: /place of birth/i },
        ],
    },
    {
        type: SENSITIVE_TYPE.BANK_STATEMENT,
        signals: [
            { label: "an account number", test: /account\s*(number|no\.?|#)/i },
            // IBAN: two country letters, two check digits, then up to 30 more.
            { label: "an IBAN", test: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/ },
            { label: "a sort code", test: /sort\s*code/i },
            { label: "an opening or closing balance", test: /(opening|closing|available)\s+balance/i },
            { label: "a statement period", test: /statement\s+(period|date)|period\s+covered/i },
            { label: "an IFSC code", test: /\bifsc\b/i },
        ],
    },
    {
        type: SENSITIVE_TYPE.MEDICAL,
        signals: [
            { label: "a diagnosis", test: /\bdiagnos(is|ed|tic)\b/i },
            { label: "a prescription", test: /\bprescri(ption|bed)\b/i },
            { label: "a patient name or number", test: /\bpatient\b/i },
            { label: "lab report units", test: /\b(mg\/dl|mmol\/l|g\/dl|iu\/l|ng\/ml)\b/i },
            { label: "a blood test", test: /blood\s+(test|count|group|pressure)|haemoglobin|hemoglobin/i },
            { label: "a doctor or clinic", test: /\b(dr\.?|doctor|clinic|hospital|physician)\b/i },
        ],
    },
    {
        type: SENSITIVE_TYPE.GOVERNMENT_ID,
        signals: [
            { label: "a licence number", test: /licen[cs]e\s*(number|no\.?|#)/i },
            { label: "a date of birth", test: /date of birth|\bd\.?o\.?b\.?\b/i },
            { label: "an issuing authority", test: /issued by|issuing authority|authority\s*:/i },
            { label: "a national ID number", test: /\b(aadhaar|social security|national insurance|ssn|nric|pan\s*card)\b/i },
            { label: "an identity card", test: /identity\s+card|\bid\s+card\b/i },
        ],
    },
];

/**
 * Classifies `text`. Returns null when nothing reaches MIN_SIGNALS — "none" is
 * the common answer and is represented by an absence, so a caller cannot
 * accidentally render a banner for it.
 *
 * Ties go to the type with more matched signals, then to the earlier rule, which
 * puts passport and bank statement ahead of the broader medical and ID rule sets.
 */
export function detectSensitiveType(text) {
    if (typeof text !== "string" || text.trim().length === 0) return null;

    let best = null;
    for (const rule of RULES) {
        const matched = rule.signals.filter((s) => s.test.test(text));
        if (matched.length < MIN_SIGNALS) continue;
        if (!best || matched.length > best.signals.length) {
            best = {
                type: rule.type,
                label: TYPE_LABELS[rule.type],
                signals: matched.map((s) => s.label),
            };
        }
    }
    return best;
}

/**
 * The one sentence shown in the suggestion banner.
 *
 * Phrased as an observation the user can overrule — "this looks like" — because
 * that is what a keyword match is. Asserting "this is your passport" would be a
 * claim the rule set cannot support, and the banner has a Dismiss button
 * precisely because it is sometimes wrong.
 */
export function suggestionFor(detection) {
    if (!detection) return "";
    return `This looks like a ${detection.label}. Keep it in your Vault?`;
}

/**
 * Documents that were detected as sensitive and are not in the vault, given the
 * locally stored detection results and the vault's index.
 *
 * `dismissed` ids are excluded: a banner the user has already said no to does
 * not come back for the same document.
 */
export function unsecuredSensitive({ detections = {}, vaultSourceIds = [], dismissed = [] } = {}) {
    const inVault = new Set(vaultSourceIds);
    const refused = new Set(dismissed);
    return Object.entries(detections)
        .filter(([id, d]) => d && !inVault.has(id) && !refused.has(id))
        .map(([id, d]) => ({ id, ...d }));
}
