# App Store Screenshots Guide — PaperAI

This document explains what screenshots Apple requires, why they matter, and exactly how to generate them for PaperAI.

---

## What Apple Requires

As of 2024, Apple requires screenshots for the **6.9" display (iPhone 16 Pro Max)**. This is the only mandatory size. All other sizes are optional but recommended.

| Device | Size | Resolution | Required? |
|--------|------|-----------|----------|
| iPhone 16 Pro Max | 6.9" | 1320 × 2868 px | **YES — Required** |
| iPhone 15 Plus / 14 Plus | 6.5" | 1284 × 2778 px | Recommended |
| iPhone 8 Plus | 5.5" | 1242 × 2208 px | Optional |
| iPad Pro 12.9" (6th gen) | 12.9" | 2048 × 2732 px | Only if supportsTablet: true |

> PaperAI has `supportsTablet: true` in `app.json`, so iPad screenshots are technically required if you want to appear in iPad search. For initial submission, iPhone only is acceptable.

**You can upload up to 10 screenshots per device size.** Apple shows the first 3 prominently in search results. Make those 3 count.

---

## What Screenshots to Take

### Recommended Screenshot Set (5 screens)

| Order | Screen | What it should show | Why it matters |
|-------|--------|---------------------|----------------|
| 1 | Home / Dashboard | Main interface with recent documents | First impression — shows the core value |
| 2 | Document Upload | Camera or gallery picker active | Shows ease of use |
| 3 | AI Analysis Result | AI-extracted text, summary, or insights | Shows the core feature |
| 4 | Subscription / Paywall | Pro plans with weekly/monthly/yearly pricing | Required for IAP transparency |
| 5 | Login / Onboarding | Clean welcome or login screen | Shows professional polish |

**Marketing overlay text suggestions (add in Figma/Canva):**

| Screenshot | Headline Text |
|-----------|--------------|
| 1 | "Your AI Document Assistant" |
| 2 | "Scan or Upload Any Document" |
| 3 | "Instant AI-Powered Insights" |
| 4 | "Go Pro. Unlock Full Analysis." |
| 5 | "Get Started in Seconds" |

---

## Method 1 — Expo Go on iPhone (Fastest, No Mac Required)

This is the fastest option if you have any modern iPhone.

### Step 1 — Run the app

```bash
npx expo start --clear
```

Scan the QR code with your iPhone camera. The Expo Go app opens PaperAI.

### Step 2 — Navigate to each screen

Go to: Home → Upload → AI Result → Subscription screen → Login screen

### Step 3 — Take screenshots

Press **Side button + Volume Up** simultaneously on your iPhone.

Screenshots save to Photos app.

### Step 4 — Transfer to your computer

- Use **AirDrop** (Mac): share from Photos app
- Use **iCloud Photos**: open icloud.com/photos on your PC
- Use **USB cable**: plug in iPhone → File Explorer → DCIM folder

### Step 5 — Resize if needed

If your iPhone is NOT an iPhone 16 Pro Max, you need to resize or re-export. Use:
- **Windows:** Photos app → open image → see resolution in Details
- Apple accepts screenshots from any iPhone as long as they are labeled for the correct device size in App Store Connect

> **Note:** Screenshots from Expo Go are valid for App Store Connect. Apple reviews the actual binary separately — the screenshots just need to accurately represent the app's UI.

---

## Method 2 — Xcode Simulator on Mac (Best Quality)

Requires a Mac with Xcode installed.

### Step 1 — Install Xcode

Download from the Mac App Store (free, ~15 GB).

### Step 2 — Run the PaperAI simulator build

Option A — use a pre-built simulator binary from EAS:
```bash
eas build --profile simulator --platform ios
```
Download the `.tar.gz` from the EAS dashboard, extract it, then:
```bash
# Drag the .app file into the simulator window
open -a Simulator
```

Option B — run directly from the project:
```bash
npx expo run:ios
```
This requires Xcode command line tools.

### Step 3 — Open the correct simulator

In Xcode → Open Simulator, or from menu bar:
- **Simulator** app → File → New Simulator
- Device: **iPhone 16 Pro Max**
- iOS Version: 18.x

### Step 4 — Take screenshots

Navigate to each screen, then:
- **Keyboard shortcut:** `Cmd + S` — saves PNG to Desktop
- **Menu:** File → Save Screen

Screenshots are saved as PNGs at the native resolution (1320 × 2868 for iPhone 16 Pro Max).

---

## Method 3 — Online Screenshot Generator (No Device or Mac Needed)

Use these tools to wrap any screenshot in a device frame and add marketing text.

### Recommended: AppLaunchpad (Free)

1. Go to https://theapplaunchpad.com
2. Select **iPhone 16 Pro Max** as the device
3. Upload your screenshots (from Expo Go or any source)
4. Add headline text
5. Export at the correct resolution
6. Upload to App Store Connect

### Other Tools

| Tool | Free? | Notes |
|------|-------|-------|
| AppLaunchpad | Free | Best free option, many device frames |
| Mockuphone | Free | Simple, quick |
| Canva | Free tier | Most design control, good for adding text overlays |
| Figma | Free tier | Best for pixel-perfect frames with text |

### Canva Workflow

1. Create a new design → Custom size: **1320 × 2868 px**
2. Upload your raw screenshot
3. Add an iPhone 16 Pro Max frame (search "iPhone 16 frame" in Canva elements)
4. Add a text overlay with your headline
5. Set background color to match your app's color scheme (`#020617` is PaperAI's splash background)
6. Download as PNG
7. Upload to App Store Connect

---

## Uploading to App Store Connect

### Step 1

Go to: **App Store Connect → Apps → Paper Ai Assistant → App Store tab → English (U.S.)**

### Step 2

Scroll down to **Screenshots** → **iPhone** section.

### Step 3

Under **6.9-inch Display**, drag and drop your screenshots or click to upload.

- Upload at least 1 screenshot (maximum 10)
- Order them by dragging — the first 3 are shown in search results

### Step 4

Click **Save** (top right).

### Step 5

Repeat for **6.5-inch Display** if you have those screenshots.

---

## Screenshot Requirements Checklist

- [ ] At least 1 screenshot for 6.9" iPhone 16 Pro Max uploaded
- [ ] Screenshots are PNG or JPEG (PNG preferred)
- [ ] No alpha channel (transparency) — screenshots must be opaque
- [ ] Screenshots accurately represent the app's actual UI
- [ ] No device bezels in the raw screenshot if uploading to a framing tool (framing is added separately)
- [ ] First screenshot shows the most compelling feature
- [ ] Screenshots do not show pricing that differs from what is configured in App Store Connect
- [ ] Screenshots do not show competitor app names or logos

---

## Common Mistakes to Avoid

| Mistake | What happens | Fix |
|---------|-------------|-----|
| Uploading the wrong resolution | App Store Connect rejects the upload | Check dimensions before uploading |
| Using a screenshot with price text that doesn't match IAP | Apple may reject for "misleading" | Match paywall screenshot to actual configured prices |
| Uploading screenshots that show Expo Go's bottom bar | Looks unprofessional | Take screenshots from a real build or crop the Expo Go bar out |
| First screenshot is the login screen | Low conversion rate | Put your most impressive feature first (AI analysis result) |
| No device frame around screenshots | Harder to read | Add a device frame in Canva or AppLaunchpad |

---

## Quick Reference — PaperAI App Colors

Use these to match your screenshot overlays to the app's brand:

| Element | Color |
|---------|-------|
| Splash background | `#020617` |
| Primary accent | `#6366f1` (indigo) |
| Text on dark background | `#ffffff` |
| Secondary text | `#94a3b8` |
