import { expect, test } from '@playwright/test';
import { API, signInAsHospitalDoctor, tag, watchForCrashes } from './helpers.js';

/*
  Every screen a hospital doctor uses, on a phone and on a tablet.

  Each one must fit the screen: the page itself never scrolls sideways (a wide table may scroll
  inside its own box, which is deliberate). The menu is the phone drawer here, so this also proves
  every item in it can be reached on a small screen.
*/

const VIEWPORTS = [
  { name: 'phone', width: 375, height: 844 },
  { name: 'tablet', width: 768, height: 1024 }
];

const login = async (request, username, password) => (await (await request.post(`${API}/auth/login`, { data: { facilityCode: 'DEMO', username, password } })).json()).data.accessToken;
const auth = (token) => ({ headers: { authorization: `Bearer ${token}` } });

async function seed(request) {
  const t = tag();
  const [reception, nurse, doctor, admin] = [await login(request, 'reception', 'reception123'), await login(request, 'nurse', 'nurse123'), await login(request, 'doctor', 'doctor123'), await login(request, 'admin', 'admin123')];
  const patient = async (first) => (await (await request.post(`${API}/patients`, { ...auth(reception), data: { firstName: first, lastName: 'Layout', phone: `+2332000${Math.floor(10000 + Math.random() * 89999)}`, gender: 'FEMALE' } })).json()).data;
  const visit = async (patientId) => (await (await request.post(`${API}/encounters`, { ...auth(reception), data: { patientId, type: 'OPD', chiefComplaint: 'Headache with a very long description that must wrap rather than widen the page' } })).json()).data;
  const waiting = await patient(`Wait${t}`);
  const v = await visit(waiting.id);
  await request.post(`${API}/encounters/${v.id}/vitals`, { ...auth(nurse), data: { temperatureC: 37.9, pulseBpm: 88, triageLevel: 'YELLOW', completeTriage: true } });
  const ward = (await (await request.post(`${API}/inpatient/wards`, { ...auth(admin), data: { code: `L${t}`, name: `Layout ward ${t}`, type: 'GENERAL', gender: 'MIXED', dailyRate: 1, beds: ['L1'] } })).json()).data;
  const bed = (await (await request.get(`${API}/inpatient/wards`, auth(admin))).json()).data.items.find((w) => w.id === ward.id).beds[0];
  const inpatient = await patient(`Bed${t}`);
  const source = await visit(inpatient.id);
  await request.post(`${API}/encounters/${source.id}/start-consultation`, auth(doctor));
  await request.post(`${API}/encounters/${source.id}/diagnoses`, { ...auth(doctor), data: { code: 'J18.9', description: 'Pneumonia, unspecified', type: 'PRIMARY' } });
  const admitted = await request.post(`${API}/inpatient/admissions`, { ...auth(doctor), data: { patientId: inpatient.id, wardId: ward.id, bedId: bed.id, reason: 'Pneumonia', sourceEncounterId: source.id } });
  expect(admitted.status(), await admitted.text()).toBe(201);
  return { waiting: `Wait${t} Layout`, inpatient: `Bed${t} Layout` };
}

async function fits(page, where) {
  await expect(page.locator('#main-content')).not.toContainText('Loading page');
  await expect(page.locator('#main-content')).not.toContainText('Something interrupted this screen');
  const size = await page.evaluate(() => ({ viewport: window.innerWidth, page: document.documentElement.scrollWidth }));
  expect(size.page, `${where} scrolls sideways (${size.page}px wide on a ${size.viewport}px screen)`).toBeLessThanOrEqual(size.viewport + 1);
}

async function openFromDrawer(page, label) {
  await page.getByRole('button', { name: 'Open full navigation menu' }).click();
  const drawer = page.getByRole('dialog', { name: 'Mobile navigation' });
  await drawer.getByRole('button', { name: label, exact: true }).click();
  await expect(drawer).toBeHidden();
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} ${viewport.width}px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('every clinician screen fits the screen', async ({ page, request }) => {
      test.setTimeout(240_000);
      const crashes = watchForCrashes(page);
      const people = await seed(request);
      await signInAsHospitalDoctor(page);
      await fits(page, 'Clinician Queue');

      // A visit, all three tabs.
      await page.getByRole('button', { name: `Consult for ${people.waiting}` }).click();
      await expect(page.getByRole('heading', { name: people.waiting })).toBeVisible();
      for (const tab of ['Visit', 'Tests & Results', 'Medicines']) {
        await page.getByRole('tab', { name: new RegExp(tab) }).click();
        await fits(page, `Visit: ${tab}`);
      }
      await page.getByRole('button', { name: 'Back to queue' }).click();

      // The six menu items, through the phone drawer.
      for (const label of ['Patients', 'Emergency', 'Clinics', 'Messages', 'Wards']) {
        await openFromDrawer(page, label);
        await fits(page, label);
      }

      // A ward chart, all three tabs.
      await page.getByRole('button', { name: new RegExp(people.inpatient) }).click();
      await expect(page.getByRole('tab', { name: 'Round' })).toBeVisible();
      for (const tab of ['Round', 'Medicines', 'Results & orders']) {
        await page.getByRole('tab', { name: tab, exact: true }).click();
        await fits(page, `Ward chart: ${tab}`);
      }

      // More is reachable in the drawer too.
      await page.getByRole('button', { name: 'Open full navigation menu' }).click();
      const drawer = page.getByRole('dialog', { name: 'Mobile navigation' });
      await drawer.getByRole('button', { name: 'More', exact: true }).click();
      await drawer.getByRole('button', { name: 'Theatre List', exact: true }).click();
      await fits(page, 'Theatre List');
      crashes.assertNone();
    });
  });
}
