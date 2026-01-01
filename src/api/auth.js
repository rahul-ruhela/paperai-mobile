import { api } from "./client";
import { setTokens, clearTokens, getRefreshToken } from "../storage/tokenStore";

// =========================
// EMAIL/PASSWORD (EXISTING)
// =========================
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

// =========================
// EMAIL OTP (NEW)
// =========================
export async function sendEmailOtp(email) {
    // Your backend routes are under /api/auth/... (consistent with login/register)
    const res = await api.post("/api/auth/email-otp/send", { email });
    return res.data;
}
export async function verifyEmailOtp(payload) {
    const res = await api.post("/api/auth/email-otp/verify", payload);

    const { accessToken, refreshToken } = res.data;
    await setTokens(accessToken, refreshToken);

    return res.data;
}

// =========================
// PHONE OTP (NEW)
// =========================
export async function sendPhoneOtp(phone) {
    const res = await api.post("/api/auth/otp/send", { phone });
    return res.data;
}

export async function verifyPhoneOtp(phone, otp) {
    const res = await api.post("/api/auth/otp/verify", { phone, otp });

    // Backend returns tokens on verify
    const { accessToken, refreshToken } = res.data;
    await setTokens(accessToken, refreshToken);

    return res.data;
}

// Optional compatibility aliases (in case any screen uses PascalCase)
export const SendEmailOtp = sendEmailOtp;
export const VerifyEmailOtp = verifyEmailOtp;
export const SendPhoneOtp = sendPhoneOtp;
export const VerifyPhoneOtp = verifyPhoneOtp;
