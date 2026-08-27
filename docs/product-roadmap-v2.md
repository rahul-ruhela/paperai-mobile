# Paper AI Assistant — Product Roadmap v2

Status: **in progress — Modules 0, 1 and 3 shipped; Module 2 or 4 is next.**
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
- **Assistant** *(Module 3, merged 2026-08-28)* — the Assistant tab: My Tasks / AI Tasks / Reminders, task descriptions, due date + time, repeat, priority, complete, snooze, delete, and on-device read-aloud.

---

## 3. Defects and drift found during this analysis

| # | Finding | Evidence | Impact | Status |
|---|---|---|---|---|
| D1 | **FE/BE feature-matrix drift.** The backend declares five Storage Studio keys (`storage_studio`, `screenshot_cleaner`, `large_video_finder`, `blurry_detector`, `similar_photos`) that the mobile mirror does not contain. | `Services/FeatureMatrix.cs:83-88` vs `src/config/featureMatrix.ts` | `isFeatureAllowed()` returns `true` for unknown keys, so a Plus feature would render unlocked for Free users until the server refuses. | **Fixed** (Module 0) — the five keys are in `featureMatrix.ts`, and `__tests__/featureMatrix.test.ts` fails on drift. |
| D2 | **Credit configs referenced but never seeded.** `blurry_photo_scan` and `similar_photo_scan` are named as `CreditFeatureKey` but appear in no `HasData` seed or migration. | grep over `Data/`, `Migrations/` finds only `junk_wiper_scan_report` | Any Reserve on those keys fails at runtime; the paid Smart Cleaner layers cannot bill. | **Fixed** (Module 0) — migration `20260827230000_SeedStorageStudioCreditConfigs`. |
| D3 | **`DELETE /api/tasks/{id}` does not exist**, but the mobile client calls it. | `src/api/tasks.js:17` calls `api.delete`; `Controllers/TasksController.cs` has no `[HttpDelete]` | Any delete-task UI 405s. Blocks the Assistant module's delete requirement. | **Fixed** (Module 0) — `[HttpDelete("{id:guid}")]` in `TasksController`. |
| D4 | **`UpdateTaskRequest` accepts only `Title`/`Status`.** | record at the end of `Controllers/TasksController.cs` | Description, priority, due date/time, repeat and snooze cannot round-trip. | **Fixed** (Module 0) — `UpdateTaskRequest` carries all seven fields. |
| D6 | **The feature matrix is not enforced on any paid route.** No controller calls `CheckAccessAsync`; `POST /api/credits/reserve` checks cost and balance only. Access is gated by credits alone, so tier is advisory. | grep `CheckAccessAsync` over `Controllers/` hits only `EntitlementsController` | An Essential subscriber with credits can use a Plus feature. After Module 1 the client-side gate is the only tier check that exists, which principle §1.1 forbids. | **Open** — found 2026-08-28. Closing it removes access some paying users have today, so it needs a grandfathering decision first. See policy §6.1. |
| D5 | Several screens still hardcode light colours while the app ships a dark theme. | Home, Upload, Tasks, Process, DocumentDetail, Analysis, Paywall, Profile, Privacy, Terms, auth screens | Dark mode looks broken on those screens. | **Open** — deferred to Module 8. |

---

## 4. New features roadmap

Ordered by dependency, not desirability. Each row is one approval gate.

| # | Module | Spec | Tier reach | Schema change | Risk | Status |
|---|---|---|---|---|---|---|
| 0 | Matrix repair (D1–D2) + task API completion (D3–D4) | this doc, §3 | all | Yes (task columns, credit seeds) | Low | **Shipped** 2026-08-28 |
| 1 | Subscription & entitlement policy | `subscription-entitlement-policy.md` | all | No | Low (matrix keys + shared lock UI) | **Shipped** 2026-08-28 |
| 2 | Device Permission Center | `device-permission-center.md` | Free | No | Low | **Next** — smallest remaining |
| 3 | Assistant module (Tasks → Assistant; My Tasks / AI Tasks / Reminders) | `assistant-module-spec.md` | Free base, Advance extras | Yes | Medium | **Shipped** 2026-08-28 |
| 4 | Smart Cleaner layers (Basic / Deep / Pro) | `smart-cleaner-spec.md` | Free → Advance | Seeds only | Medium | Not started |
| 5 | Privacy & Security module (Vault, sensitive detection, privacy score) | `privacy-security-module.md` | Free → Plus | Local only | Medium | Not started |
| 6 | Smart Recall engine | `smart-recall-engine.md` | Advance | Yes | High | Not started |
| 7 | AI Voice Companion | `voice-assistant-spec.md` | Advance | Yes (prefs) | Medium | Not started |
| 8 | Performance pass | `performance-optimization-plan.md` | all | No | Low | Not started |

---

## 5. Dependencies between features

```
Module 0  (matrix repair + tasks API)            [DONE]
   │
   ├── Module 3  Assistant ──┬── Module 6  Smart Recall ── Module 7  Voice Companion
   │              [DONE]     └── (reuses reminderService)
   ├── Module 1  Entitlement policy   (informs every gate below)  [DONE]
   ├── Module 4  Smart Cleaner        (D2 credit seeds now exist)
   └── Module 5  Privacy ── Module 2  Permission Center (a panel inside Privacy)

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

**Module 4** — `FeatureCreditConfig` seeds. `blurry_photo_scan` and `similar_photo_scan` are **already seeded** (migration `20260827230000_SeedStorageStudioCreditConfigs`, Module 0); still to add are `ai_storage_analysis`, `screenshot_intelligence`, `storage_prediction`. No new table.

**Module 6** — new table `RecallMemories` (`Id, UserId, SourceType, SourceId, Kind, Content, Confidence, CreatedAt, ExpiresAtUtc, DeletedAt`), index on `(UserId, SourceId)`.

**Module 7** — voice preferences. Recommendation: add columns to the existing `UserNotificationPreferences` rather than create `UserVoicePreferences` — fewer joins and a smaller migration surface. Confirmed in the voice spec.

**Module 5** — **no** server schema. Vault contents never leave the device.

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
| 4 | none | The cleaner stays on-device; only Reserve/Complete/Refund on existing credit routes. | Not started |
| 5 | none | Local-only by design. | Not started |
| 6 | `GET/POST/DELETE /api/recall/memories`, `DELETE /api/recall/memories/all` | Memory CRUD plus the mandatory "forget everything" control. | Not started |
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

**Remaining**

- `App.js` — add `PermissionCenter`, `Vault`, `SmartCleaner` and `VoiceSettings` stack routes as their modules land.
- `src/config/featureMatrix.ts` — add each later module's keys, always in the same commit as `FeatureMatrix.cs` **and** the snapshot in `__tests__/featureMatrix.test.ts`.
- **Nothing further to convert.** The other screens' paywall prompts were checked and are 402 credit top-ups or plain navigation, not tier locks — see the policy §5. Converting them would turn a top-up into a wall.
- New services: `vaultService.js`, `recallService.js`, `voiceService.js`, and `cleanerService.js` extracted from `JunkWiperScanScreen.js` (1641 lines — too large to extend safely).
- New UI: `PermissionCenterScreen`, `VaultScreen`, `PrivacyScoreCard`, `VoiceSettingsSection`.
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

---

## 11. Deployment status

Merged is not deployed. Track the two separately.

| Module | Merged | Backend deployed | Notes |
|---|---|---|---|
| 0 — Matrix repair + tasks API | Yes (2026-08-28) | **No** | Migrations `20260827230000` and `20260828090000` are applied to the shared `PaperAiDb`, and every column is additive and nullable, so the **production build is unaffected**. |
| 1 — Entitlement policy | Yes (2026-08-28) | **No** | No schema and no new routes, but the `SUBSCRIPTION_EXPIRED` correction is server-side: until the API deploys, a never-subscribed user on a production build would still be told their plan ended. |
| 3 — Assistant | Yes (2026-08-28) | **No** | The Assistant screen works only against a local backend until the API is deployed. Do not ship the mobile build to TestFlight/App Store before the API deploy. |

The App Store release currently live is v1.0 (build 37) plus the nine
subscriptions, submitted 2026-08-18 — it predates all of the above.

**Release gate before any of this reaches users:** deploy `PaperAiApis`, confirm
`GET /api/tasks` returns the new fields against production, then cut the mobile build.
