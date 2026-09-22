import { client } from './client';
import {
  CategoryItem,
  CategoryStats,
  CategoryQueryParams,
  CreateCategoryInput,
  UpdateCategoryInput,
  BulkDeleteResult,
  PaginatedCategoriesResponse,
} from '../types/category.types';

export * from '../types/category.types';

export const categoryService = {
  /**
   * Fetch categories list with optional search, hasProducts filter, and sorting.
   * Corresponds to GET /api/v1/categories
   */
  async getCategories(params?: CategoryQueryParams): Promise<CategoryItem[]> {
    const res = await client.get<CategoryItem[]>('/categories', { params });
    if (res.data && Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  },

  /**
   * Fetch full paginated categories response with total count and pages.
   * Corresponds to GET /api/v1/categories
   */
  async getPaginatedCategories(params?: CategoryQueryParams): Promise<PaginatedCategoriesResponse> {
    const res = await client.get<CategoryItem[]>('/categories', { params });
    return {
      success: res.success,
      total: res.total || (res.data ? res.data.length : 0),
      page: res.page || 1,
      limit: res.limit || 50,
      totalPages: res.totalPages || 1,
      data: res.data || [],
    };
  },

  /**
   * Catalog-wide category statistics and SKU allocation metrics.
   * Corresponds to GET /api/v1/categories/stats
   */
  async getCategoryStats(): Promise<CategoryStats> {
    const res = await client.get<CategoryStats>('/categories/stats');
    return (
      res.data || {
        totalCategories: 0,
        assignedSkus: 0,
        topDistribution: null,
        averagePerCategory: 0,
      }
    );
  },

  /**
   * Fetch single category details by ID.
   * Corresponds to GET /api/v1/categories/:id
   */
  async getCategoryById(id: string): Promise<CategoryItem> {
    const res = await client.get<CategoryItem>(`/categories/${encodeURIComponent(id)}`);
    if (!res.data) {
      throw new Error(res.message || 'Category not found');
    }
    return res.data;
  },

  /**
   * Create a new category.
   * Corresponds to POST /api/v1/categories
   */
  async createCategory(payload: CreateCategoryInput): Promise<CategoryItem> {
    const res = await client.post<CategoryItem>('/categories', payload);
    if (!res.data) {
      throw new Error(res.message || 'Failed to create category');
    }
    return res.data;
  },

  /**
   * Update an existing category and push renames to associated products.
   * Corresponds to PUT /api/v1/categories/:id
   */
  async updateCategory(id: string, payload: UpdateCategoryInput): Promise<CategoryItem> {
    const res = await client.put<CategoryItem>(`/categories/${encodeURIComponent(id)}`, payload);
    if (!res.data) {
      throw new Error(res.message || 'Failed to update category');
    }
    return res.data;
  },

  /**
   * Delete a category by ID.
   * If products are assigned to this category, backend throws 409 Conflict.
   * Corresponds to DELETE /api/v1/categories/:id
   */
  async deleteCategory(id: string): Promise<{ id: string }> {
    const res = await client.delete<{ id: string }>(`/categories/${encodeURIComponent(id)}`);
    return res.data || { id };
  },

  /**
   * Bulk delete multiple categories by IDs.
   * Corresponds to POST /api/v1/categories/bulk-delete
   */
  async bulkDeleteCategories(ids: string[]): Promise<BulkDeleteResult> {
    const res = await client.post<BulkDeleteResult>('/categories/bulk-delete', { ids });
    if (!res.data) {
      throw new Error(res.message || 'Bulk delete failed');
    }
    return res.data;
  },

  /**
   * Export all categories with product counts as CSV download.
   * Corresponds to GET /api/v1/categories/export
   */
  async exportCategories(): Promise<void> {
    await client.downloadBlob('/categories/export', undefined, 'omniflow_categories.csv');
  },
};
