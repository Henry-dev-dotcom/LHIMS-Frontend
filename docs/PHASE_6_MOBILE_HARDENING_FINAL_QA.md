# Phase 6 — Mobile Hardening and Final Responsive QA

Phase 6 completes the mobile refinement pass by tightening the shared responsive rules that protect every role workflow on small screens.

## Key upgrades

- Kept `DataTable` card rendering active through tablet widths by switching record cards to `lg:hidden` and desktop tables to `lg:block`.
- Added safer mobile action rendering inside data-table cards, including full-width mobile action buttons and child overflow guards.
- Collapsed mobile header descriptions into a compact **Screen guide** panel so the header no longer consumes excessive vertical space.
- Hardened `MobileActionBar` and `FilterPanel` so large filter/action stacks scroll inside a capped mobile area instead of stretching the whole page.
- Improved `FormField`, `Button`, and global CSS behavior so long labels, values, IDs, report hashes, names, and clinical notes wrap safely.
- Polished public-facing patient/report pages with tighter phone spacing, smaller mobile QR sizing, and full-width phone actions.
- Added a dedicated `lint:mobile` QA gate for Phase 6 responsive behavior.

## Files changed

- `src/components/ui/DataTable.jsx`
- `src/components/ui/Button.jsx`
- `src/components/ui/FormField.jsx`
- `src/components/ui/MobileActionBar.jsx`
- `src/components/ui/FilterPanel.jsx`
- `src/layouts/Header.jsx`
- `src/pages/public/PatientPortalAccessPage.jsx`
- `src/pages/public/ReportVerificationPage.jsx`
- `src/styles/index.css`
- `scripts/check-mobile-hardening.mjs`
- `package.json`

## Validation

The following commands passed:

```bash
npm run build
npm run qa
```

The only build notice was the normal Vite large chunk warning. It is not a compilation error.
