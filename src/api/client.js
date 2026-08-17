import axios from "axios";
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "../storage/tokenStore";
import { API } from "../constants/api";

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------
export const api = axios.create({
    baseURL: API.BASE_URL,
    timeout: 30000, // 30 s — enough for all endpoints; AI processing is async on the backend
});

// ---------------------------------------------------------------------------
// Request interceptor — attach JWT
// ---------------------------------------------------------------------------
api.interceptors.request.use(async (config) => {
    const token = await getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ---------------------------------------------------------------------------
// Auth-endpoint detection — 401 on these paths means bad credentials,
// not an expired session, so the refresh interceptor must skip them.
// ---------------------------------------------------------------------------
const AUTH_PATHS = ["/api/auth/login", "/api/auth/apple", "/api/auth/register",
    "/api/auth/otp/verify", "/api/auth/email-otp/verify", "/api/auth/refresh"];

function isAuthEndpoint(url = "") {
    return AUTH_PATHS.some((p) => url.includes(p));
}

// ---------------------------------------------------------------------------
// Friendly user messages per HTTP status
// ---------------------------------------------------------------------------
function friendlyMessage(err) {
    const status = err?.response?.status;
    const serverMsg =
        typeof err?.response?.data === "string"
            ? err.response.data
            : err?.response?.data?.message ?? err?.response?.data?.reason ?? err?.response?.data?.error ?? null;

    if (!status) return "No connection. Please check your internet and try again.";

    if (status === 400) return serverMsg || "Invalid request. Please check your input.";
    if (status === 401) {
        // On auth endpoints a 401 means bad credentials, not an expired session.
        const url = err?.config?.url ?? "";
        if (isAuthEndpoint(url)) return serverMsg || "Sign in failed. Please try again.";
        return "Session expired. Please log in again.";
    }
    if (status === 403) return "You don't have permission to do this.";
    if (status === 404) return "The requested resource was not found.";
    if (status === 409) return serverMsg || "A conflict occurred. Please refresh and try again.";
    if (status === 422) return serverMsg || "Validation failed. Please check your input.";
    if (status === 429) return "Too many requests. Please wait a moment and try again.";
    if (status >= 500) return "Our servers are having issues. Please try again in a moment.";

    return serverMsg || "Something went wrong. Please try again.";
}

// ---------------------------------------------------------------------------
// Response interceptor — silent token refresh + friendly error messages
// ---------------------------------------------------------------------------
let isRefreshing = false;
let pending = [];

function resolvePending(error, token = null) {
    pending.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
    pending = [];
}

// ---------------------------------------------------------------------------
// authedFetch — for multipart uploads that must use the native `fetch` API
// (FormData file bodies) instead of axios. Mirrors the axios interceptor's
// silent token-refresh: attaches the access token, and on a 401 refreshes once
// and retries. Without this, uploads fail with 401 the moment the 30-minute
// access token expires, even though every axios call keeps working.
// Returns the raw Response so callers parse the body themselves.
// ---------------------------------------------------------------------------
export async function authedFetch(path, options = {}) {
    const url = path.startsWith("http") ? path : `${API.BASE_URL}${path}`;

    const doFetch = async (token) => {
        const headers = { ...(options.headers || {}) };
        if (token) headers.Authorization = `Bearer ${token}`;
        return fetch(url, { ...options, headers });
    };

    let token = await getAccessToken();
    let res = await doFetch(token);

    if (res.status !== 401) return res;

    // Access token likely expired — refresh once and retry.
    try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) throw new Error("no_refresh_token");

        const resp = await axios.post(`${API.BASE_URL}/api/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefresh } = resp.data;
        await setTokens(accessToken, newRefresh);

        res = await doFetch(accessToken);
    } catch (refreshErr) {
        await clearTokens();
        const e = new Error("Session expired. Please log in again.");
        e.userMessage = "Session expired. Please log in again.";
        throw e;
    }

    return res;
}

api.interceptors.response.use(
    (res) => res,
    async (err) => {
        const original = err.config;

        // Token refresh on first 401, but only for protected API calls —
        // never for auth endpoints (login/apple/register etc.) because those
        // don't use session tokens and a 401 there means bad credentials.
        if (
            err.response?.status === 401 &&
            !original._retry &&
            !isAuthEndpoint(original.url)
        ) {
            original._retry = true;

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    pending.push({
                        resolve: (token) => {
                            original.headers.Authorization = `Bearer ${token}`;
                            resolve(api(original));
                        },
                        reject,
                    });
                });
            }

            isRefreshing = true;
            try {
                const refreshToken = await getRefreshToken();
                if (!refreshToken) throw new Error("no_refresh_token");

                const resp = await axios.post(`${API.BASE_URL}/api/auth/refresh`, { refreshToken });
                const { accessToken, refreshToken: newRefresh } = resp.data;

                await setTokens(accessToken, newRefresh);
                resolvePending(null, accessToken);

                original.headers.Authorization = `Bearer ${accessToken}`;
                return api(original);
            } catch (refreshErr) {
                resolvePending(refreshErr, null);
                await clearTokens();
                refreshErr.userMessage = "Session expired. Please log in again.";
                return Promise.reject(refreshErr);
            } finally {
                isRefreshing = false;
            }
        }

        // Attach a friendly message to every error so screens can use err.userMessage
        err.userMessage = friendlyMessage(err);
        return Promise.reject(err);
    }
);
