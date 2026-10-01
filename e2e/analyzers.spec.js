import { expect, test } from '@playwright/test';
import { API, openFromMenu, signIn, watchForCrashes } from './helpers.js';

/*
  An analyzer filing its own results, from the lab's point of view.

  The journey this walks is the one that decides whether the feature is usable:
  register an instrument, bring a run in, find that one of its codes means
  nothing here, map it, and replay — ending with the values on the patient's
  draft result, marked as having come from the machine.
*/

/** Orders a test, confirms it and accepts the sample, through the API. */
async function acceptedSample(request, catalogItemId, patientId) {
  const login = async (username, password) => {
    const res = await request.post(`${API}/auth/login`, { data: { facilityCode: 'DEMO', username, password } });
    expect(res.status(), await res.text()).toBe(200);
    return (await res.json()).data.accessToken;
  };
  const post = async (path, token, data = {}) => {
    const res = await request.post(`${API}${path}`, { data, headers: { authorization: `Bearer ${token}` } });
    return { status: res.status(), body: await res.json(), text: await res.text().catch(() => '') };
  };

  const doctor = await login('doctor', 'doctor123');
  const reception = await login('reception', 'reception123');
  const lab = await login('lab', 'lab123');

  const order = await post('/doctor/orders', doctor, { patientId, urgency: 'ROUTINE', items: [{ catalogItemId }] });
  expect(order.status, JSON.stringify(order.body)).toBe(201);
  const confirmed = await post(`/reception/orders/${order.body.data.id}/confirm`, reception, { invoiceNow: true });
  expect(confirmed.status).toBeLessThan(300);
  const accepted = await post('/lab/samples/accept', lab, { orderId: order.body.data.id });
  expect(accepted.status, JSON.stringify(accepted.body)).toBe(201);
  return accepted.body.data.samples[0].sampleCode;
}

test('a lab connects an analyzer, maps the code it did not know, and the values reach the bench', async ({ page, request }) => {
  const crashes = watchForCrashes(page);
  const sampleCode = await acceptedSample(request, 't3', 'PAT-0003');

  await signIn(page, { code: 'DEMO', username: 'lab', password: 'lab123' });
  await openFromMenu(page, 'Analyzers');

  // Register the instrument. The key is shown once, and only once.
  await page.getByRole('button', { name: 'Register an analyzer' }).click();
  await page.getByPlaceholder('Haematology analyzer').fill('E2E Chemistry');
  await page.getByLabel('How it sends results').selectOption('CSV');
  await page.getByRole('button', { name: 'Register and issue a key' }).click();

  const keyDialog = page.getByRole('dialog').filter({ hasText: 'Analyzer registered' });
  await expect(keyDialog).toBeVisible();
  await expect(keyDialog.getByText(/^lhims_anz_/)).toBeVisible();
  await expect(keyDialog.getByText('This is the only time you will see it', { exact: false })).toBeVisible();
  await keyDialog.getByRole('button', { name: 'I have copied it' }).click();

  // Bring a run in without any bridge: one code we know, one we do not.
  await page.getByRole('button', { name: 'Upload a run' }).click();
  const upload = page.getByRole('dialog').filter({ hasText: 'Upload a run from an analyzer' });
  await upload.getByLabel('Which analyzer did this come from?').selectOption({ label: 'E2E Chemistry · Export file (CSV)' });
  await upload.locator('input[type="file"]').setInputFiles({
    name: 'run.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`sample,test,value,unit,flag\n${sampleCode},SGPT,74,U/L,H\n${sampleCode},ALP,96,U/L,N\n`)
  });
  await upload.getByRole('button', { name: 'Upload', exact: true }).click();

  // "ALP" is one of our own field names, so it lands. "SGPT" is not, so it waits.
  await expect(upload.getByText('1 stored · 1 need attention')).toBeVisible();
  await expect(upload.getByText('"SGPT" is not mapped to a test', { exact: false })).toBeVisible();
  await upload.getByRole('button', { name: 'Close', exact: true }).last().click();

  // Map the code the instrument used to the field it belongs in.
  await openFromMenu(page, 'Test Mapping');
  await expect(page.getByText('1 code waiting to be mapped')).toBeVisible();
  await page.getByRole('button', { name: 'Map this' }).click();

  const mapping = page.getByRole('dialog').filter({ hasText: 'Map an analyzer code' });
  await expect(mapping.getByPlaceholder('GLU')).toHaveValue('SGPT');
  await mapping.getByLabel('Our test').selectOption({ label: 'Liver Function Test (LFT)' });
  await mapping.getByLabel('Which field of that test').selectOption({ label: 'ALT (SGPT) (U/L)' });
  await mapping.getByRole('button', { name: 'Save mapping' }).click();

  // Nothing was lost: the stored payload is replayed as it arrived.
  await expect(page.getByText('waiting to be mapped', { exact: false })).toHaveCount(0);
  await openFromMenu(page, 'Analyzer Log');
  await page.getByRole('row').filter({ hasText: 'E2E Chemistry' }).getByRole('button', { name: 'Open', exact: true }).click();
  const message = page.getByRole('dialog').filter({ hasText: 'From E2E Chemistry' });
  await expect(message.locator('pre')).toContainText(`${sampleCode},SGPT,74,U/L,H`, { timeout: 15_000 });
  await message.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: 'Need attention (0)' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Filed (1)' })).toBeVisible();

  // The payoff: the values are on the patient's draft result, marked as the
  // machine's, with the fields it does not measure still waiting for a person.
  await openFromMenu(page, 'Accepted Samples');
  await page.getByRole('button', { name: 'Enter Results' }).first().click();
  await page.getByRole('button', { name: 'Enter Result' }).first().click();

  const entry = page.getByRole('dialog').filter({ hasText: 'Enter test result' });
  await expect(entry.getByText('E2E Chemistry filled the marked fields', { exact: false })).toBeVisible();
  await expect(entry.getByText('From the analyzer')).toHaveCount(2);

  const valueOf = (label) => entry.locator('label').filter({ hasText: label }).locator('input').first();
  await expect(valueOf('ALT (SGPT)')).toHaveValue('74');
  await expect(valueOf('ALP')).toHaveValue('96');
  // A field the instrument never sent is still the technician's to fill.
  await expect(valueOf('Albumin')).toHaveValue('');

  crashes.assertNone();
});

test('an analyzer cannot overwrite a result the lab has already sent', async ({ page, request }) => {
  const crashes = watchForCrashes(page);
  const sampleCode = await acceptedSample(request, 't6', 'PAT-0001');

  await signIn(page, { code: 'DEMO', username: 'lab', password: 'lab123' });
  await openFromMenu(page, 'Analyzers');
  await page.getByRole('button', { name: 'Register an analyzer' }).click();
  await page.getByPlaceholder('Haematology analyzer').fill('E2E Guarded');
  await page.getByLabel('How it sends results').selectOption('CSV');
  await page.getByRole('button', { name: 'Register and issue a key' }).click();
  await page.getByRole('button', { name: 'I have copied it' }).click();

  // Enter, submit and sign the result off by hand first.
  await openFromMenu(page, 'Accepted Samples');
  await page.getByRole('button', { name: 'Enter Results' }).first().click();
  await page.getByRole('button', { name: 'Enter Result' }).first().click();
  const entry = page.getByRole('dialog').filter({ hasText: 'Enter test result' });
  await entry.locator('input[placeholder="Enter value"]').first().fill('5.0');
  await entry.getByRole('button', { name: 'Done with Test' }).click();
  await page.getByRole('button', { name: 'Push Results to Clinician' }).click();

  // Now the analyzer sends a different number for the same sample.
  await openFromMenu(page, 'Analyzers');
  await page.getByRole('button', { name: 'Upload a run' }).click();
  const upload = page.getByRole('dialog').filter({ hasText: 'Upload a run from an analyzer' });
  await upload.getByLabel('Which analyzer did this come from?').selectOption({ label: 'E2E Guarded · Export file (CSV)' });
  await upload.locator('input[type="file"]').setInputFiles({
    name: 'late.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`sample,test,value,unit,flag\n${sampleCode},Glucose,9.9,mmol/L,H\n`)
  });
  await upload.getByRole('button', { name: 'Upload', exact: true }).click();

  // It is refused, and the message says what a person would have to do first.
  await expect(upload.getByText('0 stored · 1 need attention')).toBeVisible();
  await expect(upload.getByText('Withdraw it from Lab Results', { exact: false })).toBeVisible();
  crashes.assertNone();
});
