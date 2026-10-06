import { expect, test } from '@playwright/test';
import { openFromMenu, signIn, tag, watchForCrashes } from './helpers.js';

/*
  The records desk, as it is actually used.

  Somebody arrives, the clerk finds them or registers them, reads the membership
  card in front of them, and checks them in for today. The thing worth testing is
  that the membership captured at the window reaches the patient's record - a
  number typed and then lost is the whole reason this screen exists - and that
  the visit says how it is being paid, because Finance reads that back later.
*/

test('the desk registers a patient, checks them in on their scheme, and reads it back', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'reception', password: 'reception123' });
  await openFromMenu(page, 'Registration & Check-in');

  const stamp = tag();
  const name = `Akosua Records${stamp}`;
  const policy = `NHIS-${stamp}`;

  /* ---- Register ---- */
  await page.getByRole('button', { name: 'Add new patient' }).click();
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Phone').fill('+233 20 111 2233');
  await page.getByLabel('Gender').selectOption('Female');
  await page.getByRole('button', { name: /^Register patient/ }).click();
  await expect(page.getByText('registered as', { exact: false })).toBeVisible();

  /* ---- Find them, and check them in on NHIS ---- */
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await page.getByLabel(/^Search patient/).fill(name);
  await page.getByRole('button').filter({ hasText: name }).first().click();
  await expect(page.getByText(`Checking in ${name}`)).toBeVisible();

  await page.getByLabel('Visit type').selectOption('Follow-up');
  await page.getByLabel('How this visit is paid').selectOption('insurance');
  await page.getByLabel(/^Membership number/).fill(policy);
  await page.getByLabel('Scheme or provider').fill('NHIS');
  await page.getByLabel('Reason for the visit (optional)').fill('Review of last month results');
  await page.getByRole('button', { name: /^Check in patient$/ }).click();

  /* ---- It is in the recent list, and says how it was paid ---- */
  // The visit itself is the proof, not the toast that announces it: a toast has
  // come and gone by the time anyone looks, and the row has to be right anyway.
  await page.getByRole('button', { name: 'Recent check-ins' }).click();
  const row = page.getByRole('row').filter({ hasText: name }).first();
  await expect(row, 'the check-in never reached the visit list').toBeVisible({ timeout: 25_000 });
  await expect(row).toContainText('Follow-up');
  await expect(row, 'the visit must say it went on the scheme').toContainText('Insured');

  /* ---- And the membership reached the patient's record ---- */
  await page.getByRole('button', { name: 'Check in', exact: true }).click();
  await page.getByLabel(/^Search patient/).fill(policy);
  await expect(page.getByRole('button').filter({ hasText: name }).first(),
    'the membership number typed at the window never reached the record').toBeVisible();

  crashes.assertNone();
});

test('checking in on a scheme without a membership number is refused', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'reception', password: 'reception123' });
  await openFromMenu(page, 'Registration & Check-in');

  await page.getByLabel(/^Search patient/).fill('Kojo');
  await page.getByRole('button').filter({ hasText: 'Kojo' }).first().click();
  await page.getByLabel('How this visit is paid').selectOption('insurance');
  await page.getByLabel(/^Membership number/).fill('');
  await page.getByRole('button', { name: /^Check in patient$/ }).click();

  await expect(page.getByRole('alert')).toContainText('membership number');
  crashes.assertNone();
});
