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
