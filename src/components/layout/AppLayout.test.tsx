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
