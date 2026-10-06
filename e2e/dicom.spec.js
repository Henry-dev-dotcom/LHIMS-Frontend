import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { expect, test } from '@playwright/test';
import { openFromMenu, signIn, watchForCrashes } from './helpers.js';

/*
  The DICOM viewer has to show the actual picture.

  Parsing a header is easy to get right and proves nothing - a viewer that reads
  the patient's name and then paints black is worse than no viewer, because it
  looks like it worked. So these open real files and check the canvas afterwards:
  that it is the size the file says, and that the pixels are not all one value.

  Two decode paths are covered, because they share no code: uncompressed 16-bit
  monochrome (what a CT or MR writes when asked for uncompressed output) and
  JPEG Baseline colour (handed to the browser to decode).
*/

const fixtures = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

/** Reads the rendered canvas back: its size, and how many distinct greys it holds. */
async function canvasReport(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const context = canvas.getContext('2d');
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const seen = new Set();
    for (let i = 0; i < data.length; i += 4) seen.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
    return { width: canvas.width, height: canvas.height, distinctColours: seen.size };
  });
}

test('the viewer opens an uncompressed study off a disc and renders it', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'scan', password: 'scan123' });
  await openFromMenu(page, 'DICOM Viewer');

  await page.locator('input[aria-label="Open DICOM files"]').setInputFiles([join(fixtures, 'CT_small.dcm')]);

  // Read off the file's own header, which is how we know it was really parsed.
  await expect(page.getByText('1 image(s) open from this computer')).toBeVisible();
  await expect(page.getByText('CT', { exact: false }).first()).toBeVisible();

  const report = await canvasReport(page);
  expect(report, 'no canvas was rendered').not.toBeNull();
  expect(report.width, 'CT_small.dcm is 128 wide').toBe(128);
  expect(report.height).toBe(128);
  expect(report.distinctColours, 'the canvas is a single flat colour, so nothing was decoded').toBeGreaterThan(20);

  // Windowing is live: narrowing it has to change what is on screen.
  const before = report.distinctColours;
  await page.getByRole('combobox', { name: 'Window preset' }).selectOption({ label: 'Brain' });
  await expect.poll(async () => (await canvasReport(page)).distinctColours,
    { message: 'changing the window did not change the image' }).not.toBe(before);

  // The tags come from the file, not from us.
  await page.getByRole('button', { name: 'Tags' }).click();
  await expect(page.getByText('transfer syntax')).toBeVisible();
  await expect(page.getByText('Explicit VR Little Endian', { exact: false })).toBeVisible();

  crashes.assertNone();
});

test('the viewer decodes a JPEG Baseline colour study, and steps through a series', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'scan', password: 'scan123' });
  await openFromMenu(page, 'DICOM Viewer');

  // Two files at once: a series to step through, and both decode paths in one go.
  await page.locator('input[aria-label="Open DICOM files"]').setInputFiles([
    join(fixtures, 'SC_rgb_jpeg_dcmtk.dcm'),
    join(fixtures, 'MR_small.dcm')
  ]);
  await expect(page.getByText('2 image(s) open from this computer')).toBeVisible();

  const first = await canvasReport(page);
  expect(first).not.toBeNull();
  expect(first.distinctColours, 'the JPEG Baseline study decoded to a flat colour').toBeGreaterThan(20);

  // Step to the next image in the series; it is a different size, so the canvas
  // changing size is proof the second file was decoded too.
  await page.getByRole('button', { name: 'Next image' }).click();
  await expect.poll(async () => (await canvasReport(page))?.width,
    { message: 'stepping to the next image did not load it' }).not.toBe(first.width);

  const second = await canvasReport(page);
  expect(second.distinctColours, 'the second study decoded to a flat colour').toBeGreaterThan(20);

  crashes.assertNone();
});

test('a file that is not DICOM is refused in words, not with a blank screen', async ({ page }) => {
  const crashes = watchForCrashes(page);
  await signIn(page, { code: 'DEMO', username: 'scan', password: 'scan123' });
  await openFromMenu(page, 'DICOM Viewer');

  // No extension, so it is taken for a modality's own file and actually tried.
  await page.locator('input[aria-label="Open DICOM files"]').setInputFiles({
    name: 'IM001',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('this is not a DICOM file at all')
  });

  await expect(page.getByText('This image cannot be shown')).toBeVisible();
  await expect(page.getByText('not a readable DICOM file', { exact: false })).toBeVisible();
  crashes.assertNone();
});
