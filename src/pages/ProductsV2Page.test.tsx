import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const role = { current: 'Admin' };
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { role: role.current } }) }));
vi.mock('../context/SiteSettingsContext', () => ({
  useLabels: () => {
    const L: Record<string, { plural: string; singular: string }> = {
      allProducts: { plural: 'All Products', singular: 'Product' },
      categories: { plural: 'Categories', singular: 'Category' },
    };
    return {
      plural: (k: string) => L[k].plural,
      singular: (k: string) => L[k].singular,
      lower: (k: string) => (k === 'categories' ? 'categories' : L[k].plural),
      lowerSingular: (k: string) => L[k].singular.toLowerCase(),
    };
  },
}));

const api = vi.hoisted(() => ({ search: vi.fn(), remove: vi.fn(), restore: vi.fn() }));
vi.mock('../services/productV2.service', () => ({ productV2Service: api }));
const cats = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../services/catalogCategory.service', () => ({ catalogCategoryService: cats }));
const types = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../services/productType.service', () => ({ productTypeService: types, businessService: {} }));

import ProductsV2Page from './ProductsV2Page';

const summary = (slug: string, over: Record<string, unknown> = {}) => ({
  id: `id-${slug}`,
  slug,
  name: { en: slug[0].toUpperCase() + slug.slice(1) },
  brand: 'Hyundai',
  category_ids: ['c-suv'],
  primary_category_id: 'c-suv',
  media: [],
  status: 'active',
  currency: 'INR',
  item_count: 3,
  active_item_count: 3,
  from_price: { amount_minor: 154999950, currency: 'INR', tax_inclusive: true, price_unit: 'each' },
  availability: { status: 'tracked', available: 12 },
  ...over,
});

const RESULT = {
  items: [
    summary('creta'),
    summary('service', { brand: '', item_count: 1, from_price: null, availability: { status: 'not_tracked' }, status: 'draft', category_ids: [], primary_category_id: null }),
  ],
  total: 2,
  page: 1,
  limit: 20,
  pages: 1,
  sort: 'newest',
  facets: { colour: [{ value: 'red', count: 1 }, { value: 'white', count: 1 }] },
};

const TYPE = {
  fields: [{ key: 'colour', label: { en: 'Colour' }, type: 'enum', options: [{ value: 'red', label: { en: 'Red' }, deprecated: false }, { value: 'white', label: { en: 'White' }, deprecated: false }] }],
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/v2/products']}>
      <Routes>
        <Route path="/v2/products" element={<ProductsV2Page />} />
        <Route path="/v2/products/add" element={<p>add page</p>} />
        <Route path="/v2/products/:id" element={<p>details page</p>} />
      </Routes>
    </MemoryRouter>
  );

const lastSearch = () => api.search.mock.calls[api.search.mock.calls.length - 1][0];

beforeEach(() => {
  role.current = 'Admin';
  Object.values(api).forEach((f) => f.mockReset());
  api.search.mockResolvedValue(RESULT);
  cats.list.mockResolvedValue({ mode: 'tree', categories: [{ id: 'c-cars', name: { en: 'Cars' }, children: [{ id: 'c-suv', name: { en: 'SUV' }, children: [] }] }] });
  types.get.mockResolvedValue(TYPE);
});

describe('ProductsV2Page', () => {
  it('lists products with ₹ prices from paise, "incl. GST", "Not priced" and availability', async () => {
    renderPage();
    const creta = await screen.findByTestId('product-creta');
    expect(creta).toHaveTextContent('₹15,49,999.50');
    expect(creta).toHaveTextContent('from');
    expect(creta).toHaveTextContent('incl. GST');
    expect(creta).toHaveTextContent('12 in stock');
    expect(creta).toHaveTextContent('SUV');
    const service = screen.getByTestId('product-service');
    expect(service).toHaveTextContent('Not priced');
    expect(service).toHaveTextContent('Not tracked');
    expect(service).toHaveTextContent('Draft');
    expect(screen.getByRole('heading', { level: 1, name: 'All Products' })).toBeInTheDocument();
  });

  it('asks the server for page 1 of 20, newest first, by default', async () => {
    renderPage();
    await screen.findByTestId('product-creta');
    expect(lastSearch()).toEqual({ status: 'all', page: 1, limit: 20 });
  });

  it('sends search, category (by id, tree indented), status, brand and a ₹ price range as paise', async () => {
    renderPage();
    await screen.findByTestId('product-creta');
    await userEvent.type(screen.getByLabelText('Search All Products'), 'creta');
    await waitFor(() => expect(lastSearch()).toMatchObject({ search: 'creta' }));
    expect(within(screen.getByLabelText('Category')).getAllByRole('option').map((o) => o.textContent)).toEqual(['All categories', 'Cars', '— SUV']);
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'c-suv');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'active');
    await userEvent.type(screen.getByLabelText('Brand'), 'Hyundai');
    await userEvent.type(screen.getByLabelText('Lowest price (₹)'), '1000');
    await userEvent.type(screen.getByLabelText('Highest price (₹)'), '1549999.50');
    await waitFor(() =>
      expect(lastSearch()).toMatchObject({
        search: 'creta',
        category_id: 'c-suv',
        status: 'active',
        brand: 'Hyundai',
        price_min_minor: 100000,
        price_max_minor: 154999950,
      })
    );
  });

  it('holds back an unusable price range', async () => {
    renderPage();
    await screen.findByTestId('product-creta');
    const calls = api.search.mock.calls.length;
    await userEvent.type(screen.getByLabelText('Lowest price (₹)'), 'abc');
    expect(await screen.findByText(/Enter prices in ₹/)).toBeInTheDocument();
    expect(api.search.mock.calls.length).toBe(calls);
  });

  it('filters by attribute from the facets and sorts', async () => {
    renderPage();
    await screen.findByTestId('product-creta');
    const facets = screen.getByTestId('facets');
    expect(facets).toHaveTextContent('Colour');
    await userEvent.click(within(facets).getByRole('button', { name: /Red/ }));
    await waitFor(() => expect(lastSearch()).toMatchObject({ attributes: { colour: ['red'] } }));
    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'price_asc');
    await waitFor(() => expect(lastSearch()).toMatchObject({ sort: 'price_asc', attributes: { colour: ['red'] } }));
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(lastSearch()).toEqual({ status: 'all', page: 1, limit: 20 }));
  });

  it('pages through the results with a page size', async () => {
    api.search.mockResolvedValue({ ...RESULT, total: 45, pages: 3 });
    renderPage();
    await screen.findByTestId('product-creta');
    await userEvent.selectOptions(screen.getByLabelText('Per page'), '50');
    await waitFor(() => expect(lastSearch()).toMatchObject({ limit: 50, page: 1 }));
  });

  it('deletes after confirmation and restores from Show deleted', async () => {
    api.remove.mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Creta' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Creta' });
    expect(dialog).toHaveTextContent('3 items');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete Product' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('id-creta'));
    expect(await screen.findByText(/deleted — it can be restored/)).toBeInTheDocument();

    api.search.mockResolvedValue({ ...RESULT, items: [summary('creta', { is_deleted: true })], total: 1 });
    api.restore.mockRejectedValue(Object.assign(new Error('Another live item now uses the SKU "X"'), { status: 409 }));
    await userEvent.click(screen.getByLabelText('Show deleted'));
    await waitFor(() => expect(lastSearch()).toMatchObject({ include_deleted: true }));
    await userEvent.click(await screen.findByRole('button', { name: 'Restore Creta' }));
    expect(await screen.findByText('Cannot restore: Another live item now uses the SKU "X"')).toBeInTheDocument();
  });

  it('is read-only for a Viewer, who sees active products only', async () => {
    role.current = 'Viewer';
    renderPage();
    await screen.findByTestId('product-creta');
    expect(lastSearch()).not.toHaveProperty('status');
    expect(screen.queryByLabelText('Status')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Show deleted')).not.toBeInTheDocument();
    for (const name of [/^Add/, /^Edit/, /^Delete/, /^Restore/]) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'View Creta' }));
    expect(await screen.findByText('details page')).toBeInTheDocument();
  });

  it('shows an empty state and a retry on a failed load', async () => {
    api.search.mockResolvedValueOnce({ ...RESULT, items: [], total: 0, facets: {} });
    const { unmount } = renderPage();
    expect(await screen.findByText('No All Products found')).toBeInTheDocument();
    unmount();
    api.search.mockRejectedValueOnce(new Error('Server unavailable'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('product-creta')).toBeInTheDocument();
  });
});
