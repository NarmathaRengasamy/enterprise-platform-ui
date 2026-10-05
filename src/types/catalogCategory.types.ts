/**
 * Categories for the new product module (design §3.2, §6.2). Mirrors
 * /catalog-categories; snake_case. Categories set no fulfilment or tracking —
 * those are product settings (R13, Phase 2b).
 */

import type { Translated } from './productType.types';

export type CategoryMode = 'flat' | 'tree';
export type CategoryStatus = 'active' | 'hidden';

export interface CatalogCategory {
  id: string;
  code: string;
  name: Translated;
  description?: Translated;
  parent_id: string | null;
  /** Empty = inherit from the parent (or every attribute at the top level). */
  visible_field_keys: string[];
  sort_order: number;
  icon: string;
  color: string;
  status: CategoryStatus;
  is_deleted?: boolean;
  /** The fields actually in force after inheritance. */
  resolved_visible_field_keys: string[];
  /** Live products (products_v2) filed in this category. */
  product_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryNode extends CatalogCategory {
  children: CategoryNode[];
  /** Its parent is missing or deleted, so it is shown at the top level. */
  orphan?: boolean;
}

export interface CategoryRef {
  id: string;
  code: string;
  name: Translated;
}

export interface CategoryDetail extends CatalogCategory {
  ancestors: CategoryRef[];
  children: CategoryRef[];
}

export interface CategoryList {
  mode: CategoryMode;
  categories: CategoryNode[];
}

export interface CategoryInput {
  code: string;
  name: Translated;
  description?: Translated;
  parent_id?: string | null;
  visible_field_keys?: string[];
  icon?: string;
  color?: string;
  status?: CategoryStatus;
}

/** The KPI cards on the category screen, counted from the new products. */
export interface CategoryStats {
  total_categories: number;
  assigned_skus: number;
  categorised_products: number;
  top_distribution: { id: string; code: string; name: Translated; count: number; percentage: number } | null;
  average_per_category: number;
}

/** The code cannot change after creation, so it is not part of a patch. */
export type CategoryPatch = Partial<Omit<CategoryInput, 'code'>>;

/** Same rule as the server: 2–60 chars, lowercase letters, digits, "-" or "_". */
export const CATEGORY_CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{1,59}$/;
export const MAX_CATEGORY_DEPTH = 5;
