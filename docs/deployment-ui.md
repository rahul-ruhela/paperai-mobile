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
cd c:\Rahul\bsepall\paperworkai\paperai\paperai-mobile

# Install dependencies
npm install

# Copy env template
copy .env.example .env.local
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
      "ascAppId": "YOUR_NUMERIC_APP_ID",      ← from App Store Connect
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

| Secret | Value |
|--------|-------|
| `EXPO_TOKEN` | From expo.dev → Account → Access Tokens |
| `API_BASE_URL_STAGING` | `https://apis.bseptechnologies.com` |
| `API_BASE_URL_PRODUCTION` | `https://apis.bseptechnologies.com` |
| `APPLE_WEEKLY_PRODUCT_ID` | `com.bholeshankar.paperai.pro_weekly` |
| `APPLE_MONTHLY_PRODUCT_ID` | `com.bholeshankar.paperai.pro_monthly` |
| `APPLE_YEARLY_PRODUCT_ID` | `com.bholeshankar.paperai.pro_yearly` |
| `APP_STORE_CONNECT_ISSUER_ID` | From App Store Connect → Keys |
| `APP_STORE_CONNECT_KEY_ID` | From App Store Connect → Keys |
| `APP_STORE_CONNECT_PRIVATE_KEY` | Contents of .p8 file |
