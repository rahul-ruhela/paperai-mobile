# 1.4 — Receipt → Expense

**Status:** TODO
**Branch:** `feat/receipt-expense`
**Tier gate:** `essential` (already declared as `receipt_extraction`)
**Credits:** 1 per receipt (reuses `image_ocr_extract_text` unless a dedicated key is added)
**Conflicts with:** 1.1 (both edit `UploadScreen.js`)

## Why

Receipt capture is the wedge into the freelancer/SMB segment (Tier 4.1) — the
audience most likely to actually pay a subscription. It also gives the credit
system an obvious, repeatable use: one receipt, one credit.

## User story

Snap a receipt → merchant, date, total, tax and category come back in a structured
card → user corrects anything wrong → it is saved to an expense list → export the
month as CSV for the accountant.

## Scope

**In:** capture/pick a receipt, extract structured fields, editable review card,
expense list with month grouping and totals, CSV export, category tagging.
**Out:** bank sync, multi-currency conversion, mileage, invoice generation (that is 4.1).

## Files to touch

| File | Change |
|---|---|
| `src/screens/ReceiptCaptureScreen.js` | **new** — capture → extract → review |
| `src/screens/ExpensesScreen.js` | **new** — the list, totals, export |
| `src/api/receipts.js` | **new** — API client |
| `src/services/expenseStore.js` | **new** — local persistence + CSV builder |
| `App.js` | register both screens |
| `src/screens/UploadScreen.js` | add a "Scan receipt" tile |

## Backend needed

Does not exist. Request:

```
POST /api/receipts/extract        (multipart: file, header X-Transaction-Id)
  returns: {
    merchant, dateUtc, total, currency, taxAmount,
    category, lineItems: [{ description, amount }],
    confidence: "HIGH"|"MEDIUM"|"LOW"
  }
```

Credit feature key: `receipt_extract`. Until it exists, reuse the existing OCR
endpoint and parse the returned text client-side behind a `USE_OCR_FALLBACK` flag
in `src/api/receipts.js`.

## Implementation notes

- Reuse the existing camera flow from `CameraDocumentScanScreen.js` rather than
  writing a new capture screen — pass a `mode: "receipt"` param.
- **Every extracted field must be editable.** OCR on a crumpled thermal receipt is
  wrong often enough that a read-only result feels broken. Show `LOW` confidence
  fields pre-highlighted in `t.colors.warningBg` so the user knows where to look.
- **Credits:** refund if extraction returns no merchant AND no total — that is a
  failed read, and charging for it is the exact mistake Junk Wiper used to make
  (see CONTEXT §3, rule 1).
- Categories: Travel, Meals, Office, Software, Fuel, Utilities, Other. Let the
  backend suggest one; the user can override with a chip row.
- Expense list: `SectionList` grouped by month, with a sticky header showing the
  month total. Show a running total for the current month at the top.
- CSV export via `expo-file-system` + `expo-sharing` (both installed):
  ```
  Date,Merchant,Category,Total,Tax,Currency,Notes
  ```
  Escape commas and quotes properly — accountants open this in Excel.
- Store the receipt image URI alongside the record so the user can re-check it.

## Definition of done

- [ ] Capture → structured fields in under ~6 s on a real device
- [ ] Every field editable; corrections persist
- [ ] Low-confidence fields visually flagged
- [ ] Exactly 1 credit per successful extraction; refunded on a failed read
- [ ] Expense list groups by month with correct totals
- [ ] CSV opens cleanly in Excel and Google Sheets, commas escaped
- [ ] Receipt image viewable from the list entry
- [ ] Verify commands from CONTEXT §9 pass

## Notes for other agents

_(append findings here)_
