# Phase 4 Mobile Workflow Refinement

Implemented after Phase 3 mobile sheets and dashboard polish.

## Scope

Phase 4 targets the screens that users actually operate on phones: order creation, reception queues, laboratory result entry, scan reporting, invoice/catalog views, forms, and data-heavy registers.

## Completed changes

### 1. Mobile data cards are now more useful

Updated `src/components/ui/DataTable.jsx`:

- Mobile table cards now show the strongest primary field first.
- Secondary fields are grouped into readable detail blocks.
- Extra fields move into a built-in “More details” expander instead of disappearing.
- Action columns remain touch-friendly and full-width on phones.
- Desktop tables are preserved.

### 2. Forms are safer on phones

Updated `src/components/ui/FormField.jsx`, `src/components/ui/Button.jsx`, and `src/styles/index.css`:

- Form fields now support page-level grid spans using `className`.
- Inputs are constrained with `min-w-0` to prevent overflow.
- Mobile inputs have better tap height and tighter rounding.
- Buttons have safer text wrapping and minimum-width handling.
- Form buttons inside panels become full-width on mobile.

### 3. Cards are less cramped on small screens

Updated `src/components/ui/Card.jsx`:

- Reduced mobile card padding and radius.
- Improved mobile card title/subtitle line height.
- Card action groups now stack consistently on phones.
- Desktop spacing remains premium and unchanged.

### 4. Reception workflow navigation is mobile-scrollable

Updated:

- `src/pages/reception/ReceptionWorkflowNav.jsx`
- `src/pages/reception/ReceptionPageTabs.jsx`

Improvements:

- Mobile reception workflow sections now use horizontal snap scrolling instead of tall crowded grids.
- Helper text is hidden on small phones to avoid tab overflow.
- Active tabs remain clear with count badges.
- Tablet/desktop grid behavior is preserved.

### 5. Doctor order creation flow is refined

Updated `src/pages/doctor/DoctorNewOrderPage.jsx`:

- Doctor order screen now uses a better desktop/main-summary split without hurting mobile flow.
- Order summary becomes sticky only on desktop.
- Selected test/scan items stack cleanly on mobile.
- Catalog item rows in the mobile bottom sheet are easier to tap and read.
- Add/remove actions no longer squeeze investigation names on small screens.

### 6. Lab and scan result-entry actions are mobile-friendly

Updated:

- `src/pages/lab/AcceptedSamplesPage.jsx`
- `src/pages/scan/AcceptedScansPage.jsx`

Improvements:

- Result-entry footer actions stack full-width on mobile.
- Save Draft / Submit for Review buttons remain easy to tap.
- Desktop action rows are preserved.

### 7. Catalog detail popup no longer uses a cramped mobile table

Updated `src/pages/billing/PriceCatalogPage.jsx`:

- Parameter/component details inside the catalog popup now use the shared responsive `DataTable`.
- On phones, parameter details appear as cards rather than a horizontal table.
- On desktop, the tabular view remains available.

## Validation

Completed successfully:

```bash
npm run build
npm run qa
```

The only build message is the existing Vite large chunk warning. It is not a build failure.
