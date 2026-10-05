import fs from 'node:fs';
import { expect, test, Page } from '@playwright/test';
import { E2E_API_PORT, STATE_FILE } from './global-setup';

/**
 * Phase 1 + 1b end to end: UI → API → server → database → API → UI.
 *
 * Runs against the isolated backend and throwaway database started by
 * global-setup — never a developer's own server.
 */

const tokens = () => JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as Record<string, string>;
const API = `http://localhost:${E2E_API_PORT}/api/v1`;

const signInAs = async (page: Page, role: 'admin' | 'editor' | 'viewer') => {
  const token = tokens()[role];
  await page.addInitScript((t) => localStorage.setItem('perfox_auth_token', t), token);
  return token;
};

/* The database state behind the UI, read straight from the API. */
const apiGet = async (path: string, token: string) =>
  (await (await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })).json()).data;

const apiPost = async (path: string, token: string, body: unknown) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
};

test.describe.configure({ mode: 'serial' });

test('Admin picks Car Dealership and only the basic fields are pre-loaded', async ({ page }) => {
  const token = await signInAs(page, 'admin');
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Business & Products' }).click();

  await expect(page.getByRole('radio', { name: /Car Dealership/ })).toContainText('3 fields');
  await page.getByRole('radio', { name: /Car Dealership/ }).click();
  await page.getByRole('button', { name: 'Save business settings' }).click();
  /* The same message also shows as a toast; check the one in the tab. */
  await expect(page.getByTestId('business-settings').getByRole('status')).toContainText('3 attributes loaded');

  /* Database, via the API */
  const settings = await apiGet('/settings/business', token);
  expect(settings.business_category).toBe('car_dealership');
  const type = await apiGet('/product-type', token);
  expect(type.fields.map((f: any) => f.key)).toEqual(['make', 'model', 'body_type']);
  expect(type.fields.some((f: any) => f.variant_forming)).toBe(false); // no variant fields pre-loaded
  expect(settings.active_product_type_id).toBe(type.id);

  /* The workspace settings are untouched by the business save. */
  const site = await apiGet('/settings/site', token);
  expect(site.siteName).toBeTruthy();
});

test('Attributes shows the 3 basic fields; an extra attribute can be added, retired and restored', async ({ page }) => {
  const token = await signInAs(page, 'admin');
  await page.goto('/attributes');

  await expect(page.getByText(/Car Dealership · 3 attributes · version 1/)).toBeVisible();
  await expect(page.getByTestId('attr-body_type')).toContainText('Template');

  await page.getByRole('button', { name: 'Add attribute' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add attribute' });
  await dialog.getByLabel('Name (English)').fill('Warranty (months)');
  await dialog.getByLabel('Type').selectOption('number');
  await dialog.getByLabel('Unit', { exact: true }).fill('months');
  await dialog.getByRole('button', { name: 'Add attribute' }).click();

  const row = page.getByTestId('attr-warranty_months');
  await expect(row).toContainText('Custom');
  await expect(row).toContainText('Number (months)');
  await expect(page.getByText(/4 attributes · version 2/)).toBeVisible();

  await page.getByRole('button', { name: 'Retire Warranty (months)' }).click();
  await expect(row).toContainText('Retired');
  await page.getByRole('button', { name: 'Restore Warranty (months)' }).click();
  await expect(row).not.toContainText('Retired');

  /* Survives a reload: it came from the database, not local state. */
  await page.reload();
  await expect(page.getByTestId('attr-warranty_months')).toContainText('Custom');
  const type = await apiGet('/product-type', token);
  expect(type.fields.find((f: any) => f.key === 'warranty_months')).toMatchObject({ source: 'custom', unit: 'months', deprecated: false });
  expect(type.type_version).toBe(4); // add, retire, restore
});

test('Phase 1b: Admin adds Colour for variants; an Editor adds an option from the product side', async ({ page }) => {
  const adminToken = await signInAs(page, 'admin');
  const editorToken = tokens().editor;
  await page.goto('/attributes');

  /* Admin creates the shared choice list — usable for variants by default. */
  await page.getByRole('button', { name: 'Add attribute' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add attribute' });
  await dialog.getByLabel('Name (English)').fill('Colour');
  await dialog.getByLabel('Type').selectOption('enum');
  await expect(dialog.getByLabel('Can be used for variants')).toBeChecked();
  /* Options are added one at a time (type + Enter), shown as chips. */
  await dialog.getByLabel('New option', { exact: true }).fill('Red');
  await dialog.getByLabel('New option', { exact: true }).press('Enter');
  await dialog.getByLabel('New option', { exact: true }).fill('Blue');
  await dialog.getByLabel('New option', { exact: true }).press('Enter');
  await dialog.getByRole('button', { name: 'Add attribute' }).click();
  await expect(page.getByTestId('attr-colour')).toContainText('Red, Blue');
  await expect(page.getByTestId('attr-colour')).toContainText('Variants');

  /* An Editor (as the product form will) adds "Maroon" to the shared list. */
  const added = await apiPost('/product-type/fields/colour/options', editorToken, { options: ['Maroon'] });
  expect(added.status).toBe(200);
  expect(added.body.data.added).toEqual(['maroon']);

  /* A typo is held back with a warning, nothing saved. */
  const typo = await apiPost('/product-type/fields/colour/options', editorToken, { options: ['Rde'] });
  expect(typo.body.data.warnings[0]).toMatchObject({ label: 'Rde', similar_to: 'Red' });

  /* An Editor still cannot create attributes. */
  const forbidden = await apiPost('/product-type/fields', editorToken, { label: { en: 'Size' }, type: 'enum', options: ['S'] });
  expect(forbidden.status).toBe(403);

  /* The shared attribute shows the new option for everyone. */
  await page.reload();
  await expect(page.getByTestId('attr-colour')).toContainText('Red, Blue, Maroon');
  const colour = (await apiGet('/product-type', adminToken)).fields.find((f: any) => f.key === 'colour');
  expect(colour.options.map((o: any) => o.value)).toEqual(['red', 'blue', 'maroon']);
});

test('a template attribute keeps its type, and a refused change is explained', async ({ page }) => {
  await signInAs(page, 'admin');
  await page.goto('/attributes');
  await page.getByRole('button', { name: 'Edit Body type' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Type')).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  /* Adding a key that already exists is refused by the server and shown as-is. */
  await page.getByRole('button', { name: 'Add attribute' }).click();
  await page.getByRole('dialog').getByLabel('Name (English)').fill('Make');
  await page.getByRole('dialog').getByRole('button', { name: 'Add attribute' }).click();
  await expect(page.getByText(/already exists/)).toBeVisible();
});

test('a Viewer sees the attributes read-only and cannot change the business category', async ({ page }) => {
  const token = await signInAs(page, 'viewer');
  await page.goto('/attributes');
  await expect(page.getByTestId('attr-make')).toBeVisible();
  await expect(page.getByText(/Read-only/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add attribute' })).toHaveCount(0);

  /* And the server refuses it too, whatever the UI shows. */
  const res = await fetch(`${API}/settings/business`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ business_category: 'general' }),
  });
  expect(res.status).toBe(403);
  const option = await apiPost('/product-type/fields/colour/options', token, { options: ['Green'] });
  expect(option.status).toBe(403);
});
