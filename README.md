# PaperAI Mobile

React Native / Expo SDK 54 — iOS App Store + Android (future)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local development](#2-local-development)
3. [Project structure](#3-project-structure)
4. [Environment variables](#4-environment-variables)
5. [Test credits (dev only)](#5-test-credits-dev-only)
6. [iOS build with EAS](#6-ios-build-with-eas)
7. [TestFlight step-by-step guide (beginner-friendly)](#7-testflight-step-by-step-guide-beginner-friendly)
8. [Submit to App Store — Full Step-by-Step](#8-submit-to-app-store--full-step-by-step)
9. [App Store Screenshots — How to Generate](#9-app-store-screenshots--how-to-generate)
10. [Why TestFlight is Required](#10-why-testflight-is-required)
11. [CI/CD with GitHub Actions](#11-cicd-with-github-actions)
12. [Subscription / IAP behaviour by environment](#12-subscription--iap-behaviour-by-environment)
13. [Android future](#13-android-future)
14. [App Store Connect setup checklist](#14-app-store-connect-setup-checklist)
15. [Apple Developer credentials you need](#15-apple-developer-credentials-you-need)
16. [GitHub Secrets required](#16-github-secrets-required)
17. [Build failure history & root causes](#17-build-failure-history--root-causes)
18. [Troubleshooting](#18-troubleshooting)

---

## 1. Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 20+ | https://nodejs.org |
| npm | 10+ | bundled with Node |
| EAS CLI | latest | `npm install -g eas-cli` |
| Expo account | — | https://expo.dev (free) |
| Apple Developer account | — | https://developer.apple.com ($99/year) |

---

## 2. Local development

### Step 1 — Install dependencies

```bash
cd paperai-mobile
npm install
```

### Step 2 — Set your local API URL

Find your machine's IP address:
- **Windows:** `ipconfig` → look for IPv4 Address under your Wi-Fi adapter
- **Mac:** `ifconfig en0 | grep inet`

Create `.env.local` (already gitignored — never committed):

```bash
copy .env.example .env.local
```

Edit `.env.local`:

```env
EXPO_PUBLIC_APP_ENV=local
EXPO_PUBLIC_API_BASE_URL=http://YOUR_MACHINE_IP:5263
EXPO_PUBLIC_APPLE_WEEKLY_PRODUCT_ID=com.bholeshankar.paperai.pro_weekly
EXPO_PUBLIC_APPLE_MONTHLY_PRODUCT_ID=com.bholeshankar.paperai.pro_monthly
EXPO_PUBLIC_APPLE_YEARLY_PRODUCT_ID=com.bholeshankar.paperai.pro_yearly
```

> Your phone and PC must be on the **same Wi-Fi network**. The IP changes if you reconnect — update `.env.local` and the fallback in `src/constants/api.ts` when it does.

### Step 3 — Start the API backend

```bash
cd ..\..\..\api\PaperAiApis\PaperAi
dotnet run
# API now running at http://0.0.0.0:5263
```

### Step 4 — Allow API through Windows Firewall (one time, run PowerShell as Administrator)

```powershell
netsh advfirewall firewall add rule name="PaperAI API Dev 5263" dir=in action=allow protocol=TCP localport=5263 profile=private,domain
```

### Step 5 — Start Expo

```bash
cd paperai-mobile
npx expo start --clear
```

Scan the QR code with your iPhone using the **Expo Go** app.

> **IAP on Expo Go:** Apple In-App Purchases are not available in Expo Go. The paywall falls through to the mock subscribe endpoint (backend allows this in dev mode via `DevMode:BypassSubscription=true`). This is expected.

---

## 3. Project structure

```
paperai-mobile/
├── assets/               Static images (icon, splash, logo)
├── src/
│   ├── api/              All API calls
│   │   ├── client.js     Axios instance + JWT refresh interceptor
│   │   ├── auth.js       Login, register, email OTP, phone OTP
│   │   ├── credits.js    Credit balance, reserve/complete/refund
│   │   └── documents.js  Upload, process, OCR
│   ├── constants/
│   │   └── api.ts        API base URL resolver + IAP product IDs
│   ├── screens/          One file per screen
│   ├── storage/
│   │   └── tokenStore.js JWT tokens in expo-secure-store
│   └── ui/               Reusable UI components (CreditConfirmModal, etc.)
├── app.json              Expo config (bundle ID, permissions, plugins)
├── eas.json              EAS build + submit profiles
├── .env.example          Template — copy to .env.local, never commit real values
└── .github/workflows/    CI/CD pipelines
```

---

## 4. Environment variables

All variables prefixed `EXPO_PUBLIC_` are baked into the JS bundle at build time by Metro/EAS.

| Variable | Used for |
|----------|----------|
| `EXPO_PUBLIC_API_BASE_URL` | Backend API base URL |
| `EXPO_PUBLIC_APP_ENV` | `local` / `staging` / `production` |
| `EXPO_PUBLIC_APPLE_WEEKLY_PRODUCT_ID` | IAP product ID |
| `EXPO_PUBLIC_APPLE_MONTHLY_PRODUCT_ID` | IAP product ID |
| `EXPO_PUBLIC_APPLE_YEARLY_PRODUCT_ID` | IAP product ID |

- **Local dev:** set in `.env.local`
- **EAS builds:** set in `eas.json` under each profile's `env` block
- **GitHub Actions:** set as GitHub Secrets (see section 16)

---

## 5. Test credits (dev only)

When developing locally, you often run out of credits while testing OCR, JunkWiper, and AI analysis.
There is a **dev-only** endpoint to grant yourself credits without going through IAP.

### How it works

The endpoint is **completely blocked in production** — it returns 404 when:
- `DevMode:AllowTestCredits` is not `true` in appsettings, OR
- The API is running in the `Production` environment

It only works when **both** conditions are true:
1. `appsettings.Development.json` has `"AllowTestCredits": true` (already set)
2. The API is running with `ASPNETCORE_ENVIRONMENT=Development` (default when you `dotnet run` locally)

### Grant yourself test credits

```bash
# Replace YOUR_JWT_TOKEN with the token from your logged-in session
# (copy from the app's token store, or from the network tab in your API logs)

curl -X POST http://localhost:5263/api/dev/grant-credits \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 500}'
```

Response:
```json
{
  "granted": 500,
  "balance": 550,
  "warning": "Test credits only. This endpoint is disabled in production."
}
```

### Check dev mode status

```bash
curl http://localhost:5263/api/dev/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Getting your JWT token

You can copy your current access token in two ways:

**Option A — from the app logs:**
When you log in, the API returns an `accessToken`. Watch the terminal where `dotnet run` is running — it logs all requests.

**Option B — from SecureStore (dev build):**
Add a temporary screen or console log in `src/storage/tokenStore.js`:
```js
import * as SecureStore from 'expo-secure-store';
const token = await SecureStore.getItemAsync('accessToken');
console.log('TOKEN:', token);
```

### Grant credits from an API client (Postman / Insomnia)

1. Open Postman
2. `POST http://localhost:5263/api/dev/grant-credits`
3. Headers: `Authorization: Bearer <token>`, `Content-Type: application/json`
4. Body: `{ "amount": 1000 }`
5. Click Send

Maximum per call: **10,000 credits**. Call it multiple times if needed.

### Why this is safe

- Returns **404** (not 403) in production so it doesn't reveal the endpoint exists
- Guarded by `ASPNETCORE_ENVIRONMENT != Production` — cannot be enabled by config alone in prod
- `AllowTestCredits` key is not present in `appsettings.Production.json` (defaults to `false`)
- Logs a warning so any accidental use is visible in server logs

---

## 6. iOS build with EAS

### One-time setup

```bash
eas login       # log in with your expo.dev account
eas whoami      # confirm logged in
```

EAS handles certificates and provisioning profiles automatically. On first build it will ask for your Apple ID and Team ID.

### Build for iOS Simulator (no Apple account needed)

```bash
eas build --profile simulator --platform ios
```

### Build for TestFlight (internal testing)

```bash
eas build --profile preview --platform ios
```

- Builds on EAS cloud Mac servers (~15–25 min)
- Automatically uploaded to App Store Connect → TestFlight
- Install via TestFlight app on your iPhone

### Build for App Store (production release)

```bash
eas build --profile production --platform ios
```

> **Production builds are MANUAL ONLY.** Never push to the `production` branch to trigger a build — use the GitHub Actions manual trigger or run the command above locally.

---

## 7. TestFlight step-by-step guide (beginner-friendly)

This section covers everything from zero to installing the app on your iPhone via TestFlight. Read this before doing anything else.

---

### What is TestFlight?

TestFlight is Apple's free beta testing app. Before your app goes on the App Store, you upload it to TestFlight first. This lets you install and test the exact same app binary that will go live — including real camera, real photos, real subscriptions, and real API calls.

**Why not just use Expo Go?**
Expo Go is a generic development app. It cannot run:
- Camera document scanner (native module)
- Apple Sign In (native module)
- In-App Purchases / subscriptions (StoreKit)
- Photo library Junk Wiper (expo-media-library full access)
- Push notifications

For all these features, you need a TestFlight build.

---

### The 3 types of iOS builds — which one to use

| Build type | How to run | IAP works? | Camera? | Who sees it |
|-----------|-----------|-----------|--------|------------|
| **Expo Go** | `npx expo start`, scan QR | No | Limited | Just you, on Expo Go app |
| **Development build** | `eas build --profile development` | Yes (sandbox) | Yes | Internal team, via EAS install link |
| **TestFlight (preview)** | `eas build --profile preview` | Yes (sandbox) | Yes | Anyone you add in TestFlight |
| **App Store (production)** | `eas build --profile production` | Yes (real $) | Yes | Everyone on App Store |

For testing all features before going live → **use TestFlight (preview build)**.

---

### Step 1 — Make sure the EAS project is linked

```bash
# From the paperai-mobile directory
eas whoami
# Should show: rahulruhela
```

If not logged in:
```bash
eas login
# Enter your expo.dev email and password
```

---

### Step 2 — Build the TestFlight version

```bash
eas build --platform ios --profile preview
```

What happens next:
1. EAS validates your code (~2 min)
2. EAS sends the build to their Mac servers
3. They compile the native iOS app (~15–25 min)
4. When done, EAS **automatically uploads the .ipa** to App Store Connect → TestFlight
5. Apple processes the build (~10–20 min more)

You will get an email when the build is ready on TestFlight.

To watch progress: https://expo.dev/accounts/rahulruhela/projects/paperai-mobile/builds

---

### Step 3 — Open App Store Connect

Go to: https://appstoreconnect.apple.com

Sign in with: `info@bholeshankarenterprisesprivatelimited.com`

Click on **Paper Ai Assistant** in the Apps list.

---

### Step 4 — Find your build in TestFlight

Click the **TestFlight** tab at the top.

You should see a build listed with status:
- **"Processing"** — Apple is still checking it (~10–20 min after upload, just wait)
- **"Ready to Test"** — good to go

If you don't see a build: wait 20 more minutes. EAS uploads automatically after build completes.

---

### Step 5 — Add yourself as an Internal Tester

Still in TestFlight tab, click **Internal Testing** in the left sidebar.

1. Click the **"+"** button next to testers
2. Add your own email (the one you used to create the Apple Developer account or App Store Connect account)
3. Click **Save**

Apple will send a **TestFlight invitation email** to that address.

---

### Step 6 — Install the TestFlight app on your iPhone

On your iPhone:
1. Open the **App Store**
2. Search for **TestFlight**
3. Install it (it's free, made by Apple)

---

### Step 7 — Accept the invitation and install PaperAI

1. Open the TestFlight invite email on your iPhone
2. Tap **"View in TestFlight"** — this opens the TestFlight app
3. Tap **"Accept"**
4. Tap **"Install"**
5. The app installs — look for "Paper Ai Assistant" on your home screen

> The icon will look the same as the App Store version. The only difference is a small orange dot on the icon corner (TestFlight indicator).

---

### Step 8 — Test the real features

Open Paper Ai Assistant from your home screen (not Expo Go).

#### Test camera scanner
1. Go to Upload tab
2. Tap "Scan Document"
3. iPhone will ask: **"Paper AI Assistant would like to access the camera"** → tap **Allow**
4. Point camera at a document, tap capture
5. Should navigate to Process screen

#### Test OCR / text extraction
1. Go to Upload tab
2. Tap "Extract Text from Image"
3. Tap "Select Image"
4. iPhone will ask: **"Paper AI Assistant would like to access your photos"** → tap **Allow**
5. Pick any photo with text (receipt, book page, sign)
6. A modal shows: "Extract Text from Image — 10 credits"
7. Tap Confirm
8. Wait ~5–10 seconds
9. Extracted text appears in a scrollable box with a Copy button

#### Test JunkWiper
1. Go to Upload tab
2. Tap "Start Duplicate Scan"
3. iPhone asks for Photos permission → Allow
4. Modal shows "30 credits for scan"
5. Tap Confirm
6. App scans your photo library for duplicates
7. Results show — tap checkboxes to select, then Delete Selected

#### Test file upload + AI analysis
1. Go to Upload tab
2. Tap "Select PDF"
3. Pick any PDF from Files app
4. After upload, go to Process screen
5. Tap "Run AI Analysis"
6. Modal: "10 credits for AI analysis" → Confirm
7. AI processes the document (30–60 sec)
8. View AI Result shows summary, entities, etc.

#### Test subscriptions / IAP
1. On a TestFlight build, subscriptions use **Sandbox Apple IDs**, not real money
2. On your iPhone: **Settings → App Store → scroll to bottom → Sandbox Account**
3. Sign in with a sandbox tester account (create one at App Store Connect → Users → Sandbox Testers)
4. Go to the Paywall screen in the app
5. Tap a subscription plan
6. A StoreKit dialog appears — tap **Subscribe**
7. Authenticate with the sandbox account
8. Subscription should activate

> Sandbox purchases are free. They don't charge real money.

#### Test Apple Sign In
1. On the login screen, tap **"Sign in with Apple"**
2. Face ID / Touch ID will prompt
3. You can choose to share or hide your email
4. Should log you in and land on the home screen

---

### Step 9 — Check logs if something fails

#### Option A — View logs in Expo dashboard
After a build, logs are at:
https://expo.dev/accounts/rahulruhela/projects/paperai-mobile/builds

Click the build → scroll down to see full Xcode build logs.

#### Option B — View live device logs
If you have a Mac with Xcode:
1. Plug iPhone into Mac with USB cable
2. Open **Xcode → Window → Devices and Simulators**
3. Select your iPhone → click **Open Console**
4. Filter by "PaperAI" to see only your app logs

#### Option C — View API logs
The backend logs every request. If the app is hitting the production API:
- SSH to the server: `ssh user@160.153.183.27`
- Check logs: `journalctl -u paperai-api -f` or wherever the service logs

#### Option D — In-app error messages
All API errors show an `Alert.alert` dialog with a friendly message. The raw error is logged to the React Native console. To see it: shake your iPhone → **"Debug Remote JS"** (development build only).

---

### Step 10 — Update the build (when you make changes)

After making code changes:

```bash
# From paperai-mobile directory
eas build --platform ios --profile preview
```

A new build will appear in TestFlight automatically. Testers get notified and can update.

You do NOT need to re-add testers — they stay added permanently.

---

### Difference between Expo Go, Development Build, and TestFlight

| | Expo Go | Development Build | TestFlight Build |
|---|---------|-----------------|-----------------|
| How to install | App Store (Expo Go) | EAS install link or QR | TestFlight app |
| Requires Apple account | No | Yes (dev cert) | Yes (team member) |
| Camera scanner | Partial | Full | Full |
| IAP / subscriptions | No | Yes (sandbox) | Yes (sandbox) |
| Apple Sign In | Yes (Expo Go bundle ID) | Yes (your bundle ID) | Yes (your bundle ID) |
| Push notifications | No | Yes | Yes |
| Junk Wiper (MediaLibrary) | Limited | Full | Full |
| Production API | Any | Any | Any |
| Who it's for | Daily dev loop | Device testing | Pre-release QA |

---

## 8. Submit to App Store — Full Step-by-Step

### Step 1 — Trigger a production build (MANUAL ONLY)

Production builds must be triggered manually. Never push to `production` branch to auto-build.

**Option A — from your computer (recommended):**
```bash
eas build --platform ios --profile production
```

**Option B — from GitHub Actions (manual trigger):**
1. Go to your GitHub repo → Actions tab
2. Click **"iOS Production (App Store)"** in the left sidebar
3. Click **"Run workflow"** dropdown on the right
4. Set "Submit to App Store after build?" → `true` if you want auto-submit
5. Click **Run workflow**

### Step 2 — Fill in App Information

Go to **App Store Connect → Apps → Paper Ai Assistant → App Store tab → App Information**:

| Field | Value |
|-------|-------|
| Name | Paper Ai Assistant |
| Subtitle (optional) | AI Document Scanner & Analyzer |
| Bundle ID | com.bholeshankar.paperai |
| SKU | paperai-mobile |
| Primary Language | English (U.S.) |
| Content Rights | No third-party content |
| Age Rating | 4+ |

### Step 3 — Write the App Description

Go to **App Store Connect → App Store → Localizations → English (U.S.)**

**Promotional Text** (170 chars max):
```
Transform any document into AI-powered insights. Scan, upload, and analyze papers, forms, and reports instantly.
```

**Description** (4000 chars max):
```
Paper AI Assistant is your intelligent document companion — powered by advanced AI to help you scan, analyze, and understand any document in seconds.

WHETHER YOU'RE A STUDENT, PROFESSIONAL, OR RESEARCHER:
• Upload any document — PDFs, photos, scanned papers, forms, reports
• Get instant AI-powered summaries and key insights
• Ask questions about your documents in natural language
• Extract structured data from tables, invoices, and receipts
• Organize your document library with ease

SUBSCRIPTION PLANS:
Paper AI Assistant offers flexible subscription options to suit your needs:
• Weekly Pro — Full AI analysis features, renewed weekly
• Monthly Pro — Everything in Weekly, billed monthly at a better rate
• Yearly Pro — Best value, full access for an entire year

PRIVACY FIRST:
Your documents are processed securely. We do not sell your data or use your documents to train AI models.

REQUIREMENTS:
• Active internet connection required for AI processing
• iOS 16.0 or later

SUBSCRIPTION TERMS:
• Payment will be charged to your Apple ID account at confirmation of purchase
• Subscriptions automatically renew unless auto-renew is turned off at least 24 hours before the end of the current period
• Your account will be charged for renewal within 24 hours prior to the end of the current period
• You can manage and cancel your subscriptions by going to your account settings on the App Store after purchase
• Any unused portion of a free trial period, if offered, will be forfeited when you purchase a subscription

Privacy Policy: https://bseptechnologies.com/privacy
Terms of Use: https://bseptechnologies.com/terms
```

**Keywords** (100 chars max):
```
AI,document,scanner,PDF,analyzer,OCR,paper,assistant,extract,summarize,receipt,invoice
```

**Support URL:** `https://bseptechnologies.com/support`
**Privacy Policy URL:** `https://bseptechnologies.com/privacy`

### Step 4 — Screenshots

See **[Section 9 — App Store Screenshots](#9-app-store-screenshots--how-to-generate)**.

### Step 5 — Age Rating → 4+

App Store Connect → App Information → Age Rating → Edit → all "None" → Result: 4+

### Step 6 — Pricing: Free

App Store Connect → Pricing and Availability → Base Price: Free

### Step 7 — Select the Build

App Store Connect → App Store → iOS App → Build section → click **+** → select the latest build.

> If not listed yet: wait for TestFlight processing to finish (~15 min after upload).

### Step 8 — App Review Information

Sign-in Required: Yes

| Field | Value |
|-------|-------|
| Demo Account Email | your-sandbox-tester@email.com |
| Demo Account Password | sandbox tester password |

Review Notes:
```
This app is an AI-powered document analysis tool for scanning, uploading, and analyzing documents.

For testing: register with any email, upload a document, use the sandbox Apple ID for IAP testing.

Backend: https://apis.bseptechnologies.com — Health: https://apis.bseptechnologies.com/health

Camera and photo permissions are requested only when the user initiates those features.
```

### Step 9 — Verify IAP Products

App Store Connect → Monetization → Subscriptions → all 3 must be **"Ready to Submit"**:
- `com.bholeshankar.paperai.pro_weekly`
- `com.bholeshankar.paperai.pro_monthly`
- `com.bholeshankar.paperai.pro_yearly`

### Step 10 — Submit for Review

Click **"Add for Review"** → answer export compliance (No) → **"Submit to App Review"**.

Review typically takes **24–48 hours** for first submissions.

---

## 9. App Store Screenshots — How to Generate

### Option A — Using Xcode Simulator on Mac (Recommended)

```bash
# Build a simulator build first
eas build --profile simulator --platform ios
# Download from EAS dashboard and drag into Simulator

# Or run locally (requires Mac + Xcode):
npx expo run:ios --device "iPhone 16 Pro Max"
```

In Simulator: navigate to each screen, press `Cmd + S` to screenshot.

**Key screens to screenshot:**

| # | Screen | What to show |
|---|--------|-------------|
| 1 | Home | Main document list |
| 2 | Upload | Upload/scan cards |
| 3 | OCR result | Extracted text with copy button |
| 4 | AI Analysis | AI insights on a document |
| 5 | Paywall | Subscription plans |

### Option B — Screenshot from Expo Go (fastest)

On iPhone, navigate to each screen and take a screenshot (Side + Volume Up). AirDrop to Mac, upload to App Store Connect.

### Option C — Online mockup tools

| Tool | Free? |
|------|-------|
| AppLaunchpad | Free — https://theapplaunchpad.com |
| Mockuphone | Free — https://mockuphone.com |

### Required Screenshot Dimensions

| Device | Size | Required? |
|--------|------|-----------|
| iPhone 16 Pro Max (6.9") | 1320 × 2868 px | **YES** |
| iPhone 15 Plus (6.5") | 1284 × 2778 px | Recommended |
| iPhone 8 Plus (5.5") | 1242 × 2208 px | Optional |

---

## 10. Why TestFlight is Required

TestFlight installs the **exact same binary** as the App Store — it's the only way to verify before going live.

### What Expo Go cannot test

| Feature | Expo Go | TestFlight |
|---------|---------|------------|
| In-App Purchases (StoreKit) | ❌ | ✅ |
| Apple Sign In (real bundle ID) | Partial | ✅ |
| Camera document scanner | Limited | ✅ |
| Junk Wiper (full MediaLibrary) | Limited | ✅ |
| Push notifications | ❌ | ✅ |
| Production API with real auth | ✅ | ✅ |

### Internal vs External Testing

| | Internal | External |
|--|---------|---------|
| Apple review needed | No — instant | Yes (~1–2 days) |
| Max testers | 100 (team members) | 10,000 |
| Use case | You + your QA | Beta users |

For first submission, **Internal Testing is enough**.

---

## 11. CI/CD with GitHub Actions

### Workflow overview

| File | Trigger | Does |
|------|---------|------|
| `ios.yml` | Push to `main` | TypeScript check + preview build (TestFlight) |
| `ios-preview.yml` | Push to `main` | Alias — same as above |
| `ios-production.yml` | **MANUAL ONLY** | Production build + optional App Store submit |
| `android-preview.yml` | Manual (type `android`) | Android APK (future) |

### Production is MANUAL ONLY

The `ios-production.yml` workflow no longer triggers on push to `production` branch.
It only runs when you **manually click "Run workflow"** in GitHub Actions.

This prevents:
- Accidental production releases from routine commits
- Half-tested code going to the App Store
- Build minutes being wasted on every push

**To trigger a production build:**
1. GitHub → repo → Actions tab
2. Click **"iOS Production (App Store)"**
3. Click **"Run workflow"**
4. Choose whether to submit to App Store (yes/no)
5. Click **Run workflow**

### Preview (TestFlight) still auto-builds

Pushing to `main` automatically:
1. Runs TypeScript check
2. Builds the `preview` profile
3. Uploads to TestFlight

This means every merge to `main` produces a fresh TestFlight build automatically.

### Required GitHub Secrets

Go to: GitHub → repo → Settings → Secrets and variables → Actions → New repository secret

| Secret | Value |
|--------|-------|
| `EXPO_TOKEN` | expo.dev → Account Settings → Access Tokens → Create |
| `API_BASE_URL_STAGING` | `https://apis.bseptechnologies.com` |
| `API_BASE_URL_PRODUCTION` | `https://apis.bseptechnologies.com` |
| `APPLE_WEEKLY_PRODUCT_ID` | `com.bholeshankar.paperai.pro_weekly` |
| `APPLE_MONTHLY_PRODUCT_ID` | `com.bholeshankar.paperai.pro_monthly` |
| `APPLE_YEARLY_PRODUCT_ID` | `com.bholeshankar.paperai.pro_yearly` |
| `APP_STORE_CONNECT_PRIVATE_KEY` | Full `.p8` file contents (including header) |

---

## 12. Subscription / IAP behaviour by environment

| Environment | IAP real? | Behaviour |
|-------------|-----------|-----------|
| Expo Go (local) | No | Mock subscribe; backend allows in dev mode |
| Dev Client build | Yes (sandbox) | Real StoreKit sandbox purchases |
| TestFlight (preview build) | Yes (sandbox) | Sandbox Apple ID only |
| App Store (production build) | Yes (real money) | Backend disables sandbox |

**Subscriptions will not work in Expo Go — this is correct and expected.**

To test real IAP on a device before TestFlight:
1. Build with `--profile development`
2. Create a Sandbox Apple ID at App Store Connect → Users and Access → Sandbox Testers
3. On device: Settings → App Store → scroll to bottom → Sandbox Account → sign in

---

## 13. Android future

Android build is configured in `eas.json` and `app.json` but not yet submitted to Google Play.

```bash
eas build --profile preview --platform android      # APK for side-loading
eas build --profile production --platform android   # AAB for Google Play
eas submit --platform android --latest              # submit when ready
```

The `android-preview.yml` GitHub workflow exists but requires manual confirmation to prevent accidental builds.

---

## 14. App Store Connect setup checklist

### Create the app

1. https://appstoreconnect.apple.com → Apps → `+` → New App
2. Platform: iOS | Name: **Paper Ai Assistant** | Bundle ID: `com.bholeshankar.paperai`
3. SKU: `paperai-mobile` | User Access: Full Access

### Create subscription products

Your app → Monetization → In-App Purchases → Subscriptions → Create group **Pro Plans**

| Product ID | Duration | Price |
|-----------|----------|-------|
| `com.bholeshankar.paperai.pro_weekly` | 1 week | $8.99 |
| `com.bholeshankar.paperai.pro_monthly` | 1 month | $29.90 |
| `com.bholeshankar.paperai.pro_yearly` | 1 year | $279 |

### App Store Server Notifications V2

App Information → App Store Server Notifications:
- Production URL: `https://apis.bseptechnologies.com/api/billing/ios/notifications-v2`

### Sandbox tester

Users and Access → Sandbox Testers → `+`

On test device: Settings → App Store → Sandbox Account (scroll to bottom)

---

## 15. Apple Developer credentials you need

### Apple Team ID

https://developer.apple.com → Account → Membership Details → **Team ID** = `RA258N96VK`

### App Store Connect API Key

App Store Connect → Users → Integrations → App Store Connect API → `+` → Role: App Manager

You get:
- **Issuer ID:** `26a0c1c8-cc00-4398-abb6-b9093adcda60`
- **Key ID:** `LY4822XN6Q`
- **`.p8` file** — store securely, only downloadable once

---

## 16. GitHub Secrets required

| Secret name | Where to get it |
|------------|----------------|
| `EXPO_TOKEN` | expo.dev → Account Settings → Access Tokens → Create |
| `API_BASE_URL_STAGING` | `https://apis.bseptechnologies.com` |
| `API_BASE_URL_PRODUCTION` | `https://apis.bseptechnologies.com` |
| `APPLE_WEEKLY_PRODUCT_ID` | `com.bholeshankar.paperai.pro_weekly` |
| `APPLE_MONTHLY_PRODUCT_ID` | `com.bholeshankar.paperai.pro_monthly` |
| `APPLE_YEARLY_PRODUCT_ID` | `com.bholeshankar.paperai.pro_yearly` |
| `APP_STORE_CONNECT_PRIVATE_KEY` | Full text of `.p8` file (including `-----BEGIN PRIVATE KEY-----`) |

---

## 17. Build failure history & root causes

### Most recent failure — production build after credit system changes

**Symptom:** EAS production build failed during the native iOS compilation stage.

**Root cause:** `expo-apple-authentication` was added at version `^56.0.4`, which is the version for Expo SDK **56** (unreleased). The project runs Expo SDK **54**. EAS uses the package version to resolve native CocoaPods — a version mismatch causes the Xcode pod install to fail with an incompatible framework error.

**Fix applied:** Downgraded to `~6.4.0` which is the SDK 54 compatible version:
```diff
- "expo-apple-authentication": "^56.0.4",
+ "expo-apple-authentication": "~6.4.0",
```

**Rule:** Always use `~` (tilde) version ranges for Expo packages, matching the SDK version in use. The Expo team releases packages as `expo-*@sdk-version.x`. For SDK 54, `expo-*` package major versions are in the 6.x range (not 56.x).

### Earlier successful build

**Commit:** `9935de3` (branch: `productionworkingSubmittedBuildAppstore`)  
**Status:** Successfully built and submitted to App Store Connect.  
**Key difference:** `expo-apple-authentication` was not in the dependencies at that time. It was added later with the wrong version range (`^56.0.4`).

### What changed between working and failing build

| | Working build (`9935de3`) | Failing build (`de73fb5`) |
|--|--------------------------|--------------------------|
| `expo-apple-authentication` | Not present | `^56.0.4` (WRONG) |
| `expo-camera` | Present | Present (same) |
| `expo-media-library` | Present | Present (same) |
| `app.json` plugins | No `expo-apple-authentication` plugin | Added `expo-apple-authentication` plugin |
| Credit system | Not present | Added (no build impact) |
| New screens | Not present | JunkWiper, CameraScanner, ProcessScreen |

The new screens and credit system are pure JavaScript — they do not affect the native build. Only the wrong `expo-apple-authentication` version breaks the iOS compile.

---

## 18. Troubleshooting

### "No connection. Please check your internet" on local dev

1. Phone and PC must be on the **same Wi-Fi network**
2. `ipconfig` (Windows) → get your current IPv4
3. Update `.env.local`: `EXPO_PUBLIC_API_BASE_URL=http://NEW_IP:5263`
4. Update fallback in `src/constants/api.ts`
5. Run firewall rule (Section 2, Step 4) as Administrator
6. `npx expo start --clear`

### "Session expired" right after login

Check `src/api/client.js` — `AUTH_PATHS` must include the login endpoint so the refresh interceptor skips it. This was fixed in a previous session.

### Subscriptions not selectable in Expo Go

Expected. IAP is not available in Expo Go. Build `--profile development` and test on device.

### EAS build fails — Apple credentials error

```bash
eas credentials   # inspect and reset certificates
```

Use your Apple Developer account email (not personal Gmail) when EAS asks for Apple ID.

### TypeScript errors failing CI

Run locally: `npx tsc --noEmit`

### Image picker only shows documents, not photos

The `expo-image-picker` plugin in `app.json` requires a native build — it does not apply in Expo Go.

### App rejected — "Unable to sign in with provided demo account"

Sandbox tester credentials in App Review Notes are wrong or account doesn't exist. Go to App Store Connect → Users and Access → Sandbox Testers to verify.

### Build is in TestFlight but not selectable in App Store submission

Wait for build to finish processing in TestFlight (10–20 min after upload). Status changes from "Processing" → "Ready to Submit".

### OCR returns 404

The `/api/documents/{id}/ocr` endpoint calls OpenAI Vision. Verify:
1. `OpenAI:ApiKey` is set in `appsettings.Production.json`
2. The document file exists on the server disk at the path stored in the DB

### Credits not deducting / features failing with 500

The `FeatureCreditConfigs` and `CreditTransactions` tables may not exist in the database yet. Run the SQL migration script:
```
C:\Rahul\bsepall\paperworkai\api\PaperAiApis\PaperAi\migration_new_tables.sql
```
The API has built-in fallback defaults so features still work without the migration, but the tables should be created for full functionality.

### Production API is running but returns errors

Health check: `https://apis.bseptechnologies.com/health`

Should return `{"status":"Healthy"}`. If not, SSH to `160.153.183.27` and check the service.
