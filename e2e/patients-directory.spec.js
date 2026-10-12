import { expect, test } from '@playwright/test';
import { API, openFromMenu, signIn, tag, watchForCrashes } from './helpers.js';

/*
  The patients directory, a patient's record, and the document vault, end to end.

  A patient with a real history is built through the API (a finished visit with a note, a
  long-term diagnosis and a medicine), then the doctor finds them every way a clinician
  might, opens the record for a stated reason, reads the old visit, and files a document.
  The server's access log is checked at the end: opening a record must leave a trace.
*/

async function loginToken(request, username, password) {
  const res = await request.post(`${API}/auth/login`, { data: { facilityCode: 'DEMO', username, password } });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()).data.accessToken;
}
const auth = (token) => ({ headers: { authorization: `Bearer ${token}` } });

test('a doctor finds a patient, opens their record for a reason, and files a document', async ({ page, request }) => {
  const crashes = watchForCrashes(page);
  const t = tag();
  const first = `Dir${t}`;
  const card = `GHA-${t}-9`;
  const tokens = {};
  for (const [name, pass] of [['reception', 'reception123'], ['nurse', 'nurse123'], ['doctor', 'doctor123'], ['admin', 'admin123']]) tokens[name] = await loginToken(request, name, pass);

  /* ---- a patient with a history ---- */
  const created = await request.post(`${API}/patients`, {
    ...auth(tokens.reception),
    data: { firstName: first, lastName: 'Mensah', phone: `+2332412${Math.floor(10000 + Math.random() * 89999)}`, gender: 'FEMALE', dateOfBirth: '1982-06-15', nationalId: card }
  });
  expect(created.status(), await created.text()).toBe(201);
  const patientId = (await created.json()).data.id;
  await request.post(`${API}/patients/${patientId}/allergies`, { ...auth(tokens.nurse), data: { substance: 'Penicillin', reaction: 'Rash', severity: 'SEVERE' } });

  const visit = await request.post(`${API}/encounters`, { ...auth(tokens.reception), data: { patientId, type: 'OPD', chiefComplaint: 'Headaches and dizziness' } });
  const encounterId = (await visit.json()).data.id;
  await request.post(`${API}/encounters/${encounterId}/vitals`, { ...auth(tokens.nurse), data: { temperatureC: 36.8, pulseBpm: 80, systolicBp: 168, diastolicBp: 102, triageLevel: 'GREEN', completeTriage: true } });
  await request.post(`${API}/encounters/${encounterId}/start-consultation`, { ...auth(tokens.doctor), data: {} });
  await request.post(`${API}/encounters/${encounterId}/notes`, { ...auth(tokens.doctor), data: { subjective: 'Morning headaches for two weeks', assessment: 'Raised blood pressure', plan: 'Start treatment and review in a month' } });
  await request.post(`${API}/encounters/${encounterId}/diagnoses`, { ...auth(tokens.doctor), data: { code: 'I10', description: 'Hypertension', type: 'PRIMARY', isChronic: true } });
  const rx = await request.post(`${API}/encounters/${encounterId}/prescriptions`, { ...auth(tokens.doctor), data: { items: [{ drugName: 'Amlodipine', strength: '5 mg', dose: '5 mg', route: 'Oral', frequency: 'Once daily' }] } });
  expect(rx.status(), await rx.text()).toBe(201);
  const done = await request.post(`${API}/encounters/${encounterId}/complete`, { ...auth(tokens.doctor), data: { outcome: 'DISCHARGED' } });
  expect(done.status(), await done.text()).toBe(200);

  /* ---- finding them, every way a clinician might have them ---- */
  await signIn(page, { code: 'DEMO', username: 'doctor', password: 'doctor123' });
  await openFromMenu(page, 'Patients Directory');
  const search = page.getByLabel('Search patients');
  const row = page.getByRole('row').filter({ hasText: `${first} Mensah` });

  await search.fill('15/06/1982');
  await expect(row).toBeVisible();
  await search.fill(card);
  await expect(row).toBeVisible();
  await search.fill(`${first} mensah`);
  await expect(row).toBeVisible();
  await expect(row).toContainText('1 allergy');
  await expect(row).toContainText('Hypertension');
  await search.fill('');
  await page.getByRole('button', { name: 'Long-term conditions' }).click();
  await search.fill(first);
  await expect(row).toBeVisible();
  await page.getByRole('button', { name: 'Children (under 18)' }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole('button', { name: 'All patients' }).click();
  await expect(row).toBeVisible();

  /* ---- opening the record asks why ---- */
  await page.getByRole('button', { name: `View profile ${first} Mensah` }).click();
  const dialog = page.getByRole('dialog', { name: 'Open this record' });
  await expect(dialog).toContainText('logged');
  await dialog.getByLabel('Why are you opening it?').selectOption('OTHER');
  await expect(dialog.getByRole('button', { name: 'Open record' })).toBeDisabled();
  await dialog.getByLabel('Why are you opening it?').selectOption('TREATMENT');
  await dialog.getByRole('button', { name: 'Open record' }).click();

  /* ---- the summary flags, and the old visit ---- */
  await expect(page.getByRole('heading', { name: `${first} Mensah` })).toBeVisible();
  await expect(page.getByText('Opened for treatment · logged')).toBeVisible();
  const summary = page.getByLabel('Health summary');
  await expect(summary).toContainText('Penicillin');
  await expect(summary).toContainText('Hypertension');
  await expect(summary).toContainText('Amlodipine');

  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
    expect(widths.page, `Patient profile should not overflow at ${viewport.width}px`).toBeLessThanOrEqual(widths.viewport + 1);
    await expect(page.getByRole('heading', { name: `${first} Mensah` })).toBeVisible();
    await expect(summary).toBeVisible();
    await expect(page.getByRole('tab', { name: /Documents/ })).toBeVisible();
  }
  await page.setViewportSize({ width: 1366, height: 900 });

  await page.getByRole('button', { name: /Open the visit of/ }).click();
  const visitDialog = page.getByRole('dialog');
  await expect(visitDialog).toContainText('Morning headaches for two weeks');
  await expect(visitDialog).toContainText('Raised blood pressure');
  await expect(visitDialog).toContainText('Amlodipine');
  await expect(visitDialog).toContainText('168/102');
  await visitDialog.getByRole('button', { name: 'Close' }).first().click();

  /* ---- the document vault ---- */
  await page.getByRole('tab', { name: /^Documents/ }).click();
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n% referral letter\n'), Buffer.alloc(400, 5), Buffer.from('\n%%EOF')]);
  await page.locator('input[type="file"]').setInputFiles({ name: 'referral letter.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(page.getByLabel('Title', { exact: false }).first()).toHaveValue('referral letter');
  await page.getByRole('button', { name: 'File document' }).click();
  await expect(page.getByText('Document filed.')).toBeVisible();
  const filed = page.getByRole('listitem').filter({ hasText: 'referral letter' });
  await expect(filed).toContainText('Referral letter');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download referral letter' }).click()]);
  const bytes = Buffer.from(await (await import('node:fs/promises')).readFile(await download.path()));
  expect(bytes.equals(pdf), 'the downloaded file must be the one that was filed').toBe(true);

  // A web page dressed up as a PDF is refused, and says why.
  await page.locator('input[type="file"]').setInputFiles({ name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html><script>alert(1)</script></html>') });
  await page.getByRole('button', { name: 'File document' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Only PDF files and pictures' })).toBeVisible();

  /* ---- the trace: who opened this record, and why ---- */
  const log = await (await request.get(`${API}/records/patients/${patientId}/access-log`, auth(tokens.admin))).json();
  const entries = log.data.items;
  expect(entries.some((e) => e.purpose === 'TREATMENT' && e.user?.name?.includes('Abena') && !e.note?.startsWith('Visit'))).toBe(true);
  expect(entries.some((e) => (e.note || '').startsWith('Visit ENC-'))).toBe(true);

  crashes.assertNone();
});

test('billing has no way into the patients directory', async ({ page }) => {
  await signIn(page, { code: 'DEMO', username: 'billing', password: 'billing123' });
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Patients Directory', exact: true })).toHaveCount(0);
});
