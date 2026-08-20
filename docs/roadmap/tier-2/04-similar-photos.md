# 2.4 — Similar Photo AI Grouping

**Status:** TODO · **Branch:** `feat/similar-photos` · **Requires 2.0 merged**
**Tier:** `plus` · **Credits:** 2 (`similar_photo_scan`) · **Key:** `similar_photos`

## Why

This is the real upgrade over today's Junk Wiper. Junk Wiper matches on
`fileSize + dimensions` — it only catches *byte-identical* copies. It completely
misses the actual problem: twelve near-identical shots of the same moment, where
you want to keep the best one. Solving that is what justifies a Plus tier.

## Scope

Group visually similar photos, auto-pick the best in each group, let the user keep
one and delete the rest in a single tap.

## Files to touch

| File | Change |
|---|---|
| `src/screens/cleaners/SimilarPhotoScreen.js` | **new** |
| `src/services/perceptualHash.js` | **new** — the hashing + grouping |
| `App.js` | register route `SimilarPhotos` |
| `src/screens/StorageStudioScreen.js` | wire the tile |

## Backend needed

Credit config row `similar_photo_scan` (2 credits). On-device — no endpoint.

## Implementation notes

- **Perceptual hash (dHash), the standard approach:**
  1. Downscale to 9×8 greyscale (`expo-image-manipulator` — add the dep; 2.2 likely
     already added it, coordinate via the board).
  2. Compare each pixel to its right neighbour → 64 bits.
  3. Two images are similar when Hamming distance ≤ 10 (tune on real data).
- **Do not compare every pair** — 10k photos is 50M comparisons. Bucket first by
  capture time (within 5 minutes) and by the hash's top 16 bits, then compare only
  within buckets. This is the difference between 4 seconds and 4 minutes.
- Batch with `setTimeout(r, 0)` yields, same as 2.2.
- **Best-shot heuristic** for the auto-pick: highest resolution → largest fileSize
  → sharpest (reuse `blurDetect.js` from 2.2 if merged) → newest. Mark it with a
  ⭐ and pre-select all the *others* for deletion.
- Group UI: horizontal strip per group, the keeper first and visually distinct.
  Tapping another photo makes it the keeper.
- **The user must always be able to override the auto-pick.** Deleting someone's
  favourite photo is unrecoverable and unforgivable.
- **Credits:** 2 reserved on start; refund when zero groups are found (CONTEXT §3).

## Definition of done

- [ ] Groups genuinely similar photos (burst shots, near-identical retakes)
- [ ] Runs over 10k photos in a reasonable time without freezing
- [ ] Best-shot auto-selected and clearly marked; user can change it
- [ ] Only non-keepers are pre-selected for deletion
- [ ] 2 credits charged on a productive scan, refunded when nothing is found
- [ ] Non-Plus user sees an upsell
- [ ] Verify commands from CONTEXT §9 pass

## Notes for other agents
_(append findings here)_
