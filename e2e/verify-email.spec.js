import { expect, test } from '@playwright/test';
import { openFromMenu, signIn, watchForCrashes } from './helpers.js';

/*
  Confirming an email address, from the person's side.

  The property that matters most is the one that is easiest to lose: opening the
  emailed link must do nothing. Mail gateways open every link in a message to scan
  it, and some run the page. If loading the page confirmed the address, the
  scanner would spend the single-use token and the person it was sent to would
  arrive to be told it had expired. So this counts the requests: none on load, one
  when the button is pressed.

  The successful path through the server - a real token being accepted, replayed,
  expiring, losing a race - is covered by the backend integration tests, where the
  emailed link can actually be read. A browser test cannot read the server's mail.
*/

const BOGUS_TOKEN = 'a'.repeat(43);

test('opening the emailed link spends nothing; only the button does', async ({ page }) => {
  const crashes = watchForCrashes(page);
  const calls = [];
  page.on('request', (request) => {
    if (request.url().includes('/auth/email/verify')) calls.push(request.method());
  });

  // Not signed in: the link is usually opened on a phone that has no session.
  await page.goto(`/#/verify-email/${BOGUS_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'Confirm your email address' })).toBeVisible();
  await page.waitForTimeout(2000);
  expect(calls, 'merely opening the link sent a request, so a mail scanner would spend it').toEqual([]);

  await page.getByRole('button', { name: 'Confirm my email' }).click();

  // The server refuses a token it never issued, in words, and the page says so.
  await expect(page.getByRole('alert')).toContainText('invalid or has expired');
  expect(calls, 'the press should have made exactly one POST').toEqual(['POST']);
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

  crashes.assertNone();
});

test('a link with no token says it is incomplete instead of offering a button that cannot work', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await page.goto('/#/verify-email/');
  await expect(page.getByRole('heading', { name: 'Confirm your email address' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('incomplete');
  await expect(page.getByRole('button', { name: 'Confirm my email' })).toHaveCount(0);
  crashes.assertNone();
});

test('an administrator can ask for the verification email from Facility Setup', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'admin', password: 'admin123' });
  await openFromMenu(page, 'Facility Setup');

  await expect(page.getByText('We will send a link to admin@sunkwa.local', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Send verification email' }).click();

  // The test server uses development mail, which writes the link to its log. The
  // person is told exactly that rather than "sent", which would send them off to
  // wait for a message that is never coming.
  await expect(page.getByText('written to the server log', { exact: false })).toBeVisible({ timeout: 15_000 });

  crashes.assertNone();
});
