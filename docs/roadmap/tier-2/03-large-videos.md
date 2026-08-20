# 2.3 — Large Video Finder

**Status:** TODO · **Branch:** `feat/large-videos` · **Requires 2.0 merged**
**Tier:** `free` · **Credits:** free · **Key:** `large_video_finder`

## Why

One 4K video equals a thousand photos. This is where the multi-gigabyte wins
actually are, and giving it away free makes the whole Storage Studio feel generous.

## Scope

List the biggest videos and space-hog media, sorted by size, with preview and delete.

## Files to touch

| File | Change |
|---|---|
| `src/screens/cleaners/LargeVideoScreen.js` | **new** |
| `App.js` | register route `LargeVideos` |
| `src/screens/StorageStudioScreen.js` | wire the tile |

## Backend needed
None.

## Implementation notes

- `mediaScanner.scanAssets({ mediaType: "video", needsFullInfo: true })` — you need
  `fileSize` and `duration`, so full info is required. This is the slow path; show
  real progress.
- Sort descending by `fileSize`. Show top 50 by default with a "show all" toggle —
  rendering 2000 video thumbnails will stutter.
- Each row: thumbnail, duration (`mm:ss`), size in MB/GB, creation date.
- Header: "Your videos use **12.4 GB**" with the top-20 subtotal underneath.
- Size filter chips: **> 100 MB · > 500 MB · > 1 GB · All**.
- Tap → full-screen preview. Video playback needs `expo-video` (**not installed**);
  if adding it is blocked, show the poster frame plus metadata and note the
  limitation — do not ship a broken play button.
- Warn before deleting anything created in the last 7 days: *"This is recent — sure?"*
- Also surface Live Photo pairs and RAW+JPEG duplicates if `mediaSubtypes` is
  available; these are easy extra gigabytes.

## Definition of done

- [ ] Videos listed largest-first with correct sizes and durations
- [ ] Total video usage shown in the header
- [ ] Size filters work
- [ ] Preview works, or the limitation is clearly handled
- [ ] Recent-file deletion warning
- [ ] Bulk delete with confirmation; reclaimed bytes logged
- [ ] Zero credits charged
- [ ] Verify commands from CONTEXT §9 pass

## Notes for other agents
_(append findings here)_
