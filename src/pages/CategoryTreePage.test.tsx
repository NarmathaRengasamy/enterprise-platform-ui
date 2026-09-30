import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { CategoryList, CategoryNode } from '../types/catalogCategory.types';

const role = { current: 'Admin' };
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { role: role.current } }) }));

/* Labels as the Site Settings context gives them; tests may rename them. */
const DEFAULT_LABELS = {
  categories: { plural: 'Categories', singular: 'Category' },
  allProducts: { plural: 'All Products', singular: 'Product' },
};
const labels = { current: { ...DEFAULT_LABELS } as Record<string, { plural: string; singular: string }> };
vi.mock('../context/SiteSettingsContext', () => ({
  useLabels: () => {
    const get = (k: string) => labels.current[k];
    const plain = (v: string) => (/^[A-Z][a-z]+$/.test(v) ? v.toLowerCase() : v);
    return {
      get,
      plural: (k: string) => get(k).plural,
      singular: (k: string) => get(k).singular,
      lower: (k: string) => plain(get(k).plural),
      lowerSingular: (k: string) => plain(get(k).singular),
    };
  },
}));

const api = vi.hoisted(() => ({
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  reorder: vi.fn(),
  remove: vi.fn(),
  restore: vi.fn(),
  exportCsv: vi.fn(),
}));
vi.mock('../services/catalogCategory.service', () => ({ catalogCategoryService: api }));

const types = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../services/productType.service', () => ({ productTypeService: types, businessService: {} }));

import CategoryTreePage from './CategoryTreePage';

const ALL_KEYS = ['make', 'model', 'body_type'];

const node = (code: string, over: Partial<CategoryNode> = {}): CategoryNode => ({
  id: `id-${code}`,
  code,
  name: { en: code[0].toUpperCase() + code.slice(1) },
  parent_id: null,
  visible_field_keys: [],
  sort_order: 1,
  icon: 'category',
  color: '',
  status: 'active',
  resolved_visible_field_keys: ALL_KEYS,
  children: [],
  ...over,
});

const FLAT: CategoryList = {
  mode: 'flat',
  categories: [
    node('shirts', { created_at: '2026-09-01' }),
    node('jeans', { sort_order: 2, created_at: '2026-09-03', status: 'hidden', description: { en: 'Denim' } }),
    node('anoraks', { sort_order: 3, created_at: '2026-09-02' }),
  ],
};

/* cars › suv › compact, and accessories with its own visible fields. */
const TREE: CategoryList = {
  mode: 'tree',
  categories: [
    node('cars', {
      children: [
        node('suv', {
          parent_id: 'id-cars',
          children: [node('compact', { parent_id: 'id-suv' })],
        }),
      ],
    }),
    node('accessories', {
      sort_order: 2,
      visible_field_keys: ['make'],
      resolved_visible_field_keys: ['make'],
    }),
  ],
};

const TYPE = {
  id: 't1',
  name: { en: 'Car Dealership' },
  fulfilment: 'goods',
  tracking: 'serial',
  fields: [
    { key: 'make', label: { en: 'Make' }, deprecated: false },
    { key: 'model', label: { en: 'Model' }, deprecated: false },
    { key: 'body_type', label: { en: 'Body type' }, deprecated: false },
    { key: 'old', label: { en: 'Old field' }, deprecated: true },
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <CategoryTreePage />
    </MemoryRouter>
  );

const apiError = (message: string, status: number, fieldErrors?: Record<string, string>) =>
  Object.assign(new Error(fieldErrors ? Object.entries(fieldErrors).map(([k, v]) => `${k}: ${v}`).join(', ') : message), {
    status,
    fieldErrors,
  });

/** Row codes in the order the table shows them. */
const rowCodes = () =>
  screen
    .getAllByTestId(/^cat-/)
    .map((r) => r.getAttribute('data-testid')!.replace(/^cat-/, ''));

/** Opens a row's "more" menu and clicks one of its actions. */
const menuAction = async (name: string, action: string) => {
  await userEvent.click(await screen.findByRole('button', { name: `More actions for ${name}` }));
  await userEvent.click(screen.getByRole('menuitem', { name: action }));
};

const openFilter = async (choice: string) => {
  await userEvent.click(screen.getByRole('button', { name: 'Filter and sort' }));
  await userEvent.click(screen.getByRole('button', { name: choice }));
};

beforeEach(() => {
  role.current = 'Admin';
  labels.current = { ...DEFAULT_LABELS };
  Object.values(api).forEach((f) => f.mockReset());
  types.get.mockReset();
  types.get.mockResolvedValue(TYPE);
  api.list.mockResolvedValue(FLAT);
  api.exportCsv.mockResolvedValue(undefined);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

/* ================================================================ layout */

describe('CategoryTreePage — layout like the Categories page (2b.4a)', () => {
  it('takes its title and buttons from the renamable label', async () => {
    labels.current = {
      categories: { plural: 'Car Types', singular: 'Car Type' },
      allProducts: { plural: 'My Cars', singular: 'My Car' },
    };
    renderPage();
    expect(await screen.findByRole('heading', { level: 1, name: 'Car Types' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Car Type' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to My Cars' })).toBeInTheDocument();
    expect(screen.getByText('Total Car Types')).toBeInTheDocument();
    expect(screen.queryByText('Category Tree')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Add Car Type' }));
    const dialog = screen.getByRole('dialog', { name: 'Add New Car Type' });
    expect(within(dialog).getByRole('button', { name: 'Save Car Type' })).toBeInTheDocument();
  });

  it('shows the four KPI cards — Total now, the product-based three as "—"', async () => {
    renderPage();
    await screen.findByTestId('cat-shirts');
    const kpis = screen.getByTestId('category-kpis');
    expect(kpis).toHaveTextContent('Total Categories');
    expect(kpis).toHaveTextContent('2 active · 1 hidden');
    for (const title of ['Assigned SKUs', 'Top Distribution', 'Inventory Density']) {
      expect(within(kpis).getByText(title)).toBeInTheDocument();
    }
    expect(within(kpis).getByText('3')).toBeInTheDocument();
    expect(within(kpis).getAllByText('—')).toHaveLength(3);
    expect(within(kpis).getAllByText('available once products use the new categories')).toHaveLength(3);
  });

  it('shows the table columns, with products as "—" until Phase 3', async () => {
    renderPage();
    const row = await screen.findByTestId('cat-jeans');
    expect(screen.getByRole('columnheader', { name: /Name$/ })).toBeInTheDocument(); // with the select-all box
    for (const h of ['Description', 'All Products', 'Status', 'Actions']) {
      expect(screen.getByRole('columnheader', { name: h })).toBeInTheDocument();
    }
    expect(row).toHaveTextContent('Denim');
    expect(row).toHaveTextContent('Hidden');
    expect(within(screen.getByTestId('cat-shirts')).getByText('Active')).toBeInTheDocument();
    expect(within(row).getByTitle('available once products use the new categories')).toHaveTextContent('—');
  });

  it('shows loading rows first, then the categories', async () => {
    let resolve!: (v: CategoryList) => void;
    api.list.mockReturnValue(new Promise((r) => (resolve = r)));
    renderPage();
    expect(screen.getAllByTestId('category-loading-row')).toHaveLength(4);
    resolve(FLAT);
    expect(await screen.findByTestId('cat-shirts')).toBeInTheDocument();
    expect(screen.queryByTestId('category-loading-row')).not.toBeInTheDocument();
  });

  it('exports the CSV with the current search, filter and "Show deleted"', async () => {
    let finish!: () => void;
    renderPage();
    await screen.findByTestId('cat-shirts');
    await userEvent.type(screen.getByLabelText('Search categories'), 'jea');
    await openFilter('Hidden');
    await userEvent.click(screen.getByLabelText('Show deleted'));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(true));
    await screen.findByTestId('cat-jeans');

    api.exportCsv.mockReturnValue(new Promise<void>((r) => (finish = r)));
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    expect(screen.getByRole('button', { name: 'Exporting...' })).toBeDisabled();
    expect(api.exportCsv).toHaveBeenCalledWith({ search: 'jea', status: 'hidden', include_deleted: true });
    finish();
    expect(await screen.findByText('Categories exported successfully.')).toBeInTheDocument();
  });

  it('reports a failed export', async () => {
    api.exportCsv.mockRejectedValue(new Error('Export download failed with status 403'));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Export CSV' }));
    expect(await screen.findByText('Export failed: Export download failed with status 403')).toBeInTheDocument();
  });
});

/* ============================================================== toolbar */

describe('CategoryTreePage — search, filter, sort, show deleted', () => {
  it('searches by name or code after a short pause', async () => {
    renderPage();
    await screen.findByTestId('cat-shirts');
    await userEvent.type(screen.getByLabelText('Search categories'), 'JEA');
    await waitFor(() => expect(rowCodes()).toEqual(['jeans']));
    await userEvent.clear(screen.getByLabelText('Search categories'));
    await userEvent.type(screen.getByLabelText('Search categories'), 'nothing-like-it');
    expect(await screen.findByText(/No categories matched "nothing-like-it"/)).toBeInTheDocument();
  });

  it('filters by status', async () => {
    renderPage();
    await screen.findByTestId('cat-shirts');
    await openFilter('Hidden');
    expect(rowCodes()).toEqual(['jeans']);
    await openFilter('Active');
    expect(rowCodes()).toEqual(['shirts', 'anoraks']);
    await openFilter('All Categories');
    expect(rowCodes()).toEqual(['shirts', 'jeans', 'anoraks']);
  });

  it('sorts by sort order, name or newest; reordering only in sort order', async () => {
    renderPage();
    await screen.findByTestId('cat-shirts');
    expect(rowCodes()).toEqual(['shirts', 'jeans', 'anoraks']);
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Jeans' }));
    expect(screen.getByRole('menuitem', { name: 'Move Jeans up' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Jeans' }));

    await openFilter('Name (A to Z)');
    expect(rowCodes()).toEqual(['anoraks', 'jeans', 'shirts']);
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Jeans' }));
    expect(screen.queryByRole('menuitem', { name: 'Move Jeans up' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Jeans' }));

    await openFilter('Newest first');
    expect(rowCodes()).toEqual(['jeans', 'anoraks', 'shirts']);
  });

  it('closes a row menu with Escape', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'More actions for Shirts' }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('reorders with up / down by sending the full list of siblings', async () => {
    api.reorder.mockResolvedValue(FLAT);
    renderPage();
    await menuAction('Jeans', 'Move Jeans up');
    await waitFor(() => expect(api.reorder).toHaveBeenCalledWith(null, ['id-jeans', 'id-shirts', 'id-anoraks']));
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Shirts' }));
    expect(screen.getByRole('menuitem', { name: 'Move Shirts up' })).toBeDisabled();
  });

  it('shows deleted categories on request, with Restore', async () => {
    api.list.mockImplementation(async (withDeleted: boolean) =>
      withDeleted ? { mode: 'flat', categories: [...FLAT.categories, node('jeans', { id: 'old-jeans', is_deleted: true })] } : FLAT
    );
    api.restore.mockRejectedValue(apiError('Another live category now uses the code "jeans"', 409));
    renderPage();
    await screen.findByTestId('cat-shirts');
    expect(screen.queryByTestId('cat-jeans-deleted')).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Show deleted'));
    const deleted = await screen.findByTestId('cat-jeans-deleted');
    expect(deleted).toHaveTextContent('Deleted');
    expect(within(deleted).getByLabelText('Select Jeans')).toBeDisabled(); // deleted rows can't be selected
    expect(api.list).toHaveBeenLastCalledWith(true);
    await userEvent.click(within(deleted).getByRole('button', { name: 'Restore Jeans' }));
    expect(api.restore).toHaveBeenCalledWith('old-jeans');
    expect(await screen.findByText('Cannot restore: Another live category now uses the code "jeans"')).toBeInTheDocument();
  });
});

/* ================================================================= bulk */

describe('CategoryTreePage — bulk actions', () => {
  it('selects all rows and changes their status, one call each', async () => {
    api.update.mockResolvedValue({});
    renderPage();
    await screen.findByTestId('cat-shirts');
    await userEvent.click(screen.getByLabelText('Select all'));
    expect(screen.getByText('3 categories selected')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Set Hidden' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledTimes(3));
    expect(api.update).toHaveBeenCalledWith('id-shirts', { status: 'hidden' });
    expect(await screen.findByText('Hid 3 categories.')).toBeInTheDocument();
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
  });

  it('bulk-deletes deepest first and reports the refused rows by name', async () => {
    api.list.mockResolvedValue(TREE);
    api.remove.mockImplementation(async (id: string) => {
      if (id === 'id-accessories') throw apiError('2 product(s) are in this category — move them first', 409);
    });
    renderPage();
    await screen.findByTestId('cat-compact');
    for (const name of ['Cars', 'Suv', 'Compact', 'Accessories']) await userEvent.click(screen.getByLabelText(`Select ${name}`));
    await userEvent.click(screen.getByRole('button', { name: 'Delete Selected' }));

    await waitFor(() => expect(api.remove).toHaveBeenCalledTimes(4));
    const order = api.remove.mock.calls.map((c) => c[0]);
    expect(order.indexOf('id-compact')).toBeLessThan(order.indexOf('id-suv'));
    expect(order.indexOf('id-suv')).toBeLessThan(order.indexOf('id-cars'));
    expect(
      await screen.findByText('Deleted 3 of 4. Not changed — Accessories: 2 product(s) are in this category — move them first')
    ).toBeInTheDocument();
    expect(screen.getByText('1 category selected')).toBeInTheDocument(); // the refused one stays selected
  });

  it('keeps bulk delete for Admins', async () => {
    role.current = 'Editor';
    renderPage();
    await userEvent.click(await screen.findByLabelText('Select Shirts'));
    expect(screen.getByRole('button', { name: 'Set Active' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Selected' })).not.toBeInTheDocument();
  });
});

/* ================================================================ modal */

describe('CategoryTreePage — add / edit in the modal', () => {
  it('lists every category at the top level with no parent controls (flat)', async () => {
    renderPage();
    expect(await screen.findByTestId('cat-shirts')).toBeInTheDocument();
    expect(screen.getByTestId('category-summary')).toHaveTextContent('Flat list');
    expect(screen.getByText(/Use category tree/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Shirts' }));
    expect(screen.queryByRole('menuitem', { name: /Add sub-category/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /to another parent/ })).not.toBeInTheDocument();
  });

  it('creates a category without a parent and with the code lowercased', async () => {
    api.create.mockResolvedValue({});
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add Category' }));
    const dialog = screen.getByRole('dialog', { name: 'Add New Category' });
    expect(within(dialog).queryByLabelText('Parent')).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText('Code'), 'Kurtas');
    await userEvent.type(within(dialog).getByLabelText('Name (English)'), 'Kurtas');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Category' }));

    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith({
        code: 'kurtas',
        name: { en: 'Kurtas' },
        visible_field_keys: [],
        icon: 'category',
        color: '',
        status: 'active',
      })
    );
    expect(await screen.findByText('Category “Kurtas” created successfully.')).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledTimes(2); // reloaded from the server
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('holds back an invalid code and needs an English name', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add Category' }));
    const dialog = screen.getByRole('dialog');
    const save = within(dialog).getByRole('button', { name: 'Save Category' });
    await userEvent.type(within(dialog).getByLabelText('Code'), 'Cars & Bikes');
    await userEvent.type(within(dialog).getByLabelText('Name (English)'), 'Cars');
    expect(save).toBeDisabled();
    await userEvent.clear(within(dialog).getByLabelText('Code'));
    await userEvent.type(within(dialog).getByLabelText('Code'), 'cars');
    expect(save).toBeEnabled();
    await userEvent.clear(within(dialog).getByLabelText('Name (English)'));
    expect(save).toBeDisabled();
  });

  it('keeps the modal open and shows the server refusal as sent', async () => {
    api.create.mockRejectedValue(apiError('A category with the code "shirts" already exists', 409));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add Category' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Code'), 'shirts');
    await userEvent.type(within(dialog).getByLabelText('Name (English)'), 'Shirts');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Category' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('A category with the code "shirts" already exists');
  });

  it('shows a 422 field message without the field prefix', async () => {
    api.create.mockRejectedValue(apiError('Validation', 422, { visible_field_keys: 'Unknown or retired attribute(s): wings' }));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add Category' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Code'), 'wings');
    await userEvent.type(within(dialog).getByLabelText('Name (English)'), 'Wings');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Category' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/^Unknown or retired attribute\(s\): wings$/);
  });

  it('edits in the same modal, without the code field', async () => {
    api.update.mockResolvedValue({});
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Jeans' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Category' });
    expect(within(dialog).queryByLabelText('Code')).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText('Description')).toHaveValue('Denim');
    await userEvent.selectOptions(within(dialog).getByLabelText('Status'), 'active');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update Category' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('id-jeans', expect.objectContaining({ status: 'active' })));
    expect(await screen.findByText('Category “Jeans” updated successfully.')).toBeInTheDocument();
  });
});

/* ============================================================ tree mode */

describe('CategoryTreePage — tree mode', () => {
  beforeEach(() => api.list.mockResolvedValue(TREE));

  it('indents sub-categories and collapses / expands them', async () => {
    renderPage();
    expect(await screen.findByTestId('cat-compact')).toHaveAttribute('aria-level', '3');
    expect(screen.getByTestId('cat-cars')).toHaveAttribute('aria-level', '1');
    expect(screen.getByTestId('category-summary')).toHaveTextContent('Tree');
    expect(screen.queryByText(/are a flat list/)).not.toBeInTheDocument();
    expect(rowCodes()).toEqual(['cars', 'suv', 'compact', 'accessories']);

    await userEvent.click(screen.getByRole('button', { name: 'Collapse Cars' }));
    expect(screen.queryByTestId('cat-suv')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Expand Cars' }));
    expect(screen.getByTestId('cat-suv')).toBeInTheDocument();
  });

  it('shows which fields a category inherits or sets, and no fulfilment / tracking', async () => {
    renderPage();
    expect(await screen.findByTestId('cat-suv')).toHaveTextContent('all fields');
    expect(screen.getByTestId('cat-accessories')).toHaveTextContent('1 fields');
    expect(screen.getByTestId('cat-suv')).not.toHaveTextContent(/Goods|Serial|inherited\)/);
  });

  it('keeps Visible fields under a collapsed Advanced section (R12)', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Cars' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Category' });
    const advanced = within(dialog).getByRole('button', { name: 'Advanced' });
    expect(advanced).toHaveAttribute('aria-expanded', 'false');
    expect(within(dialog).queryByLabelText('Only these fields')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Fulfilment')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Tracking')).not.toBeInTheDocument();

    await userEvent.click(advanced);
    expect(advanced).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByLabelText('Only these fields')).toBeInTheDocument();
    await userEvent.click(advanced);
    expect(advanced).toHaveAttribute('aria-expanded', 'false');
    expect(within(dialog).queryByLabelText('Only these fields')).not.toBeInTheDocument();
  });

  it('shows "Advanced · N fields" when the category has its own fields', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Accessories' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Category' });
    const advanced = within(dialog).getByRole('button', { name: 'Advanced · 1 field' });
    expect(advanced).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(advanced);
    expect(within(dialog).getByLabelText('Show Make')).toBeChecked();
    expect(within(dialog).getByLabelText('Show Model')).not.toBeChecked();
    await userEvent.click(within(dialog).getByLabelText('Show Model'));
    expect(within(dialog).getByRole('button', { name: 'Advanced · 2 fields' })).toBeInTheDocument();
  });

  it('saving without opening Advanced keeps the existing visible fields', async () => {
    api.update.mockResolvedValue({});
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Accessories' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Category' });
    await userEvent.clear(within(dialog).getByLabelText('Name (English)'));
    await userEvent.type(within(dialog).getByLabelText('Name (English)'), 'Car accessories');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update Category' }));

    await waitFor(() => expect(api.update).toHaveBeenCalled());
    const [id, patch] = api.update.mock.calls[0];
    expect(id).toBe('id-accessories');
    expect(patch.name).toEqual({ en: 'Car accessories' });
    expect(patch).not.toHaveProperty('visible_field_keys');
    expect(patch).not.toHaveProperty('fulfilment');
    expect(patch).not.toHaveProperty('tracking');
  });

  it('adds a sub-category under its parent, inheriting the parent’s fields', async () => {
    api.create.mockResolvedValue({});
    renderPage();
    await menuAction('Accessories', 'Add sub-category to Accessories');
    const dialog = screen.getByRole('dialog', { name: 'Add New Category' });
    expect(within(dialog).getByLabelText('Parent')).toHaveValue('id-accessories');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Advanced' }));
    expect(within(dialog).getByTestId('inherited-fields')).toHaveTextContent(/^Make$/);

    await userEvent.type(within(dialog).getByLabelText('Code'), 'mats');
    await userEvent.type(within(dialog).getByLabelText('Name (English)'), 'Mats');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save Category' }));
    await waitFor(() =>
      expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ code: 'mats', parent_id: 'id-accessories', visible_field_keys: [] }))
    );
  });

  it('offers only the live attributes when limiting the visible fields', async () => {
    api.update.mockResolvedValue({});
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Cars' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit Category' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Advanced' }));
    await userEvent.click(within(dialog).getByLabelText('Only these fields'));
    expect(within(dialog).queryByLabelText('Show Old field')).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByLabelText('Show Model'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Update Category' }));

    await waitFor(() =>
      expect(api.update).toHaveBeenCalledWith('id-cars', expect.objectContaining({ visible_field_keys: ['make', 'body_type'] }))
    );
    expect(api.update.mock.calls[0][1]).not.toHaveProperty('code');
    expect(api.update.mock.calls[0][1]).not.toHaveProperty('parent_id');
  });

  it('"Move to…" leaves out the category itself and its sub-categories', async () => {
    api.update.mockResolvedValue({});
    renderPage();
    await menuAction('Cars', 'Move Cars to another parent');
    const dialog = screen.getByRole('dialog', { name: 'Move Cars' });
    const options = within(dialog).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Top level', 'Accessories']);

    await userEvent.selectOptions(within(dialog).getByLabelText('New parent'), 'id-accessories');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move' }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith('id-cars', { parent_id: 'id-accessories' }));
  });

  it('shows the parent path in the picker', async () => {
    renderPage();
    await menuAction('Accessories', 'Move Accessories to another parent');
    const options = within(screen.getByRole('dialog')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Top level', 'Cars', 'Cars › Suv', 'Cars › Suv › Compact']);
  });

  it('keeps the path to each search match, dimmed and not selectable', async () => {
    renderPage();
    await screen.findByTestId('cat-cars');
    await userEvent.type(screen.getByLabelText('Search categories'), 'compact');
    await waitFor(() => expect(rowCodes()).toEqual(['cars', 'suv', 'compact']));
    expect(screen.getByTestId('cat-cars')).toHaveClass('opacity-60');
    expect(screen.getByLabelText('Select Cars')).toBeDisabled();
    expect(screen.getByLabelText('Select Compact')).toBeEnabled();
    await userEvent.click(screen.getByLabelText('Select all'));
    expect(screen.getByText('1 category selected')).toBeInTheDocument();
  });

  it('flags a category whose parent is gone and does not offer reordering it', async () => {
    api.list.mockResolvedValue({ mode: 'tree', categories: [node('cars'), node('lost', { parent_id: 'id-gone', orphan: true })] });
    renderPage();
    expect(await screen.findByTestId('cat-lost')).toHaveTextContent('Parent missing');
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Lost' }));
    expect(screen.queryByRole('menuitem', { name: 'Move Lost up' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Move Lost to another parent' })).toBeInTheDocument();
  });
});

/* ===================================================== delete and roles */

describe('CategoryTreePage — delete and roles', () => {
  it('deletes after the confirmation modal, and shows a refusal verbatim', async () => {
    api.list.mockResolvedValue(TREE);
    api.remove.mockRejectedValueOnce(apiError('Has live sub-categories (Suv) — move or delete them first', 409));
    renderPage();
    await menuAction('Cars', 'Delete Cars');
    const confirm = screen.getByRole('dialog', { name: 'Delete Cars' });
    expect(confirm).toHaveTextContent('It can be restored from Show deleted.');
    await userEvent.click(within(confirm).getByRole('button', { name: 'Delete Category' }));
    expect(await screen.findByText('Cannot delete: Has live sub-categories (Suv) — move or delete them first')).toBeInTheDocument();

    api.remove.mockResolvedValueOnce(undefined);
    await menuAction('Accessories', 'Delete Accessories');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete Category' }));
    await waitFor(() => expect(api.remove).toHaveBeenLastCalledWith('id-accessories'));
    expect(await screen.findByText(/“Accessories” deleted — it can be restored/)).toBeInTheDocument();
  });

  it('does nothing when the delete is cancelled', async () => {
    renderPage();
    await menuAction('Shirts', 'Delete Shirts');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(api.remove).not.toHaveBeenCalled();
  });

  it('lets an Editor change categories but not delete them', async () => {
    role.current = 'Editor';
    api.list.mockResolvedValue(TREE);
    renderPage();
    expect(await screen.findByRole('button', { name: 'Edit Cars' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Category' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Cars' }));
    expect(screen.queryByRole('menuitem', { name: /^Delete/ })).not.toBeInTheDocument();
  });

  it('is read-only for a Viewer: no Add, edit, delete, bulk or export controls', async () => {
    role.current = 'Viewer';
    api.list.mockResolvedValue(TREE);
    renderPage();
    await screen.findByTestId('cat-cars');
    expect(screen.getByText(/Read-only/)).toBeInTheDocument();
    for (const name of [/^Add/, /^Edit/, /^More actions/, /^Restore/, 'Export CSV']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText('Select all')).not.toBeInTheDocument();
    /* Search and filters still work for reading. */
    expect(screen.getByLabelText('Search categories')).toBeInTheDocument();
  });

  it('shows an empty state and a retry on a failed load', async () => {
    api.list.mockResolvedValueOnce({ mode: 'flat', categories: [] });
    const { unmount } = renderPage();
    expect(await screen.findByText('No categories found')).toBeInTheDocument();
    expect(screen.getByText(/Get started by creating your first category/)).toBeInTheDocument();
    unmount();

    api.list.mockRejectedValueOnce(new Error('Server unavailable'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
    api.list.mockResolvedValueOnce(FLAT);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('cat-shirts')).toBeInTheDocument();
  });
});
