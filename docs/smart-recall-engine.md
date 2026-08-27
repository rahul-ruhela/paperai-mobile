# Smart Recall Engine

Status: **specification only — no code changed.**
Written: 2026-08-27. Last reviewed: 2026-08-28. Tier: **ADVANCE only.**
Depends on: Assistant module (`Description`, `DueAtUtc`) — **satisfied**; both
columns shipped in Module 3, so this module is unblocked.

Already provided by Module 1 (entitlement policy) — do **not** rebuild these:

- The feature key `smart_recall` is registered at ADVANCE in both
  `Services/FeatureMatrix.cs` and `src/config/featureMatrix.ts`, and is covered by
  the parity test and by `EntitlementPolicyTests`. It is locked at every tier
  below Advance today.
- Its upgrade sentence lives in `src/config/upgradeMessages.ts`
  ("Advance remembers the details for you."). Do not write new copy for it.
- The locked-state UI is `src/ui/FeatureLock.js` — use `useUpgradePrompt("smart_recall", navigation)`
  for a control that only needs the right sheet, or wrap the entry point in
  `<FeatureLock featureKey="smart_recall">`. Do not hand-roll an `Alert`.
- Every `/api/recall/*` route must still call `CheckAccessAsync("smart_recall")`
  server-side; the client gate is presentation only.

---

## 1. Goal

The assistant remembers the *context* attached to a task or document and surfaces it at the moment it matters.

> Task: **Doctor appointment** — "Bring blood reports and insurance card."
> The morning of the appointment: *"Reminder: Doctor appointment. Bring blood reports and insurance card."*

Recall does not invent facts. Every memory traces back to text the user wrote or a document they uploaded.

---

## 2. Memory model

A memory is a short, typed, sourced statement.

| Field | Type | Notes |
|---|---|---|
| `Id` | Guid | |
| `UserId` | Guid | scoping, indexed |
| `SourceType` | `task` \| `document` | where it came from |
| `SourceId` | Guid | task or document id; indexed with `UserId` |
| `Kind` | enum | `bring_item`, `deadline`, `contact`, `location`, `amount`, `note` |
| `Content` | `nvarchar(500)` | the statement, in the user's own words wherever possible |
| `Confidence` | `float` | 0–1; below 0.6 is stored but never spoken or pushed unprompted |
| `CreatedAt` | `datetime2` | |
| `ExpiresAtUtc` | `datetime2?` | default: source due date + 30 days |
| `DeletedAt` | `datetime2?` | soft delete for undo; purged by a job after 7 days |

Extraction from the doctor example yields one memory: `kind=bring_item`, `content="Bring blood reports and insurance card"`, `sourceType=task`.

**Not stored:** raw document text (already in `Documents`), embeddings/vectors (out of scope for v2), anything derived from a user's contacts, calendar, or location.

---

## 3. Data storage

- New table `RecallMemories`, additive migration, indexes `(UserId, SourceId)` and `(UserId, ExpiresAtUtc)`.
- Server-side only, in the same database as `Tasks` — a memory is a projection of data the user already stored there, so it inherits the same retention and deletion guarantees.
- Mobile caches nothing durable: memories arrive with the task payload and live in component state. A notification body is composed at schedule time and stored inside the local notification only.
- Deleting a task or document cascades: `DeletedAt` is set on all memories with that `SourceId`, in the same transaction.

---

## 4. AI processing

| Stage | Where | Detail |
|---|---|---|
| Trigger | server | On task create/update with a non-empty `Description` (≥ 15 chars), and on document analysis completion. |
| Extraction | `Services/RecallExtractionService.cs`, calling the existing `OpenAiService` | One structured call returning a bounded JSON array (max 5 memories), each with kind, content, confidence. Reuses the current model configuration — no new provider. |
| Cost | credits, via `CreditsService` | New key `recall_extract`. Reserve → Complete/Refund like every other AI action. Extraction is skipped silently (no charge, no error) when the user has no credits. |
| Surfacing | scheduled | When a reminder is scheduled for a task, its memories are folded into the notification body. Truncated at 140 chars for the banner; the full set shows in the task detail. |
| Idempotency | server | Re-extraction for the same `SourceId` replaces the previous set inside one transaction, so edits never duplicate memories. |

Guardrails: the prompt is instructed to copy phrasing from the source and to return an empty array when nothing is actionable; anything not traceable to the source is dropped. No chaining of one memory into another, no cross-user data, no background inference on documents the user has not analysed.

---

## 5. Privacy rules

1. **Advance tier only.** Every `/api/recall/*` route calls `CheckAccessAsync("smart_recall")`; below Advance nothing is extracted and no row is written.
2. **Opt-in.** Recall is off until the user enables it in Settings, even on Advance. First enable shows exactly what will be stored and for how long.
3. **Minimisation.** Only the description/analysis text is sent for extraction — never the whole document, never attachments.
4. **No training.** Content is used to serve the user's own reminders; it is not used to improve models and is not shared.
5. **Retention.** Default expiry = due date + 30 days; a purge job deletes expired and soft-deleted rows.
6. **Deletion is total.** Account deletion removes memories in the same pass as tasks (`AccountController`'s existing delete path must be extended when this ships).

---

## 6. User controls

| Control | Location | Behaviour |
|---|---|---|
| Enable Smart Recall | Settings → Assistant | Master switch. Off = no extraction, existing memories hidden but retained until the user chooses to delete. |
| What Paper AI remembers | Settings → Assistant → Memories | Chronological list, grouped by source, showing content, kind and source link. |
| Delete one memory | swipe on a row | Soft delete, 7-day undo window. |
| Forget this document / task | source detail screen | Deletes every memory for that source. |
| Forget everything | Settings, destructive style | `DELETE /api/recall/memories/all`, requires a typed confirmation. |
| Export | Settings | Included in the existing data-export path as plain JSON. |

Deleting a memory never deletes the underlying task or document, and this is stated in the confirm copy.

---

## 7. Security considerations

- Every route is `[Authorize]` and filters by `GetUserId()`; `SourceId` ownership is re-verified server-side before any write — never trusted from the client.
- Content is treated as untrusted text: it is rendered as plain text, never as markup, and never interpolated into another model prompt as instructions.
- Rate-limit extraction to one call per source per minute to stop an edit loop from burning credits.
- Log memory *ids* only. Never log `Content` — it may contain medical or financial detail.
- Notification bodies are the one place memory content leaves the app; the lock-screen preview is a real exposure, so a "hide details on lock screen" toggle ships with the feature and defaults to **on** for `medical`-adjacent kinds.
- No memory is ever surfaced to another user, including within a household/shared context.

---

## 8. Testing

1. Extraction yields exactly the expected memory for the doctor example; a description with no actionable content yields zero.
2. Below Advance: no extraction, no rows, 403 with `FEATURE_NOT_INCLUDED` on every route.
3. Recall disabled: no extraction even on Advance.
4. Editing a task's description replaces, not duplicates, its memories.
5. Deleting a task soft-deletes its memories in the same transaction; purge removes them after the window.
6. "Forget everything" leaves tasks and documents intact.
7. No log line contains memory content (assert over captured log output).
8. Credit refund when extraction fails mid-call.
