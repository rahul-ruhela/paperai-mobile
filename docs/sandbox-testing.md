# Sandbox Testing — Real IAP Before Going Live

How to test the **real, store-signed app** (including real StoreKit 2 subscriptions)
against Apple's **sandbox** environment before you submit to the App Store.

In-app purchases **cannot** be tested in Expo Go or the iOS Simulator. You need a
real, signed build on a physical device. The path below uses TestFlight.

---

## ⚠️ Prerequisite — Product IDs must match App Store Connect EXACTLY

The app fetches these **9** subscription products (see `src/constants/api.ts`):

```
com.bholeshankar.paperai.essential_weekly
com.bholeshankar.paperai.essential_monthly
com.bholeshankar.paperai.essential_yearly
com.bholeshankar.paperai.plus_weekly
com.bholeshankar.paperai.plus_monthly
com.bholeshankar.paperai.plus_yearly
com.bholeshankar.paperai.advance_weekly
com.bholeshankar.paperai.advance_monthly
com.bholeshankar.paperai.advance_yearly
```

> **Note:** `docs/appstore-connect-setup.md` and `.env.example` still describe an
> older 3-product model (`pro_weekly`, `pro_monthly`, `pro_yearly`). The shipping
> code uses the 9 IDs above. **Create these exact 9 product IDs** in
> App Store Connect → Monetization → Subscriptions, each in status
> **Ready to Submit** (display name + price set). If they don't exist, the paywall
> shows fallback prices and every purchase fails with "Cannot connect to iTunes
> Store" in sandbox.

---

## One-time GitHub setup (required for the workflow to submit)

Repo → Settings → Secrets and variables → Actions:

| Secret | What it is |
|--------|------------|
| `EXPO_TOKEN` | Expo access token (expo.dev → Account → Access tokens) |
| `API_BASE_URL_PRODUCTION` | `https://apis.bseptechnologies.com` |
| `APP_STORE_CONNECT_PRIVATE_KEY` | Full contents of the ASC API `.p8` (Key ID `LY4822XN6Q`) |

Then fill in the one remaining value in `eas.json` →
`submit.production.ios.ascApiKeyIssuerId` — replace `REPLACE_WITH_ASC_API_ISSUER_ID`
with your **Issuer ID** from App Store Connect → Users and Access → Integrations →
App Store Connect API. (The Issuer ID is not a secret; it's safe to commit.)

---

## Step 1 — Build + upload to TestFlight

GitHub → **Actions** → **iOS TestFlight (Sandbox Testing)** → **Run workflow**.

This runs `eas build --profile production` (the exact binary that would go to the
App Store) and `eas submit` to App Store Connect. Allow ~15 min for Apple to
finish processing the build in TestFlight.

## Step 2 — Create a Sandbox Tester

App Store Connect → Users and Access → **Sandbox Testers** → **+**.
Use a brand-new email (not your real Apple ID) and a memorable password.

## Step 3 — Sign into the sandbox on the device

On the iPhone: **Settings → App Store → Sandbox Account** → sign in with the
Sandbox Tester from Step 2. (Do **not** sign your real Apple ID out of the device.)

## Step 4 — Install via TestFlight and test

1. App Store Connect → your app → TestFlight → Internal Testing → add yourself.
2. Install the **TestFlight** app on the device → accept the invite → install PaperAI.
3. Open the paywall and run a real purchase. TestFlight builds automatically use
   Apple's **sandbox** — you are charged nothing, and renewals are accelerated
   (a "1 week" sub renews every few minutes) so you can watch renewal behaviour fast.

---

## Sandbox test checklist

- [ ] Paywall loads with **live Apple prices** (not the static fallback) → confirms the 9 product IDs exist in ASC
- [ ] Subscribe → Apple sheet appears → purchase succeeds
- [ ] Backend verifies the transaction (`/api/billing/ios/verify-transaction-auto`) and entitlement turns active
- [ ] **Restore Purchases** re-activates the subscription on a fresh install
- [ ] Log out / back in → subscription state persists
- [ ] Accelerated auto-renewal fires (watch backend `/api/billing/ios/notifications-v2` logs)

Once all of these pass in sandbox, use **iOS Production (App Store)** →
Run workflow (submit = true) to release.
