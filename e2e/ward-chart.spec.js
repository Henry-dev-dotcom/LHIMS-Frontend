import { expect, test } from '@playwright/test';
import { API, openFromMenu, signIn, tag, watchForCrashes } from './helpers.js';

/*
  The ward whiteboard and a patient's stay, end to end.

  A patient is admitted to a ward of their own and given a medicine. The screens are then driven
  the way a ward does it: the board shows a red dot for the doses nobody has recorded, a nurse
  ticks them on the medication chart (with a confirmation, and a reason when a dose is held),
  the dot clears, fluids are charted and totalled, a signed-off result turns the yellow dot on,
  and a doctor writes the round's note and marks the result reviewed.
*/

async function loginToken(request, username, password) {
  const res = await request.post(`${API}/auth/login`, { data: { facilityCode: 'DEMO', username, password } });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()).data.accessToken;
}
const auth = (token) => ({ headers: { authorization: `Bearer ${token}` } });
const ok = async (res, status) => {
  expect(res.status(), await res.text()).toBe(status);
  return (await res.json()).data;
};

test('a ward round: red dot, tick the doses, fluids, rounds note, results reviewed', async ({ page: nursePage, browser, request }) => {
  let page = nursePage;
  const crashes = watchForCrashes(page);
  const t = tag();
  const tokens = {};
  for (const [name, pass] of [['reception', 'reception123'], ['nurse', 'nurse123'], ['doctor', 'doctor123'], ['admin', 'admin123'], ['lab', 'lab123']]) tokens[name] = await loginToken(request, name, pass);

  // A ward and a patient admitted to it.
  const created = await ok(await request.post(`${API}/inpatient/wards`, { ...auth(tokens.admin), data: { code: `E${t}`, name: `Round ward ${t}`, type: 'GENERAL', gender: 'MIXED', dailyRate: 10, beds: ['R1', 'R2'] } }), 201);
  const listed = await ok(await request.get(`${API}/inpatient/wards`, auth(tokens.nurse)), 200);
  const ward = listed.items.find((w) => w.id === created.id);
  const first = `Round${t}`;
  const patient = await ok(await request.post(`${API}/patients`, { ...auth(tokens.reception), data: { firstName: first, lastName: 'Ward', phone: `+2332000${Math.floor(10000 + Math.random() * 89999)}`, gender: 'FEMALE' } }), 201);
  const visit = await ok(await request.post(`${API}/encounters`, { ...auth(tokens.reception), data: { patientId: patient.id, type: 'OPD', chiefComplaint: 'Cough and fever' } }), 201);
  await request.post(`${API}/encounters/${visit.id}/start-consultation`, auth(tokens.doctor));
  await ok(await request.post(`${API}/encounters/${visit.id}/diagnoses`, { ...auth(tokens.doctor), data: { code: 'J18.9', description: 'Pneumonia, unspecified', type: 'PRIMARY' } }), 201);
  const admission = await ok(await request.post(`${API}/inpatient/admissions`, { ...auth(tokens.doctor), data: { patientId: patient.id, wardId: ward.id, bedId: ward.beds[0].id, reason: 'Pneumonia needing IV antibiotics', sourceEncounterId: visit.id } }), 201);

  // Four doses a day: whatever the hour, one of them is open right now, so the bed must show red.
  await ok(await request.post(`${API}/encounters/${admission.encounter.id}/prescriptions`, { ...auth(tokens.doctor), data: { items: [{ drugName: 'Ceftriaxone', dose: '1 g', route: 'IV', frequency: 'Four times daily', durationDays: 5 }] } }), 201);

  await signIn(page, { code: 'DEMO', username: 'nurse', password: 'nurse123' });
  await openFromMenu(page, 'Ward Board');

  const tile = page.getByRole('button', { name: new RegExp(`${first} Ward, Pneumonia, unspecified, day 1.*Needs attention: .*dose`) });
  await expect(tile).toBeVisible({ timeout: 45_000 });
  await expect(tile.locator('[data-dot="red"]')).toBeVisible();
  await expect(tile.locator('[data-dot="yellow"]')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: `Round ward ${t}` })).toBeVisible();

  // Open the stay: four working tabs and the action bar.
  await tile.click();
  await expect(page.getByRole('heading', { name: `${first} Ward` })).toBeVisible();
  for (const name of ['Vitals & flowsheet', "Doctor's rounds", 'Medication chart', 'Orders & results']) await expect(page.getByRole('tab', { name })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Ward actions' })).toBeVisible();

  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
    expect(widths.page, `Inpatient chart should not overflow at ${viewport.width}px`).toBeLessThanOrEqual(widths.viewport + 1);
    await expect(page.getByRole('heading', { name: `${first} Ward` })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Vitals & flowsheet' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Ward actions' })).toBeVisible();
  }
  await page.setViewportSize({ width: 1366, height: 900 });

  // Fluid balance: in 500 + 250, out 300.
  const volume = page.getByLabel('Volume (mL)');
  await volume.fill('500');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Intake of 500 mL recorded.')).toBeVisible();
  await volume.fill('250');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Intake of 250 mL recorded.')).toBeVisible();
  await page.getByLabel('Type').selectOption('OUTPUT');
  await volume.fill('300');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Output of 300 mL recorded.')).toBeVisible();
  const todayRow = page.getByRole('row', { name: /Today/ });
  await expect(todayRow).toContainText('750 mL');
  await expect(todayRow).toContainText('300 mL');
  await expect(todayRow).toContainText('+450 mL');

  // Medication chart: a held dose needs a reason; every other open box is ticked with its confirmation.
  await page.getByRole('tab', { name: 'Medication chart' }).click();
  await expect(page.getByRole('row', { name: /Ceftriaxone/ })).toBeVisible();
  const open = page.getByRole('button', { name: /Ceftriaxone.*: (due now|overdue)$/i });
  await expect(open.first()).toBeVisible();

  await open.first().click();
  let dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(`${first} Ward`);
  await dialog.getByLabel('What happened').selectOption('HELD');
  await expect(dialog.getByRole('button', { name: 'Record held' })).toBeDisabled();
  await dialog.getByLabel('Reason').fill('Patient nil by mouth for a scan');
  await dialog.getByRole('button', { name: 'Record held' }).click();
  await expect(page.getByText('Ceftriaxone: held recorded.')).toBeVisible();

  while (await open.count()) {
    await open.first().click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Confirm given' }).click();
    await expect(dialog).toBeHidden();
  }

  // Back on the board the red dot has cleared: every open dose is recorded.
  await page.getByRole('button', { name: 'Back to wards' }).click();
  const calm = page.getByRole('button', { name: new RegExp(`${first} Ward, Pneumonia, unspecified, day 1`) });
  await expect(calm).toBeVisible();
  await expect(calm.locator('[data-dot="red"]')).toHaveCount(0);

  // The lab signs off a result: the yellow dot comes on until a doctor reviews it.
  const ordered = await ok(await request.post(`${API}/encounters/${admission.encounter.id}/orders`, { ...auth(tokens.doctor), data: { items: [{ catalogItemId: 't1' }] } }), 201);
  const accepted = await ok(await request.post(`${API}/lab/samples/accept`, { ...auth(tokens.lab), data: { orderId: ordered.orders.at(-1).id } }), 201);
  const draft = await ok(await request.post(`${API}/lab/results`, { ...auth(tokens.lab), data: { sampleId: accepted.samples[0].id, parameters: [{ name: 'Haemoglobin', value: '11.9', unit: 'g/dL' }] } }), 201);
  await request.post(`${API}/lab/results/submit-review`, { ...auth(tokens.lab), data: { resultId: draft.id } });
  await ok(await request.post(`${API}/lab/results/${draft.id}/sign-off`, { ...auth(tokens.lab), data: { decision: 'SIGNED_OFF' } }), 200);

  // The doctor works from their own browser session.
  page = await (await browser.newContext()).newPage();
  const doctorCrashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'doctor', password: 'doctor123' });
  await openFromMenu(page, 'Ward Board');
  const flagged = page.getByRole('button', { name: new RegExp(`${first} Ward.*1 new result to review`) });
  await expect(flagged.locator('[data-dot="yellow"]')).toBeVisible();
  await flagged.click();

  // Doctor's rounds: nothing from an earlier day to copy yet; write today's note.
  await page.getByRole('tab', { name: "Doctor's rounds" }).click();
  await expect(page.getByRole('button', { name: /Copy yesterday/ })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Assessment' }).fill('Improving on IV antibiotics.');
  await expect(page.getByText('Not saved yet')).toBeVisible();
  await page.getByRole('button', { name: 'Save note' }).click();
  await expect(page.getByText('Note saved.')).toBeVisible();
  await expect(page.getByText('Improving on IV antibiotics.').first()).toBeVisible();

  // Orders & results: review the result, and the dot is gone.
  await page.getByRole('tab', { name: 'Orders & results' }).click();
  await expect(page.getByText('1 new result', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Mark results reviewed' }).click();
  await expect(page.getByText('Results marked as reviewed.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to wards' }).click();
  const reviewed = page.getByRole('button', { name: new RegExp(`${first} Ward, Pneumonia, unspecified`) });
  await expect(reviewed).toBeVisible();
  await expect(reviewed.locator('[data-dot="yellow"]')).toHaveCount(0);

  // Transfer bed and discharge stay on the action bar.
  await reviewed.click();
  await expect(page.getByRole('button', { name: 'Transfer bed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Discharge' })).toBeVisible();
  crashes.assertNone();
  doctorCrashes.assertNone();
});
