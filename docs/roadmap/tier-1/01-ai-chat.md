# 1.1 — AI Chat with your document

**Status:** TODO
**Branch:** `feat/ai-chat`
**Tier gate:** `plus` (already declared as `ai_chat` in `featureMatrix.ts`)
**Credits:** 1 per user message. Free for the first message of each document (hook).
**Conflicts with:** 1.4 (both edit `UploadScreen.js`)

## Why

The single most expected AI feature in 2026, and you already sell it in the Plus
tier — but the button currently says "coming soon" (`UploadScreen.js:217`). Users
who paid for Plus and hit that message churn immediately. Highest-priority gap.

## User story

From a processed document, tap **Ask AI** → a chat screen opens with the document
pinned at the top → user asks questions in natural language → answers cite the part
of the document they came from.

## Scope

**In:** chat UI, message send/receive, per-document history, credit charging,
3 starter suggestion chips, copy-answer, empty/loading/error states.
**Out:** cross-document chat (that is 3.8), voice input, streaming tokens (v2).

## Files to touch

| File | Change |
|---|---|
| `src/screens/AiChatScreen.js` | **new** — the chat screen |
| `src/api/chat.js` | **new** — API client |
| `App.js` | register `<Stack.Screen name="AiChat" …/>` |
| `src/screens/AnalysisScreen.js` | add an "Ask AI" button → `navigation.navigate("AiChat", { docId, title })` |
| `src/screens/UploadScreen.js` | replace the "Ask AI" coming-soon alert (~line 402) with the real navigation |

## Backend needed

Does not exist yet. Request these:

```
POST /api/documents/{id}/chat
  body:    { message: string, transactionId: string }
  returns: { answer: string, citations?: [{ text, page? }], messageId: string }

GET  /api/documents/{id}/chat
  returns: [{ id, role: "user"|"assistant", content, createdAt, citations? }]
```

Credit feature key: `document_ai_chat` — must be added to the backend feature-config
table so `getFeatureConfig("document_ai_chat")` resolves.

Build the client in `src/api/chat.js` against these signatures. Until the endpoints
land, keep a `const USE_STUB = true` flag at the top of that file that returns a
canned answer after a 900 ms delay, so the UI is reviewable immediately.

## Implementation notes

- Layout: `<GradientScreen>` → header (doc title + credit pill) → `FlatList`
  `inverted` for messages → input bar pinned above the keyboard with
  `KeyboardAvoidingView` (`behavior={Platform.OS === "ios" ? "padding" : undefined}`).
- Bubbles: user = `t.colors.primary` fill, right-aligned; assistant = `GlassCard`,
  left-aligned with a small `<AiOrb size={28} />` avatar (state `"idle"`).
- While waiting on the answer show an assistant bubble containing three dots
  animating on a staggered `Animated.loop` — respect `useReduceMotion()`.
- **Credits:** follow CONTEXT §3 exactly. Reserve *before* sending, complete on a
  non-empty answer, refund on error/empty. Show `Send · 1 credit` on the button
  when the free first message is used up.
- Suggestion chips on the empty state: "Summarize this", "What are the key dates?",
  "Explain in simple words". Tapping one sends it as a message.
- Long-press an assistant bubble → copy to clipboard (`expo-clipboard` is **not**
  installed — use `Share` from react-native, or add the dep and note it).
- Cap the input at 1000 chars with a counter past 800.

## Definition of done

- [ ] Sends and displays messages; history reloads on re-entry
- [ ] Charges exactly 1 credit per message, refunds on failure, never double-charges
- [ ] 402 → "Not enough credits" alert with a **View plans** → `Paywall` button
- [ ] Non-Plus user sees an upsell card, not a dead input
- [ ] `ai_chat` entry in `featureMatrix.ts` gains `creditFeatureKey: "document_ai_chat"`
- [ ] Keyboard never covers the input on iPhone SE or 15 Pro Max
- [ ] Verify commands from CONTEXT §9 pass

## Notes for other agents

_(append findings here — do not fix things outside this spec)_
