# Tier 3 — Document power features

Converts casual users into business users. **Each section below is independently
assignable** — give an agent `CONTEXT.md` + "implement section 3.5 of
`docs/roadmap/tier-3-document-power.md`".

Shared rules for every feature here:
- Follow the credit flow in CONTEXT §3 — **refund when the output is empty**.
- Add the feature key to `featureMatrix.ts`, mirror it in backend `FeatureMatrix.cs`.
- Register the route in `App.js`, add an entry tile in `UploadScreen.js`.
- Handle loading / empty / error via `src/ui/states.js`.

---

## 3.1 — PDF Toolkit · free · `pdf_toolkit`

**Branch:** `feat/pdf-toolkit` · **Tier:** free

Merge, split, reorder, rotate, compress, password-protect, watermark.

- **Why free:** it is the reason people open the app on a day they have no AI need.
  Daily use is what makes a subscription feel worth keeping.
- Files: `src/screens/PdfToolkitScreen.js`, `src/services/pdfOps.js`.
- `expo-print` (installed) can *produce* PDFs but not edit them. Merge/split needs
  `pdf-lib` (pure JS, works in RN with a base64 polyfill — **add it**).
- Compress: rasterise pages at reduced quality via `expo-image-manipulator`, then
  rebuild. Show a before/after size comparison — that is the satisfying part.
- Password protection: `pdf-lib` encryption. Warn that a lost password is unrecoverable.
- Backend: none. Fully on-device.
- **Done when:** each of the 7 operations produces a valid PDF that opens in Files,
  Mail and Adobe Reader, and the share sheet works on a real device.

---

## 3.2 — Batch multi-page scan + edge detection · free · `batch_scan`

**Branch:** `feat/batch-scan` · **Tier:** free

Scan many pages in one session, auto-crop to the document edges, correct perspective.

- Files: extend `src/screens/CameraDocumentScanScreen.js` with a `batch` mode +
  `src/screens/BatchReviewScreen.js`.
- Capture loop: shoot → thumbnail appears in a bottom strip → shoot again. Review
  screen allows reorder (drag), rotate, retake, delete, then "Save as PDF".
- Edge detection: no RN library does this well without native code. Ship
  **manual four-corner adjustment** (draggable corner handles over the preview)
  with a sensible default inset — it is honest and works. Auto-detect is a v2 that
  needs a native module (`react-native-document-scanner-plugin` / VisionCamera).
- Perspective correction from four corners is a homography transform; if that is
  too heavy, ship crop + rotate only and say so.
- Backend: none, unless the batch is uploaded — then reuse `/api/documents/upload`.
- **Done when:** a 10-page batch produces one correctly-ordered PDF.

---

## 3.3 — Translate document · 1 credit · `translate_document`

**Branch:** `feat/translate` · **Tier:** essential

Translate an analysed document into another language.

- **Why it matters:** this is what opens non-English markets. Cheap to build,
  disproportionate reach.
- Files: `src/screens/TranslateScreen.js`, `src/api/translate.js`.
- Backend needed: `POST /api/documents/{id}/translate { targetLang, transactionId }`
  → `{ translatedText, detectedSourceLang }`.
- UI: language picker (top 15 languages + search), side-by-side or toggled view,
  copy + share the result.
- Refund if the translated text comes back empty or identical to the source.
- **Done when:** translation round-trips correctly for a right-to-left language
  (Arabic/Hebrew) — check text alignment, not just content.

---

## 3.4 — Compare two documents · 2 credits · `compare_documents`

**Branch:** `feat/compare-docs` · **Tier:** plus

Diff two versions of a contract and explain what changed in plain language.

- Files: `src/screens/CompareScreen.js`, `src/api/compare.js`.
- Backend needed: `POST /api/documents/compare { docIdA, docIdB, transactionId }`
  → `{ summary, changes: [{ type: "added"|"removed"|"modified", section, before, after, significance }] }`.
- UI: document picker for both sides, then a change list colour-coded with
  `t.colors.successBg` / `dangerBg` / `warningBg`. Lead with the plain-English
  summary — the raw diff is secondary.
- Sort changes by `significance`; "the payment terms changed" must not be buried
  under whitespace edits.
- **Done when:** two versions of a real contract produce an accurate, ranked change list.

---

## 3.5 — Redact sensitive info · 1 credit · `redact_document`

**Branch:** `feat/redact` · **Tier:** essential

Auto-detect and black out Aadhaar / SSN / card / passport / phone / email.

- **Why it matters:** privacy is a *marketing* feature. "Share your documents
  safely" sells better than any AI claim.
- Files: `src/screens/RedactScreen.js`, `src/services/piiDetect.js`.
- Detection can be client-side regex (Aadhaar `\d{4}\s?\d{4}\s?\d{4}`, SSN
  `\d{3}-\d{2}-\d{4}`, card via Luhn, email, phone) over existing OCR text, or a
  backend endpoint if you want ML-grade recall. Start client-side.
- **The redaction must be destructive** — burn black rectangles into a re-rendered
  image, never overlay a CSS box over selectable text. A "redaction" you can copy
  out from is a security incident. State this in the code comments.
- User reviews every detection before applying; allow manual box-drawing too.
- **Done when:** the exported file has no recoverable text under the black boxes
  (verify by opening it and trying to select/copy).

---

## 3.6 — Handwriting → text · 2 credits · `handwriting_ocr`

**Branch:** `feat/handwriting` · **Tier:** plus

- Files: extend `UploadScreen.js` OCR flow with a `handwriting: true` mode, or
  `src/screens/HandwritingScreen.js`.
- Backend needed: `POST /api/ocr/handwriting` (multipart + `X-Transaction-Id`)
  → `{ text, confidence }`. Standard OCR models do poorly on cursive; the backend
  needs a model that handles it.
- Show `confidence` prominently and make the result fully editable — handwriting
  OCR is wrong often enough that a read-only result destroys trust.
- Refund on empty or `LOW`-confidence-with-no-text results.
- **Done when:** a page of real cursive returns usable, editable text.

---

## 3.7 — Table → Excel / CSV · 2 credits · `table_extract`

**Branch:** `feat/table-extract` · **Tier:** plus

- **Why it matters:** accountants and analysts pay real money for this. It is the
  highest willingness-to-pay item in this tier.
- Files: `src/screens/TableExtractScreen.js`, `src/api/tables.js`.
- Backend needed: `POST /api/documents/{id}/tables { transactionId }`
  → `{ tables: [{ headers: [], rows: [[]] }] }`.
- UI: horizontally-scrollable table preview (inside `overflow` scroll — never let
  the page scroll sideways), cell editing, then export CSV via
  `expo-file-system` + `expo-sharing`.
- Multiple tables per document → a tab per table.
- Escape commas/quotes/newlines in CSV correctly.
- **Done when:** a scanned bank statement exports a CSV that opens cleanly in Excel.

---

## 3.8 — Ask across ALL documents · 2 credits · `cross_document_search`

**Branch:** `feat/cross-doc-search` · **Tier:** advance

**This is your moat.** Nobody in the scanner-app category does semantic search
across a personal document library. Prioritise it over most of this tier.

- User asks *"How much did I spend on insurance last year?"* and gets an answer
  synthesised from every document they own, with citations.
- Files: `src/screens/AskAllScreen.js`, `src/api/search.js`.
- Backend needed — this is real work, flag it early:
  - Embedding generation on document processing (store vectors)
  - `POST /api/search/semantic { query, transactionId }`
    → `{ answer, sources: [{ docId, title, excerpt, relevance }] }`
- UI: a search-first screen. Answer at the top, source document cards beneath,
  each tappable through to the document. Reuse the chat bubble styling from 1.1.
- Empty library → explain what this does and prompt to upload, don't just show nothing.
- Refund when no sources are found.
- **Done when:** a question answerable only by combining two documents is answered
  correctly with both cited.

---

## 3.9 — Form auto-fill · 2 credits · `form_autofill`

**Branch:** `feat/form-autofill` · **Tier:** plus

Read a blank form, ask the user only for the fields it cannot infer, output a filled PDF.

- Files: `src/screens/FormFillScreen.js`.
- Backend needed: `POST /api/documents/{id}/form-fields { transactionId }`
  → `{ fields: [{ label, type, required, boundingBox, suggestedValue }] }`.
- Pre-fill from the user's profile (name, email, phone) where the label matches.
- Render a normal form UI from the detected fields, then composite the answers onto
  the page and export via `expo-print`. **Depends on 1.3's placement code** — reuse
  `SignatureScreen`'s positioning logic rather than duplicating it.
- **Done when:** a real government form comes out correctly filled and printable.

---

## 3.10 — Business card → contact · 1 credit · `business_card_scan`

**Branch:** `feat/business-card` · **Tier:** essential

- Files: `src/screens/BusinessCardScreen.js`.
- Reuse the OCR endpoint; parse name/title/company/phone/email/website/address.
- Save straight to the device address book — `expo-contacts` is **not installed**;
  add it, or fall back to a vCard file shared via `expo-sharing`.
- All fields editable before saving.
- Refund if no phone AND no email is found — that is a failed read.
- **Done when:** a scanned card appears correctly in the device Contacts app.

---

## 3.11 — Voice note → transcript → summary · 2 credits · `voice_transcribe`

**Branch:** `feat/voice-notes` · **Tier:** plus

- Records a meeting/lecture, transcribes it, summarises it, extracts action items
  into Tasks (reuse the existing `/api/tasks` endpoints).
- Files: `src/screens/VoiceNoteScreen.js`, `src/api/voice.js`.
- Recording needs `expo-audio` (**not installed** — add it).
- Backend needed: `POST /api/voice/transcribe` (multipart audio + `X-Transaction-Id`)
  → `{ transcript, summary, actionItems: [], speakers?: [] }`.
- Show a live waveform or at minimum an elapsed timer while recording — silence
  with no feedback reads as broken.
- Warn at 30 minutes; long uploads need a progress indicator and a resumable path.
- **Done when:** a 10-minute recording transcribes and its action items land in Tasks.
