import { expect, test } from '@playwright/test';
import { signIn, watchForCrashes } from './helpers.js';

// Every demo role signs in to the demo hospital, sees its own menu (and not
// another role's), and every screen in that menu opens without crashing.
const ROLES = [
  { username: 'admin', password: 'admin123', sees: 'User Management', notSees: 'Plans & Billing' },
  { username: 'doctor', password: 'doctor123', sees: 'New Order', notSees: 'User Management' },
  { username: 'nurse', password: 'nurse123', sees: 'OPD Visits', notSees: 'Invoices' },
  { username: 'reception', password: 'reception123', sees: 'Walk-Ins', notSees: 'Dispensing' },
  { username: 'lab', password: 'lab123', sees: 'Accepted Samples', notSees: 'Walk-Ins' },
  { username: 'scan', password: 'scan123', sees: 'Scan Queue', notSees: 'Dispensing' },
  { username: 'billing', password: 'billing123', sees: 'Invoices', notSees: 'OPD Visits' },
  { username: 'pharmacist', password: 'pharmacist123', sees: 'Dispensing', notSees: 'User Management' }
];

for (const role of ROLES) {
  test(`${role.username}: own menu, and every screen in it opens`, async ({ page }) => {
    const crashes = watchForCrashes(page);
    await signIn(page, { code: 'DEMO', username: role.username, password: role.password });
    const menu = page.getByRole('navigation').first();
    await expect(menu.getByRole('button', { name: role.sees, exact: true })).toBeVisible();
    await expect(menu.getByRole('button', { name: role.notSees, exact: true })).toHaveCount(0);

    const items = await menu.getByRole('button').allInnerTexts();
    for (const label of items.map((t) => t.trim()).filter(Boolean)) {
      await menu.getByRole('button', { name: label, exact: true }).first().click();
      await expect(page.locator('#main-content')).not.toContainText('Something interrupted this screen', { timeout: 5000 });
    }
    crashes.assertNone();
  });
}
