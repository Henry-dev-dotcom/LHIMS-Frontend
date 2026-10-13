import { expect, test } from '@playwright/test';
import { API, signIn, signInAsHospitalDoctor, tag, watchForCrashes } from './helpers.js';

/*
  The consultation workspace, end to end.

  One patient, one visit, from the doctor opening it to the results being reviewed:
  a template and dictated words in the notes, a bundle of tests, a draft that survives
  leaving the screen, "Send to Lab & Suspend", the lab signing off, and the results
  showing up on the Investigations tab. The lab and the other staff are driven through
  the real API so the screen is checked against the server, not against itself.
*/

async function loginToken(request, username, password) {
  const res = await request.post(`${API}/auth/login`, { data: { facilityCode: 'DEMO', username, password } });
  expect(res.status(), await res.text()).toBe(200);
  return (await res.json()).data.accessToken;
}
const auth = (token) => ({ headers: { authorization: `Bearer ${token}` } });

async function startVisit(request, tokens, patientId, complaint) {
  const visit = await request.post(`${API}/encounters`, { ...auth(tokens.reception), data: { patientId, type: 'OPD', chiefComplaint: complaint } });
  expect(visit.status(), await visit.text()).toBe(201);
  const id = (await visit.json()).data.id;
  const triaged = await request.post(`${API}/encounters/${id}/vitals`, { ...auth(tokens.nurse), data: { temperatureC: 38.6, pulseBpm: 96, triageLevel: 'YELLOW', completeTriage: true } });
  expect(triaged.status(), await triaged.text()).toBe(201);
  return id;
}

/** The lab takes an order all the way to signed off, one result per test. */
async function labSignsOffAll(request, lab, orderId) {
  const accepted = await request.post(`${API}/lab/samples/accept`, { ...auth(lab), data: { orderId } });
  expect(accepted.status(), await accepted.text()).toBe(201);
  for (const sample of (await accepted.json()).data.samples) {
    const draft = await request.post(`${API}/lab/results`, { ...auth(lab), data: { sampleId: sample.id, parameters: [{ name: 'Haemoglobin', value: '12.8', unit: 'g/dL' }] } });
    expect(draft.status(), await draft.text()).toBe(201);
    const resultId = (await draft.json()).data.id;
    await request.post(`${API}/lab/results/submit-review`, { ...auth(lab), data: { resultId } });
    const signed = await request.post(`${API}/lab/results/${resultId}/sign-off`, { ...auth(lab), data: { decision: 'SIGNED_OFF' } });
    expect(signed.status(), await signed.text()).toBe(200);
  }
}

test('a doctor works a visit from notes to results', async ({ page, request }) => {
  const crashes = watchForCrashes(page);

  // A stand-in for the browser's speech recognition, which headless Chromium cannot provide.
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {
        setTimeout(() => {
          const result = Object.assign([{ transcript: 'headache since monday' }], { isFinal: true });
          this.onresult?.({ resultIndex: 0, results: [result] });
        }, 80);
      }
      stop() { this.onend?.(); }
      abort() {}
    };
  });

  const t = tag();
  const first = `Work${t}`;
  const tokens = {};
  for (const [name, pass] of [['reception', 'reception123'], ['nurse', 'nurse123'], ['doctor', 'doctor123'], ['lab', 'lab123']]) tokens[name] = await loginToken(request, name, pass);

  const patient = await request.post(`${API}/patients`, { ...auth(tokens.reception), data: { firstName: first, lastName: 'Patient', phone: `+2332000${Math.floor(10000 + Math.random() * 89999)}`, gender: 'FEMALE' } });
  expect(patient.status(), await patient.text()).toBe(201);
  const patientId = (await patient.json()).data.id;
  await request.post(`${API}/patients/${patientId}/allergies`, { ...auth(tokens.nurse), data: { substance: 'Penicillin', reaction: 'Rash', severity: 'SEVERE' } });

  // An earlier, finished visit, so the quick-peek history has something to show.
  const earlierId = await startVisit(request, tokens, patientId, 'Earlier cough');
  await request.post(`${API}/encounters/${earlierId}/start-consultation`, { ...auth(tokens.doctor), data: {} });
  await request.post(`${API}/encounters/${earlierId}/diagnoses`, { ...auth(tokens.doctor), data: { code: 'J06', description: `Earlier chest infection ${t}`, type: 'PRIMARY' } });
  const finished = await request.post(`${API}/encounters/${earlierId}/complete`, { ...auth(tokens.doctor), data: { outcome: 'DISCHARGED' } });
  expect(finished.status(), await finished.text()).toBe(200);

  const encounterId = await startVisit(request, tokens, patientId, 'Severe headache and fever');

  const aiPosts = [];
  page.on('request', (browserRequest) => {
    if (browserRequest.method() === 'POST' && new URL(browserRequest.url()).pathname.toLowerCase().includes('curataai')) aiPosts.push(browserRequest.url());
  });

  await signInAsHospitalDoctor(page);
  await page.getByRole('button', { name: `Consult for ${first} Patient` }).click();
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('heading', { name: `${first} Patient` })).toBeVisible();
    const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
    expect(widths.page, `the clinician workspace should not overflow at ${viewport.width}px`).toBeLessThanOrEqual(widths.viewport);
  }
  await page.setViewportSize({ width: 1366, height: 900 });

  /* ---- the patient band: identity and what must not be missed ---- */
  await expect(page.getByRole('heading', { name: `${first} Patient` })).toBeVisible();
  await expect(page.getByText('Allergy: Penicillin')).toBeVisible();
  await expect(page.getByLabel('Latest vitals')).toContainText('38.6');
  await expect(page.getByRole('heading', { name: 'CurataAI Predictive Autopilot' })).toHaveCount(0);
  await expect(page.getByText('This panel does not receive patient notes, call an AI service, or display mock clinical recommendations.')).toHaveCount(0);
  const noteEditorBox = await page.getByRole('textbox', { name: 'Clinical note' }).boundingBox();
  const diagnosisHeading = page.getByRole('heading', { name: 'Diagnoses' });
  await expect(diagnosisHeading).toBeVisible();
  const diagnosisBox = await diagnosisHeading.boundingBox();
  expect(diagnosisBox.y).toBeGreaterThan(noteEditorBox.y);

  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Complete & Discharge' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Finish visit' }).click();
  await expect(page.getByRole('heading', { name: 'Finish visit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Short-stay observation (backend support required)' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Generate medical-excuse certificate (not connected)' })).toBeDisabled();
  await page.getByRole('button', { name: 'Back to visit' }).click();
  await page.getByRole('tab', { name: 'Visit' }).click();

  /* ---- tab 1: a template, typing, and dictation ---- */
  await page.getByLabel('Insert a template').selectOption({ label: 'Acute fever protocol' });
  const singleNote = page.getByRole('textbox', { name: 'Clinical note' });
  await expect(singleNote).toHaveValue(/Fever for \(days\):/);
  await page.getByRole('button', { name: 'Format: Insert SOAP Structure' }).click();
  await expect(singleNote).toHaveValue(/## Subjective/);
  await expect(singleNote).toHaveValue(/## Plan/);
  await singleNote.fill('A short free-text clinical narrative.');
  await page.getByRole('button', { name: 'SOAP fields' }).click();
  await expect(page.getByRole('textbox', { name: 'Subjective (history)' })).toHaveValue('A short free-text clinical narrative.');
  await page.getByRole('button', { name: 'Single editor' }).click();
  await singleNote.fill('## Subjective\nFever for (days): 3\nChills or rigors: yes\nRash:\n\n## Objective\nChest:\n\n## Assessment\nDifferentials considered:\n\n## Plan\nAdvice:');
  await page.getByRole('button', { name: 'SOAP fields' }).click();
  const subjective = page.getByRole('textbox', { name: 'Subjective (history)' });
  await expect(subjective).toHaveValue(/Fever for \(days\): 3/);
  await subjective.fill('Fever for (days): 3\nChills or rigors: yes\nRash:');

  // Dictation stays off until the clinician has read where the audio goes.
  const dictateAssessment = page.getByRole('button', { name: 'Dictate Assessment' });
  await expect(dictateAssessment).toBeDisabled();
  await expect(page.getByText(/leave this building/)).toBeVisible();
  await page.getByRole('button', { name: /I understand, turn dictation on/ }).click();
  await dictateAssessment.click();
  await expect(page.getByRole('textbox', { name: 'Assessment' })).toHaveValue(/Differentials considered: headache since monday/);

  /* ---- tab 2: a bundle, then take one test off ---- */
  await page.getByRole('tab', { name: /Tests & Results/ }).click();
  await page.getByRole('button', { name: /Acute fever panel/ }).click();
  await expect(page.getByText(/\d+ waiting to be sent/)).toBeVisible();
  const staged = page.getByLabel('Tests waiting to be sent');
  await expect(staged).toContainText('Malaria');
  await expect(staged).toContainText('Full Blood Count');
  await staged.getByRole('button', { name: /Remove Widal/ }).click();
  await expect(staged).not.toContainText('Widal');

  /* ---- autosave keeps everything when the doctor leaves, and brings it back ---- */
  await expect(page.getByText(/^Draft saved /)).toBeVisible();
  await page.getByRole('button', { name: 'Back to queue' }).click();
  await page.getByRole('tab', { name: /Needs attention/ }).click();
  await page.getByRole('button', { name: `Continue consultation for ${first} Patient` }).click();
  await page.getByRole('button', { name: 'SOAP fields' }).click();
  await expect(page.getByRole('textbox', { name: 'Subjective (history)' })).toHaveValue(/Fever for \(days\): 3/);
  await expect(page.getByRole('textbox', { name: 'Assessment' })).toHaveValue(/Differentials considered: headache since monday/);
  await page.getByRole('tab', { name: /Tests & Results/ }).click();
  await expect(page.getByLabel('Tests waiting to be sent')).toContainText('Malaria');
  await expect(page.getByLabel('Tests waiting to be sent')).not.toContainText('Widal');

  /* ---- the quick-peek history, without leaving the visit ---- */
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('complementary', { name: 'Quick-peek history' })).toContainText(`Earlier chest infection ${t}`);
  await page.getByRole('button', { name: 'Close history' }).click();

  /* ---- Send to Lab & Suspend ---- */
  await page.getByRole('button', { name: /Send to Diagnostics & Suspend/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('2 tests will be sent now');
  await expect(dialog).toContainText('Your notes will be saved to the record');
  await dialog.getByRole('button', { name: 'Send and suspend' }).click();

  // Back on the queue: parked under Pending Labs, with their tests counted.
  await expect(page.getByRole('tab', { name: /Awaiting results/ })).toBeVisible();
  await page.getByRole('tab', { name: /Awaiting results/ }).click();
  const pending = page.getByRole('row').filter({ hasText: `${first} Patient` });
  await expect(pending).toContainText('0 of 2 back');
  await expect(pending.getByRole('button', { name: `Add tests for ${first} Patient` })).toBeVisible();
  await expect(pending.getByRole('button', { name: `Force resume ${first} Patient` })).toBeVisible();
  await expect(pending.getByRole('button', { name: `Ping diagnostics for ${first} Patient` })).toBeEnabled();
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
    expect(widths.page, `Pending Labs should not overflow at ${viewport.width}px`).toBeLessThanOrEqual(widths.viewport);
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await pending.getByRole('button', { name: `Add tests for ${first} Patient` }).click();
  await expect(page.getByRole('tab', { name: /Tests & Results/, selected: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back to queue' }).click();
  await page.getByRole('tab', { name: /Awaiting results/ }).click();

  // The note went into the record - without the prompts nobody answered.
  const record = await (await request.get(`${API}/encounters/${encounterId}`, auth(tokens.doctor))).json();
  const note = record.data.notes.at(-1);
  expect(note.subjective).toContain('Fever for (days): 3');
  expect(note.subjective).toContain('Chills or rigors: yes');
  expect(note.subjective, 'unanswered prompts must not reach the record').not.toContain('Rash:');
  expect(note.assessment).toContain('Differentials considered: headache since monday');
  expect(record.data.suspendedAt).not.toBeNull();
  expect(aiPosts, 'the unavailable Autopilot integration must not send patient data').toEqual([]);

  /* ---- the lab signs off; the doctor reviews the results where they are ---- */
  const orderId = record.data.orders[0].id;
  await labSignsOffAll(request, tokens.lab, orderId);
  await page.getByRole('button', { name: 'Refresh the queue' }).click();
  await page.getByRole('tab', { name: /Ready to review/ }).click();
  await expect(page.getByRole('row').filter({ hasText: `${first} Patient` })).toContainText('2 of 2 back');
  await page.getByRole('button', { name: `Review results for ${first} Patient` }).click();

  // Opened straight on the results.
  await expect(page.getByRole('tab', { name: /Tests & Results/, selected: true })).toBeVisible();
  await expect(page.getByText('This visit', { exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Haemoglobin' }).first()).toBeVisible();
  await expect(page.getByText('12.8 g/dL').first()).toBeVisible();

  crashes.assertNone();
});

test('a nurse cannot open the consultation workspace from the queue', async ({ page }) => {
  await signIn(page, { code: 'DEMO', username: 'nurse', password: 'nurse123' });
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Clinician Queue', exact: true })).toHaveCount(0);
});
