import { expect, test } from '@playwright/test';
import { openFromMenu, signIn, tag, watchForCrashes } from './helpers.js';

/*
  Two departments reaching each other.

  The point of this is that a message sent by one person appears for another, in
  a different role, without anybody reloading anything - so it is tested with two
  browser contexts rather than one, because one context proves only that a page
  can read back its own writes.

  It also checks what each person is offered: the laboratory must not be handed
  the finance channel, and every message has to say when it expires, because that
  is the promise the feature makes and the reason it must not be used for
  anything that has to be kept.
*/

test('the lab says something and the doctor sees it, and channels stay private', async ({ browser }) => {
  const labContext = await browser.newContext();
  const doctorContext = await browser.newContext();
  const labPage = await labContext.newPage();
  const doctorPage = await doctorContext.newPage();
  const labCrashes = watchForCrashes(labPage);
  const doctorCrashes = watchForCrashes(doctorPage);

  const body = `Centrifuge is down, hold anything spinnable ${tag()}`;

  try {
    await signIn(labPage, { code: 'DEMO', username: 'lab', password: 'lab123' });
    await openFromMenu(labPage, 'Messages');

    /* ---- The lab is offered its own channel and the shared one, not Finance ---- */
    const labChannels = labPage.getByRole('region', { name: 'Channels' });
    const labDepartments = labPage.getByRole('region', { name: 'Message another department' });
    await expect(labChannels.getByRole('button', { name: /All departments/ })).toBeVisible();
    await expect(labChannels.getByRole('button', { name: /^Laboratory/ })).toBeVisible();
    await expect(labChannels.getByRole('button', { name: /^Finance/ }),
      'the laboratory should not be offered the finance channel').toHaveCount(0);
    // Finance's own channel is closed to the lab, but the lab can write to Finance privately.
    await expect(labDepartments.getByRole('button', { name: /^Finance/ })).toBeVisible();

    /* ---- Say it in the shared channel ---- */
    await labPage.getByRole('button', { name: /All departments/ }).click();
    await labPage.getByRole('textbox', { name: 'Message', exact: true }).fill(body);
    await labPage.getByRole('button', { name: /^Send/ }).click();

    const sent = labPage.getByText(body);
    await expect(sent).toBeVisible({ timeout: 20_000 });
    // Every message says how long it has, so nobody mistakes this for a record.
    await expect(labPage.getByText(/expires in \d+ h/).first()).toBeVisible();

    /* ---- And the doctor sees it, in a different session ---- */
    await signIn(doctorPage, { code: 'DEMO', username: 'doctor', password: 'doctor123' });
    await openFromMenu(doctorPage, 'Messages');
    await doctorPage.getByRole('button', { name: /All departments/ }).click();

    await expect(doctorPage.getByText(body), 'the message never reached the other department').toBeVisible({ timeout: 30_000 });

    /* ---- The doctor's own channel is the clinical one, not the lab's ---- */
    const doctorChannels = doctorPage.getByRole('region', { name: 'Channels' });
    await expect(doctorChannels.getByRole('button', { name: /^Clinicians/ })).toBeVisible();
    await expect(doctorChannels.getByRole('button', { name: /^Laboratory/ }),
      'a clinician should not be offered the laboratory channel').toHaveCount(0);

    /* ---- Replying lands back with the lab without it doing anything ---- */
    const reply = `Understood, sending urines only ${tag()}`;
    await doctorPage.getByRole('textbox', { name: 'Message', exact: true }).fill(reply);
    await doctorPage.getByRole('button', { name: /^Send/ }).click();
    await expect(labPage.getByText(reply), 'the reply never arrived without a reload').toBeVisible({ timeout: 45_000 });

    /* ---- A private note from the lab to Finance is not the clinicians' to read ---- */
    const privateNote = `Reagent invoice query ${tag()}`;
    await labDepartments.getByRole('button', { name: /^Finance/ }).click();
    await labPage.getByRole('textbox', { name: 'Message', exact: true }).fill(privateNote);
    await labPage.getByRole('button', { name: /^Send/ }).click();
    await expect(labPage.getByRole('log', { name: 'Finance conversation' }).getByText(privateNote)).toBeVisible({ timeout: 20_000 });

    await doctorPage.getByRole('region', { name: 'Message another department' }).getByRole('button', { name: /^Finance/ }).click();
    await expect(doctorPage.getByRole('log', { name: 'Finance conversation' })).toBeVisible();
    await doctorPage.getByRole('region', { name: 'Channels' }).getByRole('button', { name: /All departments/ }).click();
    await expect(doctorPage.getByText(reply)).toBeVisible();
    await expect(doctorPage.getByText(privateNote), 'a private department note leaked into another department').toHaveCount(0);
    await doctorPage.getByRole('region', { name: 'Message another department' }).getByRole('button', { name: /^Finance/ }).click();
    await expect(doctorPage.getByRole('log', { name: 'Finance conversation' })).toBeVisible();
    await expect(doctorPage.getByText(privateNote), 'a private department note leaked into another department').toHaveCount(0);

    labCrashes.assertNone();
    doctorCrashes.assertNone();
  } finally {
    await labContext.close();
    await doctorContext.close();
  }
});
