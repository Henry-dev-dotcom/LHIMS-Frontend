# CurataAI Stage 1 — Data Readiness Inventory

**Status:** Technical inventory complete; clinical validation pending.
**Method:** Read-only inspection of the existing frontend and backend source/schema. No application code or patient data was changed or queried.

## What the system already stores

| Area | Current evidence | What this means for CurataAI |
|---|---|---|
| Encounter context | Encounters connect patients, clinician, vitals, notes, diagnoses, prescriptions, orders, and drafts. | The existing encounter is the correct authorization and context boundary. Build context from it, not by broad patient searches. |
| Patient details | Demographics include date of birth and gender; the chart also stores phone, national ID, emergency contact, and free-text allergy/condition notes. | Only include clinically necessary fields. Names, phone, national ID, emergency contact, and billing/insurance details should not go to an inference provider for a note-reformatting task. |
| Vitals | Encounter vitals include temperature, pulse, respiratory rate, blood pressure, SpO₂, weight, height, pain score, and glucose, with recording time and staff attribution. | Values have useful timestamps, but any generated context must retain units/time and surface absent/stale values. |
| Diagnoses | Diagnosis code is optional; description is required. ICD-10 search exists. | Do not assume every diagnosis is coded. Never infer or silently add a diagnosis; use clinician-entered diagnosis only for any later suggestion feature. |
| Notes | Clinical notes are append-only and attributable to an author. Encounter drafts are already separate from permanent notes. | Keep AI text in a draft until explicit clinician acceptance. Do not overwrite or silently commit the permanent record. |
| Results | Lab results carry status and result parameters; parameters can include value, unit, reference range, and flags. Catalog reference ranges support age/gender and critical bounds. Clinical history returns signed-off results rather than drafts. | Any use must preserve result status, source, unit, range, and timestamp. Do not let the model classify critical values; use validated LIS/result flags and existing escalation workflow. |
| Tests and scans | Tests are facility-specific `CatalogItem`s with local code/name; orders point to catalog items. Catalog parameters and ranges are available. | A local catalogue is a useful first constraint. Do not have AI invent test names or codes. A standard LOINC mapping was not found in the inspected schema. |
| Medicines | Facility-specific `Drug` records hold local drug code, generic/brand name, strength, and form. Prescription items still support free text; `drugId` is optional. | The facility formulary/catalogue must remain authoritative. A standard RxNorm code field/mapping was not found in the inspected schema. Avoid AI-generated drug/dose suggestions until mapping and governance are addressed. |
| Allergies | Active allergy entries include substance, reaction, and severity; a server-side conflict check runs when prescribing. | Preserve that server check. Text matching is not a complete interaction/contraindication engine, and missing allergy data must not be treated as “no allergy.” |
| Medication history | The chart has prescriptions and medication-administration records, while some history views present prescription details as free text. | Reconciliation, current-vs-historical status, and discontinued medication semantics need to be defined before medication recommendations. |
| Identity and audit | Facility tenancy and permission checks exist. Notes/prescriptions/orders record authenticated staff attribution; audit services exist. | Any future AI request must use the existing backend identity and tenant context, with a distinct audit event and no direct model-service database access. |

## Terminology and data gaps

1. **No schema-level LOINC or RxNorm mapping was found** in the inspected Prisma schema. Existing local catalogue/drug codes and an insurance tariff field are not equivalent to those standards.
2. **ICD-10 is supported but not guaranteed complete.** The diagnosis code may be absent; descriptions can be free text.
3. **Prescription items may be free text.** A drug can link to a local `Drug` record, but the link is optional; dosing, route, frequency, and duration remain prescriber-entered fields.
4. **Clinical safety context is incomplete for automated medication suggestions.** The inspection did not establish a complete interaction/contraindication knowledge source or guaranteed availability/freshness of renal function, pregnancy, weight, and other dose-relevant context for every patient.
5. **Data ownership and suitability need clinician confirmation.** The existence of a field does not prove it is accurate, current, or appropriate as an AI input.

## Safe first-feature input boundary

For the first feature—**reformatting text the clinician has already typed into an editable draft**—the model does not need a chart-wide patient profile. Send only the clinician-entered text and an explicit output format. Do not include patient name, identifiers, contact details, full encounter history, diagnoses, orders, prescriptions, or vitals for this initial feature. The service must return a draft only; saving it remains a separate, clinician-controlled action.

If a later feature needs chart facts, it must have its own minimum-input list. Each fact needs source, timestamp/status, and a clear rule for missing or conflicting data. The AI must not author a diagnosis or turn a missing value into a normal finding.

## Required next decisions

Before Stage 2 (integration foundation), the product owner and a facility clinical lead should confirm:

1. The intended first feature is limited to organizing clinician-entered note text (not diagnosing, summarizing the full chart, or suggesting treatment).
2. Which users may invoke it and which permission controls it.
3. Whether an external inference provider is allowed at all; if so, the facility/operator data-processing, hosting, retention, and contractual review must be completed before real patient data is used.
4. The note format and what the assistant must never add or change.
5. How AI-generated draft text is visibly labeled, reviewed, rejected, and audited.

## Stage 1 result

The technical inventory is complete and supports a narrow, privacy-minimized note-formatting prototype. It does **not** support launching predictive prescriptions or lab bundles. Stage 1 remains open until the clinical lead validates the proposed first use and the product owner confirms the permission and data-processing decisions. No model call or workflow change should be made before that gate.

## Decisions recorded for the disabled foundation

- The user confirmed that the first capability is limited to reformatting text the clinician already entered and authorized a **disabled foundation only**.
- The current contract accepts only the four existing SOAP note sections and uses the existing encounter-consult permission. These are implementation defaults for the plumbing, not clinical approval for a pilot.
- No inference provider is configured or called. The flag defaults to `false`; requests fail closed, and audit records contain only task/outcome metadata and character count—not note text.
- Clinical-lead review, provider/data-processing approval, and evaluation criteria remain open. Do not enable real-patient inference until those gates are separately satisfied.
