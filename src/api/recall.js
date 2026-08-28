import { api, FAST } from "./client";

/**
 * Smart Recall API client (roadmap Module 6).
 *
 * Every route here is Advance-only and re-checked server-side; a 403 arrives
 * with the structured entitlement body that `showEntitlementDenial` already
 * knows how to present, so callers hand errors to it rather than inventing copy.
 *
 * Memories are never cached durably on the device. They arrive with the screen
 * that shows them and live in component state — the server is the only copy,
 * which is what makes "forget everything" mean something.
 */

/** Every memory, or just one source's when `sourceId` is given. */
export async function listMemories(sourceId = null) {
    const { data } = await api.get("/api/recall/memories", {
        params: sourceId ? { sourceId } : undefined,
    });
    return data;
}

/** Soft delete. Returns { id, undoUntilUtc } — the 7-day undo window. */
export async function deleteMemory(id) {
    const { data } = await api.delete(`/api/recall/memories/${id}`);
    return data;
}

/** Undo a soft delete, while the window is still open. */
export async function restoreMemory(id) {
    const { data } = await api.post(`/api/recall/memories/${id}/restore`);
    return data;
}

/** "Forget this task" — every memory for one source. The source is untouched. */
export async function forgetSource(sourceId) {
    const { data } = await api.delete(`/api/recall/memories/source/${sourceId}`);
    return data;
}

/** "Forget everything." Hard delete, no undo — the UI types-to-confirm first. */
export async function forgetAllMemories() {
    const { data } = await api.delete("/api/recall/memories/all");
    return data;
}

/** { enabled, hideDetailsOnLockScreen, available, storedCount } */
export async function getRecallPreferences() {
    const { data } = await api.get("/api/recall/preferences", FAST);
    return data;
}

/** Patch either switch. Turning recall ON needs Advance; turning it off never does. */
export async function updateRecallPreferences(patch) {
    const { data } = await api.put("/api/recall/preferences", patch);
    return data;
}
