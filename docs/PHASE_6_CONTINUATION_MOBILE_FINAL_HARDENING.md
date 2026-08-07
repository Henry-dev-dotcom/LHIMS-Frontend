# Phase 6 Continuation — Mobile Final Hardening

This continuation pass extends Phase 6 with the remaining phone-specific polish that usually appears only after deployment testing.

## Completed updates

- Repositioned toast notifications above the mobile bottom navigation so success/error messages no longer cover navigation controls.
- Added long-message wrapping to toast notifications.
- Improved the mobile user menu with a backdrop, background scroll lock, and pointer-based outside-close behavior.
- Tightened modal internals with nested `min-w-0` guards to prevent long form fields, labels, uploaded file names, and report text from causing horizontal overflow.
- Improved responsive tabs so long labels are capped on phones while still exposing the full label through the title attribute.
- Adjusted the mobile bottom navigation to respect safe-area insets without adding excessive internal height.
- Added final CSS guardrails for iOS input zoom, embedded media overflow, scroll padding, and inline-size containment.
- Added a dedicated continuation QA script and connected it to `npm run qa` through `lint:mobile`.

## Validation

Run:

```bash
npm run build
npm run qa
```

The continuation QA is included in:

```bash
npm run lint:mobile
```
