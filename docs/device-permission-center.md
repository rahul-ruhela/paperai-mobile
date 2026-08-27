# Device Permission Center

Status: **specification only — no code changed.**
Written: 2026-08-27. Tier: FREE, on-device, no credits.

A read-only status panel for the four permissions the app can use, plus a single button that opens iOS Settings. It displays state; it never changes it.

---

## 1. What it shows

| Permission | Status API (Expo SDK 54) | Why the app uses it | Feature lost when denied |
|---|---|---|---|
| Camera | `Camera.getCameraPermissionsAsync()` | Document and receipt scanning, QR/barcode | Camera scanner, code scanner |
| Photos | `MediaLibrary.getPermissionsAsync(false)` and `ImagePicker.getMediaLibraryPermissionsAsync()` | Pick images to OCR/sign, Junk Wiper duplicate scan | Upload from library, Smart Cleaner |
| Microphone | `Camera.getMicrophonePermissionsAsync()` | Not used today — `app.json` sets `microphonePermission: false` | none |
| Location | not requested today | Not used | none |
| Notifications | `Notifications.getPermissionsAsync()` | Reminders and analysis-complete alerts | All reminders |

Each row renders one of four states:

| State | Label | Row action |
|---|---|---|
| granted | **Allowed** | Open Settings (to revoke) |
| denied | **Denied** | Open Settings |
| undetermined | **Not asked** | Request in-app (the one case where the OS prompt can still appear) |
| limited (Photos, iOS) | **Limited access** | "Manage selection" → `MediaLibrary.presentPermissionsPickerAsync()`, plus Open Settings |

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
getAllStatuses() → [{ key, label, status, usedByApp, features[], canRequest, canManage }]
```

It calls only the **get** variants (never the request variants), so opening the panel can never trigger a prompt — a real hazard, since a prompt fired from a settings screen is a wasted one-time chance.

The screen re-reads on mount and on every `AppState` transition to `active`, renders a row per permission with `StatusBadge`, and shows one primary **Open Settings** button. It is reachable from Settings and embedded as a section in `PrivacyCenterScreen`.

The existing `src/utils/permissions.js` (which throws on denial) is left alone — it is a request helper for feature flows, a different job from status display.

---

## 6. Testing

1. Each of granted / denied / undetermined / limited renders the right label and row action.
2. Opening the panel fires no OS prompt in any state (verified with a spy on the request APIs).
3. Change a permission in Settings, return to the app → the row updates without a manual refresh.
4. "Not asked" → in-app request → row updates to the resulting state.
5. Limited photos → "Manage selection" opens the system picker and the row reflects the new selection.
6. Everything denied: app still launches, every dependent screen shows its explanatory state, nothing crashes.
7. VoiceOver reads each row as "Camera, allowed" and the button as "Open Settings".
