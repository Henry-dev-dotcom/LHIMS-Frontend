import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { API, openFromMenu, signInAsHospitalDoctor, tag, watchForCrashes } from './helpers.js';

/*
  The clinician's screens, checked by an accessibility scanner in both themes.

  Every screen a hospital doctor works in - the queue, all three tabs of a visit, patients, the
  ward board, all three tabs of a ward chart, emergency, clinics and messages - is scanned against
  WCAG 2.1 A and AA. Patients are waiting at every triage level, so each triage colour is on the
  screen being checked. Any serious or critical finding fails the test and names the rule and
  where it was found.
*/

const login = async (request, username, password) => {
  const res = await request.post(`${API}/auth/login`, { data: { facilityCode: 'DEMO', username, password } });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()).data.accessToken;
};
const auth = (token) => ({ headers: { authorization: `Bearer ${token}` } });
const ok = async (res, status) => {
  expect(res.status(), await res.text()).toBe(status);
  return (await res.json()).data;
};

async function seed(request) {
  const t = tag();
  const [reception, nurse, doctor, admin] = [
    await login(request, 'reception', 'reception123'),
    await login(request, 'nurse', 'nurse123'),
    await login(request, 'doctor', 'doctor123'),
    await login(request, 'admin', 'admin123')
  ];
  const patient = async (first, gender) => ok(await request.post(`${API}/patients`, { ...auth(reception), data: { firstName: first, lastName: 'Scan', phone: `+2332000${Math.floor(10000 + Math.random() * 89999)}`, gender } }), 201);
  const visit = async (patientId, complaint) => ok(await request.post(`${API}/encounters`, { ...auth(reception), data: { patientId, type: 'OPD', chiefComplaint: complaint } }), 201);

  // One patient waiting at each triage colour.
  const waiting = [];
  for (const level of ['RED', 'ORANGE', 'YELLOW', 'GREEN']) {
    const p = await patient(`${level[0]}${level.slice(1).toLowerCase()}${t}`, 'FEMALE');
    const v = await visit(p.id, 'Fever and cough');
    await ok(await request.post(`${API}/encounters/${v.id}/vitals`, { ...auth(nurse), data: { temperatureC: 38.2, pulseBpm: 94, triageLevel: level, completeTriage: true } }), 201);
    waiting.push(`${p.firstName} Scan`);
  }

  // One patient on a ward.
  const ward = await ok(await request.post(`${API}/inpatient/wards`, { ...auth(admin), data: { code: `A${t}`, name: `Scan ward ${t}`, type: 'GENERAL', gender: 'MIXED', dailyRate: 1, beds: ['S1'] } }), 201);
  const listed = (await ok(await request.get(`${API}/inpatient/wards`, auth(admin)), 200)).items.find((w) => w.id === ward.id);
  const inpatient = await patient(`Ward${t}`, 'MALE');
  const source = await visit(inpatient.id, 'Breathless');
  await request.post(`${API}/encounters/${source.id}/start-consultation`, auth(doctor));
  await ok(await request.post(`${API}/encounters/${source.id}/diagnoses`, { ...auth(doctor), data: { code: 'J18.9', description: 'Pneumonia, unspecified', type: 'PRIMARY' } }), 201);
  await ok(await request.post(`${API}/inpatient/admissions`, { ...auth(doctor), data: { patientId: inpatient.id, wardId: ward.id, bedId: listed.beds[0].id, reason: 'Pneumonia', sourceEncounterId: source.id } }), 201);
  return { waiting, inpatient: `Ward${t} Scan` };
}

for (const theme of ['light', 'dark']) {
  test(`the clinician's screens pass an accessibility scan (${theme} theme)`, async ({ page, request }) => {
    test.setTimeout(240_000);
    const crashes = watchForCrashes(page);
    const people = await seed(request);
    await page.addInitScript((chosen) => {
      try {
        window.localStorage.setItem('curatamed-theme', chosen);
      } catch {
        // A theme that cannot be stored falls back to the system one; the scan still runs.
      }
    }, theme);

    const findings = [];
    const scan = async (screen) => {
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      for (const v of result.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical')) {
        findings.push(`${screen}: ${v.id} (${v.impact}) x${v.nodes.length} - ${v.help} - e.g. ${v.nodes[0]?.target.join(' ')}`);
      }
    };

    await signInAsHospitalDoctor(page);
    await expect(page.getByRole('row').filter({ hasText: people.waiting[0] })).toBeVisible();
    await scan('queue');

    await page.getByRole('button', { name: `Consult for ${people.waiting[1]}` }).click();
    await expect(page.getByRole('tab', { name: 'Visit' })).toBeVisible();
    await scan('visit: Visit tab');
    await page.getByRole('tab', { name: /Tests & Results/ }).click();
    await expect(page.getByRole('button', { name: /Acute fever panel/ })).toBeVisible();
    await scan('visit: Tests & Results tab');
    await page.getByRole('tab', { name: 'Medicines' }).click();
    await scan('visit: Medicines tab');
    await page.getByRole('button', { name: 'Back to queue' }).click();

    await openFromMenu(page, 'Patients');
    await scan('patients');
    await openFromMenu(page, 'Wards');
    const tile = page.getByRole('button', { name: new RegExp(people.inpatient) });
    await expect(tile).toBeVisible();
    await scan('ward board');
    await tile.click();
    await expect(page.getByRole('heading', { name: 'Fluid balance' })).toBeVisible();
    await scan('ward chart: Round tab');
    await page.getByRole('tab', { name: 'Medicines' }).click();
    await expect(page.getByRole('heading', { name: 'Medication chart' })).toBeVisible();
    await scan('ward chart: Medicines tab');
    await page.getByRole('tab', { name: 'Results & orders' }).click();
    await scan('ward chart: Results & orders tab');
    await page.getByRole('button', { name: 'Back to wards' }).click();

    for (const item of ['Emergency', 'Clinics', 'Messages']) {
      await openFromMenu(page, item);
      await expect(page.locator('#main-content')).not.toContainText('Loading page');
      await scan(item.toLowerCase());
    }

    expect(findings, `Accessibility findings:\n${findings.join('\n')}`).toEqual([]);
    crashes.assertNone();
  });
}
