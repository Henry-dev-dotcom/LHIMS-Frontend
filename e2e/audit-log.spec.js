import { expect, test } from '@playwright/test';
import { openFromMenu, signIn, watchForCrashes } from './helpers.js';

/*
  Looking at the audit log, and then at everything else.

  Opening the log is itself recorded, with structured details (how many rows and
  which filters). The second time anyone opens the log those entries are in it,
  and rendering that object as text crashed the screen - and, because the error
  stayed on show, every screen opened after it. So this opens the log twice and
  then goes somewhere else.
*/
test('the audit log shows its own view entries, and a crash on one screen would not follow to the next', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'admin', password: 'admin123' });
  await openFromMenu(page, 'Audit Log');
  await expect(page.getByRole('heading', { name: 'Audit Log', exact: true }).first()).toBeVisible();
  // The log is loaded when the workspace opens, so a fresh load is what brings
  // in the entry that the first view just wrote.
  await page.reload();
  await openFromMenu(page, 'Audit Log');
  await expect(page.getByText('Something interrupted this screen')).toHaveCount(0);
  await expect(page.getByText('AUDIT_LOGS_VIEWED').first()).toBeVisible();
  await expect(page.getByText('[object Object]')).toHaveCount(0);
  await openFromMenu(page, 'Overview');
  await expect(page.getByText('Something interrupted this screen')).toHaveCount(0);
  crashes.assertNone();
});
