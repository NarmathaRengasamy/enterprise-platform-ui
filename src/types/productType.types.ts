/** Business Category → Product Type (design §5, §6.2). Mirrors the API; snake_case. */

export type FieldType = 'enum' | 'number' | 'boolean' | 'date' | 'text' | 'translated_text';
/** Number fields only: makes the field usable as a measured-size variant option (R45). */
export type UnitFamily = 'weight' | 'volume' | 'length' | 'count';

/** Same units as the server (utils/units.util.ts); the first is the base unit. */
export const UNITS_BY_FAMILY: Record<UnitFamily, string[]> = {
  weight: ['g', 'kg'],
  volume: ['ml', 'l'],
  length: ['cm', 'm'],
  count: ['piece'],
};

export const UNIT_FAMILY_LABELS: Record<UnitFamily, string> = {
  weight: 'Weight',
  volume: 'Volume',
  length: 'Length',
  count: 'Count',
};
export type Language = 'en' | 'ta' | 'hi';

export interface Translated {
  en: string;
  ta?: string;
  hi?: string;
}

export interface FieldOption {
  value: string;
  label: Translated;
  deprecated: boolean;
}

export interface FieldDefinition {
  key: string;
  label: Translated;
  type: FieldType;
  unit?: string;
  unit_family?: UnitFamily;
  min?: number;
  max?: number;
  options: FieldOption[];
  variant_forming: boolean;
  filterable: boolean;
  required: boolean;
  group?: string;
  sort_order: number;
  source: 'template' | 'custom';
  deprecated: boolean;
  added_in_version: number;
}

export interface ProductType {
  id: string;
  code: string;
  name: Translated;
  template_code: string;
  template_version: number;
  type_version: number;
  fulfilment: 'goods' | 'service' | 'rental' | 'digital';
  tracking: 'none' | 'batch' | 'serial';
  fields: FieldDefinition[];
  template_update_available: boolean;
  updated_at?: string;
}

export interface BusinessTemplateSummary {
  code: string;
  version: number;
  name: Translated;
  default_fulfilment: string;
  default_tracking: string;
  field_count: number;
  fields: { key: string; label: Translated; type: FieldType; unit?: string; variant_forming: boolean }[];
  starter_category_count: number;
}

export interface BusinessSettings {
  business_category: string | null;
  /** Flat by default; "tree" switches the category tree on (Phase 2). */
  category_mode: 'flat' | 'tree';
  active_product_type_id: string | null;
  timezone: string;
  default_currency: string;
  languages: Language[];
}

export interface BusinessSettingsInput {
  business_category: string;
  timezone?: string;
  default_currency?: string;
  languages?: Language[];
  create_starter_categories?: boolean;
  category_mode?: 'flat' | 'tree';
}

export interface OptionInput {
  value?: string;
  label: Translated;
  deprecated?: boolean;
}

export interface FieldInput {
  label: Translated;
  type: FieldType;
  unit?: string;
  /** The unit, when set, must belong to it (422 otherwise). */
  unit_family?: UnitFamily;
  min?: number;
  max?: number;
  options?: OptionInput[];
  variant_forming?: boolean;
  filterable?: boolean;
  required?: boolean;
  group?: string;
}

export type FieldPatch = Partial<Omit<FieldInput, 'unit' | 'unit_family' | 'min' | 'max' | 'group'>> & {
  unit?: string | null;
  /** null clears it; 409 while a product builds its variants from the field. */
  unit_family?: UnitFamily | null;
  min?: number | null;
  max?: number | null;
  group?: string | null;
  sort_order?: number;
  deprecated?: boolean;
};

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  enum: 'Choice list',
  number: 'Number',
  boolean: 'Yes / No',
  date: 'Date',
  text: 'Text',
  translated_text: 'Text (translated)',
};

export const LANGUAGE_LABELS: Record<Language, string> = { en: 'English', ta: 'Tamil', hi: 'Hindi' };
