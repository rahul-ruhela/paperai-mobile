# PaperAI — First App Store Release Runbook

Status date: 2026-07-16. Companion to the code changes in `paperai-mobile` and
`PaperAiApis` (branch state: mobile `production`, API `development`).

---

## 0. What already happened (done by Claude Code, verified locally)

**Backend (`C:\work\apis\PaperAiApis`)**
- Secrets stripped from all committed `appsettings*.json`; real values live in
  gitignored `appsettings.Local.json` (local) / IIS env vars (production).
  Startup now fails fast listing any missing required key.
- Config-driven IAP catalog (`IAP:Products`, 9 tiered SKUs + 3 legacy `pro_*`)
  replaces the hard-coded credit switch that ignored the 9 SKUs the app sells.
- `verify-transaction-auto` now checks production first, sandbox fallback.
- DB (shared SQL Server, already applied): unique index on
  `AppleTransactions.TransactionId`, filtered unique index on
  `TokenLedger(UserId, RefId, Reason)`, `Users.Role` column, EF migration
  history baselined. Duplicate grants are now impossible at the DB level.
- New endpoints (all verified with curl):
  - `POST/DELETE /api/admin/users/{id}/role`, `GET /api/admin/users/by-email`
    (admin = GUID listed in `Admin:UserIds` config; non-admin → 403)
  - `GET /api/developer-tester/status`, `POST /api/developer-tester/restore-credits`
    (topped up to `DeveloperTester:MaxBalance` = 1000; ledger reason
    `DEVELOPER_TEST_CREDIT`; 401/403/404 semantics per spec)
  - `DELETE /api/account` (App Store Guideline 5.1.1(v); PII purged, financial
    audit rows retained)

**Mobile (`c:\work\apps\paperai-mobile`)**
- Paywall: prices only from StoreKit (no fabricated fallbacks), per-product
  "Unavailable" state, missing-products banner with Retry, Terms/Privacy links.
- Settings: "Delete Account" flow (double confirm → `DELETE /api/account`).
- Removed dead screens (`SubscriptionScreen`, `SubscriptionGate`,
  `SubscriptionPlanCard`, `IAPSetupScreen`) and stale product-ID env plumbing
  from `.env.example` + all GitHub workflows.
- `npm audit fix`: axios 1.18.1, form-data 4.0.6 (runtime highs fixed).

### npm audit — what to fix and what to leave (reviewed 2026-08-27)

**Never run `npm audit fix --force` on this project.** Every remaining advisory
whose "fix" is a major bump resolves to an **Expo SDK 57** package
(`expo@57`, `expo-constants@57`, `expo-splash-screen@57`, …). The app is on
SDK 54. `--force` is an unplanned SDK upgrade wearing a security label.

The question that decides whether an advisory matters here is **does the
vulnerable module ship inside the .ipa**, not what npm's severity column says.
Almost nothing in this tree does: Metro, the Expo CLI, prebuild-config, xcode
and their dependencies run on the build machine. To reach them an attacker must
already be able to run your build.

To check rather than assume:

```
npx expo export --platform ios --source-maps --output-dir /tmp/x
# then read the `sources` array of the emitted .hbc.map — that is the
# definitive list of what is actually in the binary.
```

Fixed 2026-08-27 by tightening `overrides` in package.json — the previous pins
had gone stale as new advisories moved past them (29 -> 23 advisories):

| Package | Pin | Why |
|---|---|---|
| `nanoid` | `^3.3.18` | **Ships in the binary** (`nanoid/non-secure`). Stay on 3.x — 4+ is ESM-only and breaks the RN require. |
| `shell-quote` | `>=1.10.0` | was `>=1.8.4`; advisory grew to `<=1.8.4` |
| `undici` | `7.29.0` | was `7.28.0`; advisory covers `>=7.0.0 <7.29.0` |
| `tar` | `>=7.5.22` | was `>=7.5.16` (resolved 7.5.20); advisory covers `<=7.5.20` |
| `postcss` | `>=8.5.26` | advisory covers `<=8.5.22` |
| `fast-uri` | `^3.1.6` | advisory covers `<3.1.5` |

Then fixed the rest (23 -> 8, **zero moderate remaining**). The multi-major
ones need npm's version-selector override syntax — a plain `"js-yaml": "..."`
forces one version onto every consumer and breaks the build; `"js-yaml@3"` and
`"js-yaml@4"` patch each major in place:

| Package | Pin | Note |
|---|---|---|
| `brace-expansion@1` | `^1.1.18` | three majors live in the tree at once |
| `brace-expansion@2` | `^2.1.4` | |
| `brace-expansion@5` | `^5.0.9` | |
| `js-yaml@3` | `^3.15.2` | `@expo/config` uses 3.x, other tooling 4.x |
| `js-yaml@4` | `^4.3.2` | |
| `uuid` | `^11.1.1` | `xcode` declares `^7.0.3` but only ever calls `uuid.v4()`, which v11 still exports. Verified by parsing the real `project.pbxproj` and generating a UUID — do not assume this, re-test it if the pin moves. |

**The 8 that remain are all one root cause: `image-size`.** The other seven
(`metro`, `metro-config`, `metro-transform-worker`, `@expo/metro`,
`@expo/metro-config`, `@expo/cli`, `expo`) are just the dependency chain above
it. `image-size`'s own advisory range is `*` and its newest release (`2.0.2`)
is still inside it, so there is nothing to pin `image-size` itself to.

**Corrected 2026-08-28** — the note previously here was wrong, and acting on it
broke the dev server (see `troubleshooting.md` §1). Bumping **Metro** does clear
these 8: Metro **0.83.4+** dropped the `image-size` dependency entirely and
inlined its own `getAssetSize`. Verified on 0.83.8 — `image-size` appears
neither in its `dependencies` nor in `src/Assets.js`.

We still do not take it. Metro `^0.83.8` **breaks `expo start` on SDK 54**: that
same 0.83.4 release changed the `metro-file-map` change-event shape that
`@expo/cli@54.0.26` destructures, so the bundler dies on the first file change.
The pin buys a clean audit and costs you the dev server.

| Option | Audit | `expo start` |
|---|---|---|
| Metro 0.83.3 (Expo's pin) | 8 highs remain | works |
| Metro 0.83.8 | clean | **broken** |

**Never add a `metro*` override to `package.json`.** Metro's version belongs to
the Expo SDK. `npm audit fix --force` picks the major bump heuristically, not
because it understands this trade-off. Do not run it for this.

In practice it is Metro reading image dimensions from your own asset files at
build time; the DoS needs a hostile ICNS/JXL/HEIF input, which would mean
someone already put a malicious file in `assets/`. Re-check when SDK 57 is
planned; do not force it before then.

---

## 1. USER ACTIONS — blocking items

| # | Action | Why |
|---|--------|-----|
| 1 | Place `AuthKey_LY4822XN6Q.p8` at a local path and tell Claude the path | Enables the read-only App Store Connect audit (authoritative subscription map). **Gates the TestFlight build.** |
| 2 | Provide your production user account email (or GUID) to become admin | Goes into `Admin__UserIds__0`; only admins can grant DeveloperTester |
| 3 | Run (elevated PowerShell): `netsh advfirewall firewall add rule name="PaperAI API 5263" dir=in action=allow protocol=TCP localport=5263` | Lets your iPhone reach the local API at `http://192.168.29.223:5263` |
| 4 | **Activate the Paid Applications Agreement** (ASC → Business → Agreements) + complete banking/tax | Confirmed blocker: all subscription **price** writes return 409 until this is active (metadata + localizations already succeed). |
| 5 | After #4, run `node tools/asc/apply-subscription-prices.js` (or set prices in the ASC UI using the table below) | Applies the 9 base USA prices; Apple equalizes other territories |
| 6 | Upload a **review screenshot** per subscription in the ASC UI | Required for submission (not for sandbox testing) |

### Subscription prices + credits

> **This table is a copy, not the source of truth.** The authoritative values
> live in `src/constants/api.ts` (`SUBSCRIPTION_TIERS`) and, for what actually
> gets written to Apple, in `tools/asc/apply-subscription-prices.js`
> (`TARGET_USA_PRICE`). Those two agree today, verified against this table on
> 2026-08-27. If you are setting prices, run the script — do not hand-type from
> here. An earlier revision of this table listed a completely different set of
> prices and credits than the code was shipping, which is exactly how the wrong
> numbers reach App Store Connect.

| Product | Credits | USA price |
|---|---|---|
| essential_weekly | 13 | $12.99 |
| essential_monthly | 40 | $39.99 |
| essential_yearly | 353 | $299.99 |
| plus_weekly | 20 | $19.99 |
| plus_monthly | 60 | $59.99 |
| plus_yearly | 471 | $399.99 |
| advance_weekly | 30 | $29.99 |
| advance_monthly | 100 | $99.99 |
| advance_yearly | 706 | $599.99 |

Credits do not roll over: each renewal resets the balance to the plan's
allowance rather than adding to it. See `docs/api-integration.md`.

Yearly credits set at a 15% better per-credit rate than the monthly plan. Already
written to `src/constants/api.ts` and backend `IAP:Products`. ASC en-US
localizations + all metadata URLs already pushed via API. Prices are the only
ASC piece left, blocked on the agreement.

**Also confirm** OCR price: `image_ocr_extract_text` seed = **10 credits** (DB table
was empty so behavior unchanged) — just confirm 10 is right.

## 2. Local development (any machine)

- API: `appsettings.Local.json` must exist (copy keys from
  `appsettings.Example.json`). Run `dotnet run` → binds `0.0.0.0:5263`.
- App: create `.env.local` with `EXPO_PUBLIC_API_BASE_URL=http://<LAN-IP>:5263`
  (current machine: `192.168.29.223`). Unset → app uses the production API.

## 3. Production deployment (IIS) — ordered, each step reversible

### 3.0 SECRETS ON THE SERVER — one-time setup (fixes the 500.30)

**Put secrets in `appsettings.Local.json`, NEVER in `appsettings.json`.**

Why: `appsettings.json` is part of the publish output and carries the non-secret
config that changes each release (e.g. `IAP:Products` credits), so every
publish+paste **overwrites** it — any secrets typed into it on the server are wiped
on the next deploy. `appsettings.Local.json` is gitignored **and excluded from the
publish output** (`CopyToPublishDirectory=Never`), so a deploy never touches it.
It is loaded last, so its values win over `appsettings.json` /
`appsettings.Production.json`.

One-time server steps:
1. Copy `C:\work\apis\PaperAiApis\appsettings.Local.json` (dev machine — has all
   secrets) into the server's app folder, next to `PaperAi.dll` / `web.config`
   (e.g. `...\sites\apis.bseptechnologies.com\`).
2. Recycle the app pool.
3. `https://apis.bseptechnologies.com/health` → 200 Healthy.

After that: publish → paste → done, forever. Secrets are never re-entered.

**Verified 2026-07-16:** published to a clean folder (no Local.json in output,
secret-free appsettings.json), dropped `appsettings.Local.json` in, ran with
`ASPNETCORE_ENVIRONMENT=Production` → app booted, `/health` = 200 Healthy.

⚠️ Deploy with normal copy/paste or `xcopy`. Do NOT use `robocopy /MIR` or
`/PURGE` — those delete files not present in the source and would remove the
secrets file.

Production-only overrides also belong in the server's `appsettings.Local.json`,
e.g. during the TestFlight window:
`"DeveloperTester": { "Enabled": true }, "Admin": { "UserIds": [ "<your-user-GUID>" ] }`

To see a startup error on the server: Event Viewer → Windows Logs → Application
(source ".NET Runtime" / "IIS AspNetCore Module") shows the exact missing keys.

Alternative (no on-server file at all): env vars — see 3.1.

### 3.1 Set env vars on the IIS site (values = current secrets, BEFORE deploying)
Run per variable (elevated, replace SITE_NAME and values from `appsettings.Local.json`):

```
%windir%\system32\inetsrv\appcmd set config "SITE_NAME" -section:system.webServer/aspNetCore /+"environmentVariables.[name='Jwt__Key',value='...']" /commit:apphost
```

Variables required:
`Jwt__Key`, `ConnectionStrings__Default`, `AppleIap__SharedSecret`,
`AppleAppStoreServerApi__PrivateKeyP8`, `OpenAI__ApiKey`, `Resend__ApiKey`,
`Cloudinary__ApiKey`, `Cloudinary__ApiSecret`, `Twilio__Sid`, `Twilio__Token`,
`Redis__Password`, plus for the TestFlight window:
`DeveloperTester__Enabled=true`, `Admin__UserIds__0=<your-user-GUID>`.

Recycle the app pool. Old binary still reads JSON, so nothing changes yet.

### 3.2 Database
Already applied (2026-07-16): indexes, Role column, history baseline. Nothing to run.

### 3.3 Deploy the new binary
```
dotnet publish PaperAi.csproj -c Release -o <out>
```
Stop app pool → copy output → start. `appsettings.Local.json` is excluded from
publish automatically.

### 3.4 Smoke test
```
GET  https://apis.bseptechnologies.com/health            -> 200 Healthy
GET  https://apis.bseptechnologies.com/api/billing/entitlement (no token) -> 401
POST https://apis.bseptechnologies.com/api/developer-tester/restore-credits (normal user) -> 403
```

### 3.5 Rotate every leaked secret (after confirming env-var setup works)
All of these were committed to git history and must be rotated: SQL password,
JWT key (logs all users out — do before TestFlight invites), OpenAI, Resend,
Cloudinary, Twilio, Apple IAP shared secret, Redis. Update the IIS env var for
each; no code change needed.

## 4. Granting DeveloperTester (after deploy)

```powershell
$t = "<admin access token from login>"
# find the tester
Invoke-RestMethod "https://apis.bseptechnologies.com/api/admin/users/by-email?email=tester@example.com" -Headers @{Authorization="Bearer $t"}
# grant
Invoke-RestMethod -Method Post "https://apis.bseptechnologies.com/api/admin/users/<GUID>/role" -Headers @{Authorization="Bearer $t"} -ContentType "application/json" -Body '{"role":"DeveloperTester"}'
```

Tester tops up from their own token:
```powershell
Invoke-RestMethod -Method Post "https://apis.bseptechnologies.com/api/developer-tester/restore-credits" -Headers @{Authorization="Bearer <tester token>"}
```

## 5. TestFlight (after ASC audit confirms the 9 SKUs)

1. Commit + push both repos (mobile: `production` branch or per your flow).
2. GitHub → Actions → **iOS TestFlight (Sandbox Testing)** → Run workflow.
   (Or locally: `eas build --profile production --platform ios` + `eas submit`.)
3. On-device: sign into Settings → App Store → Sandbox Account with
   `paperai.sandbox.test@gmail.com`.
4. Device checklist: startup · email-OTP login · Sign in with Apple · upload/
   camera/PDF · OCR · summarize · explain · Ask AI · credits · paywall shows 9
   live prices (no "Unavailable") · buy one SKU per tier → credits match
   catalog (15/60/780 · 40/160/2080 · 80/320/4160) · sandbox renewal grants
   once per transaction · Restore Purchases · upgrade/downgrade ·
   cancel/expire · ACTIVE PLAN badge · DeveloperTester top-up · account
   deletion · reinstall · offline behavior.

## 5a. `Entitlements:Enforce` — the flip, and when to do it

Set in `appsettings.Local.json` on the VPS. `Enforce: false` restores the
pre-2026-08-28 credits-only behaviour; `true` enforces the feature matrix.

**Why it is currently false.** The App Store build 1.0.1 (43) predates the
entitlement error contract: it renders ANY 403 as *"You don't have permission
to do this."* — no paywall, no upgrade path. With enforcement on, a reviewer on
a free account hits that dead end on AI Document Analysis, OCR, Summarize,
Receipt Extraction and AI Chat, all of which worked before the API deploy.
Builds 1.0.2+ handle `FEATURE_NOT_INCLUDED` and `SUBSCRIPTION_EXPIRED`
properly, so the constraint is entirely about which build is LIVE.

**The rule: flip it when the last build that cannot handle 403 stops being
reachable by a user.** TestFlight is not that moment — App Store is.

| Stage | Enforce | Why |
|---|---|---|
| Now — 1.0.1 (43) in review | **false** | A reviewer on a free account would hit a dead end on core features. |
| 1.0.2+ on TestFlight, 1.0.1 still live | **false** | TestFlight changes nothing for App Store users, who are still on 1.0.1. |
| 1.0.2+ **approved and live** on the App Store | **true** | Every user can now be handed a 403 they can act on. |

Flipping early does not corrupt data — it changes what `/api/credits/reserve`
returns. The damage is a bad user experience on old builds, and a possible
rejection while a build is in review.

**To flip:**

1. Edit `Entitlements.Enforce` to `true` in the VPS `appsettings.Local.json`.
2. **Restart the API.** It binds through `IOptions<T>`, resolved once at
   startup — editing the file alone changes nothing.
3. Verify with a free account (no active plan, created after 2026-08-28):

   ```bash
   curl -i https://apis.bseptechnologies.com/api/entitlements/check/ai_chat \
     -H "Authorization: Bearer <TOKEN>"
   ```

   `403 FEATURE_NOT_INCLUDED` = enforcing. `200 {"allowed":true}` = still off.
   The route is a GET and spends no credits.

**Rolling back** is the same edit in reverse plus a restart. Nothing persists a
decision made while enforcement was on, so a rollback is clean.

**Grandfathering is unaffected by the flag.** Subscriptions created before
`GrandfatherBeforeUtc` (2026-08-28) keep the wider access credits-only gating
gave them, for as long as they stay continuously active.

---

## 6. Submission prep (do NOT submit until approved)

- Deploy the updated BsepTechnologiesSite (C:\work\web-apps\BsepTechnologiesSite):
  corrected /paper-ai/privacy (accurate data practices + in-app deletion), updated
  /paper-ai/support FAQ, NEW /paper-ai/terms page, accurate marketing copy.
  Then verify all three URLs return 200. App links now point to /paper-ai/*.
- ASC: App Privacy questionnaire; attach subscriptions to the version; review
  screenshot per subscription; review notes with a demo account + "purchases
  use Apple sandbox" + "account deletion: Settings → Delete Account".

## Known limitations / flags

- Deleted-account JWTs stay valid ≤30 min on endpoints that don't re-check the
  user row (stateless tokens; app clears tokens on delete).
- Sign in with Apple **token revocation** on account deletion is not possible
  yet: the backend never exchanges the authorization code, so there is no
  Apple token to revoke. Follow-up: exchange `authorizationCode` at login and
  store the refresh token. Deletion itself works and is compliant in practice.
- CORS is fully open (`AllowAnyOrigin`) — acceptable for a mobile API; tighten later.
- Git history still contains the old secrets even after rotation; consider a
  history rewrite or fresh repo if the repo ever becomes shared.
