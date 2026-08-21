import { api } from "./client";

/**
 * Receipt extraction client (spec 1.4).
 *
 * The dedicated endpoint does not exist yet. USE_STUB keeps the capture → review
 * → expense-list flow fully exercisable; flip it to false once
 * POST /api/receipts/extract is live.
 *
 * Requested contract:
 *   POST /api/receipts/extract   (multipart: file, header X-Transaction-Id)
 *     returns { merchant, dateUtc, total, currency, taxAmount, category,
 *               lineItems: [{ description, amount }], confidence }
 */

export const USE_STUB = true;

export const RECEIPT_FEATURE_KEY = "receipt_extract";

export const CATEGORIES = ["Travel", "Meals", "Office", "Software", "Fuel", "Utilities", "Other"];

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
            // LOW so every field renders flagged for review — which is exactly
            // what the user should do while this runs on stub data.
            confidence: "LOW",
        };
    }

    const form = new FormData();
    form.append("file", {
        uri: fileUri,
        name: "receipt.jpg",
        type: "image/jpeg",
    });

    const { data } = await api.post("/api/receipts/extract", form, {
        headers: {
            "Content-Type": "multipart/form-data",
            ...(transactionId ? { "X-Transaction-Id": transactionId } : {}),
        },
    });
    return data;
}

/** A read is a failure when neither a merchant nor a total came back. */
export function isFailedRead(result) {
    const noMerchant = !result?.merchant || !String(result.merchant).trim();
    const noTotal = result?.total === null || result?.total === undefined || result?.total === "";
    return noMerchant && noTotal;
}
