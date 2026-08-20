# Tier 4 — Vertical packs

## Read this before building any of them

"Document AI" cannot be advertised. There is no ad copy, no App Store subtitle and
no influencer pitch for a generic tool — which is exactly why generic document apps
struggle to acquire users. A vertical pack gives you a **specific person to talk to**,
and everything downstream (screenshots, keywords, ad targeting, pricing) gets easier.

**Build ONE. Ship it. Measure 30-day retention. Only then consider a second.**
Building all four is how you end up with four half-features and no audience.

Each pack is a themed bundle of screens plus onboarding that asks "what do you do?"
and sets a default home layout. Assign a whole pack to one agent.

---

## 4.1 — Freelancer / SMB ← RECOMMENDED

**Branch:** `feat/pack-freelancer` · **Tier:** plus/advance

**Why this one:** they already pay for tools, they have a business reason to expense
the subscription, and your credit model maps cleanly onto their monthly rhythm
(receipts, invoices, quarterly tax). Highest revenue per install of the four.

Features:
- **Invoice generator** — client details, line items, tax, logo → PDF via
  `expo-print`, then share. Depends on 3.1's PDF work.
- **Expense reports** — builds on 1.4. Group receipts into a date-ranged report,
  export as PDF + CSV.
- **Tax categorisation** — map expenses to deductible categories; GST/VAT fields.
- **Client folders** — depends on 5.6 (folders). Documents grouped per client with
  a per-client total.
- **Quote → Invoice** conversion in one tap.

Backend: invoice numbering sequence per user, client CRUD, report generation.
**Done when:** a freelancer can capture 20 receipts, produce a quarterly expense
PDF and send an invoice — without leaving the app.

---

## 4.2 — Students

**Branch:** `feat/pack-students` · **Tier:** essential/plus

**Why:** huge volume, viral word-of-mouth, but low willingness to pay and brutal
seasonality (dead all summer). Great for downloads, weak for revenue.

Features:
- **Notes → flashcards** — AI generates Q/A pairs from lecture notes; swipeable
  card UI with spaced repetition.
- **Quiz generator** — MCQs from a document, with scoring.
- **Study summary** — condense a chapter into key points.
- **Citation extractor** — pull references, format APA/MLA/Chicago.
- **Lecture recording** — depends on 3.11.

Backend: `POST /api/documents/{id}/flashcards`, `/quiz`, `/citations`.
**Done when:** a textbook chapter produces usable flashcards and a working quiz.

---

## 4.3 — Families

**Branch:** `feat/pack-families` · **Tier:** essential/advance

**Why:** the best retention of the four — an insurance vault is checked for years —
but the hardest to acquire, because nobody searches for "family document app".

Features:
- **Warranty & insurance vault** — document + expiry date + auto-reminder
  (depends on 1.2). This alone is the pack.
- **Medical records organiser** — per family member, chronological.
- **Prescription reader** — decode medication names and dosages. **Add a clear
  "not medical advice, verify with your pharmacist" disclaimer** — this is a
  safety issue and an App Review issue.
- **Shared family access** — depends on 5.9.
- **Document expiry dashboard** — passports, licences, insurance, all in one view.

Backend: family group membership, per-member document scoping.
**Done when:** an expiring warranty produces a timely reminder months later.

---

## 4.4 — Legal / HR

**Branch:** `feat/pack-legal` · **Tier:** advance

**Why:** highest price tolerance, but the highest liability. Every output needs a
"not legal advice" disclaimer, and a wrong risk flag is a real-world problem.

Features:
- **Contract risk flags** — highlight unusual/unfavourable clauses.
- **Clause explainer** — plain-English translation of legalese.
- **Obligation calendar** — extract deadlines into reminders (depends on 1.2).
- **Contract comparison** — depends on 3.4.
- **Signature workflow** — depends on 1.3.

Backend: clause classification model, risk scoring.
**Done when:** a real contract's risky clauses are flagged accurately — and every
screen carries the disclaimer.
