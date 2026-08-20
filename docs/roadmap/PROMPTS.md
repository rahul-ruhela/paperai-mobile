# Copy-paste prompts

Open a **new chat** for each one. Copy the block, paste, done.
The whole point is that each chat reads only 2 files — do not paste extra context.

---

## Tier 1 — remaining

### 1.1 AI Chat
```
Read docs/roadmap/CONTEXT.md, then docs/roadmap/tier-1/01-ai-chat.md.
Implement that spec only. Do not read other spec files.
The backend endpoints do not exist yet — build against the stub flag described in the spec.
When done, run the verify commands in CONTEXT §9 and set the spec's Status line to DONE.
```

### 1.2 Smart Reminders
```
Read docs/roadmap/CONTEXT.md, then docs/roadmap/tier-1/02-smart-reminders.md.
Implement that spec only. Do not read other spec files.
Use the client-side date-parsing fallback described in the spec.
When done, run the verify commands in CONTEXT §9 and set the spec's Status line to DONE.
```

### 1.4 Receipt → Expense
```
Read docs/roadmap/CONTEXT.md, then docs/roadmap/tier-1/04-receipt-expense.md.
Implement that spec only. Do not read other spec files.
NOTE: 1.1 also edits UploadScreen.js — check the status board in docs/roadmap/README.md
and do not run these two at the same time.
When done, run the verify commands in CONTEXT §9 and set the spec's Status line to DONE.
```

---

## Tier 2 — Storage Studio

**2.0 must finish and merge before 2.1–2.5.** They all import the shared scanner
and review list it creates.

### Step 1 — the shell (run alone)
```
Read docs/roadmap/CONTEXT.md, then docs/roadmap/tier-2/00-storage-studio-shell.md.
Implement that spec only. Do not read other spec files.
Lift the paged media-scanning logic out of JunkWiperScanScreen.js into the new
shared mediaScanner.js as the spec describes — do not rewrite it from scratch,
and do not modify JunkWiperScanScreen.js.
When done, run the verify commands in CONTEXT §9 and set the spec's Status line to DONE.
```

### Step 2 — the cleaners (after 2.0 is merged; these 4 can run in parallel)
```
Read docs/roadmap/CONTEXT.md, then docs/roadmap/tier-2/01-screenshot-cleaner.md.
Implement that spec only. Do not read other spec files.
Spec 2.0 is already merged — reuse mediaScanner.js and CleanupReviewList.js, do not
rebuild them.
When done, run the verify commands in CONTEXT §9 and set the spec's Status line to DONE.
```
Swap the filename for `02-blurry-photos.md`, `03-large-videos.md`, `04-similar-photos.md`.

**Coordination note:** 2.2 and 2.4 both want `expo-image-manipulator`. Whichever
runs second should check `package.json` before adding it again.

### Step 3 — auto-scan (run last)
```
Read docs/roadmap/CONTEXT.md, then docs/roadmap/tier-2/05-auto-scan.md.
Implement that spec only. Do not read other spec files.
If spec 1.2 (Smart Reminders) is already DONE, reuse its notification-permission
helper rather than writing a second one.
When done, run the verify commands in CONTEXT §9 and set the spec's Status line to DONE.
```

---

## Tier 3 — Document power features

All 11 live in one file, so **name the section** you want built.

```
Read docs/roadmap/CONTEXT.md, then read ONLY section "3.1 — PDF Toolkit" of
docs/roadmap/tier-3-document-power.md, plus that file's shared rules at the top.
Implement that section only. Ignore every other section in the file.
When done, run the verify commands in CONTEXT §9 and update the row for 3.1 in
the Tier 3 table of docs/roadmap/README.md to DONE.
```

Swap the section name for any of:
`3.1 — PDF Toolkit` · `3.2 — Batch multi-page scan` · `3.3 — Translate document` ·
`3.4 — Compare two documents` · `3.5 — Redact sensitive info` ·
`3.6 — Handwriting → text` · `3.7 — Table → Excel / CSV` ·
`3.8 — Ask across ALL documents` · `3.9 — Form auto-fill` ·
`3.10 — Business card → contact` · `3.11 — Voice note → transcript → summary`

**Most of Tier 3 is backend-blocked.** Before starting one, run this in a chat first:

```
Read docs/roadmap/tier-3-document-power.md and list every "Backend needed"
endpoint across all sections, grouped by section, as a single spec document I can
hand to my .NET backend developer. Do not write any mobile code.
```

---

## Tier 4 — Vertical pack

**Build ONE.** My recommendation is 4.1 Freelancer/SMB.

```
Read docs/roadmap/CONTEXT.md, then read ONLY section "4.1 — Freelancer / SMB" of
docs/roadmap/tier-4-vertical-packs.md.
Implement that pack only. Ignore the other packs in the file.
Check the status board in docs/roadmap/README.md first — this pack depends on
1.4 (receipts), 3.1 (PDF) and 5.6 (folders). Build only the parts whose
dependencies are already DONE, and list the rest as blocked in your summary.
When done, update the Tier 4 table in docs/roadmap/README.md.
```

A pack is much bigger than a single feature. Better approach — split it first:

```
Read docs/roadmap/CONTEXT.md and section "4.1 — Freelancer / SMB" of
docs/roadmap/tier-4-vertical-packs.md.
Do not write code. Split this pack into individual feature specs in the same
format as docs/roadmap/tier-1/03-signature-fill.md, one file per feature, in
docs/roadmap/tier-4/. Then add them to the status board in README.md.
```
Then build those one at a time with the standard two-file prompt.

---

## Tier 5

```
Read docs/roadmap/CONTEXT.md, then read ONLY section "5.1 — Daily free credit" of
docs/roadmap/tier-5-retention-growth.md.
Implement that section only.
When done, run the verify commands in CONTEXT §9 and update the Tier 5 table in
docs/roadmap/README.md.
```

Suggested order: `5.1 → 5.3 → 5.6 → 5.5 → 5.2`.

---

## Useful non-build prompts

**Check where things stand:**
```
Read docs/roadmap/README.md and tell me the current status board, which specs are
unblocked right now, and which ones conflict if run in parallel. Do not write code.
```

**Keep the docs honest after a feature lands:**
```
Read docs/roadmap/CONTEXT.md. Verify every factual claim in it against the current
codebase — installed dependencies, route names, exported UI components, token names,
API endpoints. Fix anything that has drifted. Do not change anything outside CONTEXT.md.
```
Run this every few features. A stale CONTEXT.md sends every future agent down the
wrong path, which is the one failure mode that breaks this whole system.
