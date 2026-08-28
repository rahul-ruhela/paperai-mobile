# Performance Optimization Plan

Status: **partially applied** (roadmap Module 8), 2026-08-29. No features added.
Six items are done; the rest are deliberately not, and the measurement gate
this document sets for itself is **not met**. See §Implementation record.
Written: 2026-08-27. Measured against the repo as it stands (`src/` ≈ 17.5k lines, 26 screens).

Each item: problem → location → solution → expected improvement.

---

## CRITICAL

### C1 — `JunkWiperScanScreen.js` is a 1641-line screen doing enumeration, grouping, billing, and rendering in one component

- **Location:** [JunkWiperScanScreen.js](src/screens/JunkWiperScanScreen.js) — 20+ `useState` hooks in one component; scan progress (`liveCount`, `liveFound`, `liveBytes`, `progress`) updates state during the asset loop.
- **Problem:** every progress tick re-renders the entire screen, including the result grid, while the JS thread is already busy with `getAssetInfoAsync`. On large libraries this is the app's worst jank.
- **Solution:** extract the engine into `src/services/cleanerService.js` (pure async generator over assets); throttle progress to ~10 Hz; hold live counters in a `useRef` + a single `useReducer` commit per tick; drive the animated counters with Reanimated shared values so they never touch React state.
- **Expected:** re-renders during a scan drop from hundreds to tens; visibly smoother progress on a 30k-asset library.

### C2 — No memoised list rows anywhere in the app

- **Location:** `React.memo` appears **0 times** in `src/`. `renderItem` is an inline arrow in 4 screens ([HomeScreen.js](src/screens/HomeScreen.js), [TasksScreen.js](src/screens/TasksScreen.js), [AiChatScreen.js](src/screens/AiChatScreen.js), [CameraDocumentScanScreen.js](src/screens/CameraDocumentScanScreen.js)).
- **Problem:** a new `renderItem` identity each render invalidates every row; every parent state change re-renders the whole list.
- **Solution:** extract row components, wrap in `React.memo` with an explicit comparator on the fields the row shows; hoist `renderItem` into `useCallback`; ensure `keyExtractor` returns a stable id.
- **Expected:** list re-render cost drops roughly with list length — the biggest win on Documents with 50+ items.

### C3 — FlatLists carry none of the windowing props

- **Location:** across the 4 FlatList screens, `initialNumToRender`, `windowSize`, `removeClippedSubviews` and `getItemLayout` appear **0 times**.
- **Problem:** RN mounts far more rows than a screen shows, and cannot skip layout measurement for uniform rows.
- **Solution:** `initialNumToRender={8}`, `windowSize={7}`, `removeClippedSubviews` on Android, `maxToRenderPerBatch={8}`, and `getItemLayout` where row height is fixed (task rows, document rows).
- **Expected:** faster first paint on list screens; less memory held by off-screen rows.

---

## HIGH

### H1 — Startup does three sequential awaits before the first frame

- **Location:** [App.js](App.js) `AppShell` — `getAccessToken()` then `ensureExpoGoTestCredits()` and `registerForPushNotifications()`, gated behind `ready && hydrated` with `BootScreen` showing meanwhile.
- **Problem:** token read (SecureStore) and theme hydration are serialised with two network-touching calls before the UI appears.
- **Solution:** await only the token and the theme; fire `ensureExpoGoTestCredits` and `registerForPushNotifications` after the first paint (`InteractionManager.runAfterInteractions`). They already ignore their results.
- **Expected:** ~200–500 ms off cold start on a real device.

### H2 — Entitlement snapshot re-fetched per hook consumer

- **Location:** [useAccessTier.js](src/hooks/useAccessTier.js) — every mount calls `fetchEntitlements()`; [entitlementService.js](src/services/entitlementService.js) caches for 30 s in-memory only.
- **Problem:** each screen using `useFeatureAccess` holds its own copy of the snapshot and re-renders independently; after 30 s of navigation the same call repeats. There is no shared subscription, so a purchase refresh in one screen does not update another.
- **Solution:** promote the snapshot to a React context provider mounted once in `AppShell` (`EntitlementProvider`), with the hooks reading from context; keep the 30 s TTL as a staleness check plus an explicit `invalidate` after purchases.
- **Expected:** one entitlement request per app session instead of one per screen mount; correct cross-screen refresh after purchase.

### H3 — Focus effects re-fetch on every tab switch

- **Location:** 10 `useFocusEffect`/focus listeners across screens; Documents and Assistant both refetch their whole list on each focus.
- **Problem:** switching tabs four times fires four full list loads, each replacing state and re-rendering the list.
- **Solution:** stale-while-revalidate — render the cached list immediately, refetch only when the data is older than ~60 s or after a known mutation.
- **Expected:** near-instant tab switches; markedly fewer API calls in a typical session.

### H4 — `reminders.json` is read and rewritten on every reminder operation

- **Location:** [reminderService.js](src/services/reminderService.js) — `listReminders`, `scheduleReminder`, `snooze`, `cancel`, `grouped` each read the whole file, mutate, write it back.
- **Problem:** N file round-trips for N operations, on the JS thread; the Assistant screen calls several in sequence.
- **Solution:** an in-memory cache with a debounced (~300 ms) write-behind, invalidated on app background; batch the schedule/cancel pairs used by snooze.
- **Expected:** reminder actions become instant; removes a stutter when the reminders section loads.

### H5 — Thirteen looping animations, several unconditional

- **Location:** 13 `Animated.loop` / `withRepeat` uses across `src/ui` and screens (orb, scan pulse, shimmer).
- **Problem:** loops that keep running while off-screen or after a phase ends hold the UI thread awake and cost battery.
- **Solution:** stop loops on blur (`useIsFocused`) and on phase change; honour the existing [useReduceMotion.js](src/ui/useReduceMotion.js) everywhere, not only where it is already wired.
- **Expected:** lower idle CPU, less battery drain during long scans.

---

## MEDIUM

### M1 — `ScrollView` + `.map()` used for growable lists

- **Location:** 34 `.map(` call sites in `src/screens` — including Settings sections, Expenses and analysis blocks.
- **Problem:** every row mounts at once; fine for fixed sections, wrong for user-grown data (expenses, chat history).
- **Solution:** convert only the unbounded ones (Expenses, any list that grows with use) to `FlatList`; leave fixed-length sections alone.
- **Expected:** constant-time mount for long expense histories.

### M2 — Styles rebuilt per render in themed screens

- **Location:** the `makeStyles(colors)` pattern is applied in some screens; several others call `StyleSheet.create` inside the component body or build inline style objects.
- **Problem:** new style objects each render defeat RN's style caching and break `React.memo` on children receiving `style` props.
- **Solution:** `const styles = useMemo(() => makeStyles(colors), [colors])` uniformly; hoist static styles to module scope.
- **Expected:** small but broad win, and a prerequisite for C2's memoisation to pay off.

### M3 — Images rendered without dimensions or caching hints

- **Location:** 8 `<Image>` uses; duplicate/result grids render library assets by URI.
- **Problem:** undecoded full-resolution assets in a grid are a memory spike; no downscaling on the native side.
- **Solution:** always pass explicit `width`/`height`, request thumbnails rather than originals, and consider `expo-image` for its memory/disk cache if grid density grows.
- **Expected:** materially lower peak memory in cleaner result grids.

### M4 — 30 s blanket axios timeout

- **Location:** [client.js](src/api/client.js) — `timeout: 30000` for every call.
- **Problem:** a hung `GET /api/entitlements/me` blocks a gate behind it for 30 s.
- **Solution:** keep 30 s for uploads/AI; use 8–10 s for small GETs (entitlements, tasks, credits) via a per-call override.
- **Expected:** faster failure and fallback to the FREE snapshot when the network is bad.

---

## LOW

### L1 — Every screen is imported eagerly in `App.js`
26 screen modules are imported at startup even though most are never visited in a session. `React.lazy` + `Suspense` for the heavy rarely-used ones (JunkWiper, Signature, CodeScanner, Analytics) trims the initial bundle parse. Modest gain; do it after C1's extraction.

### L2 — Verbose `console.log` in hot paths
Scan loops and API error handlers log per iteration. Strip in release builds via a small `log()` wrapper gated on `__DEV__`.

### L3 — `chatFreeMessages` / `expenseStore` / `signatureStore` each own an ad-hoc JSON file layer
Three near-identical read/parse/write implementations. One shared `jsonStore(name)` helper with the H4 write-behind removes the duplication and makes the caching fix apply everywhere at once.

---

## Measurement plan

Before/after each item, on a physical device, release build:

| Metric | Tool | Baseline to capture first |
|---|---|---|
| Cold start to first interactive frame | manual stopwatch + `performance.now()` marker in `AppShell` | H1 |
| Re-render counts | React DevTools Profiler, per screen interaction | C1, C2, H2 |
| Scroll FPS on 200 documents | Perf Monitor / Instruments | C2, C3 |
| Peak memory on a 30k-asset scan | Xcode Instruments (Allocations) | C1, M3 |
| API calls per 2-minute session | axios interceptor counter in dev | H2, H3 |

No item ships without a before-and-after number; "feels faster" is not a result.

---

## Suggested order

C1 → C2 → C3 (list and scan performance, the user-visible ones) → H1, H2 (startup and request volume) → H3, H4, H5 → M1–M4 → L1–L3.

---

## Implementation record

Written 2026-08-29.

### The measurement gate is not met, and that matters

This plan's own rule is: *"No item ships without a before-and-after number;
'feels faster' is not a result."*

**No numbers were captured.** The work below was done in a development
environment with no physical device, no release build, and no Instruments run.
Every item was chosen because the mechanism is understood and the change is
small, not because it was measured — which is a weaker basis than this document
asks for, and is stated here rather than quietly skipped.

What that means practically: these are safe, conventional changes that should not
regress anything, and several are verified by tests. But "should not regress" is
not "measured to improve", and the table in *Measurement plan* above is still
the work that proves any of it. Treat the items below as applied-but-unproven.

### Applied

| Item | What was done |
|---|---|
| **C1** *(partly, in Module 4)* | The scan engine left `JunkWiperScanScreen` for `services/cleanerService.js`. The screen lost ~140 lines and became a consumer. The **progress throttling** half of C1 is not done. |
| **C2** *(partly)* | `AiChatScreen`'s `Bubble` is now `React.memo`, with `renderItem` hoisted into `useCallback`. A chat re-renders on every keystroke in the composer; before this each keystroke re-rendered every bubble on screen. `TaskCard` and `SegmentedTabs` were already memoised. |
| **C3** | Windowing props on the two lists that grow with use — Documents and the chat. **No `getItemLayout`**: those rows have variable heights, and a wrong constant there causes scroll jumps far worse than the measurement it saves. |
| **H1** | `ensureExpoGoTestCredits` and `registerForPushNotifications` moved behind `InteractionManager.runAfterInteractions`. They were running between the token read and `setReady`, putting two network calls in front of the UI appearing. Both are idempotent and neither's result was ever used. |
| **H2** | Consumers now share one snapshot via a subscriber set in `entitlementService`, and `invalidateEntitlements()` re-fetches and publishes. |
| **M4** | A `FAST` (10 s) per-call timeout on the small GETs that gates wait on — entitlements, credit balance, voice and recall preferences. The 30 s blanket default is right for an upload and wrong for a request whose failure has a good default. |

`useAccessTier`'s return shape is unchanged, so nothing that consumes it —
`useFeatureAccess`, `FeatureLock`, or any screen behind them — needed editing.
`__tests__/entitlementSharing.test.js` covers the sharing, the publish after a
purchase, unsubscribe, a throwing listener, and the offline fallbacks.

### One deliberate deviation

H2 asked for a React context provider. It was built as a **subscriber set in the
service** instead. Same two outcomes — one shared snapshot, and a refresh that
reaches every screen — without adding a provider that every screen must then be
rendered underneath. A gate that silently reads a default because it mounted
outside a provider is a worse failure than the one being fixed, and this design
cannot produce it.

### Not applied, and why

- **C1 (progress throttling)**, **H3** (stale-while-revalidate on focus),
  **H4** (`reminders.json` write-behind), **H5** (stopping animation loops on
  blur), **M1**–**M3**, **L1**, **L3**: each changes behaviour in a way that
  wants a measurement to justify it and a device to verify it. Applying them
  blind would be exactly the "feels faster" this document forbids.
- **L2** is **already satisfied**: `src/` contains zero `console.log` calls. The
  item was written against an earlier state of the tree.

### Housekeeping noticed but not touched

`src/ui/` contains ten untracked Finder duplicates (`TaskCard 2.js`,
`tokens 2.js`, and so on). Nothing imports them and none is in git, so they are
local working-directory cruft rather than repository content — safe to delete,
but they are the developer's files and were left alone.
