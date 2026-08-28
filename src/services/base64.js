/**
 * base64 — bytes ↔ base64, the boundary every binary path in this app crosses.
 *
 * `expo-file-system` reads and writes binary as base64 strings, so anything that
 * works on raw bytes — the cleaner's image sampler, the vault's cipher — has to
 * convert at both ends. Doing it in one place means one implementation to be
 * sure of rather than one per caller.
 *
 * RN 0.74+ and Hermes expose atob/btoa globally. Both are guarded rather than
 * assumed: without them the failure is a thrown ReferenceError somewhere deep
 * inside a scan or a decrypt, which is a far worse way to find out.
 */

const CHUNK = 0x8000; // 32k — beyond this, String.fromCharCode.apply blows the stack

export function base64ToBytes(b64) {
    if (typeof atob !== "function" || typeof b64 !== "string") return null;
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

export function bytesToBase64(bytes) {
    if (typeof btoa !== "function" || !bytes) return null;
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}

const encoder = typeof TextEncoder === "function" ? new TextEncoder() : null;
const decoder = typeof TextDecoder === "function" ? new TextDecoder() : null;

export function utf8ToBytes(text) {
    if (encoder) return encoder.encode(text);
    // Hermes has TextEncoder, but a fallback beats a crash on a stripped runtime.
    const escaped = unescape(encodeURIComponent(text));
    const bytes = new Uint8Array(escaped.length);
    for (let i = 0; i < escaped.length; i++) bytes[i] = escaped.charCodeAt(i);
    return bytes;
}

export function bytesToUtf8(bytes) {
    if (decoder) return decoder.decode(bytes);
    let binary = "";
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return decodeURIComponent(escape(binary));
}
