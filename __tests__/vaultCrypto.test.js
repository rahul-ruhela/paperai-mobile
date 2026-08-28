// Module 5 §1. The vault's security argument is that a file on disk is
// unreadable without a key held behind the OS biometric gate. These tests cover
// the half of that claim which is testable in JS: that the cipher round-trips,
// that a fresh nonce is used every time, and that tampering is detected rather
// than silently decrypted into garbage.

jest.mock("expo-crypto", () => {
    let counter = 0;
    return {
        // Deterministic but never repeating, so nonce-reuse is observable.
        getRandomBytes: jest.fn((n) => {
            counter += 1;
            return Uint8Array.from({ length: n }, (_, i) => (i + counter) % 256);
        }),
        randomUUID: jest.fn(() => `uuid-${++counter}`),
    };
});

jest.mock("expo-secure-store", () => ({
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: "whenUnlockedThisDeviceOnly",
    canUseBiometricAuthentication: jest.fn(() => true),
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

const SecureStore = require("expo-secure-store");
const {
    VAULT_CRYPTO_INFO,
    createVaultKey,
    decryptBytes,
    encryptBytes,
    hasVaultKey,
    unlockVaultKey,
} = require("../src/services/vaultCrypto");
const { utf8ToBytes, bytesToUtf8 } = require("../src/services/base64");

const KEY = new Uint8Array(32).fill(7);
const OTHER_KEY = new Uint8Array(32).fill(9);

beforeEach(() => jest.clearAllMocks());

describe("cipher", () => {
    it("round-trips content", () => {
        const plain = utf8ToBytes("passport number 123456789");
        expect(bytesToUtf8(decryptBytes(KEY, encryptBytes(KEY, plain)))).toBe(
            "passport number 123456789"
        );
    });

    it("leaves no plaintext in the blob", () => {
        const blob = encryptBytes(KEY, utf8ToBytes("SMITH JOHN"));
        expect(bytesToUtf8(blob)).not.toMatch(/SMITH/);
    });

    it("uses a fresh nonce every time, so the same file encrypts differently", () => {
        // For GCM this is not a nicety. A repeated nonce under the same key
        // breaks the construction outright.
        const plain = utf8ToBytes("same content");
        const a = encryptBytes(KEY, plain);
        const b = encryptBytes(KEY, plain);
        expect(Array.from(a.subarray(0, 12))).not.toEqual(Array.from(b.subarray(0, 12)));
        expect(Array.from(a)).not.toEqual(Array.from(b));
    });

    it("refuses the wrong key rather than returning garbage", () => {
        const blob = encryptBytes(KEY, utf8ToBytes("secret"));
        expect(() => decryptBytes(OTHER_KEY, blob)).toThrow();
    });

    it("detects a tampered file", () => {
        // GCM authenticates, so this is an integrity check and not just a
        // decode. A caller must never treat the failure as an empty file.
        const blob = encryptBytes(KEY, utf8ToBytes("balance 1204.55"));
        blob[blob.length - 1] ^= 0xff;
        expect(() => decryptBytes(KEY, blob)).toThrow();
    });

    it("rejects a blob too short to contain a nonce", () => {
        expect(() => decryptBytes(KEY, new Uint8Array(4))).toThrow("CORRUPT");
    });
});

describe("key storage", () => {
    it("stores a 256-bit key behind biometrics, device-only", () => {
        return createVaultKey().then(() => {
            const [, , options] = SecureStore.setItemAsync.mock.calls[0];
            expect(options.requireAuthentication).toBe(true);
            expect(options.keychainAccessible).toBe("whenUnlockedThisDeviceOnly");
            expect(VAULT_CRYPTO_INFO.keyBits).toBe(256);
        });
    });

    it("refuses to create a vault on a device that cannot secure one", async () => {
        // Falling back to an unauthenticated Keychain item would look identical
        // in the UI while being a different product.
        SecureStore.canUseBiometricAuthentication.mockReturnValueOnce(false);
        await expect(createVaultKey()).rejects.toThrow("NO_BIOMETRY");
        expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
    });

    it("prompts for authentication when unlocking", async () => {
        SecureStore.getItemAsync.mockResolvedValueOnce(Buffer.from(KEY).toString("base64"));
        await unlockVaultKey();
        const [, options] = SecureStore.getItemAsync.mock.calls[0];
        expect(options.requireAuthentication).toBe(true);
        expect(options.authenticationPrompt).toBeTruthy();
    });

    it("reports a cancelled or failed unlock as LOCKED, not as an empty vault", async () => {
        SecureStore.getItemAsync.mockRejectedValueOnce(new Error("User canceled"));
        await expect(unlockVaultKey()).rejects.toMatchObject({ code: "LOCKED" });
    });

    it("distinguishes 'no vault yet' from 'locked'", async () => {
        // Different sentences to a user: one is "try again", the other is
        // "set up your vault".
        SecureStore.getItemAsync.mockResolvedValueOnce(null);
        await expect(unlockVaultKey()).rejects.toMatchObject({ code: "NO_VAULT" });
    });

    it("does not make the user authenticate merely to ask whether a vault exists", async () => {
        SecureStore.getItemAsync.mockResolvedValueOnce("stored");
        await hasVaultKey();
        const [, options] = SecureStore.getItemAsync.mock.calls[0];
        expect(options.requireAuthentication).toBeUndefined();
    });

    it("treats a key it cannot read as present, never as absent", async () => {
        // Claiming no vault when one exists would offer to create a second and
        // orphan everything already in the first.
        SecureStore.getItemAsync.mockRejectedValueOnce(new Error("requires auth"));
        expect(await hasVaultKey()).toBe(true);
    });
});
