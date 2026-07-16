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
  Remaining 2 highs are build-time-only (`@xmldom/xmldom` inside
  `@expo/prebuild-config`) — do not force-fix before release.

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

### Final agreed subscription prices + credits (applied to code; ASC pending agreement)
| Product | Credits | USA price |
|---|---|---|
| essential_weekly | 15 | $15.99 |
| essential_monthly | 60 | $57.90 |
| essential_yearly | 560 | $459.00 |
| plus_weekly | 40 | $42.49 |
| plus_monthly | 160 | $153.99 |
| plus_yearly | 850 | $699.00 |
| advance_weekly | 80 | $85.00 |
| advance_monthly | 320 | $309.00 |
| advance_yearly | 1100 | $899.00 |

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
