export interface CategoryItem {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  productsCount: number;
  productCount?: number;
  subcategories?: string[];
  updated?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CategoryStats {
  totalCategories: number;
  assignedSkus: number;
  topDistribution: {
    name: string;
    percentage: number;
  } | null;
  averagePerCategory: number;
}

export interface CategoryQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  hasProducts?: 'true' | 'false' | boolean;
  sortBy?: 'name' | 'productsCount' | string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateCategoryInput {
  id?: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface BulkDeleteResult {
  deleted: number;
  skipped: number;
  notFound: number;
  conflicts: Array<{ id: string; reason: string }>;
}

export interface PaginatedCategoriesResponse {
  success: boolean;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data: CategoryItem[];
}
