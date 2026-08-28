# Device Permission Center

Status: **implemented** — merged 2026-08-28 on `chore/release-hardening`.
Written: 2026-08-27. Tier: FREE, on-device, no credits.
Code: `src/services/permissionStatus.js`, `src/screens/PermissionCenterScreen.js`,
`__tests__/permissionStatus.test.js`; route `PermissionCenter` in `App.js`, entry
point in `SettingsScreen` under **Account → App Permissions**.

Deviations from the plan below are marked **[as-built]** in place.

A read-only status panel for the four permissions the app can use, plus a single button that opens iOS Settings. It displays state; it never changes it.

---

## 1. What it shows

| Permission | Status API (Expo SDK 54) | Why the app uses it | Feature lost when denied |
|---|---|---|---|
| Camera | `Camera.getCameraPermissionsAsync()` | Document and receipt scanning, QR/barcode | Camera scanner, code scanner |
| Photos | `MediaLibrary.getPermissionsAsync(false)` and `ImagePicker.getMediaLibraryPermissionsAsync()` | Pick images to OCR/sign, Junk Wiper duplicate scan | Upload from library, Smart Cleaner |
| Microphone | *(not read)* **[as-built]** | Not used today — `app.json` sets `microphonePermission: false` | none |
| Location | not requested today | Not used | none |
| Notifications | `Notifications.getPermissionsAsync()` | Reminders and analysis-complete alerts | All reminders |

**[as-built]** Microphone is listed but its status is **never read**. The
planned `getMicrophonePermissionsAsync()` call was dropped: `app.json` sets
`microphonePermission: false`, so the build ships without the usage string and
whatever the getter returns describes nothing the app does. Displaying a live
state there would imply a use that does not exist — the same reasoning as the
honesty rule below, carried into the code. Location is likewise never read;
`expo-location` is not a dependency at all.

**[as-built]** Photos is read through **both** listed APIs and the two results
are reconciled by `mergePhotoStates()`, most-restrictive-first
(`limited` > `denied` > `undetermined` > `granted`), with a failed read yielding
to the working one. The two shims read the same iOS authorisation but can
disagree; resolving a disagreement in the app's favour is the failure that
matters, so it resolves against.

Each row renders one of four states:

| State | Label | Row action |
|---|---|---|
| granted | **Allowed** | Open Settings (to revoke) |
| denied | **Denied** | Open Settings |
| undetermined | **Not asked** | *(none)* — an explanatory line only **[as-built]** |
| limited (Photos, iOS) | **Limited access** | "Manage selection" → `MediaLibrary.presentPermissionsPickerAsync()`, plus Open Settings |
| unknown **[as-built]** | **Unknown** | Open Settings |

**[as-built] The in-app request for the "Not asked" row was not built.** The row
shows "Not asked" plus the line *"Paper AI will ask the first time you use one of
these features."* and offers no request button. Two reasons, and they outrank the
convenience:

1. Guideline 5.1.1 asks for the prompt at the point of use, with a purpose string
   that matches what is about to happen. A settings panel is not a point of use,
   and a camera prompt fired from one has no feature in front of the user to say
   yes *for* — the single most likely way to turn an undetermined permission into
   a permanent denial.
2. It contradicted this file's own opening line ("It displays state; it never
   changes it") and §5's guarantee that the module calls only `get` variants.

The request path already exists where it belongs, in `src/utils/permissions.js`
and `CameraPermissionGate`, and is untouched. `getAllStatuses()` still returns
`canRequest` — it is now purely descriptive ("the OS could still prompt") and
nothing acts on it.

**[as-built] A fifth state, `unknown`,** covers a getter that throws (missing
native module, an OS the shim does not cover). One failed read degrades its own
row to "Unknown" and the rest of the panel still reports real values. Reporting a
failed read as "Denied" would be the panel lying about the user's own settings.

**Honesty rule:** Microphone and Location are listed as **Not used by this app** rather than shown as deniable toggles, because requesting a permission the app has no feature for is both a review risk and a trust problem. They appear so the user can verify the app is not using them.

---

## 2. Open Settings

`Linking.openSettings()` — the only supported way to reach the app's own settings page. Notes:

- It opens the app's settings pane; iOS gives no API to deep-link to a specific toggle within it, so the copy says "Open Settings, then choose Camera" rather than promising a direct jump.
- `app-settings:` / `App-Prefs:` URL schemes into system panes are private API territory and are **not** used.
- On return from Settings, statuses are re-read on `AppState` `active` so the panel is never stale.

---

## 3. iOS limitations (stated in the UI, not just here)

1. An app **cannot** grant, revoke, or pre-set any permission. Only the user, in Settings, can.
2. The OS prompt appears **once** per permission per install. After a denial, `request*Async` resolves immediately as denied without showing anything — so a "Try again" button that calls request again does nothing visible and must not exist. The panel offers Open Settings instead.
3. Photos supports **limited** access; the app sees only the chosen assets and must say so rather than reporting an incomplete scan as complete.
4. There is no API to query whether the user ever saw a prompt, only the current status.
5. Status can change while the app is backgrounded, so it must be re-read on foreground, never cached across launches.

---

## 4. App Store compliance

- **5.1.1** — permission requests happen at the point of use with a purpose string that matches the actual use. The Permission Center is informational and requests nothing on open.
- **Purpose strings** already in `app.json` cover camera, photo library and photo saving; they must stay accurate as Smart Cleaner layers expand what the photo permission is used for.
- **No coercion** — the app remains usable with everything denied; every dependent feature degrades to an explanatory empty state.
- **No misrepresentation** — the panel never claims the app can change a setting, and never implies a permission is required when it is optional.
- **2.5.1** — public APIs only (`Linking.openSettings`, the Expo permission getters).

---

## 5. Implementation approach

New: `src/screens/PermissionCenterScreen.js` and `src/services/permissionStatus.js`.

`permissionStatus.js` exposes one function:

```
getAllStatuses() → [{ key, label, state, usedByApp, why, features[], canRequest, canManage }]
```

**[as-built]** `status` was renamed `state` so it is never confused with Expo's
own `status` string, which it is derived from but does not equal (`limited` has
`status: "granted"`). A `why` string was added — one sentence per row explaining
what the app uses the permission for, which is what makes the panel worth opening.
Two pure helpers, `toDisplayState()` and `mergePhotoStates()`, are exported for
tests. `manageLimitedPhotos()` is also exported: it is the module's only
non-getter, and the user makes the change inside the system picker.

It calls only the **get** variants (never the request variants), so opening the panel can never trigger a prompt — a real hazard, since a prompt fired from a settings screen is a wasted one-time chance.

The screen re-reads on mount and on every `AppState` transition to `active`, renders a row per permission with `StatusBadge`, and shows one primary **Open Settings** button.

**[as-built]** It is reachable from **Settings → Account → App Permissions**. It is
**not** embedded in `PrivacyCenterScreen`, because no such screen exists yet — the
existing `PrivacyScreen` is the privacy-policy text, not a privacy centre. The
screen takes no props and holds no state of its own beyond the row list, so
Module 5 can render `<PermissionCenterScreen />` as a section without changes.
Theming is `GradientScreen` + `useThemedStyles` + theme tokens only, so it is
correct in both appearances (roadmap D5 does not apply to it).

The existing `src/utils/permissions.js` (which throws on denial) is left alone — it is a request helper for feature flows, a different job from status display.

---

## 6. Testing

**[as-built]** `__tests__/permissionStatus.test.js` (14 cases) covers the pure
logic. The rest needs a device — this repo has no
`@testing-library/react-native`, so there are no component-render tests and none
of the device rows below have been executed.

| # | Case | Status |
|---|---|---|
| 1 | granted / denied / undetermined / limited map to the right label | **Automated** — `toDisplayState` cases, incl. limited-is-not-granted |
| 2 | Opening the panel fires no OS prompt in any state | **Automated** — `getAllStatuses` is run over all four states with spies on every `request*Async`; the spies must stay at zero calls |
| 3 | Change a permission in Settings, return → row updates | **Not verified** — needs a device. The `AppState` `active` listener is in place |
| 4 | "Not asked" → in-app request → row updates | **Dropped** — the in-app request was not built; see §1 **[as-built]** |
| 5 | Limited photos → "Manage selection" → row reflects new selection | **Not verified** — needs a device. `canManage` is automated; the picker call is not |
| 6 | Everything denied: app still launches, dependent screens explain themselves | **Not verified** — needs a device. This module adds no new failure path: it only reads |
| 7 | VoiceOver reads "Camera, allowed" and "Open Settings" | **Not verified** — needs a device. Each row is one `accessible` node labelled `"{label}, {state}. {why}"`; the button is labelled by `PrimaryButton` |

Also automated: the row set and its order, microphone/location never being read,
photo-state merging in both directions, and one failed reader degrading to
`unknown` without taking the panel down.
