# 1.2 — Smart Reminders

**Status:** TODO
**Branch:** `feat/smart-reminders`
**Tier gate:** `essential` (already declared as `smart_reminders`)
**Credits:** free — no charge. It is a retention feature, not a revenue feature.
**Conflicts with:** none

## Why

Bills, contracts and warranties all carry dates. Auto-detecting them and firing a
local notification is the cheapest possible retention mechanic: it brings the user
back into the app without you paying for a push campaign. `expo-notifications` is
already installed and `src/notifications/pushNotifications.js` already exists.

## User story

User analyses an electricity bill → the app detects "Due 15 Sep 2026" → a card
appears: *"Payment due in 12 days — remind me?"* → one tap schedules a local
notification 3 days before, and adds a task.

## Scope

**In:** date extraction from the existing AI result, a reminder card on the analysis
screen, local notification scheduling, a Reminders list in the Tasks tab, cancel/edit.
**Out:** recurring reminders, calendar sync, server-side push (all v2).

## Files to touch

| File | Change |
|---|---|
| `src/services/reminderService.js` | **new** — schedule/cancel/list, persists via `expo-secure-store` or a small JSON file |
| `src/screens/AnalysisScreen.js` | render the detected-date reminder card |
| `src/screens/TasksScreen.js` | add a "Reminders" section above tasks |
| `src/notifications/pushNotifications.js` | ensure local-notification permission is requested and a handler is set |
| `src/config/featureMatrix.ts` | `smart_reminders` already present — no change needed |

## Backend needed

**Preferred:** the analysis response gains a `detectedDates` array:
```
{ label: "Payment due", dateUtc: "2026-09-15T00:00:00Z", confidence: "HIGH" }
```
Ask for this — it is far more accurate than client-side parsing.

**Fallback if the backend can't ship it soon:** parse client-side from
`doc.summary` / analysis text with a regex set covering `DD/MM/YYYY`, `MM-DD-YYYY`,
`15 Sep 2026`, `Sep 15, 2026`, and keyword proximity ("due", "expires", "valid
until", "renewal", "payment by"). Keep it in `reminderService.js` behind one
function so it can be swapped for the backend field later without touching the UI.

## Implementation notes

- Scheduling:
  ```js
  import * as Notifications from "expo-notifications";
  await Notifications.scheduleNotificationAsync({
    content: { title: "Payment due in 3 days", body: doc.title, data: { docId } },
    trigger: { date: fireDate },
  });
  ```
  Store the returned identifier so it can be cancelled.
- Default lead time: **3 days before**, with quick options 1 day / 3 days / 1 week
  / on the day. Fire at 09:00 local, never at the raw timestamp (nobody wants a
  midnight notification).
- Skip dates already in the past — surface them as "expired" instead.
- Tapping the notification deep-links to the document: handle
  `data.docId` in the notification response listener and
  `navigation.navigate("Analysis", { docId })`.
- Ask for notification permission **at the moment the user taps "Remind me"**, never
  on app launch — launch-time prompts get denied and you lose the channel forever.
- If permission is denied, show a card explaining how to enable it in Settings.

## Definition of done

- [ ] A document with a detectable date shows a reminder card with the right date
- [ ] Scheduling fires a real local notification at the right time
- [ ] Reminders list shows upcoming + expired, with cancel
- [ ] Cancelling removes the OS-level scheduled notification too
- [ ] Tapping a notification opens the correct document
- [ ] Denied permission is handled gracefully with a path to Settings
- [ ] No charge is made anywhere in this flow
- [ ] Verify commands from CONTEXT §9 pass

## Notes for other agents

_(append findings here)_
