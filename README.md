# CurataMed Frontend — Hospital Management System

CurataMed is a modular hospital management system for outpatient, ward, theatre, maternity, laboratory, imaging, pharmacy, billing and claims workflows.

## Development

```bash
npm ci
npm run dev
```

The app is built with React and Vite. The production bundle is generated with `npm run build`.

## QA and feature history

The following sections record legacy release-stage implementation and regression checks.

---

# Legacy Stage 13 UI Cleanup + Lab Results Archive

Current frontend version: `12.7.0`

This update removes visible development/process notes from application pages and adds a dedicated laboratory **Results** page where lab users can review, print and correct stored lab results.

## New in this stage

```txt
Visible page marker cleanup
Removed phase/pre-backend/SUNKWA helper notes from page UI
New Laboratory > Results navigation item
Stored laboratory result archive
View laboratory results
Print laboratory results
Edit/correct lab result values
Correction reason and amendment history
Result status preservation
QA script for page-marker cleanup and lab result archive wiring
```

## Run the new Stage 13 check

```bash
npm run lint:stage13
```

## Run locally

```bash
npm install
npm run dev
```

## Build and checks

```bash
npm run lint:routes
npm run lint:ui
npm run lint:prd
npm run lint:api
npm run lint:live-api
npm run lint:production
npm run lint:stage13
npm run build
```

## Demo credentials

- Doctor: `doctor` / `doctor123`
- Receptionist: `reception` / `reception123`
- Lab Staff: `lab` / `lab123`
- Scan / Imaging: `scan` / `scan123`
- Billing / Finance: `billing` / `billing123`
- Admin: `admin` / `admin123`

## Stage 16 — Shell header and stat-card refinement

- Removed visible workspace/development banner text from the top shell header across all authenticated pages.
- Page-level headers now serve as the primary heading area for every department page.
- Reduced summary/stat container sizing globally for a tighter dashboard layout.
- Added `npm run lint:stage16` QA guard.

## Stage 16 verification fix

The built production assets were regenerated after confirming the old shell subtitle text was still present in the previous compiled bundle. The source and dist outputs now both remove the visible workspace/development header banner.


## Stage 19 — Reception Workflow Navigation

The reception workspace has been segmented into focused workflow pages with a shared top navigation bar: Overview, Orders, Check-In, Walk-Ins, Appointments, Daily Visits, and Results. The Check-In page is now focused only on arrivals and identity/order verification, while walk-in registration and duplicate review have moved to a dedicated Walk-Ins page.

QA command:

```bash
npm run lint:stage19
```


## Stage 20 — Reception Page Segmentation

Reception pages now use page-level section tabs inside the content area instead of a second cross-page reception menu. This reduces congestion on Incoming Orders, Check-In, Walk-Ins, Appointments, Daily Visits, and Results Inbox.

## Stage 22 — Reception filter and scroll reset fixes

This package includes the Reception Daily Visit Log correction and navigation freshness fixes:

- The Daily Visit Log filter is no longer a page-section tab.
- Daily Visit Log filters now sit at the top-right of the section navigation container.
- Page scroll resets to the top whenever the user opens a different page from the sidebar.
- Reception section-tab horizontal scroll resets when moving to a different reception page.
- Stage 22 QA command added: `npm run lint:stage22`.

## Stage 23 — Top-right user menu

- Removed the signed-in profile/sign-out card from the left sidebar.
- Added a compact user icon menu at the top-right of the global header.
- The user menu shows the signed-in user, role/workspace details, and the Sign Out button.
- The menu closes on outside click or Escape.

QA: `npm run lint:stage23`


## Stage 24 — Price Catalog Popup + Fixed Header

This package includes the Stage 24 UI fix:

- Fixed the global header/sidebar stacking so the top heading bar does not cover the left navigation.
- Removed the Price Catalog selected-item side panel.
- Added a popup modal for catalog item details and edit/view actions.
- Rebuilt production `dist` and standalone preview.


## Frontend Stage 26 — Header Dropdown Layering Fix

- Fixed notification and user menu dropdowns appearing under page content.
- Rendered header dropdowns through React portals.
- Raised header/dropdown z-index while keeping modals above them.
- Added `npm run lint:stage26` and included it in `npm run qa`.

## End-to-end tests (Playwright)

Real browser, real backend, real database — the key journeys:

- a visitor goes from the pricing page to sign-up, setup, a first patient and the first payment;
- the platform operator's overview and a read-only support session;
- every demo role signs in, sees only its own menu, and every screen in it opens without crashing;
- the public website on a phone (no sideways scrolling, menu, demo request).

```bash
npx playwright install chromium   # once per machine
npm run test:e2e                  # starts its own backend (port 5001) and frontend (port 5174)
npm run test:e2e:report           # open the last report (screenshots and traces of failures)
```

The run resets and seeds a separate database — the backend's `DATABASE_URL` with the database
renamed `lhims_e2e` (or `E2E_DATABASE_URL`) — so development data is never touched. The backend
is expected at `../diagnosis-center-backend` (or `E2E_BACKEND_DIR`).
