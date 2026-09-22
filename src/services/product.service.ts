import { client } from './client';
import { Product, ProductVariant, ProductGalleryItem } from '../types';

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  category?: string;
  status?: string;
  sortBy?: 'name' | 'price' | 'stock' | 'createdAt' | 'sku' | string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedProductsResponse {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data: Product[];
}

export interface ProductStats {
  total: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
  categoriesCount: number;
  inStockPercentage: number;
}

export interface CreateProductInput {
  name: string;
  shortName?: string;
  sku: string;
  categoryId: string;
  price?: number;
  originalPrice?: number;
  stock?: number;
  stockStatus?: 'In Stock' | 'Low Stock' | 'Out of Stock' | string;
  committed?: number;
  reorderPoint?: number;
  margin?: string;
  discount?: string;
  image?: string;
  gallery?: ProductGalleryItem[];
  description?: string;
  variants?: ProductVariant[];
  videos?: any[];
}

export interface UpdateProductInput extends Partial<CreateProductInput> {}

export interface ExportProductsParams {
  categoryId?: string;
  category?: string;
  status?: string;
  search?: string;
}

export const productService = {
  /**
   * List products with pagination, search, and category/status filtering.
   * Corresponds to GET /api/v1/products
   */
  async getProducts(params?: ProductQueryParams): Promise<PaginatedProductsResponse> {
    const res = await client.get<Product[]>('/products', { params });
    return {
      success: res.success,
      total: res.total || 0,
      page: res.page || 1,
      limit: res.limit || 8,
      totalPages: res.totalPages || 1,
      data: res.data || [],
    };
  },

  /**
   * Catalog-wide metrics for KPIs and counters (never page-scoped).
   * Corresponds to GET /api/v1/products/stats
   */
  async getProductStats(): Promise<ProductStats> {
    const res = await client.get<ProductStats>('/products/stats');
    return (
      res.data || {
        total: 0,
        inStock: 0,
        lowStock: 0,
        outOfStock: 0,
        categoriesCount: 0,
        inStockPercentage: 0,
      }
    );
  },

  /**
   * Get a single product details by ID or SKU.
   * Corresponds to GET /api/v1/products/:id
   */
  async getProductById(id: string): Promise<Product> {
    const res = await client.get<Product>(`/products/${encodeURIComponent(id)}`);
    if (!res.data) {
      throw new Error(res.message || 'Product not found');
    }
    return res.data;
  },

  /**
   * Create a new product.
   * Corresponds to POST /api/v1/products
   */
  async createProduct(payload: CreateProductInput): Promise<Product> {
    const res = await client.post<Product>('/products', payload);
    if (!res.data) {
      throw new Error(res.message || 'Failed to create product');
    }
    return res.data;
  },

  /**
   * Update an existing product.
   * Corresponds to PUT /api/v1/products/:id
   */
  async updateProduct(id: string, payload: UpdateProductInput): Promise<Product> {
    const res = await client.put<Product>(`/products/${encodeURIComponent(id)}`, payload);
    if (!res.data) {
      throw new Error(res.message || 'Failed to update product');
    }
    return res.data;
  },

  /**
   * Delete a product by ID/SKU.
   * Corresponds to DELETE /api/v1/products/:id
   */
  async deleteProduct(id: string): Promise<{ id: string }> {
    const res = await client.delete<{ id: string }>(`/products/${encodeURIComponent(id)}`);
    return res.data || { id };
  },

  /**
   * Export filtered product catalog as a CSV download.
   * Corresponds to GET /api/v1/products/export
   */
  async exportProducts(params?: ExportProductsParams): Promise<void> {
    await client.downloadBlob('/products/export', params, 'omniflow_products.csv');
  },
};
