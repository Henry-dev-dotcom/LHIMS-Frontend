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
  await expect(page.getByRole('heading', { name: 'Pay for the departments you use' })).toBeVisible();
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
