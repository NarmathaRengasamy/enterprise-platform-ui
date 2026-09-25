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
  stockNotSet?: number;
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
  stockStatus?: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Unspecified' | string;
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

const normalizeStatusEnum = (status?: string): 'In Stock' | 'Low Stock' | 'Out of Stock' | 'Unspecified' | undefined => {
  if (!status || !String(status).trim()) return undefined;
  const s = String(status || '').trim().toLowerCase();
  if (s.includes('unspec') || s.includes('not set') || s.includes('unknown')) {
    return 'Unspecified';
  }
  if (s.includes('out') || s.includes('unavail') || s.includes('sold')) {
    return 'Out of Stock';
  }
  if (s.includes('low') || s.includes('limit')) {
    return 'Low Stock';
  }
  if (s.includes('in') || s.includes('avail')) {
    return 'In Stock';
  }
  return undefined;
};

const sanitizeProductPayload = <T extends CreateProductInput | UpdateProductInput>(payload: T): T => {
  const sanitized: any = {};

  // 1. Core / Required Fields
  if (payload.name && String(payload.name).trim()) {
    sanitized.name = String(payload.name).trim();
  }
  if (payload.sku && String(payload.sku).trim()) {
    sanitized.sku = String(payload.sku).trim();
  }
  if (payload.categoryId && String(payload.categoryId).trim()) {
    sanitized.categoryId = String(payload.categoryId).trim();
  }

  // 2. Optional Strings (omit if empty, whitespace, null, or undefined)
  if (payload.shortName && String(payload.shortName).trim()) {
    sanitized.shortName = String(payload.shortName).trim();
  }
  if (payload.description && String(payload.description).trim()) {
    sanitized.description = String(payload.description).trim();
  }
  if (payload.margin && String(payload.margin).trim()) {
    sanitized.margin = String(payload.margin).trim();
  }
  if (payload.discount && String(payload.discount).trim()) {
    sanitized.discount = String(payload.discount).trim();
  }
  if (payload.image && String(payload.image).trim()) {
    sanitized.image = String(payload.image).trim();
  }

  // 3. Optional Numerics (omit if undefined, null, empty string, or NaN)
  if (payload.originalPrice !== undefined && payload.originalPrice !== null && payload.originalPrice !== ('' as any)) {
    const num = Number(payload.originalPrice);
    if (isFinite(num) && num > 0) sanitized.originalPrice = num;
  }
  if (payload.committed !== undefined && payload.committed !== null && payload.committed !== ('' as any)) {
    const num = Number(payload.committed);
    if (isFinite(num) && num >= 0) sanitized.committed = num;
  }
  if (payload.reorderPoint !== undefined && payload.reorderPoint !== null && payload.reorderPoint !== ('' as any)) {
    const num = Number(payload.reorderPoint);
    if (isFinite(num) && num >= 0) sanitized.reorderPoint = num;
  }

  // 4. Variants processing
  const hasVariantsArray = Array.isArray(payload.variants) && payload.variants.length > 0;

  if (hasVariantsArray) {
    const cleanedVariants = (payload.variants as any[])
      .map((v: any) => {
        const cleanVar: any = {};

        // Variant ID (keep only if provided)
        if (v.variantId && String(v.variantId).trim()) {
          cleanVar.variantId = String(v.variantId).trim();
        }

        // SKU (optional - backend generates <productSku>-<n> if omitted)
        if (v.sku && String(v.sku).trim()) {
          cleanVar.sku = String(v.sku).trim();
        }

        // Attributes definition (only valid non-empty axes)
        if (v.attributes && Array.isArray(v.attributes)) {
          const validAttrs = v.attributes
            .map((a: any) => ({
              name: String(a.name || '').trim(),
              value: String(a.value || '').trim(),
            }))
            .filter((a: any) => a.name && a.value);
          if (validAttrs.length > 0) {
            cleanVar.attributes = validAttrs;
          }
        }

        // Description (max 1000 chars, omit if blank)
        if (v.description && String(v.description).trim()) {
          cleanVar.description = String(v.description).trim();
        }

        // Image (omit if blank)
        const vImg = v.image || v.images?.[0];
        if (vImg && String(vImg).trim()) {
          cleanVar.image = String(vImg).trim();
        }

        // Price (number, omit if unpriced - never send 0 for unpriced!)
        if (v.price !== undefined && v.price !== null && v.price !== ('' as any)) {
          const vPrice = Number(v.price);
          if (isFinite(vPrice) && vPrice >= 0) {
            cleanVar.price = vPrice;
          }
        }

        // Stock (clean numeric string without units, e.g. "24", omit if not set)
        if (v.stock !== undefined && v.stock !== null && String(v.stock).trim() !== '') {
          const rawStockStr = String(v.stock).replace(/[^0-9.]/g, '');
          if (rawStockStr !== '') {
            const parsedStock = parseFloat(rawStockStr);
            if (isFinite(parsedStock) && parsedStock >= 0) {
              cleanVar.stock = String(parsedStock);
            }
          }
        }

        // Status (omit if not explicitly set)
        if (v.status && String(v.status).trim()) {
          const normStatus = normalizeStatusEnum(v.status);
          if (normStatus && normStatus !== 'Unspecified') {
            cleanVar.status = normStatus;
          }
        }

        return cleanVar;
      })
      .filter((v: any) => {
        return (v.attributes && v.attributes.length > 0) || v.sku || v.variantId || v.price !== undefined;
      });

    if (cleanedVariants.length > 0) {
      sanitized.variants = cleanedVariants;
    }
    // Note: For products with variants, top-level price, stock, and stockStatus
    // are omitted so the backend calculates them derived from variants.
  } else {
    // Single product without variants
    if (payload.price !== undefined && payload.price !== null && payload.price !== ('' as any)) {
      const numPrice = Number(payload.price);
      if (isFinite(numPrice) && numPrice >= 0) {
        sanitized.price = numPrice;
      }
    }

    if (payload.stock !== undefined && payload.stock !== null && payload.stock !== ('' as any)) {
      const numStock = typeof payload.stock === 'string'
        ? parseFloat(String(payload.stock).replace(/[^0-9.]/g, ''))
        : Number(payload.stock);
      if (isFinite(numStock) && numStock >= 0) {
        sanitized.stock = numStock;
      }
    }

    if (payload.stockStatus && String(payload.stockStatus).trim()) {
      const normStatus = normalizeStatusEnum(payload.stockStatus);
      if (normStatus && normStatus !== 'Unspecified') {
        sanitized.stockStatus = normStatus;
      }
    }
  }

  // 5. Gallery & Videos
  if (Array.isArray(payload.gallery) && payload.gallery.length > 0) {
    const validGallery = payload.gallery.filter((g: any) => g && g.src && String(g.src).trim());
    if (validGallery.length > 0) {
      sanitized.gallery = validGallery;
    }
  }

  if (Array.isArray(payload.videos) && payload.videos.length > 0) {
    const validVideos = payload.videos.filter((vid: any) => {
      if (!vid) return false;
      if (typeof vid === 'string') return vid.trim().length > 0;
      return (vid.url && String(vid.url).trim()) || (vid.src && String(vid.src).trim());
    });
    if (validVideos.length > 0) {
      sanitized.videos = validVideos;
    }
  }

  return sanitized as T;
};

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
    const cleanPayload = sanitizeProductPayload(payload);
    const res = await client.post<Product>('/products', cleanPayload);
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
    const cleanPayload = sanitizeProductPayload(payload);
    const res = await client.put<Product>(`/products/${encodeURIComponent(id)}`, cleanPayload);
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
