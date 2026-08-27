# App Store Connect — Listing Text (copy/paste)

Everything App Review checks in the **metadata** lives here. The previous
rejection was metadata-only: the Description had no functional **Terms of Use
(EULA)** link. An in-app Terms screen and the Privacy Policy URL field are not
enough — the reviewer scans the Description text itself.

Paste each block below **verbatim** into App Store Connect → Apps → Paper Ai
Assistant → the version being submitted.

---

## 1. Promotional Text (170 chars max)

```
Scan any document and let AI extract, summarise and organise it. Find duplicate photos, videos and files, and reclaim space in seconds.
```

---

## 2. Description

> Paste this whole block, including the subscription and legal sections at the
> end. **Do not trim the last two sections** — that is what caused the
> rejection.

```
Paper AI Assistant turns the paperwork on your phone into something you can actually use. Scan a document with your camera, or pick an image or PDF from your files, and PaperAI extracts the text, analyses it, and organises the result so you can find it again later.

WHAT YOU CAN DO

• Scan documents with your camera and get clean, readable text
• Extract text from photos and screenshots with on-demand OCR
• Upload PDFs and documents and have them analysed automatically
• Scan QR codes and barcodes
• Keep everything searchable in one organised library
• Track follow-up actions with a simple task list
• Find duplicate photos, videos and documents, and remove the copies you don't need
• See exactly where your credits go with usage analytics
• Choose a light or dark appearance, or follow your device setting

HOW CREDITS WORK

Paid AI features use credits. Every action shows its credit cost before it runs, and you confirm before anything is charged. If an operation fails, the reserved credits are refunded automatically. Features that complete successfully consume credits even when there is nothing to report — for example, a duplicate scan that finds a clean library.

PRIVACY

Your documents belong to you. We process them only to provide the features you ask for. You can delete your account, along with your documents and personal data, at any time from Settings.

SUBSCRIPTIONS

Paper AI Assistant offers three auto-renewable subscription tiers. Each tier is available as a weekly, monthly, or yearly subscription, and grants a set number of credits per billing cycle for use with the AI features above.


Prices are shown in the app in your local currency before you purchase.

Payment is charged to your Apple ID account at confirmation of purchase. Subscriptions renew automatically unless auto-renew is turned off at least 24 hours before the end of the current period. Your account is charged for renewal within 24 hours prior to the end of the current period. You can manage your subscription and turn off auto-renewal in App Store › Account › Subscriptions after purchase. Any unused portion of a free trial period, if offered, is forfeited when you purchase a subscription.

Terms of Use (EULA): https://bseptechnologies.com/paper-ai/terms
Privacy Policy: https://bseptechnologies.com/paper-ai/privacy
Support: https://bseptechnologies.com/paper-ai/support
```

---

## 3. Keywords (100 chars max)

```
AI,document,scanner,PDF,analyzer,OCR,duplicate,cleaner,extract,summarize,receipt,invoice,storage
```

---

## 4. URL fields

| Field | Value |
| --- | --- |
| Support URL | `https://bseptechnologies.com/paper-ai/support` |
| Marketing URL | `https://bseptechnologies.com` |
| Privacy Policy URL | `https://bseptechnologies.com/paper-ai/privacy` |

---

## 5. App Review Information — Notes

Reviewers need a working account and need to know the paid features are
credit-gated, or they will report the app as non-functional.

```
Sign-in: email + password, or Sign in with Apple. A demo account is provided above.

Paid AI features (document analysis, OCR, duplicate scan) consume credits. The demo account has been pre-loaded with credits so all features can be exercised without a purchase. Each action displays its credit cost and asks for confirmation before running.

Duplicate scan: Settings is not required — open Upload › Junk Wiper. The scan asks for photo library access. If the library has no duplicates the report legitimately shows "No duplicates found"; this is the correct result, not an error.

Phone OTP sign-in is intentionally not offered in this build. Email/password and Sign in with Apple are the supported sign-in methods.
```

- [ ] Demo account username + password filled in
- [ ] Demo account has credits pre-loaded on the **production** backend
- [ ] Contact phone + email filled in

---

## 6. In-app requirements (already satisfied — verify before submitting)

Guideline 3.1.2 requires these to be present **in the binary**, not only in
metadata. All are implemented; confirm they still render:

- [ ] Paywall shows tier name, duration, live localised price, and credits per cycle
- [ ] Paywall states the auto-renew terms
- [ ] Paywall links to **Terms of Use** and **Privacy Policy**
- [ ] Paywall has a working **Restore Purchases** button
- [ ] Settings links to Terms of Use (EULA) and Privacy Policy
- [ ] Settings offers in-app **account deletion** (guideline 5.1.1(v))

---

## 7. Subscriptions must be attached to the version

A recurring cause of "we could not find the in-app purchases" rejections:

- [ ] In the version page, scroll to **In-App Purchases and Subscriptions**
- [ ] Click **+** and attach all 9 subscription products to *this* version
- [ ] Every subscription has: localised display name, description, review screenshot
- [ ] Every subscription has a price schedule for **all territories** (a missing
      territory leaves the SKU in `MISSING_METADATA` and it will not load in the app)
