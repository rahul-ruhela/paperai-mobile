# Privacy & Security Module

Status: **implemented** (roadmap Module 5), 2026-08-28. One layer is deferred and
four decisions depart from the sketch below — see §8.
Written: 2026-08-27. Last synced to the repository: 2026-08-28.

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

**Dependencies as built:** `expo-local-authentication`, `expo-crypto` and
**`@noble/ciphers`**. The third was not in this sketch and is not optional:
`expo-crypto` provides random bytes and digests but **no symmetric cipher**, so
there is nothing in the Expo SDK to perform the AES-256-GCM this design calls
for. `@noble/ciphers` is audited, pure JS, and authenticated — a tampered file
fails to decrypt rather than decrypting to garbage.

Both Expo packages have `app.json` plugin entries, and `NSFaceIDUsageDescription`
is set to the actual use rather than a category.

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

---

## 8. Implementation record

Written during implementation, 2026-08-28.

### 8.1 What shipped

| Piece | File |
|---|---|
| Key + cipher | `src/services/vaultCrypto.js` |
| Vault files + encrypted index | `src/services/vaultStore.js` |
| Classifier (pure) | `src/services/sensitiveDetection.js` |
| Local detection store | `src/services/sensitiveStore.js` |
| Score (pure) | `src/services/privacyScore.js` |
| Bytes ↔ base64, shared | `src/services/base64.js` |
| Vault UI | `src/screens/VaultScreen.js` |
| Control panel | `src/screens/PrivacyCenterScreen.js` |

Entry point: **Settings → Privacy & Security**. Detection is hooked into
`AnalysisScreen`, because that is where the app already holds a document's text —
no extra fetch, and the classifier is regex over a string already in memory.

60 tests across `sensitiveDetection`, `privacyScore`, `vaultCrypto` and
`vaultStore`, including one that spies on `fetch` to assert the vault paths reach
nothing at all.

### 8.2 Four departures from the sketch above

**The Vault card shows existence, not an item count.** §5 asked for "locked/
unlocked state, item count"; §7.2 says a failed authentication must not reveal
counts. The second rule wins — and the first is unimplementable anyway, because
the index is encrypted along with everything else, so there is no count to read
without the key.

**The notification-preview component is not scored.** iOS gives an app no way to
read whether lock screen previews are hidden. Rather than guess or ask the user
to self-report, the component reports that it cannot be measured and scores full
marks. Its 10 points are therefore never lost — better than a permanent
deduction nobody can clear.

**A 25 MB per-file limit.** AES-GCM here is pure JavaScript on the JS thread, so
encryption time is linear in file size; past roughly this point a save stops
feeling like a save and starts feeling like a hang. The limit is stated to the
user when they hit it, with the reason.

**The PLUS AI-assisted classification pass is deferred.** §3 offers a
credit-bearing pass with better recall on scanned images. It needs a server route,
and roadmap §7 records Module 5 as local-only by design with no API changes. No
matrix key was added for it, so nothing advertises a feature that does not exist.
The on-device rule set — which is the whole of §3's requirement — is complete.

### 8.3 App Review compliance record

**5.1.1 — Face ID string.** `NSFaceIDUsageDescription` names the actual use:
"Face ID unlocks your Private Vault, so only you can open the documents you keep
there. Paper AI never sends your Vault or your face data anywhere."

**No misleading security claims (§6.2).** The UI says AES-256-GCM, key in the iOS
Keychain, this device only. Never "military-grade", never "bank-level". The
privacy score is likewise advisory: `scoreBand` has a test asserting no band
label ever reads "at risk", "critical", "vulnerable" or "exposed", because a
heuristic over five measurable things does not get to tell someone they are in
danger.

**Losing the device loses the vault**, said at setup — before the first file is
added, not after. The Keychain item is `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, so it
never syncs to iCloud and never restores elsewhere. That is the intended
trade-off, and it has a real cost the user is entitled to know about in advance.

**Adding encrypts a copy.** The app cannot delete a photo from the user's library
and must not imply that it did. Said before the first add, and asserted by a test
that the original file is never deleted.

**Screenshots are not blocked**, because iOS has no supported API for it. The
image preview says so rather than implying protection the vault does not have.

**No permission coercion (§6.4).** A device with no passcode or biometrics gets a
plain refusal explaining why, and an explicit statement that Paper AI will not
offer its own PIN instead — it would be weaker than the OS lock and one more
secret to lose. The app never claims it can change an iOS setting itself.

**Data collection (§6.5).** Vault contents, detection results and the score are
device-local. The privacy nutrition label gains no entries. `vaultStore` makes no
network call on any path, and there is a test that fails if one appears.

**2.5.1.** Public APIs only — `expo-secure-store`, `expo-local-authentication`,
`expo-file-system`. No private entitlements, no attempt to read another app's
data.

### 8.4 Open — needs a human decision

**Encryption export compliance (§6.3).** `app.json` still declares
`ITSAppUsesNonExemptEncryption: false`, unchanged by this module. The assessment
behind leaving it alone: the AES added here is used solely to protect the user's
own data on their own device, which is the ordinary exemption, and no encryption
is offered as a feature of the app to third parties.

That reasoning is sound but it is a **declaration filed by the developer, not a
code change**, and it should be confirmed against the current App Store Connect
export-compliance questions before the next submission rather than inherited from
the previous build by default. Flagging rather than deciding.
