import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const business = vi.hoisted(() => ({ templates: vi.fn(), get: vi.fn(), save: vi.fn() }));
const types = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('../../services/productType.service', () => ({ businessService: business, productTypeService: types }));

import { BusinessSettingsTab } from './BusinessSettingsTab';

const TEMPLATES = [
  { code: 'ecommerce', version: 1, name: { en: 'E-commerce (general retail)' }, default_fulfilment: 'goods', default_tracking: 'none', field_count: 10, fields: [{ key: 'size', label: { en: 'Size' }, type: 'enum', variant_forming: true }], starter_category_count: 5 },
  { code: 'car_dealership', version: 1, name: { en: 'Car Dealership' }, default_fulfilment: 'goods', default_tracking: 'serial', field_count: 15, fields: [{ key: 'fuel', label: { en: 'Fuel' }, type: 'enum', variant_forming: true }], starter_category_count: 3 },
  { code: 'general', version: 1, name: { en: 'General' }, default_fulfilment: 'goods', default_tracking: 'none', field_count: 5, fields: [], starter_category_count: 0 },
];
const EMPTY = { business_category: null, active_product_type_id: null, timezone: 'Asia/Kolkata', default_currency: 'INR', languages: ['en'] };

const renderTab = (isAdmin = true, onMessage = vi.fn()) =>
  render(
    <MemoryRouter>
      <BusinessSettingsTab isAdmin={isAdmin} onMessage={onMessage} />
    </MemoryRouter>
  );

beforeEach(() => {
  [business.templates, business.get, business.save, types.get].forEach((f) => f.mockReset());
  business.templates.mockResolvedValue(TEMPLATES);
  business.get.mockResolvedValue(EMPTY);
  types.get.mockResolvedValue(null);
});

describe('BusinessSettingsTab', () => {
  it('lists the three business categories with their field counts', async () => {
    renderTab();
    expect(await screen.findByRole('radio', { name: /Car Dealership/ })).toHaveTextContent('15 fields');
    expect(screen.getAllByRole('radio')).toHaveLength(3);
  });

  it('saves a first choice and reports the loaded fields', async () => {
    business.save.mockResolvedValue({
      data: {
        settings: { ...EMPTY, business_category: 'car_dealership' },
        product_type: { fields: new Array(15).fill({}) },
        outcome: 'created',
      },
    });
    const onMessage = vi.fn();
    renderTab(true, onMessage);
    await userEvent.click(await screen.findByRole('radio', { name: /Car Dealership/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save business settings' }));

    await waitFor(() =>
      expect(business.save).toHaveBeenCalledWith({
        business_category: 'car_dealership',
        timezone: 'Asia/Kolkata',
        default_currency: 'INR',
        languages: ['en'],
        create_starter_categories: true,
      })
    );
    expect(await screen.findByRole('status')).toHaveTextContent('15 attributes loaded');
    expect(onMessage).toHaveBeenCalledWith(expect.stringMatching(/15 attributes/), 'success');
  });

  it('asks for confirmation before changing an existing category', async () => {
    business.get.mockResolvedValue({ ...EMPTY, business_category: 'ecommerce' });
    business.save.mockResolvedValue({
      data: { settings: { ...EMPTY, business_category: 'car_dealership' }, product_type: { fields: [] }, outcome: 'replaced' },
    });
    renderTab();
    await userEvent.click(await screen.findByRole('radio', { name: /Car Dealership/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save business settings' }));
    expect(business.save).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/nothing is removed/);
    await userEvent.click(screen.getByRole('button', { name: 'Yes, change it' }));
    await waitFor(() => expect(business.save).toHaveBeenCalledTimes(1));
  });

  it('keeps English switched on and lets other languages be added', async () => {
    renderTab();
    const english = await screen.findByRole('checkbox', { name: 'English' });
    expect(english).toBeChecked();
    expect(english).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tamil' }));
    expect(screen.getByRole('checkbox', { name: 'Tamil' })).toBeChecked();
  });

  it('explains why Save is unavailable', async () => {
    renderTab();
    expect(await screen.findByText('Choose a business category')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save business settings' })).toBeDisabled();
  });

  it('is read-only for a non-Admin', async () => {
    renderTab(false);
    expect(await screen.findByRole('radio', { name: /Car Dealership/ })).toBeDisabled();
    expect(screen.getByText('Only an Admin can change these')).toBeInTheDocument();
  });

  it('shows the server error when saving fails', async () => {
    business.save.mockRejectedValue(new Error('Unknown business category'));
    const onMessage = vi.fn();
    renderTab(true, onMessage);
    await userEvent.click(await screen.findByRole('radio', { name: /General/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save business settings' }));
    await waitFor(() => expect(onMessage).toHaveBeenCalledWith('Unknown business category', 'error'));
  });

  it('shows a retry when loading fails', async () => {
    business.get.mockRejectedValue(new Error('Server unavailable'));
    renderTab();
    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
