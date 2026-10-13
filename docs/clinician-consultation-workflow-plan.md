# Clinician consultation workflow simplification plan

## Goal

Make the common clinician path feel focused and quick: review the patient, document the visit, record the diagnosis, then move to tests, medicines, or disposition only when needed. Reduce default page height and remove redundant actions without hiding safety-relevant information or changing clinical behavior.

## Current friction

- An unavailable predictive-autopilot placeholder takes space in the primary consultation flow but offers no working clinical action.
- The free-text note editor starts at 16 rows, making the first task taller than necessary on laptop and mobile screens.
- Every saved note is rendered in full below the active note and diagnosis forms, so history can push the next task far down the page.
- The footer offers a manual “Save Draft” action even though drafts already autosave after typing, on leaving the screen, and before routing actions.

## Planned experience

1. **Keep the patient safety band first.** Identity, complaint, triage state, latest vitals, allergy alerts, and existing diagnoses stay visible at the top.
2. **Keep the two core consultation tasks in the primary column.** The clinical note remains first; diagnosis remains directly after it and stays visible because at least one diagnosis is required to complete a visit.
3. **Reduce note-entry footprint.** Start the free-text editor at 10 rows with vertical resizing available, so clinicians can expand it for longer narratives without paying that page-height cost on every visit.
4. **Progressively disclose historical notes.** Replace the full-height history card with a keyboard-operable disclosure that shows the saved-note count and latest timestamp; opening it still exposes every note and correction in newest-first order.
5. **Remove unavailable UI from the active path.** Do not show the disconnected Autopilot panel until its reviewed integration is ready. Keep the component code available for future work; do not imply it is usable today.
6. **Use autosave feedback instead of a routine save click.** Show “Saving”, the last successful save time, or a clear failure state. Offer “Retry save” only after a save failure. If newer typing arrives during a save, keep the status unsaved and persist the latest version afterward. Save-on-leave, permanent-note saving, test ordering, prescription issuing, and visit completion remain unchanged.
7. **Keep patient-specific clinical tools available.** Vitals/allergy entry and relevant maternity, immunization, and specialty forms remain in the consultation workspace. The existing patient band continues to surface critical context; the redesign does not bury specialist tasks behind a new wizard.
8. **Keep primary actions readable.** The focused axe scan exposed a shared primary-button contrast failure; use the darker clinical palette for primary buttons and hover states, both verified above WCAG AA contrast for white text.

## Deliberate non-goals

- Do not change permissions, diagnoses, note immutability, allergy checks, medication safety, test ordering, visit completion, API payloads, or persistence.
- Do not merge the separate Diagnostic Tests, Prescriptions, and Disposition workflows into one long page; that would replace tab clicks with more scrolling and risk obscuring safety checks.
- Do not add a new stepper, checklist, or extra navigation layer. The existing four workflow tabs and sticky routing actions remain in place.

## Validation

- Production build and existing route, UI, Tailwind, mobile, and layering checks.
- Axe/WCAG checks on the consultation panel, including both collapsed and expanded note-history states.
- Update the clinician workspace browser test to assert the focused default view and autosave status instead of relying on the removed manual-save button.
- Confirm the note editor, diagnosis form, patient safety band, note history disclosure, and retry-on-error affordance remain accessible by keyboard and at phone/tablet widths.
