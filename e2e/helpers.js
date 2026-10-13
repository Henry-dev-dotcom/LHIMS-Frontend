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

/*
  Which clinician portal a doctor gets follows the facility's plan: a hospital gets the queue
  and visit workspace, a diagnostic centre keeps the external-ordering portal. There is one demo
  facility, so the kind is overridden in the browser's copy of the login response; the server
  is untouched and every request still goes to it.
*/
async function signInDoctorAs(page, facilityKind) {
  const loginUrl = '**/api/auth/login';
  await page.route(loginUrl, async (route) => {
    const response = await route.fetch();
    const payload = await response.json();
    const user = payload?.data?.user;
    if (!user?.facility) throw new Error('The E2E login response did not include a facility profile.');
    user.facility.facilityKind = facilityKind;
    user.subscription = {
      ...user.subscription,
      plan: { ...user.subscription?.plan, facilityKind }
    };
    await route.fulfill({ response, body: JSON.stringify(payload) });
  });
  try {
    await signIn(page, { code: 'DEMO', username: 'doctor', password: 'doctor123' });
  } finally {
    await page.unroute(loginUrl);
  }
}

/** A doctor in a hospital: lands on the clinician queue. */
export const signInAsHospitalDoctor = (page) => signInDoctorAs(page, 'HOSPITAL');

/** A doctor in a diagnostic centre: keeps the ordering portal (Clinician Dashboard, Orders, New Order). */
export const signInAsDiagnosticCentreDoctor = (page) => signInDoctorAs(page, 'DIAGNOSTIC_CENTRE');

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
