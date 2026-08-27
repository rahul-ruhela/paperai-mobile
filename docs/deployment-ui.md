# Mobile App Deployment — PaperAI

## Prerequisites

| Tool | Install |
|------|---------|
| Node.js 20+ | https://nodejs.org |
| EAS CLI | `npm install -g eas-cli` |
| Expo account | https://expo.dev — login with `eas login` |
| Apple Developer account | https://developer.apple.com |

---

## Local development

```bash
cd path/to/paperai-mobile

# Install dependencies
npm install

# Copy env template
cp .env.example .env.local
# Edit .env.local — set EXPO_PUBLIC_API_BASE_URL to your local machine IP

# Start Expo (Expo Go — no real IAP)
npx expo start
```

App connects to the URL in `EXPO_PUBLIC_API_BASE_URL`. In Expo Go, IAP is disabled and the mock subscribe flow is used instead.

---

## EAS Build profiles

| Profile | What it does | Command |
|---------|-------------|---------|
| `development` | Real device dev client with IAP | `eas build --profile development --platform ios` |
| `simulator` | iOS Simulator build | `eas build --profile simulator --platform ios` |
| `preview` | TestFlight internal build | `eas build --profile preview --platform ios` |
| `production` | App Store release build | `eas build --profile production --platform ios` |

---

## TestFlight deployment (step by step)

### 1. One-time EAS setup
```bash
eas login
eas build:configure   # already done — eas.json exists
```

### 2. Build for TestFlight
```bash
eas build --profile preview --platform ios
```
- EAS builds on their Mac cloud servers (~15–25 min)
- First build: EAS will ask for your Apple credentials to create certificates
- Build is automatically uploaded to TestFlight

### 3. Install on device
- Open TestFlight on your iPhone
- Accept the invite (you'll get an email from Apple)
- Install and test

---

## App Store production deployment

### 1. Production build
```bash
eas build --profile production --platform ios
```

### 2. Fill in eas.json submit config
Before submitting, update [eas.json](../eas.json):
```json
"submit": {
  "production": {
    "ios": {
      "appleId": "rahulruhela.net@gmail.com",
      "ascAppId": "6757206246",               ← this app's ASC App ID
      "appleTeamId": "YOUR_TEAM_ID"           ← from developer.apple.com
    }
  }
}
```

Or use App Store Connect API key (recommended for CI — no password needed):
- Set GitHub Secrets: `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_PRIVATE_KEY`

### 3. Submit to App Store Connect
```bash
eas submit --platform ios --latest
```

### 4. App Store Connect
- Build appears under TestFlight first for processing
- Go to App Store Connect → your app → create a new version
- Select the build
- Complete listing (see docs/appstore-connect-setup.md)
- Submit for review

---

## Android (future — not active)

Build ready but not submitted to Play Store yet.

```bash
# Preview APK for testing
eas build --profile preview --platform android

# Production AAB for Play Store (when ready)
eas build --profile production --platform android
eas submit --platform android --latest
```

---

## Required GitHub Secrets

Set at: GitHub → repo → Settings → Secrets and variables → Actions

Referenced by `.github/workflows/ios-production.yml`:

| Secret | Value |
|--------|-------|
| `EXPO_TOKEN` | From expo.dev → Account → Access Tokens |
| `API_BASE_URL_PRODUCTION` | `https://apis.bseptechnologies.com` |
| `APP_STORE_CONNECT_PRIVATE_KEY` | Contents of the .p8 file |

> **Subscription product IDs are not secrets and are not set here.** They live in
> [`src/constants/api.ts`](../src/constants/api.ts) (`SUBSCRIPTION_TIERS`) and must
> match App Store Connect exactly. This table previously listed
> `APPLE_WEEKLY_PRODUCT_ID` / `APPLE_MONTHLY_PRODUCT_ID` /
> `APPLE_YEARLY_PRODUCT_ID` as `com.bholeshankar.paperai.pro_weekly` and friends.
> Those three `pro_*` IDs were **retired** — they no longer exist in App Store
> Connect, nothing in the repo ever read those secrets, and a `pro_*` product ID
> reaching live code grants zero credits to someone who has paid. The current
> catalogue is nine SKUs, three tiers × three durations:
>
> | Tier | Weekly | Monthly | Yearly |
> |---|---|---|---|
> | Essential | `…essential_weekly` | `…essential_monthly` | `…essential_yearly` |
> | Plus | `…plus_weekly` | `…plus_monthly` | `…plus_yearly` |
> | Advance | `…advance_weekly` | `…advance_monthly` | `…advance_yearly` |
>
> all prefixed `com.bholeshankar.paperai.`

`APP_STORE_CONNECT_ISSUER_ID` and `APP_STORE_CONNECT_KEY_ID` are not read by the
workflow — submission credentials come from `eas.json`. Set them only if you wire
up a workflow that uses them.
