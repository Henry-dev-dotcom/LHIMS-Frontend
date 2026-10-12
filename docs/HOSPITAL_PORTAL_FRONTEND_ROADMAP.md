# Hospital Clinician Portal — Frontend Roadmap and Handoff

**Updated:** 2026-10-12
**Scope:** Frontend-focused work on `LHIMS-Frontend`, with paired backend contracts tracked separately. The queue result-priority and Ping Lab changes were merged and deployed on 2026-10-12.

## Executive status

The frontend implementation phases in this roadmap are complete. Supported queue workflows, result-priority cues, and Ping Lab are deployed; unsupported workflows remain visibly disabled rather than pretending to succeed. Remaining items are the other backend data/API contracts and the listed clinical/operational reviews.

## Frontend phase status

| Phase | Status | Delivered |
|---|---|---|
| **A — Consultation editor** | Complete | A unified narrative editor is the default, with **Insert SOAP Structure**, optional structured SOAP fields, and reversible parsing/serialization into the existing four-field note contract. Existing templates and dictation remain available. A per-section 5,000-character guard prevents drafts the current API would reject. The existing ICD-10 diagnosis search now sits directly beneath the note editor. |
| **B — Queue and results presentation** | Merged and deployed | Pending-lab rows offer **Open**, **Add tests**, **Force resume**, and an enabled **Ping lab** action only when an outstanding laboratory order exists. The backend sends a persistent in-app status request to active lab staff in the same facility; it does not use email/SMS or report a clinical result. Review Ready displays a critical/abnormal/normal badge only when the backend provides a summary of stored signed-off flags; incomplete, out-of-range, or non-lab results remain unclassified. The badge adds no client thresholds and does not reorder the queue. |
| **C — Disposition coverage** | UI-only; awaiting backend | Short-stay observation and medical-excuse certificate options are visible but disabled. No unsupported outcome is saved and no official certificate is generated. Existing discharge, admission, referral, and death pathways are preserved. |
| **D — CurataAI presentation** | UI-only; unavailable | The three-area Predictive Autopilot shell is display-only. It receives no patient or note data, makes no provider request, shows no mock recommendation, and keeps review/auto-fill unavailable. This does not change the separate CurataAI backend approval gates. |
| **E — Consistency and verification** | Complete for frontend-only scope | Directory and inpatient surfaces were compared with the supplied brief. Consultation, queue, patient-profile, and inpatient-chart journeys include phone/tablet overflow assertions at 390px and 768px; the ward board already has separate 375px/768px hardening checks. No unsupported clinical thresholds or inferred result severities were added. |

## Verified remaining gaps and backend handoff

These are not hidden behind mock data. Items marked deployed are live with the safeguards described; remaining unsupported workflows must stay disabled until their backend contracts and approvals are complete.

| Work item | Current frontend boundary | Minimum backend/data decision needed |
|---|---|---|
| **Queue result priority** | Review Ready displays a minimal summary from the latest signed-off lab flags: CRITICAL takes precedence over LOW/HIGH; NORMAL is shown only when all live completed items have normal flags; otherwise it is unclassified. Numeric results and raw flags are not added to the queue response, and queue ordering is unchanged. | Deployed in backend PR #31. A clinical owner still needs to validate the facility reference-range/flag provenance and confirm that this is a visual review cue only; no new threshold or automatic escalation is implemented. |
| **Lab messaging** | The UI calls `POST /encounters/:id/ping-lab`, shows the returned delivery state, and disables the action when no lab order is outstanding. | Deployed in backend PR #32: requires consultation permission, a paused visit and pending `LAB` order item; checks clinician ownership (or administrator role); routes only to active `LAB_STAFF` in the same facility; persists in-app delivery logs and audit events; and applies a five-minute per-clinician/visit cooldown serialized in the database. No external channels or patient/result text are sent. Hospital operations should review the deployed recipient role and cooldown and request changes if policy differs. |
| **Patient alert strip and longitudinal record** | The profile displays demographics/contact and insurance details, allergies, long-term conditions, ongoing medicines, visit history, visit notes/results, and documents. It does not yet present a consolidated cross-service timeline for pharmacy dispensing and emergency episodes. Blood group and emergency-contact fields should only be surfaced when verified fields are available. | Confirm/define the patient fields for blood group and emergency contacts, plus permitted longitudinal event types (e.g. encounters, diagnostics, dispensing, emergency episodes), access controls, and audit behavior. |
| **Ward rounds and flowsheet** | Generic daily SOAP rounds and “copy yesterday” are supported. Vitals appear as trends; fluid totals are grouped by day. The UI does not claim shift attribution or a rolling 24-hour total. | Decide how a round’s author/team category is represented; expose observation timestamp/recorder/shift if shift-based charting is required; provide a true rolling-window fluid total if 24-hour cards are required. Agree units and reference metadata for comparable biomarker trends. |
| **Observation disposition** | The option is visible but disabled. | Define the clinical meaning, required observation duration/monitoring fields, bed/workflow implications, authorization, and audit record. |
| **Medical-excuse certificate** | The option is visible but disabled; no certificate is generated. | Define the authorized template, who may issue it, source encounter/patient fields, issuance status, correction/revocation rules, and audit trail. |
| **Predictive Autopilot** | Inert, unavailable shell only. | Complete clinical/product/privacy approval and provider/data-flow decisions; establish the backend endpoint, access policy, audit/minimization behavior, response schema, clinician-review action, and disabled-by-default rollout. Keep it separate from any autonomous ordering or prescribing. |

## Verification record

- Production frontend build passed.
- Static checks passed: route registry, auth, UI polish, workflow integrity, PRD coverage, mobile hardening, and Tailwind classes.
- Focused clinician E2E: **7/7 passed** after the test fixture was corrected to use a browser-only hospital profile.
- The first full desktop E2E run reported **54/58 passed**. The four failures were three prescribing journeys and one queue journey; each landed on the permission guard because those older tests used the seeded clinic profile for a hospital-only clinician route. A shared E2E helper now overlays only the browser login response with a hospital facility profile; it does not modify the API fixture, database, or backend. The clinician queue/prescribing/workspace subset passed **7/7**, followed by a full desktop rerun with **58/58 passed** in 4.9 minutes.
- Added 390px/768px no-overflow and key-element visibility checks to the patient-profile and inpatient-chart journeys; the focused browser tests passed **3/3**, followed by a full desktop rerun with **58/58 passed** after those assertions.
- The critical-result badge browser check passed **2/2**. Frontend build, route/auth/UI/workflow/PRD/mobile/Tailwind checks passed after the badge change, followed by a full desktop rerun with **58/58 passed** in 5.0 minutes.
- Ping Lab verification: focused backend integration passed, including recipient scoping, delivery log/audit creation, cross-facility rejection, unauthorized-role rejection, and concurrent cooldown serialization; focused clinician queue/workspace journeys passed **2/2 each**. After updating the former disabled-state expectation, the full desktop Playwright regression passed **58/58**.
- Production verification: backend PRs #31 and #32 each completed their Render deployment; `/api/ready` returned HTTP 200 with the database connected, and an unauthenticated Ping Lab request returned HTTP 401 as expected. Both the GitHub Pages and Vercel production bundles contain the Ping Lab UI.
- `git diff --check` passed after the latest frontend edits.

## Repository state and next step

Frontend PR #32 and backend PRs #31–32 were merged on 2026-10-12. The UI is live at [GitHub Pages](https://henry-dev-dotcom.github.io/LHIMS-Frontend/) and [Vercel](https://lhims-frontend.vercel.app/); the API is live on [Render](https://diagnosis-center-backend.onrender.com/api/ready). Remaining items are the patient timeline, ward-round categorization/timestamps, observation/certificate contracts, and clinical approval for AI-generated content. Clinical review of result-flag provenance and operations review of the deployed lab recipient role/cooldown also remain open.
