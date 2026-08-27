# Paper AI Assistant — Product Roadmap v2

Status: **plan only — no code changed.**
Written: 2026-08-27. Branch: `chore/release-hardening`.
Basis: the repository as it stands today (`c:\work\apps\paperai-mobile` + API repo `c:\work\apis\PaperAiApis`).

---

## 1. Current architecture summary

### Mobile (React Native, Expo SDK 54, React 19, RN 0.81.5)

| Layer | Location | Notes |
|---|---|---|
| Entry / navigation | `App.js` (436 lines) | `ThemeProvider` → `AppShell` → `NavigationContainer` → native stack. Auth state decides which stack renders. |
| Tabs | `App.js` → `Tabs()` | 4 tabs: **Documents** (`HomeScreen`), **Upload**, **Tasks**, **Settings**. |
| Stack screens | `App.js` | Process, Document, Analysis, Paywall, Profile, Analytics, Privacy, Terms, HelpCenter, ContactSupport, JunkWiper, CameraScanner, CodeScanner, Signature, AiChat, ReceiptCapture, Expenses. |
| Screens | `src/screens/` (26 files) | Largest: `JunkWiperScanScreen.js` (1641), `HomeScreen.js` (722), `SettingsScreen.js` (661). |
| HTTP | `src/api/client.js` | One axios instance + `authedFetch` for multipart. Request interceptor attaches the JWT; response interceptor does single-flight refresh on 401 and attaches `err.userMessage`. |
| API modules | `src/api/` | auth, billing, chat, client, credits, dev, documents, push, receipts, tasks. |
| Entitlements | `src/config/featureMatrix.ts`, `src/services/entitlementService.js`, `src/hooks/{useAccessTier,useFeatureAccess,useCreditBalance}.js` | 30 s in-memory snapshot cache; falls back to a FREE snapshot on error. |
| Local services | `src/services/` | `reminderService.js` (local notifications + date detection), `expenseStore.js`, `signatureStore.js`, `chatFreeMessages.js`. |
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
| Tasks | `Models/TaskItem.cs`, `Controllers/TasksController.cs` | `Id, UserId, DocumentId, Title, Status, CreatedAt` + nullable `IsAiSuggested, Priority, AiReason, SourceDocumentId`. |

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

---

## 3. Defects and drift found during this analysis

| # | Finding | Evidence | Impact |
|---|---|---|---|
| D1 | **FE/BE feature-matrix drift.** The backend declares five Storage Studio keys (`storage_studio`, `screenshot_cleaner`, `large_video_finder`, `blurry_detector`, `similar_photos`) that the mobile mirror does not contain. | `Services/FeatureMatrix.cs:83-88` vs `src/config/featureMatrix.ts` | `isFeatureAllowed()` returns `true` for unknown keys, so a Plus feature would render unlocked for Free users until the server refuses. |
| D2 | **Credit configs referenced but never seeded.** `blurry_photo_scan` and `similar_photo_scan` are named as `CreditFeatureKey` but appear in no `HasData` seed or migration. | grep over `Data/`, `Migrations/` finds only `junk_wiper_scan_report` | Any Reserve on those keys fails at runtime; the paid Smart Cleaner layers cannot bill. |
| D3 | **`DELETE /api/tasks/{id}` does not exist**, but the mobile client calls it. | `src/api/tasks.js:17` calls `api.delete`; `Controllers/TasksController.cs` has no `[HttpDelete]` | Any delete-task UI 405s. Blocks the Assistant module's delete requirement. |
| D4 | **`UpdateTaskRequest` accepts only `Title`/`Status`.** | record at the end of `Controllers/TasksController.cs` | Description, priority, due date/time, repeat and snooze cannot round-trip. |
| D5 | Several screens still hardcode light colours while the app ships a dark theme. | Home, Upload, Tasks, Process, DocumentDetail, Analysis, Paywall, Profile, Privacy, Terms, auth screens | Dark mode looks broken on those screens. |

---

## 4. New features roadmap

Ordered by dependency, not desirability. Each row is one approval gate.

| # | Module | Spec | Tier reach | Schema change | Risk |
|---|---|---|---|---|---|
| 0 | Matrix repair (D1–D2) + task API completion (D3–D4) | this doc, §3 | all | Yes (task columns, credit seeds) | Low |
| 1 | Subscription & entitlement policy | `subscription-entitlement-policy.md` | all | No | None (doc + matrix alignment) |
| 2 | Device Permission Center | `device-permission-center.md` | Free | No | Low |
| 3 | Assistant module (Tasks → Assistant; AI Tasks / My Tasks) | `assistant-module-spec.md` | Free base, Advance extras | Yes | Medium |
| 4 | Smart Cleaner layers (Basic / Deep / Pro) | `smart-cleaner-spec.md` | Free → Advance | Seeds only | Medium |
| 5 | Privacy & Security module (Vault, sensitive detection, privacy score) | `privacy-security-module.md` | Free → Plus | Local only | Medium |
| 6 | Smart Recall engine | `smart-recall-engine.md` | Advance | Yes | High |
| 7 | AI Voice Companion | `voice-assistant-spec.md` | Advance | Yes (prefs) | Medium |
| 8 | Performance pass | `performance-optimization-plan.md` | all | No | Low |

---

## 5. Dependencies between features

```
Module 0  (matrix repair + tasks API)
   │
   ├── Module 3  Assistant ──┬── Module 6  Smart Recall ── Module 7  Voice Companion
   │                         └── (reuses reminderService)
   ├── Module 1  Entitlement policy   (informs every gate below)
   ├── Module 4  Smart Cleaner        (needs the D2 credit seeds)
   └── Module 5  Privacy ── Module 2  Permission Center (a panel inside Privacy)

Module 8  Performance — last, measured against the finished surface area.
```

Hard ordering rules:

- Module 7 (Voice) cannot ship before Module 3 — it speaks a task's `description`, which does not exist yet.
- Module 6 (Recall) cannot ship before Module 3, for the same reason plus `dueAtUtc`.
- Module 4's paid layers cannot ship before the D2 credit seeds exist.

---

## 6. Database changes required (cumulative)

All additive and nullable. The production DB is shared and the EF history is baselined, so every migration must be independently revertible, and no existing column is retyped or dropped.

**Modules 0 / 3 — `Tasks` table**

| Column | Type | Null | Reason |
|---|---|---|---|
| `Description` | `nvarchar(2000)` | yes | Assistant task detail; also the Recall/Voice payload. |
| `DueAtUtc` | `datetime2` | yes | Due date + time in one UTC column. |
| `DueTimeSet` | `bit` | yes | Distinguishes "due 5 Sep" from "due 5 Sep, 09:00". |
| `Repeat` | `nvarchar(20)` | yes | `NONE\|DAILY\|WEEKLY\|MONTHLY\|YEARLY`. |
| `CompletedAt` | `datetime2` | yes | Completion time (today only `Status` flips). |
| `SnoozedUntilUtc` | `datetime2` | yes | Server-side mirror of a snooze. |
| `UpdatedAt` | `datetime2` | yes | Sync and ordering. |

**Module 4** — `FeatureCreditConfig` seeds only: `blurry_photo_scan`, `similar_photo_scan`, plus new `ai_storage_analysis`, `screenshot_intelligence`, `storage_prediction`. No new table.

**Module 6** — new table `RecallMemories` (`Id, UserId, SourceType, SourceId, Kind, Content, Confidence, CreatedAt, ExpiresAtUtc, DeletedAt`), index on `(UserId, SourceId)`.

**Module 7** — voice preferences. Recommendation: add columns to the existing `UserNotificationPreferences` rather than create `UserVoicePreferences` — fewer joins and a smaller migration surface. Confirmed in the voice spec.

**Module 5** — **no** server schema. Vault contents never leave the device.

---

## 7. API changes required

Additive only; no existing route or response shape changes.

| Module | Endpoint | Purpose |
|---|---|---|
| 0 | `DELETE /api/tasks/{id}` | Fixes D3. |
| 0 | `PATCH /api/tasks/{id}` — extended request record | Fixes D4: accepts description, priority, due, repeat, snooze. |
| 3 | `GET /api/tasks?source=ai\|manual` | Feeds the two Assistant tabs from one endpoint. Param absent = today's behaviour. |
| 3 | `POST /api/tasks/{id}/complete`, `POST /api/tasks/{id}/snooze` | Explicit verbs so completion time and snooze are recorded server-side. |
| 4 | none | The cleaner stays on-device; only Reserve/Complete/Refund on existing credit routes. |
| 5 | none | Local-only by design. |
| 6 | `GET/POST/DELETE /api/recall/memories`, `DELETE /api/recall/memories/all` | Memory CRUD plus the mandatory "forget everything" control. |
| 7 | `GET/PUT /api/voice/preferences` | Voice on/off, voice id, rate, tone. |

Every new endpoint is `[Authorize]`, scopes by `GetUserId()`, and calls `EntitlementService.CheckAccessAsync` for its feature key before doing work.

---

## 8. Mobile changes required

- `App.js` — rename the `Tasks` tab to **Assistant** (keep the route name `Tasks` initially so existing navigation calls and deep links keep working; override the label via `options.title`). Add `PermissionCenter`, `Vault`, `SmartCleaner` and `VoiceSettings` stack routes as their modules land.
- `src/config/featureMatrix.ts` — add the five drifted keys (D1) plus each module's new keys, kept in step with `FeatureMatrix.cs`.
- `src/api/tasks.js` — extend to the full task shape; add complete/snooze calls.
- New services: `vaultService.js`, `recallService.js`, `voiceService.js`, and `cleanerService.js` extracted from `JunkWiperScanScreen.js` (1641 lines — too large to extend safely).
- New UI: `AssistantScreen` (two tabs), `TaskEditorSheet`, `PermissionCenterScreen`, `VaultScreen`, `PrivacyScoreCard`, `VoiceSettingsSection`.
- New dependencies, none currently installed: `expo-local-authentication` (Face ID / Touch ID), `expo-speech` (voice), `expo-crypto` (vault key derivation). Each needs an `app.json` plugin entry and an Info.plist usage string.

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
