# iOS App Store Submission Checklist

## App Store Connect Setup

- [ ] App created in App Store Connect with Bundle ID `com.bholeshankar.paperai`
- [ ] App name set: **Paper Ai Assistant**
- [ ] Primary language set
- [ ] Bundle ID matches `app.json` exactly
- [ ] App Store Connect App ID (numeric) noted — needed for `eas.json` submit config

## Subscription Setup (In-App Purchases)

- [ ] Subscription group created (e.g. "Pro Plans")
- [ ] 3 subscription products created with exact IDs:
  - `com.bholeshankar.paperai.pro_weekly` — $8.99/week
  - `com.bholeshankar.paperai.pro_monthly` — $29.90/month
  - `com.bholeshankar.paperai.pro_yearly` — $279/year
- [ ] Each subscription has display name, description, and pricing set
- [ ] Shared Secret generated and saved to backend `appsettings.json` → `AppleIap.SharedSecret`
- [ ] Apple App Store Server API key created (for `verify-transaction-auto`)
  - Saved in backend `appsettings.json` → `AppleAppStoreServerApi`
- [ ] Server Notifications V2 URL registered:
  `https://apis.bseptechnologies.com/api/billing/ios/notifications-v2`

## Apple Developer Account

- [ ] Paid Apple Developer Program membership active
- [ ] Apple Team ID noted (used in `eas.json` submit config)
- [ ] App Store Connect API key created (for EAS Submit / CI)
  - Issuer ID, Key ID, .p8 file downloaded and stored in GitHub Secrets
- [ ] Distribution certificate + provisioning profile (EAS handles this automatically)

## App Binary / Build

- [ ] `eas build --profile production --platform ios` completes successfully
- [ ] Build appears in App Store Connect → TestFlight
- [ ] TestFlight testing completed with sandbox Apple ID accounts
  - [ ] Weekly subscription purchase works
  - [ ] Monthly subscription purchase works
  - [ ] Yearly subscription purchase works
  - [ ] Restore purchases works
  - [ ] Subscription cancellation reflected (entitlement shows expired)
- [ ] No crashes in TestFlight

## App Store Listing

- [ ] Screenshots for all required device sizes:
  - 6.9" (iPhone 16 Pro Max)
  - 6.5" (iPhone 14 Plus / 15 Plus)
  - 5.5" (iPhone 8 Plus)
  - 12.9" iPad Pro (if tablet supported)
- [ ] App description written (what the app does, key features)
- [ ] Keywords (up to 100 characters)
- [ ] Support URL (e.g. your website or email page)
- [ ] Privacy Policy URL (required for subscription apps)
- [ ] Terms of Use URL (required for subscription apps)
- [ ] Demo account credentials (if reviewer needs login):
  - Email: _______________
  - Password: _______________

## Privacy & Compliance

- [ ] App Privacy nutrition label completed in App Store Connect:
  - Data collected: Email, Name, Phone (optional), Documents uploaded by user
  - Purpose: App functionality, account management
  - Data linked to user: Yes (auth-based)
- [ ] `NSCameraUsageDescription` set in `app.json` ✅
- [ ] `NSPhotoLibraryUsageDescription` set in `app.json` ✅
- [ ] `ITSAppUsesNonExemptEncryption: false` set in `app.json` ✅ (uses HTTPS only)
- [ ] Age rating set (likely 4+)

## App Review Notes (template)

```
This app is an AI-powered document analysis tool. 

For testing subscription purchases, please use the sandbox Apple ID:
Email: [your sandbox tester email]
Password: [your sandbox tester password]

The app requires an account. You can register with any email address.
The subscription plans are real In-App Purchases — use sandbox mode.

Backend API: https://apis.bseptechnologies.com
Health check: https://apis.bseptechnologies.com/health
```

## Post-Submission

- [ ] App submitted for review
- [ ] Review notes filled in (see template above)
- [ ] Phased release configured (recommended: 7-day phased rollout)
- [ ] App Store Server Notifications confirmed working (check backend logs)

---

## Android Play Store Checklist (Future)

- [ ] Google Play Console account created
- [ ] App created with package `com.bholeshankar.paperai`
- [ ] Android App Bundle (AAB) built: `eas build --profile production --platform android`
- [ ] Signing keystore created and backed up securely
- [ ] Google Play Billing Library product IDs created (matching Apple IDs or new ones)
- [ ] Internal testing track set up
- [ ] Data safety section completed
- [ ] Target API level 34+ confirmed
- [ ] 64-bit support confirmed (Expo handles this)

---

## Subscription Testing Checklist

### TestFlight (sandbox)
- [ ] Backend `IAP:AllowSandbox: true` in staging environment ✅
- [ ] Sandbox Apple ID created at appleid.apple.com
- [ ] Sign in to sandbox account on test device (Settings → App Store → Sandbox Account)
- [ ] Purchase weekly plan → verify credits added in app
- [ ] Purchase monthly plan → verify credits added
- [ ] Purchase yearly plan → verify credits added
- [ ] Restore purchases → verify active plan shown
- [ ] Cancel subscription in iOS Settings → verify expiry handled gracefully

### Production
- [ ] Backend `IAP:AllowSandbox: false` in production ✅
- [ ] Backend `DevMode:BypassSubscription: false` in production ✅
- [ ] Real purchase tested by developer (can be refunded within 48h from Apple)

---

## API Failure Testing Checklist

- [ ] Kill backend → app opens, shows login screen, no crash
- [ ] Login with wrong password → friendly error "Invalid request"
- [ ] Login with backend down → "No connection. Please check your internet"
- [ ] Open home screen with backend down → empty state shows, no crash
- [ ] Open paywall with backend down → paywall renders, subscribe fails gracefully
- [ ] Token expired → auto-refresh happens silently
- [ ] Token expired and refresh fails → redirected to login gracefully

---

## Production Release Checklist

- [ ] Version bumped in `app.json` if needed
- [ ] `eas build --profile production --platform ios` completed
- [ ] TestFlight tested
- [ ] App Store listing complete
- [ ] `eas submit --platform ios --latest` submitted
- [ ] App Review approved
- [ ] Release published (manual or phased)
- [ ] Backend `appsettings.Production.json` deployed with correct keys
- [ ] Server Notifications endpoint live and tested
- [ ] First real subscription tested (can refund)
