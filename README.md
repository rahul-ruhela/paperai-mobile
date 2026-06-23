# PaperAI Mobile

React Native / Expo SDK 54 — iOS App Store + Android (future)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Local development](#2-local-development)
3. [Project structure](#3-project-structure)
4. [Environment variables](#4-environment-variables)
5. [iOS build with EAS](#5-ios-build-with-eas)
6. [Submit to App Store](#6-submit-to-app-store)
7. [CI/CD with GitHub Actions](#7-cicd-with-github-actions)
8. [Subscription / IAP behaviour by environment](#8-subscription--iap-behaviour-by-environment)
9. [Android future](#9-android-future)
10. [App Store Connect setup checklist](#10-app-store-connect-setup-checklist)
11. [Apple Developer credentials you need](#11-apple-developer-credentials-you-need)
12. [GitHub Secrets required](#12-github-secrets-required)
13. [Troubleshooting](#13-troubleshooting)

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
- **GitHub Actions:** set as GitHub Secrets (see section 12)

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

## 6. Submit to App Store

### Step 1 — Fill in eas.json submit config

Open `eas.json` and replace the placeholder values:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "rahulruhela.net@gmail.com",
      "ascAppId": "YOUR_NUMERIC_APP_STORE_CONNECT_APP_ID",
      "appleTeamId": "YOUR_APPLE_TEAM_ID"
    }
  }
}
```

- **ascAppId:** App Store Connect → Apps → your app → App Information (numeric, e.g. `1234567890`)
- **appleTeamId:** https://developer.apple.com → Account → Membership Details → Team ID

### Step 2 — Submit latest build to App Store Connect

```bash
eas submit --platform ios --latest
```

### Step 3 — Complete the listing in App Store Connect

Go to https://appstoreconnect.apple.com → Apps → Paper Ai Assistant

Required before submitting for review:

- [ ] App description (4000 chars max)
- [ ] Keywords (100 chars)
- [ ] Support URL
- [ ] Privacy Policy URL (required — Apple rejects subscription apps without it)
- [ ] Screenshots: 6.9" iPhone required (iPhone 16 Pro Max)
- [ ] Age Rating questionnaire
- [ ] App Review notes + demo account (use sandbox tester email + password)
- [ ] Select your build under the "Build" section

### Step 4 — Submit for review

Click **Add for Review** → **Submit to App Review**

Apple review: 1–3 business days.

---

## 7. CI/CD with GitHub Actions

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

## 8. Subscription / IAP behaviour by environment

| Environment | IAP real? | Behaviour |
|-------------|-----------|-----------|
| Expo Go (local) | No | Mock subscribe; backend allows in dev mode |
| Dev Client build (local device) | Yes (sandbox) | Real StoreKit sandbox purchases |
| TestFlight (preview build) | Yes (sandbox) | Sandbox Apple ID only |
| App Store (production build) | Yes (real money) | Backend disables sandbox |

**Subscriptions will not work in Expo Go — this is correct and expected.**

To test real IAP on a device before TestFlight, build with `--profile development` and use a Sandbox Apple ID (create at App Store Connect → Users and Access → Sandbox Testers).

---

## 9. Android future

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

## 10. App Store Connect setup checklist

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

## 11. Apple Developer credentials you need

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

Add these as GitHub Secrets (section 12). Also add Issuer ID and Key ID to `eas.json` if submitting manually without CI.

### Apple Sign In (already configured)

`Apple:ClientId` = `com.bholeshankar.paperai` — already in `appsettings.json`. No change needed.

### App Store Server API (receipt verification — already configured)

`AppleAppStoreServerApi` section already in `appsettings.json`. Do not change unless you regenerate the key.

---

## 12. GitHub Secrets required

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

## 13. Troubleshooting

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
