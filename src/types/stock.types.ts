/**
 * Phase 4 — stock, serial / batch units and bundle components of the new
 * product items (design §3.5, §7.7). Mirrors /api/v2/items/… and /api/v2/units/…;
 * snake_case.
 */

import type { Availability } from './productV2.types';

export type ItemKind = 'item' | 'pack' | 'bundle';
export type UnitStatus = 'in_stock' | 'sold' | 'returned';
export type MovementSource = 'adjust' | 'initial' | 'opening' | 'unit' | 'sale';

export interface StockRow {
  location_id: string;
  on_hand: number;
  reserved: number;
  available: number;
  reorder_point: number;
}

/** GET /items/:id/stock */
export interface ItemStock {
  item_id: string;
  sku: string;
  product_id: string;
  /** A pack's stock is its base's; a bundle's is its components'. */
  kind: ItemKind;
  track_inventory: boolean;
  tracking: 'none' | 'batch' | 'serial';
  /** False for packs, bundles, untracked items and serial-tracked items (units drive their stock). */
  can_adjust: boolean;
  /** Why it cannot be adjusted, when it cannot. */
  adjust_note: string | null;
  pack_of?: { base_item_id: string; quantity: number; base_sku: string | null };
  rows: StockRow[];
  availability: Availability;
}

export interface StockAdjustInput {
  /** Whole number, not 0: + received, − taken out. */
  delta: number;
  /** 1–200 characters. */
  reason: string;
  location_id?: string;
}

export interface StockMovement {
  id: string;
  item_id: string;
  location_id: string;
  delta: number;
  reason: string;
  on_hand_after: number;
  source: MovementSource;
  created_at: string;
  created_by: string;
}

export interface StockMovementPage {
  items: StockMovement[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ItemUnit {
  id: string;
  item_id: string;
  serial_no: string | null;
  batch_no: string | null;
  location_id: string;
  status: UnitStatus;
  created_at?: string;
  created_by?: string;
}

/** GET /items/:id/units */
export interface ItemUnits {
  item_id: string;
  sku: string;
  tracking: 'serial' | 'batch';
  units: ItemUnit[];
}

export interface UnitInput {
  serial_no?: string | null;
  batch_no?: string | null;
  location_id?: string;
}

export interface BundleComponent {
  component_item_id: string;
  quantity: number;
  sku: string | null;
  product_id: string | null;
  product_name: string | null;
  availability: Availability | null;
}

/** GET / PUT /items/:id/bundle-components */
export interface BundleComponents {
  bundle_item_id: string;
  sku: string;
  is_bundle: boolean;
  components: BundleComponent[];
  availability: Availability | null;
}

/** in_stock → sold → returned → in_stock (anything else is refused, 422). */
export const NEXT_UNIT_STATUS: Record<UnitStatus, UnitStatus> = { in_stock: 'sold', sold: 'returned', returned: 'in_stock' };

export const UNIT_STATUS_LABELS: Record<UnitStatus, string> = { in_stock: 'In stock', sold: 'Sold', returned: 'Returned' };
