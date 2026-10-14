import { expect, test } from '@playwright/test';
import { API, openFromMenu, signIn, signInAsHospitalDoctor, tag, watchForCrashes } from './helpers.js';

/*
  One patient, start to finish, across every desk that touches them.

  Reception registers her and the nurse triages her (through the API, as their own screens are
  covered elsewhere). From then on every hand-over is driven through the screens: the doctor sends
  her for a blood count and pauses the visit, the lab's sign-off brings her back to the queue, the
  doctor reviews the result and admits her, the nurse charts her fluids on the ward, the doctor
  discharges her, and the cashier finds the bill for her ward nights. Each person works in their
  own browser session, the way they would in the hospital.
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

// A step that cannot happen fails at that step, not at the end of the whole journey's time.
test.use({ actionTimeout: 20_000 });

test('a patient goes from reception to discharge and the bill', async ({ browser, request }) => {
  test.setTimeout(240_000);
  const t = tag();
  const first = `Journey${t}`;
  const name = `${first} Mensah`;
  const tokens = {};
  for (const [user, pass] of [['reception', 'reception123'], ['nurse', 'nurse123'], ['doctor', 'doctor123'], ['lab', 'lab123'], ['admin', 'admin123']]) tokens[user] = await login(request, user, pass);

  // A ward of her own, so the bed is certainly free.
  const created = await ok(await request.post(`${API}/inpatient/wards`, { ...auth(tokens.admin), data: { code: `J${t}`, name: `Journey ward ${t}`, type: 'GENERAL', gender: 'MIXED', dailyRate: 150, beds: ['J1', 'J2'] } }), 201);

  // Reception and triage.
  const patient = await ok(await request.post(`${API}/patients`, { ...auth(tokens.reception), data: { firstName: first, lastName: 'Mensah', phone: `+2332000${Math.floor(10000 + Math.random() * 89999)}`, gender: 'FEMALE' } }), 201);
  const visit = await ok(await request.post(`${API}/encounters`, { ...auth(tokens.reception), data: { patientId: patient.id, type: 'OPD', chiefComplaint: 'Fever and breathlessness' } }), 201);
  await ok(await request.post(`${API}/encounters/${visit.id}/vitals`, { ...auth(tokens.nurse), data: { temperatureC: 39.1, pulseBpm: 112, respiratoryRate: 26, triageLevel: 'ORANGE', completeTriage: true } }), 201);

  const contexts = [];
  const open = async () => {
    const context = await browser.newContext();
    contexts.push(context);
    const page = await context.newPage();
    return { page, crashes: watchForCrashes(page) };
  };

  try {
    /* ---- The doctor sees her, sends her for a blood count and pauses the visit ---- */
    const doctor = await open();
    let page = doctor.page;
    await signInAsHospitalDoctor(page);
    await page.getByRole('button', { name: `Consult for ${name}` }).click();
    await expect(page.getByRole('heading', { name })).toBeVisible();
    await ok(await request.post(`${API}/encounters/${visit.id}/diagnoses`, { ...auth(tokens.doctor), data: { code: 'J18.9', description: 'Pneumonia, unspecified', type: 'PRIMARY' } }), 201);

    await page.getByRole('tab', { name: /Tests & Results/ }).click();
    await page.getByRole('textbox', { name: /Search diagnostic tests/ }).fill('Full Blood');
    await page.getByRole('checkbox', { name: /Full Blood Count/ }).first().check();
    await expect(page.getByText('1 waiting to be sent')).toBeVisible();
    await page.getByRole('button', { name: /Send to Diagnostics & Suspend/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Send and suspend' }).click();

    await page.getByRole('tab', { name: /Awaiting results/ }).click();
    await expect(page.getByRole('row').filter({ hasText: name })).toContainText('0 of 1 back');

    /* ---- The lab signs the result off; she comes back to the doctor on her own ---- */
    const record = await ok(await request.get(`${API}/encounters/${visit.id}`, auth(tokens.doctor)), 200);
    const accepted = await ok(await request.post(`${API}/lab/samples/accept`, { ...auth(tokens.lab), data: { orderId: record.orders[0].id } }), 201);
    const draft = await ok(await request.post(`${API}/lab/results`, { ...auth(tokens.lab), data: { sampleId: accepted.samples[0].id, parameters: [{ name: 'White cell count', value: '17.2', unit: 'x10^9/L' }] } }), 201);
    await request.post(`${API}/lab/results/submit-review`, { ...auth(tokens.lab), data: { resultId: draft.id } });
    await ok(await request.post(`${API}/lab/results/${draft.id}/sign-off`, { ...auth(tokens.lab), data: { decision: 'SIGNED_OFF' } }), 200);

    await page.getByRole('button', { name: 'Refresh the queue' }).click();
    await expect(page.getByText(`Results are back for ${name}.`)).toBeVisible();
    await page.getByRole('tab', { name: /Ready to review/ }).click();
    await page.getByRole('button', { name: `Review results for ${name}` }).click();
    await expect(page.getByRole('tab', { name: /Tests & Results/, selected: true })).toBeVisible();
    await expect(page.getByText('17.2').first()).toBeVisible();

    /* ---- She is admitted from the visit ---- */
    await page.getByRole('button', { name: 'Finish visit' }).click();
    await page.getByRole('radio', { name: /Admit to ward/ }).click();
    await page.getByRole('button', { name: 'Admit to Ward' }).click();
    const admit = page.getByRole('dialog', { name: 'Admit to ward' });
    await admit.getByLabel(/^Ward/).selectOption(created.id);
    await admit.getByLabel(/^Bed/).selectOption({ label: 'J1' });
    await admit.getByLabel(/^Reason for admission/).fill('Pneumonia needing IV antibiotics');
    await admit.getByRole('button', { name: 'Admit', exact: true }).click();
    await expect(page.getByText(/Admitted to Journey ward .*, bed J1/)).toBeVisible();
    doctor.crashes.assertNone();

    /* ---- The nurse finds her on the ward and charts her fluids ---- */
    const nurse = await open();
    page = nurse.page;
    await signIn(page, { code: 'DEMO', username: 'nurse', password: 'nurse123' });
    await openFromMenu(page, 'Ward Board');
    await page.getByRole('button', { name: new RegExp(`${name}, Pneumonia, unspecified, day 1`) }).click();
    await expect(page.getByRole('tab', { name: 'Round', selected: true })).toBeVisible();
    await page.getByLabel('Volume (mL)').fill('1000');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(page.getByText('Intake of 1000 mL recorded.')).toBeVisible();
    nurse.crashes.assertNone();

    /* ---- The doctor discharges her; the bed goes for cleaning ---- */
    page = doctor.page;
    await openFromMenu(page, 'Wards');
    await page.getByRole('button', { name: new RegExp(`${name}, Pneumonia`) }).click();
    await page.getByRole('group', { name: 'Ward actions' }).getByRole('button', { name: 'Discharge' }).click();
    const discharge = page.getByRole('dialog', { name: 'Discharge' });
    await discharge.getByLabel(/^Discharge summary/).fill('Pneumonia treated with IV antibiotics; home on oral amoxicillin, review in one week.');
    await discharge.getByRole('button', { name: 'Discharge' }).click();
    await expect(page.getByText('Patient discharged. The bed is marked for cleaning.')).toBeVisible();
    const wards = await ok(await request.get(`${API}/inpatient/wards`, auth(tokens.nurse)), 200);
    expect(wards.items.find((w) => w.id === created.id).beds.find((b) => b.label === 'J1').status).toBe('CLEANING');
    doctor.crashes.assertNone();

    /* ---- The cashier finds her bill for the ward nights ---- */
    const cashier = await open();
    page = cashier.page;
    await signIn(page, { code: 'DEMO', username: 'billing', password: 'billing123' });
    await openFromMenu(page, 'Invoices');
    await expect(page.getByRole('row').filter({ hasText: name }).first()).toBeVisible();
    cashier.crashes.assertNone();
  } finally {
    for (const context of contexts) await context.close();
  }
});
