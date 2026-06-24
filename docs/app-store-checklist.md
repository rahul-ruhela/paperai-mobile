# iOS App Store Submission Checklist — PaperAI

Use this checklist every time you submit a build for review. Go top to bottom — each section must be complete before moving to the next.

---

## Phase 1 — Before You Build

- [ ] `app.json` version and `buildNumber` are correct (bump buildNumber on each new binary)
- [ ] `.env` for production has `EXPO_PUBLIC_APP_ENV=production` and `EXPO_PUBLIC_API_BASE_URL=https://apis.bseptechnologies.com`
- [ ] All 3 IAP product IDs in `eas.json` production env block match App Store Connect exactly
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
- [ ] Purchase **Weekly** plan → IAP sheet appears → purchase completes → Pro access granted
- [ ] Purchase **Monthly** plan (new sandbox account) → works correctly
- [ ] Purchase **Yearly** plan (new sandbox account) → works correctly
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
- [ ] **Support URL** set: `https://bseptechnologies.com/support`
- [ ] **Privacy Policy URL** set: `https://bseptechnologies.com/privacy` ← required for subscription apps
- [ ] **Marketing URL** set (optional): `https://bseptechnologies.com`

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

- [ ] Subscription group **Pro Plans** exists
- [ ] `com.bholeshankar.paperai.pro_weekly` → Status: **Ready to Submit**
- [ ] `com.bholeshankar.paperai.pro_monthly` → Status: **Ready to Submit**
- [ ] `com.bholeshankar.paperai.pro_yearly` → Status: **Ready to Submit**
- [ ] Each product has English display name and description filled in
- [ ] Each product has pricing set

> If any product shows "Missing Metadata", click it → Localizations → Add English → fill in display name and description.

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

All 3 subscription products (weekly, monthly, yearly) are in Ready to Submit status.
Camera and photo permissions are requested only when the user tries to upload a document.
```

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
