# 2.5 — Monthly Auto-Scan Reminder

**Status:** TODO · **Branch:** `feat/auto-scan` · **Requires 2.0 merged**
**Tier:** `free` · **Credits:** free (the reminder is free; running a paid cleaner still costs)
**Conflicts with:** 1.2 (both touch notification setup)

## Why

Cleanup is not a habit people remember to have. A monthly nudge — *"You've added
2.1 GB of photos since your last clean"* — is a recurring re-engagement loop that
costs you nothing and pulls users back into the paid cleaners.

## Scope

An opt-in monthly (or weekly/quarterly) local notification that deep-links into
Storage Studio, with a "since last clean" delta.

## Files to touch

| File | Change |
|---|---|
| `src/services/autoScanScheduler.js` | **new** |
| `src/screens/StorageStudioScreen.js` | the "Auto-scan" tile + settings sheet |
| `src/screens/SettingsScreen.js` | a toggle in the settings list |
| `src/notifications/pushNotifications.js` | deep-link handling for `type: "autoscan"` |

## Backend needed
None — local notifications only.

## Implementation notes

- Frequency options: **Weekly · Monthly (default) · Quarterly · Off**. Default is
  **Off** — never opt a user into notifications without asking.
- Schedule with `Notifications.scheduleNotificationAsync` using a repeating trigger.
  Fire at **11:00 local on a Saturday** — weekend mornings are when people actually
  do phone housekeeping.
- Notification copy must contain a real number or it is noise:
  *"2.1 GB of new photos since your last clean"*. Compute the delta from
  `storageHistory.js` (2.0) plus a cheap current asset-count/size check.
- If the delta is trivial (< 200 MB), **skip that month's notification entirely.**
  A nudge with nothing behind it trains people to disable notifications.
- Tapping it opens `StorageStudio` with the recommended tool highlighted.
- **Coordinate with 1.2** — both specs request notification permission. Whichever
  merges second must reuse the existing permission helper rather than adding a
  parallel one. Check `pushNotifications.js` before writing new permission code.

## Definition of done

- [ ] Frequency picker works; default is Off
- [ ] Permission requested only when the user turns it on
- [ ] Notification fires on schedule with a real, accurate number
- [ ] Trivial deltas are skipped
- [ ] Tapping deep-links into Storage Studio
- [ ] Turning it off cancels the OS-scheduled notification
- [ ] No duplicate permission-request code paths with 1.2
- [ ] Verify commands from CONTEXT §9 pass

## Notes for other agents
_(append findings here)_
