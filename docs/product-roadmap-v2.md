# Paper AI Assistant — Product Roadmap v2

Status: **in progress — Modules 0–6 shipped; Module 7 is next.**
Written: 2026-08-27. Last synced to the repository: 2026-08-28. Branch: `chore/release-hardening`.
Basis: the mobile repo (`paperai-mobile`) + API repo (`PaperAiApis`).

This file is kept in step with the code. Section 1 describes the architecture as
originally surveyed; sections 3–8 carry a **Status** column that is updated as
each module lands. A module is "shipped" when its code is merged, its spec file
says *implemented*, and `npm test` / `dotnet build` pass — **not** when it is
deployed. See §11 for what is live in production.

---

## 1. Current architecture summary

### Mobile (React Native, Expo SDK 54, React 19, RN 0.81.5)

| Layer | Location | Notes |
|---|---|---|
| Entry / navigation | `App.js` (436 lines) | `ThemeProvider` → `AppShell` → `NavigationContainer` → native stack. Auth state decides which stack renders. |
| Tabs | `App.js` → `Tabs()` | 4 tabs: **Documents** (`HomeScreen`), **Upload**, **Assistant** (`AssistantScreen`; route name is still `Tasks`), **Settings**. |
| Stack screens | `App.js` | Process, Document, Analysis, Paywall, Profile, Analytics, Privacy, Terms, HelpCenter, ContactSupport, JunkWiper, CameraScanner, CodeScanner, Signature, AiChat, ReceiptCapture, Expenses. |
| Screens | `src/screens/` (26 files) | Largest: `JunkWiperScanScreen.js` (1641), `HomeScreen.js` (722), `SettingsScreen.js` (661). `TasksScreen.js` was replaced by `AssistantScreen.js` in Module 3. |
| HTTP | `src/api/client.js` | One axios instance + `authedFetch` for multipart. Request interceptor attaches the JWT; response interceptor does single-flight refresh on 401 and attaches `err.userMessage`. |
| API modules | `src/api/` | auth, billing, chat, client, credits, dev, documents, push, receipts, tasks. |
| Entitlements | `src/config/featureMatrix.ts`, `src/services/entitlementService.js`, `src/hooks/{useAccessTier,useFeatureAccess,useCreditBalance}.js` | 30 s in-memory snapshot cache; falls back to a FREE snapshot on error. |
| Local services | `src/services/` | `reminderService.js` (local notifications + date detection, plus task alerts), `expenseStore.js`, `signatureStore.js`, `chatFreeMessages.js`, `taskSpeech.js`. |
| Storage | `expo-secure-store` (`src/storage/tokenStore.js`, theme mode); `expo-file-system` JSON files (`reminders.json`, expenses, signatures) | No SQLite, no MMKV, no encrypted blob store today. |
| Theme | `src/ui/ThemeProvider.js` (+ `theme.js`, `tokens.js`, `useThemedStyles.js`) | system/light/dark, persisted; several screens still hardcode light colours. |
| Notifications | `src/notifications/pushNotifications.js`; handler registered at module scope in `App.js` | Local reminders scheduled client-side; remote push re-registered each launch. |

### Backend (.NET 8, EF Core, SQL Server — shared prod DB, baselined migration history)

| Layer | Location | Notes |
|---|---|---|
| Controllers | `Controllers/` (17) | Auth, Account, Admin(+Credits), Billing, Credits, DocumentChat, Documents, Entitlements, Iap, Notifications, Profile, Push, Receipts, Tasks, Dev, DeveloperTester. |
| Entitlements | `Services/FeatureMatrix.cs`, `Services/EntitlementService.cs`, `Controllers/EntitlementsController.cs` | `GET /api/entitlements/me` → `{tier, active, productId, status, expiresAtUtc, credits, features[]}`; `GET /api/entitlements/check/{key}` → allow, or 403 with a structured code. |
| Credits | `Services/CreditsService.cs`, `Models/TokenLedgerEntry.cs`, `Models/FeatureCreditConfig.cs` | Immutable ledger; Reserve → Complete/Refund. Costs seeded via `HasData`. |
| Subscriptions | `Models/UserSubscription.cs`, `Models/AppleTransaction.cs`, `Services/IapCatalog.cs` | Tier resolved from productId via `IAP:Products`; tier strings lowercase. |
| Tasks | `Models/TaskItem.cs`, `Controllers/TasksController.cs` | `Id, UserId, DocumentId, Title, Status, CreatedAt` + nullable `IsAiSuggested, Priority, AiReason, SourceDocumentId` + the seven Module 0/3 columns (§6). |

### Feature-gating contract (must not be bypassed)

1. `FeatureMatrix.cs` (backend) authorises. `featureMatrix.ts` (mobile) is a **visibility mirror only**.
2. Credit-bearing actions go through `CreditsService`: Reserve → Complete/Refund. Never charge outside the ledger.
3. Tier comes only from `EntitlementService` (which reads `UserSubscriptions`). No hardcoded tier checks in screens or controllers.

---

## 2. Existing features (shipping today)

- **Free / on-device** — upload hub, document scanner, QR/barcode scanner, signature editor, usage dashboard, theme switching, duplicate detection UI (Junk Wiper).
- **Essential** — AI document analysis, image OCR, summarize text, receipt extraction, smart reminders.
- **Plus** — explain in detail, AI chat (`AiChatScreen` + `DocumentChatController`), deep clean (`junk_wiper_scan_report`, 30 credits).
- **Advance** — custom reminder dates + snooze (`advanced_reminders`), household assistant (declared in the matrix, not built).
- **Smart Recall** *(Module 6, merged 2026-08-29)* — Advance, opt-in, off by
  default. Pulls short reminders out of a task's own note and folds them into
  that task's reminder. Settings → Smart Recall lists everything stored, with
  per-item undo and a typed-confirmation "forget everything".
- **Privacy & Security** *(Module 5, merged 2026-08-28)* — Settings → Privacy &
  Security: the privacy score, the sensitive-document suggestions, and the
  Private Vault (AES-256-GCM, key in the Keychain behind Face ID / Touch ID /
  passcode, device-only). Entirely on-device and entirely Free.
- **Storage Studio** *(Module 4, merged 2026-08-28)* — the cleaner hub: device
  storage, Duplicates, Screenshots and Large Files (free, on-device), Blurry
  (Essential) and Similar Photos (Plus, both analysed on-device), and the
  Advance Storage Forecast. Reached from Settings → Storage Studio.
- **Assistant** *(Module 3, merged 2026-08-28)* — the Assistant tab: My Tasks / AI Tasks / Reminders, task descriptions, due date + time, repeat, priority, complete, snooze, delete, and on-device read-aloud.

---

## 3. Defects and drift found during this analysis

| # | Finding | Evidence | Impact | Status |
|---|---|---|---|---|
| D1 | **FE/BE feature-matrix drift.** The backend declares five Storage Studio keys (`storage_studio`, `screenshot_cleaner`, `large_video_finder`, `blurry_detector`, `similar_photos`) that the mobile mirror does not contain. | `Services/FeatureMatrix.cs:83-88` vs `src/config/featureMatrix.ts` | `isFeatureAllowed()` returns `true` for unknown keys, so a Plus feature would render unlocked for Free users until the server refuses. | **Fixed** (Module 0) — the five keys are in `featureMatrix.ts`, and `__tests__/featureMatrix.test.ts` fails on drift. |
| D2 | **Credit configs referenced but never seeded.** `blurry_photo_scan` and `similar_photo_scan` are named as `CreditFeatureKey` but appear in no `HasData` seed or migration. | grep over `Data/`, `Migrations/` finds only `junk_wiper_scan_report` | Any Reserve on those keys fails at runtime; the paid Smart Cleaner layers cannot bill. | **Fixed** (Module 0) — migration `20260827230000_SeedStorageStudioCreditConfigs`. |
| D3 | **`DELETE /api/tasks/{id}` does not exist**, but the mobile client calls it. | `src/api/tasks.js:17` calls `api.delete`; `Controllers/TasksController.cs` has no `[HttpDelete]` | Any delete-task UI 405s. Blocks the Assistant module's delete requirement. | **Fixed** (Module 0) — `[HttpDelete("{id:guid}")]` in `TasksController`. |
| D4 | **`UpdateTaskRequest` accepts only `Title`/`Status`.** | record at the end of `Controllers/TasksController.cs` | Description, priority, due date/time, repeat and snooze cannot round-trip. | **Fixed** (Module 0) — `UpdateTaskRequest` carries all seven fields. |
| D6 | **The feature matrix is not enforced on any paid route.** No controller calls `CheckAccessAsync`; `POST /api/credits/reserve` checks cost and balance only. Access is gated by credits alone, so tier is advisory. | grep `CheckAccessAsync` over `Controllers/` hits only `EntitlementsController` | An Essential subscriber with credits can use a Plus feature. After Module 1 the client-side gate is the only tier check that exists, which principle §1.1 forbids. | **Fixed** 2026-08-28 — enforced at `POST /api/credits/reserve`, the single choke point every charge passes through, with configurable grandfathering for subscriptions predating the cutover. See policy §6.1. |
| D5 | Several screens still hardcode light colours while the app ships a dark theme. | Home, Upload, Tasks, Process, DocumentDetail, Analysis, Paywall, Profile, Privacy, Terms, auth screens | Dark mode looks broken on those screens. | **Open** — deferred to Module 8. |

---

## 4. New features roadmap

Ordered by dependency, not desirability. Each row is one approval gate.

| # | Module | Spec | Tier reach | Schema change | Risk | Status |
|---|---|---|---|---|---|---|
| 0 | Matrix repair (D1–D2) + task API completion (D3–D4) | this doc, §3 | all | Yes (task columns, credit seeds) | Low | **Shipped** 2026-08-28 |
| 1 | Subscription & entitlement policy | `subscription-entitlement-policy.md` | all | No | Low (matrix keys + shared lock UI) | **Shipped** 2026-08-28 |
| 2 | Device Permission Center | `device-permission-center.md` | Free | No | Low | **Shipped** 2026-08-28 |
| 3 | Assistant module (Tasks → Assistant; My Tasks / AI Tasks / Reminders) | `assistant-module-spec.md` | Free base, Advance extras | Yes | Medium | **Shipped** 2026-08-28 |
| 4 | Smart Cleaner layers (Basic / Deep / Pro) | `smart-cleaner-spec.md` | Free → Advance | Seeds only | Medium | **Shipped** 2026-08-28 |
| 5 | Privacy & Security module (Vault, sensitive detection, privacy score) | `privacy-security-module.md` | Free | Local only | Medium | **Shipped** 2026-08-28 |
| 6 | Smart Recall engine | `smart-recall-engine.md` | Advance | Yes | High | **Shipped** 2026-08-29 |
| 7 | AI Voice Companion | `voice-assistant-spec.md` | Advance | Yes (prefs) | Medium | Not started |
| 8 | Performance pass | `performance-optimization-plan.md` | all | No | Low | Not started |

---

## 5. Dependencies between features

```
Module 0  (matrix repair + tasks API)            [DONE]
   │
   ├── Module 3  Assistant ──┬── Module 6  Smart Recall [DONE] ── Module 7  Voice Companion
   │              [DONE]     └── (reuses reminderService)
   ├── Module 1  Entitlement policy   (informs every gate below)  [DONE]
   ├── Module 4  Smart Cleaner        [DONE]
   └── Module 5  Privacy [DONE] ── Module 2  Permission Center  [DONE — Module 5 links to it]

Module 8  Performance — last, measured against the finished surface area.
```

Hard ordering rules:

- ~~Module 7 (Voice) cannot ship before Module 3~~ — **unblocked**: `Description` exists.
- ~~Module 6 (Recall) cannot ship before Module 3~~ — **unblocked**: `Description` and `DueAtUtc` exist.
- ~~Module 4's paid layers cannot ship before the D2 credit seeds exist~~ — **unblocked**: seeded in Module 0.
- Modules 4–7 should not ship before Module 1. Each one adds a locked entry point,
  and Module 1 is what defines how a locked entry point looks and what it says.
  Building them first means rewriting their gates afterwards.

---

## 6. Database changes required (cumulative)

All additive and nullable. The production DB is shared and the EF history is baselined, so every migration must be independently revertible, and no existing column is retyped or dropped.

**Modules 0 / 3 — `Tasks` table — APPLIED.**
Migration `20260828090000_AddAssistantTaskFields`, applied to `PaperAiDb`. Each
`ALTER` is guarded by `IF NOT EXISTS`; `Down` drops in reverse with the same guards.

| Column | Type (as built) | Null | Reason |
|---|---|---|---|
| `Description` | `nvarchar(max)` | yes | Assistant task detail; also the Recall/Voice payload. Length capped at 2000 in `TasksController`, not in the schema, so the EF model matches the rest of the table. |
| `DueAtUtc` | `datetime2` | yes | Due date + time in one UTC column. |
| `DueTimeSet` | `bit` | yes | Distinguishes "due 5 Sep" from "due 5 Sep, 09:00". |
| `Repeat` | `nvarchar(max)` | yes | `NONE\|DAILY\|WEEKLY\|MONTHLY\|YEARLY`, validated in the controller. |
| `CompletedAt` | `datetime2` | yes | Completion time (previously only `Status` flipped). |
| `SnoozedUntilUtc` | `datetime2` | yes | Server-side mirror of a snooze. |
| `UpdatedAt` | `datetime2` | yes | Sync and ordering. |

**Module 1** — no schema change. Policy, matrix keys and shared lock UI only. **Done.**

**Module 4 — `FeatureCreditConfig` seeds — APPLIED.** Migration
`20260828120000_SeedAdvanceStorageCreditConfigs` adds `ai_storage_analysis` (5)
and `screenshot_intelligence` (3), guarded by `IF NOT EXISTS` and reverted by Id.
`blurry_photo_scan` and `similar_photo_scan` were already seeded in Module 0. No
new table, no column.

`storage_prediction` is deliberately **not** seeded: it is an Advance feature but
a purely on-device one — least-squares arithmetic over a local history file — so
it has no credit key and there is no server work to bill. A zero-cost row would
only invite a future Reserve for a computation the server never performs.

**Module 6 — `RecallMemories` + two preference columns — MIGRATION WRITTEN, NOT APPLIED.**
Migration `20260828182850_AddRecallMemories` creates `RecallMemories`
(`Id, UserId, SourceType, SourceId, Kind, Content, Confidence, CreatedAt, ExpiresAtUtc, DeletedAt`)
with indexes on `(UserId, SourceId)` and `(UserId, ExpiresAtUtc)`, adds
`SmartRecallEnabled` (default 0) and `HideRecallDetailsOnLockScreen` (default 1)
to `UserNotificationPreferences`, and seeds the `recall_extract` credit config.
Every statement is `IF NOT EXISTS`-guarded and `Down` reverses in order.

The preference columns go on the existing table rather than into a new
`UserRecallPreferences`, which is the same call this document already recommends
for Module 7.

**Module 7** — voice preferences. Recommendation: add columns to the existing `UserNotificationPreferences` rather than create `UserVoicePreferences` — fewer joins and a smaller migration surface. Confirmed in the voice spec.

**Module 5 — no server schema, as specified.** Vault contents never leave the device, and neither do detection results or the privacy score. Nothing was added to the backend for this module at all.

---

## 7. API changes required

Additive only; no existing route or response shape changes.

| Module | Endpoint | Purpose | Status |
|---|---|---|---|
| 0 | `DELETE /api/tasks/{id}` | Fixes D3. | **Implemented** |
| 0 | `PATCH /api/tasks/{id}` — extended request record | Fixes D4: accepts description, priority, due, repeat, snooze. | **Implemented** |
| 3 | `GET /api/tasks?source=ai\|manual&status=open\|done` | Feeds the Assistant tabs from one endpoint. Params absent = previous behaviour. | **Implemented** |
| 3 | `POST /api/tasks/{id}/complete`, `POST /api/tasks/{id}/snooze` | Explicit verbs so completion time and snooze are recorded server-side. | **Implemented** |
| 1 | none | Policy module — no new routes. It consumes the `code` / `requiredTier` / `message` body `GET /api/entitlements/check/{key}` already returns on 403, whose `SUBSCRIPTION_EXPIRED` case was corrected to fire only for a plan that genuinely lapsed. | **Implemented** |
| 4 | none | The cleaner stays on-device; only Reserve/Complete/Refund on existing credit routes. | **Implemented** — no route added, as specified. |
| 4 | *(deferred)* | `ai_storage_analysis` and `screenshot_intelligence` need a route this module does not add. Both are registered in the matrix and priced, but have **no entry point** until that route exists — see `smart-cleaner-spec.md` §10.2. | Deferred |
| 5 | none | Local-only by design. | **Implemented** — no route added, and none needed. |
| 5 | *(deferred)* | The PLUS AI-assisted classification pass in `privacy-security-module.md` §3 needs a route this module does not add. No matrix key was registered for it, so nothing advertises it — see §8.2 there. | Deferred |
| 6 | `GET /api/recall/memories`, `DELETE /api/recall/memories/{id}`, `POST /api/recall/memories/{id}/restore`, `DELETE /api/recall/memories/source/{id}`, `DELETE /api/recall/memories/all` | Memory CRUD, the undo half of the soft delete, and the mandatory "forget everything". | **Implemented** |
| 6 | `GET/PUT /api/recall/preferences` | The master switch and the lock-screen-detail switch. Deliberately NOT tier-gated for reads or for turning recall *off* — a lapsed subscriber must never be locked out of stopping the feature or deleting what it stored. | **Implemented** |
| 7 | `GET/PUT /api/voice/preferences` | Voice on/off, voice id, rate, tone. | Not started |

Every new endpoint is `[Authorize]`, scopes by `GetUserId()`, and calls `EntitlementService.CheckAccessAsync` for its feature key before doing work.

---

## 8. Mobile changes required

**Done**

- `App.js` — the `Tasks` tab renders `AssistantScreen` and is titled **Assistant**; the route name stays `Tasks`, so existing navigation calls and deep links keep working. *(Module 3)*
- `src/config/featureMatrix.ts` — the five drifted keys (D1) are present, and `__tests__/featureMatrix.test.ts` holds a checked-in snapshot of the backend keys so drift fails CI. *(Module 0)*
- `src/api/tasks.js` — full task shape, plus `completeTask` / `snoozeTask`. *(Module 0/3)*
- New UI: `AssistantScreen` (three tabs), `TaskCard`, `TaskEditorSheet`, `SegmentedTabs`; `taskSpeech.js` for on-device read-aloud. *(Module 3)*
- `src/config/upgradeMessages.ts` (one CTA sentence per gated key) and `src/ui/FeatureLock.js` (`FeatureLock` + `useUpgradePrompt`), implementing the policy §4/§5 contract once. `PaywallScreen` takes a `featureKey` param and names the plan that unlocks it. *(Module 1)*
- `smart_recall` and `voice_companion` registered in both matrices, and `isFeatureAllowed()` now fails closed on an unknown key. *(Module 1)*
- `App.js` — `PermissionCenter` stack route (title "Permissions"); `SettingsScreen` gains **Account → App Permissions** as its entry point. *(Module 2)*
- New: `src/services/permissionStatus.js` (get-only permission reads; `toDisplayState` / `mergePhotoStates` exported pure) and `src/screens/PermissionCenterScreen.js` (read-only panel, re-reads on `AppState` `active`, one Open Settings button, plus the iOS limited-photo "Manage selection" picker). No feature-matrix key and no entitlement check — the panel is Free and on-device. *(Module 2)*
- `__tests__/permissionStatus.test.js` — 14 cases, including a spy assertion that reading status never calls any `request*Async`. *(Module 2)*

- `App.js` — `StorageStudio` and `StorageScan` stack routes; `SettingsScreen` gains **Account → Storage Studio** as the hub's entry point. *(Module 4)*
- New services: `cleanerService.js` (the scan engine extracted out of `JunkWiperScanScreen.js`, pure grouping/hashing/sharpness/projection above a thin `MediaLibrary` layer), `imageSampler.js` (one 64×64 on-device downsample per photo, read for a sharpness score and a 64-bit hash, then discarded), `cleanerHistory.js` (the 24-entry aggregate store — the only thing a scan persists). *(Module 4)*
- New UI: `StorageStudioScreen` (hub) and `StorageScanScreen` (one scan → review → delete flow, four modes by route param). `JunkWiperScanScreen` kept its UI and became a consumer of the service. *(Module 4)*
- `app.json` — both photo usage strings extended to name the new scans and to state that photos are analysed on-device, per guideline 5.1.1. *(Module 4)*
- New dependencies: `expo-image-manipulator` and `jpeg-js`, for the on-device downsample the blurry and similar scans read. **A new native build is required before either paid scan runs on a device.** *(Module 4)*
- `__tests__/cleanerService.test.js` (38 cases) and `__tests__/cleanerHistory.test.js` (12 cases). *(Module 4)*

- `App.js` — `PrivacyCenter` and `Vault` stack routes; `SettingsScreen` gains **Account → Privacy & Security**. The existing `Privacy` route is the policy document and is unchanged; the new screen is the control panel, linked to it. *(Module 5)*
- New services: `vaultCrypto.js` (256-bit key in the Keychain behind `requireAuthentication`, AES-256-GCM with a fresh nonce per file), `vaultStore.js` (encrypted files **and an encrypted index**, so a locked vault leaks no names or counts), `sensitiveDetection.js` (pure rule set, two signals minimum), `sensitiveStore.js` (device-local detections and dismissals), `privacyScore.js` (pure weighting), `base64.js` (shared with the Module 4 image sampler). *(Module 5)*
- New UI: `VaultScreen` (five states: checking, no-biometry, setup, locked, unlocked; auto-locks on background and after 60 s idle) and `PrivacyCenterScreen`. Detection is hooked into `AnalysisScreen`, where the text already is. *(Module 5)*
- `app.json` — `NSFaceIDUsageDescription`, plus `expo-local-authentication` and `expo-crypto` plugin entries. *(Module 5)*
- New dependencies: `expo-local-authentication`, `expo-crypto`, and **`@noble/ciphers`** — `expo-crypto` has no symmetric cipher, so there was nothing in the SDK to do AES with. **A new native build is required.** *(Module 5)*
- 60 tests across `sensitiveDetection`, `privacyScore`, `vaultCrypto` and `vaultStore`, including a `fetch` spy asserting the vault paths reach nothing. *(Module 5)*

- `App.js` — `Memories` stack route; `SettingsScreen` gains **Account → Smart Recall**. *(Module 6)*
- New: `src/api/recall.js`, `src/services/recallNotification.js` (the lock-screen rules, pure and tested), `src/screens/MemoriesScreen.js`. `reminderService.scheduleTaskAlert` takes optional `memories` / `hideRecallDetails` — absent means today's behaviour, so no existing caller changed meaning. *(Module 6)*
- No new mobile dependencies for Module 6. *(Module 6)*

**Remaining**

- `App.js` — add the `VoiceSettings` stack route when Module 7 lands.
- `src/config/featureMatrix.ts` — add each later module's keys, always in the same commit as `FeatureMatrix.cs` **and** the snapshot in `__tests__/featureMatrix.test.ts`.
- **Nothing further to convert.** The other screens' paywall prompts were checked and are 402 credit top-ups or plain navigation, not tier locks — see the policy §5. Converting them would turn a top-up into a wall.
- New services: `recallService.js`, `voiceService.js`.
- New UI: `VoiceSettingsSection`.
- Entry points for `ai_storage_analysis` and `screenshot_intelligence`, in the same commit as the backend route they need. Both are already registered and priced; neither has a card, deliberately — see `smart-cleaner-spec.md` §10.2.
- No further dependencies are outstanding: `expo-speech` was already present, and Modules 4 and 5 added the rest.

---

## 9. Testing strategy

1. **Backend unit** (`tests/`): entitlement resolution per tier for every new feature key; task PATCH field by field; credit Reserve → Refund on a failed scan.
2. **Mobile unit** (`__tests__/`, `jest-expo`): a feature-matrix parity test that fails when the TS mirror and a checked-in snapshot of the C# keys diverge — the durable fix for D1; reminder/recall date maths; tier-gating hooks.
3. **Gate after every module**: `npx tsc --noEmit` and `npm test` in the mobile repo; `dotnet build PaperAi.csproj` in the API repo.
4. **Manual tier matrix**: exercise each feature at Free / Essential / Plus / Advance, verifying that a locked feature stays *visible with a CTA*, never hidden.
5. **Apple review rehearsal**: permission-denied paths, no automatic deletion, restore purchases, and behaviour with notifications denied.

---

## 10. Out of scope for v2

Architecture rewrites, replacing the credit ledger, replacing duplicate detection, offline-first sync, Android release work.

---

## 11. Deployment status

Merged is not deployed. Track the two separately.

| Module | Merged | Backend deployed | Notes |
|---|---|---|---|
| 0 — Matrix repair + tasks API | Yes (2026-08-28) | **No** | Migrations `20260827230000` and `20260828090000` are applied to the shared `PaperAiDb`, and every column is additive and nullable, so the **production build is unaffected**. |
| 1 — Entitlement policy | Yes (2026-08-28) | **No** | No schema and no new routes, but the `SUBSCRIPTION_EXPIRED` correction is server-side: until the API deploys, a never-subscribed user on a production build would still be told their plan ended. |
| 2 — Device Permission Center | Yes (2026-08-28) | **n/a** | Mobile-only and entirely on-device: no schema, no route, no backend change at all. It is the one module here with no API dependency, so it is safe to ship in a mobile build ahead of the API deploy. |
| 3 — Assistant | Yes (2026-08-28) | **No** | The Assistant screen works only against a local backend until the API is deployed. Do not ship the mobile build to TestFlight/App Store before the API deploy. |
| 6 — Smart Recall | Yes (2026-08-29) | **No** | Migration `20260828182850` is written but **NOT applied** to `PaperAiDb`. Until it is, `/api/recall/*` fails at the database and extraction never runs — the mobile screen degrades to "off" rather than crashing, but the feature does not exist. Apply the migration and deploy together. |
| 5 — Privacy & Security | Yes (2026-08-28) | **n/a** | Mobile-only and entirely on-device: no schema, no route, no backend change at all. Like Module 2 it has no API dependency — but it **does** need a new native build (`expo-local-authentication`, `expo-crypto`), so the Vault does not exist in the current TestFlight binary. |
| 4 — Smart Cleaner | Yes (2026-08-28) | **No** | The free layers (Screenshots, Large Files) and the Storage Forecast are entirely on-device and work against any backend. The two paid scans need migration `20260828120000` applied and the API deployed, or their Reserve 404s on an unpriced key. Also needs a **new native build** — `expo-image-manipulator` was added — so neither paid scan runs in the current TestFlight binary. |

The App Store release currently live is v1.0 (build 37) plus the nine
subscriptions, submitted 2026-08-18 — it predates all of the above.

**Release gate before any of this reaches users:** deploy `PaperAiApis`, confirm
`GET /api/tasks` returns the new fields against production, then cut the mobile build.
