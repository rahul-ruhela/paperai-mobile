/**
 * chatFreeMessages — remembers which documents have already used their one free
 * AI Chat message.
 *
 * Why this exists: AiChatScreen decides whether to reserve a credit before
 * sending, and it used to derive that decision purely from the chat history
 * returned by the server. `getChatHistory` is wrapped in a catch that falls back
 * to an empty list, so any network hiccup on open made the screen believe the
 * document had never been asked anything — and it handed out the free message
 * again, every time, for free. Charging instead would be worse: a genuine first
 * question would cost a credit because a GET happened to fail.
 *
 * A tiny on-device ledger removes the ambiguity in both directions. It is OR'd
 * with the server history, so the server still wins when it has an opinion and
 * this only fills the gap when it doesn't.
 *
 * Uses the legacy expo-file-system API for the same reason signatureStore and
 * expenseStore do — it is stable across SDK bumps and these records are a few
 * bytes each, not credentials.
 */

import * as FileSystem from "expo-file-system/legacy";

const FILE = "chat-free-used.json";

function path() {
    return `${FileSystem.documentDirectory}${FILE}`;
}

async function readAll() {
    try {
        const info = await FileSystem.getInfoAsync(path());
        if (!info.exists) return [];
        const parsed = JSON.parse(await FileSystem.readAsStringAsync(path()));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/** True when this document's free first message has already been spent. */
export async function isFreeMessageUsed(docId) {
    if (!docId) return false;
    return (await readAll()).includes(String(docId));
}

/**
 * Marks the free message spent. Idempotent — called after the first successful
 * answer, and calling it twice for the same document is a no-op.
 */
export async function markFreeMessageUsed(docId) {
    if (!docId) return;
    const id = String(docId);
    const all = await readAll();
    if (all.includes(id)) return;
    try {
        await FileSystem.writeAsStringAsync(path(), JSON.stringify([...all, id]));
    } catch {
        // A failed write only means the user may get one more free message than
        // intended — never a wrong charge. Not worth surfacing.
    }
}
