# App Store Connect Setup — PaperAI

Complete setup guide for getting PaperAI configured in App Store Connect, from app creation through first submission.

---

## 1. Create the app

1. Go to https://appstoreconnect.apple.com
2. Apps → + → New App
3. Platform: iOS
4. Name: **Paper Ai Assistant**
5. Primary Language: English (US)
6. Bundle ID: **com.bholeshankar.paperai** (must match app.json exactly)
7. SKU: `paperai-mobile` (any unique string)
8. User Access: Full Access
9. Click Create

Note the **App ID** (numeric, e.g. `1234567890`) — you'll need it for `eas.json`

---

## 2. Create subscription products

Go to: App Store Connect → your app → Monetization → In-App Purchases → Subscriptions

### Create subscription group
- Name: **Pro Plans**
- Reference Name: `pro_plans`

### Create 9 products inside the group

Source of truth for IDs, credits and prices: `SUBSCRIPTION_TIERS` in `src/constants/api.ts`.
All 9 must live in the **same** group so users can upgrade/downgrade between tiers.

| Product ID (prefix `com.bholeshankar.paperai.`) | Reference Name | Duration | Price |
|-----------|---------------|----------|-------|
| `essential_weekly` | Essential Weekly | 1 week | $15.99/week |
| `essential_monthly` | Essential Monthly | 1 month | $57.90/month |
| `essential_yearly` | Essential Yearly | 1 year | $459.00/year |
| `plus_weekly` | Plus Weekly | 1 week | $42.49/week |
| `plus_monthly` | Plus Monthly | 1 month | $153.99/month |
| `plus_yearly` | Plus Yearly | 1 year | $699.00/year |
| `advance_weekly` | Advance Weekly | 1 week | $85.00/week |
| `advance_monthly` | Advance Monthly | 1 month | $309.00/month |
| `advance_yearly` | Advance Yearly | 1 year | $899.00/year |

For each product:
- Add display name and description in English (required — without this, status stays "Missing Metadata")
- Set the price **schedule for all territories**, not just the base one — a partial schedule
  also leaves the product in "Missing Metadata", and such products are dropped from the
  StoreKit fetch so the paywall shows "UNAVAILABLE"
- Status must be **Ready to Submit** before you can submit the app

---

## 3. Shared Secret

Go to: App Store Connect → your app → Monetization → In-App Purchases → App-Specific Shared Secret

- Click Generate
- Copy the value
- Add to API backend: `AppleIap:SharedSecret` in environment variables

---

## 4. App Store Server API key

Go to: App Store Connect → Users and Access → Integrations → In-App Purchase

- Click + to create a key
- Note **Issuer ID** (top of page) and **Key ID** (in table)
- Download the `.p8` file (can only download once — store securely)
- Add to API backend environment variables:
  - `AppleAppStoreServerApi__IssuerId`
  - `AppleAppStoreServerApi__KeyId`
  - `AppleAppStoreServerApi__PrivateKeyP8` (contents of the .p8 file, single line)

---

## 5. Server Notifications V2

Go to: App Store Connect → your app → App Information → App Store Server Notifications

- Production server URL: `https://apis.bseptechnologies.com/api/billing/ios/notifications-v2`
- Sandbox server URL: (leave blank — backend auto-detects environment)

---

## 6. App Store Connect API key (for EAS Submit / CI)

Go to: App Store Connect → Users and Access → Integrations → App Store Connect API

- Click + to create a key
- Role: **App Manager**
- Note **Issuer ID** and **Key ID**
- Download `.p8` file
- Add to GitHub Secrets:
  - `APP_STORE_CONNECT_ISSUER_ID`
  - `APP_STORE_CONNECT_KEY_ID`
  - `APP_STORE_CONNECT_PRIVATE_KEY` (full contents of .p8 file)

> **Important:** This is a DIFFERENT key than the App Store Server API key above.
> - Server API key → used by the backend to verify receipts and transactions
> - App Store Connect API key → used by EAS CLI and GitHub Actions to upload builds

---

## 7. Apple Team ID

Go to: https://developer.apple.com → Account → Membership

- Copy **Team ID** (e.g. `ABCDE12345`)
- Add to `eas.json` → `submit.production.ios.appleTeamId`

---

## 8. Create sandbox Apple ID for testing

Go to: https://appstoreconnect.apple.com → Users and Access → Sandbox Testers

- Click + to add a tester
- Use a new email address (not your real Apple ID — Apple requires this to be a new/unused email)
- Set a password you can remember — you'll enter this in App Review Notes

On your test device:
- Settings → App Store → scroll to bottom → **Sandbox Account**
- Sign in with the sandbox tester email and password

Use this account when testing subscriptions in TestFlight.

---

## 9. Legal URLs (required for subscriptions)

Both of these are live and already linked from inside the app (Help Center, Paywall):

- Privacy Policy: `https://bseptechnologies.com/paper-ai/privacy`
- Terms of Use: `https://bseptechnologies.com/paper-ai/terms`
- Support: `https://bseptechnologies.com/paper-ai/support`

### Privacy Policy URL

Apple requires a Privacy Policy URL for any app with subscriptions. Without it, Apple **will reject** your submission.

Add it in App Store Connect → App Information → Privacy Policy URL, **and** in the
App Store listing → English (U.S.) localization → Privacy Policy URL.

### Terms of Use (EULA) — guideline 3.1.2

Apple's automated reviewer scans the **App Description text** for a Terms of Use link.
Linking Terms from inside the app is required but does not satisfy this check — the first
submission was rejected for exactly this reason.

Append to the end of the English (U.S.) Description:

```
Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/
Privacy Policy: https://bseptechnologies.com/paper-ai/privacy
```

Apple's standard EULA URL above is the safe choice. To use the custom terms page instead,
you must also paste the full EULA **text** into App Information → License Agreement — a URL
on its own is not accepted there.

This is metadata-only. A rejection for it needs no new build: edit the Description, save,
reply to the review message, and resubmit the same binary.

---

## 10. TestFlight — Internal and External Testing

### What is TestFlight?

TestFlight is Apple's beta distribution platform. It installs the exact same binary that goes to the App Store, allowing you to test real IAP, push notifications, and permissions that don't work in Expo Go.

### Internal Testing (your team — no Apple review required)

- Max 100 testers
- Build is available immediately after TestFlight processing (~15 min)
- Purpose: developer and QA testing before App Store submission

**How to add internal testers:**

1. App Store Connect → your app → TestFlight → Internal Testing
2. Click + next to testers
3. Add the App Store Connect user emails (must be team members in your App Store Connect account)
4. They receive a TestFlight invite email
5. They install TestFlight app → accept invite → install PaperAI

### External Testing (public beta — requires Apple review)

- Up to 10,000 testers
- Apple does a quick review (~1 day) before testers can install
- Purpose: beta feedback from real users before a major release

**You do NOT need external testing for your first App Store submission.**

Use external testing when you want to gather feedback from early adopters before a big version launch.

### Why Internal Testing is Required Before Submitting

You must run through TestFlight internally because:

1. **IAP only works in real builds** — StoreKit 2 subscriptions cannot be tested in Expo Go. TestFlight is the only way to verify purchases work end-to-end before Apple reviews your app.

2. **Apple's reviewer uses your demo account to test IAP** — If the subscription purchase fails during review, your app is rejected. Testing via TestFlight first catches these failures.

3. **Permissions require a native build** — Camera, photo library, and microphone permissions only trigger in TestFlight/production builds, not Expo Go.

4. **Backend integration must be verified on production URL** — TestFlight builds hit `https://apis.bseptechnologies.com`, not your local machine. You need to verify this works before submission.

### TestFlight Critical Test Checklist

Test these flows specifically in TestFlight before submitting:

- [ ] Register → Login → OTP works
- [ ] Upload document via Camera
- [ ] Upload document via Photo Library
- [ ] AI analysis result shows correctly
- [ ] Paywall / subscription screen appears
- [ ] Sign into Sandbox Apple ID (Settings → App Store → Sandbox Account)
- [ ] Purchase weekly subscription → Pro access granted
- [ ] Restore Purchases → active subscription restored
- [ ] Log out and back in → subscription state persists

---

## 11. App Store listing checklist

- [ ] App name: Paper Ai Assistant
- [ ] Subtitle: AI Document Scanner & Analyzer (optional, 30 chars)
- [ ] Description (4000 chars max) — see README Section 6 for full copy
- [ ] Keywords (100 chars): `AI,document,scanner,PDF,analyzer,OCR,paper,assistant,extract,summarize,receipt,invoice`
- [ ] Support URL: `https://bseptechnologies.com/paper-ai/support`
- [ ] Privacy Policy URL: `https://bseptechnologies.com/paper-ai/privacy`
- [ ] Terms of Use (EULA) link present in the Description body — see Section 9
- [ ] Screenshots: 6.9" required — see [screenshots-guide.md](./screenshots-guide.md)
- [ ] Age Rating: 4+ (complete the questionnaire — all answers are "None")
- [ ] Content Rights: "No, it does not contain third-party content"
- [ ] Build selected (click + in Build section after processing completes)
- [ ] App Review Information:
  - Sign-in required: Yes
  - Demo account: sandbox tester email + password
  - Review notes: explain the subscription test flow

---

## 12. Submitting for Review

1. All sections above must be complete and show a green checkmark in App Store Connect
2. All 9 IAP products must be in **Ready to Submit** status
3. Click **"Add for Review"** at the top right
4. Answer export compliance: **No** (PaperAI uses HTTPS only)
5. Click **"Submit to App Review"**

Expected: 24–48 hours for initial review. Apple may ask for clarification via email.

---

## 13. Post-Approval Steps

1. App status → **Pending Developer Release** → click **Release This Version**
2. Or set up **Phased Release** (recommended): releases to 1% → 2% → 5% → 10% → 20% → 50% → 100% over 7 days, giving you time to catch any production issues
3. Verify App Store Server Notifications are firing (check backend logs for `/api/billing/ios/notifications-v2`)
4. Monitor first real subscription purchase in backend database
