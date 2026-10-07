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

/*
  Submitting an order starts the next case.

  A clinician sees one patient after another. The form used to stay filled in
  with the patient who had just been submitted, so the next order had to be
  unpicked by hand and an accidental second Submit sent the same tests twice.
  The button also said "Submit to Reception", which is wrong in a hospital: the
  request goes straight to the laboratory.
*/
test('submitting an order clears the form and returns to the first step', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'doctor', password: 'doctor123' });
  await openFromMenu(page, 'New Order');

  // Step 1: pick the first patient offered.
  const firstPatient = page.getByRole('button', { name: /Select$/ }).first();
  await firstPatient.click();
  await expect(page.getByRole('button', { name: /Selected$/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /^Continue to/ }).click();

  // Step 2: add one test.
  await page.getByRole('button', { name: 'Add Test / Scan' }).click();
  await page.getByRole('button', { name: 'Full Blood Count (FBC)' }).click();
  await page.getByRole('button', { name: 'Done — Save Selected Tests' }).click();
  await expect(page.getByRole('dialog'), 'the catalog modal stayed open').toHaveCount(0);
  await expect(page.getByText('1 item(s) selected', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /^Continue to/ }).click();

  // Step 3: clinical context, left at its defaults.
  await page.getByRole('button', { name: /^Continue to/ }).click();

  // Step 4: review. The button says Submit, and names no receptionist.
  await expect(page.getByRole('button', { name: 'Review Order' })).toBeVisible();
  await expect(page.getByRole('dialog'), 'a dialog was open before Review Order was clicked').toHaveCount(0);
  await page.getByRole('button', { name: 'Review Order' }).click();
  await expect(page.getByRole('heading', { name: 'Review and submit order' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit to Reception' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Submit', exact: true }).click();

  await expect(page.getByText('Order submitted')).toBeVisible();

  // Back at step 1, with nothing left over from the patient just submitted.
  await expect(page.getByText('Matching existing patients', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /Selected$/ })).toHaveCount(0);
  await expect(page.getByPlaceholder('Search patient name, ID, phone, email...')).toHaveValue('');

  crashes.assertNone();
});

/*
  The Tests / Scans column has one width, however long the list.

  An order can name one test or a dozen. Rendered in full, the longest list set the
  width of the column and pushed urgency and status off the edge of the table. So
  this measures it rather than looking: every cell in the column must be the same
  width, a long list must end in "...", and the whole list must still be there to
  hover over.
*/
test('the Tests / Scans column is one width, and a long list is clipped with "..."', async ({ page, request }) => {
  const crashes = watchForCrashes(page);

  // An order for five tests, so there is certainly something long to clip.
  const login = await request.post('http://localhost:5001/api/auth/login', { data: { facilityCode: 'DEMO', username: 'doctor', password: 'doctor123' } });
  const token = (await login.json()).data.accessToken;
  const made = await request.post('http://localhost:5001/api/doctor/orders', {
    data: { patientId: 'PAT-0002', urgency: 'ROUTINE', items: ['t1', 't2', 't3', 't17', 't19'].map((catalogItemId) => ({ catalogItemId })) },
    headers: { authorization: `Bearer ${token}` }
  });
  expect(made.status(), await made.text()).toBe(201);

  await signIn(page, { code: 'DEMO', username: 'doctor', password: 'doctor123' });
  await openFromMenu(page, 'Active Orders');

  const cells = page.locator('table tbody tr td:nth-child(3)');
  await expect.poll(async () => cells.count(), { message: 'no orders were listed' }).toBeGreaterThan(1);

  const widths = await cells.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().width)));
  expect(new Set(widths).size, `the column is not one width: ${widths.join(', ')}`).toBe(1);

  // The five-test order shows three names and "...", not all five.
  const long = page.locator('table tbody tr td:nth-child(3) span').filter({ hasText: '...' }).first();
  await expect(long).toContainText('...');
  const shown = (await long.innerText()).split(',').filter((part) => part.trim() && part.trim() !== '...');
  expect(shown.length, 'more than three names were shown').toBeLessThanOrEqual(3);

  // Nothing was thrown away: the whole list is on the element for hovering.
  expect(await long.getAttribute('title'), 'the clipped names are not recoverable').toContain('Ultrasound - Abdomen');

  crashes.assertNone();
});
