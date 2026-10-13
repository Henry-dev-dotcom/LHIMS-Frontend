# UI/UX Pro Max — Portal Layout, Modal, and Form Audit

**Audit date:** 2026-10-13  
**Scope:** `Henry-dev-dotcom/diagnosis-center-backend` and `Henry-dev-dotcom/LHIMS-Frontend`  
**Method:** Source-wide static inventory and review, followed by the repository’s build and relevant route/UI/mobile checks. This was not a live, authenticated, role-by-role browser run.

## Executive summary

- The backend repository is an API/service project and contains no frontend JSX, page stylesheets, or modal/form UI to change.
- The frontend is the portal UI. The route check reports coverage for **94 navigation items**; the source inventory found **92 shared `<Modal>` call sites in 51 modules**, **44 `<form>` elements in 34 modules**, and four elements with `role="dialog"`.
- The principal cross-page layout weakness was intrinsic sizing: desktop grid/flex descendants could still impose min-content widths, while several outer containers clipped overflow instead of fixing sizing. The global fix now lets those tracks shrink and removes the app-shell clipping that concealed spill.
- Shared modal behavior is more consistent: focus handling no longer restarts with every inline `onClose` callback; focus is trapped, restored, and the dialog itself is a keyboard fallback. Notification and vendor overlays now use the shared treatment.
- FormField’s `required` prop now sets native HTML `required` in addition to its accessible required state, while preserving implicit labels, help/error descriptions, invalid state, and announced errors.

## Work applied

### Responsive sizing and overflow

1. Added global `min-width: 0` rules for grid/flex children and nested layout items, plus safe text wrapping for long labels, URLs, identifiers, and other portal content.
2. Removed `overflow-x: hidden` from the document/root baseline and the main `AppShell` wrappers. This prevents broad clipping from hiding column-sizing defects or keyboard-accessible content.
3. Kept intentional local overflow affordances (for example, horizontally scrollable data tables and compact metric strips) as component-level behavior rather than using the viewport as a catch-all mask.

### Modals and overlays

1. Updated the shared `Modal` to use a current close callback without tearing down/recreating the keyboard/focus effects on every render.
2. Improved keyboard handling when focus starts outside the dialog, added a dialog focus fallback, and clear the initial-focus timer during cleanup. Existing Escape handling, focus return, body scroll locking, labelled title/description, and responsive scrollable content remain in place.
3. Added focus trapping, initial focus, focus restoration, and a stable accessible title to `NotificationDrawer`.
4. Replaced the vendor account deletion and vendor status-update custom overlays with the shared modal, so they inherit the same keyboard and responsive behavior.
5. The mobile navigation drawer uses the shared focus-trap hook, provides Escape/close behavior, and now restores focus to its opener with timer cleanup. The Header session menu is a non-modal popover, not an `aria-modal` dialog.

### Forms

- `FormField` wraps its control in a native `<label>`, associates help/error descriptions with the control, reflects error state with `aria-invalid`, and announces field errors. The `required` prop now also activates browser-native form validation.
- The inventory found 44 form elements across 34 page modules. Forms appear across administration, billing, authentication, clinical/OPD, doctor, inpatient, laboratory, platform/vendor, reception, records, setup, public-site, subscription, and stores workflows.

## Remaining findings / follow-up

### Native browser prompts

There are **35 `window.confirm`/`window.prompt` calls across 21 modules**. They are browser-native rather than custom modal components, so they do not share the portal’s styled form validation, contextual help, or consistent responsive treatment. I left these workflows intact to avoid changing confirmation/input semantics or their domain-specific safeguards in this pass. A follow-up can migrate them to shared confirmation/form dialogs while preserving each operation’s validation and cancellation behavior.

Affected modules:

- `src/pages/admin/RolesPage.jsx` — 1
- `src/pages/billing/ExpensesPage.jsx` — 4
- `src/pages/billing/InvoicesPage.jsx` — 3
- `src/pages/bloodBank/BloodBankPage.jsx` — 4
- `src/pages/claims/ClaimsPage.jsx` — 3
- `src/pages/core/OrderRegistryPage.jsx` — 1
- `src/pages/hr/HrPages.jsx` — 2
- `src/pages/inpatient/RoundsTab.jsx` — 1
- `src/pages/lab/AnalyzerMappingPage.jsx` — 1
- `src/pages/lab/AnalyzersPage.jsx` — 1
- `src/pages/lab/LabRejectedSamplesPage.jsx` — 1
- `src/pages/mortuary/MortuaryPage.jsx` — 1
- `src/pages/opd/EncounterWorkspace.jsx` — 2
- `src/pages/pharmacy/PharmacyDispensingPage.jsx` — 1
- `src/pages/platform/VendorPortalAdminPage.jsx` — 1
- `src/pages/reception/AppointmentsPage.jsx` — 1
- `src/pages/reception/IncomingOrdersPage.jsx` — 1
- `src/pages/records/MedicalRecordsPage.jsx` — 2
- `src/pages/stores/StoresPage.jsx` — 2
- `src/pages/subscription/SubscriptionPage.jsx` — 1
- `src/pages/theatre/TheatreListPage.jsx` — 1

### Runtime coverage limitation

Source-level checks cover all inventoried route/page files, but actual modal opening, form validation, and viewport overflow can depend on role permissions, API data, and workflow state. A full visual pass should use representative accounts/data for each role and test at 320/375/768/1024/1440px. Existing mobile checks and route coverage pass; no authenticated end-to-end tour of every workflow was run in this task.

## Validation

- `npm run build` — **passed** (Vite/Rolldown emitted the existing large-chunk advisory; no build error).
- `npm run lint:routes` — **passed**, covers all 94 navigation items.
- `npm run lint:ui` — **passed**.
- `npm run lint:mobile` — **passed** (Phase 6 hardening, Phase 6 continuation, Phase 7 deployment, Phase 8 real-device, Phase 9 reliability checks).
- `npm run lint:tailwind` — **passed**.
- `npm run lint:stage26` — **passed**.
- `git diff --check` — **passed**.

The initial build attempt exposed a missing optional Linux Rolldown binding in the local dependency installation. The matching binding was installed locally for validation; `package.json` and `package-lock.json` were not changed.
