# Paper AI Assistant — Project Details

> Living reference for the mobile app, its flows, and the backend it talks to.
> Companion docs: `README.md` (build/release), `docs/api-integration.md` (endpoint contract),
> `docs/release-runbook.md`, `docs/app-store-checklist.md`.

---

## 1. What the product is

A document-intelligence app for iOS. The user brings paper or files into the app
(camera scan, PDF pick, photo pick), the backend runs AI over it (OCR, analysis,
summaries, extracted action items), and the results come back as searchable
documents plus a task list. Paid usage is metered in **credits**, sold through
nine Apple auto-renewable subscriptions across three tiers.

Alongside the AI core there are three free on-device utilities — a **QR / barcode
scanner**, **Junk Wiper** (duplicate photo/video/document cleanup) and
**Sign & Fill** (sign a page and export a PDF) — which give a non-subscriber a
reason to open the app.

| | |
|---|---|
| App name | Paper Ai Assistant |
| Bundle ID | `com.bholeshankar.paperai` |
| ASC App ID | 6757206246 |
| Version | 1.0.1 (app.json) |
| Stack | React Native 0.81 / Expo SDK 54, React 19, JS + partial TS |
| Backend | .NET 8 / ASP.NET Core |
| Production API | `https://apis.bseptechnologies.com` |
| Platforms | iOS shipping; Android planned |

---

## 2. Architecture at a glance

```
┌───────────────────────── Expo / React Native app ─────────────────────────┐
│  App.js  ThemeProvider → ErrorBoundary → NavigationContainer              │
│          auth gate on SecureStore token → Auth stack | Main stack         │
│                                                                          │
│  src/screens/    25 screens (tabs + modal/detail stack)                   │
│  src/ui/         design system: theme tokens, GlassCard, GradientScreen,  │
│                  AiOrb, SignaturePad…                                     │
│  src/hooks/      useAccessTier · useCreditBalance · useFeatureAccess      │
│  src/services/   entitlementService (cached snapshot, 30s TTL) ·          │
│                  signatureStore · expenseStore (both on-device)           │
│  src/api/        axios client + auth/billing/credits/documents/tasks/    │
│                  receipts/dev                                            │
│  src/storage/    tokenStore (SecureStore) · pendingPurchases              │
│  src/config/     featureMatrix.ts — mirror of backend FeatureMatrix.cs    │
│  src/constants/  api.ts — base URL resolution + 9 IAP SKUs                │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │ HTTPS, JWT Bearer (access + refresh rotation)
┌──────────────────────────────▼───────────────────────────────────────────┐
│  .NET 8 API — apis.bseptechnologies.com                                  │
│  auth · documents (+AI pipeline) · credits ledger · entitlements ·        │
│  billing (StoreKit 2 verification) · tasks · notifications · profile      │
└──────────────────────────────┬───────────────────────────────────────────┘
                               │
              Apple App Store Server API + Server Notifications V2
              (POST /api/billing/ios/notifications-v2)
```

Two authority rules the codebase holds to:

1. **The backend is the only authority** for entitlements, credit cost, and
   whether an action is allowed. `featureMatrix.ts` exists to shape the UI, never
   to authorize (`src/config/featureMatrix.ts:1-10`).
2. **Credit cost is never hardcoded in the UI.** Every paid action reads its cost
   and its user-facing copy from `GET /api/credits/feature-configs`
   (`src/api/credits.js:8`).

---

## 3. Navigation map

**Auth stack** (no token): `Login` → `Register` / `OtpLogin` / `EmailOtpVerify`

**Main stack** (token present):
- Bottom tabs: **Documents** (Home) · **Upload** · **Tasks** · **Settings**
- Pushed screens: `Process`, `Document`, `Analysis`, `Paywall`, `Profile`,
  `Analytics` (credit analytics), `Privacy`, `Terms`, `HelpCenter`,
  `ContactSupport`, `JunkWiper`, `CameraScanner`, `CodeScanner`, `Signature`,
  `ReceiptCapture`, `Expenses` (`AiChat` only on `future/tier1-features` — see §7)
- On `future/tier1-features` a shared `navigationRef` lets a tapped reminder
  notification deep-link straight to `Analysis` for that document, gated on
  `isReady()`. That listener ships with Smart Reminders and is not in this branch.
- `BootScreen` renders until both the token check and the stored theme
  preference have hydrated, so the first paint is already in the right palette
  (`App.js`).

---

## 4. Features

### 4.1 Authentication — four ways in
| Method | Screen | Endpoint |
|---|---|---|
| Email + password | `LoginScreen` / `RegisterScreen` | `/api/auth/login`, `/api/auth/register` |
| Email OTP | `EmailOtpVerifyScreen` | `/api/auth/email-otp/send`, `/verify` |
| Phone OTP (Twilio) | `OtpLoginScreen` | `/api/auth/otp/send`, `/verify` |
| Sign in with Apple | `LoginScreen` | `/api/auth/apple` |

Tokens live in **SecureStore** (`src/storage/tokenStore.js`). The axios response
interceptor refreshes silently on the first 401 and queues concurrent calls
behind one refresh; auth endpoints are excluded so a bad-password 401 is not
mistaken for an expired session (`src/api/client.js:30-45`). Multipart uploads
can't use axios, so `authedFetch()` re-implements the same refresh-and-retry for
`FormData` bodies (`src/api/client.js:78`).

Account deletion (`DELETE /api/account`) ships as an App Store requirement.

### 4.2 Document capture and processing
- **Upload Hub** (`UploadScreen`) — PDF via `expo-document-picker`, image via
  `expo-image-picker`, plus entry points to the scanner utilities, Sign & Fill
  (§4.5b) and Scan Receipt (§4.5d). Uploads go to `POST /api/documents/upload`
  as multipart. The hub is split by a **FREE TOOLS / AI FEATURES** divider and
  everything below that divider spends credits — Scan Receipt sits below it,
  Sign & Fill above.
- **Camera Document Scanner** (`CameraDocumentScanScreen`) — multi-page capture,
  builds a **PDF fully on-device** via `expo-print`, saves/shares it. Free.
  Uploading it for AI analysis is the optional paid step.
- **Image OCR** — `POST /api/documents/{id}/ocr`, result is copyable in-place.
- **AI processing** (`ProcessScreen`) — `POST /api/documents/{id}/process` with an
  `X-Transaction-Id` header so the backend knows credits were already reserved
  and must not deduct twice (`src/api/documents.js:39`).
- **Analysis** (`AnalysisScreen`) — renders the AI output, links extracted tasks,
  supports reprocess (`/reprocess`), share, and polls while status is
  `QUEUED` / `PROCESSING`.
- **Documents list** (`HomeScreen`) — a hero header (greeting, credit pill that
  routes to the Paywall, the `AiOrb`, four quick-action tiles — Scan / Sign /
  Receipt / Code — and a live Documents / AI-ready / Pending stat strip), then
  tabs Inbox / AI-Ready / Pending / Pinned, search, pull-to-refresh, delete.

  The hero, search field and tab pills are the `FlatList`'s
  `ListHeaderComponent`, passed as a React **element** rather than a component
  function — an inline function would remount the header on every render and the
  search field would lose focus on each keystroke. The orb element is memoized on
  the pending count for the same reason: typing re-renders this screen per
  character, and the orb is a dozen driven Animated nodes.

### 4.3 Tasks
`TasksScreen` over `/api/tasks` (list / create / patch / delete). Tasks can be
attached to a document, which is how AI-extracted action items land here.

### 4.4 Junk Wiper (free, on-device)
`JunkWiperScanScreen` — the largest screen in the app (~1.6k lines). Four
duplicate-detection strategies:
1. Exact — same fileSize + pixel dimensions + mediaType
2. Same filename, case-insensitive, across albums
3. Near-duplicate bursts — same dimensions, created within 2 seconds
4. Duplicate PaperAI documents — same normalised title in `GET /api/documents`

Strategies 1–3 run over `expo-media-library` and are de-duplicated by asset ID;
results group by photo / video / document. Nothing is synthesised to pad an
empty result, and document groups carry no size figure because the API doesn't
expose one. Needs "All Photos" access to be complete — the permission strings in
`app.json` say so explicitly.

### 4.5 Code Scanner (free, on-device)
`CodeScannerScreen` — QR plus 12 barcode symbologies (`ean13`, `upc_a`,
`code128`, `pdf417`, `aztec`, `datamatrix`, …). No server call, no credits. URLs
are detected and openable; anything else is copyable.

### 4.6 Credits and paid actions
The credit lifecycle is a three-step reserve/settle ledger:

```
getFeatureConfig(key)     → cost + the exact modal copy to show
    ↓  user confirms in CreditConfirmModal
reserveCredits(key, ref)  → { transactionId, creditsReserved, creditsLeft }
                            402 if insufficient → route to Paywall
    ↓  run the actual work
completeTransaction(id)   on success
refundTransaction(id, r)  on failure or cancel
```

Feature keys in use: `image_ocr_extract_text`, `summarize_text`,
`explain_text_detail`, `document_scan_ai_ready`, `junk_wiper_scan_report`,
`receipt_extract`. (`document_ai_chat` is declared in the matrix but nothing in
this branch reserves against it — see §7.)

`receipt_extraction` in `featureMatrix.ts` points at `receipt_extract`. It
previously pointed at `image_ocr_extract_text`, which would have quoted and
charged the OCR feature's cost for a receipt scan.

`CreditAnalyticsScreen` shows the balance plus every enabled paid feature sorted
by cost, so the user can see what their credits buy.

### 4.7 Entitlements and tier gating
`GET /api/entitlements/me` returns `{ tier, active, productId, status,
expiresAtUtc, credits, features[] }`. `entitlementService` caches it for 30s,
de-dupes concurrent calls, and **falls back to a Free snapshot rather than
failing the UI** (`src/services/entitlementService.js:16`).

Tiers: `free < essential < plus < advance`.

| Tier | Features unlocked |
|---|---|
| free | Upload Hub, Document Scanner, Code Scanner, Signature Editor, Usage Dashboard |
| essential | AI Document Analysis, Image OCR, Summarize, Receipt Extraction, Smart Reminders |
| plus | Explain in Detail, AI Chat, Deep Clean |
| advance | Household Assistant |

`useFeatureAccess(key)` prefers the server-computed allow map and falls back to
the local matrix. `GET /api/entitlements/check/{key}` is the authoritative
single-feature check.

### 4.8 Subscriptions / IAP
`PaywallScreen` (~1.2k lines) drives real StoreKit 2 through **expo-iap**:

1. Connect to the App Store, fetch all 9 products, render live Apple prices
   (static `fallbackPrice` only until the fetch returns).
2. Duration tabs (Weekly / Monthly / Yearly) × three tier cards.
3. `requestPurchase` → Apple sheet → on success
   `POST /api/billing/ios/verify-transaction-auto` (auto-detects sandbox vs
   production from the transaction ID) → `finishTransaction` → refresh
   entitlement.

Hardening that matters:
- Verification uses a **60s timeout**, not the shared 30s — the server polls
  Apple for transactions that haven't propagated and can legitimately take ~18s.
  Aborting early is how a paid subscription ends up unactivated
  (`src/api/billing.js:22-30`).
- **Two attempts with 1s/2s backoff**, retried only on 5xx or no-response; a 4xx
  is a verdict, not a hiccup (`src/api/billing.js:60-90`).
- `pendingPurchases` remembers transactions Apple charged for but the backend
  never confirmed. StoreKit re-delivers unfinished transactions on every launch,
  so recovery is automatic — this store just keeps the app from nagging the user
  about it each time.
- Expo Go has no expo-iap native module, so the paywall renders read-only there
  instead of crashing.

**Product catalogue** — three tiers × three durations, all in one ASC group
("Paper AI Pro Plans"), so a user holds exactly one plan and every switch is a
plan change:

| Tier | Weekly | Monthly | Yearly |
|---|---|---|---|
| Essential | 13 cr / $12.99 | 40 cr / $39.99 | 353 cr / $299.99 |
| Plus | 20 cr / $19.99 | 60 cr / $59.99 | 471 cr / $399.99 |
| Advance | 30 cr / $29.99 | 100 cr / $99.99 | 706 cr / $599.99 |

**Credits do not roll over.** On `DID_RENEW` the backend *sets* the balance to
the plan's allowance rather than adding to it. The paywall and Terms screen state
this literally — that wording is App Store review surface.

> Retired IDs: `pro_weekly` / `pro_monthly` / `pro_yearly` no longer exist. Any
> `pro_*` reference anywhere is a bug that grants zero credits to a payer.

### 4.5b Sign & Fill — signature editor (free, on-device)
`SignatureScreen` + `SignaturePad` — draw a signature, place it on a page, add
text boxes, export a PDF, share it. No credits, no network. Reached from the
Upload hub's FREE TOOLS block and the Home **Sign** quick tile; route `Signature`,
optional params `{ imageUri, title }`.

The page is embedded as a base64 `<img>` and the signature as an **inline SVG
`<path>`**, so `expo-print` renders it vector-crisp instead of as a screenshot of
the editor. Overlays are positioned in **percentages of the editor frame**, and
`frameFor()` forces that frame to the page image's own aspect ratio — if the
frame were a fixed A4 rectangle with the image letterboxed inside it, those
percentages would describe a different box than the PDF's and the signature would
land somewhere else vertically on export.

`SignaturePad` deliberately avoids `react-native-svg`: it is a native module, so
adding it would force a new dev-client / EAS build. Each stroke segment is a thin
rotated `<View>` between consecutive touch points instead — invisible joins at
2–3px, and export goes through the real SVG path anyway. Touches are converted
from `pageX/pageY` against the pad's measured origin, not `locationX/locationY`,
which are reported relative to whichever view holds the touch and break once the
pad has children.

`signatureStore` keeps up to 3 saved signatures as raw stroke JSON in the app
document directory (stroke data is a few KB — past SecureStore's practical
limit, and a signature is not a credential).

> The copy here must never claim legal validity: this produces a signature
> *image* on a document, not a certified e-signature.

### 4.5c AI Chat over a document
`AiChatScreen` — a threaded chat scoped to one document, backed by
`GET/POST /api/documents/{id}/chat`. **1 credit per message, first message per
document free** as a hook. Feature key `document_ai_chat`.

Deliberately **no subscription-tier gate**: credits are the entitlement
throughout this product (Junk Wiper and OCR both charge credits without checking
a tier, and the backend does the same), so showing an upsell to someone holding
credits they already paid for would be wrong. `USE_STUB` in `src/api/chat.js` is
an offline escape hatch for UI work, currently `false`.

### 4.5d Scan Receipt — receipts and expenses
- `ReceiptCaptureScreen` — capture a receipt, `POST /api/receipts/extract`
  (multipart + `X-Transaction-Id`), review structured fields. **1 credit per
  successful extraction, auto-refunded on a failed read** (no merchant AND no
  total). Every field is editable and low-confidence fields are pre-highlighted
  rather than presented as fact — thermal-receipt OCR is wrong often enough that
  a read-only result feels broken. Feature key `receipt_extract`. Reached from
  the Upload hub's AI FEATURES block and the Home **Receipt** quick tile.
- Full reserve → extract → settle ledger per §4.6: `reserveCredits` first, then
  `completeTransaction` on a good read, `refundTransaction` on a failed read or a
  thrown request. A 402 routes to the Paywall. `isFailedRead()` must stay in
  agreement with `ReceiptExtraction.IsFailedRead` on the server, or the app will
  tell the user something was free that they were actually charged for.
- The upload goes through `authedFetch`, **not** the axios instance — setting
  `Content-Type: multipart/form-data` by hand strips the boundary the server
  needs, and the file arrives null. Same path as `/api/documents/upload`.
- `USE_STUB` in `src/api/receipts.js` is an offline escape hatch for UI work,
  currently `false`. It must be false in anything that ships.
- **No subscription-tier gate**, for the same reason given in §4.5c: credits are
  the entitlement throughout this product, and Junk Wiper and OCR both charge
  credits without checking a tier.
- `ExpensesScreen` — saved receipts grouped by month with totals and **CSV
  export** (RFC 4180 escaped, because accountants open it in Excel and a merchant
  name with a comma would shift every following column). Free to view; only
  extraction costs credits.
- `expenseStore` persists records (including the receipt image URI) on-device
  until the backend has an expenses table.

### 4.5e Smart Reminders (free, on-device)
`reminderService` + `ReminderCard`, surfaced in `TasksScreen`. Detects dates in a
document's AI output and schedules local notifications before a bill, contract or
warranty comes due. No credits, no server round-trip.

Date source in priority order: `doc.detectedDates` from the backend
(`[{ label, dateUtc, confidence }]`) when present, else client-side extraction
from the summary / extracted text — so nothing in the UI has to change when the
backend ships it. Lead times are 1 day / 3 days / 1 week before, and everything
**fires at 09:00 local**, not at the raw timestamp, because waking people at
midnight is how an app gets its notifications turned off.

### 4.9 Push notifications
`expo-notifications` + `UIBackgroundModes: remote-notification`. Token
registration posts to `/api/notifications/register-token`.

### 4.10 Theming and design system
`ThemeProvider` persists System / Light / Dark, hydrates before first paint, and
hands the palette to React Navigation so headers and card transitions match.
`src/ui/` holds the shared kit: `tokens.js`, `theme.js`, `GlassCard`,
`GlassModal`, `GradientScreen`, `AppButton`, `StatusBadge`, `ConfirmActionSheet`,
`CreditConfirmModal`, `CameraPermissionGate`, `AiOrb`, `SignaturePad`, plus
`useReduceMotion` for accessibility.

`AiOrb` is the shared "AI is alive" visual — breathing glow, orbiting particles,
sweeping scan line, in `idle` / `working` / `done` states. Built on the RN
`Animated` API with `useNativeDriver` like the rest of the codebase, so it runs
anywhere Expo Go does, and it honours Reduce Motion by rendering as a static
badge. Used by `HomeScreen`'s hero and `ReceiptCaptureScreen`'s empty state.

### 4.11 Compliance surface
`PrivacyScreen`, `TermsScreen`, `HelpCenterScreen`, `ContactSupportScreen`,
account deletion, and `CameraPermissionGate` — a single shared component that
satisfies guideline 5.1.1(iv); the comment in `CodeScannerScreen` explicitly
forbids re-inlining a custom pre-prompt.

The iOS purpose strings in `app.json` must name every reason the app reaches for
a resource, so `photosPermission` (on both `expo-image-picker` and
`expo-media-library`) covers OCR images, **picking a page to sign**, **adding a
receipt** and the Junk Wiper duplicate scan, and `cameraPermission` names
documents **and receipts**. Adding a capture path without widening these is a
guideline 5.1.1 rejection.

---

## 5. Backend API surface (as consumed by the app)

.NET 8, JWT Bearer, `GET /health` for status.

| Area | Endpoints |
|---|---|
| Auth | `register`, `login`, `email-otp/send·verify`, `otp/send·verify`, `apple`, `refresh`, `logout` |
| Account | `DELETE /api/account`, `GET/POST /api/profile` |
| Documents | `GET /api/documents`, `GET /api/documents/{id}`, `POST /upload`, `POST /{id}/process`, `POST /{id}/ocr`, `POST /{id}/reprocess`, `DELETE /{id}` |
| Chat | `GET/POST /api/documents/{id}/chat` — **not called from this branch**, see §7 |
| Receipts | `POST /api/receipts/extract` (multipart + `X-Transaction-Id`) |
| Tasks | `GET/POST /api/tasks`, `PATCH/DELETE /api/tasks/{id}` |
| Credits | `GET /balance`, `GET /feature-configs[/{key}]`, `POST /reserve`, `POST /complete`, `POST /refund` |
| Entitlements | `GET /api/entitlements/me`, `GET /api/entitlements/check/{key}` |
| Billing | `GET /api/billing/entitlement`, `POST /ios/verify-transaction-auto`, `/ios/verify-transaction`, `/ios/verify-receipt`, `/ios/sync-receipt`, `/mock-subscribe` (dev only), `POST /ios/notifications-v2` (public Apple webhook) |
| Notifications | `POST /api/notifications/register-token` |
| Dev | `POST /api/dev/grant-credits` (404 in production) |

Errors return `{ message, error }`; `client.js` maps every status to
`err.userMessage` so screens never invent copy.

Known backend gaps (from `docs/api-integration.md`): profile endpoint shape
unconfirmed, no JWS signature verification on the Apple webhook, no
`X-Request-ID` for support tracing.

---

## 6. Environments and release

`API.BASE_URL` resolves from `EXPO_PUBLIC_API_BASE_URL`, else **defaults to
production** — deliberately, so a build can never silently fall back to a stale
LAN IP that would look broken to App Review (guideline 2.1) and trip ATS.

| EAS profile | APP_ENV | API |
|---|---|---|
| development | local | env / LAN |
| simulator | local | `http://localhost:5263` |
| preview | staging | production API |
| production | production | production API |

- Release CI: `.github/workflows/ios-production.yml`
- Guardrail: `tools/ci/check-api-base-url.mjs` fails the build on a non-production URL
- ASC automation: `tools/asc/apply-subscription-prices.js`,
  `set-subscription-availability.js`, `upload-review-screenshots.js`
- Tests: `__tests__/billingRetry.test.js` (IAP retry loop),
  `__tests__/featureMatrix.test.ts` (gating matrix) — `npm test`, jest-expo
- Expo Go convenience: a fresh account with a zero balance gets 500 test credits
  once; the endpoint 404s in production so it is safe to ship (`src/api/dev.js`).

**Note:** `src/appstorekey/AuthKey_LY4822XN6Q.p8` is an App Store Connect private
key committed inside the repo and referenced from `eas.json`. If this repo is or
becomes non-private, that key should be revoked in ASC and moved to an EAS
secret.

---

## 7. Known unfinished work

- **Summarize / Explain / Ask AI** in `UploadScreen` are commented out, not
  shipped. They previously rendered a "soon" badge and a "coming soon" alert,
  which is a guideline 2.1 (App Completeness) rejection. The block is left in
  place to re-enable once `summarize_text` and `explain_text_detail` have live
  backend endpoints — do not un-comment it before then.
- `deep_clean` and `household_assistant` are declared in the feature matrix but
  have no screen yet.
- Expenses live only on-device; there is no backend expenses table, so they do
  not survive a reinstall or sync across devices.
- **AI Chat (§4.5c) and Smart Reminders (§4.5e) are not in this branch.** They
  exist only on `future/tier1-features`, along with `src/api/chat.js`,
  `AiChatScreen`, `reminderService` and `ReminderCard`. Sign & Fill (§4.5b) and
  Receipts / Expenses (§4.5d) have been ported over; those two have not, so the
  `AiChat` route and the reminder deep-link in `App.js` do not exist here yet.
- Android is unstarted.

---

## 8. Feature ideas

Ordered by (my read of) value-per-effort.

### Close the gaps in what just shipped
1. **Ship `summarize_text` / `explain_text_detail` backends** and un-comment the
   Upload AI row. It is the last visible hole in the paid feature set.
2. **Sync expenses to the backend** — an expenses table plus
   `GET/POST /api/expenses`. Right now a reinstall silently loses a user's whole
   expense history, which is the kind of thing that generates one-star reviews.
3. **Backend `detectedDates`** — `reminderService` already prefers it and falls
   back to client-side regex. Server-side extraction would make reminders
   accurate enough to advertise.
4. **Deep Clean** (plus tier) — declared in the matrix with credit key
   `junk_wiper_scan_report`; the obvious next step on top of Junk Wiper.
5. **Household Assistant** (advance tier) — declared, undefined. Worth deciding
   what it actually is, or dropping it from the matrix so the top tier isn't
   selling a blank.

### Extend the document core
6. **Folders / tags + saved searches** — Home already has tabs and search; the
   list will get unusable past ~100 docs without grouping.
7. **Multi-document Q&A** — "which of my invoices are unpaid?" across the corpus.
   Advance-tier, high perceived value, priced per query.
8. **Expense reporting on top of receipts** — capture, monthly totals and CSV
   already exist; add per-category budgets, a tax-year report, and mileage/
   per-diem rows. It is the cheapest path from a feature to a whole product for
   the freelancer persona.
9. **Translate document** — obvious credit sink, trivially explained to users.
10. **Compare two versions** — contract v1 vs v2 diff, highlighted. Rare but
   memorable; good marketing screenshot.
11. **Redact PII before sharing** — detect and black out on-device; a privacy
    feature that also sells the AI.

### Retention and growth
12. **Widgets + Share Sheet extension** — "Save to Paper AI" from Mail/Safari
    removes the biggest friction in the capture flow.
13. **Siri Shortcuts / App Intents** — "Hey Siri, scan a receipt."
14. **iCloud / Files export & auto-backup** — reassures users their docs aren't
    trapped.
15. **Credit top-up consumables** — a one-off pack for users who run dry
    mid-cycle. Currently the only path is upgrading the whole plan, which is a
    hard sell at the moment of need. Big revenue lever.
16. **Rollover / grace credits** — even 10% carry-over materially reduces churn
    at period boundaries; the current hard reset is the sharpest edge in the
    pricing model.
17. **Referral credits** — grant credits both ways; the ledger already supports
    arbitrary grants.

### Platform
18. **Android build** — same Expo codebase; IAP is the only real port work
    (Google Play Billing behind the existing billing service interface).
19. **iPad-optimised layout** — `supportsTablet` is already true, but the layouts
    are phone-shaped.
20. **Offline queue** — capture and OCR-queue without a connection, sync later.
21. **Family Sharing on subscriptions** — one ASC toggle, meaningfully widens the
    yearly plans' appeal.

### Worth doing regardless
- Wire `X-Request-ID` end-to-end so support can trace a user's failed purchase.
- Verify the Apple webhook's JWS signature — right now the payload is trusted.
- A "Restore Purchases" affordance audit before the next review cycle.
