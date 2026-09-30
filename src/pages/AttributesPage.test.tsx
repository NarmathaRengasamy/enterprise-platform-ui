import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ProductType } from '../types/productType.types';

const role = { current: 'Admin' };
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { role: role.current } }) }));

const api = vi.hoisted(() => ({
  get: vi.fn(),
  addField: vi.fn(),
  updateField: vi.fn(),
  deleteField: vi.fn(),
  reorder: vi.fn(),
  upgrade: vi.fn(),
}));
vi.mock('../services/productType.service', () => ({ productTypeService: api, businessService: {} }));

import AttributesPage from './AttributesPage';

const field = (over: Partial<ProductType['fields'][number]>) => ({
  label: { en: 'Fuel' },
  key: 'fuel',
  type: 'enum' as const,
  options: [
    { value: 'petrol', label: { en: 'Petrol' }, deprecated: false },
    { value: 'diesel', label: { en: 'Diesel' }, deprecated: false },
  ],
  variant_forming: true,
  filterable: true,
  required: true,
  sort_order: 1,
  source: 'template' as const,
  deprecated: false,
  added_in_version: 1,
  ...over,
});

const TYPE: ProductType = {
  id: 't1',
  code: 'car_dealership',
  name: { en: 'Car Dealership' },
  template_code: 'car_dealership',
  template_version: 1,
  type_version: 1,
  fulfilment: 'goods',
  tracking: 'serial',
  template_update_available: false,
  fields: [
    field({}),
    field({ key: 'warranty_months', label: { en: 'Warranty' }, type: 'number', unit: 'months', options: [], variant_forming: false, required: false, source: 'custom', sort_order: 2 }),
  ],
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <AttributesPage />
    </MemoryRouter>
  );

beforeEach(() => {
  role.current = 'Admin';
  Object.values(api).forEach((f) => f.mockReset());
  api.get.mockResolvedValue(TYPE);
});

describe('AttributesPage', () => {
  it('shows an empty state that points to Settings before a category is chosen', async () => {
    api.get.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByTestId('attributes-empty')).toHaveTextContent(/No business category yet/);
    expect(screen.getByRole('button', { name: 'Go to Settings' })).toBeInTheDocument();
  });

  it('lists the attributes with Template / Custom badges and the type version', async () => {
    renderPage();
    const fuel = await screen.findByTestId('attr-fuel');
    expect(within(fuel).getByText('Template')).toBeInTheDocument();
    expect(within(fuel).getByText('Petrol, Diesel')).toBeInTheDocument();
    expect(within(screen.getByTestId('attr-warranty_months')).getByText('Custom')).toBeInTheDocument();
    expect(screen.getByText(/2 attributes · version 1/)).toBeInTheDocument();
  });

  it('is read-only for a non-Admin', async () => {
    role.current = 'Viewer';
    renderPage();
    await screen.findByTestId('attr-fuel');
    expect(screen.queryByRole('button', { name: 'Add attribute' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit Fuel/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Read-only/)).toBeInTheDocument();
  });

  it('adds a number attribute with a unit', async () => {
    api.addField.mockResolvedValue({
      data: { ...TYPE, type_version: 2, fields: [...TYPE.fields, field({ key: 'seats_extra', label: { en: 'Extra seats' }, type: 'number', options: [], source: 'custom', sort_order: 3 })] },
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add attribute' }));
    const dialog = screen.getByRole('dialog', { name: 'Add attribute' });
    await userEvent.type(within(dialog).getByLabelText('Name (English)'), 'Extra seats');
    await userEvent.selectOptions(within(dialog).getByLabelText('Type'), 'number');
    await userEvent.type(within(dialog).getByLabelText('Unit'), 'seats');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add attribute' }));

    await waitFor(() =>
      expect(api.addField).toHaveBeenCalledWith(
        expect.objectContaining({ label: { en: 'Extra seats' }, type: 'number', unit: 'seats' })
      )
    );
    expect(await screen.findByTestId('attr-seats_extra')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers "Can be used for variants" only for choice lists, ticked by default (Phase 1b)', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add attribute' }));
    const dialog = screen.getByRole('dialog');
    const box = () => within(dialog).getByLabelText('Can be used for variants');
    expect(box()).toBeDisabled(); // default type: text
    expect(box()).not.toBeChecked();
    await userEvent.selectOptions(within(dialog).getByLabelText('Type'), 'enum');
    expect(box()).toBeEnabled();
    expect(box()).toBeChecked();
    await userEvent.selectOptions(within(dialog).getByLabelText('Type'), 'number');
    expect(box()).not.toBeChecked();
  });

  it('locks the type of a template attribute when editing', async () => {
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Fuel' }));
    expect(within(screen.getByRole('dialog')).getByLabelText('Type')).toBeDisabled();
  });

  it('adds options to a template enum without removing existing ones', async () => {
    api.updateField.mockResolvedValue({ data: TYPE });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Fuel' }));
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('New options'), 'Hydrogen');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.updateField).toHaveBeenCalled());
    const [, patch] = api.updateField.mock.calls[0];
    expect(patch.options.map((o: any) => o.label.en)).toEqual(['Petrol', 'Diesel', 'Hydrogen']);
    expect(patch.type).toBeUndefined(); // never sent for a template attribute
  });

  it('retires an attribute', async () => {
    api.updateField.mockResolvedValue({ data: { ...TYPE, fields: [field({ deprecated: true }), TYPE.fields[1]] } });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Retire Fuel' }));
    expect(api.updateField).toHaveBeenCalledWith('fuel', { deprecated: true });
    expect(await screen.findByRole('button', { name: 'Restore Fuel' })).toBeInTheDocument();
  });

  it('offers Delete only on custom attributes', async () => {
    renderPage();
    await screen.findByTestId('attr-fuel');
    expect(screen.queryByRole('button', { name: 'Delete Fuel' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Warranty' })).toBeInTheDocument();
  });

  it('shows the server refusal verbatim', async () => {
    api.updateField.mockRejectedValue(new Error('Options can only be added or retired, not removed ("Petrol")'));
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Retire Fuel' }));
    expect(await screen.findByText(/only be added or retired/)).toBeInTheDocument();
  });

  it('reorders with the arrow buttons', async () => {
    api.reorder.mockResolvedValue(TYPE);
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Move Fuel down' }));
    expect(api.reorder).toHaveBeenCalledWith(['warranty_months', 'fuel']);
  });

  it('offers the template update when one is available', async () => {
    api.get.mockResolvedValue({ ...TYPE, template_update_available: true });
    api.upgrade.mockResolvedValue({ data: TYPE, notice: 'Template updated — 1 addition(s)' });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Update template' }));
    expect(api.upgrade).toHaveBeenCalled();
  });
});
