# Assistant Module Specification

Status: **implemented and verified.**
Written: 2026-08-27. Implemented: 2026-08-28 on `chore/release-hardening`.
Covers roadmap Module 0 (matrix repair + tasks API) and Module 3 (Assistant).

Where the built module deviates from the original specification, the deviation
is recorded in place and marked **[as-built]** — this file describes what ships,
not what was once planned.

---

## 1. Goal

Rename the **Tasks** tab to **Assistant** and split its content into tabs:

- **My Tasks** — tasks the user typed themselves (`IsAiSuggested = false`).
- **AI Tasks** — tasks generated from documents (`IsAiSuggested = true`).
- **Reminders** — document reminders. **[as-built]** Originally these were to sit
  in a section below the tabs; as a list header they rendered above *both* task
  tabs, which read as a duplicated block belonging to neither. They own a tab.

One task system. `/api/tasks` and `Models/TaskItem.cs` are reused; no second task
store, no local-only task table.

---

## 2. What shipped

| Piece | Location | State |
|---|---|---|
| Tab | `App.js` → `Tabs()` | Route name stays `Tasks`; `options={{ title: "Assistant" }}`, `sparkles` icons. |
| Screen | `src/screens/AssistantScreen.js` | Three tabs over one fetched list. `TasksScreen.js` deleted. |
| Client | `src/api/tasks.js` | `listTasks({source,status})`, `createTask`, `updateTask`, `completeTask`, `snoozeTask`, `deleteTask`. |
| Server | `Controllers/TasksController.cs` | `GET` (+filters), `POST`, `PATCH`, `DELETE`, `/complete`, `/snooze`. |
| Model | `Models/TaskItem.cs` | Seven additive nullable columns. |
| Migration | `20260828090000_AddAssistantTaskFields` | **Applied** to `PaperAiDb`. |
| Reminders | `src/services/reminderService.js` | Reused; gained `scheduleTaskAlert` / `cancelTaskAlert` / `taskAlertMap`. |
| Voice | `src/services/taskSpeech.js` | On-device read-aloud. **[as-built]** — see §7. |

New UI files: `src/ui/TaskCard.js`, `src/ui/TaskEditorSheet.js`, `src/ui/SegmentedTabs.js`.

Reused as-is: `CalendarPicker.js`, `ReminderCard.js`, `ConfirmActionSheet.js`,
`GlassModal.js`, `StatusBadge.js`, `useFeatureAccess`, `AiHeader`.

**[as-built]** `AssistantHeader` and `QuickAddBar` were not created as separate
components — the existing `AiHeader` and an inline composer card cover them.
`TaskActionsSheet` is a native `Alert` action sheet rather than a component;
complete / edit / snooze / delete all reach it.

---

## 3. Database changes — applied

Additive, nullable, one migration, revertible. Table `Tasks`.

| Column | Type | Null | Purpose |
|---|---|---|---|
| `Description` | `nvarchar(max)` | yes | Task detail. Also the Recall/Voice payload. |
| `DueAtUtc` | `datetime2` | yes | Date **and** time, stored UTC. |
| `DueTimeSet` | `bit` | yes | `false`/null = date-only (alert at 09:00 local, matching `reminderService`'s `FIRE_HOUR`); `true` = user picked a time. |
| `Repeat` | `nvarchar(max)` | yes | `NONE`, `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`. |
| `CompletedAt` | `datetime2` | yes | Set when `Status` → `DONE`, cleared on un-complete. |
| `SnoozedUntilUtc` | `datetime2` | yes | Server mirror of a snooze so it survives reinstall. |
| `UpdatedAt` | `datetime2` | yes | Ordering and future sync. |

**[as-built]** `Description` and `Repeat` are `nvarchar(max)`, not length-capped,
so the EF model matches the rest of the table (`Title`, `Status`, `Priority` are
all uncapped). Length limits are enforced in `TasksController` instead —
description is rejected above 2000 characters.

Each `ALTER` is wrapped in `IF NOT EXISTS`, and `Down` drops in reverse with the
same guards, because this database has been altered by hand before.

No index changes at current row counts; past ~100k rows, add `(UserId, Status, DueAtUtc)`.

**Explicitly not done:** no `Tasks2` table, no repurposing of `DocumentId`, no
non-null columns, no data backfill.

---

## 4. API — implemented

All additive; existing shapes keep every field they returned before.

| Method | Route | Body / params | Notes |
|---|---|---|---|
| GET | `/api/tasks` | `?source=ai\|manual`, `?status=open\|done` | No params = previous behaviour, unchanged. Rows predating `IsAiSuggested` (null) count as manual. |
| POST | `/api/tasks` | `{ title, description?, documentId?, priority?, dueAtUtc?, dueTimeSet?, repeat? }` | Manual only; server forces `IsAiSuggested = false` and ignores any client-sent flag. |
| PATCH | `/api/tasks/{id}` | subset of `{ title, description, status, priority, dueAtUtc, dueTimeSet, clearDueAt, repeat }` | Null means "not supplied". |
| DELETE | `/api/tasks/{id}` | — | Hard delete scoped to `UserId`. 204; 404 when not owned. Previously 405. |
| POST | `/api/tasks/{id}/complete` | `{ completed: bool }` | Sets `Status` + `CompletedAt`. A repeating task gets a successor, returned as `next`. |
| POST | `/api/tasks/{id}/snooze` | `{ untilUtc }` | Sets `SnoozedUntilUtc`; null clears. Past times rejected. |

**[as-built]** Clearing a due date is explicit: `{ clearDueAt: true }`. A JSON
null cannot mean both "leave it" and "remove it", and leaving it is what an older
client sending only `{title}` intends.

Every route: `[Authorize]`, `GetUserId()` scoping. The Assistant base is FREE — see §7.

---

## 5. Mobile structure as built

```
AssistantScreen                       (tab target; TasksScreen.js deleted)
├── AiHeader                          title + streak ("N done today")
├── QuickAdd card                     one-line add + "Add with details"
│                                     (hidden on the Reminders tab)
├── SegmentedTabs                     [ My Tasks | AI Tasks | Reminders ]
├── My Tasks / AI Tasks → TaskCard    source badge, "Why this task?" from AiReason,
│                                     speaker button, tap-to-edit, per-tab empty state
├── Reminders           → document reminders, upcoming / past, snooze + cancel
├── TaskEditorSheet                   title, description, priority, due date
│                                     (CalendarPicker), due time preset, repeat
└── Alert action sheet                complete / edit / snooze / delete
```

One `FlatList` serves all three tabs; the reminders tab renders through
`ListHeaderComponent` with an empty `data`.

### Navigation

The tab keeps the **route name `Tasks`** and gains `options={{ title: "Assistant" }}`
plus `sparkles`/`sparkles-outline`. Renaming the route would break every
`navigation.navigate("Tasks")` call site and any parked deep link, so it stays
deferred to a follow-up that updates all call sites at once.

---

## 6. Behaviour details

- **Repeat.** Completing a repeating task writes `CompletedAt`, then inserts a
  successor with `DueAtUtc` advanced by one interval. Chains stay finite because
  each occurrence is created only on completion, and an overdue task rolls
  forward past now (bounded at 1000 iterations).
  **The client must schedule the successor's alert** from the `next` it gets
  back — the notification is local, so nothing else will. Missing this made a
  WEEKLY task alert once and then go silent for ever while still *looking*
  correct in the list. Regression-tested in `__tests__/taskRepeatAlert.test.js`.
- **Snooze.** Advance-only (`advanced_reminders`), reusing `SNOOZE_OPTIONS`.
  Lower tiers see the control and get the upgrade sheet. The due date is left
  alone — only the alert moves — and it is mirrored server-side.
- **Notifications.** A task with `DueAtUtc` schedules a local notification via
  `reminderService.scheduleTaskAlert`, with `data: { type: "task", taskId }`.
  `App.js`'s `targetFromResponse` (renamed from `docIdFromResponse`) understands
  this shape and deep-links to the Assistant tab.
- **Scroll position.** Offsets are kept per tab in a ref and restored one frame
  after a switch — at switch time the list still holds the outgoing tab's
  content height, so an immediate `scrollToOffset` is clamped against the wrong
  extent. A guard flag stops the mid-swap clamped offset from overwriting the
  value being restored.
- **Tap targets.** The card body opens the editor; the checkbox completes; the
  speaker reads aloud; "…" opens the action sheet.
- **AI task creation** stays server-side and unchanged. AI rows set only title,
  priority, reason and `SourceDocumentId` — **never a due date**, so AI tasks
  carry no alert unless the user edits one in.
- **Offline.** Reads fall back to the last list in state; writes surface
  `err.userMessage` from the axios interceptor. No offline queue in this module.

---

## 7. Entitlement mapping

| Capability | Feature key | Tier |
|---|---|---|
| Assistant tab, all three sub-tabs, manual CRUD | *(none — always on)* | FREE |
| AI Tasks content | `document_ai_analysis` | ESSENTIAL |
| Due-date alerts | `smart_reminders` | ESSENTIAL |
| Custom dates, repeat, snooze | `advanced_reminders` | ADVANCE |
| Read a task aloud | *(none — always on)* | FREE **[as-built]** |

Locked controls stay visible with a CTA, per `subscription-entitlement-policy.md`.

### Decisions recorded — do not "fix" these without asking

**`smart_reminders` is not referenced in the Assistant.** Only
`advanced_reminders` is checked, and the editor's date picker is Advance-locked,
so an ESSENTIAL subscriber cannot set a due date and the `smart_reminders` row
above is currently unreachable. This was raised and **the owner confirmed the
current `advanced_reminders` behaviour is correct and should stay.** Leave it.

**Read-aloud ships ungated, on every card, on every tier.** This was an explicit
owner request. It **conflicts with `voice-assistant-spec.md` §2**, which gates
voice behind `voice_companion` (FREE/ESSENTIAL none, PLUS preview, ADVANCE full).
Module 7 must decide whether to adopt `taskSpeech.js` as a free baseline and gate
only the richer companion, or to bring this button under the gate.

`taskSpeech.js` also does **not** follow the voice spec's composition rules — it
speaks title → description → due → priority → repeat, with no name greeting, no
"urgent" wording, and a 400-character description cap rather than 200 trimmed at
a sentence boundary. Module 7 should reconcile the two.

Note: `expo-speech` ships no config plugin, so — contrary to
`voice-assistant-spec.md` §3 — **no `app.json` entry is required.**

---

## 8. Testing — all passing

**Backend** (`dotnet test`, 79 passing incl. `TasksAssistantApiTests.cs`)
1. `PATCH` with only `description` leaves title, status, priority untouched. ✅
2. `PATCH` with an empty-string title is rejected. ✅
3. `DELETE` on another user's task → 404, row untouched. ✅
4. `GET ?source=ai` returns only `IsAiSuggested == true`; no param returns everything. ✅
5. `complete` on a `Repeat=WEEKLY` task creates exactly one successor, seven days out. ✅
6. Migration applies and reverts cleanly. ✅

**Mobile** (`npx jest`, 83 passing)
7. Three tabs render; switching preserves scroll position per tab. ✅
8. A task created in My Tasks never appears in AI Tasks. ✅
9. Editor round-trip: set every field, reopen, all values present. ✅
10. Free user taps snooze → upgrade sheet, no network call. ✅
11. Notification tap with `{type:"task"}` opens the Assistant tab. ✅
12. Delete confirms, removes optimistically, restores on failure. ✅
13. `npx tsc --noEmit`, `npm test`, `dotnet build` all clean. ✅
14. Repeating task schedules its successor's alert. ✅ `taskRepeatAlert.test.js`
15. Spoken sentence composition. ✅ `taskSpeech.test.js`

**Not unit-tested:** the per-tab scroll restore. Its risk is in `requestAnimationFrame`
timing and `FlatList` wiring, and the repo has no `@testing-library/react-native`,
so only a device check covers it today. Adding that library would close this gap
and unlock coverage for the rest of the screen.

---

## 9. Local development

The app defaults to the **production** API (`src/constants/api.ts`). Production
does not yet have this module deployed — `POST /api/tasks` there silently drops
`description`, `dueAtUtc`, `priority` and `repeat`, and `/complete` and `/snooze`
return 404. That presents on device as "only the title is saved" and "tapping a
task does nothing", with no error.

To work against a local backend, create `.env.local` (gitignored):

```
EXPO_PUBLIC_APP_ENV=local
EXPO_PUBLIC_API_BASE_URL=http://<your-LAN-IP>:5263
```

Metro caches env vars — start with `npx expo start -c` or the old value persists.
Backend: `ASPNETCORE_ENVIRONMENT=Development dotnet run --project PaperAi.csproj --urls "http://0.0.0.0:5263"`.

**This module is not deployed to production.** Shipping it requires deploying the
backend; the migration is already applied to the shared database, and because
every column is additive and nullable, the current production build keeps working
against the migrated schema in the meantime.
