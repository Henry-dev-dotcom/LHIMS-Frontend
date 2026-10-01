import { expect, test } from '@playwright/test';
import { openFromMenu, signIn, watchForCrashes } from './helpers.js';

/*
  A doctor's own workspace must actually show their work. It used to look fine
  and list nothing: the pages resolved the signed-in doctor from the admin-only
  doctor list, which a doctor's session cannot read. Opening the page without
  crashing is not enough here — these check the orders are really there.
*/

test('a doctor sees their own orders, and can withdraw one they just sent', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'doctor', password: 'doctor123' });

  await openFromMenu(page, 'Active Orders');
  const rows = page.getByRole('row');
  await expect.poll(async () => rows.count(), { message: 'the doctor sees no active orders at all' }).toBeGreaterThan(1);

  // Send a fresh order, then take it back before anyone acts on it.
  await openFromMenu(page, 'New Order');
  await expect(page.getByText('Matching existing patients', { exact: false })).toBeVisible();

  await openFromMenu(page, 'Active Orders');
  const submitted = page.getByRole('row').filter({ hasText: 'Submitted' }).first();
  await expect(submitted).toBeVisible();
  const orderId = (await submitted.innerText()).split(/\s/)[0];

  await submitted.getByRole('button', { name: 'View' }).click();
  await page.getByRole('button', { name: 'Reverse this order' }).click();
  await page.getByLabel(/^Reason/).fill('Ordered the wrong test for this patient');
  await page.getByRole('button', { name: 'Confirm reversal' }).click();

  await expect(page.getByText(`${orderId} moved to Cancelled`)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: orderId })).toHaveCount(0);
  crashes.assertNone();
});

test('the clinician dashboard and completed orders are populated too', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'doctor', password: 'doctor123' });

  await openFromMenu(page, 'Clinician Dashboard');
  // The counters read 0 across the board when the doctor cannot be resolved.
  await expect.poll(async () => {
    const text = await page.locator('#main-content').innerText();
    return [...text.matchAll(/(\d+)\s*\n\s*(ACTIVE|COMPLETED|PATIENTS)/gi)].some(([, n]) => Number(n) > 0);
  }, { message: 'every clinician dashboard counter is zero' }).toBe(true);

  await openFromMenu(page, 'Completed Orders');
  await expect.poll(async () => page.getByRole('row').count()).toBeGreaterThan(1);
  crashes.assertNone();
});
