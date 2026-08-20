# 2.2 — Blurry Photo Detector

**Status:** TODO · **Branch:** `feat/blurry-photos` · **Requires 2.0 merged**
**Tier:** `essential` · **Credits:** 1 (`blurry_photo_scan`) · **Key:** `blurry_detector`

## Why

Blurry shots are dead weight nobody reviews manually. This is the first *paid*
cleaner, so it must feel obviously smarter than the free ones.

## Scope

Score photos for blur, surface the worst, let the user review side-by-side and delete.

## Files to touch

| File | Change |
|---|---|
| `src/screens/cleaners/BlurryPhotoScreen.js` | **new** |
| `src/services/blurDetect.js` | **new** — the scoring function |
| `App.js` | register route `BlurryPhotos` |
| `src/screens/StorageStudioScreen.js` | wire the tile |

## Backend needed

Credit config row `blurry_photo_scan` (1 credit). No endpoint — scoring is on-device.

## Implementation notes

- **Scoring approach.** A true Laplacian-variance blur score needs pixel access,
  which RN does not give you cheaply. Pick one and document the choice:
  1. **Recommended:** downscale each image to ~64px via
     `expo-image-manipulator` (**not installed** — add it, it is a first-party
     Expo package), read the result, and compute a gradient-energy score. Low
     gradient energy = blurry.
  2. **Cheap proxy** if adding the dep is blocked: flag photos whose `fileSize`
     is far below the median for their pixel dimensions — blurry images compress
     much smaller. Less accurate; label results "possibly blurry".
- **Process in batches of ~20 with `await new Promise(r => setTimeout(r, 0))`
  between batches**, or the JS thread blocks and the scan animation freezes.
- Sort worst-first. Show the blur score as a 1–5 dot rating on each thumbnail.
- **Never auto-select.** Blur is subjective — a deliberately soft-focus portrait
  is not junk. Everything starts unselected; the user opts in.
- Tap a thumbnail → full-screen preview so the user can actually judge it.
- **Credits (CONTEXT §3):** reserve on scan start, refund if the scan finds zero
  blurry photos, complete only when results are returned.

## Definition of done

- [ ] Scoring runs over 5000 photos without freezing the UI
- [ ] Results sorted worst-first with a visible score
- [ ] Nothing pre-selected; full-screen preview available
- [ ] 1 credit charged on a productive scan, refunded when nothing is found
- [ ] Non-Essential user sees an upsell, not a dead tile
- [ ] Progress indicator is honest (reflects real batch progress)
- [ ] Verify commands from CONTEXT §9 pass

## Notes for other agents
_(append findings here)_
