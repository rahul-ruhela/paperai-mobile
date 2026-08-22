import { api } from "./client";

/**
 * Document chat client (spec 1.1). Live against DocumentChatController.
 *
 *   POST /api/documents/{id}/chat
 *     body    { message, transactionId }
 *     returns { answer, citations: [{ text, page }], messageId }
 *              or { answer: "", refunded: true, reason } when the model could
 *              not ground an answer — the backend has already refunded.
 *   GET  /api/documents/{id}/chat
 *     returns [{ id, role: "user"|"assistant", content, createdAt, citations }]
 *
 * USE_STUB is kept as an offline escape hatch: set it to true to develop the UI
 * without a running API. It must be false in anything that ships.
 */

export const USE_STUB = false;

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
