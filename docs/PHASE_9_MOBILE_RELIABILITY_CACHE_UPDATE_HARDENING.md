# Phase 9 — Mobile Reliability, Cache Update and Hosted Deployment Hardening

## Objective
Phase 9 improves the hosted mobile experience after deployment. It focuses on real phone reliability rather than visual redesign: offline/slow-network awareness, safer service-worker caching, visible app-update handling, and stricter QA coverage.

## Implemented

### 1. Offline and slow-network status banner
- Added `useNetworkStatus()` to detect:
  - offline state
  - slow connection types
  - data saver mode
- Added `NetworkStatusBanner` below the header.
- The banner warns users when live clinical, upload, payment or delivery actions need network access.

### 2. Service worker update flow
- Added `ServiceWorkerUpdateBanner`.
- Users now see an **Update ready** prompt when a newer cached production build is available.
- The update flow sends `SKIP_WAITING` to the waiting service worker and reloads after controller change.

### 3. Safer service worker caching
- Bumped service-worker cache to `diagnosis-center-phase9-v1`.
- Added `SKIP_WAITING` message support.
- Prevented `/api/` requests from being cached.
- Added safe response checks before caching.
- Kept navigation fallback to cached shell/offline page.

### 4. Offline fallback improvement
- Updated `offline.html` for safe-area mobile padding.
- Clarified that live records, uploads, payment actions and delivery tasks require network access.
- Improved reconnect/reload action.

### 5. Mobile CSS hardening
- Added `.mobile-system-banner` guardrails.
- System banners now wrap safely, respect mobile width, and hide when the keyboard is open.

### 6. QA automation
- Added `scripts/check-mobile-phase9.mjs`.
- Connected Phase 9 into `npm run lint:mobile` and the full `npm run qa` pipeline.

## Files changed
- `src/hooks/useNetworkStatus.js`
- `src/components/ui/NetworkStatusBanner.jsx`
- `src/components/ui/ServiceWorkerUpdateBanner.jsx`
- `src/layouts/AppShell.jsx`
- `src/utils/registerServiceWorker.js`
- `public/sw.js`
- `public/offline.html`
- `src/styles/index.css`
- `scripts/check-mobile-phase8.mjs`
- `scripts/check-mobile-phase9.mjs`
- `package.json`
- `package-lock.json`

## Validation
Passed:
- `npm run lint:mobile`
- `npm run build`
- `npm run qa`
- production preview HTTP checks for:
  - `/`
  - `/manifest.webmanifest`
  - `/sw.js`
  - `/offline.html`

The only build note is the normal Vite large chunk warning. It is not an error.
