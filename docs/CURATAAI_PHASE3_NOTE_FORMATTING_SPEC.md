# CurataAI Phase 3 — Note Formatting Specification

**Status:** Provider-neutral preparation started. The production feature remains disabled; no model/provider is configured.

This document defines the narrow first feature in a way that can be reviewed before any live inference is enabled. It is an engineering specification, not clinical approval.

## Authorized scope

CurataAI may only reorganize text that the clinician has already entered into the current encounter's four editable note sections:

- Subjective
- Objective
- Assessment
- Plan

The proposed output is an **editable, source-labeled draft** for the clinician to inspect. It is not a diagnosis, clinical summary, treatment recommendation, order, prescription, or saved note.

## Explicit exclusions

The formatter must not receive or use patient identity, encounter IDs, chart history, diagnoses, allergies, vitals, results, medications, orders, or other facility data. It must not add, infer, delete, or medically correct a fact. It must not save a note, change an encounter, or trigger another clinical action. The clinician remains responsible for reviewing and explicitly saving any note.

## Technical boundary implemented in this Phase 3 slice

- The backend exposes a provider interface and an adapter function that validate the existing strict four-section request and source-labeled response schemas.
- Unit tests call the adapter only with a clearly synthetic note and a local in-memory test double. They verify that extra request context is rejected before the provider is called and that malformed or misattributed output is rejected.
- The adapter is **not wired to an HTTP provider or the encounter route**. The route still fails closed; the default-off feature flag and unavailable UI remain unchanged.
- No integration test, demo fixture, or production path sends text to a model. No database schema or clinical workflow was changed.

## Required review experience before showing any real output

1. Keep the original note visible and unchanged while preparing a separate proposed draft.
2. Label the proposal as AI-formatted text derived only from clinician-entered text.
3. Let the clinician compare the original and proposed sections, then explicitly apply or discard the proposal.
4. Applying a proposal must only update the editable draft. It must not save the clinical note; the existing explicit save action remains separate.
5. Preserve an immediate way to undo/revert to the pre-format draft.
6. Never silently accept a proposal, auto-save it, or use it to trigger orders, prescriptions, diagnoses, or encounter completion.

The exact comparison and apply/revert interaction needs product-owner and clinician review before implementation.

## Decisions still needed before provider integration

- **Clinical lead:** Confirm which transformations count as formatting, whether text may move between SOAP sections, and how to preserve uncertainty, negation, chronology, quotations, abbreviations, and clinically meaningful wording.
- **Product owner:** Approve the preview, comparison, apply, discard, and revert interaction.
- **Privacy/security and facility authority:** Approve a specific provider and hosting arrangement, permitted data flow, retention/training terms, and facility authorization. This document does not select a vendor or grant that authority.
- **Evaluation owner:** Agree on an offline, synthetic-data evaluation set and thresholds, including zero tolerance for unsupported facts and a review process for errors.

## Next safe steps

1. Review this specification and the data-readiness inventory with a named clinical lead and product owner.
2. Resolve the transformation and review-UX decisions above.
3. Build synthetic-only evaluation cases and clinician review criteria.
4. Select and integrate a provider only after the data-processing and facility-authorization gate is explicitly cleared; keep the service disabled until the separate go/no-go review.

Until those decisions are recorded, the production API must remain provider-free, unavailable, and off by default.
