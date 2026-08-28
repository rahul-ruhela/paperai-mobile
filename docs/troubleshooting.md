# Troubleshooting — development environment

Errors that have already cost time once, with the verified cause and the fix.
Add to this file rather than re-diagnosing from scratch.

---

## 1. `TypeError: eventsQueue is not iterable` — Metro dies seconds after `npm start`

**First seen:** 2026-08-27, branch `chore/release-hardening`.

### Symptom

`npm start` boots, prints the QR code, then the process exits:

```
TypeError: eventsQueue is not iterable
    at FileMap.listener (.../@expo/cli/src/start/server/metro/waitForMetroToObserveTypeScriptFile.ts:89:25)
    at FileMap.emit (node:events:521:24)
    at Timeout.emitChange (.../metro/node_modules/metro-file-map/src/index.js:570:12)
```

It survives startup and dies on the **first file-change tick**, so it can look
like "it worked a second ago".

### Root cause

A version skew between Metro and the Expo CLI, caused by our own `overrides`.

Expo SDK 54 pins the whole Metro suite to **0.83.3** through `@expo/metro@54.2.0`,
because `@expo/cli@54.0.26` is compiled against it. Metro **0.83.4** changed the
`metro-file-map` `change` event payload:

| metro-file-map | payload emitted |
|---|---|
| 0.83.3 | `{ eventsQueue, firstEventTimestamp, firstEnqueuedTimestamp }` |
| 0.83.8 | `{ changes, logger, rootDir }` |

`@expo/cli` still destructures the old shape, in three listeners in
`waitForMetroToObserveTypeScriptFile.js`:

```js
const listener = ({ eventsQueue }) => {
    for (const event of eventsQueue) { ... }   // eventsQueue === undefined
};
```

`observeFileChanges` and `observeAnyFileChanges` in the same file have the same
bug, so any watched-file change triggers it, not just a TypeScript add.

These `overrides` in `package.json` were what dragged Metro forward:

```json
"metro@0.83":                  "^0.83.8",
"metro-config@0.83":           "^0.83.8",
"metro-transform-worker@0.83": "^0.83.8",
```

With them applied npm deduped Expo's 0.83.3 copy away entirely, which is why the
stack trace points at top-level `metro/node_modules/metro-file-map`.

### Fix

Remove those three `metro*@0.83` overrides and reinstall. Keep the `@0.84` ones —
they only affect an uninstalled peer branch under `@react-native/metro-config`.

```bash
npm install
```

### Verify

Do not eyeball `node_modules`; resolve the chain the CLI actually walks. Node
resolution matters here — `@expo/cli` imports `@expo/metro/metro/...`, so Metro
is resolved from *inside* `@expo/metro`, not from the top level:

```bash
node -e "
const cli='./node_modules/expo/node_modules/@expo/cli';
const entry=require.resolve('@expo/metro/metro/IncrementalBundler/RevisionNotFoundError',{paths:[cli]});
const p=require('path').dirname;
const m=require.resolve('metro/package.json',{paths:[p(entry)]});
const f=require.resolve('metro-file-map/package.json',{paths:[p(m)]});
console.log('metro', require(m).version, '| metro-file-map', require(f).version);
"
# expected: metro 0.83.3 | metro-file-map 0.83.3
```

A top-level `metro@0.83.8` still being present is **fine and expected** — it is
pulled by `@react-native/community-cli-plugin` (`metro: ^0.83.1`) and Expo never
loads it.

### The trap — do not "fix" the audit by bumping Metro

`npm audit` reports 8 highs rooted in `image-size` (ICNS/JXL/HEIF infinite-loop
DoS) and points at the Metro chain. Bumping Metro to `^0.83.8` **does genuinely
clear them** — verified 2026-08-27: metro 0.83.8 dropped the `image-size`
dependency entirely and inlined its own `getAssetSize`. That is exactly why the
overrides were added, and exactly why the dev server broke.

So this is a real trade-off, not a mistake to undo:

| Option | Audit | `expo start` |
|---|---|---|
| Metro 0.83.3 (Expo's pin) | 8 highs remain | works |
| Metro 0.83.8 | clean | **broken** |

We take 0.83.3 and accept the 8. Rationale: `image-size` runs in the **bundler at
build time**, parsing images out of our own `assets/` — it never ships in the
`.ipa`/`.apk`, and exploiting it means an attacker already put a hostile file in
the repo. A broken dev server is a certain cost; this is a theoretical one.

Overriding `image-size` alone is **not** a way out. Metro 0.83.3 calls it at
`Assets.js:173` with a **file path string**; `image-size` v2 removed filesystem
support and accepts only a `Uint8Array`, so v2 breaks asset dimensions for every
image. There is no patched 1.x.

The real remedy is an Expo SDK upgrade, on purpose, not a pin.

### Prevention

- Never add a `metro*` override to `package.json`. Metro's version is Expo's to
  choose; SDK 54 means Metro 0.83.3.
- `npm audit fix --force` is already banned for this project (see
  `release-runbook.md`) — this is one more reason.
- After any dependency change, run the resolve check above before assuming the
  dev server is healthy.

---

## 2. App renders normally but nothing is tappable

**Seen immediately after issue #1, 2026-08-27.**

### Symptom

The app shows your real signed-in UI — tabs, buttons, links all painted
correctly — but every tap does nothing. No red box, no crash, no error.

### What it is *not*

When this happened the instinct was "a dependency change broke gesture
handling". It had not. Check these before touching any code — all were verified
clean, and the checks take a minute:

| Check | Command | Expected |
|---|---|---|
| App code actually changed? | `git status --short` | only files you edited |
| Bundle compiles? | `npx expo export --platform android --output-dir <tmp>` | exit 0 |
| Live server healthy? | `curl -o /dev/null -w '%{http_code}' "http://localhost:8081/index.bundle?platform=android&dev=true"` | `200`, multi-MB |
| Native modules moved? | `git diff package-lock.json \| grep -oE 'node_modules/[^"]+' \| sort -u` | no `react-native-*` |
| Gesture root mounted? | `grep -n GestureHandlerRootView index.js` | wraps `<App />` |
| Worklets compiling? | fetch the bundle, then `grep -c __workletHash` | hundreds (514 on 2026-08-28) |

A dependency bump only breaks touch if it moves a **native** module
(`react-native-gesture-handler`, `-reanimated`, `-screens`,
`-safe-area-context`) out of sync with the compiled dev-client binary. If
`package-lock.json` shows only bundler packages changed, the dependency change
is not your cause.

`GestureHandlerRootView` lives in `index.js`, not `App.js` — do not "fix" a
missing wrapper in `App.js`, it is already correct one level up.

### It is not the babel config either

This project has **no babel config at all** — no `babel.config.js`, no
`.babelrc`, no `"babel"` key in `package.json`, and none has ever existed in git
history. **That is correct, not a missing file. Do not add one to "fix" this.**

`@expo/metro-config`'s transformer falls back to `babel-preset-expo` when a
project has no config, and `babel-preset-expo@54` auto-injects
`react-native-worklets/plugin` whenever `react-native-worklets` is installed
(`babel-preset-expo/build/index.js:289`). Reanimated 4 worklets therefore compile
with zero configuration.

Adding a hand-written `babel.config.js` here is a real risk: omit
`babel-preset-expo`, or hand-roll the worklets/reanimated plugin in the wrong
order, and you get a bundle that builds fine but whose gestures and animations
silently do nothing — which looks exactly like this issue and sends you in a
circle.

To prove the pipeline rather than trust it, count worklet markers in the real
served bundle (uses the running server, so it will not fight over the Metro
cache):

```bash
curl -s -o /tmp/b.js "http://localhost:8081/index.bundle?platform=android&dev=true&minify=false"
grep -c __workletHash /tmp/b.js   # 514 when healthy on 2026-08-28; 0 means babel is broken
```

### Cause

A dev client whose Metro died underneath it — i.e. the direct aftermath of issue
#1. The last frame stays painted, but the JS runtime is orphaned, so no touch
handler runs. It looks like a broken app; it is a disconnected one.

> **Confirmed resolved 2026-08-28.** After the Metro fix in issue #1 and a full
> app relaunch, navigation and every control work normally again. No app code,
> and no babel config, was changed to achieve it.

### Fix

Force-close the app from the app switcher and relaunch it. A shake-menu
**Reload** is often not enough — it can reattach to the dead JS context.

If it persists, restart the bundler clean:

```bash
# Ctrl+C in the npm start tab, then:
npx expo start --clear
```

### Prevention

- Fix issue #1 first. This symptom is downstream of it.
- Do not run a second bundler (`expo export`, a second `expo start`) beside a
  live `npm start`. They share a Metro cache directory, and `--clear` will wipe
  it underneath the running server.
