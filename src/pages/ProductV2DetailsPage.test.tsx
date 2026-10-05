import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const role = { current: 'Admin' };
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { role: role.current } }) }));
vi.mock('../context/SiteSettingsContext', () => ({
  useLabels: () => ({
    plural: (k: string) => (k === 'categories' ? 'Categories' : 'All Products'),
    singular: (k: string) => (k === 'categories' ? 'Category' : 'Product'),
    lower: (k: string) => (k === 'categories' ? 'categories' : 'All Products'),
    lowerSingular: (k: string) => (k === 'categories' ? 'category' : 'product'),
  }),
}));

const api = vi.hoisted(() => ({ get: vi.fn(), publish: vi.fn(), archive: vi.fn(), remove: vi.fn() }));
vi.mock('../services/productV2.service', () => ({ productV2Service: api }));
const cats = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../services/catalogCategory.service', () => ({ catalogCategoryService: cats }));
const types = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../services/productType.service', () => ({ productTypeService: types, businessService: {} }));

import ProductV2DetailsPage from './ProductV2DetailsPage';

const enumField = (key: string, label: string, values: string[]) => ({
  key,
  label: { en: label },
  type: 'enum',
  options: values.map((v) => ({ value: v.toLowerCase(), label: { en: v }, deprecated: false })),
  deprecated: false,
});
const TYPE = {
  fields: [
    { key: 'make', label: { en: 'Make' }, type: 'text', options: [], deprecated: false },
    enumField('fuel', 'Fuel', ['Petrol', 'Diesel']),
    { key: 'warranty', label: { en: 'Warranty' }, type: 'number', unit: 'months', options: [], deprecated: true },
  ],
};

const item = (sku: string, over: Record<string, unknown> = {}) => ({
  id: `i-${sku}`,
  sku,
  attributes: [{ key: 'fuel', value: 'petrol' }],
  track_inventory: null,
  price: { amount_minor: 154999950, currency: 'INR', tax_inclusive: true, price_unit: 'each' },
  resolved_price: { amount_minor: 154999950, currency: 'INR', tax_inclusive: true, price_unit: 'each' },
  compare_at_minor: 160000000,
  status: 'active',
  effective: { track_inventory: true, tracking: 'serial', gst_rate: 28, hsn_code: '8703', media: [] },
  availability: { status: 'tracked', on_hand: 2, reserved: 0, available: 2 },
  ...over,
});

const PRODUCT = {
  id: 'p1',
  slug: 'hyundai-creta',
  name: { en: 'Hyundai Creta', ta: 'க்ரேட்டா' },
  brand: 'Hyundai',
  category_ids: ['c-suv', 'c-sedan'],
  primary_category_id: 'c-suv',
  attributes: [{ key: 'make', value: 'Hyundai' }, { key: 'warranty', value: 24 }],
  variant_axes: [{ key: 'fuel', values: ['petrol', 'diesel'] }],
  track_inventory: true,
  tracking: 'serial',
  fulfilment: 'goods',
  hsn_code: '8703',
  sac_code: null,
  gst_rate: 28,
  media: [{ url: '/uploads/creta.png', kind: 'image' }],
  option_media: [{ attribute_key: 'fuel', value: 'diesel', media: [{ url: '/uploads/diesel.png', kind: 'image' }] }],
  currency: 'INR',
  status: 'draft',
  type_version: 4,
  created_at: '2026-09-30T10:00:00Z',
  created_by: 'admin-1',
  updated_at: '2026-09-30T11:00:00Z',
  updated_by: 'editor-1',
  effective: { fulfilment: 'goods', track_inventory: true, tracking: 'serial' },
  items: [item('CRETA-P'), item('CRETA-D', { attributes: [{ key: 'fuel', value: 'diesel' }], track_inventory: false, effective: { track_inventory: false, tracking: 'none', gst_rate: 28, hsn_code: null, media: [] }, availability: { status: 'not_tracked' } })],
  availability: { status: 'tracked', available: 2 },
};

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/v2/products/p1']}>
      <Routes>
        <Route path="/v2/products/:id" element={<ProductV2DetailsPage />} />
        <Route path="/v2/products" element={<p>list page</p>} />
        <Route path="/v2/products/:id/edit" element={<p>edit page</p>} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  role.current = 'Admin';
  localStorage.clear();
  Object.values(api).forEach((f) => f.mockReset());
  api.get.mockResolvedValue(PRODUCT);
  types.get.mockResolvedValue(TYPE);
  cats.list.mockResolvedValue({ mode: 'flat', categories: [{ id: 'c-suv', name: { en: 'SUV' }, children: [] }, { id: 'c-sedan', name: { en: 'Sedan' }, children: [] }] });
});

describe('ProductV2DetailsPage', () => {
  it('summarises Fulfilment, Track inventory, Tracking, price and availability', async () => {
    renderPage();
    const settings = await screen.findByTestId('product-settings');
    expect(settings).toHaveTextContent('₹15,49,999.50');
    expect(settings).toHaveTextContent('incl. GST');
    expect(settings).toHaveTextContent('Goods');
    expect(settings).toHaveTextContent('Tracking: Serial numbers');
    expect(settings).toHaveTextContent('2 in stock');
    expect(settings).toHaveTextContent('HSN 8703 · GST 28%');
    expect(screen.getByTestId('product-status')).toHaveTextContent('Draft');
  });

  it('shows the attributes with labels, the categories with the primary one, and retired values read-only', async () => {
    renderPage();
    const attrs = await screen.findByTestId('product-attributes');
    expect(attrs).toHaveTextContent('SUV (primary), Sedan');
    expect(attrs).toHaveTextContent('MakeHyundai');
    expect(attrs).toHaveTextContent('Retired · read-only');
    expect(attrs).toHaveTextContent('24 months');
    expect(attrs).toHaveTextContent('Petrol, Diesel');
    expect(screen.getByTestId('product-audit')).toHaveTextContent('by editor-1');
  });

  it('shows the items as cards by default: picture, values, price and availability or "Not tracked"', async () => {
    renderPage();
    const grid = await screen.findByTestId('items-grid');
    const petrol = within(grid).getByTestId('item-CRETA-P');
    expect(petrol).toHaveTextContent('Petrol');
    expect(petrol).toHaveTextContent('₹15,49,999.50');
    expect(petrol).toHaveTextContent('2 in stock');
    /* No photos of its own: the product's, faded, and said so. */
    expect(petrol).toHaveTextContent('uses product photos');
    const diesel = within(grid).getByTestId('item-CRETA-D');
    expect(diesel).toHaveTextContent('Not tracked');
    expect(diesel).toHaveTextContent('uses Diesel photos');
  });

  it('switches to a table (remembered) with MRP and tax', async () => {
    renderPage();
    await screen.findByTestId('items-grid');
    await userEvent.click(screen.getByRole('button', { name: 'Table view' }));
    const table = screen.getByRole('table', { name: 'Items' });
    const petrol = within(table).getByTestId('item-CRETA-P');
    expect(petrol).toHaveTextContent('₹16,00,000'); // MRP
    expect(petrol).toHaveTextContent('GST 28% · HSN 8703');
    expect(localStorage.getItem('v2_details_items_view')).toBe('table');
  });

  it('opens a variant in a popup with its pictures and details; Previous / Next; Edit', async () => {
    api.get.mockResolvedValue({
      ...PRODUCT,
      items: [
        item('CRETA-P', { media: [{ url: '/uploads/p1.png', kind: 'image' }, { url: '/uploads/p2.png', kind: 'image' }], limits_summary: 'Max 1 per order', purchase_limits: { max_per_order: 1 } }),
        PRODUCT.items[1],
      ],
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Open Petrol' }));
    const dialog = screen.getByRole('dialog', { name: 'Petrol' });
    expect(within(dialog).getByText('1 of 2')).toBeInTheDocument();
    const details = within(dialog).getByTestId('item-view-details');
    expect(details).toHaveTextContent('CRETA-P');
    expect(details).toHaveTextContent('₹16,00,000');
    expect(details).toHaveTextContent('On · Serial numbers');
    expect(details).toHaveTextContent('Max 1 per order');
    expect(details).toHaveTextContent('This item has its own limits');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Show image 2' }));
    expect(within(dialog).getByRole('img', { name: 'Petrol' })).toHaveAttribute('src', expect.stringContaining('/uploads/p2.png'));

    await userEvent.click(within(dialog).getByRole('button', { name: 'Next variant' }));
    const next = screen.getByRole('dialog', { name: 'Diesel' });
    expect(within(next).getByText('2 of 2')).toBeInTheDocument();
    expect(next).toHaveTextContent('No photos of its own — uses Diesel photos');
    expect(within(next).getByRole('button', { name: 'Next variant' })).toBeDisabled();
    await userEvent.click(within(next).getByRole('button', { name: 'Edit' }));
    expect(await screen.findByText('edit page')).toBeInTheDocument();
  });

  it("shows sizes, the price per unit and each item's limits (Phase 3b)", async () => {
    api.get.mockResolvedValue({
      ...PRODUCT,
      variant_axes: [{ key: 'net_quantity', values: [{ amount: 500, unit: 'ml' }, { amount: 1, unit: 'l' }] }],
      purchase_limits: { min_per_order: null, max_per_order: 2, per_customer: { day: null, week: null, month: 4, year: null, lifetime: null } },
      items: [
        item('OIL-500', {
          attributes: [{ key: 'net_quantity', value: 500 }],
          measure: { amount: 500, unit: 'ml', base_amount: 500 },
          price_per_unit: { amount_minor: 3600, currency: 'INR', tax_inclusive: true, per: '100 ml' },
          limits_summary: 'Max 2 per order · 4 per customer every 30 days',
        }),
      ],
    });
    renderPage();
    const attrs = await screen.findByTestId('product-attributes');
    expect(attrs).toHaveTextContent('500 ml, 1 l');
    expect(screen.getByTestId('product-limits')).toHaveTextContent('Max 2 per order · 4 per customer every 30 days');
    await userEvent.click(screen.getByRole('button', { name: 'Table view' }));
    expect(screen.getByTestId('item-OIL-500')).toHaveTextContent('500 ml');
    expect(screen.getByTestId('per-unit-OIL-500')).toHaveTextContent('₹36 / 100 ml');
    expect(screen.getByTestId('limits-OIL-500')).toHaveTextContent('Max 2 per order');
  });

  it("shows the common media only: product and per-option (a variant's own photos are in its popup)", async () => {
    api.get.mockResolvedValue({ ...PRODUCT, items: [item('CRETA-P', { media: [{ url: '/uploads/own.png', kind: 'image' }] }), PRODUCT.items[1]] });
    renderPage();
    const media = await screen.findByTestId('product-media');
    expect(media.querySelectorAll('img')).toHaveLength(2);
    expect(media).toHaveTextContent('Fuel = Diesel');
    expect(media.innerHTML).not.toContain('own.png');
  });

  it('publishes, or lists the reasons the server gives', async () => {
    api.publish.mockRejectedValueOnce(
      Object.assign(new Error('Cannot publish yet'), { status: 422, fieldErrors: { 'attributes.model': 'Model is required', gst_rate: 'A GST rate is required' } })
    );
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Publish' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Model is required');
    expect(alert).toHaveTextContent('A GST rate is required');

    api.publish.mockResolvedValueOnce({ ...PRODUCT, status: 'active' });
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(screen.getByTestId('product-status')).toHaveTextContent('Active'));
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
  });

  it('deletes after confirmation and returns to the list', async () => {
    api.remove.mockResolvedValue(undefined);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Hyundai Creta' });
    expect(dialog).toHaveTextContent('its 2 items');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete Product' }));
    expect(await screen.findByText('list page')).toBeInTheDocument();
  });

  it('has no write controls for a Viewer', async () => {
    role.current = 'Viewer';
    renderPage();
    await screen.findByTestId('product-settings');
    for (const name of ['Edit', 'Publish', 'Archive', 'Delete']) expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  });

  it('shows the error and a retry when the product cannot be loaded', async () => {
    api.get.mockRejectedValueOnce(new Error('Product not found'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Product not found');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByTestId('product-settings')).toBeInTheDocument();
  });
});
