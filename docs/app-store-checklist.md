# iOS App Store Submission Checklist — PaperAI

Use this checklist every time you submit a build for review. Go top to bottom — each section must be complete before moving to the next.

---

## Phase 1 — Before You Build

- [ ] `app.json` version and `buildNumber` are correct (bump buildNumber on each new binary)
- [ ] `.env` for production has `EXPO_PUBLIC_APP_ENV=production` and `EXPO_PUBLIC_API_BASE_URL=https://apis.bseptechnologies.com`
- [ ] All 9 IAP product IDs in `src/constants/api.ts` (`SUBSCRIPTION_TIERS`) match App Store Connect exactly
- [ ] Backend `appsettings.Production.json` has `IAP:Enabled:true`, `AllowSandbox:false`, `DevMode:BypassSubscription:false`

---

## Phase 2 — Build and Upload

- [ ] `eas build --profile production --platform ios` completes without error
- [ ] Build appears in App Store Connect → TestFlight (processing: ~15 min)
- [ ] Build status changes from "Processing" to "Ready to Test" in TestFlight

---

## Phase 3 — Internal TestFlight Testing (Required)

Test on a real device using the TestFlight app. Use a **Sandbox Apple ID** for IAP.

### Account flow
- [ ] Register a new account with any email
- [ ] Log in / log out works
- [ ] OTP email verification works

### Document flow
- [ ] Camera permission dialog appears correctly
- [ ] Photo library permission dialog appears correctly
- [ ] Upload a document → AI analysis result shows
- [ ] AI results display correctly

### Subscription / IAP flow (Critical — Apple will test this)
- [ ] On device: Settings → App Store → scroll down → Sandbox Account → sign in with sandbox tester
- [ ] Trigger the paywall / subscription screen
- [ ] All 9 SKUs load real prices from StoreKit (no "UNAVAILABLE" / fallback prices shown)
- [ ] Purchase a **Weekly** plan → IAP sheet appears → purchase completes → credits granted
- [ ] Purchase a **Monthly** plan (new sandbox account) → works correctly
- [ ] Purchase a **Yearly** plan (new sandbox account) → works correctly
- [ ] Upgrade across tiers (Essential → Plus) inside the group → proration handled, no duplicate charge
- [ ] **Restore Purchases** button works → restores active subscription
- [ ] Cancel subscription in iOS Settings → verify app handles expiry gracefully

### Stability
- [ ] No crashes during normal use
- [ ] App recovers gracefully when backend is unreachable
- [ ] Push notifications received (if applicable)

---

## Phase 4 — App Store Connect Listing

Go to: **App Store Connect → Apps → Paper Ai Assistant → App Store tab**

### App Information
- [ ] App Name: `Paper Ai Assistant`
- [ ] Subtitle: `AI Document Scanner & Analyzer` (optional, 30 chars)
- [ ] Bundle ID: `com.bholeshankar.paperai`
- [ ] Primary Language: English (U.S.)
- [ ] Content Rights answered
- [ ] Category set (e.g. Productivity)

### Localizations — English (U.S.)
- [ ] **Description** written (4000 chars max) — see README Section 6 for copy
- [ ] **Promotional Text** written (170 chars max)
- [ ] **Keywords** set (100 chars max): `AI,document,scanner,PDF,analyzer,OCR,paper,assistant,extract,summarize,receipt,invoice`
- [ ] **Support URL** set: `https://bseptechnologies.com/paper-ai/support`
- [ ] **Privacy Policy URL** set: `https://bseptechnologies.com/paper-ai/privacy` ← required for subscription apps
- [ ] **Marketing URL** set (optional): `https://bseptechnologies.com`
- [ ] **Description ends with the subscription + legal block below** ← Apple rejects automatically without it

> **Guideline 3.1.2 — Terms of Use (EULA) link is mandatory in the Description.**
> The automated reviewer scans the App Description text for a Terms of Use URL. An in-app
> Terms screen and the Privacy Policy URL field are **not** enough — this exact rejection
> already happened once. Paste this block at the end of the English (U.S.) Description:
>
> ```
> Paper Ai Assistant offers auto-renewable subscriptions. Payment is charged to your
> Apple ID at confirmation of purchase. Subscriptions renew automatically unless
> cancelled at least 24 hours before the end of the current period. Manage or cancel
> in App Store › Account › Subscriptions.
>
> Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
> Privacy Policy: https://bseptechnologies.com/paper-ai/privacy
> ```
>
> Use Apple's **standard** EULA URL above — the checker always recognises it. Only swap in
> `https://bseptechnologies.com/paper-ai/terms` if you also paste the full custom EULA text
> into App Information → License Agreement (a URL alone is rejected there).
> This is metadata-only: fixing it needs **no new build** — edit, save, resubmit the same binary.

### Screenshots (Required)
- [ ] 6.9" iPhone 16 Pro Max screenshots uploaded (minimum 1, maximum 10) ← **REQUIRED**
- [ ] 6.5" iPhone 15 Plus screenshots uploaded ← Recommended
- [ ] Screenshots show real app UI (Home, Document Analysis, Paywall, Login)
- [ ] Screenshots are at correct resolution (see README Section 7)

### Build Selection
- [ ] Build selected under the "Build" section (click + and pick your latest production build)
- [ ] Build shows "Ready to Submit" status (not "Processing")

### Age Rating
- [ ] Age Rating questionnaire completed → result is **4+**

### Pricing and Availability
- [ ] Base price: **Free**
- [ ] Available in desired territories

---

## Phase 5 — In-App Purchases (Critical)

Go to: **App Store Connect → your app → Monetization → In-App Purchases → Subscriptions**

- [ ] Subscription group exists with all 9 products inside it (required for upgrade/downgrade)
- [ ] Each of these is **Ready to Submit** (prefix `com.bholeshankar.paperai.`):
  - [ ] `essential_weekly` · `essential_monthly` · `essential_yearly`
  - [ ] `plus_weekly` · `plus_monthly` · `plus_yearly`
  - [ ] `advance_weekly` · `advance_monthly` · `advance_yearly`
- [ ] Each product has English display name and description filled in
- [ ] Each product has a price **schedule covering all territories** (see note below)

> If a product shows "Missing Metadata": click it → Localizations → Add English → fill in
> display name and description. If it *still* shows Missing Metadata with localization done,
> the cause is an incomplete price schedule — set the price for **all territories**, not just
> the base one. Products stuck in Missing Metadata are silently dropped from the StoreKit
> fetch, so the paywall renders them as "UNAVAILABLE".

---

## Phase 6 — App Review Information

Go to: **App Store Connect → App Review Information**

- [ ] **Sign-in required:** Yes
- [ ] Demo account email: your sandbox tester email
- [ ] Demo account password: your sandbox tester password
- [ ] **Review Notes** filled in explaining:
  - What the app does
  - How to trigger the subscription purchase flow
  - That sandbox Apple ID should be used for IAP testing
  - Backend API URL and health check URL

**Review Notes template:**
```
This app is an AI-powered document analysis tool. Users can scan, upload, and analyze documents.

For testing In-App Purchases, please use the sandbox Apple ID provided above.

Subscription test flow:
1. Register or log in (any email works)
2. Upload any document to trigger AI analysis
3. The paywall appears after free usage
4. Use the sandbox Apple ID to complete a subscription purchase

Backend API: https://apis.bseptechnologies.com
Health check: https://apis.bseptechnologies.com/health

All 9 subscription products (Essential / Plus / Advance × weekly / monthly / yearly)
are in Ready to Submit status within a single subscription group.
Camera and photo permissions are requested only when the user tries to upload a document.

Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://bseptechnologies.com/paper-ai/privacy
```

---

## Phase 6.5 — Rejection-risk audit (verified 2026-08-06)

Checked against the live App Review Guidelines. Green items are already handled in code —
don't regress them.

| Guideline | Requirement | Status |
|-----------|-------------|--------|
| 3.1.2 metadata | Terms of Use (EULA) link in **App Description** | ❌ **This caused the rejection** — see Phase 4 |
| 3.1.2 metadata | Privacy Policy link in metadata | ✅ URL field + description block |
| 3.1.2 binary | Subscription name, duration, what the plan provides | ✅ `PaywallScreen` tier name + duration tab + credits line |
| 3.1.2 binary | Full renewal price, live and localized from StoreKit | ✅ `displayPrice` only — never a hardcoded price |
| 3.1.2 binary | Restore / sign-in path for existing subscribers | ✅ Restore Purchases button |
| 3.1.2 binary | Auto-renew + cancellation disclosure on the purchase screen | ✅ legal block above the Terms/Privacy links |
| 3.1.1 | No purchase path outside IAP | ✅ no external checkout anywhere in `src/` |
| 4.8 | Sign in with Apple offered alongside other login | ✅ `LoginScreen` Apple button |
| 5.1.1(v) | In-app account deletion (not just deactivate) | ✅ Settings › Delete Account, two-step confirm |
| 5.1.1 | Purpose strings for camera / photos / media library | ✅ all set in `app.json` |
| 5.1.2 | Privacy manifest present | ✅ `ios/PaperAiAssistant/PrivacyInfo.xcprivacy` |
| 2.1 | Reviewer can sign in without receiving an OTP email | ✅ email + password login works standalone — **give a password account, not an OTP-only one** |
| 2.1 | No dead ends when out of credits | ✅ "Not enough credits" alerts route to the paywall |

### The two highest remaining risks

1. **Subscriptions must be attached to this version's submission.** Your first auto-renewable
   subscription has to be submitted *together with an app version*, and each new subscription
   must be submitted with its subscription group. Editing a subscription's display name — as
   was just done for Essential / Plus / Advance — drops it back to "Ready to Submit", so it
   must be re-added to the submission. If they aren't attached, the reviewer cannot purchase
   and the app is rejected under 2.1 / 3.1.2.
2. **Any SKU not returned by StoreKit renders as "UNAVAILABLE"** on the paywall (by design —
   the app never fabricates a price). If the reviewer sees that, expect rejection. Confirm all
   9 products load real prices in TestFlight *before* submitting.

---

## Phase 7 — Submit

- [ ] Click **"Add for Review"** (top right of the App Store listing page)
- [ ] Export Compliance: **No** (uses HTTPS only, `ITSAppUsesNonExemptEncryption: false`)
- [ ] Click **"Submit to App Review"**
- [ ] Confirmation email received from Apple

Expected review time: **24–48 hours** for first submission.

---

## Phase 8 — Post-Approval

- [ ] App Status changes to **"Pending Developer Release"** or **"Ready for Sale"**
- [ ] If Pending Developer Release: click **Release This Version** in App Store Connect
- [ ] App appears on the App Store (may take 1–2 hours to propagate)
- [ ] Test a real purchase on a production device (can be refunded within 48h from Apple)
- [ ] Verify App Store Server Notifications are firing correctly (check backend logs)
- [ ] Verify subscriptions are activating and credits are being applied correctly

---

## Android Play Store Checklist (Future)

- [ ] Google Play Console account created ($25 one-time fee)
- [ ] App created with package `com.bholeshankar.paperai`
- [ ] Android App Bundle (AAB) built: `eas build --profile production --platform android`
- [ ] Signing keystore created and backed up securely
- [ ] Google Play Billing product IDs created
- [ ] Internal testing track set up
- [ ] Data safety section completed
- [ ] Target API level 34+ confirmed

---

## Subscription Testing Reference

### TestFlight / Sandbox environment
- Backend config: `IAP:AllowSandbox: true` ✅
- Use a Sandbox Apple ID (Settings → App Store → Sandbox Account)
- Sandbox subscriptions renew much faster (1 week = 3 minutes, 1 month = 5 minutes)

### Production environment
- Backend config: `IAP:AllowSandbox: false` ✅
- Backend config: `DevMode:BypassSubscription: false` ✅
- Real money charged — test purchase can be refunded within 48h

---

## API Failure Testing Checklist

- [ ] Kill backend → app opens, shows login screen, no crash
- [ ] Login with wrong password → friendly error shown
- [ ] Login with backend down → "No connection. Please check your internet"
- [ ] Home screen with backend down → empty state shown, no crash
- [ ] Paywall with backend down → paywall renders, subscribe fails gracefully
- [ ] Token expired → auto-refresh happens silently
- [ ] Token expired and refresh fails → user redirected to login gracefully
