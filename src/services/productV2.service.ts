import { API_V2_BASE_URL, client, getToken } from './client';
import {
  ItemInput,
  ItemPatch,
  ProductInput,
  ProductPatch,
  ProductSearchFilters,
  ProductSearchResult,
  ProductStats,
  ProductV2,
  AnyVariantAxis,
  VariantCombination,
} from '../types/productV2.types';

/**
 * The new products (Phase 3) at /api/v2/products, beside the old /api/v1/products
 * until the Phase 5 cut-over. Prices go in and come out as paise.
 */

const v2 = { base: API_V2_BASE_URL };
const at = (id: string) => `/products/${encodeURIComponent(id)}`;
const itemAt = (id: string, itemId: string) => `${at(id)}/items/${encodeURIComponent(itemId)}`;

const need = <T>(value: T | undefined, what: string): T => {
  if (value === undefined) throw new Error(`The server did not return the ${what}`);
  return value;
};

export const productV2Service = {
  async search(filters: ProductSearchFilters): Promise<ProductSearchResult> {
    return need((await client.post<ProductSearchResult>('/products/search', filters, v2)).data, 'products');
  },

  /**
   * What the list matches (its filters, every page) as a CSV, one row per
   * variant — downloaded as products-YYYY-MM-DD.csv. Admin / Editor.
   */
  async exportCsv(filters: Omit<ProductSearchFilters, 'page' | 'limit'>): Promise<void> {
    const token = getToken();
    const res = await fetch(`${API_V2_BASE_URL}/products/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(filters),
    });
    if (!res.ok) {
      let message = `Export failed (${res.status})`;
      try {
        message = (await res.json())?.message || message;
      } catch {
        /* not JSON */
      }
      throw new Error(message);
    }
    const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'products.csv';
    const url = window.URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  /** The products list KPIs (whole catalogue). */
  async stats(): Promise<ProductStats> {
    return need((await client.get<ProductStats>('/products/stats', v2)).data, 'figures');
  },

  async get(id: string, includeDeleted = false): Promise<ProductV2> {
    const q = includeDeleted ? '?include_deleted=true' : '';
    return need((await client.get<ProductV2>(`${at(id)}${q}`, v2)).data, 'product');
  },

  async create(input: ProductInput): Promise<ProductV2> {
    return need((await client.post<ProductV2>('/products', input, v2)).data, 'product');
  },

  async update(id: string, patch: ProductPatch): Promise<ProductV2> {
    return need((await client.patch<ProductV2>(at(id), patch, v2)).data, 'product');
  },

  async publish(id: string): Promise<ProductV2> {
    return need((await client.post<ProductV2>(`${at(id)}/publish`, undefined, v2)).data, 'product');
  },

  async archive(id: string): Promise<ProductV2> {
    return need((await client.post<ProductV2>(`${at(id)}/archive`, undefined, v2)).data, 'product');
  },

  /** Soft delete with its items and stock (Admin). */
  async remove(id: string): Promise<void> {
    await client.delete(at(id), v2);
  },

  async restore(id: string): Promise<ProductV2> {
    return need((await client.post<ProductV2>(`${at(id)}/restore`, undefined, v2)).data, 'product');
  },

  async variantPreview(input: {
    variant_axes: AnyVariantAxis[];
    name?: string;
    slug?: string;
    product_id?: string;
  }): Promise<{ total: number; new: number; combinations: VariantCombination[] }> {
    return need((await client.post<any>('/products/variant-preview', input, v2)).data, 'combinations');
  },

  async addItem(id: string, input: ItemInput): Promise<ProductV2> {
    return need((await client.post<ProductV2>(`${at(id)}/items`, input, v2)).data, 'product');
  },

  async updateItem(id: string, itemId: string, patch: ItemPatch): Promise<ProductV2> {
    return need((await client.patch<ProductV2>(itemAt(id, itemId), patch, v2)).data, 'product');
  },

  async deleteItem(id: string, itemId: string): Promise<ProductV2> {
    return need((await client.delete<ProductV2>(itemAt(id, itemId), v2)).data, 'product');
  },

  async restoreItem(id: string, itemId: string): Promise<ProductV2> {
    return need((await client.post<ProductV2>(`${itemAt(id, itemId)}/restore`, undefined, v2)).data, 'product');
  },
};
