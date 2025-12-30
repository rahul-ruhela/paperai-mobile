import { api } from "./client";

export async function listTasks() {
  const { data } = await api.get("/api/tasks");
  return data;
}

export async function createTask(title, documentId = null) {
  const { data } = await api.post("/api/tasks", { title, documentId });
  return data;
}

export async function updateTask(id, patch) {
  const { data } = await api.patch(`/api/tasks/${id}`, patch);
  return data;
}
export async function deleteTask(id) {
  await api.delete(`/api/tasks/${id}`);
}