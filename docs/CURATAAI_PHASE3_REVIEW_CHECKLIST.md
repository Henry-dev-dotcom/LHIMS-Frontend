# CurataAI Phase 3 — Clinical and Product Review Checklist

**Status: PENDING.** This checklist is a review aid, not an approval or authorization. Do not connect a provider, enable inference, or use real-patient notes until the required owners complete the relevant sections and required facility/privacy approvals are recorded.

## Review participants

- Clinical lead (name, role, facility): ______________________________
- Product owner (name, role): ______________________________________
- Privacy/security reviewer (name, role): ___________________________
- Evaluation owner (name, role): ___________________________________
- Review date: __________________

## A. Clinical scope and transformation rules — clinical lead

- [ ] Confirm the task is limited to reorganizing clinician-entered text in the existing Subjective / Objective / Assessment / Plan fields.
- [ ] Decide whether any punctuation, spelling, grammar, abbreviation, or expansion changes are allowed; specify each allowed change.
- [ ] Decide whether text may move between SOAP sections. Default until explicitly approved: **do not move text between sections**.
- [ ] Define how to preserve uncertainty, negation, chronology, quotations, units, and clinically meaningful wording.
- [ ] Confirm the formatter must not add, infer, delete, or medically correct facts.
- [ ] Confirm the output is advisory and that the clinician remains responsible for review and the clinical record.
- Notes / restrictions: __________________________________________________

## B. Review and persistence behavior — product owner + clinical lead

- [ ] Approve a preview that leaves the current note draft unchanged until the clinician explicitly applies the proposal.
- [ ] Approve how the clinician compares original and proposed text, and can discard or revert it.
- [ ] Confirm no proposal is silently accepted, automatically saved as a clinical note, or used for another action.
- [ ] Review the existing draft behavior before approving persistence: editing a draft schedules a private encounter-draft save after approximately 1.2 seconds. The permanent clinical note is a separate action (`Save note to the record`). Decide whether an applied proposal may enter that existing autosaved draft, and confirm the preview itself is not persisted before explicit application.
- Notes / restrictions: __________________________________________________

## C. Data-processing and facility authority — privacy/security + facility authority

- [ ] Select and approve a specific provider and hosting arrangement; do not infer approval from this checklist.
- [ ] Record the exact fields sent, data location, retention/deletion terms, training-use terms, access controls, and facility authorization.
- [ ] Confirm the provider receives only the approved clinician-entered text and no identity, encounter ID, chart history, diagnoses, allergies, vitals, results, medications, or orders.
- [ ] Approve a disable/rollback path and incident process.
- Records / contract references: _________________________________________

## D. Offline synthetic evaluation — evaluation owner + clinical lead

- [ ] Approve the synthetic evaluation set and review protocol; no real patient data is included in the current test fixtures.
- [ ] Set measurable acceptance thresholds and define what counts as an unsupported fact, omission, meaning change, or unsafe reclassification.
- [ ] Set stop criteria and how errors will be logged without retaining note text unnecessarily.
- [ ] Require human review of representative outputs before any shadow or pilot stage.
- Thresholds / stop criteria: ___________________________________________

## Decision

- [ ] **Not approved yet** — keep production API unavailable and feature flag off.
- [ ] **Approved only for additional synthetic testing** — specify limits: __________________________
- [ ] **Approved to prepare a provider integration** — attach separate data-processing/facility approval; this does not itself enable inference.

Required sign-offs and dates: __________________________________________
