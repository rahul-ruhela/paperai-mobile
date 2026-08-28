# Smart Cleaner Specification

Status: **implemented** (roadmap Module 4), 2026-08-28. Two declared layers are
deliberately unbuilt and one is dropped — see §10.
Written: 2026-08-27. Last synced to the repository: 2026-08-28.

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
- ~~**WhatsApp cleanup**~~ — **dropped, not built.** See §10.1.
- **Storage prediction** — "at this rate you run out in N weeks", from a rolling local history of scan totals. *Built* as `storage_prediction`, on-device and therefore uncharged.

---

## 3. Screens

As built:

```
StorageStudioScreen              hub; entry from Settings → Storage Studio
├── device storage bar           used / free, last scan date
├── Storage Forecast card        Advance; locked-with-CTA below it
└── CleanerCard × 5              Duplicates · Screenshots · Large Files ·
                                 Blurry · Similar. Locked cards stay visible
                                 under a lock badge, per policy §5.

StorageScanScreen                ONE scan → review → delete flow, four modes
                                 (screenshots | large | blurry | similar),
                                 chosen by the `mode` route param.

JunkWiperScanScreen              unchanged UI; now a consumer of cleanerService.
```

Four modes over one screen rather than the four separate result screens first
sketched here: the layers differ only in which rows they produce, and the review
list and the deletion path are where the §7 rules live. One copy of those is one
chance to get them wrong.

`JunkWiperScanScreen` is **not** rewritten. Its scan engine moved into
`src/services/cleanerService.js` — pure grouping, banding, hashing, sharpness and
projection above, thin `MediaLibrary` paging below — so the new screens call the
same code instead of copying it. The screen kept its UI and became a consumer;
it lost ~140 lines in the move. Per-image sampling lives in
`src/services/imageSampler.js`, and the scan aggregate store in
`src/services/cleanerHistory.js`.

---

## 4. Permissions

| Need | API | Failure behaviour |
|---|---|---|
| Photo library | `MediaLibrary.requestPermissionsAsync(false)` | Explain what is lost; offer Settings. Never re-prompt in a loop. |
| Limited selection (iOS) | `MediaLibrary.presentPermissionsPickerAsync()` | Scan proceeds over the selected subset; a banner says results are partial. |
| Delete | none extra | OS confirmation sheet is always shown. |

`app.json` carries `expo-media-library` with `photosPermission`, `savePhotosPermission` and `isAccessMediaLocationEnabled`. **Done:** both photo usage strings — the media-library one and the image-picker one, which must agree — now name the duplicate, screenshot, large-file, blurry and similar scans, and state that photos are analysed on the device and never uploaded or deleted without confirmation.

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
| Screenshots, Large files | `screenshot_cleaner`, `large_video_finder` | none | free, on-device |
| Blurry scan | `blurry_detector` | `blurry_photo_scan` | seeded (Module 0), live |
| Similar scan | `similar_photos` | `similar_photo_scan` | seeded (Module 0), live |
| Storage forecast | `storage_prediction` | **none, by design** | live; on-device arithmetic, nothing to bill |
| AI storage analysis | `ai_storage_analysis` | `ai_storage_analysis` | seeded (`20260828120000`); no entry point yet — §10.2 |
| Screenshot intelligence | `screenshot_intelligence` | `screenshot_intelligence` | seeded (`20260828120000`); no entry point yet — §10.2 |

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

**Automated so far** — `__tests__/cleanerService.test.js` (38 cases: grouping,
banding, hashing, sharpness, projection, and the closed shape of the analysis
payload) and `__tests__/cleanerHistory.test.js` (12 cases: the persisted
whitelist, the 24-entry cap, and null rather than zero for an unreadable disk).
Items 1, 3, 4 and 5 above are device checks and remain manual.

---

## 10. App Review compliance record

Written during implementation, 2026-08-28. Cleaner and "storage booster" apps are
reviewed harder than most — the category has a history of inflated savings claims
and silent deletion — so the decisions below are recorded rather than assumed.

### 10.1 Dropped: WhatsApp cleanup

§2's Advance layer named a WhatsApp cleanup. It is **not built and is removed
from scope**, for two reasons that compound:

- It puts a third-party trademark in the app's own feature list, which is a
  gratuitous 5.2.5 risk for a feature that is not a WhatsApp integration.
- The spec already conceded that iOS makes other apps' sandboxes unreachable, so
  the feature could only ever have covered images that were already saved to the
  photo library. Shipping a feature named after an app whose data it cannot see
  is the plainest kind of 2.3.1 problem.

Nothing is lost. Media saved to the library from any messaging app is already
found by the duplicate and similar-photo layers, by size, name and appearance,
without naming anyone's product.

### 10.2 Registered but with no entry point: AI storage analysis, screenshot intelligence

Both are in `FeatureMatrix.cs`, in `featureMatrix.ts`, and have credit configs —
but neither has a card on the Storage Studio hub, because both need a backend
route that §7 of the roadmap explicitly says Module 4 does not add.

A locked card is honest when the feature exists behind it. A card that a paying
Advance subscriber taps and finds nothing behind is a 2.3.1 finding, and a worse
product besides. They are registered now so their gate is settled once, exactly
as `smart_recall` and `voice_companion` were in Module 1, and their entry points
land in the same commit as their endpoints.

### 10.3 Honest reporting (2.3.1)

- Nothing is ever synthesised. A tidy library returns zero rows and says so.
- Reclaimable bytes exclude the copy being kept: three copies of a 1 KB file free
  2 KB, not 3 KB. Asserted in `__tests__/cleanerService.test.js`.
- Duplicate documents claim no megabytes at all, because the documents API
  exposes no size and an invented one is a lie in the user's favour.
- A photo that could not be decoded is reported as unknown, never as blurry. It
  is not offered for deletion.
- Nothing below 50 MB is called a "large file".
- The storage forecast refuses to answer below three scans spanning a day, calls
  itself an estimate, names how many scans it is based on, and gives a growth
  rate without a date when the OS will not report free space.

### 10.4 Deletion (guideline 2.5.1, and §7 above)

Unchanged and enforced in one place, `StorageScanScreen`: selection starts empty,
every deletion passes an in-app confirm sheet naming the count and the freed size,
the OS sheet follows, and the list is rebuilt from what `MediaLibrary` says is
still there rather than from what was requested. A partially confirmed OS sheet
is a normal outcome and is reported as one.

### 10.5 Permissions (5.1.1)

The photo library usage strings in `app.json` — both the media-library and the
image-picker copies, which must agree — were extended to name the new analysis
before the layers shipped, and to state that photos are analysed on the device
and never uploaded or deleted without confirmation.

Permission is requested at the point of use, in the scan screen. The Permission
Center from Module 2 still only reads state; it does not ask.

### 10.6 Data leaving the device (5.1.2 and the privacy nutrition label)

- The blurry and similar scans run entirely on-device: one 64×64 greyscale
  downsample per photo, read for a sharpness score and a 64-bit hash and then
  discarded. No image, thumbnail, hash or path is uploaded or persisted.
- The only thing any scan writes to disk is the aggregate in
  `cleaner-history.json`, whose shape is pinned in `cleanerHistory.recordScan`
  rather than trusted from the call site, and tested for leaks.
- `buildAnalysisPayload` is a closed shape with a test asserting no filename,
  path or asset id survives serialisation. It exists ahead of the endpoint that
  will use it so the boundary is settled before there is a call site to argue at.
- No privacy label change is required by this module: nothing new is collected.

### 10.7 Purchases

No change. Every locked layer routes to the existing paywall through
`FeatureLock`, which offers Restore Purchases first for a lapsed plan.

### 10.8 Open, not caused by this module

`CreditsController.BuiltInDefaults()` prices `blurry_photo_scan` at 1 credit and
`similar_photo_scan` at 2, while the seeded `FeatureCreditConfigs` rows for both
say 3. The defaults are only reached when the database row is missing, so the
seeded value governs in practice — but the two should be reconciled before either
scan is exercised against a database that has not run the Module 0 migration.
