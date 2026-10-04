import { expect } from '@playwright/test';

export const API = 'http://localhost:5001/api';

/** A short random tag so every run creates its own facilities and people. */
export const tag = () => Math.random().toString(36).slice(2, 7).toUpperCase();

/** Fails the test on any uncaught error in the page. */
export function watchForCrashes(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return {
    assertNone: () => expect(errors, `Uncaught errors in the page:\n${errors.join('\n')}`).toEqual([])
  };
}

export async function signIn(page, { code = '', username, password }) {
  await page.goto('/#/login');
  const codeBox = page.getByPlaceholder('e.g. KBTH');
  await codeBox.fill(code);
  await page.locator('#login-username').fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#main-content')).toBeVisible();
}

/** Opens a page from the sidebar (desktop layout). */
export async function openFromMenu(page, label) {
  await page.getByRole('navigation').getByRole('button', { name: label, exact: true }).first().click();
}

/** Signs up a facility through the public API, returning its code and admin login. */
export async function signUpViaApi(request, { name, plan = 'CLINIC' } = {}) {
  const catalogue = await (await request.get(`${API}/public/plans`)).json();
  const planId = catalogue.data.plans.find((p) => p.code === plan).id;
  const username = `admin${tag().toLowerCase()}`;
  const password = `E2e-${tag()}-2026`;
  const res = await request.post(`${API}/public/signup`, {
    data: {
      facility: { name, phone: '+233 20 000 0000', email: `${username}@e2e.test`, address: '1 Test Street, Accra' },
      admin: { name: `E2E Admin ${tag()}`, username, password },
      planId,
      interval: 'MONTHLY',
      addOns: [],
      acceptTerms: true
    }
  });
  expect(res.status(), await res.text()).toBe(201);
  const body = await res.json();
  return { code: body.data.facility.code, id: body.data.facility.id, username, password };
}
