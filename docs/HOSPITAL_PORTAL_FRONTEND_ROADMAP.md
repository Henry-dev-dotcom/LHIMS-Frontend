# Hospital Clinician Portal — Frontend Roadmap and Handoff

**Updated:** 2026-10-12
**Scope:** Frontend-only work on `LHIMS-Frontend`. The backend repository, APIs, database schema, and deployed systems have not been changed.

## Executive status

The frontend implementation phases in this roadmap are complete. Existing hospital workflows were extended where the current API supports them; unsupported workflows remain visibly disabled rather than pretending to succeed. The remaining items are primarily backend data/API contracts, followed by frontend integration and clinical validation.

## Frontend phase status

| Phase | Status | Delivered |
|---|---|---|
| **A — Consultation editor** | Complete | A unified narrative editor is the default, with **Insert SOAP Structure**, optional structured SOAP fields, and reversible parsing/serialization into the existing four-field note contract. Existing templates and dictation remain available. A per-section 5,000-character guard prevents drafts the current API would reject. The existing ICD-10 diagnosis search now sits directly beneath the note editor. |
| **B — Queue and results presentation** | Complete for available API data | Pending-lab rows offer supported **Open**, **Add tests**, and **Force resume** actions. **Ping lab** is present but disabled and labelled as awaiting backend support. No critical/abnormal queue badge is fabricated because the queue payload does not currently provide result severity flags. |
| **C — Disposition coverage** | UI-only; awaiting backend | Short-stay observation and medical-excuse certificate options are visible but disabled. No unsupported outcome is saved and no official certificate is generated. Existing discharge, admission, referral, and death pathways are preserved. |
| **D — CurataAI presentation** | UI-only; unavailable | The three-area Predictive Autopilot shell is display-only. It receives no patient or note data, makes no provider request, shows no mock recommendation, and keeps review/auto-fill unavailable. This does not change the separate CurataAI backend approval gates. |
| **E — Consistency and verification** | Complete for frontend-only scope | Directory and inpatient surfaces were compared with the supplied brief. The consultation and queue journeys include phone/tablet overflow assertions at 390px and 768px. No unsupported clinical thresholds or inferred result severities were added. |

## Verified remaining gaps and backend handoff

These are not hidden behind mock data. They should be handled as explicit backend contracts before the corresponding UI is enabled.

| Work item | Current frontend boundary | Minimum backend/data decision needed |
|---|---|---|
| **Queue result priority** | Queue shows workflow state, outstanding tests, and result counts. Opened results can show their existing flags. No row-level abnormal/critical badge is inferred. | Return a stable per-result severity/priority field (and the associated test/result identifier and state). Agree whether the source is a validated result flag or a clinical rules service; do not make the client invent cutoffs. |
| **Lab messaging** | “Ping lab” remains disabled. | Define an authorized endpoint, recipient/routing behavior, delivery/result state, rate limits, and an audit event so the UI can show the actual outcome. |
| **Patient alert strip and longitudinal record** | The profile displays demographics/contact and insurance details, allergies, long-term conditions, ongoing medicines, visit history, visit notes/results, and documents. It does not yet present a consolidated cross-service timeline for pharmacy dispensing and emergency episodes. Blood group and emergency-contact fields should only be surfaced when verified fields are available. | Confirm/define the patient fields for blood group and emergency contacts, plus permitted longitudinal event types (e.g. encounters, diagnostics, dispensing, emergency episodes), access controls, and audit behavior. |
| **Ward rounds and flowsheet** | Generic daily SOAP rounds and “copy yesterday” are supported. Vitals appear as trends; fluid totals are grouped by day. The UI does not claim shift attribution or a rolling 24-hour total. | Decide how a round’s author/team category is represented; expose observation timestamp/recorder/shift if shift-based charting is required; provide a true rolling-window fluid total if 24-hour cards are required. Agree units and reference metadata for comparable biomarker trends. |
| **Observation disposition** | The option is visible but disabled. | Define the clinical meaning, required observation duration/monitoring fields, bed/workflow implications, authorization, and audit record. |
| **Medical-excuse certificate** | The option is visible but disabled; no certificate is generated. | Define the authorized template, who may issue it, source encounter/patient fields, issuance status, correction/revocation rules, and audit trail. |
| **Predictive Autopilot** | Inert, unavailable shell only. | Complete clinical/product/privacy approval and provider/data-flow decisions; establish the backend endpoint, access policy, audit/minimization behavior, response schema, clinician-review action, and disabled-by-default rollout. Keep it separate from any autonomous ordering or prescribing. |

## Verification record

- Production frontend build passed.
- Static checks passed: route registry, auth, UI polish, workflow integrity, PRD coverage, mobile hardening, and Tailwind classes.
- Focused clinician E2E: **7/7 passed** after the test fixture was corrected to use a browser-only hospital profile.
- The first full desktop E2E run reported **54/58 passed**. The four failures were three prescribing journeys and one queue journey; each landed on the permission guard because those older tests used the seeded clinic profile for a hospital-only clinician route. A shared E2E helper now overlays only the browser login response with a hospital facility profile; it does not modify the API fixture, database, or backend. The clinician queue/prescribing/workspace subset then passed **7/7**. The full 58-test suite has **not** been rerun after that test-fixture correction, so this record does not claim 58/58.
- `git diff --check` passed after the E2E helper changes.

## Repository state and next step

Work is isolated on `feat/hospital-clinician-portal-frontend`, based on `origin/main`. The backend worktree remains untouched. No changes have been deployed. The next dependency is to agree and implement the backend contracts in the handoff table; after those are available, the frontend can wire the disabled controls and validate each end-to-end workflow. Clinical review is still required before enabling any AI-generated clinical content.
