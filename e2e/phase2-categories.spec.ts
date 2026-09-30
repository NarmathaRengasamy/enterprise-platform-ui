import fs from 'node:fs';
import { expect, test, Page } from '@playwright/test';
import { E2E_API_PORT, STATE_FILE } from './global-setup';

/**
 * Phase 2 end to end: categories, flat by default, with the optional tree.
 *
 * Admin (flat) adds Shirts and Jeans → switches the tree on → adds Men →
 * T-shirts → switching back to flat is refused → deletes and restores a
 * category. Runs against the isolated backend and throwaway database started by
 * global-setup — never a developer's own server.
 */

const tokens = () => JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) as Record<string, string>;
const API = `http://localhost:${E2E_API_PORT}/api/v1`;

const signInAs = async (page: Page, role: 'admin' | 'editor' | 'viewer') => {
  const token = tokens()[role];
  await page.addInitScript((t) => localStorage.setItem('perfox_auth_token', t), token);
  return token;
};

const call = async (method: string, path: string, token: string, body?: unknown) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json() };
};

/* Every category, flattened, straight from the API. */
const allCategories = async (token: string, includeDeleted = false) => {
  const { body } = await call('GET', `/catalog-categories${includeDeleted ? '?include_deleted=true' : ''}`, token);
  const out: any[] = [];
  const walk = (nodes: any[]) => nodes.forEach((n) => (out.push(n), walk(n.children)));
  walk(body.data.categories);
  return { mode: body.data.mode as string, rows: out };
};

const byCode = (rows: any[], code: string) => rows.find((r) => r.code === code && !r.is_deleted);

const addCategory = async (page: Page, code: string, name: string, singular = 'Category') => {
  const dialog = page.getByRole('dialog', { name: `Add New ${singular}` });
  await dialog.getByLabel('Code').fill(code);
  await dialog.getByLabel('Name (English)').fill(name);
  await dialog.getByRole('button', { name: `Save ${singular}` }).click();
  await expect(dialog).toHaveCount(0);
};

/* Row actions other than Edit / Restore sit in the row's "more" menu, like the Categories page. */
const rowMenu = async (page: Page, name: string, action: string) => {
  await page.getByRole('button', { name: `More actions for ${name}` }).click();
  await page.getByRole('menuitem', { name: action }).click();
};

const openBusinessSettings = async (page: Page) => {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Business & Products' }).click();
  await expect(page.getByTestId('business-settings')).toBeVisible();
};

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  /* Phase 1's spec normally chose Car Dealership already; make this spec stand on its own. */
  const admin = tokens().admin;
  const { body } = await call('GET', '/settings/business', admin);
  if (!body.data.business_category) {
    await call('PUT', '/settings/business', admin, { business_category: 'car_dealership', create_starter_categories: true });
  }
});

test('flat by default: the starter categories are all top level, and Admin adds Shirts and Jeans', async ({ page }) => {
  const token = await signInAs(page, 'admin');
  const before = await allCategories(token);
  expect(before.mode).toBe('flat');
  /* The Car template's tree, flattened (K17). */
  for (const code of ['cars', 'suv', 'sedan', 'hatchback', 'accessories', 'service']) {
    expect(byCode(before.rows, code)).toMatchObject({ parent_id: null });
  }

  await page.goto('/category-tree');
  await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
  await expect(page.getByTestId('category-summary')).toContainText('Flat list');
  /* KPI cards like the Categories page; the product-based ones wait for Phase 3. */
  const kpis = page.getByTestId('category-kpis');
  await expect(kpis).toContainText('Total Categories');
  await expect(kpis.getByText('available once products use the new categories')).toHaveCount(3);

  await page.getByRole('button', { name: 'Add Category' }).click();
  await addCategory(page, 'shirts', 'Shirts');
  await page.getByRole('button', { name: 'Add Category' }).click();
  await addCategory(page, 'jeans', 'Jeans');
  await expect(page.getByTestId('cat-shirts')).toBeVisible();
  await expect(page.getByTestId('cat-jeans')).toBeVisible();

  /* Flat mode: the row menu has no parent actions. */
  await page.getByRole('button', { name: 'More actions for Shirts' }).click();
  await expect(page.getByRole('menuitem', { name: /Add sub-category/ })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: 'Move Shirts down' })).toBeVisible();
  await page.keyboard.press('Escape'); // closes the row menu
  await expect(page.getByRole('menu')).toHaveCount(0);

  /* Database, via the API: both top level, Jeans after Shirts. */
  const { rows } = await allCategories(token);
  expect(byCode(rows, 'shirts')).toMatchObject({ parent_id: null, status: 'active' });
  expect(byCode(rows, 'jeans').sort_order).toBeGreaterThan(byCode(rows, 'shirts').sort_order);

  /* Flat mode refuses a parent, whatever a client sends. */
  const refused = await call('POST', '/catalog-categories', token, { code: 'polo', name: { en: 'Polo' }, parent_id: byCode(rows, 'shirts').id });
  expect(refused.status).toBe(422);
  expect(refused.body.message).toMatch(/switch it on/);

  /* A duplicate code is refused and the reason shown in the modal. */
  await page.getByRole('button', { name: 'Add Category' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add New Category' });
  await dialog.getByLabel('Code').fill('shirts');
  await dialog.getByLabel('Name (English)').fill('Shirts again');
  await dialog.getByRole('button', { name: 'Save Category' }).click();
  await expect(dialog.getByRole('alert')).toContainText('A category with the code "shirts" already exists');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
});

test('Admin switches the tree on and adds Men → T-shirts, which inherits', async ({ page }) => {
  const token = await signInAs(page, 'admin');
  await openBusinessSettings(page);
  const toggle = page.getByRole('switch', { name: 'Use category tree' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await page.getByRole('button', { name: 'Save business settings' }).click();
  await expect(page.getByTestId('business-settings').getByRole('status')).toContainText('Business settings saved');
  expect((await call('GET', '/settings/business', token)).body.data.category_mode).toBe('tree');

  await page.goto('/category-tree');
  await expect(page.getByTestId('category-summary')).toContainText('Tree');
  await page.getByRole('button', { name: 'Add Category' }).click();
  await addCategory(page, 'men', 'Men');

  /* Men limits its visible fields; T-shirts inherits them. */
  await page.getByRole('button', { name: 'Edit Men' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit Category' });
  /* Visible fields sit under a collapsed Advanced section (R12). */
  const advanced = edit.getByRole('button', { name: 'Advanced' });
  await expect(advanced).toHaveAttribute('aria-expanded', 'false');
  await advanced.click();
  await edit.getByLabel('Only these fields').check();
  /* Exactly Make and Body type — earlier specs may have added more attributes. */
  for (const box of await edit.getByRole('checkbox', { name: /^Show / }).all()) {
    if (['Show Make', 'Show Body type'].includes((await box.getAttribute('aria-label')) ?? '')) await box.check();
    else await box.uncheck();
  }
  await expect(edit.getByRole('button', { name: 'Advanced · 2 fields' })).toBeVisible();
  await expect(edit.getByLabel('Fulfilment')).toHaveCount(0); // a product setting now (R13)
  await edit.getByRole('button', { name: 'Update Category' }).click();
  await expect(edit).toHaveCount(0);

  /* Reopen: the hint shows on the collapsed toggle; renaming without opening
     Advanced keeps the fields. */
  await page.getByRole('button', { name: 'Edit Men' }).click();
  const again = page.getByRole('dialog', { name: 'Edit Category' });
  await expect(again.getByRole('button', { name: 'Advanced · 2 fields' })).toHaveAttribute('aria-expanded', 'false');
  await again.getByLabel('Name (Tamil)').fill('ஆண்கள்');
  await again.getByRole('button', { name: 'Update Category' }).click();
  await expect(again).toHaveCount(0);

  await rowMenu(page, 'Men', 'Add sub-category to Men');
  const add = page.getByRole('dialog', { name: 'Add New Category' });
  await add.getByRole('button', { name: 'Advanced' }).click();
  await expect(add.getByTestId('inherited-fields')).toHaveText('Make, Body type');
  await addCategory(page, 't-shirts', 'T-shirts');
  await expect(page.getByTestId('cat-t-shirts')).toContainText('2 fields (inherited)');
  /* An indented row under Men; collapsing Men hides it. */
  await expect(page.getByTestId('cat-t-shirts')).toHaveAttribute('aria-level', '2');
  await page.getByRole('button', { name: 'Collapse Men' }).click();
  await expect(page.getByTestId('cat-t-shirts')).toHaveCount(0);
  await page.getByRole('button', { name: 'Expand Men' }).click();
  await expect(page.getByTestId('cat-t-shirts')).toBeVisible();

  const { rows } = await allCategories(token);
  const men = byCode(rows, 'men');
  expect(men).toMatchObject({ name: { en: 'Men', ta: 'ஆண்கள்' }, visible_field_keys: ['make', 'body_type'] });
  expect(byCode(rows, 't-shirts')).toMatchObject({
    parent_id: men.id,
    visible_field_keys: [],
    resolved_visible_field_keys: ['make', 'body_type'],
  });
  /* Categories carry no fulfilment / tracking (R13). */
  for (const r of rows) {
    for (const k of ['fulfilment', 'tracking', 'resolved_fulfilment', 'resolved_tracking']) expect(r).not.toHaveProperty(k);
  }

  /* "Move to…" never offers a category's own sub-category (no cycles). */
  await rowMenu(page, 'Men', 'Move Men to another parent');
  const move = page.getByRole('dialog', { name: 'Move Men' });
  await expect(move.getByRole('option', { name: /T-shirts/ })).toHaveCount(0);
  await move.getByRole('button', { name: 'Cancel' }).click();
  const cycle = await call('PATCH', `/catalog-categories/${men.id}`, token, { parent_id: byCode(rows, 't-shirts').id });
  expect(cycle.status).toBe(422);
});

test('switching the tree off is refused while T-shirts has a parent', async ({ page }) => {
  const token = await signInAs(page, 'admin');
  await openBusinessSettings(page);
  const toggle = page.getByRole('switch', { name: 'Use category tree' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await page.getByRole('button', { name: 'Save business settings' }).click();

  await expect(page.getByTestId('business-settings').getByRole('alert')).toContainText(/still ha(s|ve) a parent/);
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect((await call('GET', '/settings/business', token)).body.data.category_mode).toBe('tree');
});

test('Admin deletes and restores a category; one with sub-categories is refused', async ({ page }) => {
  const token = await signInAs(page, 'admin');
  await page.goto('/category-tree');

  /* The same confirmation modal as the Categories page. */
  await rowMenu(page, 'Men', 'Delete Men');
  await page.getByRole('dialog', { name: 'Delete Men' }).getByRole('button', { name: 'Delete Category' }).click();
  await expect(page.getByText(/Cannot delete: Has live sub-categories \(T-shirts\)/)).toBeVisible();
  await expect(page.getByTestId('cat-men')).toBeVisible();

  await rowMenu(page, 'Jeans', 'Delete Jeans');
  await page.getByRole('dialog', { name: 'Delete Jeans' }).getByRole('button', { name: 'Delete Category' }).click();
  await expect(page.getByTestId('cat-jeans')).toHaveCount(0);
  expect(byCode((await allCategories(token)).rows, 'jeans')).toBeUndefined();

  await page.getByLabel('Show deleted').check();
  const deleted = page.getByTestId('cat-jeans-deleted');
  await expect(deleted).toContainText('Deleted');
  await deleted.getByRole('button', { name: 'Restore Jeans' }).click();
  await expect(page.getByTestId('cat-jeans')).toBeVisible();

  /* Database: live again, and no live category points at a missing or deleted parent. */
  const { rows } = await allCategories(token, true);
  expect(byCode(rows, 'jeans')).toBeTruthy();
  const live = new Map(rows.filter((r) => !r.is_deleted).map((r) => [r.id, r]));
  for (const r of live.values()) if (r.parent_id) expect(live.has(r.parent_id)).toBe(true);
  const codes = [...live.values()].map((r) => r.code);
  expect(new Set(codes).size).toBe(codes.length);
});

test('a Viewer sees the categories read-only; an Editor cannot delete or switch the mode', async ({ page }) => {
  await signInAs(page, 'viewer');
  await page.goto('/category-tree');
  await expect(page.getByTestId('cat-men')).toBeVisible();
  await expect(page.getByText(/Read-only/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Category' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Edit / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^More actions/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export CSV' })).toHaveCount(0);
  await expect(page.getByLabel('Select all')).toHaveCount(0);

  const { viewer, editor, admin } = tokens();
  const men = byCode((await allCategories(admin)).rows, 'men');
  expect((await call('POST', '/catalog-categories', viewer, { code: 'nope', name: { en: 'Nope' } })).status).toBe(403);
  expect((await call('DELETE', `/catalog-categories/${men.id}`, editor)).status).toBe(403);
  expect((await call('PUT', '/settings/business', editor, { business_category: 'car_dealership', category_mode: 'flat' })).status).toBe(403);
  expect((await call('GET', '/catalog-categories/export', viewer)).status).toBe(403);
});

test('the screen follows a renamed label, and exports the filtered CSV', async ({ page }) => {
  const admin = await signInAs(page, 'admin');
  const rename = (plural: string, singular: string) =>
    call('PUT', '/settings/site', admin, { labels: { categories: { plural, singular } } });
  expect((await rename('Car Types', 'Car Type')).status).toBe(200);
  try {
    await page.goto('/category-tree');
    await expect(page.getByRole('heading', { level: 1, name: 'Car Types' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Car Type' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Car Types (new)' })).toBeVisible(); // sidebar
    await expect(page.getByTestId('category-kpis')).toContainText('Total Car Types');

    /* Export what the search shows: "shirt" matches Shirts and T-shirts (under Men). */
    await page.getByLabel('Search Car Types').fill('shirt');
    await expect(page.getByTestId('cat-shirts')).toBeVisible();
    await expect(page.getByTestId('cat-jeans')).toHaveCount(0);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export CSV' }).click()]);
    expect(download.suggestedFilename()).toBe('categories.csv');
    await expect(page.getByText('Car Types exported successfully.')).toBeVisible();

    const text = fs.readFileSync((await download.path())!, 'utf8').replace(/^\uFEFF/, '');
    const [header, ...lines] = text.split('\r\n');
    expect(header).toBe('code,name_en,name_ta,name_hi,parent_code,status,sort_order,visible_field_keys');
    const rows = lines.map((l) => [...l.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1]));
    expect(rows.map((r) => r[0])).toEqual(['shirts', 't-shirts']);
    expect(rows[1][4]).toBe('men'); // parent_code
  } finally {
    /* Back to the default, so nothing after this run sees "Car Types". */
    await rename('Categories', 'Category');
  }
});
