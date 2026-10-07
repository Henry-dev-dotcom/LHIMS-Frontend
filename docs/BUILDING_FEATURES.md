# Building a new feature in LHIMS

Give this whole document to any AI before asking it to build something. It
describes how a feature is built **inside** LHIMS, layer by layer, so that what it
writes can be pasted straight into the two repositories without being adapted.

LHIMS is two repositories. A feature that stores data touches both.

| | Frontend `LHIMS-Frontend` | Backend `diagnosis-center-backend` |
| --- | --- | --- |
| Language | JavaScript (`.jsx`, no TypeScript) | TypeScript, ES modules |
| Stack | React 19, Vite, Tailwind 3.4, `lucide-react` | Express 4, Prisma 5.22, PostgreSQL, zod 3 |
| Tests | Playwright (`e2e/`) | Vitest (`test/`, `test/integration/`) |

**Rule zero: write for the stack above and no other.** No TypeScript in the
frontend, no plain `.css`, no `react-router`, no `axios`, no second server, no
`localStorage` for the signed-in user.

Reference feature to imitate: **staff messaging**. Backend:
`src/config/messageChannels.ts`, `validators/message.validators.ts`,
`services/message.service.ts`, `controllers/message.controller.ts`,
`routes/message.routes.ts`, test `test/integration/messaging.test.ts`. Frontend:
`services/messageService.js`, `pages/core/MessagesPage.jsx`, `e2e/messages.spec.js`.

---

## Part 1 — Backend, in this order

Deliver each as a complete file. Paths are relative to the backend repo.

### 1. Prisma model — `prisma/schema.prisma`

```prisma
// Line comments only. Block comments are invalid at the top level of a schema.
model Thing {
  id         String   @id @default(cuid())
  facilityId String   @default(dbgenerated("current_setting('lhims.facility_id'::text)"))
  code       String                        // human code, e.g. THG-0001, from CODE_SERIES
  patientId  String
  amount     Decimal  @db.Decimal(12, 2)   // money is Decimal, never Float
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  patient  Patient  @relation(fields: [patientId], references: [id])
  facility Facility @relation(fields: [facilityId], references: [id])

  @@unique([facilityId, code])
  @@index([facilityId])
}
```

Rules: every table has `facilityId` exactly as above. **Never** take a
facility id from a request. IDs are cuid strings. A display code (`PAT-0001`) is
**not** the row's `id`. Add the back-relation field on `Facility` and on each
model you relate to. Enums are fine; use `UPPER_SNAKE` values.

### 2. Migration (the integrator runs this; describe the model, do not hand-write SQL)

```
npx prisma migrate diff --from-schema-datamodel <old.prisma> --to-schema-datamodel prisma/schema.prisma --script
npx tsx scripts/facility-guards.ts      # regenerates the same-facility triggers
```

The migration folder is `prisma/migrations/<YYYYMMDDHHMMSS>_<name>/migration.sql`
and must sort **after** the existing ones. It contains the diff **plus** the
regenerated guards. Then `npx prisma migrate deploy` and `npm run db:drift`
(must say "No difference detected").

### 3. Permissions — `src/config/permissions.ts`

Add `THING_READ: 'thing:read'`, `THING_MANAGE: 'thing:manage'` to `PERMISSIONS`,
then add them to the relevant roles in `ROLE_PERMISSIONS`. **Never** write
`if (user.role === 'ADMIN')` in a service. `ADMIN` already holds `'*'`.

If the feature belongs to a paid department, add its key to `MODULE_KEYS` and
`MODULE_DEFINITIONS` in `src/config/modules.ts`, guard routes with
`requireModule`, and seed a price for it.

### 4. Validation — `src/validators/thing.validators.ts`

```ts
import { z } from 'zod';
export const createThingSchema = z.object({
  patientId: z.string().min(1, 'Patient is required'),
  amount: z.coerce.number().positive('Enter an amount above zero'),
  note: z.string().trim().max(500).optional()
});
```

Reject bad input with a message a clerk can act on. Never silently coerce.

### 5. Service — `src/services/thing.service.ts`

```ts
import type { Request } from 'express';
import { prisma } from './prisma.service.js';
import { nextCode } from './codeSequence.service.js';
import { createAuditLog, getRequestAuditContext } from './audit.service.js';
import { AppError } from '../utils/appError.js';

export async function createThing(body: { patientId: string; amount: number }, req: Request) {
  if (!req.user) throw new AppError('Authentication is required', 401, 'AUTH_REQUIRED');
  const patient = await prisma.patient.findUnique({ where: { id: body.patientId } });
  if (!patient) throw new AppError('Patient was not found', 404, 'PATIENT_NOT_FOUND');

  const thing = await prisma.$transaction(async (tx) => {
    const code = await nextCode(tx, 'THG');               // client first, then the series; add 'THG' to CODE_SERIES
    return tx.thing.create({ data: { code, patientId: patient.id, amount: body.amount } });
  });

  await createAuditLog({
    ...getRequestAuditContext(req),
    action: 'THING_CREATED', module: 'Thing', entityType: 'Thing', entityId: thing.id, afterData: thing
  });
  return thing;
}
```

Rules that matter:
- **Do not filter by facility.** The Prisma client is already scoped to the
  caller's facility by a tenant extension, and a database trigger enforces it.
- Anything that must succeed or fail together goes in `prisma.$transaction`.
- Throw `AppError(message, httpStatus, 'CODE')`. Messages are read by staff.
- Audit every write — **except** deliberately temporary data (messages are not
  audited, on purpose).
- **Anything that starts clinical work must also raise its bill.** Use
  `raiseInvoiceForOrder` from `billing.service.ts`.
- Put the *decision* (what "done" means, which transitions are legal) in a plain
  exported function so it can be unit-tested without a database.

### 6. Controller and route

```ts
// src/controllers/thing.controller.ts
import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { createThing } from '../services/thing.service.js';

export const createThingController = asyncHandler(async (req: Request, res: Response) => {
  const result = await createThing(req.body, req);
  return sendSuccess(res, 'Thing created successfully', result, 201);
});
```

```ts
// src/routes/thing.routes.ts
import { Router } from 'express';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validate.js';
import { PERMISSIONS } from '../config/permissions.js';
import { createThingSchema } from '../validators/thing.validators.js';
import { createThingController } from '../controllers/thing.controller.js';

export const thingRoutes = Router();
thingRoutes.use('/things', requireAuth);
thingRoutes.post('/things', requirePermission(PERMISSIONS.THING_MANAGE), validateRequest({ body: createThingSchema }), createThingController);
```

Mount it in `src/routes/index.ts`: `import { thingRoutes } …` and
`apiRouter.use(thingRoutes);`. Relative imports **end in `.js`**.

Lists return `{ items, meta }` using `getPagination`, `paginationMeta` from
`query.service.ts`. Responses go through `sendSuccess`; the client unwraps them.

### 7. Integration test — `test/integration/thing.test.ts`

Copy the harness at the top of `messaging.test.ts` (start the app on port 0, log
in via `/api/auth/login` with `FACILITY_A` / `FACILITY_B` and `DEMO_USERS`).
**Every feature needs these tests:**
1. the happy path;
2. a role without the permission gets `403`;
3. bad input gets `400` with a readable message;
4. **facility B cannot see or touch facility A's rows**;
5. any business rule you wrote (limits, expiry, "cannot exceed the balance").

---

## Part 2 — Frontend, in this order

Paths are relative to `src/`.

### 8. API service — `services/thingService.js`

```js
import { buildQuery } from '../api/apiClient';

export const thingService = {
  list: async (client, params = {}) => client.request(`/things${buildQuery(params)}`),
  create: async (client, payload) => client.request('/things', { method: 'POST', body: payload })
};
```

Export it from `services/index.js`.

### 9. Where the data lives — choose one

**A. Shared workspace data (most features).** Loaded once into the store and read
by many screens.
- Add an empty collection to `initialState.data` in `store/AppStore.jsx`.
- Add a normalizer to `api/normalizers.js`: it turns the server's nested object
  into the flat shape the pages read. Keep the server's own id as `apiId` and show
  the human code as `id`. **Carry every field the screen needs** — a dropped field
  is invisible until someone asks why a screen shows only a total.
- Load it in `store/hydrate.js`: `load('things', () => thingService.list(client, LIST_PARAMS), normalizeThing)`.
- Gate it on the module/role like its neighbours do.

**B. Data that expires or is per-conversation** (like messages). Fetch inside the
page with `thingService` and `apiClient` (`import { apiClient } from '../../store/commands'`).

### 10. Commands — `store/commands.js`

Writes are commands: a function on the `commands` map.

```js
CREATE_THING: async (action, dispatch, getState) => {
  const payload = action.payload || {};
  if (!payload.patientId) throw new Error('Select a patient first.');
  // The page shows the display code; the API wants the row's own id.
  const patientApiId = requireApiId(getState().data.patients, payload.patientId, 'Patient');
  await thingService.create(apiClient, { patientId: patientApiId, amount: Number(payload.amount) });
  await refresh(dispatch, getState, ['things']);
  dispatch(toastAction('success', 'Thing created'));
},
```

`dispatch({ type: 'CREATE_THING', payload })` is **fire-and-forget**: it does not
return a promise. The idiom is to dispatch, then re-enable the button with
`window.setTimeout(() => setBusy(false), 1500)`, and to close a dialog **when the
store shows the result** (a `useEffect` on the data), not when the click happens.

### 11. The page — `pages/<area>/ThingPage.jsx`

Named export, function component, Tailwind inline, UI kit from `components/ui/`:

```jsx
import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader';   // eyebrow, title, description, actions
import { Card } from '../../components/ui/Card';               // title, subtitle, actions, compact
import { Button } from '../../components/ui/Button';           // variant: primary|secondary|danger|ghost; size: sm|md
import { Modal } from '../../components/ui/Modal';             // open, title, description, onClose, footer
import { FormField, inputClass } from '../../components/ui/FormField';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { useAppStore } from '../../store/AppStore';
import { formatDateTime, money } from '../../utils/formatters'; // currency is GHS

export function ThingPage() {
  const { state, dispatch } = useAppStore();
  const things = useMemo(() => state.data.things || [], [state.data.things]);
  // …
}
```

A page must handle: **loading, empty, error, success.** Show a refusal **where
the user is looking** (inside the dialog), because a toast is gone before anyone
reads it. Every input has a label or `aria-label`. Two buttons on one screen must
not share an accessible name. Escape user text going into a printed HTML string
(`utils/printDocument.js` has `escapeHtml` and `printDocument`).

Long lists of names in a table cell use `components/ui/ClippedList.jsx` so the
column keeps one width. Opacities must be scale steps (`/90`, `/95`, `/100`);
`bg-white/98` generates **no CSS** and fails the build.

### 12. Register the page — four places

1. `routes/AppRouter.jsx`: `const ThingPage = lazyPage(() => import('../pages/area/ThingPage'), 'ThingPage');` and `if (pageId === 'thing') return <ThingPage />;`
2. `routes/routeRegistry.js`: `thing: { title, section, description, requirements: [...] }`
3. `data/roles.js` `NAV_ITEMS`: `{ id: 'thing', label: 'Things', icon: SomeIcon, roles: ['admin','billing'], section: 'Finance' }` (add `hidden: true` for a page reachable by link but not listed). Import the icon from `lucide-react`.
4. Navigate with `dispatch({ type: 'NAVIGATE', pageId: 'thing' })`. The address is `#/app/thing`.

### 13. End-to-end test — `e2e/thing.spec.js`

```js
import { expect, test } from '@playwright/test';
import { openFromMenu, signIn, watchForCrashes } from './helpers.js';

test('a billing clerk creates a thing', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'billing', password: 'billing123' });
  await openFromMenu(page, 'Things');
  // …assert the DURABLE result (a row in a list), not the toast…
  crashes.assertNone();
});
```

Demo logins (facility `DEMO`): `admin/admin123`, `doctor/doctor123`,
`nurse/nurse123`, `pharmacist/pharmacist123`, `reception/reception123`,
`lab/lab123`, `scan/scan123`, `billing/billing123`.

**Test with a record you create in the test, not a seeded one.** Seeded patients
share their id with their display code, so a bug that confuses the two passes for
every demo patient and fails for every real one.

---

## Part 3 — Definition of done

Backend, all must pass: `npx prisma validate`, `npm run typecheck`,
`npm run lint` (0 errors), `npm run db:drift`, `npm test`,
`npm run test:integration`, `npm run build`.

Frontend, all must pass: `npm run build`, every `npm run lint:*` guard
(`lint:tailwind` catches dead opacity classes), `npm run test:e2e`.

The local database runs on `localhost:5434` — see `docs/DEV_DATABASE.md` in the backend repo.

## Part 4 — Mistakes that have already cost a day each

1. **"Done" left undefined.** Say exactly what *finished* means (a result is
   finished when **signed off**, not when submitted), or work falls into a gap
   where no list shows it.
2. **A screen that only works for demo data.** Walk a *newly created* record
   through every screen.
3. **Starting work without billing it.** The facility is then not paid.
4. **Two buttons in the same place, `type="button"` vs `type="submit"`.** Give
   them distinct `key`s or React reuses the element and the first click submits.
5. **The server sends it; the normalizer drops it.** List every field a screen
   needs and confirm each is in the normalizer.
6. **A refusal shown only as a toast.** Show it in the dialog, in words.
7. **Display code passed where the API wants the id.**
8. **Hard-coding a number the server owns** (a price, a limit, a size). Read it
   from the data; a stated size that disagrees with reality wastes an afternoon.
9. **A migration dated before an earlier one**, so triggers reference tables not
   yet created. Date it after the latest.
10. **Binary files** (images, `.dcm`) need `*.dcm binary` in `.gitattributes`;
    git line-ending conversion silently corrupts them.

## Part 5 — What to deliver

Every file **complete**, with its path above it, in the order of Parts 1 and 2.
Then a short note stating: the assumptions you made, the permissions you added
and which roles hold them, any new package (with the reason — none is best), and
anything you left undone. State assumptions up front; do not choose silently.
