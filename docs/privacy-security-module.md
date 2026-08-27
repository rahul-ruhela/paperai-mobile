# Privacy & Security Module

Status: **specification only — no code changed.**
Written: 2026-08-27.

Four features: Private Vault, Sensitive Document Detection, Privacy Score, Permission Center (specified separately in `device-permission-center.md`).

---

## 1. Security architecture

```
Face ID / Touch ID  ──►  expo-local-authentication      (identity gate, not a key)
                              │ success
                              ▼
Vault key           ──►  expo-secure-store (Keychain, WHEN_UNLOCKED_THIS_DEVICE_ONLY)
                              │ 256-bit random key, generated once per install
                              ▼
File encryption     ──►  AES-256-GCM over the file bytes
                              ▼
Storage             ──►  FileSystem.documentDirectory/vault/<uuid>.enc  (excluded from backup)
Index               ──►  vault-index.enc  (names, sizes, dates — itself encrypted)
```

Key points:

- **Biometry gates access, it does not derive the key.** Face ID returns a boolean; the key lives in the Keychain and is fetched only after a successful authentication. `expo-secure-store`'s `requireAuthentication` option ties the read to biometry at the OS level.
- **Device-only.** The Keychain item uses a `THIS_DEVICE_ONLY` accessibility class, so it never syncs to iCloud and never restores onto a different device. Losing the device means losing vault contents — stated plainly in the UI before the first file is added.
- **No server involvement.** Vault files are never uploaded, never analysed server-side, and are excluded from any export path.
- **Fallback.** If biometry is unavailable or the user has none enrolled, `expo-local-authentication` falls back to the device passcode. If neither exists, the vault refuses to open and says why — there is no app-level PIN, which would be weaker than the OS gate and another secret to leak.

Dependencies to add: `expo-local-authentication`, `expo-crypto`. Both need `app.json` plugin entries; Face ID needs `NSFaceIDUsageDescription`.

---

## 2. Private Vault

**Flow:** Vault tile → biometric prompt → unlocked list → view / add / remove / restore.

- **Add:** pick from documents or the photo library, encrypt to `vault/`, delete the plaintext copy the app created. The app cannot delete the user's original from Photos and must not imply that it did — the copy-and-encrypt semantics are shown before the first add.
- **View:** decrypt to a temporary file inside the app sandbox, render, delete the temp file on unmount and on background.
- **Auto-lock:** re-locks on background, and after 60 s in the foreground without interaction.
- **Screenshots:** not blocked (iOS gives no supported API for it); the vault warns that screenshots leave the vault.
- **Uninstall:** vault contents are unrecoverable by design; warned at setup.

---

## 3. Sensitive Document Detection

Classifies a document as `passport`, `bank_statement`, `medical_record`, `government_id`, or `none`, then *suggests* moving it to the vault.

**On-device first.** Classification runs against text the app already has (`extractedText` / analysis output) using a keyword-and-pattern rule set:

| Type | Signals |
|---|---|
| Passport | "passport", "MRZ", two-line machine-readable pattern, "date of expiry" + "nationality" |
| Bank statement | "account number", "IBAN", "sort code", "opening balance", "statement period" |
| Medical | "diagnosis", "prescription", "patient", "blood", lab-report units |
| Government ID | "licence"/"license number", "date of birth" + "issued by", national-ID keywords |

Rules:
- Detection never fires a network call of its own; it reads text that already exists locally.
- The result is advisory: a dismissible banner ("This looks like a passport — keep it in your Vault?"). Never auto-move, never auto-delete, never auto-hide.
- The detected type is stored locally only; it is not sent to the server and not logged.
- False positives are expected and cheap — the banner is always dismissible and never repeats for the same document once dismissed.

Tier: FREE detection banner; moving to the vault is FREE. An AI-assisted classification pass (better recall on scanned images) is PLUS and credit-bearing.

---

## 4. Privacy Score

A 0–100 local score with a one-line explanation per component. Nothing about it is uploaded.

| Component | Weight | Measured from |
|---|---|---|
| Sensitive documents secured | 35 | detected-sensitive count vs how many are in the vault |
| Biometric lock enabled | 20 | vault configured and biometry available |
| Permissions minimal | 20 | Permission Center state — every granted permission the app is not actively using costs points |
| Old documents cleared | 15 | documents older than 12 months still present |
| Notifications preview safety | 10 | "hide details on lock screen" enabled |

Presentation: a score ring with up to three concrete actions ("Move 2 sensitive documents to your Vault"). Each action deep-links to the fix. No scare copy, no red-alert styling — an advisory number, not a security verdict.

---

## 5. UI

```
PrivacyCenterScreen                (Settings → Privacy & Security)
├── PrivacyScoreCard               ring + top 3 actions
├── VaultCard                      locked/unlocked state, item count
├── SensitiveDocsCard              list of detected-but-unsecured documents
└── PermissionCenterSection        see device-permission-center.md
VaultScreen                        biometric gate → encrypted list → viewer
```

The existing `PrivacyScreen.js` is the privacy *policy* screen; it stays as-is and is linked from the footer here. The new screen is separate — merging a policy document with a control panel would confuse both.

---

## 6. Apple review considerations

1. **Face ID string.** `NSFaceIDUsageDescription` must state the actual use: "Face ID unlocks your Private Vault so only you can open the documents you store there."
2. **No misleading security claims.** No "military-grade", no "bank-level". Describe what is true: AES-256-GCM, key in the Keychain, device-only.
3. **Encryption export compliance.** The app currently declares `ITSAppUsesNonExemptEncryption: false`. Adding AES for local data protection generally still falls under the exemption for encryption limited to protecting the user's own data on device — but the declaration must be reviewed with this change and, if needed, filed with the appropriate exemption category rather than left unexamined.
4. **No permission coercion.** The app never blocks functionality to force a permission grant, and never claims it can change iOS settings itself.
5. **Data collection disclosure.** Vault contents and detection results are not collected; the privacy nutrition label must not gain entries because of this module. If the PLUS AI classification path ships, it does send document text — which is already disclosed for existing AI features.
6. **Guideline 2.5.1.** Only public APIs; no private entitlements; no attempt to read other apps' data.

---

## 7. Testing

1. Biometry enrolled → unlock; not enrolled → passcode fallback; neither → clear refusal message.
2. Failed authentication does not reveal file names, counts, or thumbnails.
3. Backgrounding while a decrypted temp file exists deletes it.
4. Encrypted file is unreadable as plaintext on disk; the index leaks no names.
5. App reinstall: vault directory gone, no crash, clean empty state.
6. Detection: one document of each type is flagged; a plain invoice is not; a dismissed banner stays dismissed.
7. Confirm no network request originates from the vault or detection paths (assert against a request spy).
8. Privacy score recomputes after each remediation action.
9. `npm test`, `npx tsc --noEmit` clean.
