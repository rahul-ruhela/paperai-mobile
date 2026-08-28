/**
 * vaultCrypto — the Private Vault's key and cipher (Module 5, §1).
 *
 * The architecture, and why each piece is what it is:
 *
 *   Biometry GATES access; it does not derive the key. Face ID returns a
 *   boolean, and a boolean is not a secret — an app that "unlocks" by branching
 *   on one is protected only until someone reads the file off disk. The key is a
 *   256-bit random value in the iOS Keychain, and expo-secure-store's
 *   `requireAuthentication` ties reading it to biometry at the OS level, so the
 *   gate is enforced by the Secure Enclave rather than by this JavaScript.
 *
 *   The Keychain item is WHEN_UNLOCKED_THIS_DEVICE_ONLY. It never syncs to
 *   iCloud and never restores onto another device. That is the intended
 *   trade-off and it has a real cost: losing the device loses the vault. The UI
 *   says so before the first file is added, because a user who finds this out
 *   afterwards has lost documents on our advice.
 *
 *   AES-256-GCM from @noble/ciphers — audited, pure JS, and authenticated, so a
 *   tampered file fails to decrypt rather than decrypting to garbage. A fresh
 *   96-bit nonce per encryption, from the OS CSPRNG. Nonces are never reused,
 *   which for GCM is not a detail but the whole security argument.
 *
 * No key, plaintext or vault byte ever reaches the network. There is no server
 * side to this module at all.
 *
 * On honesty in the UI: describe this as AES-256-GCM with the key in the
 * Keychain, device-only. Never "military-grade" or "bank-level" — spec §6.2, and
 * they are marketing words that mean nothing.
 */

import { gcm } from "@noble/ciphers/aes.js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

import { base64ToBytes, bytesToBase64 } from "./base64";

const KEY_ID = "paperai.vault.key.v1";
const KEY_BYTES = 32; // AES-256
const NONCE_BYTES = 12; // 96 bits, the GCM standard nonce size

/** Prompt shown by the OS when the Keychain read requires authentication. */
const AUTH_PROMPT = "Unlock your Private Vault";

/**
 * Options for the Keychain item.
 *
 * `requireAuthentication` is what actually makes the vault a vault. It is set on
 * write and must match on read, so it is defined once here rather than spelled
 * out at each call site where the two could drift apart.
 */
const KEY_OPTIONS = {
    requireAuthentication: true,
    authenticationPrompt: AUTH_PROMPT,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * True when this device can store a key behind biometrics at all.
 *
 * Checked before setup rather than discovered at the first save: a device with
 * no passcode cannot hold a `requireAuthentication` item, and the honest
 * response is to refuse to create a vault and say why — not to quietly fall back
 * to an unauthenticated item that looks identical in the UI.
 */
export function canSecureVault() {
    try {
        // Synchronous in expo-secure-store — it reads a cached capability, not
        // the sensor.
        return SecureStore.canUseBiometricAuthentication();
    } catch {
        return false;
    }
}

/** True when a vault key already exists on this device. */
export async function hasVaultKey() {
    try {
        // Read without the auth prompt: this asks whether the item exists, and
        // making the user authenticate to be told "you have no vault" would be
        // both pointless and confusing.
        const stored = await SecureStore.getItemAsync(KEY_ID, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
        return stored != null;
    } catch {
        // A key that exists but requires authentication throws here rather than
        // returning null on some platforms. Treat that as "exists": claiming no
        // vault when one is present would offer to create a second and orphan
        // everything already in the first.
        return true;
    }
}

/**
 * Creates the vault key. Fails loudly rather than falling back to a weaker item.
 * Returns the key bytes so setup can proceed without a second authentication.
 */
export async function createVaultKey() {
    if (!canSecureVault()) {
        throw new Error("NO_BIOMETRY");
    }
    const key = Crypto.getRandomBytes(KEY_BYTES);
    await SecureStore.setItemAsync(KEY_ID, bytesToBase64(key), KEY_OPTIONS);
    return key;
}

/**
 * Fetches the vault key, prompting for biometry or the device passcode.
 *
 * Throws `LOCKED` when the user cancelled or failed authentication, and
 * `NO_VAULT` when there is nothing to unlock. Callers distinguish the two
 * because they are different sentences to a user: one is "try again", the other
 * is "set up your vault".
 */
export async function unlockVaultKey() {
    let stored;
    try {
        stored = await SecureStore.getItemAsync(KEY_ID, KEY_OPTIONS);
    } catch {
        // Cancelled, failed, or too many attempts — all of which arrive here as
        // an exception and none of which should say more than "not unlocked".
        const err = new Error("LOCKED");
        err.code = "LOCKED";
        throw err;
    }
    if (!stored) {
        const err = new Error("NO_VAULT");
        err.code = "NO_VAULT";
        throw err;
    }
    return base64ToBytes(stored);
}

/**
 * Destroys the vault key. Everything encrypted with it becomes unrecoverable, so
 * this is only ever called behind an explicit confirmation that says exactly
 * that.
 */
export async function destroyVaultKey() {
    try {
        await SecureStore.deleteItemAsync(KEY_ID, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
    } catch {
        // Already gone.
    }
}

/**
 * Encrypts bytes under `key`. The nonce is fresh per call and is prefixed to the
 * ciphertext, so a stored blob carries everything needed to decrypt it except
 * the key itself.
 *
 * Layout: [12-byte nonce][ciphertext || 16-byte GCM tag]
 */
export function encryptBytes(key, plaintext) {
    const nonce = Crypto.getRandomBytes(NONCE_BYTES);
    const sealed = gcm(key, nonce).encrypt(plaintext);
    const out = new Uint8Array(nonce.length + sealed.length);
    out.set(nonce, 0);
    out.set(sealed, nonce.length);
    return out;
}

/**
 * Decrypts a blob produced by encryptBytes.
 *
 * Throws on a wrong key or a tampered file — GCM authenticates, so this is a
 * real integrity check and not merely a decode. Callers must not treat a failure
 * as an empty file.
 */
export function decryptBytes(key, blob) {
    if (!blob || blob.length <= NONCE_BYTES) throw new Error("CORRUPT");
    const nonce = blob.subarray(0, NONCE_BYTES);
    const sealed = blob.subarray(NONCE_BYTES);
    return gcm(key, nonce).decrypt(sealed);
}

/** Convenience wrappers for the base64 form the filesystem reads and writes. */
export function encryptToBase64(key, plaintext) {
    return bytesToBase64(encryptBytes(key, plaintext));
}

export function decryptFromBase64(key, b64) {
    return decryptBytes(key, base64ToBytes(b64));
}

export const VAULT_CRYPTO_INFO = {
    cipher: "AES-256-GCM",
    keyStorage: "iOS Keychain, this device only",
    nonceBits: NONCE_BYTES * 8,
    keyBits: KEY_BYTES * 8,
};
