import { expect, test } from '@playwright/test';
import { watchForCrashes } from './helpers.js';

// The public website on a phone: every page fits the screen and the menu works.
test('@mobile the website works on a phone', async ({ page }) => {
  const crashes = watchForCrashes(page);
  for (const path of ['/#/home', '/#/features', '/#/pricing', '/#/signup', '/#/demo', '/#/login']) {
    await page.goto(path);
    await expect(page.locator('body')).not.toContainText('Something interrupted this screen');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(1);
  }
  await page.goto('/#/home');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('navigation', { name: 'Website' }).getByRole('link', { name: 'Pricing' }).click();
  await expect(page.getByRole('heading', { name: 'What kind of facility do you run?' })).toBeVisible();
  crashes.assertNone();
});

test('@mobile a demo request can be sent from a phone', async ({ page }) => {
  await page.goto('/#/demo');
  await page.getByLabel(/^Your name/).fill('Dr Ama Owusu');
  await page.getByLabel(/^Hospital or clinic/).fill('Owusu Memorial');
  await page.getByLabel(/^Email/).fill('ama@owusu.e2e.test');
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you' })).toBeVisible();
});

/*
  The plan builder asks what kind of facility someone runs before it shows a
  price, so a diagnostic centre or a pharmacy never has to read past hospital
  pricing to find itself. Each kind shows only its own plans — and any
  department can still be bought on top of any of them.
*/
test('the plan builder is grouped by the kind of facility, and anything can be added on top', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await page.goto('/#/pricing');
  await expect(page.getByRole('heading', { name: 'What kind of facility do you run?' })).toBeVisible();

  // A pharmacy sees a pharmacy plan, and no hospital pricing at all.
  await page.getByRole('radio', { name: /^Pharmacy/ }).click();
  await expect(page.getByRole('heading', { name: 'Pharmacy', level: 1 })).toBeVisible();
  const plans = page.locator('[aria-label="Plan"]');
  await expect(plans).toContainText('GH₵400.00');
  await expect(plans).not.toContainText('Hospital');

  // It can still buy a laboratory, which its own plan does not include.
  await page.getByRole('checkbox', { name: /Laboratory/ }).check();
  const price = page.locator('aside', { hasText: 'Your price' });
  await expect(price).toContainText('Add-on: Laboratory');
  await expect(price).toContainText('GH₵750.00');

  // Hospital is the one kind sold in two sizes.
  await page.getByRole('button', { name: 'A different kind of facility' }).click();
  await page.getByRole('radio', { name: /^Hospital/ }).click();
  await expect(plans).toContainText('District Hospital');
  await expect(plans).toContainText('Full Hospital');
  crashes.assertNone();
});
