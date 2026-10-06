import { expect, test } from '@playwright/test';
import { API, openFromMenu, signIn, watchForCrashes } from './helpers.js';

/*
  The cashier's window.

  What matters here is arithmetic and evidence. A part payment must leave the
  right balance behind, the bill must stay open for the rest, and the payment has
  to leave a receipt with a number on it - because the patient is standing there
  and will come back with that piece of paper.

  So this takes a bill, pays half of it, checks what is left, pays the rest, and
  checks it clears. It also checks the till refuses to take more than is owed,
  which is the mistake that turns into a refund nobody can account for.
*/

/** A billed order, so there is something at the window to pay for. */
async function billedOrder(request) {
  const login = async (username, password) => {
    const res = await request.post(`${API}/auth/login`, { data: { facilityCode: 'DEMO', username, password } });
    expect(res.status(), await res.text()).toBe(200);
    return (await res.json()).data.accessToken;
  };
  const doctor = await login('doctor', 'doctor123');
  const created = await request.post(`${API}/doctor/orders`, {
    // X-Ray - Chest at 150 and Urinalysis at 50: a round 200 to split in half.
    data: { patientId: 'PAT-0003', urgency: 'ROUTINE', items: [{ catalogItemId: 't17' }, { catalogItemId: 't2' }] },
    headers: { authorization: `Bearer ${doctor}` }
  });
  expect(created.status(), await created.text()).toBe(201);
}

test('the cashier takes a part payment, then clears the bill, and each leaves a receipt', async ({ page, request }) => {
  const crashes = watchForCrashes(page);
  await billedOrder(request);

  await signIn(page, { code: 'DEMO', username: 'billing', password: 'billing123' });
  await openFromMenu(page, 'Cashier');

  /* ---- The till has to be open before money can be taken ---- */
  // Which is the first thing a cashier does, and has to be possible here rather
  // than being a refusal with no way out of it.
  // The demo starts with a closed shift, so the till is shut and the page has to
  // say so. Waiting for it rather than testing whether it happens to be there
  // yet - the shifts load after the first render.
  const till = page.getByText('The till is closed');
  await expect(till.first(), 'a closed till has to be visible, not a silent refusal later').toBeVisible({ timeout: 25_000 });
  await page.getByLabel('Opening float').first().fill('200');
  await page.getByRole('button', { name: 'Open the till' }).first().click();
  await expect(till, 'the till did not open').toHaveCount(0, { timeout: 25_000 });

  // Find the patient who owes something.
  await page.getByRole('button', { name: 'Owing only' }).click();
  await page.getByLabel(/^Search patient/).fill('Nana');
  const row = page.getByRole('row').filter({ hasText: 'Nana Yaa Prempeh' }).first();
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Open' }).click();

  // The bill is itemised: a total alone does not tell anyone what they are paying for.
  const bill = page.locator('section').filter({ hasText: 'X-Ray - Chest' }).last();
  await expect(bill).toBeVisible();
  await expect(bill).toContainText('Urinalysis');

  /* ---- The till will not take more than is owed ---- */
  await bill.getByRole('button', { name: 'Receive payment' }).click();
  const pay = page.getByRole('dialog').filter({ hasText: 'Receive payment' });
  await pay.getByLabel('Amount').fill('100000');
  await pay.getByRole('button', { name: 'Take payment' }).click();
  await expect(pay.getByRole('alert')).toContainText('more than');

  /* ---- Half of it ---- */
  await pay.getByLabel('Amount').fill('100');
  await pay.getByRole('button', { name: 'Take payment' }).click();

  const receipt = page.getByRole('dialog').filter({ hasText: 'Payment received' });
  await expect(receipt).toBeVisible({ timeout: 25_000 });
  await expect(receipt, 'the receipt must say what was taken').toContainText('100');
  await expect(receipt, 'a receipt needs a number the patient can come back with').toContainText(/RCP|RCT|REC/i);
  await expect(receipt, 'a part payment must say what is still owed').toContainText('still outstanding');
  await receipt.getByRole('button', { name: 'Close', exact: true }).click();

  // The bill stays open for the remainder, and the payment is on it.
  await expect(bill).toContainText('Payments taken');
  await expect(bill.getByText('Cleared')).toHaveCount(0);

  /* ---- And the rest ---- */
  await bill.getByRole('button', { name: 'Receive payment' }).click();
  // The dialog opens on the outstanding balance, which is what is usually paid.
  await expect(pay.getByLabel('Amount')).toHaveValue('100');
  await pay.getByRole('button', { name: 'Take payment' }).click();

  const second = page.getByRole('dialog').filter({ hasText: 'Payment received' });
  await expect(second).toBeVisible({ timeout: 25_000 });
  await expect(second, 'a bill paid in full must say so, not report a balance').toContainText('cleared');
  await second.getByRole('button', { name: 'Close', exact: true }).click();

  // Nothing left to take on this bill.
  await expect(bill.getByRole('button', { name: 'Receive payment' })).toHaveCount(0);

  crashes.assertNone();
});
