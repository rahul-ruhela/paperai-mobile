import { api } from "./client";
import { setTokens, clearTokens, getRefreshToken } from "../storage/tokenStore";

// =========================
// EMAIL/PASSWORD
// =========================
export async function login(email, password) {
    const res = await api.post("/api/auth/login", { email, password });
    const { accessToken, refreshToken } = res.data;
    await setTokens(accessToken, refreshToken);
    return res.data;
}

export async function register(name, email, password, phone) {
    const res = await api.post("/api/auth/register", { name, email, password, phone });
    const { accessToken, refreshToken } = res.data;
    await setTokens(accessToken, refreshToken);
    return res.data;
}

export async function logout() {
    try {
        const refreshToken = await getRefreshToken();
        if (refreshToken) await api.post("/api/auth/logout", { refreshToken });
    } finally {
        await clearTokens();
    }
}

// Permanently deletes the signed-in account and all personal data
// (App Store requirement). Local tokens are cleared afterwards.
export async function deleteAccount() {
    try {
        await api.delete("/api/account");
    } finally {
        await clearTokens();
    }
}

// =========================
// EMAIL OTP
// =========================
export async function sendEmailOtp(email) {
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
// PHONE OTP (Twilio)
// =========================
export async function sendPhoneOtp(phone) {
    const res = await api.post("/api/auth/otp/send", { phone });
    return res.data;
}

export async function verifyPhoneOtp(phone, otp) {
    const res = await api.post("/api/auth/otp/verify", { phone, otp });
    const { accessToken, refreshToken } = res.data;
    await setTokens(accessToken, refreshToken);
    return res.data;
}

// =========================
// APPLE SIGN IN
// =========================
export async function appleLogin(identityToken, email, name) {
    const res = await api.post("/api/auth/apple", {
        identityToken,
        email: email ?? null,
        name: name ?? null,
    });
    const { accessToken, refreshToken } = res.data;
    await setTokens(accessToken, refreshToken);
    return res.data;
}

// Aliases
export const SendEmailOtp = sendEmailOtp;
export const VerifyEmailOtp = verifyEmailOtp;
export const SendPhoneOtp = sendPhoneOtp;
export const VerifyPhoneOtp = verifyPhoneOtp;
