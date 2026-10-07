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

/*
  The website is the front door, even on a device that has signed in before.

  Signing in once was remembered forever, and from then on the plain address
  skipped the site and opened the sign-in form instead — on that device, for
  everyone who used it. One link is handed to investors and customers alike, so
  it has to keep showing what the product is.
*/
test('the plain address shows the website even after somebody has signed in here', async ({ page }) => {
  const crashes = watchForCrashes(page);

  // Arrive cold: the website.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Run your whole hospital/i })).toBeVisible();

  // Sign in and out, which is what used to poison it.
  await signIn(page, { code: 'DEMO', username: 'lab', password: 'lab123' });
  await page.getByRole('button', { name: 'Open user menu' }).click();
  await page.getByRole('button', { name: /Sign out/i }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

  // Open the plain address again: still the website, not the form.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Run your whole hospital/i })).toBeVisible();

  // And the way in is still one click away.
  await page.getByRole('link', { name: 'Sign in' }).first().click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  crashes.assertNone();
});

/*
  The facility code is remembered per device, so staff type it once and never
  again. Two things that matter: it starts empty on a device nobody has signed
  in on, and a code that did not work must not stick - otherwise one typo
  follows that computer around.
*/
test('the facility code starts empty, and is remembered only after a sign-in that worked', async ({ page }) => {
  const crashes = watchForCrashes(page);
  const code = page.getByPlaceholder('e.g. KBTH');

  await page.goto('/#/login');
  await expect(code, 'nobody has signed in on this device yet').toHaveValue('');

  // A wrong code must not be remembered.
  await code.fill('WRONGCODE');
  await page.locator('#login-username').fill('lab');
  await page.locator('input[type="password"]').fill('lab123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText(/Invalid username or password|not found/i).first()).toBeVisible();

  await page.goto('/#/login');
  await page.reload();
  await expect(code, 'a code that failed should not follow the device around').toHaveValue('');

  // A sign-in that works is remembered for next time.
  await signIn(page, { code: 'DEMO', username: 'lab', password: 'lab123' });
  await page.getByRole('button', { name: 'Open user menu' }).click();
  await page.getByRole('button', { name: /Sign out/i }).click();
  await expect(page.getByPlaceholder('e.g. KBTH')).toHaveValue('DEMO');

  crashes.assertNone();
});

/*
  A browser that refuses the session cookie.

  The site and the API are on different registrable domains, so the auth cookie
  is a third-party cookie - and iOS Safari, and the in-app browsers inside
  WhatsApp and the like, drop those by default. Every request then arrives
  unauthenticated: the workspace loads nothing and a reload looks like being
  signed out. This strips Set-Cookie from every API response to reproduce that
  exactly, and the app has to work anyway.
*/
async function refuseAuthCookies(page) {
  await page.route('**/api/**', async (route) => {
    const response = await route.fetch();
    const headers = { ...response.headers() };
    // Every spelling, and never pass `response` through - doing so re-applies
    // the original headers and the cookie survives, which quietly stops this
    // from reproducing anything at all.
    for (const name of Object.keys(headers)) {
      if (name.toLowerCase() === 'set-cookie') delete headers[name];
    }
    const body = await response.body();
    // route.fetch() already put any Set-Cookie into the context's jar, so
    // stripping the header is not enough - the jar has to be emptied before the
    // page ever sees the response.
    await page.context().clearCookies();
    await route.fulfill({ status: response.status(), headers, body });
  });
  await page.context().clearCookies();
}

/** Proves the simulation is still working: no auth cookie may exist. */
async function assertNoAuthCookie(page) {
  const cookies = await page.context().cookies();
  const auth = cookies.filter((c) => /token/i.test(c.name));
  expect(auth, `the cookie was not actually refused, so this proves nothing: ${auth.map((c) => c.name).join(', ')}`).toEqual([]);
}

test('signing in works in a browser that drops the session cookie', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await refuseAuthCookies(page);

  await signIn(page, { code: 'DEMO', username: 'lab', password: 'lab123' });
  await assertNoAuthCookie(page);

  // The symptom was an empty workspace and a bar of failures.
  await expect(page.getByText('Authentication token is required', { exact: false })).toHaveCount(0);
  await expect(page.getByText('Some data failed to load', { exact: false })).toHaveCount(0);

  // Real data has to be there, not just an empty shell.
  await openFromMenu(page, 'Accepted Samples');
  await expect.poll(async () => page.getByRole('button', { name: 'Enter Results' }).count(),
    { message: 'the workspace loaded no data without a cookie' }).toBeGreaterThan(0);

  crashes.assertNone();
});

test('a reload keeps you signed in when the cookie is refused', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await refuseAuthCookies(page);

  await signIn(page, { code: 'DEMO', username: 'lab', password: 'lab123' });
  await assertNoAuthCookie(page);
  await openFromMenu(page, 'Analyzers');
  await expect(page.getByRole('heading', { name: 'Analyzers', level: 1 })).toBeVisible();

  await page.reload();

  // Previously this landed back on the sign-in form, or the public website.
  await expect(page.getByRole('heading', { name: 'Analyzers', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toHaveCount(0);
  crashes.assertNone();
});

test('the platform operator works without a cookie too', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await refuseAuthCookies(page);

  await page.goto('/#/login');
  await page.locator('#login-username').fill('platform');
  await page.locator('input[type="password"]').fill('platform123');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page.locator('#main-content')).toBeVisible();
  await assertNoAuthCookie(page);

  // An empty shell renders with or without a session, so look for data only the
  // platform console can fetch: the facilities it manages.
  await openFromMenu(page, 'Facilities');
  await expect.poll(async () => page.getByText('DEMO', { exact: false }).count(),
    { message: 'the platform console loaded no facilities without a cookie' }).toBeGreaterThan(0);
  await expect(page.getByText('Authentication token is required', { exact: false })).toHaveCount(0);
  crashes.assertNone();
});

/*
  An address typed into the bar has to open that screen.

  The page already lived in the address so a refresh would return to it, but the
  address was only ever written from the state and never read back afterwards -
  so typing or pasting one, or arriving at it with the back button, changed
  nothing and then quietly reverted the bar to the page already open. To anyone
  handed a link to a screen, that reads as the link being broken.
*/
test('typing a workspace address opens that screen, without a reload', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'lab', password: 'lab123' });
  await expect(page.getByRole('heading', { name: 'Incoming Labs', level: 1 }).first()).toBeVisible();

  // As if somebody edited the bar: no reload, only the address changing.
  await page.evaluate(() => { window.location.hash = '#/app/lab-results'; });

  await expect(page.getByRole('heading', { name: 'Results', level: 1 }).first(),
    'the typed address did not open its screen').toBeVisible({ timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => window.location.hash),
    { message: 'the address was reverted to the page that was already open' }).toBe('#/app/lab-results');

  // And going back returns where they were, rather than being overwritten.
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Incoming Labs', level: 1 }).first()).toBeVisible({ timeout: 15_000 });

  crashes.assertNone();
});

test('a typed address for a page the role may not open corrects itself', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'lab', password: 'lab123' });
  await expect(page.getByRole('heading', { name: 'Incoming Labs', level: 1 }).first()).toBeVisible();

  // HR Admin belongs to administrators; laboratory staff have no way to it.
  await page.evaluate(() => { window.location.hash = '#/app/hr-admin'; });

  // The screen does not change, and the bar stops describing one that is not open.
  await expect(page.getByRole('heading', { name: 'Incoming Labs', level: 1 }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.location.hash),
    { message: 'the address was left naming a page the role cannot open' }).toBe('#/app/lab-queue');

  crashes.assertNone();
});
