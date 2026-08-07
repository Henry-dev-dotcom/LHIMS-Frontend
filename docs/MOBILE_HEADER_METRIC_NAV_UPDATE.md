# Mobile Header, Metric Strip and Bottom Navigation Update

## Requested fixes

1. Re-arranged the mobile header so the workspace label, title and action buttons are aligned cleanly.
2. Converted dashboard metric cards on mobile into a one-line four-column strip so the status blocks do not occupy too much vertical space.
3. Added an animated bottom-navigation active pill so the selected section transitions smoothly when moving between sections.

## Updated files

- `src/layouts/Header.jsx`
- `src/components/ui/MetricCard.jsx`
- `src/components/ui/MobileBottomNav.jsx`
- `src/pages/dashboards/RoleDashboard.jsx`
- `src/styles/index.css`

## QA completed

Frontend:

```bash
npm run qa
```

Backend static check:

```bash
npm ci --ignore-scripts
npm run qa
```

## Notes

The backend business logic was not changed for this visual mobile update. The backend dependency fix remains included in the full-project package.
