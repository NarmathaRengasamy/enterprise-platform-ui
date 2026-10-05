import { client } from './client';
import {
  BusinessSettings,
  BusinessSettingsInput,
  BusinessTemplateSummary,
  FieldInput,
  FieldPatch,
  OptionInput,
  ProductType,
} from '../types/productType.types';

/** Server answers carry an optional `notice` (e.g. "saved as optional") worth showing. */
export interface WithNotice<T> {
  data: T;
  notice?: string;
}

const need = <T>(value: T | undefined, what: string): T => {
  if (value === undefined) throw new Error(`The server did not return the ${what}`);
  return value;
};

export const businessService = {
  async templates(): Promise<BusinessTemplateSummary[]> {
    return need((await client.get<BusinessTemplateSummary[]>('/business-templates')).data, 'templates');
  },

  async get(): Promise<BusinessSettings> {
    return need((await client.get<BusinessSettings>('/settings/business')).data, 'business settings');
  },

  async save(
    input: BusinessSettingsInput
  ): Promise<
    WithNotice<{
      settings: BusinessSettings;
      product_type: ProductType;
      outcome: string;
      /** Only when starter categories were asked for. */
      starter_categories?: { created: string[]; skipped: string[] };
    }>
  > {
    const res = await client.put<any>('/settings/business', input);
    const data = need(res.data, 'business settings');
    return { data, notice: data.notice };
  },
};

export const productTypeService = {
  /** `null` until a business category has been chosen. */
  async get(): Promise<ProductType | null> {
    return (await client.get<ProductType | null>('/product-type')).data ?? null;
  },

  async addField(input: FieldInput): Promise<WithNotice<ProductType>> {
    const data = need((await client.post<any>('/product-type/fields', input)).data, 'product type');
    return { data: data.product_type, notice: data.notice };
  },

  async updateField(key: string, patch: FieldPatch): Promise<WithNotice<ProductType>> {
    const data = need(
      (await client.patch<any>(`/product-type/fields/${encodeURIComponent(key)}`, patch)).data,
      'product type'
    );
    return { data: data.product_type, notice: data.notice };
  },

  /**
   * Adds options to a choice attribute from the product form (Editor / Admin).
   *
   * Add-only and shared: the option becomes available to every product. A
   * near-duplicate ("Rde" vs "Red") comes back in `warnings` with nothing saved;
   * call again with `confirm = true` to add it anyway.
   */
  async addOptions(
    key: string,
    options: (string | OptionInput)[],
    confirm = false
  ): Promise<{
    data: ProductType;
    added: string[];
    existing: string[];
    warnings: { value: string; label: string; similar_to: string }[];
    message?: string;
  }> {
    const res = await client.post<any>(`/product-type/fields/${encodeURIComponent(key)}/options`, {
      options,
      ...(confirm ? { confirm: true } : {}),
    });
    const data = need(res.data, 'product type');
    return { data: data.product_type, added: data.added, existing: data.existing, warnings: data.warnings, message: res.message };
  },

  async deleteField(key: string): Promise<ProductType> {
    const data = need((await client.delete<any>(`/product-type/fields/${encodeURIComponent(key)}`)).data, 'product type');
    return data.product_type;
  },

  async reorder(keys: string[]): Promise<ProductType> {
    return need((await client.post<any>('/product-type/fields/reorder', { keys })).data, 'product type').product_type;
  },

  async upgrade(): Promise<WithNotice<ProductType>> {
    const res = await client.post<any>('/product-type/upgrade');
    const data = need(res.data, 'product type');
    return { data: data.product_type, notice: res.message };
  },
};
