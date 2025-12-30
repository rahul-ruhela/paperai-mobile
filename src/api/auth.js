import { api } from "./client";
import { setTokens, clearTokens, getRefreshToken } from "../storage/tokenStore";

export async function login(email, password) {
    const res = await api.post("/api/auth/login", { email, password });

    const { accessToken, refreshToken } = res.data;

    await setTokens(accessToken, refreshToken);

    return res.data;
}

export async function register(name, email, password, phone) {
    const res = await api.post("/api/auth/register", {
        name,
        email,
        password,
        phone,
    });

    const { accessToken, refreshToken } = res.data;

    await setTokens(accessToken, refreshToken);

    return res.data;
}

export async function logout() {
    try {
        const refreshToken = await getRefreshToken();
        if (refreshToken) {
            await api.post("/api/auth/logout", { refreshToken });
        }
    } finally {
        await clearTokens();
    }
}
