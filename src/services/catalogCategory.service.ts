import { client } from './client';
import {
  CategoryDetail,
  CategoryInput,
  CategoryList,
  CategoryPatch,
} from '../types/catalogCategory.types';

/**
 * The new categories (Phase 2), served at /catalog-categories beside the old
 * flat /categories until the Phase 5 cut-over.
 */

const need = <T>(value: T | undefined, what: string): T => {
  if (value === undefined) throw new Error(`The server did not return the ${what}`);
  return value;
};

const at = (id: string) => `/catalog-categories/${encodeURIComponent(id)}`;

export const catalogCategoryService = {
  /** `{ mode, categories }` — a flat list or a tree, children in order. */
  async list(includeDeleted = false): Promise<CategoryList> {
    const query = includeDeleted ? '?include_deleted=true' : '';
    return need((await client.get<CategoryList>(`/catalog-categories${query}`)).data, 'categories');
  },

  async get(id: string): Promise<CategoryDetail> {
    return need((await client.get<CategoryDetail>(at(id))).data, 'category');
  },

  async create(input: CategoryInput): Promise<CategoryDetail> {
    return need((await client.post<CategoryDetail>('/catalog-categories', input)).data, 'category');
  },

  async update(id: string, patch: CategoryPatch): Promise<CategoryDetail> {
    return need((await client.patch<CategoryDetail>(at(id), patch)).data, 'category');
  },

  /** The full list of one parent's children, in their new order. */
  async reorder(parentId: string | null, ids: string[]): Promise<CategoryList> {
    return need(
      (await client.post<CategoryList>('/catalog-categories/reorder', { parent_id: parentId, ids })).data,
      'categories'
    );
  },

  /**
   * Downloads the CSV (Admin / Editor) for what the screen shows: the same
   * search, status filter and "Show deleted".
   */
  async exportCsv(params: { search?: string; status?: 'all' | 'active' | 'hidden'; include_deleted?: boolean } = {}): Promise<void> {
    await client.downloadBlob(
      '/catalog-categories/export',
      {
        search: params.search || undefined,
        status: params.status && params.status !== 'all' ? params.status : undefined,
        include_deleted: params.include_deleted ? 'true' : undefined,
      },
      'categories.csv'
    );
  },

  /** Soft delete (Admin). */
  async remove(id: string): Promise<void> {
    await client.delete(at(id));
  },

  async restore(id: string): Promise<CategoryDetail> {
    return need((await client.post<CategoryDetail>(`${at(id)}/restore`)).data, 'category');
  },
};
