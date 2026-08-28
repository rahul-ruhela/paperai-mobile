import { authedFetch } from "./client";

/**
 * Receipt extraction client (spec 1.4). Live against ReceiptsController.
 *
 *   POST /api/receipts/extract   (multipart: file, header X-Transaction-Id)
 *     returns { merchant, dateUtc, total, currency, taxAmount, category,
 *               lineItems: [{ description, amount }], confidence, refunded }
 *
 * Uses authedFetch, NOT the axios instance. Multipart uploads must go through
 * the native fetch API here: setting "Content-Type: multipart/form-data" by hand
 * strips the boundary parameter that the server needs to parse the body, so the
 * file arrives null and the request 400s with "Missing file". Letting the
 * runtime set the header is what makes /api/documents/upload work, and this
 * follows the same path.
 *
 * A failed read comes back with null merchant AND null total plus
 * refunded: true — isFailedRead() below must stay in agreement with
 * ReceiptExtraction.IsFailedRead on the server, or the app will tell the user
 * something was free that they were actually charged for.
 *
 * USE_STUB is kept as an offline escape hatch for UI work without a running
 * API. It must be false in anything that ships.
 */

export const USE_STUB = false;

export const RECEIPT_FEATURE_KEY = "receipt_extract";

export const CATEGORIES = ["Travel", "Meals", "Office", "Software", "Fuel", "Utilities", "Other"];

function filenameFor(uri) {
    const clean = String(uri).split("?")[0];
    const name = clean.split("/").pop() || "receipt.jpg";
    return /\.[a-z0-9]+$/i.test(name) ? name : `${name}.jpg`;
}

function mimeFor(uri) {
    const ext = String(uri).split("?")[0].split(".").pop()?.toLowerCase();
    if (ext === "png") return "image/png";
    if (ext === "heic" || ext === "heif") return "image/heic";
    if (ext === "webp") return "image/webp";
    return "image/jpeg";
}

export async function extractReceipt(fileUri, transactionId) {
    if (USE_STUB) {
        await new Promise((r) => setTimeout(r, 1200));
        return {
            merchant: "",
            dateUtc: new Date().toISOString(),
            total: null,
            currency: "USD",
            taxAmount: null,
            category: "Other",
            lineItems: [],
            confidence: "LOW",
        };
    }

    const form = new FormData();
    form.append("file", {
        uri: fileUri,
        name: filenameFor(fileUri),
        type: mimeFor(fileUri),
    });

    const res = await authedFetch("/api/receipts/extract", {
        method: "POST",
        body: form,
        // Deliberately no Content-Type — see the note at the top of this file.
        headers: transactionId ? { "X-Transaction-Id": String(transactionId) } : {},
    });

    const text = await res.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch {
        data = {};
    }

    if (!res.ok) {
        const err = new Error(data?.message || `Receipt extraction failed (${res.status})`);
        err.status = res.status;
        err.userMessage = data?.message;
        throw err;
    }

    return data;
}

/** A read is a failure when neither a merchant nor a total came back. */
export function isFailedRead(result) {
    const noMerchant = !result?.merchant || !String(result.merchant).trim();
    const noTotal = result?.total === null || result?.total === undefined || result?.total === "";
    return noMerchant && noTotal;
}
