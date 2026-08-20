# CONTEXT — read this first, then only your feature spec

**Purpose:** everything an agent needs to know about this codebase to build a feature,
without opening 20 files. If a fact is here, trust it — do not go re-derive it.
If you discover this file is wrong, fix it in the same PR.

---

## 1. Stack

| Thing | Value |
|---|---|
| Framework | Expo SDK 54, React Native 0.81.5, React 19 |
| Language | JavaScript (`.js`) for screens/components; `.ts` only for `constants/`, `config/` |
| Navigation | React Navigation 7 — bottom tabs + native stack, all wired in `App.js` |
| Animation | RN `Animated` API with `useNativeDriver`. **Do not introduce reanimated worklets** — the repo does not use them and Expo Go compatibility matters |
| HTTP | `axios` via the shared `api` instance in `src/api/client.js` |
| Backend | .NET 8, base URL in `src/constants/api.ts`, JWT bearer + refresh rotation |
| Storage | `expo-secure-store` for tokens, `AsyncStorage`-free — see `src/storage/` |

Never add a dependency without checking `package.json` first. Most needs
(camera, picker, filesystem, print, sharing, notifications, media library,
linear-gradient, IAP) are **already installed**.

---

## 2. Directory map

```
src/
  api/          one file per backend domain — auth, billing, credits, documents, tasks, dev
  components/   ErrorBoundary only
  config/       featureMatrix.ts — tier gating, mirrors backend Services/FeatureMatrix.cs
  constants/    api.ts — BASE_URL, IAP SKUs, tier/credit tables
  hooks/        useAccessTier, useCreditBalance, useFeatureAccess
  notifications/pushNotifications.js
  screens/      one file per screen, PascalCase + "Screen" suffix
  services/     entitlementService.js (cached entitlement snapshot)
  storage/      tokenStore.js, pendingPurchases.js
  ui/           design system — see §5
  utils/        permissions.js
```

**New feature = new file in the matching folder.** Do not create new top-level folders.

---

## 3. The credit flow — MEMORISE THIS

Every paid action follows the exact same 3-step reserve/complete/refund dance.
Costs are **never hardcoded in the UI** — always fetched from the backend.

```js
import {
  getFeatureConfig, reserveCredits, completeTransaction, refundTransaction
} from "../api/credits";

// 1. On mount — get the cost + the user-facing notice copy
const cfg = await getFeatureConfig("my_feature_key");
// cfg = { featureKey, creditCost, isEnabled, userNoticeTitle, userNoticeMessage }

// 2. User confirms → reserve BEFORE doing the work
let txnId = null;
try {
  const r = await reserveCredits("my_feature_key", referenceId ?? null, 0);
  txnId = r.transactionId;              // also: r.creditsReserved, r.creditsLeft
} catch (e) {
  if (e?.response?.status === 402) {
    // Insufficient credits. e.response.data = { credits, requiredCredits }
    // → Alert + offer navigation.navigate("Paywall")
  }
  return;
}

// 3. Do the work, then settle EXACTLY ONCE
try {
  const result = await doTheWork();
  if (produced_real_value(result)) await completeTransaction(txnId);
  else await refundTransaction(txnId, "Nothing found");   // see rule below
} catch (err) {
  await refundTransaction(txnId, err.message);
}
```

### Non-negotiable credit rules

1. **Never charge for a null result.** If the feature found/produced nothing,
   refund and tell the user "no credits used". Precedent:
   `JunkWiperScanScreen.js` — search `refundedClean`.
2. **Always refund on failure and on user cancel.**
3. **Never fabricate output** to make a paid action look productive.
   This is an App Review rejection (guideline 2.3.1) as well as dishonest.
4. **The backend is the authority.** `featureMatrix.ts` controls UI visibility only.
5. Show the cost on the button itself: `Extract Text · 1 credit`.
6. Use `<CreditConfirmModal />` (`src/ui/CreditConfirmModal.js`) for the confirm
   step — do not roll your own `Alert`.

---

## 4. Tier gating

`src/config/featureMatrix.ts` — tiers are `free < essential < plus < advance`.

```js
import { useFeatureAccess } from "../hooks/useFeatureAccess";
const { allowed, tier } = useFeatureAccess("ai_chat");
// not allowed → render an upsell card that navigates to "Paywall", never a dead button
```

**When you add a feature you MUST add its entry to `FEATURES[]` in `featureMatrix.ts`
AND tell the user to add the matching entry to the backend `Services/FeatureMatrix.cs`.**
The two files must stay key-for-key identical.

---

## 5. Design system — `src/ui/`

Import from the barrel: `import { GlassCard, PrimaryButton, AiOrb } from "../ui";`

| Piece | Use for |
|---|---|
| `GradientScreen` | full-bleed animated background — wrap every screen |
| `ScreenContainer` | simpler padded container (used by Paywall) |
| `Card` / `GlassCard` | content surfaces |
| `AiOrb` | the shared animated AI core. Props: `size, state ("idle"\|"working"\|"done"), onPress, label, sublabel` |
| `AiHeader` | title + subtitle header |
| `AppButton`, `PrimaryButton`, `SecondaryButton`, `DangerButton`, `PressScale` | buttons |
| `AppInput` | text input |
| `StatusBadge` | status chips |
| `GlassModal`, `ConfirmActionSheet`, `CreditConfirmModal` | overlays |
| `LoadingView`, `ErrorView`, `EmptyState` | the three list states — always handle all three |
| `BottomFade` | fade under the tab bar; add at the bottom of scrolling screens |

### Theming — never hardcode a colour

```js
import { useTheme } from "../ui/ThemeProvider";
import useThemedStyles from "../ui/useThemedStyles";

export default function MyScreen() {
  const { theme } = useTheme();
  const styles = useThemedStyles(makeStyles);
  ...
}
const makeStyles = (t) => StyleSheet.create({
  box: { backgroundColor: t.colors.glassSoft, borderColor: t.colors.border, borderRadius: t.radius.lg },
});
```

Token families in `src/ui/tokens.js` (light + dark variants of each):
`background surface surfaceAlt glass glassSoft glassBorder`,
`textPrimary textSecondary textMuted`,
`primary primaryLight primaryDark accentText`,
`success warning danger info` each with `…Bg` and `…Border`,
plus `border separator overlay sheet skeleton white black`,
and `t.radius.*`, `t.spacing.*`, `t.gradients.*`.

Animations must respect `useReduceMotion()` — skip loops, render a static state.

---

## 6. Adding a screen — the checklist

1. Create `src/screens/MyThingScreen.js`.
2. Wrap in `<GradientScreen>` + `<SafeAreaView>`.
3. Register in `App.js`: `<Stack.Screen name="MyThing" component={MyThingScreen} options={{ headerShown: false }} />`
   (existing stack routes: `Process Document Analysis Paywall Profile Analytics Privacy Terms HelpCenter ContactSupport JunkWiper CameraScanner CodeScanner`;
   tab routes: `Documents Upload Tasks Settings`).
4. Add an entry point — a tile on Home (`HomeScreen.js` → `QuickTile`) or a card in `UploadScreen.js`.
5. Add the feature to `featureMatrix.ts`.
6. Handle loading / empty / error.
7. Respect reduce-motion, add `accessibilityRole` + `accessibilityLabel` on every Pressable.

---

## 7. Backend API surface that already exists

```
POST /api/credits/reserve|complete|refund      GET /api/credits/balance
GET  /api/credits/feature-configs[/{key}]
GET  /api/documents                            POST /api/documents/{id}/process
DELETE /api/documents/{id}                     (upload = multipart to /api/documents/upload)
GET|POST /api/tasks   PATCH|DELETE /api/tasks/{id}
GET  /api/billing/entitlement                  POST /api/billing/ios/verify-transaction-auto
```

Anything else your feature needs **does not exist yet**. Say so explicitly in your
handoff note, specify the endpoint you want (method, path, body, response), and
build the client against a clearly-marked stub so the UI can ship first.
Full detail: `docs/api-integration.md`.

---

## 8. House style

- 4-space indent, double quotes, semicolons, trailing commas in multiline literals.
- Comments explain **why**, not what. Match the surrounding density.
- No `console.log` left in committed code.
- Errors reach the user through `Alert.alert` or `ErrorView` with a plain-English
  message — never a raw stack or axios error string. `client.js` already maps
  HTTP status → friendly message.
- Prefer `useMemo` for derived lists, `useCallback` for handlers passed down.
- `useFocusEffect` (not `useEffect`) for "reload when the screen is shown".

---

## 9. Verify before you hand off

```bash
npx tsc --noEmit -p tsconfig.json          # must be silent
node -e "const b=require('@babel/core'),f=require('fs');['<your files>'].forEach(p=>{b.transformSync(f.readFileSync(p,'utf8'),{filename:p,presets:['babel-preset-expo'],babelrc:false,configFile:false});console.log('OK '+p)})"
```

Then update your spec file's **Status** line and the board in `README.md`.
