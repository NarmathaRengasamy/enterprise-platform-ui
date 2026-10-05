import { API_V2_BASE_URL, client } from './client';
import type {
  BundleComponents,
  ItemStock,
  ItemUnit,
  ItemUnits,
  StockAdjustInput,
  StockMovementPage,
  UnitInput,
  UnitStatus,
} from '../types/stock.types';

/**
 * Phase 4 — stock, serial / batch units and bundle components of the new
 * product items, at /api/v2/items/… and /api/v2/units/…. Reading stock is open
 * to every signed-in role; changing it (and units, bundles, history) is for
 * Admins and Editors.
 */

const v2 = { base: API_V2_BASE_URL };
const item = (id: string) => `/items/${encodeURIComponent(id)}`;

const need = <T>(value: T | undefined, what: string): T => {
  if (value === undefined) throw new Error(`The server did not return the ${what}`);
  return value;
};

export const stockService = {
  async get(itemId: string): Promise<ItemStock> {
    return need((await client.get<ItemStock>(`${item(itemId)}/stock`, v2)).data, 'stock');
  },

  /** 409 when not allowed (not tracked, a pack, a bundle, serial-tracked) or when it would go below 0. */
  async adjust(itemId: string, input: StockAdjustInput): Promise<ItemStock> {
    return need((await client.post<ItemStock>(`${item(itemId)}/stock/adjust`, input, v2)).data, 'stock');
  },

  async setReorderPoint(itemId: string, reorder_point: number, location_id?: string): Promise<ItemStock> {
    return need(
      (await client.patch<ItemStock>(`${item(itemId)}/stock/reorder-point`, { reorder_point, ...(location_id ? { location_id } : {}) }, v2)).data,
      'stock'
    );
  },

  async movements(itemId: string, page = 1, limit = 20): Promise<StockMovementPage> {
    return need((await client.get<StockMovementPage>(`${item(itemId)}/stock/movements?page=${page}&limit=${limit}`, v2)).data, 'stock history');
  },
};

export const unitService = {
  async list(itemId: string, opts: { search?: string; status?: UnitStatus } = {}): Promise<ItemUnits> {
    const q = new URLSearchParams();
    if (opts.search?.trim()) q.set('search', opts.search.trim());
    if (opts.status) q.set('status', opts.status);
    const qs = q.toString();
    return need((await client.get<ItemUnits>(`${item(itemId)}/units${qs ? `?${qs}` : ''}`, v2)).data, 'units');
  },

  /** One unit, or many (e.g. pasted lines) — all or nothing. Serial: stock +1 each. */
  async add(itemId: string, units: UnitInput[]): Promise<ItemUnits> {
    return need((await client.post<ItemUnits>(`${item(itemId)}/units`, { units }, v2)).data, 'units');
  },

  /** Next status only (in_stock → sold → returned → in_stock), batch label or location. */
  async update(unitId: string, patch: { status?: UnitStatus; batch_no?: string | null; location_id?: string }): Promise<ItemUnit> {
    return need((await client.patch<ItemUnit>(`/units/${encodeURIComponent(unitId)}`, patch, v2)).data, 'unit');
  },

  async remove(unitId: string): Promise<void> {
    await client.delete(`/units/${encodeURIComponent(unitId)}`, v2);
  },
};

export const bundleService = {
  async get(bundleItemId: string): Promise<BundleComponents> {
    return need((await client.get<BundleComponents>(`${item(bundleItemId)}/bundle-components`, v2)).data, 'bundle');
  },

  /** Replaces the whole list (an empty list clears it). */
  async replace(bundleItemId: string, components: { component_item_id: string; quantity: number }[]): Promise<BundleComponents> {
    return need((await client.put<BundleComponents>(`${item(bundleItemId)}/bundle-components`, { components }, v2)).data, 'bundle');
  },
};
