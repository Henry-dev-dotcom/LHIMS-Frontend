# Clinician Portal: build plan

Source of truth: the product spec ("CurataMed Healthcare Management System, Product &
Architecture Specifications") and the reference mock-up `gemini-code-1791749891647.html`.
This file is how that spec is built, in order, on top of what already exists.

## What already exists (so we extend it, not duplicate it)

| Spec item | Already in the system |
|---|---|
| Visit with triage, vitals, SOAP notes, ICD-10 diagnoses | `Encounter`, `VitalSigns`, `ClinicalNote` (subjective/objective/assessment/plan, append-only with amendments), `Diagnosis`; `EncounterWorkspace.jsx` |
| Lab / imaging orders from a visit | `POST /encounters/:id/orders`, `Order.encounterId` |
| Prescriptions with allergy checks and a formulary | `POST /encounters/:id/prescriptions`, `GET /encounters/formulary` |
| Admit to ward | `Admission`, `Ward`, `Bed`, `BedAssignment`, `inpatientService.admit` |
| Medication chart | `MedicationAdministration`, `inpatientService.administer` |
| Ward progress notes | `ClinicalNoteType.PROGRESS` |
| Patient timeline | `GET /patients/:id/timeline` |
| Visit statuses | `WAITING_TRIAGE`, `WAITING_DOCTOR`, `IN_CONSULTATION`, `COMPLETED`, `CANCELLED` |

## What is genuinely new

1. A visit can be **paused for results** and comes back as **Review Ready** by itself.
2. **Drafts** (Save Draft keeps half-written notes without making them permanent).
3. A single **four-tab consultation workspace** with dictation, templates, order sets,
   smart prescribing, and a routing bar.
4. A **Patients Directory** with deep search and a 360° record including a document vault.
5. A **ward whiteboard** and a four-tab **inpatient chart** (flowsheet with graphs and
   intake/output, rounds with "duplicate yesterday", time-blocked medication chart,
   orders and results).
6. A **quick-peek history sidebar** in both workspaces.

## Decisions that shape the build

* **No new visit statuses.** Six backend services decide "is this visit open" by its status,
  so adding statuses would touch all of them. Instead a visit gets one new timestamp,
  `suspendedAt`, and its queue bucket is *worked out when the queue is read*:
  * New Patients = `WAITING_DOCTOR`
  * In consultation = `IN_CONSULTATION`, not suspended
  * Pending Labs = suspended and at least one ordered test/scan not yet signed off
  * Review Ready = suspended and every ordered test/scan signed off
  Because it is derived, a lab withdrawing a result sends the patient back to Pending Labs
  with no extra code, and the lab and imaging flows are not touched.
* **Notes stay append-only.** Drafts live in their own table and become a real note only on
  save/send/complete.
* **Clinical suggestions are data, not code.** Order sets, templates and first-line drug
  suggestions live in one reviewable file, are labelled as starter content for the facility's
  clinical lead to approve, and only suggest drugs/tests that exist in that facility's own
  formulary and catalogue. The clinician always approves; nothing is added silently.
* **Other roles are untouched.** Nurses, reception, lab and the rest keep their current
  screens. Doctors get the new portal; the old pages stay reachable until the new ones are
  proven.
* **Shipping rhythm:** each phase is built on its own branch, tested (unit, integration, and
  a browser journey for anything with a screen), committed locally, and reported. Nothing
  reaches production until it is pushed, and nothing is pushed without a go-ahead.

## Phases

### Phase 1: Backend: paused visits, queue, drafts
* Migration: `Encounter.suspendedAt`, `EncounterDraft` table (with facility guards).
* `POST /encounters/:id/suspend` (needs at least one order), `POST /encounters/:id/resume`.
* `GET /encounters/queue`: the four buckets with counts, derived as above.
* `GET|PUT /encounters/:id/draft`.
* Tests: every transition, derivation (including a withdrawn result), permissions, tenancy.

### Phase 2: Clinician queue screen
* New doctor landing screen: three tabs with counts, glowing Review Ready badge, wait times,
  auto-refresh, open a patient into the workspace.

### Phase 3: Workspace shell, Consultation tab, Investigations tab
* Full-screen workspace, persistent patient header (vitals, allergies, demographics).
* Notes editor with voice dictation (browser Web Speech API) and templates; ICD-10 selector.
* Split-view investigations with history on the left, order builder with one-click bundles
  on the right. Quick-peek sidebar.

### Phase 4: Prescriptions tab, Disposition tab, routing bar
* Smart suggestions from the diagnosis; prescription builder.
* Discharge / admit / refer with follow-up text.
* Save Draft, Send to Lab & Suspend, Complete & Discharge.

### Phase 5: Patients Directory and 360° record
* Deep search (name, phone, date of birth, Ghana Card, NHIS), cohort filters.
* Health summary flags, encounter history, document vault (backend upload + list).

### Phase 6: Wards: whiteboard and inpatient chart
* Bed tiles with action dots; four-tab chart; intake/output model; duplicate-yesterday;
  time-blocked medication chart; transfer and discharge from the chart.

### Phase 7: Hardening
* Full browser journeys, accessibility, phone layout, role regression, docs.

#### Phase 7 verification — completed 2026-10-12

* **Full journeys:** the complete desktop Playwright suite passed **54/54**. This includes the clinician queue/workspace, reception, nurse, lab, scan, billing, pharmacy, directory, messaging, records, and ward-chart journeys. The ward-chart story covers admission, medication administration, fluids, rounds, results review, transfer and discharge controls.
* **Accessibility:** the ward-board hardening check verifies the page landmark, keyboard focus order, the mobile navigation accessible name, and keyboard-reachable controls. Existing screen-reader labels remain in place for bed tiles, medication dose slots, trend graphs, tabs, dialogs, alerts, skip link and mobile navigation.
* **Phone/tablet layout:** exact viewport checks passed at **375 × 844** and **768 × 1024** with no document-level horizontal overflow on the ward whiteboard. The medication chart keeps its deliberate horizontal table scroll at narrow widths rather than compressing dose columns into unreadable controls; the whiteboard tiles remain within the viewport.
* **Role regression:** all eight demo roles opened their permitted menu screens without crashes. Explicit direct-address checks passed: receptionist and billing are redirected away from `#/app/ward-board` to their own landing pages and do not see the Ward Board menu item. Doctor, nurse and admin ward access is covered by the ward journey and role suite.
* **Flaky test probe:** `scan.spec.js` and `ward-chart.spec.js` each passed twice consecutively in a late-run probe (**4/4**). The full 54-test desktop run also passed without reproducing the reported late-run failure.
* **Static QA:** route, auth, UI polish, workflow integrity, and all Phase 6–9 mobile hardening scripts passed. The durable checks live in `e2e/phase7-hardening.spec.js`; direct ward-board role refusal checks live in `e2e/roles.spec.js`.

#### Phase 7 hardening — second pass, 2026-10-14

Re-run against the current portal (worklist queue, department messaging, six-item doctor menu,
three-tab ward chart). Each check is a spec that runs with the suite.

* **Full journey** (`e2e/patient-journey.spec.js`): one patient through every hand-over, each
  person in their own browser session: the doctor sends her for a blood count and pauses the
  visit; the lab's sign-off brings her back; the doctor reviews and admits her from Finish visit;
  the nurse charts her fluids on the ward; the doctor discharges her and the bed goes for cleaning;
  the cashier finds the invoice for her ward nights.
* **Accessibility** (`e2e/accessibility.spec.js`, `@axe-core/playwright` 4.13.0): the queue, all
  three visit tabs, patients, ward board, all three ward-chart tabs, emergency, clinics and
  messages scanned against WCAG 2.1 A/AA in the light and the dark theme, with patients waiting
  at every triage colour. Serious or critical findings fail the test. Fixed to get there:
  * green action buttons were white on #059669 (3.8:1); the success colour is now #047857 (5.5:1);
  * the orange (2.8:1) and green (3.8:1) triage badges, and yellow became unreadable in the dark
    theme, which recolours slate text. Orange and yellow now use their own dark text and green is
    #047857: 5.6, 11.1 and 5.5:1;
  * the count on the test-bundle chips was faded below 4.5:1;
  * in the dark theme a hovered table row or list item turned pale under light text; every pale
    hover now has a dark equivalent.
* **Phone and tablet** (`e2e/clinician-layout.spec.js`): at 375 and 768 px every doctor screen -
  queue, each visit tab, the six menu items reached through the phone drawer, each ward-chart tab
  and a page under More - fits without the page scrolling sideways.
* **Role regression** (`e2e/clinician-access.spec.js`): nurse, reception, lab, scan, billing and
  pharmacy are sent back to their own landing page when they type the address of a clinical page
  they may not open; the server refuses them the queue, ward board and patient directory data.
  Nurses and reception may read the queue (it is a view of the visits they already work from) but
  are never sent the doctor's result flags - checked against a patient whose result is back.

## Out of scope unless asked
Speech recognition servers (dictation uses the browser's own), automatic billing rules beyond
what the existing visit-completion already does, and any change to other roles' screens.
