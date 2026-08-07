# Walk-In Test Request Update

## Summary
Reception can now request tests or scans directly for patients who walk into the facility without requiring a clinician-submitted order first.

## Workflow added
1. Reception registers a new walk-in patient.
2. The system immediately opens the **Request Tests** section.
3. Reception selects the checked-in walk-in visit/patient.
4. Reception selects one or more lab tests or scan items from the catalog.
5. The system creates a walk-in order, confirms/routes it, generates the invoice, and links it to the walk-in visit.

## Main frontend files changed
- `src/pages/reception/ReceptionWalkInsPage.jsx`
- `src/pages/reception/PatientCheckInPage.jsx`
- `src/store/AppStore.jsx`
- `src/workflow/workflowEngine.js`
- `src/routes/routeRegistry.js`
- `src/data/roles.js`
- `scripts/check-walkin-test-request.mjs`
- `package.json`

## Backend note
The backend already has a matching live API route for this flow:

`POST /reception/walk-ins`

The backend service supports creating a walk-in patient/order with requested catalog items, invoice creation, and check-in handling.

## QA completed
- `npm run qa` passed in frontend.
- `npm run build` passed in frontend.
- `npm run build:standalone` passed in frontend.
- `npm run lint:walkin` passed.
- Backend static QA passed.

The only frontend build warning was the normal Vite large chunk warning, not an error.
