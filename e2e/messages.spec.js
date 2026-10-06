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
    await expect(labPage.getByRole('button', { name: /All departments/ })).toBeVisible();
    await expect(labPage.getByRole('button', { name: /^Laboratory/ })).toBeVisible();
    await expect(labPage.getByRole('button', { name: /^Finance/ }),
      'the laboratory should not be offered the finance channel').toHaveCount(0);

    /* ---- Say it in the shared channel ---- */
    await labPage.getByRole('button', { name: /All departments/ }).click();
    await labPage.getByLabel('Message').fill(body);
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
    await expect(doctorPage.getByRole('button', { name: /^Clinicians/ })).toBeVisible();
    await expect(doctorPage.getByRole('button', { name: /^Laboratory/ }),
      'a clinician should not be offered the laboratory channel').toHaveCount(0);

    /* ---- Replying lands back with the lab without it doing anything ---- */
    const reply = `Understood, sending urines only ${tag()}`;
    await doctorPage.getByLabel('Message').fill(reply);
    await doctorPage.getByRole('button', { name: /^Send/ }).click();
    await expect(labPage.getByText(reply), 'the reply never arrived without a reload').toBeVisible({ timeout: 45_000 });

    labCrashes.assertNone();
    doctorCrashes.assertNone();
  } finally {
    await labContext.close();
    await doctorContext.close();
  }
});
