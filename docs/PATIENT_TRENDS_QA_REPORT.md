# Patient Trends QA Report

## QA date
2026-06-21

## Scope
This QA pass verified the updated Patient Trends workflow where a clinician selects a patient and a repeated multi-parameter laboratory test, then sees all parameter trend cards at once with a View action for focused review.

## Checks completed

- Full frontend dependency install with `npm ci`.
- Full frontend QA pipeline with `npm run qa`.
- Production build with `npm run build`.
- Existing route coverage check for all 49 navigation sections.
- Mobile hardening checks from Phase 6 through Phase 9.
- Custom Patient Trends static/seed-data QA check.

## Patient Trends behaviour verified

- Selecting a multi-parameter test generates chart cards from the selected test's full `parameters` list.
- Full Blood Count (FBC) seed data has 7 configured parameters: WBC, RBC, Hemoglobin, Hematocrit, Platelets, MCV, and MCH.
- Trend-ready seed data exists for 3 FBC parameters: WBC, Hemoglobin, and Platelets.
- All parameter cards remain visible even when a specific parameter does not yet have enough numeric history for a line trend.
- Every parameter card now has an enabled View action so the clinician can open the large popup for any parameter.
- The large popup renders the focused chart area and a detailed historical table for the selected parameter.
- CSV export uses all selected-test parameter trend rows, not only one selected parameter.
- Date filters apply to the selected test's parameter rows.

## Fix applied during QA

The QA check identified that the View button was disabled on parameters without enough trend history. This was corrected so every parameter card can be opened in the large popup. Parameters without enough numeric history still show the proper clinical message inside the chart area.

## Validation commands

```bash
node scripts/check-patient-trends-update.mjs
npm run build
npm run qa
```

## Result

Passed. The Patient Trends section is ready for use.
