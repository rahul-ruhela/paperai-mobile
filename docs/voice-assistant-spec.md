# AI Voice Companion — Specification

Status: **specification only — no code changed.**
Written: 2026-08-27. Tier: **ADVANCE** (Plus gets a locked preview). Depends on: Assistant module (`Description`), optionally Smart Recall.

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

---

## 3. Apple-compliant technology choice

**Primary: on-device speech synthesis** — `expo-speech` (AVSpeechSynthesizer). Not currently a dependency; it must be added with an `app.json` entry.

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
