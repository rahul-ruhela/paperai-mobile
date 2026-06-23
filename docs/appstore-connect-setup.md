# App Store Connect Setup — PaperAI

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

### Create 3 products inside the group

| Product ID | Reference Name | Duration | Price |
|-----------|---------------|----------|-------|
| `com.bholeshankar.paperai.pro_weekly` | Pro Weekly | 1 week | $8.99/week |
| `com.bholeshankar.paperai.pro_monthly` | Pro Monthly | 1 month | $29.90/month |
| `com.bholeshankar.paperai.pro_yearly` | Pro Yearly | 1 year | $279/year |

For each product:
- Add display name and description in English
- Set price
- Status must be **Ready to Submit** (not just Waiting for Review)

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
- Download the `.p8` file (can only download once)
- Add to API backend environment variables:
  - `AppleAppStoreServerApi__IssuerId`
  - `AppleAppStoreServerApi__KeyId`
  - `AppleAppStoreServerApi__PrivateKeyP8` (contents of the .p8 file, single line)

---

## 5. Server Notifications V2

Go to: App Store Connect → your app → App Information → App Store Server Notifications

- Production server URL: `https://apis.bseptechnologies.com/api/billing/ios/notifications-v2`
- Sandbox server URL: (same, or leave blank — backend auto-detects)

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
  - `APP_STORE_CONNECT_PRIVATE_KEY` (contents of .p8 file)

> **Note:** This is a different key than the App Store Server API key above.  
> Server API key → for receipt verification on backend  
> App Store Connect API key → for EAS Submit / CI automation

---

## 7. Apple Team ID

Go to: https://developer.apple.com → Account → Membership

- Copy **Team ID** (e.g. `ABCDE12345`)
- Add to `eas.json` → `submit.production.ios.appleTeamId`

---

## 8. Create sandbox Apple ID for testing

Go to: https://appstoreconnect.apple.com → Users and Access → Sandbox Testers

- Click + to add a tester
- Use a new email (not your real Apple ID)
- Use this account on your test device: Settings → App Store → Sandbox Account

---

## 9. Privacy Policy URL (required for subscriptions)

Apple requires a Privacy Policy URL for any app with subscriptions.

Options:
- Use a GitHub Pages site: `https://yourname.github.io/paperai-privacy`
- Use a simple hosted HTML page
- Use a Notion public page

Add the URL in App Store Connect → App Information → Privacy Policy URL.

---

## 10. App Store listing checklist

- [ ] App name: Paper Ai Assistant
- [ ] Subtitle (optional, 30 chars)
- [ ] Description (4000 chars max)
- [ ] Keywords (100 chars, comma-separated)
- [ ] Support URL
- [ ] Privacy Policy URL
- [ ] Screenshots: 6.9" (required), 6.5", 5.5"
- [ ] App Preview video (optional but helps conversion)
- [ ] Age Rating: 4+ (unless different content)
- [ ] Content Rights: "No, it does not contain third-party content"
- [ ] App Review Information:
  - Demo account email + password (sandbox tester)
  - Review notes: explain subscription purchase flow
