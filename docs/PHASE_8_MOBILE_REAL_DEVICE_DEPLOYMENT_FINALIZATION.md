# Phase 8 — Mobile Real-Device Deployment Finalization

Phase 8 builds on the verified Phase 7 package and focuses on final real-device behavior for hosted mobile use.

## Implemented

- Added mobile install/PWA metadata in `index.html`.
- Added `public/manifest.webmanifest` and a clinical SVG icon.
- Added a conservative service worker with app-shell caching and an offline fallback page.
- Registered the service worker through a guarded production-safe utility.
- Added `useMobileViewportMetrics` for real mobile `visualViewport` handling.
- Added CSS variables/classes for keyboard-open, landscape, compact-landscape and standalone app mode.
- Updated bottom navigation/toast spacing hooks so fixed UI behaves better with keyboards and real phone viewport changes.
- Added Phase 8 automated QA through `scripts/check-mobile-phase8.mjs`.
- Connected Phase 8 QA into `npm run lint:mobile` and therefore `npm run qa`.

## Validation commands

```bash
npm run lint:mobile
npm run build
npm run qa
```

## Notes

- The service worker is intentionally conservative. It caches the app shell and static assets, but it does not pretend that clinical records are fully available offline.
- Live/backend data still requires the real API and network connectivity.
- Desktop behavior is preserved.
