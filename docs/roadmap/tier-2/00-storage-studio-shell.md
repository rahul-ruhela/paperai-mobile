# 2.0 — Storage Studio shell + dashboard

**Status:** TODO
**Branch:** `feat/storage-studio-shell`
**Tier gate:** `free` for the hub itself
**Credits:** free
**Blocks:** 2.1, 2.2, 2.3, 2.4, 2.5 — **this must land first**

## Why

Junk Wiper is your only feature no competitor pairs with document AI. But right now
it does one thing (duplicates) and charges 3 credits for it. Turning it into a hub
of cleanup tools makes the credit spend feel earned and gives you five more reasons
to open the app.

This spec builds the **container and shared machinery only**. Each cleaner is a
separate spec that plugs in.

## Scope

**In:** the Storage Studio screen, the tool grid, the storage dashboard gauge, a
shared scan-engine module, a shared review/delete UI, reclaimed-space history.
**Out:** the individual cleaners (2.1–2.5). Junk Wiper stays exactly as it is and
becomes one tile in the grid.

## Files to touch

| File | Change |
|---|---|
| `src/screens/StorageStudioScreen.js` | **new** — the hub |
| `src/services/mediaScanner.js` | **new** — shared media-library scanning engine |
| `src/ui/CleanupReviewList.js` | **new** — shared select/preview/delete UI |
| `src/services/storageHistory.js` | **new** — reclaimed-bytes log |
| `App.js` | register `<Stack.Screen name="StorageStudio" …/>` |
| `src/screens/HomeScreen.js` | point the "Clean" `QuickTile` at `StorageStudio` instead of `JunkWiper` |
| `src/config/featureMatrix.ts` | add the new feature keys (see below) |

**Do not edit `JunkWiperScanScreen.js`** — it keeps working standalone.

## Feature keys to register

Add to `featureMatrix.ts` (and tell the user to mirror in backend `FeatureMatrix.cs`):

```ts
{ key: "storage_studio",     name: "Storage Studio",       requiredTier: "free",  onDevice: true,  backendVerified: false },
{ key: "screenshot_cleaner", name: "Screenshot Cleaner",   requiredTier: "free",  onDevice: true,  backendVerified: false },
{ key: "large_video_finder", name: "Large Video Finder",   requiredTier: "free",  onDevice: true,  backendVerified: false },
{ key: "blurry_detector",    name: "Blurry Photo Detector",requiredTier: "essential", onDevice: true, backendVerified: true, creditFeatureKey: "blurry_photo_scan" },
{ key: "similar_photos",     name: "Similar Photo Grouping", requiredTier: "plus", onDevice: true, backendVerified: true, creditFeatureKey: "similar_photo_scan" },
```

## Backend needed

Two new credit feature-config rows only: `blurry_photo_scan` (1 credit),
`similar_photo_scan` (2 credits). No new endpoints.

## Implementation notes

### `mediaScanner.js` — extract, don't rewrite

`JunkWiperScanScreen.js` already contains a working paged media-library scanner
(`findDuplicates`, roughly lines 380–470: paged `getAssetsAsync`, then batched
`getAssetInfoAsync` for `fileSize`). **Lift that paging + batching logic** into
`mediaScanner.js` as a reusable primitive:

```js
export async function scanAssets({ mediaType, onProgress, onCount, needsFullInfo });
// → [{ id, uri, filename, width, height, fileSize, creationTime, mediaType, duration }]
```

Keep the batching — `getAssetInfoAsync` per asset is slow, and a 20k-photo library
will freeze the UI without it. Reuse the same permission-handling flow (full vs
limited access, the `presentPermissionsPickerAsync` path).

### `CleanupReviewList.js` — the shared payoff UI

Every cleaner ends the same way: a grid of candidates, multi-select, "select all",
a running "X items · Y MB selected" bar, and a confirm-delete step.
Build it once here. Props:
`{ groups | items, onDelete, kindFilters, emptyTitle, emptySub }`.

**Nothing is ever deleted without an explicit confirm step.** Reuse
`ConfirmActionSheet`. Deletion goes through `MediaLibrary.deleteAssetsAsync`,
which shows the OS confirmation on iOS as well — that is expected, not a bug.

### The dashboard

Top of the hub: a circular gauge showing used/free device storage
(`FileSystem.getFreeDiskStorageAsync()` and `getTotalDiskCapacityAsync()`), with
"You reclaimed **4.2 GB** this month" underneath, read from `storageHistory.js`.
Use `<AiOrb state="working" />` while a scan runs so the whole app shares one
visual language.

### The grid

Six tiles: Duplicates (→ existing `JunkWiper`), Screenshots, Blurry, Large Videos,
Similar Photos, Auto-scan. Each tile shows its credit cost or a **FREE** badge, and
a locked state with an upsell for tiers the user does not have.

## Definition of done

- [ ] Hub renders with dashboard + 6 tiles, correct free/cost/locked badges
- [ ] `mediaScanner.js` scans a 10k+ library without freezing the UI
- [ ] `CleanupReviewList` handles select/select-all/deselect and shows a live MB total
- [ ] Deletion always requires explicit confirmation
- [ ] Reclaimed space is logged and shown on the dashboard
- [ ] Junk Wiper still works unchanged from its own tile
- [ ] Limited photo access is handled with the same UX as Junk Wiper
- [ ] Verify commands from CONTEXT §9 pass

## Notes for other agents

_(append findings here)_
