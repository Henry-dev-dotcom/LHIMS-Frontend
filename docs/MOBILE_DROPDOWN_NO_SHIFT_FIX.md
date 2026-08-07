# Mobile Dropdown No-Shift Fix

## Update completed

The mobile header Screen Guide dropdown has been changed from an in-flow expanding `<details>` element to an absolutely positioned animated dropdown panel.

## What this fixes

- Tapping **Screen Guide** no longer pushes or shifts the page content.
- The dropdown opens above the page content layer instead of taking layout space.
- The dropdown now closes when tapping outside or pressing Escape.
- The arrow rotates smoothly while the panel fades/slides into view.
- Route changes automatically close the dropdown.

## Files changed

- `src/layouts/Header.jsx`
- `scripts/check-mobile-hardening.mjs`
- `MOBILE_DROPDOWN_NO_SHIFT_FIX.md`
