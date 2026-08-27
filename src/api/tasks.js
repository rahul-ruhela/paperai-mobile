import { api } from "./client";

/**
 * Tasks API — the single task system behind both Assistant tabs.
 *
 * `source` is optional and omitted by default, so a call with no arguments
 * returns exactly what this module has always returned.
 *   "ai"     → tasks generated from documents
 *   "manual" → tasks the user created
 */
export async function listTasks({ source, status } = {}) {
  const params = {};
  if (source) params.source = source;
  if (status) params.status = status;

  const { data } = await api.get("/api/tasks", { params });
  return data;
}

/**
 * Creates a manual task.
 *
 * The first two arguments keep their original positional shape so existing call
 * sites (`createTask(title)`, `createTask(title, docId)`) keep working; the
 * Assistant's richer fields go in the third argument.
 *
 * `dueAtUtc` is an ISO string for one absolute instant. When the user picked a
 * day but no time, the caller sends 09:00 local for that day and `dueTimeSet:
 * false` — the flag only decides whether the UI shows a time.
 */
export async function createTask(title, documentId = null, fields = {}) {
  const { description, priority, dueAtUtc, dueTimeSet, repeat } = fields;

  const { data } = await api.post("/api/tasks", {
    title,
    documentId,
    description,
    priority,
    dueAtUtc,
    dueTimeSet,
    repeat,
  });
  return data;
}

/**
 * Patches a task. Only the keys present in `patch` are sent, and the server
 * leaves everything it is not given alone.
 *
 * To clear a due date, pass `{ clearDueAt: true }` — a null cannot mean both
 * "leave it" and "remove it", and leaving it is what a title-only patch means.
 */
export async function updateTask(id, patch) {
  const { data } = await api.patch(`/api/tasks/${id}`, patch);
  return data;
}

/**
 * Marks a task done (or reopens it with `completed: false`).
 *
 * Returns `{ task, next }`, where `next` is the successor occurrence the server
 * created for a repeating task, or null.
 */
export async function completeTask(id, completed = true) {
  const { data } = await api.post(`/api/tasks/${id}/complete`, { completed });
  return data;
}

/** Mirrors a snooze server-side; pass null to clear it. */
export async function snoozeTask(id, untilUtc) {
  const { data } = await api.post(`/api/tasks/${id}/snooze`, { untilUtc });
  return data;
}

export async function deleteTask(id) {
  await api.delete(`/api/tasks/${id}`);
}
