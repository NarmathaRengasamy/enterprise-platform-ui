/**
 * STOREFRONT API — the customer-facing half.
 *
 * Deliberately does NOT use `client` from `services/client.ts`: that attaches
 * the admin bearer token, and a shopper has no account. These calls must work
 * for someone who has never logged in, so they go out with no credentials at
 * all — which is also the simplest way to be sure nothing private is reachable
 * by accident.
 */

const API_ROOT = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:5051/api/v1'
).replace(/\/api\/v1\/?$/, '');

export const STORE_API = `${API_ROOT}/public/v2`;

/**
 * Makes a stored media URL loadable.
 *
 * Uploaded files are served from the API server's own root, which is a
 * different origin from the site in development — a bare `/uploads/...` would
 * ask this app for a file it does not have. A pasted YouTube or Vimeo link is
 * already absolute and passes through untouched.
 */
export const storeAsset = (url?: string): string | undefined => {
  if (!url) return undefined;
  if (/^(https?:)?\/\//i.test(url)) return url;
  return `${API_ROOT}${url.startsWith('/') ? url : `/${url}`}`;
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${STORE_API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as any)?.message || `Request failed (${res.status})`);
  }
  return json as T;
}

/* ---------------------------------------------------------------- types */

export interface StoreAttribute {
  key: string;
  label: string;
  value: string;
}

/**
 * A published picture or video.
 *
 * The storefront copy is deliberately thinner than the admin one: filenames
 * and byte sizes are storage details a customer has no use for, so the public
 * API strips them.
 */
export interface StoreMedia {
  id: string;
  kind: 'image' | 'video';
  url: string;
  source: 'upload' | 'link';
  sort: number;
  isThumbnail?: boolean;
  alt?: string;
}

export interface StoreItem {
  id: string;
  sku: string;
  optionLabel?: string;
  valueLabel?: string;
  attributes: StoreAttribute[];
  description?: string;
  image?: string;
  /** This variant's own pictures. Empty means it shows the product's. */
  media?: StoreMedia[];
  /** Null is a real answer — on request, or simply not priced. */
  price: { amount: number; currency: string } | null;
  available: boolean;
  availabilityLabel: string;
}

export interface StoreProduct {
  id: string;
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  image?: string;
  media?: StoreMedia[];
  categoryIds: string[];
  attributes: StoreAttribute[];
  pricing: { model: string; label?: string; unit?: string; currency: string };
  priceFrom: number | null;
  priceTo: number | null;
  available: boolean;
  availabilityLabel: string;
  items: StoreItem[];
  createdAt?: string;
}

export interface StoreCategory {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  icon?: string;
  color?: string;
  productsCount: number;
  pricing: { model: string; label?: string; unit?: string; currency: string };
  children?: StoreCategory[];
}

export interface StoreFacet {
  key: string;
  label: string;
  values: { value: string; count: number }[];
}

export interface StoreCharge {
  id: string;
  label: string;
  amount: number | null;
  basis: string;
  maxQuantity: number;
  currency: string;
  note?: string;
}

export interface StoreBreakdown {
  itemId: string;
  sku: string;
  priceLabel: string | null;
  base: number | null;
  currency: string;
  required: StoreCharge[];
  optional: StoreCharge[];
  totalRequired: number | null;
  note: string | null;
}

export interface StoreQuery {
  search?: string;
  categoryId?: string;
  brand?: string;
  attributes?: Record<string, string[]>;
  priceMin?: number;
  priceMax?: number;
  inStockOnly?: boolean;
  sortBy?: 'createdAt' | 'name' | 'sku' | 'brand';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  facets?: boolean;
}

export interface StorePage {
  data: StoreProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets?: StoreFacet[];
}

/* ------------------------------------------------------------- methods */

export const storeService = {
  products: (body: StoreQuery = {}) =>
    call<StorePage>('/products', { method: 'POST', body: JSON.stringify(body) }),

  product: async (id: string) => (await call<{ data: StoreProduct }>(`/products/${id}`)).data,

  categories: async (tree = false) =>
    (await call<{ data: StoreCategory[] }>(`/categories${tree ? '?tree=true' : ''}`)).data,

  charges: async (itemId: string) =>
    (await call<{ data: StoreBreakdown }>(`/items/${itemId}/charges`)).data,
};

/* -------------------------------------------------------------- format */

export const money = (amount: number | null | undefined, currency = 'INR'): string => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
};

/**
 * What a product card shows where a price would go.
 *
 * Four genuinely different cases. Collapsing them into one is how a repair
 * that has not been quoted yet ends up advertised at zero.
 */
export const priceLabel = (p: StoreProduct): string => {
  if (p.pricing.model === 'free') return 'Free';
  if (typeof p.priceFrom !== 'number') {
    return p.pricing.model === 'on_request'
      ? p.pricing.label || 'Price on request'
      : 'Price on request';
  }
  const unit = p.pricing.unit ? ` / ${p.pricing.unit}` : '';
  if (typeof p.priceTo === 'number' && p.priceTo !== p.priceFrom) {
    return `${money(p.priceFrom, p.pricing.currency)} – ${money(p.priceTo, p.pricing.currency)}${unit}`;
  }
  return `${money(p.priceFrom, p.pricing.currency)}${unit}`;
};

export default storeService;
