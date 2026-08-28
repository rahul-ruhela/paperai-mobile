# Subscription & Entitlement Policy

Status: **implemented and verified.**
Written: 2026-08-27. Implemented: 2026-08-28 on `chore/release-hardening` (roadmap Module 1).

Where the built module deviates from the original specification, the deviation is
recorded in place and marked **[as-built]** — this file describes what ships, not
what was once planned.

**What Module 1 added**

| Piece | Location |
|---|---|
| Upgrade copy, one sentence per gated key | `src/config/upgradeMessages.ts` |
| Shared locked-state UI + upgrade sheet | `src/ui/FeatureLock.js` (`FeatureLock`, `useUpgradePrompt`) |
| Locked-state data on every access check | `src/hooks/useFeatureAccess.js` |
| Expired-vs-never-subscribed | `src/services/entitlementService.js` → `isSubscriptionExpired`, and `Services/EntitlementService.cs` |
| Feature-aware paywall | `src/screens/PaywallScreen.js` — `route.params.featureKey` / `restore` |
| New matrix keys `smart_recall`, `voice_companion` | `featureMatrix.ts` + `Services/FeatureMatrix.cs` |
| Tests | `__tests__/upgradeMessages.test.ts`, `__tests__/featureMatrix.test.ts`, `tests/PaperAiApis.Tests/EntitlementPolicyTests.cs` |

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
| `smart_recall` | ADVANCE | Visible; locked with an example memory card | "Advance remembers the details for you." | `CheckAccessAsync` on every `/api/recall/*` route |
| `voice_companion` | ADVANCE | Visible; **Plus gets a locked preview** (one sample playback), lower tiers see the settings panel disabled | "Hear your reminders read aloud with Advance." | `CheckAccessAsync` on `/api/voice/preferences` |

**[as-built]** Both keys are **registered now**, in Module 1, even though Modules 6
and 7 have not been built. Registering the gate once here is the point of this
module: the alternative is each module inventing its own gate and this file being
rewritten twice. Neither key is reachable from any screen yet, and because the
mirror now fails closed (§6.3) a declared-but-unbuilt feature reads as *locked*
rather than as an unknown key that falls through to allowed.

**[as-built]** The Plus "locked preview" for `voice_companion` is **not built**.
It is a Module 7 concern — there is no voice surface to preview from yet — and
it is recorded here so Module 7 does not treat it as already done.

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
| Subscription expired | `SUBSCRIPTION_EXPIRED` → "Your plan ended on {date}. Renew to continue." with a Restore Purchases action **listed before** View plans. |
| Entitlement fetch failed | Treated as FREE; locked features show the normal CTA. No error is surfaced. |

**[as-built]** This contract is implemented once, in `src/ui/FeatureLock.js`, and
consumed through `useFeatureAccess`, which returns `lockReason`, `lockTitle`,
`lockMessage`, `tierBadge` and `showRestore` alongside `allowed`.

`ReminderCard` and `AssistantScreen` were converted to it. **They are the only
two tier locks in the app.** The other paywall prompts — in `UploadScreen`,
`ProcessScreen`, `AiChatScreen`, `ReceiptCaptureScreen` and `JunkWiperScanScreen`
— are **402 "not enough credits"** handlers, which this policy explicitly says
are *not* locks (§5, row 3); and the ones in `HomeScreen` and `SettingsScreen`
are plain navigation affordances (a credit pill, a "See plans" row). Converting
any of them to a lock would be a regression, turning a top-up prompt into a wall.

**[as-built]** A tier denial arriving from the server is handled in one place,
`src/api/client.js`: a 403 whose body carries `FEATURE_NOT_INCLUDED` or
`SUBSCRIPTION_EXPIRED` gets the server's feature-and-tier sentence as
`err.userMessage` instead of the generic "You don't have permission to do this",
and the parsed `{ code, requiredTier, expired }` is attached as `err.entitlement`
so a screen can route to the paywall. `isEntitlementDenial` deliberately matches
on the code rather than on the status, so an admin 403 is never rendered as an
upsell and a 402 is never rendered as a lock.

**[as-built] Expired is not the same as never-subscribed.** The backend used to
return `SUBSCRIPTION_EXPIRED` for *anyone* without an active plan, so a brand-new
Free user tapping a locked feature would have been told their plan ended on a
date that does not exist. `EntitlementService.CheckAccessAsync` now requires a
`ProductId` — evidence a subscription once existed — before it reports an expiry,
and returns `FEATURE_NOT_INCLUDED` otherwise. The client mirrors that test in
`isSubscriptionExpired`, which also treats the offline FREE fallback as
never-subscribed. Restore is offered **first** on an expiry, because the
commonest cause of a subscription that looks lapsed is a reinstall whose receipts
have not been replayed, and leading with "View plans" invites a second purchase
for something already owned.

---

## 6. Code changes — applied

1. **Done.** The five Storage Studio keys landed in Module 0; `smart_recall` and
   `voice_companion` landed here, in both `featureMatrix.ts` and `FeatureMatrix.cs`.
2. **Done** in Module 0 — migration `20260827230000_SeedStorageStudioCreditConfigs`.
3. **Done.** `isFeatureAllowed()` returns `false` for an unknown key.
   **[as-built]** This is a behaviour change, and the risk runs the other way now:
   a genuinely ungated on-device affordance that calls `isFeatureAllowed` with an
   unregistered key will render locked. That is the intended trade — the previous
   default is exactly how five paid features shipped unlocked — and it is
   contained by the parity test in (4), which fails in *both* directions. An
   ungated affordance must simply not call this.
4. **Done.** `__tests__/featureMatrix.test.ts` holds a checked-in snapshot of the
   backend keys and asserts key set, required tier and credit key in both
   directions. **[as-built]** It is a hand-maintained snapshot, not a generated
   one: the two repos do not build together, so a cross-repo codegen step would
   have to run in CI that does not exist yet. Updating it is a required step when
   `FeatureMatrix.cs` changes, and the test names that obligation in a comment.

### 6.1 Enforcement — closed 2026-08-28

**No controller calls `CheckAccessAsync`.** Grep for it and the only hit is
`EntitlementsController` asking the question on the client's behalf. Every paid
action today is gated by **credits alone**: `POST /api/credits/reserve` looks up a
cost and checks the balance, and never looks at the caller's tier.

That was the state until 2026-08-28. **It is now enforced, with grandfathering.**

**Where.** One check, at the top of `POST /api/credits/reserve`. Reserve is the
only path to a charge — "never charge outside the ledger" was already the rule —
so a single gate there covers every credit-bearing feature, rather than the same
check scattered across a dozen controllers where one omission is invisible.
Reserve is addressed by *credit* key, so the matrix is consulted through the new
`FeatureMatrix.GetByCreditKey`. A credit key no feature claims —
`duplicate_delete_selected` is a billing step inside a flow the user has already
been authorized for — is not tier-gated, and gating it would have blocked the
delete half of a scan someone had just paid to run.

**Grandfathering.** `Entitlements:GrandfatherBeforeUtc` (config, not a constant).
A subscription created before that instant keeps the wider access credits-only
gating gave it, for as long as it stays **continuously active**. Keyed on
`UserSubscription.CreatedAtUtc` — the original purchase — not `UpdatedAtUtc`,
which moves on every renewal and would quietly expire the grace after one cycle.
A lapsed old plan is *not* grandfathered: the exemption protects continuity of
something being paid for, not a permanent claim earned by having once subscribed.
`Entitlements:Enforce=false` restores the old behaviour without a deploy if the
rollout goes wrong.

**[as-built] Set the cutover to the actual deploy date before deploying.** It
currently reads `2026-08-28T00:00:00Z`, which was written while the API was still
undeployed. Anyone who subscribes between that instant and the real deploy would
be enforced without ever having had the old behaviour — harmless, but not what
the setting is for.

**[as-built] A timezone trap, found by the tests.** The JSON configuration binder
parses `"2026-08-28T00:00:00Z"` into a **local** `DateTime`. Compared against
`CreatedAtUtc`, which is genuinely UTC, that moved the cutover by the host's
offset — 5.5 hours on an IST machine — and briefly grandfathered subscriptions
bought after it. `EntitlementService.NormalizeToUtc` now forces the comparison to
UTC, reading `Unspecified` as UTC because the setting says so in its name.

**Client.** A denial arrives as the same structured 403 the check route returns,
so `client.js` already understood it. `showEntitlementDenial(err, navigation,
featureKey)` in `FeatureLock.js` turns it into the policy sheet and is wired into
all five paid actions (`UploadScreen`, `ProcessScreen`, `AiChatScreen`,
`ReceiptCaptureScreen`, `JunkWiperScanScreen`). It is a plain function, not a
hook, because it is called from inside `catch` blocks.

**[as-built]** The backend deliberately still fails **open** on an unknown key
(`CheckAccessAsync` allows anything not in the matrix), while the mobile mirror
now fails closed. That asymmetry is intentional: the server gates per-route with a
key the route names literally, so an unknown key there means "this route is not
gated", whereas on the client an unknown key means "we do not know what this is"
— and the safe answer to that is a lock with a CTA.

---

## 7. Testing — as built

**Backend** — `tests/PaperAiApis.Tests/EntitlementPolicyTests.cs` (91 tests pass in
the suite overall):

- Every key in the matrix × every tier, asserted against `/api/entitlements/me`,
  with a count check so an empty feature map cannot pass as green.
- Every key resolves through `/api/entitlements/check/{key}` rather than 404ing.
- `smart_recall` / `voice_companion` are 403 below Advance and 200 at Advance.
- Never-subscribed → `FEATURE_NOT_INCLUDED`; lapsed → `SUBSCRIPTION_EXPIRED`.
- A plan whose `Status` still says `active` but whose `ExpiresAtUtc` has passed
  resolves to Free — the date wins, so a missed Apple renewal notification cannot
  extend a plan indefinitely.
- Every `CreditFeatureKey` in the matrix can be priced by
  `/api/credits/feature-configs/{key}`. **[as-built]** Asserted through that route
  rather than against the seed table, because the route answers from either the
  database *or* the controller's built-in defaults, and both are legitimate —
  `receipt_extract` and `document_ai_chat` are priced only by the defaults today.

**Mobile** — `__tests__/upgradeMessages.test.ts` and `__tests__/featureMatrix.test.ts`
(101 tests pass overall):

- Copy coverage: every gated key has a sentence, no free key has one, no sentence
  exists for a key the matrix does not know.
- The §4 rules are enforced mechanically — names the tier, one sentence, no
  exclamation mark, no digit or currency symbol, never bare "Upgrade".
- Expired vs never-subscribed across all four snapshot shapes, including the
  offline FREE fallback.
- Unknown keys fail closed.

**Not automated** — the two rendering assertions from the original plan (locked
entry point still present in the tree; offline FREE fallback rendering) need
`@testing-library/react-native`, which this repo does not have. They stay on the
manual tier matrix in the roadmap §9.4 until that dependency is added.
