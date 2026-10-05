import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { STATE_FILE, E2E_API_PORT } from './global-setup';

/* A valid 1×1 PNG. */
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082',
  'hex'
);

test.beforeEach(async ({ page }) => {
  const { token } = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  /* Signed in exactly as the app stores a session. */
  await page.addInitScript((t) => {
    localStorage.setItem('perfox_auth_token', t);
  }, token);
});

test('an uploaded image is stored on the server and still displays after a reload', async ({ page }) => {
  await page.goto('/e2e-harness/media.html');

  await page.getByTestId('media-uploader-input').setInputFiles({
    name: 'product.png',
    mimeType: 'image/png',
    buffer: PNG,
  });

  const img = page.getByRole('img', { name: 'Image 1' });
  await expect(img).toBeVisible();

  const src = await img.getAttribute('src');
  expect(src).toMatch(new RegExp(`^http://localhost:${E2E_API_PORT}/uploads/media/`));
  expect(src).not.toContain('blob:');
  expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);

  const stored = await page.getByTestId('stored').textContent();
  expect(stored).not.toContain('blob:');
  expect(stored).toMatch(/"url":"\/uploads\/media\//);

  /* The whole point: after a reload the saved URL still serves the file. */
  await page.reload();
  const again = page.getByRole('img', { name: 'Image 1' });
  await expect(again).toBeVisible();
  await expect
    .poll(() => again.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
    .toBe(true);
});

test('a disallowed file is refused in the browser and nothing is stored', async ({ page }) => {
  await page.goto('/e2e-harness/media.html');
  await page.getByTestId('media-uploader-input').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  });
  await expect(page.getByRole('alert')).toContainText('Unsupported file type');
  await expect(page.getByTestId('stored')).toHaveText('[]');
});
