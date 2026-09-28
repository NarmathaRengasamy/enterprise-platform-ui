/**
 * CATALOGUE V2 types.
 *
 * Mirrors `src/v2/types.ts` on the backend. Kept separate from `types/index.ts`
 * so the existing v1 Product/Category types are untouched and the two can run
 * side by side during the cutover.
 */

/* ---------------------------------------------------------------- shared */

/**
 * On every v2 record.
 *
 * `id` is a server-minted UUID — never send one on a create, it is ignored.
 * Nothing is hard-deleted, so a row that is gone from a list is flagged
 * `is_deleted` rather than absent from the database.
 */
export interface SoftDeletable {
  id: string;
  is_deleted?: boolean;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttributeValue {
  key: string;
  value: string;
}

export type LifecycleStatus = 'draft' | 'active' | 'archived';

/* ------------------------------------------------------------ type system */

export type FieldType = 'text' | 'number' | 'choice' | 'boolean';

export interface FieldDefinition {
  /** Immutable once created. The label is what the user edits. */
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  /** Feeds the combination matrix. Only a `choice` field may do this. */
  variantForming?: boolean;
  filterable?: boolean;
  required?: boolean;
  /** Retired, not removed — products still carry values for it. */
  deprecated?: boolean;
}

/**
 * One value in use for an open choice field, and how many records carry it.
 *
 * The count is what separates a value that has earned its place from a typo
 * someone made once, which is the whole difference between a list worth
 * locking down and a mess.
 */
export interface VocabularyEntry {
  value: string;
  count: number;
}

/* ----------------------------------------------------------------- media */

/** What a type allows. Set under Catalog Setup, applies to every product. */
export interface MediaConfig {
  images: { enabled: boolean; required?: boolean };
  videos: { enabled: boolean };
}

export type MediaKind = 'image' | 'video';

/**
 * One picture or video.
 *
 * `sort` is an explicit number rather than the array position so the order
 * survives a round trip, and `isThumbnail` is a flag on an image rather than a
 * separate field on the product — the cover does not have to be the first one.
 */
export interface MediaAsset {
  id: string;
  kind: MediaKind;
  url: string;
  source: 'upload' | 'link';
  sort: number;
  isThumbnail?: boolean;
  alt?: string;
  /* Storage details. Present on admin reads, stripped from the public API. */
  filename?: string;
  sizeBytes?: number;
  contentType?: string;
}

export interface ProductType extends SoftDeletable {
  name: string;
  description?: string;
  fields: FieldDefinition[];
  /** Pictures and videos this type uses. Absent means neither. */
  media?: MediaConfig;
  /** Present on the detail read only. */
  productCount?: number;
}

/* -------------------------------------------------------------- commerce */

export type PricingModel =
  | 'fixed'
  | 'per_unit'
  | 'per_time'
  | 'per_variant'
  | 'tiered'
  | 'on_request'
  | 'free';

export type AvailabilityModel =
  | 'quantity'
  | 'time_slot'
  | 'capacity_per_date'
  | 'unlimited'
  | 'lead_time'
  | 'none';

export interface CommerceConfig {
  pricing: {
    model: PricingModel;
    label?: string;
    unit?: string;
    currency?: string;
  };
  availability: {
    model: AvailabilityModel;
    label?: string;
    slotMinutes?: number;
    openingHours?: Record<string, string>;
    requiresIncharge?: boolean;
  };
}

export interface CatalogCategory extends SoftDeletable {
  name: string;
  description?: string;
  parentId?: string | null;
  typeId?: string | null;
  commerce?: CommerceConfig;
  icon?: string;
  color?: string;

  /* Read-only, computed by the server. */
  productsCount?: number;
  /** The config actually in force, walked up the tree. */
  effectiveCommerce?: CommerceConfig;
  effectiveTypeId?: string | null;
  depth?: number;
  ancestors?: CatalogCategory[];
  children?: CatalogCategory[];
  /** The inherited field definitions, so an editor renders from one call. */
  fields?: FieldDefinition[];
}

export interface CategoryNode extends CatalogCategory {
  children: CategoryNode[];
}

/* ------------------------------------------------------- products / items */

export interface AvailabilityState {
  strategy: AvailabilityModel;
  available: boolean;
  /** "12 in stock", "3 left on 14 Oct", "Ships in about 6 weeks". */
  label: string;
  detail: Record<string, any>;
}

export interface ItemPrice {
  amount: number;
  currency: string;
  priceListId: string;
}

export interface CatalogItem extends SoftDeletable {
  productId: string;
  sku: string;
  attributes: AttributeValue[];
  /** Derived display labels. Read-only. */
  optionLabel?: string;
  valueLabel?: string;
  description?: string;
  /** Derived from this variant's thumbnail, else the product's. Read-only. */
  image?: string;
  media?: MediaAsset[];
  status: LifecycleStatus;
  /** Null is a real answer: on request, or not priced yet. Never a zero. */
  price?: ItemPrice | null;
  availability?: AvailabilityState;
}

export interface CatalogProduct extends SoftDeletable {
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  typeId: string;
  categoryIds: string[];
  attributes: AttributeValue[];
  /** Lifecycle, NOT stock. A draft product is unpublished, not unavailable. */
  status: LifecycleStatus;
  /** Derived from the thumbnail. Read-only — set it through `media`. */
  image?: string;
  media?: MediaAsset[];

  /* Computed on read. */
  commerce?: CommerceConfig;
  items?: CatalogItem[];
  priceFrom?: number | null;
  priceTo?: number | null;
  currency?: string;
  available?: boolean;
  availabilityLabel?: string;
  fields?: FieldDefinition[];
  typeName?: string | null;
  /** On a delete response. */
  itemsDeleted?: number;
}

/* ----------------------------------------------------------------- money */

export interface CatalogPrice extends SoftDeletable {
  itemId: string;
  amount: number;
  currency: string;
  priceListId: string;
  validFrom?: string | null;
  validTo?: string | null;
  minQuantity?: number;
}

export type ChargeBasis = 'fixed' | 'percent' | 'per_unit' | 'per_time';
export type ChargeScopeLevel = 'category' | 'product' | 'item';

export interface CatalogCharge extends SoftDeletable {
  name: string;
  label?: string;
  scope: { level: ChargeScopeLevel; refId: string };
  basis: ChargeBasis;
  amount?: number;
  percent?: number;
  percentOf?: 'base' | 'base_plus_charges';
  required: boolean;
  selectable?: boolean;
  maxQuantity?: number;
  currency?: string;
  priceListId?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
  showInListing?: boolean;
}

export interface ResolvedCharge {
  id: string;
  name: string;
  label: string;
  basis: ChargeBasis;
  /** Null with a `note` when a percentage needs a base price it does not have. */
  amount: number | null;
  required: boolean;
  selectable: boolean;
  maxQuantity: number;
  currency: string;
  showInListing: boolean;
  source: { level: ChargeScopeLevel; refId: string };
  note?: string;
}

export interface ChargeBreakdown {
  itemId: string;
  sku: string;
  pricingModel: PricingModel;
  priceLabel: string | null;
  /** May legitimately be null — quoted on request, or not priced yet. */
  base: number | null;
  currency: string;
  required: ResolvedCharge[];
  optional: ResolvedCharge[];
  /** Null when the base is unknown or a required percentage is uncomputable. */
  totalRequired: number | null;
  note: string | null;
}

/* ---------------------------------------------------- availability rows */

export interface CatalogAvailabilityRow extends SoftDeletable {
  itemId: string;
  locationId: string;
  strategy: AvailabilityModel;
  onHand?: number;
  reserved?: number;
  date?: string;
  capacity?: number;
  openingHours?: Record<string, string>;
  slotMinutes?: number;
  resourceId?: string;
  inchargeId?: string;
  leadDays?: number;
  note?: string;
}

export interface Slot {
  startsAt: string;
  endsAt: string;
  available: boolean;
  inchargeId?: string;
  resourceId?: string;
  locationId: string;
}

export interface SlotDay {
  date: string;
  total: number;
  available: number;
  slots: Slot[];
}

export interface CatalogBooking extends SoftDeletable {
  itemId: string;
  locationId?: string;
  inchargeId?: string;
  resourceId?: string;
  startsAt: string;
  endsAt: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  status: 'held' | 'confirmed' | 'cancelled' | 'completed';
  notes?: string;
}

/* --------------------------------------------------------------- queries */

export interface Facet {
  key: string;
  label: string;
  values: { value: string; count: number }[];
}

export interface CatalogSearchBody {
  search?: string;
  categoryId?: string;
  categoryIds?: string[];
  typeId?: string;
  brand?: string;
  status?: string;
  attributes?: Record<string, string[]>;
  priceMin?: number;
  priceMax?: number;
  inStockOnly?: boolean;
  priceListId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  facets?: boolean;
  /** Opt in to soft-deleted rows — for the restore view only. */
  includeDeleted?: boolean;
}

export interface CatalogSearchResult {
  data: CatalogProduct[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets?: Facet[];
}

export interface MatrixItem {
  attributes: AttributeValue[];
  sku: string;
  optionLabel: string;
  valueLabel: string;
}

export interface MatrixResult {
  count: number;
  axes: { key: string; label: string; options: string[] }[];
  items: MatrixItem[];
}

/* ------------------------------------------------------------ write bodies */

export interface ItemInput {
  /** Only on an update — ignored on a create. */
  id?: string;
  sku?: string;
  attributes?: AttributeValue[];
  description?: string;
  image?: string;
  media?: MediaAsset[];
  status?: LifecycleStatus;
  /* Convenience fields that write the price and availability records. Leave
     them out entirely to write nothing — that is what keeps "not priced yet"
     distinct from "priced at zero". */
  price?: number;
  currency?: string;
  stock?: number;
  locationId?: string;
  leadDays?: number;
}

export interface ProductInput {
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  typeId?: string;
  categoryIds?: string[];
  attributes?: AttributeValue[];
  status?: LifecycleStatus;
  /** Derived from the thumbnail. Read-only — set it through `media`. */
  image?: string;
  media?: MediaAsset[];
  items?: ItemInput[];
}

/* ------------------------------------------------------------- vocabulary */

export const PRICING_MODELS: { value: PricingModel; label: string; hint: string }[] = [
  { value: 'fixed', label: 'Fixed price', hint: 'One price per item' },
  { value: 'per_unit', label: 'Per unit', hint: 'Price x quantity — needs a unit' },
  { value: 'per_time', label: 'Per time', hint: 'Price x duration — per night, per hour' },
  { value: 'per_variant', label: 'Per variant', hint: 'A different price per combination' },
  { value: 'tiered', label: 'Tiered', hint: 'Price bands by quantity' },
  { value: 'on_request', label: 'On request', hint: 'No published price — an enquiry' },
  { value: 'free', label: 'Free', hint: 'No charge' },
];

export const AVAILABILITY_MODELS: { value: AvailabilityModel; label: string; hint: string }[] = [
  { value: 'quantity', label: 'Quantity', hint: 'Units that deplete' },
  { value: 'time_slot', label: 'Time slots', hint: 'A calendar — needs a slot length' },
  { value: 'capacity_per_date', label: 'Capacity per date', hint: 'N available on a given day' },
  { value: 'unlimited', label: 'Unlimited', hint: 'Never runs out' },
  { value: 'lead_time', label: 'Lead time', hint: 'A wait, not a count' },
  { value: 'none', label: 'Not tracked', hint: 'Availability is not managed here' },
];

export const FIELD_TYPES: { value: FieldType; label: string; hint: string }[] = [
  { value: 'text', label: 'Text', hint: 'Free text' },
  { value: 'number', label: 'Number', hint: 'Numeric' },
  { value: 'choice', label: 'Choice', hint: 'A fixed list — the only type that can form variants' },
  { value: 'boolean', label: 'Yes / No', hint: 'True or false' },
];

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export const DAY_LABELS: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};
