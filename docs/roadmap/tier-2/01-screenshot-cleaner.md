# 2.1 — Screenshot Cleaner

**Status:** TODO · **Branch:** `feat/screenshot-cleaner` · **Requires 2.0 merged**
**Tier:** `free` · **Credits:** free · **Key:** `screenshot_cleaner`

## Why

Everyone has hundreds of stale screenshots and knows it. It is the easiest possible
win, it is free, and a free win is what makes a user trust the paid cleaners.

## Scope

Find screenshots older than a chosen age, group by month, let the user bulk-delete.

## Files to touch

| File | Change |
|---|---|
| `src/screens/cleaners/ScreenshotCleanerScreen.js` | **new** |
| `App.js` | register route `ScreenshotCleaner` |
| `src/screens/StorageStudioScreen.js` | wire the tile |

## Backend needed
None.

## Implementation notes

- Use `mediaScanner.scanAssets({ mediaType: "photo" })` from 2.0.
- Detect screenshots by, in order of reliability:
  1. `MediaLibrary.getAlbumAsync("Screenshots")` — the dedicated album (iOS + Android)
  2. `filename` matching `/^(screenshot|screen_shot|img_\d+_screenshot)/i`
  3. Dimensions exactly matching the device screen (`Dimensions.get("screen")` × `PixelRatio`)
- Age filter chips: **30 days · 90 days · 6 months · 1 year · All**. Default 90 days.
- Group by month with a section header showing that month's reclaimable MB.
- Render through `CleanupReviewList` from 2.0 — do not build a new grid.
- Recent screenshots (< 7 days) are excluded entirely; people still need those.

## Definition of done

- [ ] Correctly identifies screenshots on a real device (test all three strategies)
- [ ] Age filter works and defaults to 90 days
- [ ] Monthly grouping with per-month MB totals
- [ ] Bulk delete with confirmation; reclaimed bytes logged to `storageHistory`
- [ ] Empty state when there is nothing to clean — and it is friendly, not an error
- [ ] Zero credits charged
- [ ] Verify commands from CONTEXT §9 pass

## Notes for other agents
_(append findings here)_
