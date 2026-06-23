# Frontend Environment Guide

## Environment variables

All public variables are prefixed `EXPO_PUBLIC_` and baked into the JS bundle at build time by Metro/EAS.

| Variable | Description | Local dev | Staging (TestFlight) | Production (App Store) |
|----------|-------------|-----------|----------------------|------------------------|
| `EXPO_PUBLIC_APP_ENV` | Environment name | `local` | `staging` | `production` |
| `EXPO_PUBLIC_API_BASE_URL` | Backend API base URL | `http://192.168.1.28:5263` | `https://apis.bseptechnologies.com` | `https://apis.bseptechnologies.com` |
| `EXPO_PUBLIC_APPLE_WEEKLY_PRODUCT_ID` | Apple IAP SKU | `com.bholeshankar.paperai.pro_weekly` | same | same |
| `EXPO_PUBLIC_APPLE_MONTHLY_PRODUCT_ID` | Apple IAP SKU | `com.bholeshankar.paperai.pro_monthly` | same | same |
| `EXPO_PUBLIC_APPLE_YEARLY_PRODUCT_ID` | Apple IAP SKU | `com.bholeshankar.paperai.pro_yearly` | same | same |

---

## How environment switching works

1. **Local dev (`expo start`)**: reads `.env.local` (gitignored). Change `EXPO_PUBLIC_API_BASE_URL` to your machine's LAN IP.
2. **EAS Build profiles**: `eas.json` injects the correct vars per profile at build time.
3. **GitHub Actions**: secrets are passed as env vars to `eas build`.

---

## Local development setup

```bash
# 1. Copy the example env file
cp .env.example .env.local

# 2. Edit .env.local and set your local machine IP
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LOCAL_IP:5263

# 3. Start the app
npx expo start

# 4. For real device testing (dev client build)
eas build --profile development --platform ios
```

---

## EAS Build commands

```bash
# iOS simulator build (local testing)
eas build --profile simulator --platform ios

# iOS TestFlight build (internal distribution)
eas build --profile preview --platform ios

# iOS App Store build (production)
eas build --profile production --platform ios

# Submit to App Store Connect (after production build)
eas submit --platform ios --latest
```

---

## Required GitHub Secrets

Set these in GitHub → Settings → Secrets → Actions:

| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | From expo.dev → Account Settings → Access Tokens |
| `API_BASE_URL_STAGING` | `https://apis.bseptechnologies.com` |
| `API_BASE_URL_PRODUCTION` | `https://apis.bseptechnologies.com` |
| `APPLE_WEEKLY_PRODUCT_ID` | `com.bholeshankar.paperai.pro_weekly` |
| `APPLE_MONTHLY_PRODUCT_ID` | `com.bholeshankar.paperai.pro_monthly` |
| `APPLE_YEARLY_PRODUCT_ID` | `com.bholeshankar.paperai.pro_yearly` |
| `APP_STORE_CONNECT_ISSUER_ID` | From App Store Connect → Keys |
| `APP_STORE_CONNECT_KEY_ID` | From App Store Connect → Keys |
| `APP_STORE_CONNECT_PRIVATE_KEY` | `.p8` file contents (App Store Connect API key) |

---

## eas.json profiles summary

| Profile | Distribution | API env | Use for |
|---------|-------------|---------|---------|
| `development` | Internal | Local | Real device dev client |
| `simulator` | Internal | Local | iOS Simulator |
| `preview` | Internal | Staging | TestFlight internal testing |
| `production` | Store | Production | App Store release |

---

## eas submit configuration

Before running `eas submit`, update `eas.json` `submit.production.ios`:
- `ascAppId`: your App ID from App Store Connect (numeric, e.g. `1234567890`)
- `appleTeamId`: your Apple Developer Team ID (e.g. `ABCDE12345`)

OR use App Store Connect API keys (recommended for CI):
```bash
APP_STORE_CONNECT_ISSUER_ID=xxx
APP_STORE_CONNECT_KEY_ID=xxx
APP_STORE_CONNECT_PRIVATE_KEY=xxx  # contents of .p8 file
```
