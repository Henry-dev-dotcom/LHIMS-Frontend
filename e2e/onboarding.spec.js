import { expect, test } from '@playwright/test';
import { openFromMenu, tag, watchForCrashes } from './helpers.js';

// Phase 6 exit gate in a real browser: a visitor goes from the pricing page to
// working inside their own hospital, then pays, with no manual help.
test('a new hospital signs up, sets up, registers a patient and pays', async ({ page }) => {
  const crashes = watchForCrashes(page);
  const t = tag();
  const facilityName = `Zenith ${t} Clinic`;
  const username = `zen${t.toLowerCase()}`;
  const password = `Zenith-${t}-2026`;

  // Website → plan builder.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Run your whole hospital on one system.' })).toBeVisible();
  await page.getByRole('link', { name: 'Build your plan and start free' }).click();
  await page.getByRole('radio', { name: /^Starter/ }).click();
  await page.getByRole('checkbox', { name: /Maternity/ }).check();
  const price = page.locator('aside', { hasText: 'Your price' });
  await expect(price).toContainText('Add-on: Maternity');
  await expect(price).toContainText('GH₵800.00');
  await price.getByRole('link', { name: /free trial/ }).click();

  // Sign-up form.
  await expect(page.getByRole('heading', { name: 'Create your hospital on LHIMS' })).toBeVisible();
  await page.getByLabel(/^Facility name/).fill(facilityName);
  await page.getByLabel(/^Type/).selectOption('Clinic');
  await page.getByLabel(/^Phone/).fill('+233 24 555 0100');
  await page.getByLabel(/^Email/).fill(`${username}@e2e.test`);
  await page.getByLabel(/^Your full name/).fill(`Zenith Admin ${t}`);
  await page.getByLabel(/^Username/).fill(username);
  await page.getByLabel(/^Password/).fill('short');
  await page.getByLabel(/^Confirm password/).fill('short');
  await page.getByRole('checkbox', { name: /authorised to register/ }).check();
  await page.getByRole('button', { name: 'Create my hospital and start the trial' }).click();
  await expect(page.getByText('Use at least 10 characters')).toBeVisible();
  await page.getByLabel(/^Password/).fill(password);
  await page.getByLabel(/^Confirm password/).fill(password);
  await page.getByRole('button', { name: 'Create my hospital and start the trial' }).click();

  await expect(page.getByRole('heading', { name: `${facilityName} is ready` })).toBeVisible();
  const code = (await page.getByLabel(/^Facility code/).innerText()).trim();
  expect(code).toMatch(/^[A-Z0-9]{3,}$/);
  await expect(page.getByText(`#/login/${code}`)).toBeVisible();
  await page.getByRole('button', { name: 'Go to my hospital' }).click();

  // Setup checklist.
  await expect(page.getByRole('heading', { name: /Welcome to LHIMS/ })).toBeVisible();
  await expect(page.getByText(`Staff sign in with facility code ${code}`)).toBeVisible();
  await page.getByLabel(/^Address/).fill('7 Ring Road, Accra');
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect(page.getByText('Facility details saved.')).toBeVisible();
  await page.getByRole('button', { name: /Add a starter list/ }).click();
  await expect(page.getByText(/Starter price list: \d+ added/)).toBeVisible();
  await page.getByRole('button', { name: 'Finish setup' }).click();
  await expect(page.getByText('Setup finished.')).toBeVisible();

  // Working inside the hospital: register a walk-in and find an imported test.
  await openFromMenu(page, 'Walk-Ins');
  await page.getByLabel(/^Full name/).fill('Kwesi Mensah');
  await page.getByLabel(/^Phone/).fill('+233 24 000 1234');
  await page.getByRole('button', { name: 'Register Walk-in & Request Tests' }).click();
  await expect(page.getByText('Tests / scans').first()).toBeVisible();
  await page.getByPlaceholder(/Search FBC/).fill('blood');
  await expect(page.getByText('Full blood count')).toBeVisible();

  // Pay the first month through the (test) payment page.
  await openFromMenu(page, 'Subscription & Billing');
  await expect(page.getByText('Free trial')).toBeVisible();
  await page.getByRole('button', { name: 'Choose a plan and pay' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('GH₵800.00').last()).toBeVisible();
  await dialog.getByRole('button', { name: /^Pay GH₵800\.00/ }).click();
  await expect(page.getByRole('heading', { name: 'Test payment (no real money)' })).toBeVisible();
  await page.getByRole('link', { name: 'Pay', exact: true }).click();
  await expect(page.getByText('Payment received.')).toBeVisible();
  await expect(page.getByText('Active', { exact: true })).toBeVisible();
  await expect(page.getByText(/renewals are charged automatically/)).toBeVisible();

  crashes.assertNone();
});
