# 1.3 — Signature & Fill

**Status:** DONE — shipped zero-dependency (no react-native-svg). Pad draws with rotated views; export uses inline SVG path in expo-print HTML.
**Branch:** `feat/signature-fill`
**Tier gate:** `free` (already declared as `signature_editor`, `onDevice: true`)
**Credits:** free — 100% on-device, costs you nothing to run
**Conflicts with:** none

## Why

Signing a PDF on the phone is the #1 reason people keep a document app installed
after they stop needing the AI. It is pure retention, it runs entirely on-device,
and it is already listed as a free feature in your matrix — so it must exist.

## User story

Open a document → **Sign** → draw a signature with a finger → drag/resize it onto
the page → optionally drop text boxes on form fields → **Save & Share** as a PDF.

## Scope

**In:** finger-drawn signature capture, saved signature reuse, place/drag/resize a
signature on a page, add plain text boxes, export to PDF, share.
**Out:** legally-binding e-signature certificates, multi-party signing, audit trails.
Say "signature image", never "legally binding", in all copy.

## Files to touch

| File | Change |
|---|---|
| `src/screens/SignatureScreen.js` | **new** — the draw/place editor |
| `src/ui/SignaturePad.js` | **new** — reusable draw surface |
| `src/services/signatureStore.js` | **new** — persist saved signatures |
| `App.js` | register `<Stack.Screen name="Signature" …/>` |
| `src/screens/DocumentDetailScreen.js` | add a **Sign** action |
| `src/screens/UploadScreen.js` | add a "Sign a document" tile |

## Backend needed

**None.** Fully on-device. If you later want signed docs synced, reuse the existing
`/api/documents/upload` multipart endpoint.

## Implementation notes

- **Drawing surface:** `react-native-svg` is **not** installed. Two options —
  pick one and note the choice in your handoff:
  1. Add `react-native-svg` (Expo-supported, ~small) and build the pad with an
     SVG `<Path>` fed by `PanResponder` points. **Recommended** — cleanest export.
  2. Zero-dependency: absolutely-positioned small `<View>` dots along the touch
     path. Works, but exports poorly. Only if adding a dep is blocked.
- Capture the pad as an image with `react-native-view-shot` (**not installed**) or
  by rendering the SVG path directly into the export HTML — prefer the latter to
  avoid a second dependency.
- **Export:** `expo-print` is already installed.
  ```js
  import * as Print from "expo-print";
  import * as Sharing from "expo-sharing";
  const { uri } = await Print.printToFileAsync({ html });   // page img + signature img, absolutely positioned
  await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
  ```
  Build the HTML with the page as a background image and the signature as a
  positioned `<img src="data:image/png;base64,…">`.
- Persist up to 3 saved signatures as base64 in secure store; show them as
  reusable chips so signing is one tap on repeat use.
- Placement: `PanResponder` for drag, two-finger pinch or corner handles for resize.
  Clamp inside the page bounds.
- Landscape/portrait: lock the editor to portrait to avoid re-layout maths.

## Definition of done

- [ ] Finger drawing feels smooth (no dropped points at speed)
- [ ] Undo / Clear on the pad
- [ ] Saved signatures persist across app restarts and are reusable in one tap
- [ ] Signature can be dragged and resized over the page, and stays where placed
- [ ] Text boxes can be added, edited and positioned
- [ ] Export produces a valid PDF that opens correctly in Files and Mail
- [ ] Share sheet works on a real device
- [ ] No credits charged anywhere
- [ ] Copy never claims legal validity
- [ ] Verify commands from CONTEXT §9 pass

## Notes for other agents

_(append findings here)_
