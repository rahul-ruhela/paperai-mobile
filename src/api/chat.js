import { api } from "./client";

/**
 * Document chat client (spec 1.1).
 *
 * The backend endpoints below DO NOT EXIST YET. Until they ship, USE_STUB keeps
 * the whole UI reviewable and shippable — flip it to false the moment
 * POST/GET /api/documents/{id}/chat are live. Nothing else needs to change.
 *
 * Requested contract:
 *   POST /api/documents/{id}/chat
 *     body    { message, transactionId }
 *     returns { answer, citations?: [{ text, page? }], messageId }
 *   GET  /api/documents/{id}/chat
 *     returns [{ id, role: "user"|"assistant", content, createdAt, citations? }]
 */

export const USE_STUB = true;

export const CHAT_FEATURE_KEY = "document_ai_chat";

export async function getChatHistory(docId) {
    if (USE_STUB) return [];

    const { data } = await api.get(`/api/documents/${docId}/chat`);
    return Array.isArray(data) ? data : [];
}

export async function sendChatMessage(docId, message, transactionId) {
    if (USE_STUB) {
        // Mirrors the real latency so loading states get exercised properly.
        await new Promise((r) => setTimeout(r, 900));
        return {
            messageId: `stub_${Date.now()}`,
            answer:
                "AI Chat is not connected to the backend yet. Once the " +
                "/api/documents/{id}/chat endpoint is live, this will answer from " +
                "your document's contents.\n\nYou asked: “" + message + "”",
            citations: [],
        };
    }

    const { data } = await api.post(`/api/documents/${docId}/chat`, {
        message,
        transactionId,
    });
    return data;
}
