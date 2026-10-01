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
vi.mock('../components/common/MediaUploader', () => ({ MediaUploader: ({ label }: { label: string }) => <div>uploader: {label}</div> }));

const api = vi.hoisted(() => ({
  get: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  publish: vi.fn(),
  variantPreview: vi.fn(),
  addItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  restoreItem: vi.fn(),
}));
vi.mock('../services/productV2.service', () => ({ productV2Service: api }));
const types = vi.hoisted(() => ({ get: vi.fn(), addOptions: vi.fn(), addField: vi.fn() }));
const business = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../services/productType.service', () => ({ productTypeService: types, businessService: business }));
const cats = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock('../services/catalogCategory.service', () => ({ catalogCategoryService: cats }));

import AddEditProductV2Page, { parseRupees, rupeesText } from './AddEditProductV2Page';

const opt = (v: string) => ({ value: v.toLowerCase(), label: { en: v }, deprecated: false });
const field = (over: Record<string, unknown>) => ({
  label: { en: 'X' },
  type: 'text',
  options: [],
  variant_forming: false,
  filterable: false,
  required: false,
  sort_order: 1,
  source: 'custom',
  deprecated: false,
  added_in_version: 1,
  ...over,
});
const TYPE = {
  id: 't1',
  fulfilment: 'goods',
  tracking: 'serial',
  fields: [
    field({ key: 'make', label: { en: 'Make' }, source: 'template', required: true }),
    field({ key: 'model', label: { en: 'Model' }, source: 'template', required: true }),
    field({ key: 'body_type', label: { en: 'Body type' }, type: 'enum', source: 'template', options: [opt('SUV'), opt('Sedan')] }),
    field({ key: 'fuel', label: { en: 'Fuel' }, type: 'enum', variant_forming: true, options: [opt('Petrol'), opt('Diesel')] }),
    field({ key: 'colour', label: { en: 'Colour' }, type: 'enum', variant_forming: true, options: [opt('Red'), opt('White')] }),
    field({ key: 'warranty', label: { en: 'Warranty' }, type: 'number', unit: 'months', group: 'cover' }),
    field({ key: 'old', label: { en: 'Old code' }, deprecated: true }),
  ],
};
const ALL = TYPE.fields.filter((f) => !f.deprecated).map((f) => f.key);
const CATEGORIES = {
  mode: 'flat',
  categories: [
    { id: 'c-suv', name: { en: 'SUV' }, resolved_visible_field_keys: ALL, children: [] },
    { id: 'c-acc', name: { en: 'Accessories' }, resolved_visible_field_keys: ['make', 'model', 'colour'], children: [] },
  ],
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/v2/products/add" element={<AddEditProductV2Page />} />
        <Route path="/v2/products/:id/edit" element={path.endsWith('/edit') ? <AddEditProductV2Page /> : <p>edit page</p>} />
        <Route path="/v2/products/:id" element={<p>details page</p>} />
      </Routes>
    </MemoryRouter>
  );
/* One page, two columns: every section is always on screen, so "going" to one is a no-op. */
const go = async (_section: string) => undefined;

beforeEach(() => {
  role.current = 'Admin';
  [...Object.values(api), ...Object.values(types), business.get, cats.list].forEach((f) => f.mockReset());
  types.get.mockResolvedValue(TYPE);
  business.get.mockResolvedValue({ default_currency: 'INR' });
  cats.list.mockResolvedValue(CATEGORIES);
  api.create.mockResolvedValue({ id: 'p-new' });
  api.publish.mockResolvedValue({ id: 'p-new', status: 'active' });
  sessionStorage.clear();
});

describe('money helpers', () => {
  it('turns typed rupees into paise and back, refusing more than 2 decimals', () => {
    expect(parseRupees('15,49,999.50')).toEqual({ minor: 154999950 });
    expect(parseRupees('₹ 0')).toEqual({ minor: 0 });
    expect(parseRupees('')).toEqual({ minor: null });
    expect(parseRupees('12.345')).toHaveProperty('error');
    expect(parseRupees('-100')).toHaveProperty('error');
    expect(rupeesText(154999950)).toBe('1549999.50');
    expect(rupeesText(100000)).toBe('1000');
    expect(rupeesText(null)).toBe('');
  });
});

describe('AddEditProductV2Page — one page, two columns (UI trial)', () => {
  it('shows every section as a card, with images, the summary and the buttons in the sidebar', async () => {
    renderAt('/v2/products/add');
    await screen.findByLabelText('Name (English)');
    for (const name of ['Basics', 'Categories', 'More attributes', 'Tax', 'Fulfilment · Track inventory · Tracking', 'Variants', 'Items', 'Description']) {
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    }
    /* The template's basic fields get a card named after their group. */
    expect(within(screen.getByRole('region', { name: 'Basics' })).getByLabelText('Make')).toBeInTheDocument();
    /* No steps, no index, no Back / Next. */
    expect(screen.queryByRole('navigation', { name: 'Sections' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
    const side = screen.getByTestId('save-panel');
    expect(side.className).toMatch(/sticky/);
    expect(within(side).getByRole('region', { name: 'Product images' })).toHaveTextContent('uploader: Product images');
    for (const name of ['Cancel', 'Save draft', 'Publish']) expect(within(side).getByRole('button', { name })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Name (English)'), 'Creta');
    expect(within(side).getByTestId('review')).toHaveTextContent('Creta · Goods · Track inventory on (Serial numbers)');
  });

  it('puts grouped basic fields in their own card, titled by the group', async () => {
    types.get.mockResolvedValue({ ...TYPE, fields: TYPE.fields.map((f) => (f.source === 'template' ? { ...f, group: 'vehicle' } : f)) });
    renderAt('/v2/products/add');
    const vehicle = await screen.findByRole('region', { name: 'Vehicle' });
    expect(within(vehicle).getByLabelText('Make')).toBeInTheDocument();
    expect(within(vehicle).getByLabelText('Body type')).toBeInTheDocument();
  });
});

describe('AddEditProductV2Page — new product', () => {
  it('pre-fills Fulfilment / Track inventory / Tracking from the product type (Car = goods · on · serial)', async () => {
    renderAt('/v2/products/add');
    expect(await screen.findByLabelText('Fulfilment')).toHaveValue('goods');
    expect(screen.getByRole('switch', { name: 'Track inventory' })).toBeChecked();
    expect(screen.getByLabelText('Tracking')).toHaveValue('serial');

    /* Service switches Track inventory off on a new product (it can be switched back on). */
    await userEvent.selectOptions(screen.getByLabelText('Fulfilment'), 'service');
    expect(screen.getByRole('switch', { name: 'Track inventory' })).not.toBeChecked();
    expect(screen.queryByLabelText('Tracking')).not.toBeInTheDocument();
    await go('Tax');
    expect(screen.getByLabelText('SAC code')).toBeInTheDocument();
  });

  it('remembers the last Fulfilment / Tracking chosen this session (K6a)', async () => {
    sessionStorage.setItem('v2_product_last_settings', JSON.stringify({ fulfilment: 'rental', tracking: 'batch' }));
    renderAt('/v2/products/add');
    expect(await screen.findByLabelText('Fulfilment')).toHaveValue('rental');
    expect(screen.getByRole('switch', { name: 'Track inventory' })).not.toBeChecked();
    await userEvent.click(screen.getByRole('switch', { name: 'Track inventory' }));
    expect(screen.getByLabelText('Tracking')).toHaveValue('batch');
  });

  it('saves a draft with ₹ turned into paise, the basic fields and initial stock', async () => {
    renderAt('/v2/products/add');
    await userEvent.type(await screen.findByLabelText('Name (English)'), 'Hyundai Creta');
    expect(screen.getByLabelText('Slug')).toHaveValue('hyundai-creta');
    await userEvent.type(screen.getByLabelText('Make'), 'Hyundai');
    await userEvent.type(screen.getByLabelText('Model'), 'Creta');
    await go('Tax');
    await userEvent.type(screen.getByLabelText('HSN code'), '8703');
    await userEvent.selectOptions(screen.getByLabelText('GST rate'), '40');
    await go('Items');
    await userEvent.type(screen.getByLabelText('Price item'), '1549999.50');
    await userEvent.type(screen.getByLabelText('Initial stock item'), '3');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(api.create).toHaveBeenCalled());
    const body = api.create.mock.calls[0][0];
    expect(body).toMatchObject({
      name: { en: 'Hyundai Creta' },
      attributes: [{ key: 'make', value: 'Hyundai' }, { key: 'model', value: 'Creta' }],
      fulfilment: 'goods',
      track_inventory: true,
      tracking: 'serial',
      hsn_code: '8703',
      sac_code: null,
      gst_rate: 40,
      variant_axes: [],
    });
    expect(body).not.toHaveProperty('slug'); // auto: the server makes it (and suffixes a clash)
    expect(body.items).toEqual([
      expect.objectContaining({ price: { amount_minor: 154999950, currency: 'INR', tax_inclusive: true, price_unit: 'each' }, initial_stock: 3, track_inventory: null }),
    ]);
    expect(api.publish).not.toHaveBeenCalled();
    expect(await screen.findByText('details page')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('v2_product_last_settings')!)).toEqual({ fulfilment: 'goods', tracking: 'serial' });
  });

  it('holds back a price with more than 2 decimals and lists why', async () => {
    renderAt('/v2/products/add');
    await userEvent.type(await screen.findByLabelText('Name (English)'), 'X');
    await go('Items');
    await userEvent.type(screen.getByLabelText('Price item'), '12.345');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByTestId('problems')).toHaveTextContent('at most 2 decimals');
    expect(api.create).not.toHaveBeenCalled();
  });

  it('several categories: the first is primary, changeable, and the form shows the union of their fields', async () => {
    renderAt('/v2/products/add');
    await screen.findByLabelText('Name (English)');
    await go('Categories');
    await userEvent.click(screen.getByLabelText('Category Accessories'));
    expect(screen.getByTestId('visible-fields')).toHaveTextContent('Fields shown: Make, Model, Colour');
    await go('Basics');
    expect(screen.getByText(/Body type is not shown for the chosen categories/)).toBeInTheDocument();
    await go('Categories');
    await userEvent.click(screen.getByLabelText('Category SUV'));
    expect(screen.getByTestId('visible-fields')).toHaveTextContent('Body type');
    await userEvent.click(screen.getByRole('button', { name: 'Make SUV primary' }));
    await go('Basics');
    await userEvent.type(screen.getByLabelText('Name (English)'), 'Mats');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(api.create.mock.calls[0][0]).toMatchObject({ category_ids: ['c-acc', 'c-suv'], primary_category_id: 'c-suv' });
  });

  it('picks more attributes from the library; only Admins get "Create new attribute"', async () => {
    types.addField.mockResolvedValue({ data: { ...TYPE, fields: [...TYPE.fields, field({ key: 'seats', label: { en: 'Seats' }, type: 'number' })] } });
    renderAt('/v2/products/add');
    await screen.findByLabelText('Name (English)');
    await go('More attributes');
    const picker = screen.getByTestId('attribute-picker');
    expect(picker).toHaveTextContent('cover');
    expect(picker).not.toHaveTextContent('Old code'); // retired
    expect(picker).not.toHaveTextContent('Make'); // basic fields are always on the form
    await userEvent.click(within(picker).getByRole('button', { name: /Warranty/ }));
    expect(screen.getByTestId('field-warranty')).toHaveTextContent('months');

    await userEvent.click(screen.getByRole('button', { name: 'Create new attribute' }));
    const dialog = screen.getByRole('dialog', { name: 'Create new attribute' });
    await userEvent.type(within(dialog).getByLabelText('Attribute name'), 'Seats');
    await userEvent.selectOptions(within(dialog).getByLabelText('Attribute type'), 'number');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save attribute' }));
    await waitFor(() => expect(types.addField).toHaveBeenCalledWith({ label: { en: 'Seats' }, type: 'number' }));
    expect(await screen.findByTestId('field-seats')).toBeInTheDocument();
  });

  it('an Editor cannot create attributes from the form', async () => {
    role.current = 'Editor';
    renderAt('/v2/products/add');
    await screen.findByLabelText('Name (English)');
    await go('More attributes');
    expect(screen.queryByRole('button', { name: 'Create new attribute' })).not.toBeInTheDocument();
  });

  it('builds variants: pick options, add a missing one (near-duplicate held back), preview, create the ticked ones', async () => {
    types.addOptions
      .mockResolvedValueOnce({ data: TYPE, added: [], existing: [], warnings: [{ value: 'rde', label: 'Rde', similar_to: 'Red' }] })
      .mockResolvedValueOnce({ data: { ...TYPE, fields: TYPE.fields.map((f) => (f.key === 'colour' ? { ...f, options: [...f.options, opt('Rde')] } : f)) }, added: ['rde'], existing: [], warnings: [] });
    api.variantPreview.mockResolvedValue({
      total: 4,
      new: 4,
      combinations: [
        { attributes: [{ key: 'fuel', value: 'petrol' }, { key: 'colour', value: 'red' }], attribute_signature: 'colour=red|fuel=petrol', suggested_sku: 'CRETA-PETROL-RED', exists: false },
        { attributes: [{ key: 'fuel', value: 'petrol' }, { key: 'colour', value: 'white' }], attribute_signature: 'colour=white|fuel=petrol', suggested_sku: 'CRETA-PETROL-WHITE', exists: false },
        { attributes: [{ key: 'fuel', value: 'diesel' }, { key: 'colour', value: 'red' }], attribute_signature: 'colour=red|fuel=diesel', suggested_sku: 'CRETA-DIESEL-RED', exists: false },
        { attributes: [{ key: 'fuel', value: 'diesel' }, { key: 'colour', value: 'white' }], attribute_signature: 'colour=white|fuel=diesel', suggested_sku: 'CRETA-DIESEL-WHITE', exists: false },
      ],
    });
    renderAt('/v2/products/add');
    await userEvent.type(await screen.findByLabelText('Name (English)'), 'Creta');
    await go('Variants');
    await userEvent.selectOptions(screen.getByLabelText('Add variant option'), 'fuel');
    await userEvent.selectOptions(screen.getByLabelText('Add variant option'), 'colour');
    for (const name of ['Fuel Petrol', 'Fuel Diesel', 'Colour Red', 'Colour White']) await userEvent.click(screen.getByLabelText(name));

    await userEvent.type(screen.getByLabelText('New Colour option'), 'Rde');
    await userEvent.click(within(screen.getByTestId('axis-colour')).getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('“Rde” looks like “Red”.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Add anyway' }));
    await waitFor(() => expect(types.addOptions).toHaveBeenLastCalledWith('colour', ['Rde'], true));
    expect(await screen.findByLabelText('Colour Rde')).toBeChecked();
    await userEvent.click(screen.getByLabelText('Colour Rde')); // not this time

    await userEvent.click(screen.getByRole('button', { name: 'Preview combinations' }));
    await waitFor(() =>
      expect(api.variantPreview).toHaveBeenCalledWith({
        variant_axes: [{ key: 'fuel', values: ['petrol', 'diesel'] }, { key: 'colour', values: ['red', 'white'] }],
        name: 'Creta',
        slug: 'creta',
      })
    );
    await userEvent.click(screen.getByLabelText('Combination diesel / white')); // not sold
    await userEvent.click(screen.getByRole('button', { name: 'Create selected' }));
    expect(screen.getByLabelText('SKU CRETA-PETROL-RED')).toBeInTheDocument();
    expect(screen.queryByLabelText('SKU CRETA-DIESEL-WHITE')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Price CRETA-PETROL-RED'), '1000');
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    const body = api.create.mock.calls[0][0];
    expect(body.variant_axes).toEqual([{ key: 'fuel', values: ['petrol', 'diesel'] }, { key: 'colour', values: ['red', 'white'] }]);
    expect(body.items).toHaveLength(3);
    expect(body.items[0]).toMatchObject({ sku: 'CRETA-PETROL-RED', attributes: [{ key: 'fuel', value: 'petrol' }, { key: 'colour', value: 'red' }], price: { amount_minor: 100000 } });
    expect(body.items[1].price).toBeNull(); // not priced
  });

  it('when publishing is refused, keeps the saved draft and opens it for editing with the reasons', async () => {
    api.publish.mockRejectedValue(Object.assign(new Error('Cannot publish yet'), { status: 422, fieldErrors: { hsn_code: 'An HSN code (goods) or SAC code (services) is required' } }));
    renderAt('/v2/products/add');
    await userEvent.type(await screen.findByLabelText('Name (English)'), 'X');
    await userEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(api.publish).toHaveBeenCalledWith('p-new'));
    expect(await screen.findByText('edit page')).toBeInTheDocument();
  });
});

describe('AddEditProductV2Page — editing', () => {
  const item = (id: string, sku: string, value: string, over: Record<string, unknown> = {}) => ({
    id,
    sku,
    attributes: [{ key: 'fuel', value }],
    track_inventory: null,
    price: { amount_minor: 150000000, currency: 'INR', tax_inclusive: true, price_unit: 'each' },
    compare_at_minor: null,
    gst_rate: null,
    hsn_code: null,
    media: [],
    status: 'active',
    availability: { status: 'tracked', on_hand: 2, reserved: 0, available: 2 },
    ...over,
  });
  const PRODUCT = {
    id: 'p1',
    slug: 'creta',
    name: { en: 'Creta' },
    brand: 'Hyundai',
    category_ids: ['c-suv'],
    primary_category_id: 'c-suv',
    attributes: [{ key: 'make', value: 'Hyundai' }, { key: 'old', value: 'OLD-1' }],
    variant_axes: [{ key: 'fuel', values: ['petrol', 'diesel'] }],
    track_inventory: true,
    tracking: 'serial',
    fulfilment: 'goods',
    hsn_code: '8703',
    sac_code: null,
    gst_rate: 28,
    media: [],
    option_media: [],
    effective: { fulfilment: 'goods', track_inventory: true, tracking: 'serial' },
    items: [item('i-p', 'CRETA-P', 'petrol'), item('i-d', 'CRETA-D', 'diesel')],
    deleted_items: [],
  };

  beforeEach(() => {
    api.get.mockResolvedValue(PRODUCT);
    api.update.mockResolvedValue(PRODUCT);
    api.updateItem.mockResolvedValue(PRODUCT);
    api.deleteItem.mockResolvedValue(PRODUCT);
  });

  it('changes items by id — only what changed, never stock — and removes a marked one', async () => {
    renderAt('/v2/products/p1/edit');
    await screen.findByDisplayValue('Creta');
    expect(api.get).toHaveBeenCalledWith('p1', true);
    await go('Items');
    expect(screen.queryByLabelText('Initial stock CRETA-P')).not.toBeInTheDocument(); // stock changes via adjustments
    expect(screen.getByTestId('row-CRETA-P')).toHaveTextContent('2 on hand');
    const sku = screen.getByLabelText('SKU CRETA-P');
    await userEvent.clear(sku);
    await userEvent.type(sku, 'CRETA-PETROL');
    await userEvent.click(screen.getByRole('button', { name: 'Delete CRETA-D' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));

    await waitFor(() => expect(api.deleteItem).toHaveBeenCalledWith('p1', 'i-d'));
    const [, patch] = api.update.mock.calls[0];
    expect(patch).not.toHaveProperty('items');
    expect(patch).toMatchObject({ slug: 'creta', variant_axes: PRODUCT.variant_axes });
    expect(patch.attributes).toContainEqual({ key: 'old', value: 'OLD-1' }); // the retired value is kept
    expect(api.updateItem).toHaveBeenCalledTimes(1);
    expect(api.updateItem).toHaveBeenCalledWith('p1', 'i-p', { sku: 'CRETA-PETROL' });
    expect(api.addItem).not.toHaveBeenCalled();
    expect(await screen.findByText('details page')).toBeInTheDocument();
  });

  it('shows retired values read-only and keeps the variant options fixed once items exist', async () => {
    renderAt('/v2/products/p1/edit');
    await screen.findByDisplayValue('Creta');
    await go('More attributes');
    expect(screen.getByTestId('retired-values')).toHaveTextContent('Old code: OLD-1');
    await go('Variants');
    expect(screen.queryByLabelText('Add variant option')).not.toBeInTheDocument();
    expect(screen.getByText(/variant options are fixed/)).toBeInTheDocument();
    expect(screen.getByLabelText('Fuel Petrol')).toBeDisabled(); // used by an item
  });

  it('an Editor cannot delete existing items', async () => {
    role.current = 'Editor';
    renderAt('/v2/products/p1/edit');
    await screen.findByDisplayValue('Creta');
    await go('Items');
    expect(screen.queryByRole('button', { name: /^Delete CRETA/ })).not.toBeInTheDocument();
  });

  it('shows the server refusal as sent', async () => {
    api.updateItem.mockRejectedValue(Object.assign(new Error('An item with the SKU "TAKEN" already exists'), { status: 409 }));
    renderAt('/v2/products/p1/edit');
    await screen.findByDisplayValue('Creta');
    await go('Items');
    await userEvent.clear(screen.getByLabelText('SKU CRETA-P'));
    await userEvent.type(screen.getByLabelText('SKU item'), 'TAKEN'); // an empty SKU labels the row "item"
    await userEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    expect(await screen.findByTestId('form-error')).toHaveTextContent('An item with the SKU "TAKEN" already exists');
  });

  it('is read-only for a Viewer', async () => {
    role.current = 'Viewer';
    renderAt('/v2/products/p1/edit');
    expect(await screen.findByRole('alert')).toHaveTextContent('Read-only');
  });
});
