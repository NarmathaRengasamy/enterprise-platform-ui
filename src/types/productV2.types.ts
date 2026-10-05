/**
 * The new product module's products and items (design §3.3–§3.5, §6.2).
 * Mirrors /api/v2/products; snake_case. Money is always whole paise.
 */

import type { ProductType, Translated } from './productType.types';

export type Fulfilment = ProductType['fulfilment'];
export type Tracking = ProductType['tracking'];
export type ProductStatus = 'draft' | 'active' | 'archived';
export type ItemStatus = 'active' | 'inactive';
export type PriceUnit = 'each' | 'hour' | 'day' | 'month';
export type AttributeValueType = string | number | boolean | Translated;

export interface AttributeValue {
  key: string;
  /** A size is its base amount, a number (1 l → 1000); send it as the variant preview returns it. */
  value: AttributeValueType;
}

export interface VariantAxis {
  key: string;
  values: string[];
}

/** A measured size (R45), e.g. { amount: 500, unit: "ml" }. Units: g, kg · ml, l · cm, m · piece. */
export interface MeasuredValue {
  amount: number;
  unit: string;
}

/** A measured-size variant option: a number attribute with a unit family, and its sizes. */
export interface MeasuredVariantAxis {
  key: string;
  values: MeasuredValue[];
}

/**
 * What the server accepts (and, for a product with sizes, returns) as a
 * variant option. `ProductV2.variant_axes` stays typed as `VariantAxis[]` until
 * the screens handle sizes (3b.4); a product with a size holds a
 * `MeasuredVariantAxis` there — check with `isMeasuredAxis`.
 */
export type AnyVariantAxis = VariantAxis | MeasuredVariantAxis;

export const isMeasuredAxis = (axis: { values: unknown[] }): axis is MeasuredVariantAxis =>
  axis.values.some((v) => typeof v === 'object' && v !== null);

/** An item's measured size; base_amount is in g · ml · cm · piece (1 l → 1000). */
export interface Measure {
  amount: number;
  unit: string;
  base_amount: number;
}

/** Worked out by the server, never stored (R46), e.g. ₹36 per "100 ml". */
export interface PricePerUnit {
  amount_minor: number;
  currency: string;
  tax_inclusive: boolean;
  per: string;
}

export type LimitWindow = 'day' | 'week' | 'month' | 'year' | 'lifetime';

/** R50: null = no limit (product) or "the product's value" (item). */
export interface PurchaseLimits {
  min_per_order: number | null;
  max_per_order: number | null;
  per_customer: Record<LimitWindow, number | null>;
}

export interface PurchaseLimitsInput {
  min_per_order?: number | null;
  max_per_order?: number | null;
  per_customer?: Partial<Record<LimitWindow, number | null>> | null;
}

export const LIMIT_WINDOW_LABELS: Record<LimitWindow, string> = {
  day: '24 hours',
  week: '7 days',
  month: '30 days',
  year: '1 year',
  lifetime: 'Ever',
};

/* ------------------------------------------------- sizes and limits (3b) */

/** Base units per unit — the same table as the server's utils/units.util.ts. */
export const UNIT_FACTORS: Record<string, number> = { g: 1, kg: 1000, ml: 1, l: 1000, cm: 1, m: 100, piece: 1 };

/** 1 l → 1000 (ml); what an item stores for its size and signs with (R20). */
export const measureBase = (v: MeasuredValue): number => Math.round(v.amount * (UNIT_FACTORS[v.unit] ?? 1) * 1e6) / 1e6;

/** "500 ml", "1 l", "1 piece", "6 pieces". */
export const measureText = (v: MeasuredValue): string =>
  v.unit === 'piece' ? `${v.amount} ${v.amount === 1 ? 'piece' : 'pieces'}` : `${v.amount} ${v.unit}`;

/**
 * Price per unit while typing (R46) — the server works out the saved one the
 * same way: per 100 g / 100 ml / 100 cm below 1 kg / 1 l / 1 m, else per kg /
 * l / m; per piece for a count. null without a price or size, or for rentals.
 */
export const pricePerUnitOf = (
  amountMinor: number | null,
  measure: { base_amount: number; unit: string } | null | undefined,
  priceUnit: PriceUnit = 'each'
): { amount_minor: number; per: string } | null => {
  if (amountMinor === null || !measure || measure.base_amount <= 0 || priceUnit !== 'each') return null;
  const u = measure.unit;
  if (u === 'piece') return { amount_minor: Math.round(amountMinor / measure.base_amount), per: 'piece' };
  const base = u === 'g' || u === 'kg' ? 'g' : u === 'ml' || u === 'l' ? 'ml' : u === 'cm' || u === 'm' ? 'cm' : null;
  if (!base) return null;
  const large = base === 'g' ? { at: 1000, unit: 'kg' } : base === 'ml' ? { at: 1000, unit: 'l' } : { at: 100, unit: 'm' };
  const [size, per] = measure.base_amount < large.at ? [100, `100 ${base}`] : [large.at, large.unit];
  return { amount_minor: Math.round((amountMinor * size) / measure.base_amount), per };
};

const LIMIT_WINDOW_TEXT: Record<LimitWindow, string> = {
  day: 'every 24 hours',
  week: 'every 7 days',
  month: 'every 30 days',
  year: 'every year',
  lifetime: 'in total',
};

/** "Max 2 per order · 4 per customer every 30 days" — the same words as the server's limits_summary. */
export const limitsSummaryText = (l: PurchaseLimitsInput | null | undefined): string => {
  if (!l) return '';
  const parts: string[] = [];
  if (l.min_per_order != null && l.min_per_order > 1) parts.push(`Min ${l.min_per_order} per order`);
  if (l.max_per_order != null) parts.push(`Max ${l.max_per_order} per order`);
  (Object.keys(LIMIT_WINDOW_TEXT) as LimitWindow[]).forEach((w) => {
    const v = l.per_customer?.[w];
    if (v != null) parts.push(`${v} per customer ${LIMIT_WINDOW_TEXT[w]}`);
  });
  return parts.join(' · ');
};

export interface Media {
  url: string;
  kind: 'image' | 'video';
  alt?: string;
  sort_order?: number;
}

export interface Price {
  amount_minor: number;
  currency: string;
  tax_inclusive: boolean;
  price_unit: PriceUnit;
}

export type Availability =
  | { status: 'not_tracked' }
  | {
      status: 'tracked';
      on_hand: number;
      reserved: number;
      available: number;
      /* Phase 4 (optional: older responses and fixtures leave them out) */
      reorder_point?: number;
      /** available ≤ reorder point (and a reorder point is set). */
      low_stock?: boolean;
      /** Worked out from another item's stock: a pack's base, or a bundle's components. */
      from?: 'pack' | 'bundle';
    };

/** A pack (R47): `quantity` × its base item of the same product. */
export interface PackOf {
  base_item_id: string;
  quantity: number;
}

/** What a pack saves against buying the singles (R49), display only. */
export interface PackSaving {
  /** 0.1 = 10 % cheaper; negative when the pack costs more. */
  fraction: number;
  percent: number;
  amount_minor: number;
}

export interface ProductItem {
  id: string;
  product_id: string;
  sku: string;
  attributes: AttributeValue[];
  attribute_signature: string;
  /** null = the product's Track inventory. */
  track_inventory: boolean | null;
  price: Price | null;
  compare_at_minor: number | null;
  gst_rate: number | null;
  hsn_code: string | null;
  digital_delivery: 'download' | 'licence' | 'link' | null;
  media: Media[];
  status: ItemStatus;
  sort_order: number;
  is_deleted?: boolean;
  resolved_price: Price | null;
  effective: { track_inventory: boolean; tracking: Tracking; gst_rate: number | null; hsn_code: string | null; media: Media[] };
  availability: Availability;
  /* Phase 3b — always sent by the server; optional here so older fixtures still type-check. */
  /** The measured size; null when the product has none. */
  measure?: Measure | null;
  /** This item's own override; null = all from the product. */
  purchase_limits?: PurchaseLimits | null;
  /** null = not priced, no measure, or priced per hour / day / month. */
  price_per_unit?: PricePerUnit | null;
  /** Item → product → no limit. */
  effective_limits?: PurchaseLimits;
  /** "Max 2 per order · 4 per customer every 30 days"; "" when none. */
  limits_summary?: string;
  /* Phase 4 — optional here so older fixtures still type-check. */
  /** Set for a pack; null for a normal item. */
  pack_of?: PackOf | null;
  /** null unless the pack and its base are both priced with the same tax_inclusive. */
  pack_saving?: PackSaving | null;
  created_at?: string;
  updated_at?: string;
}

export interface ProductV2 {
  id: string;
  slug: string;
  name: Translated;
  description?: Translated;
  brand: string;
  product_type_id: string;
  type_version: number;
  category_ids: string[];
  primary_category_id: string | null;
  attributes: AttributeValue[];
  variant_axes: VariantAxis[];
  track_inventory: boolean;
  tracking: Tracking | null;
  fulfilment: Fulfilment | null;
  hsn_code: string | null;
  sac_code: string | null;
  gst_rate: number | null;
  media: Media[];
  option_media: { attribute_key: string; value: string; media: Media[] }[];
  is_bundle: boolean;
  /** R50: null = no limits (always sent; optional for older fixtures). */
  purchase_limits?: PurchaseLimits | null;
  min_price_minor: number | null;
  currency: string;
  status: ProductStatus;
  is_deleted?: boolean;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  effective: { fulfilment: Fulfilment; track_inventory: boolean; tracking: Tracking };
  items: ProductItem[];
  deleted_items?: ProductItem[];
  availability: { status: 'not_tracked' } | { status: 'tracked'; available: number };
}

/** One card / row of the search result. */
export interface ProductSummary extends Omit<ProductV2, 'items' | 'deleted_items' | 'effective' | 'availability'> {
  item_count: number;
  active_item_count: number;
  from_price: Price | null;
  availability: { status: 'not_tracked' } | { status: 'tracked'; available: number };
}

export type ProductSort = 'relevance' | 'price_asc' | 'price_desc' | 'name' | 'newest' | 'size_asc' | 'size_desc';

export interface ProductSearchFilters {
  search?: string;
  category_id?: string;
  /** 'deleted' = only deleted products (Admin / Editor). */
  status?: ProductStatus | 'all' | 'deleted';
  brand?: string;
  price_min_minor?: number;
  price_max_minor?: number;
  /** A measured-size attribute takes 1000, "1000" or "1 l" (all → 1000 ml). */
  attributes?: Record<string, (string | number | boolean)[]>;
  /** Size range (R46): the measured-size attribute, and the range in its base unit (g · ml · cm · piece). */
  measure_key?: string;
  measure_min?: number;
  measure_max?: number;
  include_deleted?: boolean;
  sort?: ProductSort;
  page?: number;
  limit?: number;
}

/** GET /v2/products/stats — the products list KPIs, for the whole catalogue (a Viewer: active only). */
export interface ProductStats {
  products: { total: number; active: number; draft: number; archived: number };
  /** Normal items; packs counted apart. */
  variants: { total: number; active: number; packs: number };
  /** Active, tracked items holding stock: out = available ≤ 0; low = at or below the reorder point. */
  stock: { tracked: number; low: number; out: number };
  /** Active items (packs included) with no price. */
  not_priced: number;
}

export interface ProductSearchResult {
  items: ProductSummary[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  sort: ProductSort;
  facets: Record<string, { value: string | boolean; count: number }[]>;
}

export interface PriceInput {
  amount_minor: number;
  currency?: string;
  tax_inclusive?: boolean;
  price_unit?: PriceUnit;
}

export interface ItemInput {
  sku?: string;
  attributes?: AttributeValue[];
  price?: PriceInput | null;
  compare_at_minor?: number | null;
  gst_rate?: number | null;
  hsn_code?: string | null;
  track_inventory?: boolean | null;
  media?: Media[];
  status?: ItemStatus;
  /** Only when creating an item whose Track inventory is on. */
  initial_stock?: number;
  /** Each null value = the product's value; null clears the override. */
  purchase_limits?: PurchaseLimitsInput | null;
  /**
   * Make this item a pack (R47) of a base item of the same product: by SKU in
   * the create body (the base has no id yet), by id or SKU when adding an item.
   * A pack takes no attributes, no Track inventory and no initial stock.
   */
  pack_of?: { base_item_id?: string; base_sku?: string; quantity: number } | null;
}

export type ItemPatch = Omit<ItemInput, 'attributes' | 'initial_stock' | 'pack_of'>;

export interface ProductInput {
  name: Translated;
  description?: Translated;
  slug?: string;
  brand?: string;
  category_ids?: string[];
  primary_category_id?: string | null;
  attributes?: AttributeValue[];
  variant_axes?: AnyVariantAxis[];
  track_inventory?: boolean;
  tracking?: Tracking | null;
  fulfilment?: Fulfilment | null;
  hsn_code?: string | null;
  sac_code?: string | null;
  gst_rate?: number | null;
  media?: Media[];
  option_media?: { attribute_key: string; value: string; media: Media[] }[];
  is_bundle?: boolean;
  /** Replaces the stored limits; null clears them. Every item's combined limits must still hold (422). */
  purchase_limits?: PurchaseLimitsInput | null;
  items?: ItemInput[];
}

export type ProductPatch = Partial<Omit<ProductInput, 'items'>>;

export interface VariantCombination {
  /** A size comes as its base amount — send it back as is when creating the item. */
  attributes: AttributeValue[];
  attribute_signature: string;
  /** "Red · 500 ml" */
  label: string;
  measure: Measure | null;
  suggested_sku: string;
  exists: boolean;
}

/** Same list as the server (includes the September 2025 GST slabs). */
export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];

export const FULFILMENT_LABELS: Record<Fulfilment, string> = {
  goods: 'Goods',
  service: 'Service',
  rental: 'Rental',
  digital: 'Digital',
};

export const TRACKING_LABELS: Record<Tracking, string> = {
  none: 'No units (quantity only)',
  batch: 'Batch numbers',
  serial: 'Serial numbers',
};

export const STATUS_LABELS: Record<ProductStatus, string> = { draft: 'Draft', active: 'Active', archived: 'Archived' };

/** "12 in stock" / "Not tracked" (design R31: never "out of stock" for an untracked item). */
export const availabilityLabel = (a: ProductV2['availability'] | Availability): string =>
  a.status === 'not_tracked' ? 'Not tracked' : `${a.available} in stock`;
