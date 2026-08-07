# Patient Trends Multi-Parameter Update

## Completed

The Patient Trends section now supports a clinician selecting one repeated lab test and seeing all parameter charts for that test at once.

## Key behavior

- Search and select a patient.
- Select a completed/repeated lab test.
- The page automatically displays every parameter chart for the selected test.
- Each parameter chart includes a `View` button with an eye icon.
- Clicking `View` opens a large modal popup with:
  - enlarged line chart
  - first/latest/reference summary
  - historical table for that parameter
- Date filters apply across all charts and the focused popup view.
- CSV export now exports all displayed parameter trend rows for the selected test.

## Files updated

- `src/components/ui/PatientTrendsPanel.jsx`
- `src/pages/doctor/DoctorPatientTrendsPage.jsx`
