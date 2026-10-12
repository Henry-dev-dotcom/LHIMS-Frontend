# CurataAI Implementation Roadmap

**Purpose:** Add clinician-assistive AI to the existing clinician portal in small, testable steps. This roadmap is for planning and engineering; it is not clinical approval.

## One-sentence product rule

**CurataAI may prepare suggestions for a clinician to review; it must never independently diagnose, save a clinical note, order a test, prescribe a medicine, or complete a visit.**

## What we found in the current codebase

- The clinician queue and four-tab consultation workspace already exist.
- The backend already enforces facility isolation and permissions, logs clinical activity, keeps clinical notes append-only, and checks recorded allergies when a prescription is issued.
- Some editable, catalogue-aware order and prescription suggestions already exist as reviewed starter content.
- CurataAI itself is not implemented in either repository.
- The inspected prescription model includes free-text medication details and an optional local drug ID. Complete RxNorm/LOINC mappings and a comprehensive medication-safety knowledge source have not yet been established.

**Implementation consequence:** CurataAI should extend the existing portal/backend. The Node/Express backend remains the only service allowed to read clinical context and process clinical writes. A Python model service may be added later for inference only; it must not connect directly to the clinical database.

## Safety rules for every phase

1. AI output is visibly labeled and editable until the clinician accepts it.
2. No AI output is saved or acted on without a separate, explicit clinician action.
3. Existing backend permissions, tenant isolation, audit, allergy checks, and write validations remain authoritative.
4. Missing or stale patient data is shown as unknown, never assumed normal.
5. No patient data is sent to a model provider or used for model training until privacy, facility authorization, hosting, retention, and contract reviews are complete.
6. Models, prompts, terminology maps, and safety rules are versioned; there is a disable/rollback switch.

## Staged plan

| Stage | What we do | Deliverable | Gate to continue |
|---|---|---|---|
| **0. Scope and guardrails — started** | Agree that the first version is assistive, not autonomous. Record excluded features and safety rules. | This roadmap; a maintained decision log. | Product owner accepts scope. A clinical lead is identified before real-patient evaluation. |
| **1. Data readiness — technical inventory complete** | Inventory the actual encounter inputs and terminology/catalogue coverage: diagnoses, vitals, allergies, results, medications, local drug/test IDs, and timestamps. Identify missing or free-text fields. | [Data dictionary and mapping-gap list](./CURATAAI_DATA_READINESS.md); minimum-context specification for AI. | Clinical lead reviews which inputs are trustworthy and which are not suitable for suggestions. No unresolved cross-facility data path. **Clinical review remains pending.** |
| **2. Safe integration foundation — verified, disabled** | Add a feature flag (off by default), a permission-checked backend contract, strict request/response validation, metadata-only audit events, and a fail-closed stub. No model call and no clinical writes. | Backend status/request endpoints and frontend disabled state; tenancy and authorization tests. | Feature-specific integration/security and clinician browser workflow tests pass. The foundation remains disabled and has no provider. **Stage 2 is complete for this fail-closed foundation only.** |
| **3. First narrow feature — synthetic-only preparation complete; live feature gated** | Add one low-risk task: reorganize text the clinician already entered into an editable note draft. Do not infer a diagnosis, finding, test, or drug. | [Phase 3 specification](./CURATAAI_PHASE3_NOTE_FORMATTING_SPEC.md), strict provider adapter boundary, synthetic contract tests; the source-labeled reviewable draft remains future work. | Clinical/product review approves the transformation and review UX; offline evaluation meets agreed thresholds; separate privacy/facility approval before any provider integration. |
| **4. Offline and shadow evaluation** | Test on synthetic/de-identified authorized cases. Then, only with required approvals, compare suggestions in shadow mode without showing them to clinicians or using them for care. | Evaluation results, error taxonomy, subgroup checks, privacy checks, and a go/no-go recommendation. | Clinical lead and product owner sign off on a narrow pilot; stop criteria are met. |
| **5. Small supervised pilot** | Enable the note-drafting task for a small, approved group. Collect accept/edit/reject feedback. Keep prescriptions and orders outside the AI scope. | Monitored pilot with an immediate disable path. | No critical safety/privacy issue; quality and usability meet agreed targets over the review period. |
| **6. Separate order/Rx proposals (later)** | Consider test and medication suggestions only as independent features, using reviewed mappings, local catalogue/formulary items, and an approved clinical knowledge source. | Feature-specific evidence, rules, UI, and clinical approval for each capability. | Each feature passes its own evaluation and authorization gate. Passing note-drafting evaluation does not qualify order or medication prediction. |
| **7. Controlled maintenance** | Monitor quality, incidents, latency, drift, user feedback, and changes to models/rules. Re-evaluate material updates. | Versioned release notes, monitoring, incident response, rollback procedure. | Continued clinical and security approval. |

## What we will not build first

- The proposed generic `>85%` confidence trigger.
- Clinician-specific fine-tuning on historical notes.
- Automatic diagnosis, triage, critical-value classification, medication dosing, test ordering, prescription issuance, or completion of encounters.
- A separate AI API that bypasses the existing backend’s authentication, tenancy, or audit controls.

These may be reconsidered only as separate, evidence-backed product decisions. A confidence score is not a safety guarantee.

## How we will execute

- Work on a dedicated branch per stage; keep changes small and reviewable.
- For every code stage, run relevant unit/integration tests and the appropriate browser workflow tests.
- Record decisions, test results, and remaining risks in this document or linked stage notes.
- Commit locally after a stage passes. Do not push or deploy without explicit approval.
- Stop at a gate if a clinical owner, data permission, reliable mapping, or validation evidence is missing; do not replace that missing decision with a technical guess.

## Current status and next action

**Stage 2 disabled foundation is implemented and verified. The safe, synthetic-only Phase 3 preparation slice is complete.** Stage 1 clinical validation is still pending. The user confirmed the first capability should only reformat clinician-entered note text and authorized the disabled foundation. That authorization does not enable a provider, real-patient inference, or a clinical pilot. Live provider integration and a clinician-facing AI draft remain gated on clinical/product review, data-processing approval, and evaluation criteria.


## Progress log — 2026-10-12

- Created a read-only technical inventory in [`CURATAAI_DATA_READINESS.md`](./CURATAAI_DATA_READINESS.md).
- **Stage 1 technical inspection:** complete. **Stage 1 gate:** still pending clinical-lead and product-owner decisions listed in that report.
- No AI service, model call, external patient-data transfer, or care-workflow change has been implemented.
- User confirmed a narrow note-formatting scope and authorized Stage 2 plumbing only; no provider or clinical pilot was authorized.
- Implemented the false-by-default backend flag, encounter-scoped permission checks, SOAP-only strict schemas, a status/request contract, metadata-only audit events, and a frontend disabled state. The request endpoint always fails closed; no provider code or clinical writes exist.
- **Checks passed:** backend typecheck/build and 202 unit tests; frontend build plus route/auth checks.
- **Checks passed:** on sandbox-local disposable databases, encounter integration plus route-security suites passed (17 tests), and the clinician workspace Playwright journey passed (1 test). The browser test uses a test-only hospital profile because the shared demo seed deliberately represents a clinic/diagnostic centre; backend fixture data was not altered.
- `npm run check:foundation` still stops at existing Stage 10 package/OpenAPI/README metadata checks unrelated to this branch. Backend lint has no errors but reports 11 warnings in unrelated modules.
- Stage 2 is complete for the **disabled foundation only**. No provider, inference call, external patient-data transfer, or clinical write exists. Both Phase 2 repositories are committed locally (`fae9509` backend; `665ee4c` frontend); nothing has been pushed or deployed.
- Started Phase 3 on a separate `feat/curataai-phase3-note-formatting` branch in each repository. Added a provider-neutral, strict-schema adapter boundary and synthetic-only contract tests; the production route remains fail-closed and the UI remains unavailable.
- **Phase 3 preparation checks passed:** all 205 backend unit tests, TypeScript typecheck, and build. Lint reports 11 warnings in unrelated files and no errors. No live provider or real patient note was used.
