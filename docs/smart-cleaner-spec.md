# Smart Cleaner Specification

Status: **specification only — no code changed.**
Written: 2026-08-27.

Existing duplicate detection is **kept, not replaced**. Smart Cleaner is a layered shell around it.

---

## 1. What exists today

`src/screens/JunkWiperScanScreen.js` (1641 lines) already implements the whole free path:

- Permission flow — `MediaLibrary.requestPermissionsAsync(false)`, explicit handling of iOS **limited** access (`presentPermissionsPickerAsync`), and an honest denial state.
- Paged asset enumeration (`getAssetsAsync`, photos + videos, sorted by creation time) then `getAssetInfoAsync` in batches for `fileSize`.
- Three duplicate strategies: exact (size + dimensions), same filename, and sorted-neighbour near-duplicates (within 2 s, same dimensions).
- Credits: Reserve `junk_wiper_scan_report` (30) → Complete, with **Refund** on failure, cancellation, or a zero-result scan.
- Deletion strictly via `MediaLibrary.deleteAssetsAsync` after an explicit confirm sheet; the OS shows its own confirmation on top.

This is the Basic Cleaner. Everything below is additive.

---

## 2. Layers

### FREE — Basic Cleaner
- Duplicate photos and videos (exact + filename + neighbour strategies — today's engine).
- Duplicate documents: same size + same name among files under the app's document directory.
- Feature keys: `storage_studio` (hub), `screenshot_cleaner`, `large_video_finder` — all FREE, on-device, no credits.

### PLUS — Deep Clean
- **Similar photos** — perceptual grouping of burst/near-identical shots (`similar_photos`, credit key `similar_photo_scan`).
- **Blurry photos** — Laplacian-variance style sharpness score per image (`blurry_detector`, credit key `blurry_photo_scan`, ESSENTIAL).
- **Large files** — biggest assets by `fileSize`, grouped into size bands. Free to list; the *report* is part of the paid scan.

### ADVANCE — Deep Cleaner Pro
- **AI storage analysis** — server-side summary of the on-device scan *statistics* (counts, sizes, categories). No image content leaves the device.
- **Screenshot intelligence** — classify screenshots as receipt / chat / document / disposable, using existing OCR for the ones the user opens.
- **WhatsApp cleanup** — media-folder-style grouping. On iOS third-party app sandboxes are unreachable; this is limited to WhatsApp images saved to the photo library (detectable by filename/album). This limitation must be stated in the UI, not implied away.
- **Storage prediction** — "at this rate you run out in N weeks", from a rolling local history of scan totals.

---

## 3. Screens

```
StorageStudioScreen              (new hub; entry from Settings and Home)
├── StorageHeader                used / free ring, last scan date
├── CleanerCard × N              one per layer, locked cards visible with CTA
│      Basic Cleaner (FREE) · Deep Clean (PLUS) · Deep Cleaner Pro (ADVANCE)
├── JunkWiperScanScreen          existing scan + review + delete flow (unchanged)
├── DeepCleanResultScreen        tabs: Similar · Blurry · Large
├── ScreenshotInsightsScreen     categorised screenshots
└── StoragePredictionCard        trend line + projection
```

`JunkWiperScanScreen` is **not** rewritten. Before adding layers, its scan engine moves into `src/services/cleanerService.js` (pure functions: enumerate, group, score) so the new screens call the same code instead of copying it. The screen keeps its UI and becomes a consumer.

---

## 4. Permissions

| Need | API | Failure behaviour |
|---|---|---|
| Photo library | `MediaLibrary.requestPermissionsAsync(false)` | Explain what is lost; offer Settings. Never re-prompt in a loop. |
| Limited selection (iOS) | `MediaLibrary.presentPermissionsPickerAsync()` | Scan proceeds over the selected subset; a banner says results are partial. |
| Delete | none extra | OS confirmation sheet is always shown. |

`app.json` already carries `expo-media-library` with `photosPermission`, `savePhotosPermission` and `isAccessMediaLocationEnabled`. The usage string must be extended to mention similar/blurry analysis before those layers ship.

---

## 5. Storage handling

- Scan results live in memory for the session; only aggregates (`{scannedAt, totalAssets, totalBytes, groupCount}`) persist, in `cleaner-history.json` under `FileSystem.documentDirectory`, capped at the last 24 entries for the prediction feature.
- No thumbnails, hashes or file paths are persisted, and none are uploaded.
- The AI storage analysis request body contains counts and byte totals only — never filenames, never image data. This is a hard requirement, both for privacy and for App Review.

---

## 6. Performance requirements

| Metric | Target | Rationale |
|---|---|---|
| First result visible | ≤ 3 s | Today's screen shows the scanning animation immediately and reserves credits in parallel — keep that. |
| Asset enumeration | pages of 500, `getAssetInfoAsync` in batches of 20–50 | Matches the existing implementation; larger batches stall the JS thread. |
| Memory ceiling | < 250 MB on a 30k-asset library | Never hold decoded images; work from metadata, and stream group building. |
| Blur/similarity scan | max 2000 images per run, downsampled to ≤ 64 px | Bounded work; a "scan more" continuation instead of an unbounded run. |
| Cancellation | responsive within 500 ms, with a credit refund | Already implemented for the duplicate scan; must hold for every new layer. |
| UI | results in a `FlatList` with `keyExtractor`, `getItemLayout`, `removeClippedSubviews`, memoised rows | Grids of hundreds of thumbnails are the main jank source. |

---

## 7. Deletion policy (non-negotiable)

1. Nothing is ever deleted automatically — not on scan completion, not on "clean all", not on a timer.
2. Every deletion is preceded by an in-app confirm sheet naming the exact count and freed size, then the OS sheet.
3. Selection defaults to **nothing selected**. A "select all duplicates except the newest" helper is allowed, but the user still confirms.
4. Originals are never chosen for the user: within a group, the kept item is user-selectable.
5. A failed deletion reports which items failed; the list is refreshed from `MediaLibrary`, never assumed.

---

## 8. Credits

| Layer | Feature key | Credit key | Status |
|---|---|---|---|
| Basic Cleaner | `storage_studio` etc. | none | free, on-device |
| Duplicate report | `deep_clean` | `junk_wiper_scan_report` (30) | seeded, live |
| Blurry scan | `blurry_detector` | `blurry_photo_scan` | **seed missing — must be added first** |
| Similar scan | `similar_photos` | `similar_photo_scan` | **seed missing — must be added first** |
| AI storage analysis | `ai_storage_analysis` *(new)* | `ai_storage_analysis` *(new seed)* | to add |
| Screenshot intelligence | `screenshot_intelligence` *(new)* | *(new seed)* | to add |

Reserve → Complete/Refund only. A scan that finds nothing refunds, exactly as the duplicate scan does today.

---

## 9. Testing

1. Permission denied, limited, and full — three distinct UI paths, verified on device.
2. Zero-result scan refunds the reservation (ledger asserts a matching refund entry).
3. Cancellation mid-scan refunds and leaves no partial state.
4. 30k-asset library: no crash, memory under ceiling, cancellable throughout.
5. Deletion of a 200-item selection: confirm copy shows the right count and size; failures reported per item.
6. Locked layers visible with CTA at every tier; Free user cannot trigger a paid scan even by deep link.
7. Verify no request body from any cleaner path contains a filename, path, or image payload.
8. `npm test`, `npx tsc --noEmit`, `dotnet build` clean.
