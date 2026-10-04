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

/*
  What someone sees when the server does not answer.

  Free hosting sleeps when idle and takes the better part of a minute to wake.
  The browser's own AbortError used to reach the screen as "signal is aborted
  without reason" — which reads like a crash and tells nobody what to do. For a
  demo link, that is the first impression.
*/
test('a server that cannot be reached says so in words', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await page.route('**/api/auth/login', (route) => route.abort('failed'));
  await page.goto('/#/login');

  await page.getByPlaceholder('e.g. KBTH').fill('DEMO');
  await page.locator('#login-username').fill('lab');
  await page.locator('input[type="password"]').fill('lab123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('We could not reach the server', { exact: false })).toBeVisible();
  await expect(page.getByText('aborted', { exact: false })).toHaveCount(0);
  crashes.assertNone();
});

test('a slow server is described as waking, not as a failure', async ({ page }) => {
  const crashes = watchForCrashes(page);
  // Never answers: the client's own deadline is what gives up.
  await page.route('**/api/auth/login', () => {});
  await page.goto('/#/login');

  await page.getByPlaceholder('e.g. KBTH').fill('DEMO');
  await page.locator('#login-username').fill('lab');
  await page.locator('input[type="password"]').fill('lab123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('may be starting up', { exact: false })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('aborted', { exact: false })).toHaveCount(0);
  crashes.assertNone();
});

test('signing in survives a server that was asleep for the first attempt', async ({ page }) => {
  const crashes = watchForCrashes(page);
  // The first attempt hangs, as a sleeping host does; the retry is let through.
  let attempts = 0;
  await page.route('**/api/auth/login', (route) => {
    attempts += 1;
    if (attempts === 1) return; // never answered: the client times out and wakes it
    return route.continue();
  });

  await page.goto('/#/login');
  await page.getByPlaceholder('e.g. KBTH').fill('DEMO');
  await page.locator('#login-username').fill('lab');
  await page.locator('input[type="password"]').fill('lab123');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // No error shown, and the workspace opens on the retry.
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 25_000 });
  expect(attempts).toBeGreaterThan(1);
  crashes.assertNone();
});
