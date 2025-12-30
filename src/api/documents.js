import { api } from "./client";
import * as FileSystem from "expo-file-system";

export async function listDocuments() {
  const { data } = await api.get("/api/documents");
  return data;
}

export async function uploadDocument(fileUri, filename, mimeType) {
  // Your backend expects multipart/form-data with "file" field :contentReference[oaicite:14]{index=14}
  const url = `${api.defaults.baseURL}/api/documents/upload`;

  const res = await FileSystem.uploadAsync(url, fileUri, {
    fieldName: "file",
    httpMethod: "POST",
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    headers: {
      // Authorization is NOT automatically attached by uploadAsync
      // so we must set it manually in the screen (we’ll do that)
    },
    parameters: {},
  });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Upload failed: ${res.status} ${res.body}`);
  }

  return JSON.parse(res.body);
}

export async function processDocument(id) {
  const { data } = await api.post(`/api/documents/${id}/process`);
  return data;
}
