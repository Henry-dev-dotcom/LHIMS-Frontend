import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { API, openFromMenu, signIn, watchForCrashes } from './helpers.js';

/*
  The imaging unit's three tabs, end to end.

  The same walk as the laboratory's, because it is the same workflow - accept
  part of a request, report one study, see it sent, pull it back - with the two
  things that are only true of imaging: the report is written in words with no
  parameters, and the images are attached to it and then open in the viewer.
*/

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** A request for two studies, straight to the unit. */
async function twoStudyRequest(request) {
  const login = async (username, password) => {
    const res = await request.post(`${API}/auth/login`, { data: { facilityCode: 'DEMO', username, password } });
    expect(res.status(), await res.text()).toBe(200);
    return (await res.json()).data.accessToken;
  };
  const doctor = await login('doctor', 'doctor123');
  const res = await request.post(`${API}/doctor/orders`, {
    data: { patientId: 'PAT-0002', urgency: 'ROUTINE', items: [{ catalogItemId: 't17' }, { catalogItemId: 't19' }] },
    headers: { authorization: `Bearer ${doctor}` }
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()).data;
}

test('the unit accepts one of two studies, reports it with images, and can take it back', async ({ page, request }) => {
  const crashes = watchForCrashes(page);
  await twoStudyRequest(request);

  await signIn(page, { code: 'DEMO', username: 'scan', password: 'scan123' });

  /* ---- Incoming: both studies waiting, only one being done now ---- */
  await openFromMenu(page, 'Incoming Scans');
  const row = page.getByRole('row').filter({ hasText: 'X-Ray' }).first();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Open' }).click();

  await page.getByRole('checkbox', { name: 'Accept X-Ray - Chest' }).check();
  await page.getByRole('button', { name: /^Accept selected \(1\)/ }).click();

  const slip = page.getByRole('dialog').filter({ hasText: 'Studies accepted' });
  await expect(slip).toBeVisible();
  await expect(slip, 'the study not being done now must keep waiting').toContainText('still waiting');
  await slip.getByRole('button', { name: 'Close', exact: true }).click();

  /* ---- Accepted: one report, written in words, with the images on it ---- */
  await openFromMenu(page, 'Accepted Scans');
  await page.getByRole('button', { name: 'Enter Reports' }).first().click();
  await page.getByRole('button', { name: 'Enter Report' }).first().click();

  const entry = page.getByRole('dialog').filter({ hasText: 'Enter report' });
  await expect(entry).toBeVisible();
  // No parameters, no impression or recommendations boxes: one report, one comment.
  await expect(entry.getByText('Impression', { exact: false })).toHaveCount(0);
  await expect(entry.getByText('Recommendation', { exact: false })).toHaveCount(0);

  await entry.getByLabel('Report / findings').fill('Lung fields clear. Heart size within normal limits. No effusion.');
  await entry.getByLabel('Comment').fill('Compared with the film of last year; unchanged.');
  await entry.locator('input[aria-label="Attach DICOM images"]').setInputFiles([join(fixtures, 'CT_small.dcm')]);
  await expect(entry.getByText('1 file(s) chosen')).toBeVisible();
  await entry.getByRole('button', { name: 'Submit' }).click();

  await expect(page.getByText('submitted', { exact: false }).first()).toBeVisible({ timeout: 25_000 });
  await expect(entry, 'the popup should close once the report is in').toHaveCount(0);

  /* ---- The attached study opens in the viewer ---- */
  await openFromMenu(page, 'DICOM Viewer');
  // The one just reported, not whichever study happens to be listed first. The
  // demo seed also carries DICOM metadata with no bytes behind it, and those are
  // meant to say so rather than open.
  await page.getByRole('button').filter({ hasText: 'X-Ray - Chest' }).first().click();
  await expect.poll(async () => page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    return canvas ? canvas.width : 0;
  }), { message: 'the attached study did not render', timeout: 30_000 }).toBe(128);

  /* ---- Results: it is there, and it can be pulled back ---- */
  await openFromMenu(page, 'Results');
  const sent = page.getByRole('article').filter({ hasText: 'Lung fields clear' }).first();
  await expect(sent, 'the signed-off report never reached the Results tab').toBeVisible();
  await expect(sent).toContainText('Kojo Nyarko');
  await sent.getByRole('button', { name: /View Stored Report/i }).click();
  await expect(page.getByText('Compared with the film of last year', { exact: false }).first(),
    'the comment did not survive onto the stored report').toBeVisible();

  crashes.assertNone();
});
