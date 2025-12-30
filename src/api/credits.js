import { api } from "./client";

export async function getCreditsBalance() {
    const { data } = await api.get("/api/credits/balance");
    return data; // { credits }
}
