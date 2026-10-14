import { expect, test } from '@playwright/test';
import { API, signIn } from './helpers.js';

/*
  The clinician's pages, opened by address by people who should not have them.

  A menu that leaves an item out is not a lock. Each role below types the address of a clinical
  page it may not open: the app must take it back to its own landing page, and the server must
  refuse the data behind the page, so that a hand-built request gets nothing either.
*/

const ROLES = {
  nurse: { password: 'nurse123', landing: 'opd-queue' },
  reception: { password: 'reception123', landing: 'reception-dashboard' },
  lab: { password: 'lab123', landing: 'lab-queue' },
  scan: { password: 'scan123', landing: 'scan-dashboard' },
  billing: { password: 'billing123', landing: 'billing-dashboard' },
  pharmacist: { password: 'pharmacist123', landing: 'pharmacy-dispensing' }
};

// Page -> the roles that must be turned away from it (everyone not listed in its menu roles).
const REFUSED = {
  'clinician-queue': ['nurse', 'reception', 'lab', 'scan', 'billing', 'pharmacist'],
  'doctor-results': ['nurse', 'reception', 'lab', 'scan', 'billing', 'pharmacist'],
  'ward-board': ['reception', 'lab', 'scan', 'billing', 'pharmacist'],
  'patients-directory': ['lab', 'scan', 'billing', 'pharmacist'],
  clinics: ['lab', 'scan', 'billing', 'pharmacist'],
  'emergency-board': ['lab', 'scan', 'billing', 'pharmacist']
};

// The data behind those pages, and who the server must refuse.
const API_REFUSED = [
  // Nurses and reception read visits already (the OPD list is theirs), so the queue - a view of
  // the same visits - is open to them; what they must never get is the doctor's result flags.
  { path: '/encounters/queue', roles: ['lab', 'scan', 'billing', 'pharmacist'] },
  { path: '/inpatient/board', roles: ['reception', 'lab', 'scan', 'billing', 'pharmacist'] },
  { path: '/records/directory', roles: ['lab', 'scan', 'billing', 'pharmacist'] }
];

for (const [username, role] of Object.entries(ROLES)) {
  const pages = Object.entries(REFUSED).filter(([, roles]) => roles.includes(username)).map(([pageId]) => pageId);
  test(`${username} is turned away from clinical pages it may not open`, async ({ page }) => {
    await signIn(page, { code: 'DEMO', username, password: role.password });
    for (const pageId of pages) {
      await page.goto(`/#/app/${pageId}`);
      await expect.poll(() => page.url(), { timeout: 10_000, message: `${username} stayed on ${pageId}` }).toContain(`#/app/${role.landing}`);
    }
  });
}

test('the server refuses the clinical data to roles without it', async ({ request }) => {
  const failures = [];
  for (const [username, role] of Object.entries(ROLES)) {
    const res = await request.post(`${API}/auth/login`, { data: { facilityCode: 'DEMO', username, password: role.password } });
    expect(res.status(), await res.text()).toBe(200);
    const token = (await res.json()).data.accessToken;
    for (const { path, roles } of API_REFUSED.filter((entry) => entry.roles.includes(username))) {
      const status = (await request.get(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } })).status();
      if (status !== 403) failures.push(`${username} GET ${path} -> ${status}`);
    }
  }
  expect(failures, failures.join('\n')).toEqual([]);
});

test("nurses and reception see the queue without the doctor's result flags", async ({ request }) => {
  const token = async (username, password) => (await (await request.post(`${API}/auth/login`, { data: { facilityCode: 'DEMO', username, password } })).json()).data.accessToken;
  const as = (t) => ({ headers: { authorization: `Bearer ${t}` } });
  const [reception, doctor, lab] = [await token('reception', 'reception123'), await token('doctor', 'doctor123'), await token('lab', 'lab123')];

  // A patient whose result is back, so the queue has a result flag to give - or withhold.
  const patient = (await (await request.post(`${API}/patients`, { ...as(reception), data: { firstName: `Flag${Date.now()}`, lastName: 'Check', phone: '+233200077788', gender: 'MALE' } })).json()).data;
  const visit = (await (await request.post(`${API}/encounters`, { ...as(reception), data: { patientId: patient.id, type: 'OPD', chiefComplaint: 'Check-up' } })).json()).data;
  await request.post(`${API}/encounters/${visit.id}/start-consultation`, as(doctor));
  const order = (await (await request.post(`${API}/encounters/${visit.id}/orders`, { ...as(doctor), data: { items: [{ catalogItemId: 't1' }] } })).json()).data;
  await request.post(`${API}/encounters/${visit.id}/suspend`, { ...as(doctor), data: {} });
  const sample = (await (await request.post(`${API}/lab/samples/accept`, { ...as(lab), data: { orderId: order.orders[0].id } })).json()).data.samples[0];
  const result = (await (await request.post(`${API}/lab/results`, { ...as(lab), data: { sampleId: sample.id, parameters: [{ name: 'Haemoglobin', value: '12.1', unit: 'g/dL' }] } })).json()).data;
  await request.post(`${API}/lab/results/submit-review`, { ...as(lab), data: { resultId: result.id } });
  expect((await request.post(`${API}/lab/results/${result.id}/sign-off`, { ...as(lab), data: { decision: 'SIGNED_OFF' } })).status()).toBe(200);

  const doctorQueue = await (await request.get(`${API}/encounters/queue?scope=all`, as(doctor))).json();
  expect(doctorQueue.data.reviewReady.find((row) => row.id === visit.id)?.resultPriority, 'the doctor gets the flag').toBeTruthy();

  for (const username of ['nurse', 'reception']) {
    const res = await request.post(`${API}/auth/login`, { data: { facilityCode: 'DEMO', username, password: ROLES[username].password } });
    const token = (await res.json()).data.accessToken;
    const queue = await request.get(`${API}/encounters/queue?scope=all`, { headers: { authorization: `Bearer ${token}` } });
    expect(queue.status()).toBe(200);
    expect(await queue.text(), `${username} was sent result priorities`).not.toContain('resultPriority');
  }
});
