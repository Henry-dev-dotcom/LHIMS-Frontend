import { expect, test } from '@playwright/test';
import { API, signInAsHospitalDoctor, tag, watchForCrashes } from './helpers.js';

/*
  Prescribing and finishing a visit.

  The suggestions are shortcuts, so what is checked here is mostly what they must not do:
  fill in a child's dose, sneak a medicine past a recorded allergy, or let a visit close with
  tests nobody sent.
*/

async function loginToken(request, username, password) {
  const res = await request.post(`${API}/auth/login`, { data: { facilityCode: 'DEMO', username, password } });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()).data.accessToken;
}
const auth = (token) => ({ headers: { authorization: `Bearer ${token}` } });

async function tokensFor(request) {
  const tokens = {};
  for (const [name, pass] of [['reception', 'reception123'], ['nurse', 'nurse123'], ['doctor', 'doctor123']]) tokens[name] = await loginToken(request, name, pass);
  return tokens;
}

/** A patient the doctor is already seeing, with a diagnosis recorded. */
async function consultingPatient(request, tokens, { first, dateOfBirth, allergy, code = 'B54', description = 'Malaria' }) {
  const patient = await request.post(`${API}/patients`, {
    ...auth(tokens.reception),
    data: { firstName: first, lastName: 'Patient', phone: `+2332000${Math.floor(10000 + Math.random() * 89999)}`, gender: 'MALE', dateOfBirth }
  });
  expect(patient.status(), await patient.text()).toBe(201);
  const patientId = (await patient.json()).data.id;
  if (allergy) {
    await request.post(`${API}/patients/${patientId}/allergies`, { ...auth(tokens.nurse), data: { substance: allergy, reaction: 'Rash', severity: 'SEVERE' } });
  }
  const visit = await request.post(`${API}/encounters`, { ...auth(tokens.reception), data: { patientId, type: 'OPD', chiefComplaint: 'Fever and chills' } });
  expect(visit.status(), await visit.text()).toBe(201);
  const encounterId = (await visit.json()).data.id;
  const triaged = await request.post(`${API}/encounters/${encounterId}/vitals`, { ...auth(tokens.nurse), data: { temperatureC: 38.6, pulseBpm: 96, triageLevel: 'YELLOW', completeTriage: true } });
  expect(triaged.status(), await triaged.text()).toBe(201);
  await request.post(`${API}/encounters/${encounterId}/start-consultation`, { ...auth(tokens.doctor), data: {} });
  await request.post(`${API}/encounters/${encounterId}/diagnoses`, { ...auth(tokens.doctor), data: { code, description, type: 'PRIMARY' } });
  return { patientId, encounterId };
}

async function openMyConsultation(page, first) {
  await signInAsHospitalDoctor(page);
  await page.getByRole('tab', { name: /My Consultations/ }).click();
  await page.getByRole('button', { name: `Continue ${first} Patient` }).click();
}

test('a doctor prescribes from suggestions, overrides an allergy with a reason, and refers the patient', async ({ page, request }) => {
  const crashes = watchForCrashes(page);
  const tokens = await tokensFor(request);
  const first = `Rx${tag()}`;
  const { encounterId } = await consultingPatient(request, tokens, { first, dateOfBirth: '1990-05-05', allergy: 'Penicillin' });
  await openMyConsultation(page, first);

  /* ---- suggestions come from the diagnosis, with the adult dose filled in ---- */
  await page.getByRole('tab', { name: /^Prescriptions/ }).click();
  const suggestion = page.getByRole('listitem').filter({ hasText: 'Artemether-lumefantrine' }).first();
  await expect(suggestion).toContainText('4 tablets');
  await expect(suggestion).toContainText('in stock');
  await page.getByRole('button', { name: 'Approve and add Artemether-lumefantrine' }).click();
  await page.getByRole('button', { name: 'Approve and add Paracetamol' }).click();
  // Approved suggestions are not offered again.
  await expect(page.getByRole('button', { name: 'Approve and add Paracetamol' })).toHaveCount(0);
  await expect(page.locator('[aria-label="Medicine 1"]').getByRole('textbox', { name: /^Dose/ })).toHaveValue('4 tablets');

  /* ---- an unsafe medicine is stopped, and only goes ahead with a recorded reason ---- */
  await page.getByRole('button', { name: 'Another medicine' }).click();
  const third = page.locator('[aria-label="Medicine 3"]');
  await third.getByRole('textbox', { name: /^Medicine/ }).fill('Amoxicillin');
  await third.getByRole('textbox', { name: /^Dose/ }).fill('500 mg');
  await third.getByRole('textbox', { name: /^Frequency/ }).fill('Three times daily');
  await page.getByRole('button', { name: 'Send to pharmacy' }).click();
  const warning = page.getByRole('dialog', { name: 'Allergy warning' });
  await expect(warning).toBeVisible();
  await expect(warning.getByRole('button', { name: 'Prescribe anyway' })).toBeDisabled();
  await warning.getByLabel(/Reason for prescribing anyway/).fill('Tolerated amoxicillin before; documented in the notes');
  await warning.getByRole('button', { name: 'Prescribe anyway' }).click();
  await expect(page.getByText('Prescribed on this visit')).toBeVisible();
  const issued = await (await request.get(`${API}/encounters/${encounterId}`, auth(tokens.doctor))).json();
  expect(issued.data.prescriptions.at(0).allergyOverride).toContain('Tolerated');
  expect(issued.data.prescriptions.at(0).items).toHaveLength(3);

  /* ---- disposition: refer, with follow-up words ---- */
  await page.getByRole('tab', { name: /Disposition/ }).click();
  await page.getByRole('radio', { name: /Refer/ }).click();
  await page.getByLabel('Referred to').fill('Korle Bu Teaching Hospital, Medicine');
  await page.getByLabel('Reason for referral').fill('Persistent fever despite treatment');
  await page.getByLabel('Follow-up instructions').fill('Return in 3 days or sooner if the fever returns.');
  await page.getByRole('button', { name: 'Complete & Refer' }).click();
  const confirm = page.getByRole('dialog', { name: 'Complete this visit' });
  await expect(confirm).toContainText('Refer');
  await expect(confirm).toContainText('Korle Bu Teaching Hospital');
  await confirm.getByRole('button', { name: 'Complete visit' }).click();

  await expect(page.getByRole('tab', { name: /New Patients/ })).toBeVisible();
  const done = await (await request.get(`${API}/encounters/${encounterId}`, auth(tokens.doctor))).json();
  expect(done.data.status).toBe('COMPLETED');
  expect(done.data.outcome).toBe('REFERRED');
  const summary = done.data.notes.find((n) => n.type === 'DISCHARGE').plan;
  expect(summary).toContain('Referred to Korle Bu Teaching Hospital, Medicine: Persistent fever despite treatment.');
  expect(summary).toContain('Follow-up: Return in 3 days');
  crashes.assertNone();
});

test('the doctor cannot close a visit with tests still waiting to be sent', async ({ page, request }) => {
  const tokens = await tokensFor(request);
  const first = `Guard${tag()}`;
  const { encounterId } = await consultingPatient(request, tokens, { first, dateOfBirth: '1985-02-02' });
  await openMyConsultation(page, first);
  await page.getByRole('tab', { name: /Investigations/ }).click();
  await page.getByRole('button', { name: /Chest review/ }).click();

  await page.getByRole('button', { name: 'Complete & Discharge' }).click();
  const confirm = page.getByRole('dialog', { name: 'Complete this visit' });
  await expect(confirm).toContainText('waiting to be sent');
  await expect(confirm.getByRole('button', { name: 'Complete visit' })).toBeDisabled();
  await confirm.getByRole('button', { name: 'Not yet' }).click();

  const stillOpen = await (await request.get(`${API}/encounters/${encounterId}`, auth(tokens.doctor))).json();
  expect(stillOpen.data.status).toBe('IN_CONSULTATION');
});

test('a child gets no pre-filled dose, and cannot be sent a medicine without one', async ({ page, request }) => {
  const tokens = await tokensFor(request);
  const first = `Kid${tag()}`;
  const born = new Date(Date.now() - 4 * 365 * 86_400_000).toISOString().slice(0, 10);
  await consultingPatient(request, tokens, { first, dateOfBirth: born });
  await openMyConsultation(page, first);
  await page.getByRole('tab', { name: /^Prescriptions/ }).click();

  const suggestion = page.getByRole('listitem').filter({ hasText: 'Paracetamol' }).first();
  await expect(suggestion).toContainText('This patient is under 12');
  await page.getByRole('button', { name: 'Approve and add Paracetamol' }).click();
  const dose = page.locator('[aria-label="Medicine 1"]').getByRole('textbox', { name: /^Dose/ });
  await expect(dose).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Send to pharmacy' })).toBeDisabled();
  await dose.fill('250 mg');
  await expect(page.getByRole('button', { name: 'Send to pharmacy' })).toBeEnabled();
});
