# Assistant Module Specification

Status: **specification only — no code changed.**
Written: 2026-08-27. Depends on: roadmap Module 0 (task API completion).

---

## 1. Goal

Rename the **Tasks** tab to **Assistant** and split its content into two tabs:

- **AI Tasks** — tasks generated from documents (`IsAiSuggested = true`).
- **My Tasks** — tasks the user typed themselves (`IsAiSuggested = false`).

One task system. `/api/tasks` and `Models/TaskItem.cs` are reused; no second task store, no local-only task table.

---

## 2. What exists today

| Piece | Location | State |
|---|---|---|
| Tab | `App.js` → `Tabs()`, `<Tab.Screen name="Tasks" …>` | Label and route name are both `Tasks`. |
| Screen | `src/screens/TasksScreen.js` (331 lines) | One flat `FlatList` of tasks, an inline "add task" input, a streak counter, and the reminders list (upcoming/past + snooze) merged into the same screen. |
| Client | `src/api/tasks.js` | `listTasks`, `createTask(title, documentId)`, `updateTask(id, patch)`, `deleteTask(id)`. |
| Server | `Controllers/TasksController.cs` | `GET`, `POST`, `PATCH`. **No `DELETE`** — `deleteTask` currently 405s. |
| Model | `Models/TaskItem.cs` | Has `IsAiSuggested`, `Priority`, `AiReason`, `SourceDocumentId` already — the AI/manual split needs no new column. |
| Reminders | `src/services/reminderService.js` | Local notifications, lead options, snooze options, `reminders.json` on disk. Reused as-is for task due alerts. |

Gaps against the requirement: no description, no due date/time, no repeat, no completion timestamp, no delete route, and `PATCH` ignores everything except title and status.

---

## 3. Database changes

Additive, nullable, one migration, revertible. Table `Tasks`.

| Column | Type | Null | Default | Purpose |
|---|---|---|---|---|
| `Description` | `nvarchar(2000)` | yes | null | Task detail. Also the payload Smart Recall and the Voice Companion read. |
| `DueAtUtc` | `datetime2` | yes | null | Date **and** time, stored UTC. |
| `DueTimeSet` | `bit` | yes | null | `false`/null = date-only (alert at 09:00 local, matching `reminderService`'s `FIRE_HOUR`); `true` = user picked a time. |
| `Repeat` | `nvarchar(20)` | yes | null | `NONE`, `DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`. |
| `CompletedAt` | `datetime2` | yes | null | Set when `Status` → `DONE`, cleared on un-complete. |
| `SnoozedUntilUtc` | `datetime2` | yes | null | Server mirror of a snooze so it survives reinstall. |
| `UpdatedAt` | `datetime2` | yes | null | Ordering and future sync. |

No index changes required at current row counts; if `Tasks` grows past ~100k rows, add `(UserId, Status, DueAtUtc)`.

**Explicitly not doing:** no `Tasks2` table, no repurposing of `DocumentId`, no non-null columns, no data backfill.

---

## 4. API changes

All additive; existing shapes keep every field they return today.

| Method | Route | Body / params | Notes |
|---|---|---|---|
| GET | `/api/tasks` | `?source=ai\|manual` (optional), `?status=open\|done` (optional) | No params = current behaviour, unchanged. `source=ai` filters `IsAiSuggested == true`. |
| POST | `/api/tasks` | `{ title, description?, documentId?, priority?, dueAtUtc?, dueTimeSet?, repeat? }` | Manual creation only; `IsAiSuggested` stays `false`. Server ignores any client-sent `isAiSuggested`. |
| PATCH | `/api/tasks/{id}` | any subset of `{ title, description, status, priority, dueAtUtc, dueTimeSet, repeat }` | `UpdateTaskRequest` extended. Null means "not supplied" — the existing `!string.IsNullOrWhiteSpace` guards stay so a partial patch never wipes a field. |
| DELETE | `/api/tasks/{id}` | — | **New.** Hard delete, scoped to `UserId`. Returns 204; 404 when not owned. |
| POST | `/api/tasks/{id}/complete` | `{ completed: bool }` | Sets `Status` + `CompletedAt` atomically. For a repeating task, completing it creates the next occurrence instead of closing the row. |
| POST | `/api/tasks/{id}/snooze` | `{ untilUtc }` | Sets `SnoozedUntilUtc`; the local notification is rescheduled client-side. |

Every route: `[Authorize]`, `GetUserId()` scoping, and the Assistant base is **FREE** — see §7 for what is gated.

---

## 5. Mobile screens and components

```
AssistantScreen                       (replaces TasksScreen as the tab target)
├── AssistantHeader                   title + streak + credit chip
├── SegmentedTabs                     [ AI Tasks | My Tasks ]
├── AiTasksTab
│   ├── TaskCard (source badge, "Why this task?" from AiReason)
│   └── EmptyState → "Analyse a document to get suggestions"
├── MyTasksTab
│   ├── QuickAddBar                   (title only — keeps today's one-line flow)
│   ├── TaskCard
│   └── EmptyState
├── TaskEditorSheet                   full editor: title, description, priority,
│                                     due date (CalendarPicker), due time, repeat
├── TaskActionsSheet                  complete / edit / snooze / delete
└── RemindersSection                  existing reminders list, moved below the tabs
```

Reused as-is: `src/ui/CalendarPicker.js`, `ReminderCard.js`, `ConfirmActionSheet.js`, `GlassModal.js`, `StatusBadge.js`, `useFeatureAccess`, `reminderService`.

New files: `src/screens/AssistantScreen.js`, `src/ui/TaskCard.js`, `src/ui/TaskEditorSheet.js`, `src/ui/SegmentedTabs.js`. `TasksScreen.js` is deleted only after `AssistantScreen` reaches parity; until then it stays as the fallback target.

### Navigation change

In `App.js`, the tab keeps the **route name `Tasks`** and gains `options={{ title: "Assistant" }}` plus the `sparkles`/`sparkles-outline` icons. Renaming the route itself would break `navigation.navigate("Tasks")` call sites and any parked deep link, so it is deliberately deferred to a follow-up commit that updates all call sites at once.

---

## 6. Behaviour details

- **Repeat.** Completing a repeating task writes `CompletedAt`, then inserts a new row with `DueAtUtc` advanced by one interval and the same title/description/priority. Chains stay finite because each occurrence is created only on completion.
- **Snooze.** Advance-only (`advanced_reminders`), reusing `SNOOZE_OPTIONS` from `reminderService.js`. Lower tiers see the control and get the upgrade sheet — the existing `TasksScreen` alert copy ("Advance Plan Feature") is reused.
- **Notifications.** A task with `DueAtUtc` schedules a local notification through `reminderService.scheduleReminder`, with `data: { type: "task", taskId }`. `App.js`'s `docIdFromResponse` must learn this shape to deep-link to the Assistant tab — today it only recognises `reminder` and `ANALYSIS_COMPLETE`.
- **AI task creation** stays server-side, unchanged: the analysis pipeline writes rows with `IsAiSuggested = true` and `SourceDocumentId` set.
- **Offline.** Reads fall back to the last list held in state; writes surface `err.userMessage` from the axios interceptor. No offline queue in this module.

---

## 7. Entitlement mapping

| Capability | Feature key | Tier |
|---|---|---|
| Assistant tab, both sub-tabs, manual CRUD | *(none — always on)* | FREE |
| AI Tasks content | `document_ai_analysis` | ESSENTIAL (generation is what costs; viewing existing ones is free) |
| Due-date alerts | `smart_reminders` | ESSENTIAL |
| Custom dates, repeat, snooze | `advanced_reminders` | ADVANCE |

Locked controls stay visible with a CTA, per `subscription-entitlement-policy.md`.

---

## 8. Testing cases

**Backend**
1. `PATCH` with only `description` leaves title, status, priority untouched.
2. `PATCH` with an empty-string title is rejected (existing guard).
3. `DELETE` on another user's task → 404, row untouched.
4. `GET ?source=ai` returns only `IsAiSuggested == true`; no param returns everything (regression guard on the existing contract).
5. `complete` on a `Repeat=WEEKLY` task creates exactly one successor, seven days out.
6. Migration applies and reverts cleanly on a copy of the production schema.

**Mobile**
7. Both tabs render; switching preserves scroll position per tab.
8. A task created in My Tasks never appears in AI Tasks.
9. Editor round-trip: set every field, reopen, all values present.
10. Free user taps snooze → upgrade sheet, no network call.
11. Notification tap with `{type:"task"}` opens the Assistant tab, not a document.
12. Delete asks for confirmation and removes the row from the list optimistically, restoring it if the request fails.
13. `npx tsc --noEmit` and `npm test` clean; `dotnet build PaperAi.csproj` clean.
