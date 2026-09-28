import { assetUrl, client } from './client';
import {
  AvailabilityState,
  CatalogAvailabilityRow,
  CatalogBooking,
  CatalogCategory,
  CatalogCharge,
  CatalogItem,
  CatalogPrice,
  CatalogProduct,
  CatalogSearchBody,
  CatalogSearchResult,
  CategoryNode,
  ChargeBreakdown,
  FieldDefinition,
  ItemInput,
  MatrixResult,
  MediaAsset,
  MediaConfig,
  VocabularyEntry,
  ProductInput,
  ProductType,
  SlotDay,
} from '../types/catalog.types';

export * from '../types/catalog.types';

/**
 * Catalogue v2 API.
 *
 * Everything lives under `/v2`, which is mounted inside the same authenticated
 * router as v1 — so the existing token handling in `client` applies unchanged.
 *
 * Two rules hold across every call and are not repeated per method:
 *   - `id` is a server-minted UUID. Never send one on a create; it is ignored.
 *   - Deletes are soft. The row is flagged, keeps its id, and can be restored.
 */

const BASE = '/v2';

/* ================================================================= types */

export const typeService = {
  async list(includeDeleted = false): Promise<ProductType[]> {
    const res = await client.get<ProductType[]>(`${BASE}/types`, {
      params: { limit: 100, ...(includeDeleted ? { includeDeleted: true } : {}) },
    });
    return res.data ?? [];
  },

  async get(id: string): Promise<ProductType> {
    const res = await client.get<ProductType>(`${BASE}/types/${id}`);
    return res.data;
  },

  /**
   * Values already in use for this type's open choice fields.
   *
   * Suggestions for the form, not a constraint — an open field accepts
   * anything. A type with no open fields returns an empty object.
   */
  async vocabulary(id: string): Promise<Record<string, VocabularyEntry[]>> {
    const res = await client.get<Record<string, VocabularyEntry[]>>(
      `${BASE}/types/${id}/vocabulary`
    );
    return res.data ?? {};
  },

  async create(body: {
    name: string;
    description?: string;
    fields?: Partial<FieldDefinition>[];
    media?: MediaConfig;
  }) {
    const res = await client.post<ProductType>(`${BASE}/types`, body);
    return res.data;
  },

  async update(id: string, body: { name?: string; description?: string; media?: MediaConfig }) {
    const res = await client.patch<ProductType>(`${BASE}/types/${id}`, body);
    return res.data;
  },

  async remove(id: string): Promise<ProductType> {
    const res = await client.delete<ProductType>(`${BASE}/types/${id}`);
    return res.data;
  },

  async restore(id: string): Promise<ProductType> {
    const res = await client.post<ProductType>(`${BASE}/types/${id}/restore`);
    return res.data;
  },

  async addField(typeId: string, field: Partial<FieldDefinition>) {
    const res = await client.post<ProductType>(`${BASE}/types/${typeId}/fields`, field);
    return res.data;
  },

  async updateField(typeId: string, key: string, patch: Partial<FieldDefinition>) {
    const res = await client.patch<ProductType>(`${BASE}/types/${typeId}/fields/${key}`, patch);
    return res.data;
  },

  /**
   * Removes a field — which usually means deprecating it.
   *
   * The server hard-removes only a field nothing has ever used, and says which
   * happened in `message`. That distinction is worth surfacing, so it is
   * returned rather than swallowed.
   */
  async removeField(typeId: string, key: string): Promise<{ type: ProductType; message: string }> {
    const res = await client.delete<ProductType>(`${BASE}/types/${typeId}/fields/${key}`);
    return { type: res.data, message: res.message ?? '' };
  },
};

/* ============================================================ categories */

export const catalogCategoryService = {
  async list(includeDeleted = false): Promise<CatalogCategory[]> {
    const res = await client.get<CatalogCategory[]>(`${BASE}/categories`, {
      params: includeDeleted ? { includeDeleted: true } : undefined,
    });
    return res.data ?? [];
  },

  async tree(): Promise<CategoryNode[]> {
    const res = await client.get<CategoryNode[]>(`${BASE}/categories`, { params: { tree: true } });
    return res.data ?? [];
  },

  async get(id: string): Promise<CatalogCategory> {
    const res = await client.get<CatalogCategory>(`${BASE}/categories/${id}`);
    return res.data;
  },

  async create(body: Partial<CatalogCategory>) {
    const res = await client.post<CatalogCategory>(`${BASE}/categories`, body);
    return res.data;
  },

  async update(id: string, body: Partial<CatalogCategory>) {
    const res = await client.patch<CatalogCategory>(`${BASE}/categories/${id}`, body);
    return res.data;
  },

  async remove(id: string) {
    const res = await client.delete<CatalogCategory>(`${BASE}/categories/${id}`);
    return res.data;
  },

  async restore(id: string): Promise<{ category: CatalogCategory; message: string }> {
    const res = await client.post<CatalogCategory>(`${BASE}/categories/${id}/restore`);
    /* The message matters here: a restore whose parent is still deleted
       succeeds but leaves the row detached, and says so. */
    return { category: res.data, message: res.message ?? '' };
  },
};

/* ============================================================== products */

export const catalogProductService = {
  /** POST search: nestable filters plus the facet sidebar. */
  async search(body: CatalogSearchBody): Promise<CatalogSearchResult> {
    const res = await client.post<CatalogProduct[]>(`${BASE}/products/search`, body);
    return {
      data: res.data ?? [],
      total: res.total ?? 0,
      page: res.page ?? 1,
      limit: res.limit ?? 20,
      totalPages: res.totalPages ?? 1,
      facets: (res as any).facets,
    };
  },

  async get(id: string, priceListId?: string): Promise<CatalogProduct> {
    const res = await client.get<CatalogProduct>(`${BASE}/products/${id}`, {
      params: priceListId ? { priceListId } : undefined,
    });
    return res.data;
  },

  async create(body: ProductInput) {
    const res = await client.post<CatalogProduct>(`${BASE}/products`, body);
    return res.data;
  },

  async update(id: string, body: Partial<ProductInput>) {
    const res = await client.patch<CatalogProduct>(`${BASE}/products/${id}`, body);
    return res.data;
  },

  async remove(id: string) {
    const res = await client.delete<CatalogProduct>(`${BASE}/products/${id}`);
    return res.data;
  },

  async restore(id: string) {
    const res = await client.post<CatalogProduct>(`${BASE}/products/${id}/restore`);
    return res.data;
  },

  /**
   * Previews the combination grid. Saves nothing.
   *
   * Offered rather than imposed — a dealership does not stock every trim in
   * every colour, so the user prunes the result before it is posted.
   */
  async matrix(typeId: string, selection: Record<string, string[]>, sku?: string): Promise<MatrixResult> {
    const res = await client.post<MatrixResult>(`${BASE}/products/matrix`, { typeId, selection, sku });
    return res.data;
  },

  async listItems(productId: string): Promise<CatalogItem[]> {
    const res = await client.get<CatalogItem[]>(`${BASE}/products/${productId}/items`);
    return res.data ?? [];
  },

  async addItem(productId: string, item: ItemInput) {
    const res = await client.post<CatalogItem>(`${BASE}/products/${productId}/items`, item);
    return res.data;
  },

  async updateItem(productId: string, itemId: string, item: ItemInput) {
    const res = await client.patch<CatalogItem>(`${BASE}/products/${productId}/items/${itemId}`, item);
    return res.data;
  },

  async removeItem(productId: string, itemId: string) {
    const res = await client.delete<CatalogItem>(`${BASE}/products/${productId}/items/${itemId}`);
    return res.data;
  },
};

/* ================================================================ prices */

export const priceService = {
  async list(params: {
    itemId?: string;
    priceListId?: string;
    includeDeleted?: boolean;
  }): Promise<CatalogPrice[]> {
    const res = await client.get<CatalogPrice[]>(`${BASE}/prices`, { params });
    return res.data ?? [];
  },

  async create(body: Partial<CatalogPrice>) {
    const res = await client.post<CatalogPrice>(`${BASE}/prices`, body);
    return res.data;
  },

  async update(id: string, body: Partial<CatalogPrice>) {
    const res = await client.patch<CatalogPrice>(`${BASE}/prices/${id}`, body);
    return res.data;
  },

  async remove(id: string) {
    const res = await client.delete<CatalogPrice>(`${BASE}/prices/${id}`);
    return res.data;
  },

  async restore(id: string) {
    const res = await client.post<CatalogPrice>(`${BASE}/prices/${id}/restore`);
    return res.data;
  },
};

/* =============================================================== charges */

export const chargeService = {
  async list(scope?: string, refId?: string, includeDeleted = false): Promise<CatalogCharge[]> {
    const res = await client.get<CatalogCharge[]>(`${BASE}/charges`, {
      params: { scope, refId, ...(includeDeleted ? { includeDeleted: true } : {}) },
    });
    return res.data ?? [];
  },

  async create(body: Partial<CatalogCharge>) {
    const res = await client.post<CatalogCharge>(`${BASE}/charges`, body);
    return res.data;
  },

  async update(id: string, body: Partial<CatalogCharge>) {
    const res = await client.patch<CatalogCharge>(`${BASE}/charges/${id}`, body);
    return res.data;
  },

  async remove(id: string) {
    const res = await client.delete<CatalogCharge>(`${BASE}/charges/${id}`);
    return res.data;
  },

  async restore(id: string) {
    const res = await client.post<CatalogCharge>(`${BASE}/charges/${id}/restore`);
    return res.data;
  },

  /** The resolved money picture for one item: base, required, optional. */
  async resolve(
    itemId: string,
    params: { priceListId?: string; at?: string; quantity?: number; units?: number } = {}
  ): Promise<ChargeBreakdown> {
    const res = await client.get<ChargeBreakdown>(`${BASE}/items/${itemId}/charges`, { params });
    return res.data;
  },
};

/* ========================================================== availability */

export const availabilityService = {
  async list(params: {
    itemId?: string;
    locationId?: string;
    date?: string;
    includeDeleted?: boolean;
  }): Promise<CatalogAvailabilityRow[]> {
    const res = await client.get<CatalogAvailabilityRow[]>(`${BASE}/availability`, { params });
    return res.data ?? [];
  },

  async upsert(body: Partial<CatalogAvailabilityRow>) {
    const res = await client.post<CatalogAvailabilityRow>(`${BASE}/availability`, body);
    return res.data;
  },

  async remove(id: string) {
    const res = await client.delete<CatalogAvailabilityRow>(`${BASE}/availability/${id}`);
    return res.data;
  },

  async restore(id: string) {
    const res = await client.post<CatalogAvailabilityRow>(`${BASE}/availability/${id}/restore`);
    return res.data;
  },

  /**
   * Moves stock by a signed delta.
   *
   * A delta rather than an absolute figure because two concurrent sales that
   * each read 10 and write 9 lose a unit. An oversell comes back as a 409 with
   * the real count in the message.
   */
  async adjust(itemId: string, delta: number, locationId?: string) {
    const res = await client.post<CatalogAvailabilityRow>(`${BASE}/availability/adjust`, {
      itemId,
      delta,
      ...(locationId ? { locationId } : {}),
    });
    return res.data;
  },

  async resolve(itemId: string, params: { locationId?: string; date?: string } = {}): Promise<AvailabilityState> {
    const res = await client.get<AvailabilityState>(`${BASE}/items/${itemId}/availability`, { params });
    return res.data;
  },

  async slots(
    itemId: string,
    date: string,
    params: { locationId?: string; inchargeId?: string; resourceId?: string; availableOnly?: boolean } = {}
  ): Promise<SlotDay> {
    const res = await client.get<SlotDay>(`${BASE}/items/${itemId}/slots`, { params: { date, ...params } });
    return res.data;
  },
};

/* ============================================================== bookings */

export const bookingService = {
  async list(params: {
    itemId?: string;
    inchargeId?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    includeDeleted?: boolean;
  }): Promise<{ data: CatalogBooking[]; total: number; totalPages: number; page: number }> {
    const res = await client.get<CatalogBooking[]>(`${BASE}/bookings`, { params });
    return {
      data: res.data ?? [],
      total: res.total ?? 0,
      totalPages: res.totalPages ?? 1,
      page: res.page ?? 1,
    };
  },

  async create(body: Partial<CatalogBooking>) {
    const res = await client.post<CatalogBooking>(`${BASE}/bookings`, body);
    return res.data;
  },

  /** Cancelled, not deleted — the slot frees up and the record survives. */
  async cancel(id: string) {
    const res = await client.post<CatalogBooking>(`${BASE}/bookings/${id}/cancel`);
    return res.data;
  },

  /** Reschedule or amend. A time change re-runs the overlap check. */
  async update(id: string, body: Partial<CatalogBooking>) {
    const res = await client.patch<CatalogBooking>(`${BASE}/bookings/${id}`, body);
    return res.data;
  },

  /**
   * Removes the booking from the list.
   *
   * Different from cancelling: a cancellation is a record of something called
   * off, a delete is for a mistake nobody needs to see. Both free the slot.
   */
  async remove(id: string) {
    const res = await client.delete<CatalogBooking>(`${BASE}/bookings/${id}`);
    return res.data;
  },

  async restore(id: string) {
    const res = await client.post<CatalogBooking>(`${BASE}/bookings/${id}/restore`);
    return res.data;
  },
};

/* ================================================================= media */

/**
 * Uploads for product pictures and videos.
 *
 * Uploading and attaching are deliberately two steps. A file goes to the
 * server as soon as it is picked, but it belongs to nothing until the product
 * is saved with it in `media` — so a form the user abandons leaves a loose
 * file, never a half-edited product. The reverse holds on save: an asset
 * dropped from the list has its file deleted by the server.
 */
export const mediaService = {
  /** Sends files and gets back asset records ready to put in `media`. */
  async upload(files: File[]): Promise<MediaAsset[]> {
    const form = new FormData();
    for (const file of files) form.append('files', file);

    const res = await client.post<MediaAsset[]>(`${BASE}/media`, form);
    return (res.data ?? []).map((asset) => ({ ...asset, source: 'upload' as const }));
  },

  /**
   * Deletes a file nothing points at.
   *
   * Only for cleaning up an upload that was never attached — the server
   * refuses a file that is still on a product, because removing it there
   * already deletes it.
   */
  async remove(filename: string): Promise<void> {
    await client.delete(`${BASE}/media/${filename}`);
  },
};

/**
 * Turns a stored media URL into one the browser can load.
 *
 * Files are served by the API server, which in development is a different
 * origin from this app — so a bare `/uploads/...` in an `img` tag would ask
 * Vite for a file it does not have.
 */
export const mediaUrl = (url?: string): string | undefined => assetUrl(url);

/** The picture to show for a product or variant in a list. */
export const thumbnailOf = (entity: { image?: string; media?: MediaAsset[] }): string | undefined =>
  mediaUrl(entity.image ?? entity.media?.find((a) => a.kind === 'image' && a.isThumbnail)?.url);

/** Drops the counts, for the places that only need spellings to suggest. */
export const vocabularyValues = (
  vocabulary: Record<string, VocabularyEntry[]>
): Record<string, string[]> =>
  Object.fromEntries(
    Object.entries(vocabulary).map(([key, entries]) => [key, entries.map((e) => e.value)])
  );

export const catalogService = {
  types: typeService,
  categories: catalogCategoryService,
  products: catalogProductService,
  prices: priceService,
  charges: chargeService,
  availability: availabilityService,
  bookings: bookingService,
  media: mediaService,
};

export default catalogService;
