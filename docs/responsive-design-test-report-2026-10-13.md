# Responsive Design Test Report — 2026-10-13

## Result

**PASS.** The final Chromium browser sweep recorded **600 page/viewport visits** across all 94 registered application routes and six public pages. There were **zero page-level horizontal overflow failures, zero modal bounds/focus failures, and zero uncaught page exceptions**.

## Coverage

The frontend was run in a headless Chromium browser with API requests intercepted and answered using synthetic authentication plus empty collection responses. No production backend, patient records, or write operations were used.

- **Application routes:** all 94 registered routes, including facility-admin and platform-only pages.
- **Public routes:** home, features, pricing, signup, demo, and login.
- **Viewport matrix:**

| Category | Viewport | Visits |
| --- | ---: | ---: |
| Mobile | 320 × 720 | 100 |
| Mobile | 390 × 844 | 100 |
| Tablet | 768 × 1024 | 100 |
| Tablet | 1024 × 768 | 100 |
| Desktop | 1280 × 800 | 100 |
| Desktop | 1440 × 900 | 100 |
| **Total** | **6 sizes** | **600** |

Each viewport included all 94 app routes plus the six public routes. Synthetic long account and facility names were used to exercise header wrapping.

## Modal smoke test

The shared **New visit** modal was opened at 320 × 720, 768 × 1024, and 1280 × 800. Checks covered dialog bounds, viewport/document width, initial focus inside the dialog, Escape-to-close, and focus restoration to the opener. **All three viewport checks passed.** The modal was not submitted.

## Fixes made during testing

1. **Appointment Scheduler filters:** changed the filter grid from four columns at medium widths to two columns, reserving four columns for ultra-wide layouts. The initial sweep found viewport overflow of 105 px at 768 px and 165 px at 1024 px; both were eliminated.
2. **Intrinsic sizing cascade:** lowered the mobile `#main-content` descendant sizing rule so explicit component `min-width` utilities remain effective. The initial visual check showed 320 px section-tab buttons shrinking to roughly 60 px despite their intended 156 px minimum. The final browser check confirms 156 px swipeable tabs at 320 px while the document remains exactly 320 px wide.

## Final verification

- Horizontal overflow failures: **0**
- Modal geometry/focus failures: **0**
- Uncaught page exceptions: **0**
- Maximum measured main-content horizontal overflow: **0 px**
- Production build: **passed**
- Route coverage check: **passed** (94 navigation items)
- UI polish check: **passed**
- Tailwind class check: **passed**
- Mobile hardening checks: **passed** (phases 6–9)
- Stage 26 header/dropdown layering check: **passed**
- `git diff --check`: **passed**

The production build reports a non-blocking advisory that the main JavaScript chunk exceeds 500 kB; the build itself succeeds.

## Scope limitation

The API was mocked with empty lists to safely exercise every route without touching real records. This validates shared page-shell geometry and responsive behavior, but does not replace backend integration tests or data-rich testing of every table, chart, and populated modal state.
