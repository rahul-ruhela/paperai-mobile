# PaperAI Feature Roadmap — Agent Build System

A build queue designed so **each feature can be shipped by a different chat or
agent**, in parallel, with minimum token cost per session.

---

## How to use this (paste into a fresh chat)

> Read `docs/roadmap/CONTEXT.md`, then `docs/roadmap/<path-to-spec>.md`.
> Implement that spec only. Do not read other spec files.
> When done, run the verify commands in CONTEXT §9 and update the spec's Status line.

That's the whole prompt. **Two files, ~600 lines of context** — instead of an agent
crawling 60 source files to figure out how credits or theming work.

**Ready-made prompts for every tier: [PROMPTS.md](PROMPTS.md)** — copy, paste, go.

### Rules for agents

1. **Read exactly two files to start:** `CONTEXT.md` + your one spec. Nothing else.
2. Open source files only when your spec's *Files to touch* section names them.
3. Stay inside your spec's scope. Spotted a problem elsewhere? Write it under
   **Notes for other agents** in your spec — do not fix it.
4. One spec = one branch = one PR. Branch name is in each spec.
5. If two specs list the same file under *Files to touch*, they **conflict** —
   check the board below and don't run them in parallel.

---

## Status board

Update the Status column when you pick up or finish a spec.
`TODO` → `IN PROGRESS (chat name)` → `DONE`

### Tier 1 — Finish what's promised · biggest ROI · do these first

| # | Feature | Spec | Credits | Conflicts with | Status |
|---|---|---|---|---|---|
| 1.1 | AI Chat with your document | [tier-1/01-ai-chat.md](tier-1/01-ai-chat.md) | 1/msg | 1.4 (UploadScreen) | **DONE** · backend-blocked |
| 1.2 | Smart Reminders | [tier-1/02-smart-reminders.md](tier-1/02-smart-reminders.md) | free | — | **DONE** |
| 1.3 | Signature & Fill | [tier-1/03-signature-fill.md](tier-1/03-signature-fill.md) | free | — | **DONE** |
| 1.4 | Receipt → Expense | [tier-1/04-receipt-expense.md](tier-1/04-receipt-expense.md) | 1 | 1.1 (UploadScreen) | **DONE** · backend-blocked |

### Tier 2 — Storage Studio · your differentiator

| # | Feature | Spec | Credits | Conflicts with | Status |
|---|---|---|---|---|---|
| 2.0 | Storage Studio shell + dashboard | [tier-2/00-storage-studio-shell.md](tier-2/00-storage-studio-shell.md) | free | **blocks 2.1–2.5** | TODO |
| 2.1 | Screenshot cleaner | [tier-2/01-screenshot-cleaner.md](tier-2/01-screenshot-cleaner.md) | free | 2.0 | TODO |
| 2.2 | Blurry-photo detector | [tier-2/02-blurry-photos.md](tier-2/02-blurry-photos.md) | 1 | 2.0 | TODO |
| 2.3 | Large video finder | [tier-2/03-large-videos.md](tier-2/03-large-videos.md) | free | 2.0 | TODO |
| 2.4 | Similar-photo AI grouping | [tier-2/04-similar-photos.md](tier-2/04-similar-photos.md) | 2 | 2.0 | TODO |
| 2.5 | Monthly auto-scan reminder | [tier-2/05-auto-scan.md](tier-2/05-auto-scan.md) | free | 2.0, 1.2 | TODO |

**2.0 must land before 2.1–2.5** — it creates the hub they all plug into.

### Tier 3 — Document power features · converts business users

All specs in [tier-3-document-power.md](tier-3-document-power.md) — one section per feature,
each independently assignable. Quote the section heading when assigning.

| # | Feature | Credits | Status |
|---|---|---|---|
| 3.1 | PDF toolkit (merge/split/compress/rotate/protect) | free | TODO |
| 3.2 | Batch multi-page scan + edge detect | free | TODO |
| 3.3 | Translate document | 1 | TODO |
| 3.4 | Compare two documents | 2 | TODO |
| 3.5 | Redact sensitive info | 1 | TODO |
| 3.6 | Handwriting → text | 2 | TODO |
| 3.7 | Table → Excel/CSV | 2 | TODO |
| 3.8 | Ask across ALL documents (the moat) | 2 | TODO |
| 3.9 | Form auto-fill | 2 | TODO |
| 3.10 | Business card → contact | 1 | TODO |
| 3.11 | Voice note → transcript → summary | 2 | TODO |

### Tier 4 — Vertical pack · pick ONE and market around it

[tier-4-vertical-packs.md](tier-4-vertical-packs.md). **Recommendation: Freelancer/SMB.**
Do not build more than one pack until the first one shows retention.

| # | Pack | Status |
|---|---|---|
| 4.1 | Freelancer / SMB ← recommended | TODO |
| 4.2 | Students | TODO |
| 4.3 | Families | TODO |
| 4.4 | Legal / HR | TODO |

### Tier 5 — Retention & growth

[tier-5-retention-growth.md](tier-5-retention-growth.md).

| # | Feature | Status |
|---|---|---|
| 5.1 | Daily free credit | TODO |
| 5.2 | Streaks & achievements | TODO |
| 5.3 | Referral program | TODO |
| 5.4 | Rewarded ad → 1 credit | TODO |
| 5.5 | Home widget + iOS Share Extension | TODO |
| 5.6 | Folders, tags, favourites | TODO |
| 5.7 | Face ID document vault | TODO |
| 5.8 | Cloud sync + web access | TODO |
| 5.9 | Family sharing (Advance tier) | TODO |

---

## Already shipped

| Feature | Where |
|---|---|
| Document upload → AI analysis | `UploadScreen`, `ProcessScreen`, `AnalysisScreen` |
| Image OCR / Summarize / Explain | `UploadScreen` |
| Camera doc scanner, QR/barcode scanner | `CameraDocumentScanScreen`, `CodeScannerScreen` |
| Junk Wiper (duplicate finder, refunds on clean library) | `JunkWiperScanScreen` |
| Tasks, credit analytics, 3-tier IAP paywall | `TasksScreen`, `CreditAnalyticsScreen`, `PaywallScreen` |
| `<AiOrb />` + Home hero redesign | `src/ui/AiOrb.js`, `HomeScreen` |
| **1.3 Signature & Fill** (draw, place, text boxes, PDF export) | `SignatureScreen`, `src/ui/SignaturePad.js` |
| Brand identity lockup (boot + login) | `src/ui/BrandLockup.js` |
| **1.1 AI Chat** (stubbed, entry point gated) | `AiChatScreen`, `src/api/chat.js` |
| **1.2 Smart Reminders** | `src/services/reminderService.js`, `src/ui/ReminderCard.js` |
| **1.4 Receipt → Expense** (stubbed extraction) | `ReceiptCaptureScreen`, `ExpensesScreen`, `src/services/expenseStore.js` |

---

## Suggested order

1. **Tier 1 in full** — you are currently selling Plus/Advance features that show
   "coming soon". Close that gap before anything else.
2. **2.0 → 2.1 → 2.3** (the free ones) to build the cleanup habit, then 2.2/2.4.
3. **3.1, 3.8** — PDF toolkit drives daily use; cross-document search is the moat.
4. **5.1, 5.3, 5.5** — cheap, and they compound.
5. **Tier 4** last, once you know who is actually retaining.

## Backend status — Tier 1 unblocked

Backend work for 1.1 and 1.4 is **done** in `C:/work/apis/PaperAiApis` (branch `development`).
Both mobile clients now run live (`USE_STUB = false`).

| Endpoint | Controller | Credit key |
|---|---|---|
| `POST/GET /api/documents/{id}/chat` | `DocumentChatController.cs` | `document_ai_chat` (1) |
| `POST /api/receipts/extract` | `ReceiptsController.cs` | `receipt_extract` (1) |

Storage Studio credit rows (`blurry_photo_scan` 1, `similar_photo_scan` 2) and all
five tier-2 `FeatureMatrix` entries are **already registered** — spec 2.0 needs no
backend work beyond what is deployed.

**Deploy step:** run `ImportantDocument/databasescript/2026-08-21-ai-chat-and-receipts.sql`
(idempotent), then generate the EF migration with the API stopped — the script header
has the exact commands.

## Backend work this roadmap requires

Each spec has a **Backend needed** section. Collect them before starting a tier —
several features are blocked on endpoints that do not exist yet.
