/**
 * vaultStore — the Private Vault's files and index (Module 5, §2).
 *
 * Layout under FileSystem.documentDirectory:
 *
 *   vault/<uuid>.enc      one encrypted file per item
 *   vault/index.enc       the encrypted index: names, sizes, dates, source ids
 *
 * The index is encrypted too, and that is the point of it being a separate file
 * rather than a plain manifest. A vault whose contents are ciphertext but whose
 * listing says "passport.pdf, 2.1 MB" has published the thing worth hiding. A
 * failed unlock must not reveal names, counts or thumbnails — spec §7.2 — and it
 * cannot, because without the key there is nothing here but noise.
 *
 * What this module will not do:
 *   • Upload anything. There is no network call in this file, by design.
 *   • Delete the user's original. Adding a photo to the vault encrypts a COPY;
 *     the original stays in Photos, and the UI says so before the first add
 *     rather than letting the user infer that it was moved.
 *   • Leave plaintext behind. Viewing decrypts to a temp file inside the app
 *     sandbox, and every caller is expected to release it — see releaseTempFile
 *     and the screen's background handler.
 */

import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";

import { base64ToBytes, bytesToBase64, bytesToUtf8, utf8ToBytes } from "./base64";
import { decryptFromBase64, encryptToBase64 } from "./vaultCrypto";

const DIR = `${FileSystem.documentDirectory}vault/`;
const INDEX = `${DIR}index.enc`;
const TEMP_DIR = `${FileSystem.cacheDirectory}vault-open/`;

/**
 * Largest file the vault accepts.
 *
 * AES-GCM here is pure JavaScript, so encryption is linear in file size and runs
 * on the JS thread. 25 MB is about the point where the wait stops feeling like a
 * save and starts feeling like a hang. The limit is stated to the user rather
 * than enforced silently, because "nothing happened" is the worst outcome.
 */
export const MAX_ITEM_BYTES = 25 * 1024 * 1024;

async function ensureDir(path) {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) await FileSystem.makeDirectoryAsync(path, { intermediates: true });
}

/**
 * Reads and decrypts the index. An unreadable index is an empty vault as far as
 * the caller is concerned, but the FILES ARE NOT TOUCHED — a corrupt index must
 * never cascade into deleting the things it indexes.
 */
export async function readIndex(key) {
    try {
        const info = await FileSystem.getInfoAsync(INDEX);
        if (!info.exists) return [];
        const b64 = await FileSystem.readAsStringAsync(INDEX, {
            encoding: FileSystem.EncodingType.Base64,
        });
        const parsed = JSON.parse(bytesToUtf8(decryptFromBase64(key, b64)));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeIndex(key, entries) {
    await ensureDir(DIR);
    const b64 = encryptToBase64(key, utf8ToBytes(JSON.stringify(entries)));
    await FileSystem.writeAsStringAsync(INDEX, b64, {
        encoding: FileSystem.EncodingType.Base64,
    });
}

/**
 * Encrypts `uri` into the vault and returns the new entry.
 *
 * `sourceId` links the item back to the document it came from, so the sensitive
 * document banner can stop suggesting something already secured. It is stored
 * inside the encrypted index like everything else.
 */
export async function addItem(key, { uri, name, mimeType, sourceId }) {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (!info.exists) throw new Error("MISSING_FILE");
    if ((info.size ?? 0) > MAX_ITEM_BYTES) {
        const err = new Error("TOO_LARGE");
        err.code = "TOO_LARGE";
        err.limit = MAX_ITEM_BYTES;
        throw err;
    }

    await ensureDir(DIR);

    const plaintextB64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
    });
    const id = Crypto.randomUUID();
    await FileSystem.writeAsStringAsync(
        `${DIR}${id}.enc`,
        encryptToBase64(key, base64ToBytes(plaintextB64)),
        { encoding: FileSystem.EncodingType.Base64 }
    );

    const entry = {
        id,
        name: name || "Untitled",
        mimeType: mimeType || "application/octet-stream",
        size: info.size ?? 0,
        addedAt: new Date().toISOString(),
        sourceId: sourceId ?? null,
    };

    await writeIndex(key, [entry, ...(await readIndex(key))]);
    return entry;
}

/**
 * Decrypts one item to a temporary file in the app's cache and returns its uri.
 *
 * The caller MUST release it — on unmount and on backgrounding. A decrypted copy
 * sitting in the cache is exactly the thing the vault exists to prevent, and the
 * cache is not covered by the Keychain gate.
 */
export async function openItem(key, id) {
    const entry = (await readIndex(key)).find((e) => e.id === id);
    if (!entry) throw new Error("NOT_FOUND");

    await ensureDir(TEMP_DIR);
    const b64 = await FileSystem.readAsStringAsync(`${DIR}${id}.enc`, {
        encoding: FileSystem.EncodingType.Base64,
    });
    // Decrypt fails loudly on a tampered file rather than yielding garbage —
    // GCM authenticates. Let it throw; a silent empty preview would be worse.
    const plaintext = decryptFromBase64(key, b64);

    const temp = `${TEMP_DIR}${id}-${entry.name}`;
    await FileSystem.writeAsStringAsync(temp, bytesToBase64(plaintext), {
        encoding: FileSystem.EncodingType.Base64,
    });
    return { uri: temp, entry };
}

/** Deletes one decrypted temp file. Safe to call twice. */
export async function releaseTempFile(uri) {
    if (!uri) return;
    try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
        // Already gone.
    }
}

/**
 * Deletes every decrypted temp file. Called on background and on lock, so a
 * vault that re-locks leaves nothing readable behind.
 */
export async function releaseAllTempFiles() {
    try {
        await FileSystem.deleteAsync(TEMP_DIR, { idempotent: true });
    } catch {
        // Nothing to clear.
    }
}

/** Removes an item from the vault permanently. */
export async function removeItem(key, id) {
    const entries = await readIndex(key);
    const next = entries.filter((e) => e.id !== id);
    try {
        await FileSystem.deleteAsync(`${DIR}${id}.enc`, { idempotent: true });
    } catch {
        // The index entry still goes, so a file that cannot be deleted does not
        // strand a row the user can no longer open.
    }
    await writeIndex(key, next);
    return next;
}

/**
 * Destroys the entire vault directory. Paired with destroyVaultKey — the caller
 * does both, behind a confirmation that says the contents cannot be recovered.
 */
export async function destroyVault() {
    await releaseAllTempFiles();
    try {
        await FileSystem.deleteAsync(DIR, { idempotent: true });
    } catch {
        // Nothing to destroy.
    }
}

/**
 * Whether a vault directory exists, without the key.
 *
 * Used only to decide between "set up your vault" and "unlock your vault" on the
 * locked screen. It reveals that a vault exists — which the Settings row already
 * implies — and nothing whatsoever about what is in it.
 */
export async function vaultExists() {
    try {
        return (await FileSystem.getInfoAsync(INDEX)).exists;
    } catch {
        return false;
    }
}

export const VAULT_PATHS = { DIR, INDEX, TEMP_DIR };
