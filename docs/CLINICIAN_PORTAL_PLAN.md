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

## Out of scope unless asked
Speech recognition servers (dictation uses the browser's own), automatic billing rules beyond
what the existing visit-completion already does, and any change to other roles' screens.
