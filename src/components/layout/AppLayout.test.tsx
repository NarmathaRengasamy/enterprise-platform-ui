import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { role: 'Admin', name: 'A', email: 'a@x' }, logout: vi.fn() }) }));
vi.mock('../../hooks/useSystemHealth', () => ({ useSystemHealth: () => ({ status: 'ok' }) }));
vi.mock('../call/CallPanel', () => ({ default: () => null }));

/* The workspace renamed "Categories" to "Car Types". */
const LABELS: Record<string, { plural: string; singular: string }> = {
  categories: { plural: 'Car Types', singular: 'Car Type' },
  allProducts: { plural: 'My Cars', singular: 'My Car' },
};
vi.mock('../../context/SiteSettingsContext', () => ({
  useSiteSettings: () => ({ settings: { siteName: 'Test', labels: {} } }),
  useLabels: () => {
    const get = (k: string) => LABELS[k] ?? { plural: k[0].toUpperCase() + k.slice(1), singular: k };
    return {
      get,
      plural: (k: string) => get(k).plural,
      singular: (k: string) => get(k).singular,
      lower: (k: string) => get(k).plural.toLowerCase(),
      lowerSingular: (k: string) => get(k).singular.toLowerCase(),
    };
  },
}));

import AppLayout from './AppLayout';

describe('AppLayout — the new products entry (Phase 3)', () => {
  it('reads "{All Products} (new)" from the label and is the active entry on /v2/products/…/edit', () => {
    render(
      <MemoryRouter initialEntries={['/v2/products/p1/edit']}>
        <AppLayout>
          <div />
        </AppLayout>
      </MemoryRouter>
    );
    const entry = screen.getByRole('button', { name: 'My Cars (new)' });
    expect(entry.className).toMatch(/bg-primary-container/);
    expect(screen.getByRole('button', { name: 'My Cars' }).className).not.toMatch(/bg-primary-container/); // the old list, unchanged
  });
});

describe('AppLayout — the new categories entry (2b.4a)', () => {
  it('reads "{Categories} (new)" from the renamable label, beside the old entry', () => {
    render(
      <MemoryRouter initialEntries={['/category-tree']}>
        <AppLayout>
          <div />
        </AppLayout>
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: 'Car Types (new)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Car Types' })).toBeInTheDocument(); // the old screen, unchanged
    expect(screen.queryByText('Category Tree')).not.toBeInTheDocument();
  });
});
