# Subscription & Entitlement Policy

Status: **specification only — no code changed.** Recommendations for `FeatureMatrix.cs` / `featureMatrix.ts` are listed but not applied.
Written: 2026-08-27.

---

## 1. Principles

1. **The backend is the authority.** `Services/FeatureMatrix.cs` + `Services/EntitlementService.cs` decide access. `src/config/featureMatrix.ts` only decides how the UI *looks*.
2. **Nothing disappears.** A feature the user cannot use is still rendered — dimmed, with a lock badge and an upgrade CTA. No conditional unmounting of feature entry points.
3. **Tier is derived, never stored on the client.** It comes from `GET /api/entitlements/me`, which resolves it from `UserSubscriptions` via `IapCatalog`.
4. **Credits are orthogonal to tier.** Tier decides *whether* a feature is reachable; `FeatureCreditConfig` + `TokenLedger` decide *what one run costs*. A user with the right tier and no credits sees a top-up prompt, not a lock.
5. **Failure is downgrade-safe.** If the entitlement call fails, `entitlementService.js` returns the FREE snapshot. Locked-with-CTA is the safe default; unlocked-on-error is not.

---

## 2. Tiers

| Tier | Wire value | Source | Intent |
|---|---|---|---|
| FREE | `free` | no active subscription | On-device utilities, one-off trials, full visibility of everything else. |
| ESSENTIAL | `essential` | `IAP:Products` → tier | Single-document AI: analysis, OCR, summarize, receipts, reminders. |
| PLUS | `plus` | `IAP:Products` → tier | Conversational and multi-document AI, deeper cleaning. |
| ADVANCE | `advance` | `IAP:Products` → tier | Assistant intelligence: recall, voice, household. |

Ordering is numeric (`AccessTier` enum, `TIER_ORDER` in the mirror): a tier grants everything at or below it. There is no per-feature à-la-carte purchase.

---

## 3. Feature policy table

Columns: **UI** = what a user below the required tier sees. **Backend requirement** = what the server enforces before doing work.

### 3.1 Free / on-device

| Feature key | Min tier | UI visibility | Upgrade message | Backend requirement |
|---|---|---|---|---|
| `upload_hub` | FREE | Always active | — | none (no server work) |
| `document_scanner` | FREE | Always active | — | none |
| `code_scanner` | FREE | Always active | — | none |
| `signature_editor` | FREE | Always active | — | none |
| `usage_dashboard` | FREE | Always active | — | `[Authorize]`, own data only |

### 3.2 Essential

| Feature key | Min tier | UI visibility | Upgrade message | Backend requirement |
|---|---|---|---|---|
| `document_ai_analysis` | ESSENTIAL | Visible; lock badge for Free | "Analyse documents with AI on Essential." | `CheckAccessAsync` + Reserve `document_scan_ai_ready` |
| `image_ocr` | ESSENTIAL | Visible; locked | "Pull text out of any photo with Essential." | `CheckAccessAsync` + Reserve `image_ocr_extract_text` |
| `summarize_text` | ESSENTIAL | Visible; locked | "Get instant summaries with Essential." | `CheckAccessAsync` + Reserve `summarize_text` |
| `receipt_extraction` | ESSENTIAL | Visible; locked | "Turn receipts into expenses with Essential." | `CheckAccessAsync` + Reserve `receipt_extract` |
| `smart_reminders` | ESSENTIAL | Visible; locked | "Never miss a due date — Essential." | `CheckAccessAsync` (scheduling itself is local) |

### 3.3 Plus

| Feature key | Min tier | UI visibility | Upgrade message | Backend requirement |
|---|---|---|---|---|
| `explain_text_detail` | PLUS | Visible; locked | "Ask for a deeper explanation on Plus." | `CheckAccessAsync` + Reserve `explain_text_detail` |
| `ai_chat` | PLUS | Visible; free-message counter for lower tiers (`chatFreeMessages.js`), then locked | "Keep chatting about your documents with Plus." | `CheckAccessAsync` + Reserve `document_ai_chat` |
| `deep_clean` | PLUS | Visible; locked | "Deep Clean finds far more with Plus." | `CheckAccessAsync` + Reserve `junk_wiper_scan_report` |
| `similar_photos` | PLUS | Visible; locked | "Group near-identical photos with Plus." | `CheckAccessAsync` + Reserve `similar_photo_scan` **(seed missing — see D2)** |

### 3.4 Advance

| Feature key | Min tier | UI visibility | Upgrade message | Backend requirement |
|---|---|---|---|---|
| `advanced_reminders` | ADVANCE | Visible; snooze/custom-date controls shown but prompt on tap | "Custom dates and snooze are part of Advance." | tier from snapshot; notifications are local |
| `household_assistant` | ADVANCE | Visible; locked | "Run the household from one place with Advance." | `CheckAccessAsync` |
| `smart_recall` *(new)* | ADVANCE | Visible; locked with an example memory card | "Advance remembers the details for you." | `CheckAccessAsync` on every `/api/recall/*` route |
| `voice_companion` *(new)* | ADVANCE | Visible; **Plus gets a locked preview** (one sample playback), lower tiers see the settings panel disabled | "Hear your reminders read aloud with Advance." | `CheckAccessAsync` on `/api/voice/preferences` |

### 3.5 Storage Studio (declared backend-side, missing from the mobile mirror — D1)

| Feature key | Min tier | UI visibility | Upgrade message | Backend requirement |
|---|---|---|---|---|
| `storage_studio` | FREE | Always active (the hub) | — | none |
| `screenshot_cleaner` | FREE | Always active | — | none |
| `large_video_finder` | FREE | Always active | — | none |
| `blurry_detector` | ESSENTIAL | Visible; locked | "Find blurry shots automatically with Essential." | `CheckAccessAsync` + Reserve `blurry_photo_scan` **(seed missing — D2)** |
| `similar_photos` | PLUS | see §3.3 | | |

---

## 4. Upgrade-message rules

- Name the tier and the benefit; never say only "Upgrade".
- One sentence, sentence case, no exclamation marks.
- Always route to `Paywall` with the feature key, so the paywall can highlight the plan that unlocks *that* feature.
- Never state a price in a feature CTA — prices come from StoreKit (`titleForSku` already reads live product titles).

---

## 5. Locked-state UI contract

| State | Rendering |
|---|---|
| Allowed | Normal. |
| Locked (tier too low) | Entry point visible, 55 % opacity, lock glyph, tap → upgrade sheet with the message above. Never hidden, never removed from lists. |
| Allowed but no credits | Not a lock. Credit-cost sheet (`CreditConfirmModal`) with a top-up CTA. |
| Subscription expired | `SUBSCRIPTION_EXPIRED` from the backend → "Your plan ended on {date}. Renew to continue." with a Restore Purchases action. |
| Entitlement fetch failed | Treated as FREE; locked features show the normal CTA. No error is surfaced. |

---

## 6. Recommended (not applied) code changes

1. Add the five Storage Studio keys and the two new keys (`smart_recall`, `voice_companion`) to `src/config/featureMatrix.ts` so the mirror matches `FeatureMatrix.cs`.
2. Seed `blurry_photo_scan` and `similar_photo_scan` in `FeatureCreditConfig` before either feature is reachable.
3. Change `isFeatureAllowed()` to return `false` for unknown keys once the mirror is complete — today an unknown key returns `true`, which fails open in the UI.
4. Add a Jest parity test comparing the mirror's keys against a checked-in snapshot of the backend keys, so drift breaks CI rather than production.

---

## 7. Testing

- Per tier (Free/Essential/Plus/Advance), assert every key in §3 resolves to the expected `allowed` value from `/api/entitlements/me`.
- Assert every locked entry point is still present in the rendered tree (query by test ID, expect visible + `accessibilityState.disabled`).
- Expired subscription: server returns `SUBSCRIPTION_EXPIRED`; assert the renew copy and Restore Purchases action.
- Offline: assert the FREE fallback and that no feature renders unlocked.
