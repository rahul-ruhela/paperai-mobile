# PaperAI Mobile

React Native / Expo SDK 54 — iOS App Store + Android (future)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local development](#2-local-development)
3. [Project structure](#3-project-structure)
4. [Environment variables](#4-environment-variables)
5. [iOS build with EAS](#5-ios-build-with-eas)
6. [Submit to App Store — Full Step-by-Step](#6-submit-to-app-store--full-step-by-step)
7. [App Store Screenshots — How to Generate](#7-app-store-screenshots--how-to-generate)
8. [Why TestFlight (Internal & External QA) is Required](#8-why-testflight-internal--external-qa-is-required)
9. [CI/CD with GitHub Actions](#9-cicd-with-github-actions)
10. [Subscription / IAP behaviour by environment](#10-subscription--iap-behaviour-by-environment)
11. [Android future](#11-android-future)
12. [App Store Connect setup checklist](#12-app-store-connect-setup-checklist)
13. [Apple Developer credentials you need](#13-apple-developer-credentials-you-need)
14. [GitHub Secrets required](#14-github-secrets-required)
15. [Troubleshooting](#15-troubleshooting)

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
├── docs/                 Wiki docs (App Store, deployment, API integration)
├── src/
│   ├── api/              All API calls
│   │   ├── client.js     Axios instance + JWT refresh interceptor
│   │   ├── auth.js       Login, register, email OTP, phone OTP
│   │   └── billing.js    IAP verify, entitlement, mock subscribe
│   ├── constants/
│   │   └── api.ts        API base URL resolver + IAP product IDs
│   ├── screens/          One file per screen
│   ├── storage/
│   │   └── tokenStore.js JWT tokens in expo-secure-store
│   └── ui/               Reusable UI components
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
- **GitHub Actions:** set as GitHub Secrets (see section 14)

---

## 5. iOS build with EAS

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

---

## 6. Submit to App Store — Full Step-by-Step

This section covers everything you must complete before Apple will accept your submission.

### Step 1 — Ensure your build is uploaded

```bash
eas submit --platform ios --latest
```

The build should appear in App Store Connect → your app → TestFlight (processing takes ~10–15 min).

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

**Promotional Text** (170 chars max — shown at top, can update without new build):
```
Transform any document into AI-powered insights. Scan, upload, and analyze papers, forms, and reports instantly.
```

**Description** (4000 chars max — copy/paste this):
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

**Keywords** (100 chars max, comma-separated):
```
AI,document,scanner,PDF,analyzer,OCR,paper,assistant,extract,summarize,receipt,invoice
```

**Support URL:** `https://bseptechnologies.com/support`

**Privacy Policy URL:** `https://bseptechnologies.com/privacy`

**Marketing URL** (optional): `https://bseptechnologies.com`

### Step 4 — Screenshots (Required)

See **[Section 7 — App Store Screenshots](#7-app-store-screenshots--how-to-generate)** for full details on how to generate these.

**Required sizes:**
| Device | Screen Size | Required? |
|--------|------------|-----------|
| iPhone 16 Pro Max | 6.9" | **YES — Required** |
| iPhone 15 Plus / 14 Plus | 6.5" | Recommended |
| iPhone 8 Plus | 5.5" | Optional |
| iPad Pro 12.9" | 12.9" | Only if supportsTablet: true |

Upload screenshots under: **App Store Connect → App Store → Localizations → English → iPhone**

### Step 5 — Age Rating

Go to **App Store Connect → App Information → Age Rating → Edit**

Answer the questionnaire:

| Question | Answer |
|----------|--------|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Prolonged Graphic or Sadistic Realistic Violence | None |
| Profanity or Crude Humor | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Medical/Treatment Information | None |
| Alcohol, Tobacco, or Drug Use or References | None |
| Simulated Gambling | None |
| Sexual Content or Nudity | None |
| Graphic Sexual Content and Nudity | None |
| Unrestricted Web Access | None |

Result: **4+** (this is correct for a document analysis app)

### Step 6 — Pricing and Availability

Go to **App Store Connect → Pricing and Availability**:
- Base Price: **Free** (the app is free, IAP provides paid features)
- Availability: All countries/regions (or select specific regions)

### Step 7 — Select the Build

Go to **App Store Connect → App Store → iOS App → Build section**:
- Click the **+** next to Build
- Select your latest production build from the list
- If the build is not listed yet, wait for TestFlight processing to complete (~15 min)

### Step 8 — App Review Information

Go to **App Store Connect → App Review Information**:

**Sign-in Required:** Yes

| Field | Value |
|-------|-------|
| Demo Account Email | your-sandbox-tester@email.com |
| Demo Account Password | your sandbox tester password |

**Review Notes (copy/paste):**
```
This app is an AI-powered document analysis tool that allows users to scan, upload, and analyze documents using AI.

For testing subscription purchases, please use the sandbox Apple ID provided above.

The subscription flow works as follows:
1. Register or log in with any email address
2. Upload a document to see the AI analysis features
3. When the usage limit is reached, the paywall appears
4. Use the sandbox Apple ID to test purchasing a subscription plan

Backend API is live at: https://apis.bseptechnologies.com
Health check: https://apis.bseptechnologies.com/health

The app uses StoreKit 2 for IAP. All three subscription products (weekly, monthly, yearly) are in Ready to Submit status.

Note for reviewer: Camera and photo library permissions are requested only when the user attempts to upload a document.
```

### Step 9 — In-App Purchases Status Check

Before submitting, verify all 3 IAP products are in **"Ready to Submit"** status:

Go to **App Store Connect → your app → Monetization → In-App Purchases → Subscriptions**

| Product ID | Required Status |
|-----------|----------------|
| `com.bholeshankar.paperai.pro_weekly` | Ready to Submit |
| `com.bholeshankar.paperai.pro_monthly` | Ready to Submit |
| `com.bholeshankar.paperai.pro_yearly` | Ready to Submit |

If any shows "Missing Metadata", click it and fill in the localization (display name + description in English).

### Step 10 — Submit for Review

1. Go to App Store Connect → Apps → Paper Ai Assistant
2. Click **"Add for Review"** (top right — appears when all required fields are complete)
3. Answer the export compliance question:
   - **Does your app use encryption beyond standard HTTPS?** → **No** (already set in app.json: `ITSAppUsesNonExemptEncryption: false`)
4. Click **"Submit to App Review"**

Apple review typically takes **24–48 hours** for first submissions.

---

## 7. App Store Screenshots — How to Generate

### Why Screenshots Cannot Be Auto-Generated from Code

Apple requires screenshots taken from a **real device or simulator** running the actual app — not mockups or AI-generated images. However, you can use a simulator on a Mac + a design tool to add device frames and marketing copy.

### Option A — Using Xcode Simulator on Mac (Recommended)

This produces real app screenshots at the correct resolution.

**Step 1 — Run the app in simulator**

On a Mac with Xcode installed:
```bash
# Build a simulator build first (do this once)
eas build --profile simulator --platform ios
# Download the .tar.gz from EAS dashboard and extract the .app file

# Or run locally:
npx expo run:ios --device "iPhone 16 Pro Max"
```

**Step 2 — Select the correct simulator**

In Xcode → Open Simulator → Device menu → Select:
- **iPhone 16 Pro Max** (6.9" — required)
- **iPhone 15 Plus** (6.5" — recommended)

**Step 3 — Take screenshots**

Navigate to each key screen and press:
- **Mac keyboard:** `Cmd + S` — saves to Desktop
- **Simulator menu:** File → Save Screen

**Screens to screenshot for best App Store conversion:**

| Screenshot # | Screen | What to show |
|-------------|--------|-------------|
| 1 | Home / Dashboard | Main app interface |
| 2 | Document Upload | Camera/upload flow |
| 3 | AI Analysis Result | AI extracted text/summary |
| 4 | Paywall / Subscription | Pro plans with pricing |
| 5 | Login / Onboarding | Clean welcome screen |

**Step 4 — Add marketing frames (optional but highly recommended)**

Use [Figma](https://figma.com), [Canva](https://canva.com), or [AppLaunchpad](https://theapplaunchpad.com) (free):
- Import your raw screenshots
- Add device frame (iPhone 16 Pro Max frame)
- Add headline text overlay (e.g. "Scan Any Document. Get AI Insights Instantly.")
- Export at 1290 × 2796 pixels (6.9" required resolution)

### Option B — Using Expo Go on Physical iPhone 16 Pro Max

If you have an iPhone 16 Pro Max:
```bash
npx expo start --clear
# Scan QR in Expo Go
```
Navigate to each screen and take screenshots (Side button + Volume Up).

Then AirDrop or iCloud to your Mac/PC, then upload to App Store Connect.

**Note:** Screenshots from Expo Go are valid for App Store Connect upload even though the final binary is different.

### Option C — Online Screenshot Generator Tools (Fastest)

These tools let you create fake but visually acceptable screenshots by dragging your images into a template:

| Tool | Free? | URL |
|------|-------|-----|
| AppLaunchpad | Free | https://theapplaunchpad.com |
| ScreenshotOne | Paid | https://screenshotone.com |
| Mockuphone | Free | https://mockuphone.com |
| Rottenwood | Free | https://rottenwood.com |

**Workflow:**
1. Take any screenshot (even from Expo Go)
2. Upload to the tool
3. Choose "iPhone 16 Pro Max" frame
4. Add title text
5. Download at required resolution
6. Upload to App Store Connect

### Required Screenshot Dimensions

| Device | Width × Height | Required |
|--------|---------------|---------|
| iPhone 16 Pro Max (6.9") | 1320 × 2868 px | **YES** |
| iPhone 15 Plus / 14 Plus (6.5") | 1284 × 2778 px | Recommended |
| iPhone 8 Plus (5.5") | 1242 × 2208 px | Optional |
| iPad Pro 12.9" (2nd gen) | 2048 × 2732 px | If tablet supported |

> Apple requires at least the **6.9" (iPhone 16 Pro Max)** screenshots as of 2024. If you only upload one size, upload this one.

### Uploading Screenshots to App Store Connect

1. Go to App Store Connect → Apps → Paper Ai Assistant
2. Click **App Store** tab → **English (U.S.)** localization
3. Scroll to **Screenshots**
4. Under **iPhone** → drag and drop your 6.9" screenshots (up to 10)
5. Click **Save** (top right)

---

## 8. Why TestFlight (Internal & External QA) is Required

This section explains what Internal Testing and External Testing are in Apple's system, why they exist, and what you should use for PaperAI.

### What is TestFlight?

TestFlight is Apple's official beta testing platform. Before an app goes live on the App Store, Apple recommends (and for some features, requires) that you test through TestFlight. It installs the same binary that will go to the App Store, allowing real device testing with real Apple accounts.

### Internal Testing vs External Testing — Key Differences

| Feature | Internal Testing | External Testing |
|---------|-----------------|-----------------|
| Who can use it | Only members of your App Store Connect team (max 100) | Anyone with the public link or invited by email (up to 10,000) |
| Apple review required | **No** — available immediately after build processing | **Yes** — Apple does a quick review (~1–2 days) before testers can install |
| Purpose | Developer/QA testing of the build before wider release | Beta users, stakeholders, early adopters |
| Subscription IAP | Works with sandbox Apple IDs | Works with sandbox Apple IDs |
| Duration | Build expires after 90 days | Build expires after 90 days |
| TestFlight app needed | Yes | Yes |

### Why Internal Testing is Important for PaperAI

**You must test through TestFlight before submitting because:**

1. **IAP (In-App Purchases) only work in real builds** — The subscription purchase flow (StoreKit 2) does NOT work in Expo Go. TestFlight is the only way to verify that weekly/monthly/yearly subscriptions actually complete before going live.

2. **Apple's App Review process checks your demo account** — The reviewer will use the sandbox tester credentials you provide to test the subscription purchase. If purchases don't work, your app gets rejected.

3. **Catches production environment bugs** — The production build uses `https://apis.bseptechnologies.com` as the API. A TestFlight build lets you verify the real production API works before millions of users hit it.

4. **Push notifications require a real build** — Expo Go cannot receive push notifications. TestFlight validates your notification setup.

5. **Camera and photo permissions require a real build** — The native permission dialogs only appear in TestFlight/production builds.

### Do You Need External Testing for PaperAI Right Now?

**For the first App Store submission: No.** External testing is optional.

You only need Internal Testing (your team) to:
- Verify the app works end-to-end on a real device
- Test the IAP subscription flow with a sandbox Apple ID
- Confirm push notifications work
- Confirm the backend API is reachable from a production build

**When to use External Testing (later):**
- When you want 10–100 beta users to test before a major new version
- When you want non-technical stakeholders to preview the app
- When you're doing a soft launch to gather feedback before a wider release

### Step-by-Step: Internal Testing with TestFlight

**Step 1 — Build and upload**
```bash
eas build --profile preview --platform ios
```
The build automatically uploads to App Store Connect → TestFlight.

**Step 2 — Add internal testers**

App Store Connect → your app → TestFlight → Internal Testing → Add Testers

Add your own email (the one registered as App Store Connect user). You will get a TestFlight invite email.

**Step 3 — Install on device**

Install the **TestFlight** app on your iPhone, accept the invite, install PaperAI.

**Step 4 — Test the critical flows**

Go through this checklist on the TestFlight build:

- [ ] Register a new account
- [ ] Log in
- [ ] Upload a document (test camera AND photo library)
- [ ] See AI analysis result
- [ ] Reach paywall / trigger subscription screen
- [ ] Sign in with sandbox Apple ID (Settings → App Store → scroll down → Sandbox Account)
- [ ] Purchase weekly subscription
- [ ] Verify Pro access is granted in app
- [ ] Restore purchases
- [ ] Log out and log back in — verify subscription persists

**Step 5 — If everything passes → submit to App Store Review**

---

## 9. CI/CD with GitHub Actions

### Workflows

| File | Trigger | What it does |
|------|---------|-------------|
| `ios-preview.yml` | Push to `main` | TypeScript check + EAS preview build (TestFlight) |
| `ios-production.yml` | Push to `production` branch | TypeScript check + EAS production build + submit |
| `android-preview.yml` | Manual only (type `android` to confirm) | Android APK (future) |

### Trigger a production release via CI

```bash
git checkout production
git merge main
git push origin production
```

The `ios-production.yml` workflow builds and submits to App Store Connect automatically.

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
| `APP_STORE_CONNECT_ISSUER_ID` | From App Store Connect → Integrations → App Store Connect API |
| `APP_STORE_CONNECT_KEY_ID` | Same page as above |
| `APP_STORE_CONNECT_PRIVATE_KEY` | Full text contents of the `.p8` file |

---

## 10. Subscription / IAP behaviour by environment

| Environment | IAP real? | Behaviour |
|-------------|-----------|-----------|
| Expo Go (local) | No | Mock subscribe; backend allows in dev mode |
| Dev Client build (local device) | Yes (sandbox) | Real StoreKit sandbox purchases |
| TestFlight (preview build) | Yes (sandbox) | Sandbox Apple ID only |
| App Store (production build) | Yes (real money) | Backend disables sandbox |

**Subscriptions will not work in Expo Go — this is correct and expected.**

To test real IAP on a device before TestFlight, build with `--profile development` and use a Sandbox Apple ID (create at App Store Connect → Users and Access → Sandbox Testers).

---

## 11. Android future

Android build is configured in `eas.json` and `app.json` but not yet submitted to Google Play.

```bash
# Preview APK for side-loading / testing
eas build --profile preview --platform android

# Production AAB for Google Play (when ready)
eas build --profile production --platform android
eas submit --platform android --latest
```

The GitHub Actions workflow `android-preview.yml` exists but requires manual confirmation to prevent accidental builds.

---

## 12. App Store Connect setup checklist

### Create the app

1. https://appstoreconnect.apple.com → Apps → `+` → New App
2. Platform: iOS | Name: **Paper Ai Assistant** | Bundle ID: `com.bholeshankar.paperai`
3. SKU: `paperai-mobile` | User Access: Full Access
4. Note the **numeric App ID** shown in App Information — needed for `eas.json`

### Create subscription products

Your app → Monetization → In-App Purchases → Subscriptions → Create subscription group **Pro Plans**

| Product ID | Duration | Price |
|-----------|----------|-------|
| `com.bholeshankar.paperai.pro_weekly` | 1 week | $8.99 |
| `com.bholeshankar.paperai.pro_monthly` | 1 month | $29.90 |
| `com.bholeshankar.paperai.pro_yearly` | 1 year | $279 |

Each product must be in status **Ready to Submit** before you can submit the app for review.

### App-Specific Shared Secret

Your app → Monetization → In-App Purchases → App-Specific Shared Secret → Generate

Copy value → add to API backend environment variable `AppleIap__SharedSecret`

### App Store Server Notifications V2

Your app → App Information → App Store Server Notifications
- Production URL: `https://apis.bseptechnologies.com/api/billing/ios/notifications-v2`

### Sandbox tester

Users and Access → Sandbox Testers → `+`

Use on test device: Settings → App Store → Sandbox Account (scroll to bottom)

---

## 13. Apple Developer credentials you need

### Apple Team ID (required for EAS Submit)

https://developer.apple.com → Account → Membership Details → **Team ID**

Add to `eas.json` → `submit.production.ios.appleTeamId`

### App Store Connect API Key (for EAS Submit and CI — no password prompts)

App Store Connect → Users and Access → Integrations → App Store Connect API → `+`

Role: **App Manager**

Download the `.p8` file (one-time download). You get:
- **Issuer ID** (top of page)
- **Key ID** (in the table)
- **`.p8` file**

Add these as GitHub Secrets (section 14). Also add Issuer ID and Key ID to `eas.json` if submitting manually without CI.

### Apple Sign In (already configured)

`Apple:ClientId` = `com.bholeshankar.paperai` — already in `appsettings.json`. No change needed.

### App Store Server API (receipt verification — already configured)

`AppleAppStoreServerApi` section already in `appsettings.json`. Do not change unless you regenerate the key.

---

## 14. GitHub Secrets required

Go to: GitHub → repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret name | Where to get it |
|------------|----------------|
| `EXPO_TOKEN` | expo.dev → Account Settings → Access Tokens → **Create** |
| `API_BASE_URL_STAGING` | `https://apis.bseptechnologies.com` |
| `API_BASE_URL_PRODUCTION` | `https://apis.bseptechnologies.com` |
| `APPLE_WEEKLY_PRODUCT_ID` | `com.bholeshankar.paperai.pro_weekly` |
| `APPLE_MONTHLY_PRODUCT_ID` | `com.bholeshankar.paperai.pro_monthly` |
| `APPLE_YEARLY_PRODUCT_ID` | `com.bholeshankar.paperai.pro_yearly` |
| `APP_STORE_CONNECT_ISSUER_ID` | App Store Connect → Users → Integrations → App Store Connect API |
| `APP_STORE_CONNECT_KEY_ID` | Same page |
| `APP_STORE_CONNECT_PRIVATE_KEY` | Full text contents of the `.p8` file (including `-----BEGIN PRIVATE KEY-----` header) |

---

## 15. Troubleshooting

### "No connection. Please check your internet" on local dev

1. Phone and PC must be on the **same Wi-Fi network**
2. `ipconfig` (Windows) → get your current IPv4 address
3. Update `.env.local`: `EXPO_PUBLIC_API_BASE_URL=http://NEW_IP:5263`
4. Update fallback in `src/constants/api.ts`
5. Run firewall rule (Step 4 above) as Administrator if not done yet
6. `npx expo start --clear`

### "Sending code..." hangs on register / login timeout

Same root cause — IP mismatch or firewall blocking. Fix `.env.local` IP.

### Subscriptions not selectable in Expo Go

Expected. IAP is not available in Expo Go. Build with `--profile development` and test on device with a Sandbox Apple ID.

### EAS build fails with Apple credentials error

```bash
eas credentials   # inspect and reset certificates
```

Use your Apple Developer account email (not Gmail) when EAS asks for Apple ID.

### TypeScript errors failing CI

Run locally: `npx tsc --noEmit`

### Image picker only shows documents, not photos

The `expo-image-picker` plugin in `app.json` requires a **native build** — it does not apply in Expo Go. Build with `--profile development` to get photo library access.

### App Store Connect rejects submission — missing Privacy Policy

Go to App Store Connect → App Information → Privacy Policy URL and add your URL. Options: GitHub Pages, Notion public page, any hosted page.

### Build is in TestFlight but not selectable in App Store submission

The build must finish **processing** in TestFlight (usually 10–20 min after upload). The status changes from "Processing" to "Ready to Submit" in TestFlight. Only then it appears in the Build selector of the App Store submission form.

### App rejected — "Unable to sign in with provided demo account"

The sandbox tester credentials in your App Review Notes are wrong or the sandbox tester was not created yet. Go to App Store Connect → Users and Access → Sandbox Testers and verify the account exists and the password is correct.
