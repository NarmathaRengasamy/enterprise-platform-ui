import fs from 'node:fs';
import { expect, test, Page } from '@playwright/test';
import { E2E_API_PORT, STATE_FILE } from './global-setup';

/**
 * Phase 3 end to end: the new products at /v2/products.
 *
 * Admin creates "Creta" (Fuel × Colour, ₹ prices, stock) → publishes → a
 * Viewer finds it with the right ₹ and availability → Admin edits it (item ids
 * never change) → deletes and restores it. Runs against the isolated backend
 * and throwaway database started by global-setup.
 */

const tokens = () => JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as Record<string, string>;
const API = `http://localhost:${E2E_API_PORT}/api`;

const signInAs = async (page: Page, role: 'admin' | 'editor' | 'viewer') => {
  const token = tokens()[role];
  /* Items as compact rows (List) on the form and as a table on the details page,
     so every item's fields are on screen. */
  await page.addInitScript((t) => {
    localStorage.setItem('perfox_auth_token', t);
    localStorage.setItem('v2_items_view', 'list');
    localStorage.setItem('v2_details_items_view', 'table');
  }, token);
  return token;
};

/** Opens a closed accordion / Advanced section by its button (no-op when open). */
const openSection = async (page: Page, name: string | RegExp) => {
  const btn = page.getByRole('button', { name }).first();
  if ((await btn.getAttribute('aria-expanded')) !== 'true') await btn.click();
};

/** Adds a variant option from the "Add variant option" / "Add another option" menu. */
const useOption = async (page: Page, label: string) => {
  await page.getByRole('button', { name: /^(Add variant option|Add another option)$/ }).first().click();
  await page.getByRole('menuitem', { name: `Use ${label}` }).click();
};

const call = async (method: string, path: string, token: string, body?: unknown) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json() };
};

const findProduct = async (token: string, search: string) =>
  (await call('POST', '/v2/products/search', token, { search, include_deleted: true })).body.data.items[0];

const NAME = 'Hyundai Creta';
const SLUG = 'hyundai-creta';
const SKU = (fuel: string, colour: string) => `HYUNDAI-CRETA-${fuel}-${colour}`;
let productId = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  const admin = tokens().admin;
  /* Earlier specs choose Car Dealership and add Colour; make this spec stand on its own. */
  const business = (await call('GET', '/v1/settings/business', admin)).body.data;
  if (!business.business_category) await call('PUT', '/v1/settings/business', admin, { business_category: 'car_dealership', create_starter_categories: true });
  const type = (await call('GET', '/v1/product-type', admin)).body.data;
  const has = (key: string) => type.fields.some((f: any) => f.key === key);
  if (!has('fuel')) await call('POST', '/v1/product-type/fields', admin, { label: { en: 'Fuel' }, type: 'enum', options: ['Petrol', 'Diesel'], variant_forming: true, filterable: true });
  if (!has('colour')) await call('POST', '/v1/product-type/fields', admin, { label: { en: 'Colour' }, type: 'enum', options: ['Red', 'Blue'], variant_forming: true, filterable: true });
  if (!has('net_quantity'))
    await call('POST', '/v1/product-type/fields', admin, { label: { en: 'Net quantity' }, type: 'number', unit: 'ml', unit_family: 'volume', variant_forming: true });
  const cats = (await call('GET', '/v1/catalog-categories', admin)).body.data.categories;
  const all: any[] = [];
  const walk = (n: any[]) => n.forEach((c) => (all.push(c), walk(c.children)));
  walk(cats);
  if (!all.some((c) => c.code === 'suv')) await call('POST', '/v1/catalog-categories', admin, { code: 'suv', name: { en: 'SUV' } });
});

test('Admin creates "Creta" with two variants, ₹ prices and stock — saved as a draft', async ({ page }) => {
  const token = await signInAs(page, 'admin');
  await page.goto('/v2/products');
  await page.getByRole('button', { name: 'Add Product' }).click();

  /* Basics — settings pre-filled from Car Dealership: goods · Track inventory · serial */
  await expect(page.getByRole('radio', { name: 'Track inventory' })).toBeChecked();
  await expect(page.getByLabel('Tracking', { exact: true })).toHaveValue('serial');
  await openSection(page, /^Advanced · Goods/);
  await expect(page.getByLabel('Fulfilment', { exact: true })).toHaveValue('goods');
  /* Serial tracking takes its stock from units added later; this Creta keeps a count instead. */
  await page.getByLabel('Tracking', { exact: true }).selectOption('none');
  await page.getByLabel('Name (English)').fill(NAME);
  await expect(page.getByLabel('Slug')).toHaveValue(SLUG);
  await page.getByLabel('Make').fill('Hyundai');
  await page.getByLabel('Model').fill('Creta');

  /* Categories (badges) */
  await page.getByRole('button', { name: 'Category SUV' }).click();
  await expect(page.getByRole('button', { name: 'Category SUV' })).toHaveAttribute('aria-pressed', 'true');

  /* Tax (an accordion) */
  await openSection(page, /^Tax/);
  await page.getByLabel('HSN code').fill('8703');
  await page.getByLabel('GST rate').selectOption('28');

  /* Variants (an accordion): Fuel × Colour, preview, create */
  await openSection(page, /^Variants/);
  await useOption(page, 'Fuel');
  await page.getByLabel('Fuel Petrol').check({ force: true });
  await page.getByLabel('Fuel Diesel').check({ force: true });
  await useOption(page, 'Colour');
  await page.getByLabel('Colour Red').check({ force: true });
  await page.getByRole('button', { name: 'Preview 2 combinations' }).click();
  await expect(page.getByTestId('variant-preview')).toContainText('2 combinations');
  await page.getByRole('button', { name: 'Create selected' }).click();

  /* Items: ₹ with paise, stock for one */
  await page.getByLabel(`Price ${SKU('PETROL', 'RED')}`).fill('1549999.50');
  await page.getByLabel(`Initial stock ${SKU('PETROL', 'RED')}`).fill('2');
  await page.getByLabel(`Price ${SKU('DIESEL', 'RED')}`).fill('1699999');
  await page.getByRole('button', { name: 'Save draft' }).click();

  await expect(page.getByTestId('product-status')).toHaveText('Draft');
  await expect(page.getByTestId(`item-${SKU('PETROL', 'RED')}`)).toContainText('₹15,49,999.50');
  await expect(page.getByTestId(`item-${SKU('PETROL', 'RED')}`)).toContainText('2 in stock');

  /* Database, via the API */
  const p = await findProduct(token, 'creta');
  productId = p.id;
  const full = (await call('GET', `/v2/products/${productId}`, token)).body.data;
  expect(full).toMatchObject({ status: 'draft', slug: SLUG, fulfilment: 'goods', track_inventory: true, tracking: 'none', min_price_minor: 154999950 });
  expect(full.items.map((i: any) => i.price.amount_minor).sort()).toEqual([154999950, 169999900]);
  expect(full.items.find((i: any) => i.sku === SKU('DIESEL', 'RED')).availability).toMatchObject({ status: 'tracked', on_hand: 0, reserved: 0, available: 0 });
});

test('Admin publishes it; a Viewer finds it with the right ₹ and availability', async ({ page, browser }) => {
  await signInAs(page, 'admin');
  await page.goto(`/v2/products/${productId}`);
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByTestId('product-status')).toHaveText('Active');

  const viewerPage = await browser.newPage();
  await signInAs(viewerPage, 'viewer');
  await viewerPage.goto('/v2/products');
  await viewerPage.getByLabel('Search All Products').fill('creta');
  const row = viewerPage.getByTestId(`product-${SLUG}`);
  await expect(row).toContainText('₹15,49,999.50');
  await expect(row).toContainText('incl. GST');
  await expect(row).toContainText('2 in stock');
  await expect(viewerPage.getByRole('button', { name: /^Edit|^Delete|^Add/ })).toHaveCount(0);
  await viewerPage.close();
});

test('Admin edits it: renames a SKU and adds a variant — existing item ids never change', async ({ page }) => {
  const token = await signInAs(page, 'admin');
  const before = (await call('GET', `/v2/products/${productId}`, token)).body.data.items;
  const ids = Object.fromEntries(before.map((i: any) => [i.sku, i.id]));

  await page.goto(`/v2/products/${productId}/edit`);
  await openSection(page, /^Variants/);
  await page.getByLabel('Colour Blue').check({ force: true });
  await page.getByRole('button', { name: 'Preview 4 combinations' }).click();
  await expect(page.getByTestId('variant-preview')).toContainText('2 new');
  await page.getByLabel('Combination Diesel / Blue').uncheck();
  await page.getByRole('button', { name: 'Create selected' }).click();
  await page.getByLabel(`Price ${SKU('PETROL', 'BLUE')}`).fill('1559999');
  await page.getByLabel(`SKU ${SKU('PETROL', 'RED')}`).fill('CRETA-PETROL-RED');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByTestId('item-CRETA-PETROL-RED')).toBeVisible();

  const after = (await call('GET', `/v2/products/${productId}`, token)).body.data.items;
  expect(after.find((i: any) => i.sku === 'CRETA-PETROL-RED').id).toBe(ids[SKU('PETROL', 'RED')]);
  expect(after.find((i: any) => i.sku === SKU('DIESEL', 'RED')).id).toBe(ids[SKU('DIESEL', 'RED')]);
  const added = after.find((i: any) => i.sku === SKU('PETROL', 'BLUE'));
  expect(Object.values(ids)).not.toContain(added.id);
  expect(after).toHaveLength(3);
  /* Stock was never sent with the edit. */
  expect(after.find((i: any) => i.sku === 'CRETA-PETROL-RED').availability.on_hand).toBe(2);
});

test('Admin deletes it from the list and restores it', async ({ page }) => {
  const token = await signInAs(page, 'admin');
  await page.goto('/v2/products');
  await page.getByRole('button', { name: `Delete ${NAME}` }).click();
  await page.getByRole('dialog', { name: `Delete ${NAME}` }).getByRole('button', { name: 'Delete Product' }).click();
  await expect(page.getByTestId(`product-${SLUG}`)).toHaveCount(0);
  expect((await findProduct(token, 'creta')).is_deleted).toBe(true);

  /* Deleted products are listed under Status → Deleted (1 Oct 2026). */
  await page.getByLabel('Status').selectOption('deleted');
  await page.getByRole('button', { name: `Restore ${NAME}` }).click();
  await page.getByLabel('Status').selectOption('all');
  await expect(page.getByTestId(`product-${SLUG}`)).toBeVisible();
  const back = (await call('GET', `/v2/products/${productId}`, token)).body.data;
  expect(back.items).toHaveLength(3);
});

test('the category screen now counts the new products', async ({ page }) => {
  const token = await signInAs(page, 'admin');
  const stats = (await call('GET', '/v1/catalog-categories/stats', token)).body.data;
  expect(stats.assigned_skus).toBeGreaterThanOrEqual(3);
  await page.goto('/category-tree');
  const kpis = page.getByTestId('category-kpis');
  await expect(kpis).toContainText(`${stats.assigned_skus}`);
  await expect(kpis).not.toContainText('available once products use the new categories');
  await expect(page.getByTestId('product-count-suv')).toContainText(/[1-9]/);
});

test('sizes and purchase limits: "Sunflower Oil" in 500 ml / 1 l with a price per unit and limits (Phase 3b)', async ({ page, browser }) => {
  const token = await signInAs(page, 'admin');
  await page.goto('/v2/products/add');
  await page.getByLabel('Name (English)').fill('Sunflower Oil');
  /* The Car Dealership type requires Make and Model to publish. */
  await page.getByLabel('Make').fill('Fortune');
  await page.getByLabel('Model').fill('Sunlite');
  await page.getByLabel('Tracking', { exact: true }).selectOption('none');

  await openSection(page, /^Variants/);
  await useOption(page, 'Net quantity');
  for (const [amount, unit] of [['500', 'ml'], ['1', 'l'], ['1000', 'ml']]) {
    await page.getByLabel('Net quantity amount').fill(amount);
    await page.getByLabel('Net quantity unit').selectOption(unit);
    await page.getByRole('button', { name: 'Add Net quantity size' }).click();
  }
  await expect(page.getByRole('alert').filter({ hasText: 'same size' })).toContainText('1000 ml is the same size as 1 l');
  await page.getByRole('button', { name: 'Preview 2 combinations' }).click();
  await page.getByRole('button', { name: 'Create selected' }).click();
  await page.getByLabel('Price SUNFLOWER-OIL-500ML').fill('180');
  await expect(page.getByTestId('per-unit-SUNFLOWER-OIL-500ML')).toContainText('₹36 / 100 ml');
  await page.getByLabel('Initial stock SUNFLOWER-OIL-500ML').fill('5');
  await page.getByLabel('Price SUNFLOWER-OIL-1L').fill('320');

  await openSection(page, /^Purchase limits/);
  await page.getByLabel('Limit Max per order').fill('2');
  await page.getByLabel('Limit 30 days').fill('4');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByTestId('product-status')).toHaveText('Draft');
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByTestId('product-status')).toHaveText('Active');

  const p = await findProduct(token, 'sunflower');
  const full = (await call('GET', `/v2/products/${p.id}`, token)).body.data;
  expect(full.items.map((i: any) => i.measure.base_amount).sort((a: number, b: number) => a - b)).toEqual([500, 1000]);
  expect(full.purchase_limits).toMatchObject({ max_per_order: 2, per_customer: { month: 4 } });

  /* A Viewer sees the sizes, the price per unit and the limits. */
  const viewerPage = await browser.newPage();
  await signInAs(viewerPage, 'viewer');
  await viewerPage.goto(`/v2/products/${p.id}`);
  await expect(viewerPage.getByTestId('product-attributes')).toContainText('500 ml, 1 l');
  await expect(viewerPage.getByTestId('per-unit-SUNFLOWER-OIL-500ML')).toContainText('₹36 / 100 ml');
  await expect(viewerPage.getByTestId('limits-SUNFLOWER-OIL-500ML')).toContainText('Max 2 per order · 4 per customer every 30 days');
  await viewerPage.close();
});
