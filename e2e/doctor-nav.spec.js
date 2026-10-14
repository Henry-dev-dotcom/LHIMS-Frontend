import { expect, test } from '@playwright/test';
import { openFromMenu, signIn, signInAsHospitalDoctor, watchForCrashes } from './helpers.js';

/*
  A hospital doctor's menu is six things and a "More".

  The full menu ran to 28 items in 17 sections. Now the six places a doctor goes all day are
  always in view, and everything else is one click away under More - including the page being
  shown, which opens More by itself. Other roles keep the menu they had.
*/

const PRIMARY = ['Clinician Queue', 'Patients', 'Wards', 'Emergency', 'Clinics', 'Messages'];

async function menuLabels(page) {
  const menu = page.getByRole('navigation').first();
  return (await menu.getByRole('button').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
}

test('a hospital doctor sees six items and More, and every page is still reachable', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signInAsHospitalDoctor(page);
  const menu = page.getByRole('navigation').first();

  // Six items, in this order, then More, collapsed.
  expect(await menuLabels(page)).toEqual([...PRIMARY, 'More']);
  const more = menu.getByRole('button', { name: 'More', exact: true });
  await expect(more).toHaveAttribute('aria-expanded', 'false');

  // Each primary item opens its page.
  for (const label of PRIMARY) {
    await openFromMenu(page, label);
    await expect(page.locator('#main-content')).not.toContainText('Something interrupted this screen', { timeout: 5000 });
    await expect(page.locator('#main-content')).not.toContainText('Access restricted');
  }

  // More holds the occasional pages, and the doctor can open them.
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  for (const label of ['Theatre List', 'Blood Bank', 'DICOM Viewer', 'My Rota & Leave', 'Medical Records']) {
    await expect(menu.getByRole('button', { name: label, exact: true })).toBeVisible();
  }
  await openFromMenu(page, 'Theatre List');
  await expect(page.locator('#main-content')).not.toContainText('Something interrupted this screen', { timeout: 5000 });

  // Collapsing More while on one of its pages keeps the current page in view.
  await more.click();
  await expect(menu.getByRole('button', { name: 'Theatre List', exact: true })).toBeVisible();

  // The clinic pages, Overview and Patient Records are no longer separate menu items.
  for (const label of ['Antenatal Clinic', 'Dental Clinic', 'Overview', 'Patient Records', 'Patients Directory']) {
    await expect(menu.getByRole('button', { name: label, exact: true })).toHaveCount(0);
  }
  crashes.assertNone();
});

test('the Clinics page offers every switched-on clinic and remembers the choice', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signInAsHospitalDoctor(page);
  await openFromMenu(page, 'Clinics');

  const chooser = page.getByRole('navigation', { name: 'Choose a clinic' });
  for (const name of ['Antenatal', 'Postnatal', 'Child welfare', 'Dental', 'Eye', 'Physiotherapy', 'Dietetics']) {
    await expect(chooser.getByRole('button', { name, exact: true })).toBeVisible();
  }

  await chooser.getByRole('button', { name: 'Eye', exact: true }).click();
  await expect(chooser.getByRole('button', { name: 'Eye', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Eye clinic' })).toBeVisible();
  await expect(page.locator('#main-content')).not.toContainText('Something interrupted this screen');

  // Away and back: still on the Eye clinic.
  await openFromMenu(page, 'Messages');
  await openFromMenu(page, 'Clinics');
  await expect(page.getByRole('navigation', { name: 'Choose a clinic' }).getByRole('button', { name: 'Eye', exact: true })).toHaveAttribute('aria-pressed', 'true');
  crashes.assertNone();
});

test('a doctor on a phone gets the same few places on the bottom bar @mobile', async ({ page }) => {
  await signInAsHospitalDoctor(page);
  const bar = page.locator('.mobile-bottom-nav');
  for (const name of ['Go to Home', 'Go to Patients', 'Go to Wards', 'Go to Messages', 'Open full navigation menu']) await expect(bar.getByRole('button', { name, exact: true })).toBeVisible();
  // Not the ordering shortcuts a hospital doctor cannot open.
  for (const name of ['Go to Orders', 'Go to Rx']) await expect(bar.getByRole('button', { name, exact: true })).toHaveCount(0);
});

test('a nurse keeps the full sectioned menu', async ({ page }) => {
  await signIn(page, { code: 'DEMO', username: 'nurse', password: 'nurse123' });
  const menu = page.getByRole('navigation').first();
  await expect(menu.getByRole('button', { name: 'Ward Board', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Antenatal Clinic', exact: true })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'More', exact: true })).toHaveCount(0);
});
