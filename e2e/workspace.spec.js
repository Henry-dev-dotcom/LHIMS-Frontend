import { expect, test } from '@playwright/test';
import { openFromMenu, signIn, watchForCrashes } from './helpers.js';

/*
  Refreshing should leave you where you were.

  The workspace page used to live only in memory, so every reload dropped
  whoever was signed in back on their landing page — losing the screen they
  were working on, and making it impossible to send anyone a link to a screen.
  It now lives in the address, and is checked against the same permissions the
  menu uses so an address cannot open a page the role could not otherwise reach.
*/

test('a refresh keeps you on the page you were on', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'lab', password: 'lab123' });

  await openFromMenu(page, 'Analyzers');
  await expect(page.getByRole('heading', { name: 'Analyzers', level: 1 })).toBeVisible();
  expect(page.url()).toContain('#/app/lab-analyzers');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Analyzers', level: 1 })).toBeVisible();
  expect(page.url()).toContain('#/app/lab-analyzers');

  crashes.assertNone();
});

test('an address for a page the role may not open falls back to their own landing page', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'lab', password: 'lab123' });

  // HR Admin belongs to administrators; laboratory staff have no menu entry for it.
  await page.goto('/#/app/hr-admin');
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Queue', level: 1 })).toBeVisible();
  expect(page.url()).toContain('#/app/lab-queue');
  crashes.assertNone();
});

test('signing out does not leave a workspace page in the address', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'lab', password: 'lab123' });
  await openFromMenu(page, 'Results');
  expect(page.url()).toContain('#/app/lab-results');

  await page.getByRole('button', { name: 'Open user menu' }).click();
  await page.getByRole('button', { name: /Sign out/i }).click();

  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  expect(page.url()).not.toContain('#/app/');
  crashes.assertNone();
});
