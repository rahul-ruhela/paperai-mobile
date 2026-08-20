# Tier 5 — Retention & growth

Features that make people come back and bring others. Individually small, they
compound — and several are cheaper to build than anything in Tier 3.

Each section is independently assignable.

---

## 5.1 — Daily free credit

**Branch:** `feat/daily-credit` · **Effort:** S

One free credit per day, claimed with a tap. Builds the daily-open habit and lets
free users experience paid features — which is what actually converts them.

- Files: `src/ui/DailyCreditCard.js`, shown on `HomeScreen`.
- Backend needed: `POST /api/credits/claim-daily` → `{ claimed, credits, nextClaimAtUtc }`.
  **Must be server-authoritative** — a client-side date check is trivially defeated
  by changing the device clock.
- UI: a card on Home with a countdown to the next claim. Small celebratory
  animation on claim (reuse `AiOrb` state `"done"`).
- Optional streak multiplier: day 7 gives 3 credits. Pairs with 5.2.
- **Done when:** claiming works once per 24h and cannot be farmed by clock changes.

---

## 5.2 — Streaks & achievements

**Branch:** `feat/streaks` · **Effort:** M

- Badges: "Cleaned 10 GB", "50 documents analysed", "7-day streak", "First invoice".
- Files: `src/screens/AchievementsScreen.js`, `src/services/achievementService.js`.
- Backend: `GET /api/achievements`, or compute client-side from existing counters
  if you want to ship faster.
- Show progress toward the *next* badge, not just earned ones — progress is the
  motivator. Notify on unlock (respect the 1.2/2.5 permission helper).
- **Done when:** badges unlock correctly and survive reinstall (server-backed).

---

## 5.3 — Referral program

**Branch:** `feat/referrals` · **Effort:** M

5 credits to both sides on a successful referral. Cheapest acquisition channel you have.

- Files: `src/screens/ReferralScreen.js`, entry point in `SettingsScreen`.
- Backend: `GET /api/referrals/code`, `POST /api/referrals/redeem { code }`,
  `GET /api/referrals/stats`.
- **Fraud controls are mandatory** — credit the referrer only after the referee
  completes a real action (first analysis), cap referrals per account, and reject
  self-referral by device ID. Otherwise this becomes a free-credit generator.
- Share via `Share` API with a deep link. Requires a universal link / app-scheme
  route to handle the install → redeem path.
- **Done when:** a real end-to-end referral credits both accounts exactly once.

---

## 5.4 — Rewarded ad → 1 credit

**Branch:** `feat/rewarded-ads` · **Effort:** M

Monetises the users who will never subscribe. Watch a 30s ad, get a credit.

- Requires `react-native-google-mobile-ads` (**not installed**) + an AdMob account.
  This adds a native dependency — it will not work in Expo Go, only dev-client builds.
- **Server-side reward verification is required** (AdMob SSV callback → your
  backend grants the credit). Never grant credits from a client callback.
- Cap at 3–5 per day so it does not cannibalise subscriptions.
- **App Store:** you must declare advertising in the privacy nutrition labels and
  present ATT (`expo-tracking-transparency`) if the ads are personalised. Update
  `docs/app-store-listing.md`.
- **Done when:** a completed ad grants exactly one credit, verified server-side.

---

## 5.5 — Home widget + iOS Share Extension

**Branch:** `feat/widget-share-ext` · **Effort:** L

**The Share Extension is the highest-leverage item in this tier.** "Share to PaperAI"
from Mail, Files, Photos or Safari turns the app from a destination into a reflex.

- Both require **native code** — a config plugin plus Swift. This cannot be done in
  Expo Go; it needs a dev-client/EAS build and an app group for shared storage.
- Share extension: accept PDF/image/text → save to the app group → open the app to
  the upload flow with the file pre-attached.
- Widget: show credits remaining + last document + a "Scan now" deep link.
  WidgetKit, small and medium sizes.
- Budget real time for this one; it is the only Tier 5 item with native complexity.
- **Done when:** sharing a PDF from Mail lands it in the app ready to analyse.

---

## 5.6 — Folders, tags, favourites

**Branch:** `feat/folders-tags` · **Effort:** M

`HomeScreen` currently offers search plus four tabs. Past ~50 documents that stops
scaling, and heavy users — the ones who pay — are exactly the ones who hit it.

- Files: `src/screens/FolderScreen.js`, updates to `HomeScreen`.
- Backend: `folderId` and `tags[]` on the document model, plus folder CRUD.
- Drag-to-folder, colour-coded tags, a tag filter row above the list.
- Pins already exist client-side in `HomeScreen` (`pinnedIds`) but are **lost on
  app restart** — persist them as part of this work.
- **Done when:** folders and tags persist server-side and filtering is fast at 500 docs.

---

## 5.7 — Face ID document vault

**Branch:** `feat/vault` · **Effort:** S

A locked folder for passports, IDs and bank documents.

- `expo-local-authentication` is **not installed** — add it.
- Files: `src/screens/VaultScreen.js`.
- Lock on backgrounding, re-auth on return. Hide vault thumbnails from the normal
  document list and from the app switcher snapshot.
- Fall back to a device passcode when biometrics are unavailable; never leave the
  vault unlockable by no method at all.
- **Done when:** vault contents are inaccessible without authentication, including
  after backgrounding.

---

## 5.8 — Cloud sync + web access

**Branch:** `feat/cloud-sync` · **Effort:** XL

Documents already live server-side, so mobile sync is largely there. The real work
is a **web client** — and that is a separate project, not a mobile ticket.

- Mobile side: conflict handling, offline queue, sync status indicator.
- Do not start this before Tier 1 and 2 are done. It is a large investment that
  helps existing users rather than acquiring new ones.
- **Done when:** a document uploaded on mobile appears on web and vice versa.

---

## 5.9 — Family sharing (Advance tier)

**Branch:** `feat/family-sharing` · **Effort:** L

Up to 5 members share one credit pool. Makes the Advance tier's price defensible
and is a prerequisite for pack 4.3.

- Backend: family groups, invitations, shared credit pool with per-member usage
  attribution, an admin who can see usage.
- Apple Family Sharing must be enabled on the subscription in App Store Connect —
  see `docs/appstore-connect-setup.md`.
- Per-member privacy: shared documents vs private ones must be clearly separated,
  and the default must be **private**.
- **Done when:** five accounts draw from one pool with correct attribution, and
  private documents stay private.

---

## Sequencing suggestion

`5.1 → 5.3 → 5.6 → 5.5 → 5.2` — the first three are cheap and compound, 5.5 is the
big unlock, 5.2 glues them together. Leave 5.4, 5.7, 5.8, 5.9 until the app has
retention worth scaling.
