import { expect, test } from '@playwright/test';
import { API, signIn, signInAsHospitalDoctor, tag, watchForCrashes } from './helpers.js';

/*
  The clinician's queue, end to end.

  A patient is registered and triaged, the doctor picks them up, sends them for a test,
  and the lab signs the result off - and the patient moves New Patients -> Pending Labs ->
  Review Ready on their own, with the doctor told. The lab and the clinician's queue are
  driven through the real API, so this proves the two screens agree with the server rather
  than with each other.
*/

async function loginToken(request, username, password) {
  const res = await request.post(`${API}/auth/login`, { data: { facilityCode: 'DEMO', username, password } });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()).data.accessToken;
}
const auth = (token) => ({ headers: { authorization: `Bearer ${token}` } });

test('a patient moves through the clinician queue as their tests go out and come back', async ({ page, request }) => {
  const crashes = watchForCrashes(page);
  const t = tag();
  const first = `Queue${t}`;
  const reception = await loginToken(request, 'reception', 'reception123');
  const nurse = await loginToken(request, 'nurse', 'nurse123');
  const doctor = await loginToken(request, 'doctor', 'doctor123');
  const lab = await loginToken(request, 'lab', 'lab123');

  // A patient who has been registered and triaged, waiting for a doctor.
  const patient = await request.post(`${API}/patients`, { ...auth(reception), data: { firstName: first, lastName: 'Patient', phone: `+2332000${Math.floor(10000 + Math.random() * 89999)}`, gender: 'MALE' } });
  expect(patient.status(), await patient.text()).toBe(201);
  const patientId = (await patient.json()).data.id;
  const visit = await request.post(`${API}/encounters`, { ...auth(reception), data: { patientId, type: 'OPD', chiefComplaint: 'Severe headache and fever' } });
  expect(visit.status(), await visit.text()).toBe(201);
  const encounterId = (await visit.json()).data.id;
  const triaged = await request.post(`${API}/encounters/${encounterId}/vitals`, { ...auth(nurse), data: { temperatureC: 38.6, pulseBpm: 96, triageLevel: 'YELLOW', completeTriage: true } });
  expect(triaged.status(), await triaged.text()).toBe(201);

  // The doctor signs in and lands on their queue.
  await signInAsHospitalDoctor(page);
  await expect(page.getByRole('tab', { name: /New Patients/ })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: `${first} Patient` })).toBeVisible();

  // Consult: the consultation starts and the visit workspace opens.
  await page.getByRole('button', { name: `Consult ${first} Patient` }).click();
  await expect(page.getByRole('heading', { name: `${first} Patient` })).toBeVisible();
  await page.getByRole('button', { name: /Back to queue/ }).click();

  // Now they are "my consultation", and not waiting any more.
  await page.getByRole('tab', { name: /My Consultations/ }).click();
  await expect(page.getByRole('row').filter({ hasText: `${first} Patient` })).toBeVisible();

  // Sent for a test and paused: they appear under Pending Labs, with progress.
  const ordered = await request.post(`${API}/encounters/${encounterId}/orders`, { ...auth(doctor), data: { items: [{ catalogItemId: 't1' }], urgency: 'URGENT' } });
  expect(ordered.status(), await ordered.text()).toBe(201);
  const orderId = (await ordered.json()).data.orders[0].id;
  expect((await request.post(`${API}/encounters/${encounterId}/suspend`, { ...auth(doctor), data: {} })).status()).toBe(200);

  await page.getByRole('button', { name: 'Refresh the queue' }).click();
  await page.getByRole('tab', { name: /Pending Labs/ }).click();
  const pendingRow = page.getByRole('row').filter({ hasText: `${first} Patient` });
  await expect(pendingRow).toContainText('0 of 1 back');
  await expect(pendingRow).toContainText('Full Blood Count');

  // The lab signs the result off. Nothing on the doctor's side is told except by the server.
  const accepted = await request.post(`${API}/lab/samples/accept`, { ...auth(lab), data: { orderId } });
  expect(accepted.status(), await accepted.text()).toBe(201);
  const sampleId = (await accepted.json()).data.samples[0].id;
  const draft = await request.post(`${API}/lab/results`, { ...auth(lab), data: { sampleId, parameters: [{ name: 'Haemoglobin', value: '12.8', unit: 'g/dL' }] } });
  expect(draft.status(), await draft.text()).toBe(201);
  const resultId = (await draft.json()).data.id;
  await request.post(`${API}/lab/results/submit-review`, { ...auth(lab), data: { resultId } });
  const signed = await request.post(`${API}/lab/results/${resultId}/sign-off`, { ...auth(lab), data: { decision: 'SIGNED_OFF' } });
  expect(signed.status(), await signed.text()).toBe(200);

  // The queue picks it up: a glowing badge on Review Ready, and the doctor is told who.
  await page.getByRole('button', { name: 'Refresh the queue' }).click();
  await expect(page.getByText(`Results are back for ${first} Patient.`)).toBeVisible();
  const reviewTab = page.getByRole('tab', { name: /Review Ready/ });
  await expect(reviewTab.getByLabel(/ready for review/)).toBeVisible();
  await reviewTab.click();
  const readyRow = page.getByRole('row').filter({ hasText: `${first} Patient` });
  await expect(readyRow).toContainText('1 of 1 back');

  // Reviewing the results takes the visit back: they are in consultation again.
  await page.getByRole('button', { name: `Review results ${first} Patient` }).click();
  await expect(page.getByRole('heading', { name: `${first} Patient` })).toBeVisible();
  await page.getByRole('button', { name: /Back to queue/ }).click();
  await page.getByRole('tab', { name: /My Consultations/ }).click();
  await expect(page.getByRole('row').filter({ hasText: `${first} Patient` })).toBeVisible();
  await page.getByRole('tab', { name: /Review Ready/ }).click();
  await expect(page.getByRole('row').filter({ hasText: `${first} Patient` })).toHaveCount(0);

  crashes.assertNone();
});

test('a nurse has no clinician queue', async ({ page }) => {
  await signIn(page, { code: 'DEMO', username: 'nurse', password: 'nurse123' });
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Clinician Queue', exact: true })).toHaveCount(0);
});
