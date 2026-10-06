import { expect, test } from '@playwright/test';
import { API, openFromMenu, signIn, watchForCrashes } from './helpers.js';

/*
  The laboratory's three tabs, end to end.

  Incoming -> Accepted -> Results is the whole of the bench's day, and the thing
  that matters most about it is partial acceptance: a request for two tests
  arrives as one tube, so the lab takes in what it has and the rest keeps
  waiting. The flow used to insist on the whole order at once, with result entry
  spread over draft values, an analyzer box, a report panel and a notes panel
  above a push button, and no plain Submit anywhere.

  This walks it: accept one of two tests, enter that one result, see it in
  Results, reverse it, and find it waiting again with what was typed before.
*/

/** A lab request for two tests, straight to the bench. */
async function twoTestRequest(request) {
  const login = async (username, password) => {
    const res = await request.post(`${API}/auth/login`, { data: { facilityCode: 'DEMO', username, password } });
    expect(res.status(), await res.text()).toBe(200);
    return (await res.json()).data.accessToken;
  };
  const doctor = await login('doctor', 'doctor123');
  const res = await request.post(`${API}/doctor/orders`, {
    data: { patientId: 'PAT-0001', urgency: 'ROUTINE', items: [{ catalogItemId: 't3' }, { catalogItemId: 't2' }] },
    headers: { authorization: `Bearer ${doctor}` }
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).data;
}

test('the lab accepts one of two tests, reports it, and can take the result back', async ({ page, request }) => {
  const crashes = watchForCrashes(page);
  await twoTestRequest(request);

  await signIn(page, { code: 'DEMO', username: 'lab', password: 'lab123' });

  /* ---- Incoming: both tests are waiting, and only one sample is here ---- */
  await openFromMenu(page, 'Incoming Labs');
  const row = page.getByRole('row').filter({ hasText: 'Liver Function Test (LFT)' }).first();
  await expect(row).toBeVisible();
  await expect(row).toContainText('Urinalysis');
  await row.getByRole('button', { name: 'Open' }).click();

  // Tick the one test whose sample is on the bench, and accept only that.
  await page.getByRole('checkbox', { name: 'Accept Liver Function Test (LFT)' }).check();
  await page.getByRole('button', { name: /^Accept selected \(1\)/ }).click();

  // The slip that travels with the sample, carrying its accession number.
  const slip = page.getByRole('dialog').filter({ hasText: 'Samples accepted' });
  await expect(slip).toBeVisible();
  await expect(slip).toContainText('Liver Function Test (LFT)');
  await expect(slip.getByText(/^SMP-/).first()).toBeVisible();
  await expect(slip, 'the test whose sample has not arrived must be left waiting').toContainText('still waiting for their samples');
  await slip.getByRole('button', { name: 'Close', exact: true }).click();

  // Urinalysis is still in Incoming; LFT has left it.
  await openFromMenu(page, 'Incoming Labs');
  const stillWaiting = page.getByRole('row').filter({ hasText: 'Urinalysis' }).first();
  await expect(stillWaiting).toBeVisible();
  await expect(stillWaiting).not.toContainText('Liver Function Test (LFT)');

  /* ---- Accepted: one popup, one Submit ---- */
  await openFromMenu(page, 'Accepted Samples');
  await page.getByRole('row').filter({ hasText: 'Liver Function Test (LFT)' }).first()
    .getByRole('button', { name: 'Enter Results' }).click();
  await page.getByRole('row').filter({ hasText: 'Liver Function Test (LFT)' }).first()
    .getByRole('button', { name: 'Enter Result' }).click();

  const entry = page.getByRole('dialog').filter({ hasText: 'Enter test result' });
  await expect(entry).toBeVisible();
  // Nothing filed this, so no analyzer is claimed.
  await expect(entry.getByText('filled the marked fields', { exact: false })).toHaveCount(0);

  const valueOf = (label) => entry.locator('label').filter({ hasText: label }).locator('input').first();
  await valueOf('ALT (SGPT)').fill('74');
  await valueOf('ALP').fill('96');
  // Outside its reference range, and said so as it is typed.
  await expect(entry.getByText('High').first()).toBeVisible();
  await entry.getByLabel('Comment').fill('Mild transaminitis; repeat in two weeks.');
  await entry.getByRole('button', { name: 'Submit' }).click();

  await expect(page.getByText('submitted', { exact: false }).first()).toBeVisible();
  await expect(entry, 'the popup should close once the result is in').toHaveCount(0);

  /* ---- Results: it is there, and it can be taken back ---- */
  await openFromMenu(page, 'Results');
  const sent = page.getByRole('article').filter({ hasText: 'Liver Function Test (LFT)' }).first();
  await expect(sent).toBeVisible();
  await sent.getByRole('button', { name: /View Stored Result/i }).click();

  await page.getByRole('button', { name: /Reverse Result/i }).click();
  const reverse = page.getByRole('dialog').filter({ hasText: 'Reverse this result' });
  await reverse.locator('textarea').fill('ALT was transcribed from the wrong line of the printout');
  await reverse.getByRole('button', { name: /Reverse result/i }).click();

  /* ---- Back in Accepted, with what was typed before ---- */
  await expect(page.getByText('Returned for correction').first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('row').filter({ hasText: 'Liver Function Test (LFT)' }).first()
    .getByRole('button', { name: 'Enter Result' }).click();

  const again = page.getByRole('dialog').filter({ hasText: 'Enter test result' });
  await expect(again.getByText('Returned for correction', { exact: false })).toBeVisible();
  await expect(again.locator('label').filter({ hasText: 'ALT (SGPT)' }).locator('input').first(),
    'the correction should start from what was entered, not an empty form').toHaveValue('74');
  await expect(again.getByLabel('Comment')).toHaveValue('Mild transaminitis; repeat in two weeks.');

  crashes.assertNone();
});
