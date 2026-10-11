# Gustav Biomed Vendor Portal — Implementation Plan

## Approved scope

Build a separate portal for Gustav Biomed Limited to view **all requests assigned to Gustav across participating LHIMS facilities** and update request status. The vendor account must not expose patient records or unrelated facility records. The supplied contact number, **+233 59 536 5391**, is the partner’s company contact, not a personal login unless the account owner confirms otherwise. The head’s account will remain unprovisioned until the user provides a verified name and login identity.

## Architecture and project structure

### Backend (`diagnosis-center-backend`)

- `VendorPartner` stores the global partner profile, including the verified display name and contact number.
- `VendorPortalUser`, `VendorPortalSession`, and `VendorPortalInvite` provide a vendor-specific identity and invitation flow, separate from facility staff accounts and sessions.
- `GustavBiomedRequest` gains a partner foreign key. Existing requests are backfilled to Gustav during migration; newly created requests are assigned to the seeded Gustav partner.
- Vendor-only auth middleware accepts only the vendor cookie/session and checks active user, session, expiry, and partner membership.
- Vendor request services run cross-facility queries only in the dedicated service boundary and always filter by the authenticated user’s immutable partner ID. Responses include only request details needed to fulfill work and the facility name/code; they omit patient records, internal free-text notes, and unrelated facility data.
- Vendor actions are limited to acknowledge, schedule, complete, or decline through legal status transitions. Vendor actions cannot cancel, rewrite the original request, or access other suppliers’ requests. Actions are audited with vendor identity, request, prior/new status, IP, and time.
- Platform-admin-only invitation creation returns a single-use, expiring setup link. The vendor sets their own password; no shared or hard-coded password is created.

### Frontend (`LHIMS-Frontend`)

- `src/pages/vendor/` contains the isolated login, invitation activation, request queue, and request detail experiences.
- `src/services/vendorPortalService.js` uses the separate vendor auth and request endpoints; vendor sessions never hydrate into the facility workspace.
- A dedicated `#/vendor` entry renders the vendor portal independently of facility navigation and login.
- The queue supports status filters, search, request-code and facility identification, clear progress/status actions, and a responsive mobile card view. It displays the company contact as a tap-to-call link.

## Interaction and visual direction

- **Design movement:** a calm clinical operations console, consistent with CurataMed’s existing workspace.
- **Core principles:** quick scanning, low-friction response, minimal disclosure, accessible controls.
- **Color and layout:** white/slate surfaces with CurataMed teal for primary actions; a compact summary rail above a focused request queue, rather than a decorative dashboard grid.
- **Signature elements:** readable request-code chips, clear status pills, a distinct vendor-authored latest update, and a compact request queue.
- **Interaction:** one clear next action per request; confirmations for status changes; no hidden destructive actions; reduced-motion-safe transitions.
- **Typography and voice:** reuse the existing app typography; concise operational labels such as “Acknowledge request” and “Schedule service.”
- **Brand essence:** a dependable service desk connecting laboratory teams with Gustav Biomed — **clear, responsive, accountable**.

## Delivery sequence

1. Implement and validate the backend schema, migration, isolated auth, invitation flow, scoped request API, audit trail, and authorization tests.
2. Implement the vendor login/activation and responsive request-management page against those contracts.
3. Verify facility users still create requests, vendor users see only Gustav requests, all status transitions are enforced, and no patient or unrelated tenant data is returned.
4. Open linked backend/frontend pull requests. Deploy the backend migration/API before the frontend. Provision the head only after the user supplies his verified identity; do not create a permanent password or send credentials to the company contact number by assumption.

## Execution and validation status

- Backend and frontend implementation are complete on isolated feature branches; vendor access remains separate from facility sessions and navigation.
- The supplier response field (`vendorStatusNote`) is separate from staff-only `statusNote` and internal free-text `notes`. Stores and Lab Staff see a required no-patient-data confirmation before submitting vendor-shared details.
- Concurrent refreshes use a short, 30-second previous-token grace window so parallel browser tabs do not revoke a legitimate session. Vendor-account activation/deactivation and its audit record now commit atomically and retain the platform operator's ID.
- **Passed:** Prisma schema validation and schema-to-schema SQL diff; backend TypeScript type-check; focused validation and permission tests (**27 tests passed**); backend lint (**0 errors**, 11 warnings in unrelated files); frontend production build; generated OpenAPI contains the vendor/platform endpoints; `git diff --check`.
- The frontend build also reports a main-app chunk-size advisory (>500 kB); the vendor dashboard is separately split into a ~24.5 kB chunk.
- **Database integration tests are written but not executed here:** this sandbox has no `TEST_DATABASE_URL` or local PostgreSQL readiness utility. Run `npm run test:integration` against the isolated test database before production rollout.
- **Still required before a real vendor login can be issued:** a platform administrator must invite the head using his verified full name and work email. The supplied number (**+233 59 536 5391**) is used only as Gustav Biomed’s company contact. Backend migration/API deployment must precede frontend deployment.
