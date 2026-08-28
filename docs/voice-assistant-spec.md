# AI Voice Companion — Specification

Status: **implemented** (roadmap Module 7), 2026-08-29. Tier: **ADVANCE** (Plus
gets an audible preview). See §10.
Written: 2026-08-27. Last synced to the repository: 2026-08-29. Depends on: Assistant module (`Description`) — **satisfied**, so
this module is unblocked.

Already provided by Module 1 (entitlement policy) — do **not** rebuild these:

- The feature key `voice_companion` is registered at ADVANCE in both
  `Services/FeatureMatrix.cs` and `src/config/featureMatrix.ts`, covered by the
  parity test and by `EntitlementPolicyTests`.
- Its upgrade sentence lives in `src/config/upgradeMessages.ts`
  ("Hear your reminders read aloud with Advance.").
- The locked-state UI is `src/ui/FeatureLock.js` (`useUpgradePrompt` / `FeatureLock`).
- The **Plus locked preview** described below is NOT built — Module 1 registered
  the key only. Building it is this module's job, and it is the one place where
  this spec deliberately departs from the plain tier gate.
- `GET/PUT /api/voice/preferences` must call `CheckAccessAsync("voice_companion")`.

Note that `src/services/taskSpeech.js` already exists — Module 3 shipped on-device
read-aloud for a task. Extend it rather than adding a second speech service.

---

## 1. Behaviour

A task has a title and a description. At reminder time the companion speaks a sentence built from them:

> "Hey Rahul, this is a reminder about your urgent task Submit report. You mentioned that the final report needs to be sent before Friday."

Composition rules:
- Greeting uses the profile's first name; omitted when no name is set ("This is a reminder about…").
- "urgent" appears only when `Priority == HIGH`.
- The second sentence is the task description, trimmed to 200 characters at a sentence boundary; omitted when empty.
- Nothing is invented — the phrasing is assembled from stored fields, not generated per playback.

---

## 2. Architecture by tier

| Tier | Voice |
|---|---|
| FREE | No voice. Settings panel visible, disabled, with CTA. |
| ESSENTIAL | No voice. Same visible-locked panel. |
| PLUS | **Preview locked** — one sample sentence playable from Settings so the feature is audible before purchase; reminders stay silent. |
| ADVANCE | Full access: all voices, speed, tone, per-task override. |

Gating uses feature key `voice_companion` through `useFeatureAccess`; the backend authorises `/api/voice/preferences` with `CheckAccessAsync`.

> **Already shipped, and in conflict with the table above.** The Assistant module
> (`assistant-module-spec.md`) ships `src/services/taskSpeech.js` and a speaker
> button on every task card: on-device read-aloud, **ungated, on every tier**, at
> the owner's explicit request. Module 7 must resolve this before it gates
> anything — either adopt that button as the FREE baseline and gate only the
> richer companion (voice choice, speed, tone, per-task override, spoken
> reminders), or bring it under `voice_companion`.
>
> `taskSpeech.js` also does not yet follow §1's composition rules: it speaks
> title → description → due → priority → repeat, with no name greeting, no
> "urgent" wording for `Priority == HIGH`, and a 400-character description cap
> rather than 200 trimmed at a sentence boundary. Reconcile the two rather than
> adding a second speech path.

---

## 3. Apple-compliant technology choice

**Primary: on-device speech synthesis** — `expo-speech` (AVSpeechSynthesizer). Added as a dependency in the Assistant module (2026-08-28). It ships no config plugin, so **no `app.json` entry is required** — an earlier draft of this line claimed otherwise.

Why on-device first:
- No audio recording, so no `NSMicrophoneUsageDescription` and no privacy-manifest exposure for microphone access.
- No task text leaves the device to be spoken — the strongest privacy position and the simplest App Review story.
- Voices are the system voices the user already has, including any accessibility voices they have installed, and it works offline.

**Fallback chain**
1. `expo-speech` unavailable or the chosen voice missing → the system default voice.
2. Speech fails or is muted by the hardware switch → the notification still fires with its normal text. A silent notification is never acceptable as a "voice failed" state.
3. Notifications denied → no voice, and Settings shows the permission state with a link (see `device-permission-center.md`).

**Explicitly not in v1:** cloud TTS (a server round-trip per reminder, audio storage, and a much harder review conversation), background audio mode, and any always-listening capability. `UIBackgroundModes` stays as it is — `remote-notification` only.

---

## 4. Notification flow

iOS will not run arbitrary code when a notification is delivered while the app is backgrounded, so speech happens at one of two moments:

1. **App in foreground at fire time** — the module-scope handler in `App.js` already intercepts; it calls `voiceService.speak(task)` after showing the banner.
2. **User taps the notification** — the response listener opens the Assistant and speaks immediately.

For case 2 the spoken text is composed at *schedule* time and stored in the notification's `data` payload (`{ type: "task", taskId, spoken }`), so playback needs no network call and works offline.

A "critical"/time-sensitive interruption level is **not** requested; that entitlement requires Apple approval and is not justified by this use case.

---

## 5. Frontend

```
src/services/voiceService.js       speak(task, prefs), stop(), listVoices(), composeSentence(task, profile)
src/ui/VoiceSettingsSection.js     enable toggle, voice picker, speed, tone, "Play sample"
AssistantScreen → TaskEditorSheet  per-task "Speak this reminder" switch
SettingsScreen                     hosts VoiceSettingsSection
```

Controls:

| Setting | Values | Default |
|---|---|---|
| Enabled | on/off | off |
| Voice | system voices, grouped by language, labelled with the OS-provided name/gender where available | system default |
| Speed | 0.75× / 1× / 1.25× | 1× |
| Tone | Friendly / Neutral / Direct — changes wording only ("Hey Rahul," vs "Reminder:" vs "Submit report — due Friday.") | Friendly |
| Speak on tap | on/off | on |

Voice gender is offered as whatever the platform exposes; the app does not synthesise a gendered voice of its own or label voices beyond the OS metadata.

---

## 6. Backend

| Method | Route | Notes |
|---|---|---|
| GET | `/api/voice/preferences` | Returns prefs, defaulted for a first-time user. |
| PUT | `/api/voice/preferences` | Upserts. `CheckAccessAsync("voice_companion")` — below Advance returns 403 `FEATURE_NOT_INCLUDED`. |

No audio ever reaches the server. No new credit key: synthesis is on-device and free to run, so charging for it would be charging for nothing.

---

## 7. Database

Add to the existing `UserNotificationPreferences` rather than creating a table — it is already per-user, already fetched with settings, and avoids a second join:

| Column | Type | Null | Default |
|---|---|---|---|
| `VoiceEnabled` | `bit` | yes | null → false |
| `VoiceId` | `nvarchar(100)` | yes | null → system default |
| `VoiceRate` | `float` | yes | null → 1.0 |
| `VoiceTone` | `nvarchar(20)` | yes | null → `FRIENDLY` |
| `VoiceSpeakOnTap` | `bit` | yes | null → true |

Plus one column on `Tasks`: `VoiceEnabled bit null` for the per-task override (null = follow the global setting).

---

## 8. Fallback behaviour summary

| Condition | Result |
|---|---|
| Tier below Advance | Silent; notification text unchanged; Settings shows the CTA. |
| Plus tier, sample tapped | Sample plays once; reminders stay silent. |
| Voice disabled | Silent; everything else unchanged. |
| Chosen voice uninstalled | System default, with a one-time Settings notice. |
| Device muted / silent switch | Nothing is spoken (the OS decides); the notification is unaffected. |
| Speech throws | Caught, logged, no user-facing error. |
| App terminated at fire time | Speaks on tap, using the payload composed at schedule time. |

---

## 9. Testing

1. Sentence composition: with/without name, HIGH vs LOW priority, empty description, a 900-character description (truncated at a sentence boundary), and text containing emoji or a URL.
2. Playback at each speed and tone.
3. Plus tier: sample plays, reminder is silent. Free/Essential: control disabled, upgrade sheet on tap.
4. Foreground fire speaks once — never twice when the user also taps the banner.
5. Airplane mode: full playback (proves nothing depends on the network).
6. Voice id set to a removed voice → falls back silently.
7. Notifications denied → no crash; Settings reflects the state.
8. Per-task override beats the global setting in both directions.
9. `npm test`, `npx tsc --noEmit`, `dotnet build` clean.

---

## 10. Implementation record

Written during implementation, 2026-08-29.

### 10.1 The conflict in §2, resolved

§2 asked this module to settle a contradiction it inherited: the tier table says
FREE and ESSENTIAL get "no voice", but Module 3 had already shipped a speaker
button on every task card — ungated, on every tier, at the owner's explicit
request.

**Resolved in favour of what shipped.** The speaker button stays Free.

Taking a working feature away from users who already have it, so it can be sold
back to them, is a worse thing to do than leaving one tier boundary softer than a
table predicted. Pressing a button to hear the task in front of you is also not
the companion: `voice_companion` (ADVANCE) now gates what is genuinely new —
reminders that speak themselves, choosing a voice, speed and tone, and the
per-task override. The Settings panel says this in as many words, because a user
seeing a locked "Voice Companion" panel would otherwise reasonably conclude the
button they already use is being taken away.

`taskSpeech.js` was **not** rewritten to §1's rules either. It answers a different
question — "read me this task", including its due date, repeat and status — and
the companion's reminder phrasing lives in `voiceService.js` beside it.
`voiceService` delegates the synthesiser lifecycle to `taskSpeech` rather than
touching `Speech` twice, so the card button and a spoken reminder cannot talk
over each other.

### 10.2 What shipped

**Backend** — five nullable columns on `UserNotificationPreferences`, one on
`Tasks`, `Controllers/VoiceController.cs`, migration
`20260828192637_AddVoicePreferences`. No credit key: synthesis is on-device with
the system's own voices, and charging for that would be charging for nothing.

**Mobile** — `src/services/voiceService.js` (composition + playback),
`src/services/voicePlayback.js` (the notification bridge), `src/api/voice.js`,
`src/ui/VoiceSettingsSection.js`, the three-way override in `TaskEditorSheet`,
and the two speech hooks in `App.js`.

32 mobile tests and 7 backend tests.

### 10.3 Details worth knowing

**Nothing is generated.** Every word the companion says is a fixed template or a
stored field. There is no model anywhere in this path, so it cannot invent a
detail about someone's day — which is what makes it safe to speak aloud.

**The sentence is composed at schedule time** and carried in the notification
payload, because iOS will not run app code when a notification is delivered in
the background. Playback needs no network, works offline, and works when the app
was terminated between scheduling and firing.

**Spoken once.** A foreground fire speaks, and tapping that same banner does not
repeat it — `voicePlayback` checks the synthesiser is not already mid-sentence on
the same payload.

**URLs and emoji are stripped** before speaking. A URL read character by
character is thirty seconds of noise, and an emoji is either announced by name or
produces a dead pause.

**Proper nouns keep their capital.** "You mentioned that the final report…" reads
better lowered; "priya has the keys" mangles someone's name. Only an allowlist of
function words is lowered — caught by a test, after the first implementation got
it wrong.

**Preferences are asymmetric, like Smart Recall's.** `GET` is open and `PUT` is
open for turning voice *off*; only enabling it requires Advance. A lapsed
subscriber must always be able to silence the app.

### 10.4 App Review

No microphone, anywhere. Nothing is recorded, no `NSMicrophoneUsageDescription`
is needed, and no privacy-manifest entry changes. `UIBackgroundModes` is
untouched — still `remote-notification` only. No critical/time-sensitive
interruption level is requested; that entitlement needs Apple's approval and this
use case does not justify asking. No audio reaches the server, and nothing about
this module adds a privacy-label entry.

Voices are labelled with whatever the OS reports. The app does not invent a
gender, a persona or a name for a system voice.

### 10.5 Not built

`expo-speech` ships no config plugin, so — as §3 already corrected — there is no
`app.json` entry, and no new native dependency. Nothing in this module is
outstanding.
