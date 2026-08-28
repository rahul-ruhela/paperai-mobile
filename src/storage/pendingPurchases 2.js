/**
 * Transactions Apple has charged for but our backend has not yet confirmed.
 *
 * StoreKit re-delivers any transaction that was never finished, so a purchase
 * that failed verification comes back through `onPurchaseSuccess` on every
 * launch — which is exactly the self-healing we want once the backend recovers.
 * What we don't want is alerting the user about it every single time. This
 * store remembers which transactions we've already complained about so the
 * retries can run silently.
 */

import * as SecureStore from "expo-secure-store";

const KEY = "iap_unverified_transactions";

async function readAll() {
    try {
        const raw = await SecureStore.getItemAsync(KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeAll(list) {
    try {
        // Keep the record bounded — SecureStore is not meant for bulk data and a
        // runaway list would be a symptom of a bug, not something to preserve.
        await SecureStore.setItemAsync(KEY, JSON.stringify(list.slice(-20)));
    } catch {
        /* best-effort — losing this only costs an extra alert */
    }
}

/** Records a failed verification. Returns true the first time only. */
export async function recordFailedVerification(transactionId, productId) {
    if (!transactionId) return true;
    const list = await readAll();
    const existing = list.find((t) => t.transactionId === transactionId);

    if (existing) {
        existing.attempts = (existing.attempts ?? 1) + 1;
        existing.lastAttemptAt = Date.now();
        await writeAll(list);
        return false;
    }

    list.push({
        transactionId,
        productId: productId ?? null,
        attempts: 1,
        firstSeenAt: Date.now(),
        lastAttemptAt: Date.now(),
    });
    await writeAll(list);
    return true;
}

/** True if this transaction previously failed verification on an earlier run. */
export async function wasPreviouslyUnverified(transactionId) {
    if (!transactionId) return false;
    const list = await readAll();
    return list.some((t) => t.transactionId === transactionId);
}

/** Clears a transaction once the backend has confirmed it. */
export async function clearFailedVerification(transactionId) {
    if (!transactionId) return;
    const list = await readAll();
    const next = list.filter((t) => t.transactionId !== transactionId);
    if (next.length !== list.length) await writeAll(next);
}

export async function getUnverifiedTransactions() {
    return readAll();
}
