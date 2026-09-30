import { expect, test } from '@playwright/test';
import { openFromMenu, signIn, signUpViaApi, tag, watchForCrashes } from './helpers.js';

test('the platform operator sees the business overview and a read-only support session', async ({ page, request }) => {
  const crashes = watchForCrashes(page);
  const name = `Support ${tag()} Hospital`;
  await signUpViaApi(request, { name });

  await signIn(page, { username: 'platform', password: 'platform123' });
  await expect(page.getByRole('heading', { name: 'Business overview' })).toBeVisible();
  await expect(page.getByText('Monthly recurring revenue')).toBeVisible();

  await openFromMenu(page, 'Facilities');
  await page.getByRole('row', { name: new RegExp(name) }).getByRole('button', { name: 'Support' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/^Reason/).fill('Checking a problem the administrator reported');
  await dialog.getByRole('button', { name: 'Open support session' }).click();

  const banner = page.getByText(/Support session · read-only/);
  await expect(banner).toBeVisible();
  await expect(page.getByText(`is viewing ${name}`)).toBeVisible();

  // Nothing can be changed.
  await openFromMenu(page, 'Facility Setup');
  await page.getByLabel(/^Address/).fill('Changed by support');
  await page.getByRole('button', { name: 'Save details' }).click();
  await expect(page.getByText('This is a read-only support session. Nothing can be changed.')).toBeVisible();

  await page.getByRole('button', { name: 'End support session' }).click();
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  crashes.assertNone();
});
