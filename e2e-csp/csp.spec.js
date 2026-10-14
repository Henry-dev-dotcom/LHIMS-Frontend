import { expect, test } from '@playwright/test';
import { API, openFromMenu, signIn } from '../e2e/helpers.js';

/*
  The security policy must not break the app.

  nginx.conf ships a Content-Security-Policy that refuses inline script and
  limits where styles, fonts and images may come from. That is the point of it -
  and it is also exactly how a policy quietly breaks a product: nothing fails
  loudly, a button just stops doing anything. This serves the real production
  build under the real policy and checks the things that depend on what it
  forbids: that the browser reports no violations at all, and that a print popup's
  Print button - which used to be written into the popup as inline script - still
  prints.
*/
test('the policy blocks nothing the app needs, and printing still works', async ({ page, request, context }) => {
  const violations = [];
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__csp.push(`${event.violatedDirective} <- ${event.blockedURI || 'inline'}`);
    });
  });
  const collect = async (target) => {
    for (const violation of await target.evaluate(() => window.__csp || []).catch(() => [])) violations.push(violation);
  };

  // An order the lab can accept, so there is a slip to print.
  const login = await request.post(`${API}/auth/login`, { data: { facilityCode: 'DEMO', username: 'doctor', password: 'doctor123' } });
  const token = (await login.json()).data.accessToken;
  await request.post(`${API}/doctor/orders`, {
    data: { patientId: 'PAT-0001', urgency: 'ROUTINE', items: [{ catalogItemId: 't3' }] },
    headers: { authorization: `Bearer ${token}` }
  });

  await signIn(page, { code: 'DEMO', username: 'lab', password: 'lab123' });
  await page.waitForTimeout(2500);

  // Window.print would open a dialog nobody can dismiss, so every popup the app
  // opens gets a stand-in that only records that it was called.
  await page.evaluate(() => {
    const open = window.open.bind(window);
    window.__popupPrinted = false;
    window.open = (...args) => {
      const popup = open(...args);
      if (popup) popup.print = () => { window.__popupPrinted = true; };
      return popup;
    };
  });

  await openFromMenu(page, 'Incoming Labs');
  await page.getByRole('row').filter({ hasText: 'Liver Function Test' }).first().getByRole('button', { name: 'Open' }).click();
  await page.getByRole('checkbox', { name: /Accept Liver Function Test/ }).check();
  await page.getByRole('button', { name: /^Accept selected/ }).click();
  const slip = page.getByRole('dialog').filter({ hasText: 'Samples accepted' });
  await expect(slip).toBeVisible();

  const popupOpened = context.waitForEvent('page');
  await slip.getByRole('button', { name: 'Print slip' }).click();
  const popup = await popupOpened;
  await popup.waitForLoadState('domcontentloaded').catch(() => {});
  await popup.getByRole('button', { name: 'Print' }).click();

  await expect.poll(() => page.evaluate(() => window.__popupPrinted), {
    message: 'the Print button in the popup did nothing - inline script is being blocked'
  }).toBe(true);

  await collect(page);
  await collect(popup);
  expect(violations, `the policy blocked something the app needs:\n${[...new Set(violations)].join('\n')}`).toEqual([]);
});

/*
  The home page is the one page with its own fonts, a canvas and a noise texture
  drawn from a data: image, so it is the likeliest to trip a policy that was
  written for the rest of the app. Load it under the real policy and require
  silence.
*/
test('the home page loads under the policy with no violations', async ({ page, context }) => {
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__csp.push(`${event.violatedDirective} <- ${event.blockedURI || 'inline'}`);
    });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Run your whole hospital on one system.' })).toBeVisible();
  // Let the fonts and the first frames of the heartbeat line arrive.
  await page.waitForTimeout(1500);
  const violations = await page.evaluate(() => window.__csp || []);
  expect(violations, `the policy blocked: ${violations.join(' | ')}`).toEqual([]);
});

/*
  The fonts come with the app, not from Google.

  They used to load from fonts.googleapis.com, so a first visit waited on another company's
  servers and, on a slow line, the page took seconds longer to count as loaded. Now no request may
  leave for a font service, and every typeface has to be in use from the app's own files - checked
  on the sign-in page (the app's fonts) and the home page (the website's).
*/
test('fonts are served with the app and nothing is fetched from a font service', async ({ page }) => {
  const external = [];
  page.on('request', (request) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url())) external.push(request.url());
  });
  const loaded = async (families) => page.evaluate(async (names) => {
    await document.fonts.ready;
    // Ask for each face so it loads, then report the ones that came from this site.
    await Promise.all(names.map((name) => document.fonts.load(`700 16px "${name}"`)));
    return names.filter((name) => [...document.fonts].some((face) => face.family.replace(/"/g, '') === name && face.status === 'loaded'));
  }, families);

  await page.goto('/#/login');
  await expect(page.locator('#login-username')).toBeVisible();
  expect(await loaded(['Atkinson Hyperlegible', 'Plus Jakarta Sans'])).toEqual(['Atkinson Hyperlegible', 'Plus Jakarta Sans']);

  await page.goto('/');
  await expect(page.locator('.cm h1').first()).toBeVisible();
  expect(await loaded(['Inter', 'Space Grotesk'])).toEqual(['Inter', 'Space Grotesk']);

  expect(external, `fetched from a font service: ${external.join(', ')}`).toEqual([]);
});

/*
  A browser too old for the styles is told so, plainly, instead of getting a broken page.

  The check runs from its own file (the policy allows no inline script). A current browser must
  see nothing; one whose CSS lacks the colour features must see the notice.
*/
test('a browser too old for the styles is told to update, and a current one is not', async ({ browser }) => {
  const current = await browser.newPage();
  await current.goto('/#/login');
  await expect(current.locator('#login-username')).toBeVisible();
  await expect(current.locator('#browser-too-old')).toHaveCount(0);
  await current.close();

  const old = await browser.newPage();
  await old.addInitScript(() => {
    const real = window.CSS.supports.bind(window.CSS);
    window.CSS.supports = (property, value) => (/oklch|color-mix/.test(String(value)) ? false : real(property, value));
  });
  await old.goto('/#/login');
  await expect(old.getByRole('alert').filter({ hasText: 'This browser is too old for CurataMed.' })).toBeVisible();
  await old.close();
});
