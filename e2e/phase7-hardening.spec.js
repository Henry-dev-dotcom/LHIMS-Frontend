import { expect, test } from '@playwright/test';
import { openFromMenu, signIn, watchForCrashes } from './helpers.js';

for (const viewport of [
  { name: 'phone-375', width: 375, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 }
]) {
  test.describe(`${viewport.name} ward board hardening`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('whiteboard fits the viewport and its controls are keyboard reachable', async ({ page }) => {
      const crashes = watchForCrashes(page);
      await signIn(page, { code: 'DEMO', username: 'nurse', password: 'nurse123' });
      await page.getByRole('button', { name: 'Open full navigation menu', exact: true }).click();
      await openFromMenu(page, 'Ward Board');
      await expect(page.getByRole('heading', { name: 'Ward board' })).toBeVisible();
      const overflow = await page.evaluate(() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      expect(overflow.scrollWidth, `horizontal overflow at ${viewport.width}px`).toBeLessThanOrEqual(overflow.width + 1);
      const refresh = page.getByRole('button', { name: 'Refresh' });
      // Refresh is disabled while the board loads, and a disabled button cannot take focus.
      await expect(refresh).toBeEnabled();
      await refresh.focus();
      await expect(refresh).toBeFocused();
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('BUTTON');
      crashes.assertNone();
    });
  });
}
