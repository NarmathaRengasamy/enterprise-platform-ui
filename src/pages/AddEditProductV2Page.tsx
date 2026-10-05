import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLabels } from '../context/SiteSettingsContext';
import { Button, Icon, Toast, ToastMessage } from '../components/common';
import { MediaUploader } from '../components/common/MediaUploader';
import { checkMediaFile, mediaService } from '../services/media.service';
import { productV2Service } from '../services/productV2.service';
import { businessService, productTypeService } from '../services/productType.service';
import { catalogCategoryService } from '../services/catalogCategory.service';
import type { CategoryNode } from '../types/catalogCategory.types';
import type { FieldDefinition, FieldType, ProductType } from '../types/productType.types';
import { FIELD_TYPE_LABELS, UNITS_BY_FAMILY } from '../types/productType.types';
import {
  AnyVariantAxis,
  AttributeValue,
  AttributeValueType,
  Fulfilment,
  isMeasuredAxis,
  LimitWindow,
  limitsSummaryText,
  Measure,
  MeasuredVariantAxis,
  measureBase,
  measureText,
  pricePerUnitOf,
  PurchaseLimits,
  PurchaseLimitsInput,
  FULFILMENT_LABELS,
  GST_RATES,
  ItemInput,
  ItemPatch,
  Media,
  PriceUnit,
  ProductInput,
  ProductV2,
  ProductItem,
  Tracking,
  TRACKING_LABELS,
  VariantAxis,
  VariantCombination,
} from '../types/productV2.types';
import { formatMoney, fromMinor, toMinor } from '../utils/money';
import { resolveAssetUrl } from '../utils/assetUrl';

/**
 * Add / edit a new product (Phase 3, design §8 screen 5) on one page, laid out
 * in two columns (UI trial): the sections as cards on the left; the product
 * images and the summary in a sidebar that stays in view on the right.
 * Cancel / Save draft / Publish sit in the page header.
 *
 * Only the new models are used: categories from /catalog-categories (flat or
 * tree), attributes from the library (R40, R42). Fulfilment / Track inventory
 * / Tracking are pre-filled from the product type (R13a–R13c) and remembered
 * for the session (K6a). Prices are typed in ₹ and sent as paise. Editing
 * changes items by id — never regenerated (R21) — and never sends stock.
 */

const inputClass =
  'w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high ' +
  'focus:outline-none focus:border-primary text-sm disabled:opacity-50';
const smallInput =
  'w-full h-9 px-2 rounded-lg bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-sm';
const labelClass = 'font-label-md text-label-md text-on-surface font-medium';
const card = 'bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-low/60 p-space-md flex flex-col gap-4';

const sectionId = (name: string) => `section-${name.toLowerCase().replace(/\s+/g, '-')}`;
/** Scrolls a section (or the problems list) into view; a no-op where scrolling is unavailable (tests). */
const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
const SESSION_KEY = 'v2_product_last_settings';
const PRICE_UNITS: PriceUnit[] = ['each', 'hour', 'day', 'month'];
const ITEMS_VIEW_KEY = 'v2_items_view';

const serverText = (e: any): string =>
  (e?.fieldErrors && Object.values(e.fieldErrors).join(' · ')) || e?.message || 'Something went wrong';

/* -------------------------------------------------------------- helpers */

/** Paise → the text a price input shows ("154999950" → "1549999.50"). */
export const rupeesText = (minor: number | null | undefined): string => {
  const major = fromMinor(minor ?? null);
  if (major === null) return '';
  return minor! % 100 === 0 ? String(major) : major.toFixed(2);
};

/** "₹1,49,999.50" as typed → paise; '' → null; anything else an error message. */
export const parseRupees = (text: string): { minor: number | null } | { error: string } => {
  const t = text.trim().replace(/[₹,\s]/g, '');
  if (!t) return { minor: null };
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return { error: 'Enter ₹ as a positive amount with at most 2 decimals' };
  return { minor: toMinor(t) };
};

const slugify = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);

const signature = (attrs: AttributeValue[]) =>
  [...attrs]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((a) => `${a.key}=${String(a.value)}`)
    .join('|');

const readSession = (): { fulfilment?: Fulfilment; tracking?: Tracking } => {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}');
  } catch {
    return {};
  }
};
const writeSession = (v: { fulfilment: Fulfilment; tracking: Tracking }) => {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(v));
  } catch {
    /* private mode: nothing to remember */
  }
};

const flatten = (nodes: CategoryNode[], depth = 0): { node: CategoryNode; depth: number }[] =>
  nodes.filter((n) => !n.is_deleted).flatMap((n) => [{ node: n, depth }, ...flatten(n.children, depth + 1)]);

const isEmpty = (v: unknown) =>
  v === undefined || v === null || v === '' || (typeof v === 'object' && !(v as any).en?.trim?.());

/** A card heading: an icon beside the section title (layout only — the titles are the form's own). */
const CardTitle: React.FC<{ icon: string; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
      <Icon name={icon} size="md" />
    </div>
    <h2 className="font-title-md text-title-md font-semibold text-on-surface">{title}</h2>
  </div>
);

/* ------------------------------------------------------- purchase limits */

type LimitKey = 'min' | 'max' | LimitWindow;
/** The limit inputs as typed; '' = no limit (product) or the product's value (item). */
type LimitsText = Record<LimitKey, string>;

const LIMIT_FIELDS: { key: LimitKey; label: string }[] = [
  { key: 'min', label: 'Min per order' },
  { key: 'max', label: 'Max per order' },
  { key: 'day', label: '24 hours' },
  { key: 'week', label: '7 days' },
  { key: 'month', label: '30 days' },
  { key: 'year', label: '1 year' },
  { key: 'lifetime', label: 'Ever' },
];

const blankLimits = (): LimitsText => ({ min: '', max: '', day: '', week: '', month: '', year: '', lifetime: '' });

const limitsText = (l?: PurchaseLimits | PurchaseLimitsInput | null): LimitsText => {
  const t = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
  return {
    min: t(l?.min_per_order),
    max: t(l?.max_per_order),
    day: t(l?.per_customer?.day),
    week: t(l?.per_customer?.week),
    month: t(l?.per_customer?.month),
    year: t(l?.per_customer?.year),
    lifetime: t(l?.per_customer?.lifetime),
  };
};

/** What is sent: numbers or null; all empty → null (no limits / no override). */
const limitsInput = (t: LimitsText): PurchaseLimitsInput | null => {
  const n = (s: string) => (s.trim() === '' ? null : Number(s.trim()));
  const out = {
    min_per_order: n(t.min),
    max_per_order: n(t.max),
    per_customer: { day: n(t.day), week: n(t.week), month: n(t.month), year: n(t.year), lifetime: n(t.lifetime) },
  };
  const any = [out.min_per_order, out.max_per_order, ...Object.values(out.per_customer)].some((v) => v !== null);
  return any ? out : null;
};

/** Whole numbers of 1 or more; the order rules (R51) are the server's (422 with the reason). */
const limitsProblems = (t: LimitsText, who: string): string[] =>
  LIMIT_FIELDS.filter((f) => t[f.key].trim() && !/^[1-9]\d*$/.test(t[f.key].trim())).map(
    (f) => `${who}purchase limit “${f.label}” must be a whole number of 1 or more`
  );

/**
 * Min / max per order. Per-customer windows (24 h · 7 d · 30 d · 1 y · ever)
 * are not edited on the form (Oct 2026); values already stored stay in
 * `value` untouched and are sent back as they were.
 */
const LimitsFields: React.FC<{
  value: LimitsText;
  onChange: (next: LimitsText) => void;
  name: string;
  /** For an item: what the product says, shown where the item has no value of its own. */
  inherited?: LimitsText;
  disabled?: boolean;
}> = ({ value, onChange, name, inherited, disabled }) => {
  const box = (f: { key: LimitKey; label: string }) => (
    <div key={f.key} className="flex flex-col gap-1">
      <label className="text-xs font-medium text-on-surface-variant">{f.label}</label>
      <input
        aria-label={`${name} ${f.label}`}
        inputMode="numeric"
        className={`${smallInput} ${value[f.key].trim() && !/^[1-9]\d*$/.test(value[f.key].trim()) ? 'border-error' : ''}`}
        placeholder={inherited ? (inherited[f.key] ? `Same (${inherited[f.key]})` : 'Same') : 'No limit'}
        value={value[f.key]}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
      />
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[10.5px] font-bold text-outline uppercase tracking-wider mb-1">Per order</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{LIMIT_FIELDS.slice(0, 2).map(box)}</div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ item rows */

interface ItemRow {
  rowId: string;
  /** Set for an item that already exists (edit): it is changed by id. */
  id?: string;
  sku: string;
  attributes: AttributeValue[];
  price: string;
  mrp: string;
  taxInclusive: boolean;
  priceUnit: PriceUnit;
  gst: string; // '' = same as the product
  hsn: string;
  track: 'same' | 'on' | 'off';
  stock: string;
  status: 'active' | 'inactive';
  media: Media[];
  /** This item's own purchase limits; '' = the product's value. */
  limits: LimitsText;
  /** A pack (R47): quantity × a base item of this product — by id once saved, by row before. */
  pack?: { baseItemId?: string; baseRowId?: string; quantity: number };
  limitsOpen?: boolean;
  /** Existing item marked for deletion (Admin) or a deleted item offered for restore. */
  remove?: boolean;
  deleted?: boolean;
  original?: ProductItem;
}

let rowSeq = 0;
const newRow = (over: Partial<ItemRow> = {}, taxInclusive = true): ItemRow => ({
  rowId: `row-${++rowSeq}`,
  sku: '',
  attributes: [],
  price: '',
  mrp: '',
  taxInclusive,
  priceUnit: 'each',
  gst: '',
  hsn: '',
  track: 'same',
  stock: '',
  status: 'active',
  media: [],
  limits: blankLimits(),
  ...over,
});

const rowFromItem = (i: ProductItem, deleted = false): ItemRow =>
  newRow({
    id: i.id,
    sku: i.sku,
    attributes: i.attributes,
    price: rupeesText(i.price?.amount_minor ?? null),
    mrp: rupeesText(i.compare_at_minor),
    taxInclusive: i.price?.tax_inclusive ?? true,
    priceUnit: i.price?.price_unit ?? 'each',
    gst: i.gst_rate === null ? '' : String(i.gst_rate),
    hsn: i.hsn_code ?? '',
    track: i.track_inventory === null ? 'same' : i.track_inventory ? 'on' : 'off',
    status: i.status,
    media: i.media ?? [],
    limits: limitsText(i.purchase_limits),
    limitsOpen: Boolean(limitsInput(limitsText(i.purchase_limits))),
    pack: i.pack_of ? { baseItemId: i.pack_of.base_item_id, quantity: i.pack_of.quantity } : undefined,
    deleted,
    original: i,
  });

/* --------------------------------------------------- one attribute input */

const AttributeInput: React.FC<{
  field: FieldDefinition;
  value: AttributeValueType | undefined;
  onChange: (v: AttributeValueType | undefined) => void;
  disabled?: boolean;
}> = ({ field: f, value, onChange, disabled }) => {
  const name = f.label.en;
  switch (f.type as FieldType) {
    case 'enum':
      return (
        <select aria-label={name} className={inputClass} disabled={disabled} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
          <option value="">—</option>
          {f.options
            .filter((o) => !o.deprecated || o.value === value)
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label.en}
                {o.deprecated ? ' (retired)' : ''}
              </option>
            ))}
        </select>
      );
    case 'number':
      return (
        <div className="flex items-center gap-2">
          <input
            aria-label={name}
            type="number"
            className={inputClass}
            disabled={disabled}
            min={f.min}
            max={f.max}
            value={value === undefined ? '' : String(value)}
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          />
          {f.unit && <span className="text-xs text-on-surface-variant">{f.unit}</span>}
        </div>
      );
    case 'boolean':
      return (
        <select
          aria-label={name}
          className={inputClass}
          disabled={disabled}
          value={value === undefined ? '' : value ? 'yes' : 'no'}
          onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value === 'yes')}
        >
          <option value="">—</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      );
    case 'date':
      return <input aria-label={name} type="date" className={inputClass} disabled={disabled} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />;
    case 'translated_text': {
      const t = (value as any) ?? {};
      const set = (lang: string, v: string) => onChange({ ...t, [lang]: v });
      return (
        <div className="grid grid-cols-3 gap-2">
          {(['en', 'ta', 'hi'] as const).map((lang) => (
            <input key={lang} aria-label={`${name} (${lang})`} placeholder={lang.toUpperCase()} className={inputClass} disabled={disabled} value={t[lang] ?? ''} onChange={(e) => set(lang, e.target.value)} />
          ))}
        </div>
      );
    }
    default:
      return <input aria-label={name} className={inputClass} disabled={disabled} maxLength={1000} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || undefined)} />;
  }
};

/* ------------------------------------------------------------ image gallery */

/**
 * A big main image (or a large drop area when there are none) with the
 * uploaded images as thumbnails below it: ✕ removes one, "Set as main" moves
 * it first, "+ Add" uploads more. Same checks and upload as MediaUploader —
 * only server URLs are ever kept (never blob:).
 */
const ImageGallery: React.FC<{ label: string; value: Media[]; onChange: (next: Media[]) => void }> = ({ label, value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const current = value[Math.min(shown, value.length - 1)];

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const added: Media[] = [];
    for (const file of Array.from(files)) {
      const problem = checkMediaFile(file, ['image', 'video']);
      if (problem) {
        setError(`${file.name}: ${problem}`);
        continue;
      }
      setBusy((n) => n + 1);
      try {
        const stored = await mediaService.upload(file);
        added.push({ url: stored.url, kind: stored.kind });
      } catch (e: any) {
        setError(`${file.name}: ${e?.message || 'Upload failed'}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (added.length) onChange([...value, ...added].map((m, i) => ({ ...m, sort_order: i })));
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (i: number) => {
    onChange(value.filter((_, x) => x !== i).map((m, x) => ({ ...m, sort_order: x })));
    setShown(0);
  };
  const makeMain = (i: number) => {
    const next = [value[i], ...value.filter((_, x) => x !== i)].map((m, x) => ({ ...m, sort_order: x }));
    onChange(next);
    setShown(0);
  };
  const preview = (m: Media, cls: string, alt: string) => {
    const src = resolveAssetUrl(m.url);
    return m.kind === 'video' ? <video src={src} className={cls} muted controls={false} aria-label={alt} /> : <img src={src} alt={alt} className={cls} />;
  };

  return (
    <div className="flex flex-col gap-2" data-testid="image-gallery">
      <span className="text-sm font-medium text-on-surface">{label}</span>

      {/* The big area: the shown image, or a drop zone when empty */}
      {current ? (
        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-surface-container-high bg-surface-container-low">
          {preview(current, 'w-full h-full object-cover', `${label} — shown`)}
          <button
            type="button"
            aria-label="Full screen"
            onClick={() => setFullScreen(true)}
            className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-surface-container-lowest/90 shadow flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              fullscreen
            </span>
          </button>
          {shown === 0 ? (
            <span className="absolute top-2 left-2 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-on-surface/70 text-white">Main</span>
          ) : (
            <button type="button" onClick={() => makeMain(shown)} className="absolute top-2 left-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-container-lowest/90 text-primary shadow">
              Set as main
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void upload(e.dataTransfer.files);
          }}
          className={`w-full aspect-[4/3] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 text-center px-4 transition-colors ${
            dragging ? 'border-primary bg-primary/5' : 'border-surface-container-high bg-surface-container-low/50 hover:border-primary/50'
          }`}
        >
          <span className="material-symbols-outlined text-3xl text-on-surface-variant" aria-hidden="true">
            add_photo_alternate
          </span>
          <span className="text-sm font-medium text-on-surface">Click or drop images here</span>
          <span className="text-[11px] text-on-surface-variant">JPG, PNG, WebP up to 10 MB · MP4, MOV up to 60 MB</span>
        </button>
      )}

      {/* Thumbnails of everything uploaded, then + Add */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((m, i) => (
            <div key={`${m.url}-${i}`} className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 ${i === Math.min(shown, value.length - 1) ? 'border-primary' : 'border-transparent'}`}>
              <button type="button" onClick={() => setShown(i)} aria-label={`Show image ${i + 1}`} className="w-full h-full">
                {preview(m, 'w-full h-full object-cover', `Image ${i + 1}`)}
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`Remove image ${i + 1}`}
                className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-[11px] leading-5"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy > 0}
            aria-label={`Add ${label}`}
            className="w-14 h-14 rounded-lg border-2 border-dashed border-surface-container-high text-on-surface-variant flex items-center justify-center hover:border-primary/50 disabled:opacity-50"
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              add
            </span>
          </button>
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime" multiple className="hidden" onChange={(e) => void upload(e.target.files)} />
      {fullScreen && current && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-6"
          role="dialog"
          aria-label="Picture, full screen"
          onClick={() => setFullScreen(false)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              setFullScreen(false);
            }
          }}
        >
          {current.kind === 'video' ? (
            <video src={resolveAssetUrl(current.url)} className="max-w-full max-h-full object-contain" controls />
          ) : (
            <img src={resolveAssetUrl(current.url)} alt={label} className="max-w-full max-h-full object-contain" />
          )}
          <button type="button" aria-label="Close full screen" autoFocus className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center">
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
        </div>
      )}
      {busy > 0 && (
        <span className="text-xs text-on-surface-variant" role="status">
          Uploading…
        </span>
      )}
      {error && (
        <p className="text-xs text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

/* ============================================================ the page */

export default function AddEditProductV2Page() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const label = useLabels();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const canEdit = isAdmin || user?.role === 'Editor';
  const singular = label.singular('allProducts');

  /* Loaded */
  const [type, setType] = useState<ProductType | null>(null);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [currency, setCurrency] = useState('INR');
  const [existing, setExisting] = useState<ProductV2 | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  /* Form */
  const [nameEn, setNameEn] = useState('');
  const [nameTa, setNameTa] = useState('');
  const [nameHi, setNameHi] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [fulfilment, setFulfilment] = useState<Fulfilment>('goods');
  const [trackInventory, setTrackInventory] = useState(true);
  const [tracking, setTracking] = useState<Tracking>('none');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, AttributeValueType | undefined>>({});
  const [picked, setPicked] = useState<string[]>([]);
  const [pickerQuery, setPickerQuery] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);
  const [fulfilmentOpen, setFulfilmentOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [variantsOpen, setVariantsOpen] = useState(false);
  /* Items: Grid (photo cards) or List (compact rows) — remembered in this browser, Grid by default. */
  const [itemsView, setItemsViewState] = useState<'grid' | 'list'>(() => {
    try {
      return localStorage.getItem(ITEMS_VIEW_KEY) === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const setItemsView = (v: 'grid' | 'list') => {
    setItemsViewState(v);
    try {
      localStorage.setItem(ITEMS_VIEW_KEY, v);
    } catch {
      /* private mode: just not remembered */
    }
  };
  /** The one open item card (Grid) or row with "More details" open (List). */
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState<{ field: 'price' | 'mrp' | 'stock' | 'status'; value: string; note: string | null }>({
    field: 'price',
    value: '',
    note: null,
  });
  /* The "Add variant option" menu, and which option row is adding a value. */
  const [variantMenuOpen, setVariantMenuOpen] = useState(false);
  const [variantMenuQuery, setVariantMenuQuery] = useState('');
  const [addingValueFor, setAddingValueFor] = useState<string | null>(null);
  /* Admin: a brand-new variant option written inline in the Variants card (a choice list saved to the library). */
  const [newVariant, setNewVariant] = useState<null | { label: string; options: string[]; draft: string; note: string | null }>(null);
  const [hsn, setHsn] = useState('');
  const [sac, setSac] = useState('');
  const [gst, setGst] = useState('');
  const [taxInclusive, setTaxInclusive] = useState(true);
  /* A bundle (design §3.5): its stock comes from the items it contains (set on the details page). */
  const [isBundle, setIsBundle] = useState(false);
  /* "+ Add pack" open on one item: quantity, pack price, optional SKU. */
  const [packDraft, setPackDraft] = useState<null | { rowId: string; quantity: string; price: string; sku: string; note: string | null }>(null);
  /* Variant popup (form): new packs typed in its Packs card, and its "More" card. */
  const [popupPacks, setPopupPacks] = useState<{ key: number; quantity: string; price: string; sku: string }[]>([]);
  const [popupPackNote, setPopupPackNote] = useState<string | null>(null);

  const [axes, setAxes] = useState<VariantAxis[]>([]);
  /* Measured sizes (R45): at most one per product, e.g. Net quantity 500 ml / 1 l. */
  const [sizeAxis, setSizeAxis] = useState<MeasuredVariantAxis | null>(null);
  const [newSize, setNewSize] = useState<{ amount: string; unit: string; note: string | null }>({ amount: '', unit: '', note: null });
  /* Purchase limits (R50): optional, collapsed. */
  const [limits, setLimits] = useState<LimitsText>(blankLimits());
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [rows, setRows] = useState<ItemRow[]>([newRow()]);
  const [media, setMedia] = useState<Media[]>([]);
  const [optionMedia, setOptionMedia] = useState<Record<string, Media[]>>({});
  const [newOption, setNewOption] = useState<Record<string, string>>({});
  const [optionWarning, setOptionWarning] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<VariantCombination[] | null>(null);
  const [previewPicked, setPreviewPicked] = useState<Set<string>>(new Set());

  /* Admin shortcut: create an attribute in the library (R40) */
  const [creating, setCreating] = useState<null | { label: string; type: FieldType; options: string }>(null);

  const [saving, setSaving] = useState<null | 'draft' | 'publish'>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>((location.state as any)?.publishProblems ?? []);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  /* ---------------------------------------------------------- loading */

  const fillFrom = (p: ProductV2, t: ProductType | null) => {
    setExisting(p);
    setNameEn(p.name.en);
    setNameTa(p.name.ta ?? '');
    setNameHi(p.name.hi ?? '');
    /* Nothing hidden: a product with a Tamil or Hindi name opens Other languages. */
    if (p.name.ta || p.name.hi) setLangOpen(true);
    setSlug(p.slug);
    setSlugTouched(true);
    setBrand(p.brand ?? '');
    setDescription(p.description?.en ?? '');
    setFulfilment(p.effective.fulfilment);
    /* Not goods: show the Advanced option open, so the setting is not hidden. */
    if (p.effective.fulfilment !== 'goods') setFulfilmentOpen(true);
    setIsBundle(Boolean(p.is_bundle));
    if (p.is_bundle) setFulfilmentOpen(true);
    setTrackInventory(p.track_inventory);
    setTracking(p.track_inventory ? p.effective.tracking : (t?.tracking ?? 'none'));
    setCategoryIds(p.category_ids);
    setPrimaryId(p.primary_category_id);
    setValues(Object.fromEntries(p.attributes.map((a) => [a.key, a.value])));
    const templateKeys = new Set((t?.fields ?? []).filter((f) => f.source === 'template').map((f) => f.key));
    const extra = p.attributes.map((a) => a.key).filter((k) => !templateKeys.has(k));
    setPicked(extra);
    /* Nothing hidden: a product that already has extra attributes opens the accordion. */
    /* Only optional, ungrouped extras live in More attributes (required / grouped ones have their own cards). */
    const extraFields = new Map((t?.fields ?? []).map((f) => [f.key, f]));
    if (extra.some((k) => { const f = extraFields.get(k); return !f || (!f.required && !f.group); })) setMoreOpen(true);
    setHsn(p.hsn_code ?? '');
    setSac(p.sac_code ?? '');
    setGst(p.gst_rate === null ? '' : String(p.gst_rate));
    /* Nothing hidden: a product that already has tax values opens the Tax accordion. */
    if (p.hsn_code || p.sac_code || p.gst_rate !== null) setTaxOpen(true);
    setTaxInclusive(p.items[0]?.price?.tax_inclusive ?? true);
    setAxes(p.variant_axes.filter((a) => !isMeasuredAxis(a)));
    setSizeAxis(((p.variant_axes as AnyVariantAxis[]).find(isMeasuredAxis) as MeasuredVariantAxis | undefined) ?? null);
    setLimits(limitsText(p.purchase_limits));
    /* Nothing hidden: a product with limits opens Purchase limits. */
    if (limitsInput(limitsText(p.purchase_limits))) setLimitsOpen(true);
    /* Nothing hidden: a product with variant options opens the Variants accordion. */
    if (p.variant_axes.length) setVariantsOpen(true);
    setRows([...p.items.map((i) => rowFromItem(i)), ...(p.deleted_items ?? []).map((i) => rowFromItem(i, true))]);
    setMedia(p.media ?? []);
    setOptionMedia(Object.fromEntries((p.option_media ?? []).map((o) => [`${o.attribute_key}=${o.value}`, o.media])));
  };

  useEffect(() => {
    (async () => {
      try {
        const [t, c, b] = await Promise.all([
          productTypeService.get(),
          catalogCategoryService.list(false),
          businessService.get().catch(() => null),
        ]);
        setType(t);
        setCategories(c.categories);
        if (b?.default_currency) setCurrency(b.default_currency);
        if (id) {
          fillFrom(await productV2Service.get(id, true), t);
        } else {
          /* R13a–R13c + K6a: the type's defaults, or what was last chosen this session. */
          const last = readSession();
          const f: Fulfilment = last.fulfilment ?? t?.fulfilment ?? 'goods';
          setFulfilment(f);
          setTrackInventory(f === 'goods');
          setTracking(last.tracking ?? t?.tracking ?? 'none');
        }
      } catch (e: any) {
        setLoadError(e.message || 'Could not load the form');
      } finally {
        setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ------------------------------------------------------- derived */

  const fields = useMemo(() => new Map((type?.fields ?? []).map((f) => [f.key, f])), [type]);
  const flatCats = useMemo(() => flatten(categories), [categories]);
  const catById = useMemo(() => new Map(flatCats.map((c) => [c.node.id, c.node])), [flatCats]);
  /** "Cars › SUV" in tree mode; just the name in a flat list. */
  const categoryPath = (node: CategoryNode): string => {
    const parts = [node.name.en];
    for (let p = node.parent_id ? catById.get(node.parent_id) : undefined; p && parts.length < 6; p = p.parent_id ? catById.get(p.parent_id) : undefined) {
      parts.unshift(p.name.en);
    }
    return parts.join(' › ');
  };
  /* The search narrows the badges; chosen ones always stay in view. */
  const cq = categoryQuery.trim().toLowerCase();
  const shownCategories = flatCats.filter(
    ({ node }) => !cq || categoryIds.includes(node.id) || [node.name.en, node.code].some((t) => t?.toLowerCase().includes(cq))
  );

  /** Fields shown for the chosen categories: the union (R15b); none chosen = all. */
  const visible = useMemo(() => {
    const chosen = categoryIds.map((c) => catById.get(c)).filter(Boolean) as CategoryNode[];
    return chosen.length ? new Set(chosen.flatMap((c) => c.resolved_visible_field_keys)) : null;
  }, [categoryIds, catById]);
  const isVisible = (key: string) => !visible || visible.has(key);

  /** Every variant option: the choice options, then the measured size (if any). */
  const allAxes: AnyVariantAxis[] = sizeAxis ? [...axes, sizeAxis] : axes;
  const axisKeys = new Set(allAxes.map((a) => a.key));
  /* Always on the form (UI trial, options A + B): template fields, required fields and
     any field with a group (shown in that group's card). Optional ungrouped ones are
     picked in More attributes. */
  const isAlwaysShown = (f: FieldDefinition) => f.source === 'template' || f.required || Boolean(f.group);
  const basicFields = (type?.fields ?? []).filter(
    (f) => isAlwaysShown(f) && !axisKeys.has(f.key) && (!f.deprecated || (f.source === 'template' && values[f.key] !== undefined))
  );
  const retiredKept = (type?.fields ?? []).filter((f) => f.deprecated && existing?.attributes.some((a) => a.key === f.key));
  const pickable = (type?.fields ?? []).filter(
    (f) => !isAlwaysShown(f) && !f.deprecated && !picked.includes(f.key) && !axisKeys.has(f.key) && isVisible(f.key)
  );
  /* Picked extras shown in More attributes — never ones already on the form above. */
  const pickedShown = picked.filter((k) => {
    const f = fields.get(k);
    return !f || f.deprecated || !isAlwaysShown(f);
  });
  const moreFilled = pickedShown.filter((k) => !isEmpty(values[k])).length;
  const langFilled = [nameTa, nameHi].filter((t) => t.trim()).length;
  const taxCode = (fulfilment === 'service' ? sac : hsn).trim();
  const taxSummary = [gst !== '' && `GST ${gst}%`, taxCode && `${fulfilment === 'service' ? 'SAC' : 'HSN'} ${taxCode}`].filter(Boolean).join(' · ');
  /* Choice lists, and (while the product has no size yet) numbers with a unit family (R45). */
  const variantCandidates = (type?.fields ?? []).filter(
    (f) =>
      (f.type === 'enum' || (f.type === 'number' && Boolean(f.unit_family) && !sizeAxis)) &&
      f.variant_forming &&
      !f.deprecated &&
      !axisKeys.has(f.key) &&
      values[f.key] === undefined &&
      isVisible(f.key)
  );
  const existingItems = rows.filter((r) => r.id && !r.deleted);
  const axesLocked = editing && existingItems.length > 0;
  const liveRows = rows.filter((r) => !r.deleted && !r.remove);
  /* Item tax columns (Incl. GST · GST · HSN) only once tax is configured — a GST rate or an
     HSN / SAC code on the product — or when an item already has its own override (never hidden). */
  const showItemTax = gst !== '' || Boolean((fulfilment === 'service' ? sac : hsn).trim()) || rows.some((r) => r.gst !== '' || r.hsn.trim() !== '');
  /** A pack's base row: the saved item (by id) or the row it was made from. */
  const baseOf = (r: ItemRow): ItemRow | undefined =>
    r.pack ? rows.find((x) => (r.pack!.baseItemId && x.id === r.pack!.baseItemId) || (r.pack!.baseRowId && x.rowId === r.pack!.baseRowId)) : undefined;
  /* A pack follows its base item's Track inventory (R48). */
  const effectiveTrack = (r: ItemRow): boolean => {
    const base = baseOf(r);
    if (r.pack) return base ? effectiveTrack(base) : trackInventory;
    return r.track === 'same' ? trackInventory : r.track === 'on';
  };
  /* Serial tracking: units drive stock (Phase 4) — no initial stock is typed or sent. */
  const serialTracked = trackInventory && tracking === 'serial';

  const duplicateSkus = useMemo(() => {
    const seen = new Map<string, number>();
    liveRows.forEach((r) => r.sku.trim() && seen.set(r.sku.trim(), (seen.get(r.sku.trim()) ?? 0) + 1));
    return new Set([...seen].filter(([, n]) => n > 1).map(([s]) => s));
  }, [liveRows]);

  /* ------------------------------------------------------- actions */

  const onName = (v: string) => {
    setNameEn(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const onFulfilment = (f: Fulfilment) => {
    setFulfilment(f);
    /* A new product: service / rental / digital start untracked (R13a); it can be switched back on. */
    if (!editing) setTrackInventory(f === 'goods');
  };

  const toggleCategory = (cid: string) => {
    setCategoryIds((current) => {
      const next = current.includes(cid) ? current.filter((c) => c !== cid) : [...current, cid];
      setPrimaryId((p) => (p && next.includes(p) ? p : next[0] ?? null));
      return next;
    });
  };

  const setValue = (key: string, v: AttributeValueType | undefined) => setValues((cur) => ({ ...cur, [key]: v }));

  const addAxis = (key: string) => {
    if (!key) return;
    const f = fields.get(key);
    if (f?.type === 'number' && f.unit_family) {
      /* A measured size: amounts are typed in, in a unit of its family. */
      const units = UNITS_BY_FAMILY[f.unit_family];
      setSizeAxis({ key, values: [] });
      setNewSize({ amount: '', unit: f.unit && units.includes(f.unit) ? f.unit : units[0], note: null });
    } else {
      setAxes((cur) => [...cur, { key, values: [] }]);
    }
    /* Items are built from the variant options now: the single plain item goes. */
    setRows((cur) => cur.filter((r) => r.id || r.attributes.length));
    setPreview(null);
  };

  const toggleAxisValue = (key: string, value: string) => {
    setAxes((cur) =>
      cur.map((a) => (a.key === key ? { ...a, values: a.values.includes(value) ? a.values.filter((v) => v !== value) : [...a.values, value] } : a))
    );
    setPreview(null);
  };

  const removeAxis = (key: string) => {
    if (sizeAxis?.key === key) setSizeAxis(null);
    else setAxes((cur) => cur.filter((a) => a.key !== key));
    setRows((cur) => {
      const kept = cur.filter((r) => r.id);
      return kept.length ? kept : [newRow({}, taxInclusive)];
    });
    setPreview(null);
  };

  /** Adds a typed size (e.g. 500 ml); the same size in another unit (1 l = 1000 ml) is refused. */
  const addSize = () => {
    if (!sizeAxis) return;
    const f = fields.get(sizeAxis.key);
    const units = f?.unit_family ? UNITS_BY_FAMILY[f.unit_family] : [];
    const unit = newSize.unit || units[0] || '';
    const amount = Number(newSize.amount.trim());
    if (!newSize.amount.trim() || !Number.isFinite(amount) || amount <= 0) return setNewSize({ ...newSize, note: 'Enter an amount above 0' });
    if (f?.unit_family === 'count' && !Number.isInteger(amount)) return setNewSize({ ...newSize, note: 'A count of pieces must be a whole number' });
    const v = { amount, unit };
    const same = sizeAxis.values.find((x) => measureBase(x) === measureBase(v));
    if (same) return setNewSize({ ...newSize, note: `${measureText(v)} is the same size as ${measureText(same)}` });
    setSizeAxis({ ...sizeAxis, values: [...sizeAxis.values, v].sort((a, b) => measureBase(a) - measureBase(b)) });
    setNewSize({ amount: '', unit, note: null });
    setPreview(null);
  };

  const removeSize = (base: number) => {
    if (!sizeAxis) return;
    setSizeAxis({ ...sizeAxis, values: sizeAxis.values.filter((x) => measureBase(x) !== base) });
    setPreview(null);
  };

  /** "+ add option" from the form (R44): saved to the shared attribute, near-duplicates held back. */
  const addOption = async (key: string, confirm = false) => {
    const text = (newOption[key] ?? '').trim();
    if (!text) return;
    try {
      const res = await productTypeService.addOptions(key, [text], confirm);
      if (res.warnings?.length && !confirm) {
        setOptionWarning((w) => ({ ...w, [key]: `“${text}” looks like “${res.warnings[0].similar_to}”.` }));
        return;
      }
      setType(res.data);
      const ticked = [...(res.added ?? []), ...(res.existing ?? [])];
      setAxes((cur) => cur.map((a) => (a.key === key ? { ...a, values: [...new Set([...a.values, ...ticked])] } : a)));
      setNewOption((o) => ({ ...o, [key]: '' }));
      setOptionWarning((w) => ({ ...w, [key]: '' }));
      setPreview(null);
    } catch (e) {
      setToast({ text: serverText(e), type: 'error' });
    }
  };

  const runPreview = async () => {
    try {
      const res = await productV2Service.variantPreview({
        variant_axes: allAxes,
        ...(existing ? { product_id: existing.id } : { name: nameEn || 'item', slug: slug || undefined }),
      });
      const inForm = new Set(rows.filter((r) => !r.deleted).map((r) => signature(r.attributes)));
      const combos = res.combinations.map((c) => ({ ...c, exists: c.exists || inForm.has(c.attribute_signature) }));
      setPreview(combos);
      setPreviewPicked(new Set(combos.filter((c) => !c.exists).map((c) => c.attribute_signature)));
    } catch (e) {
      setToast({ text: serverText(e), type: 'error' });
    }
  };

  const createSelected = () => {
    if (!preview) return;
    const chosen = preview.filter((c) => !c.exists && previewPicked.has(c.attribute_signature));
    setRows((cur) => [...cur, ...chosen.map((c) => newRow({ sku: c.suggested_sku, attributes: c.attributes }, taxInclusive))]);
    setPreview(null);
    /* The new rows are in Items, further down the page. */
    setTimeout(() => scrollToId(sectionId('Items')), 0);
  };

  const updateRow = (rowId: string, patch: Partial<ItemRow>) => setRows((cur) => cur.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));

  const createAttribute = async () => {
    if (!creating?.label.trim()) return;
    try {
      const options = creating.type === 'enum' ? creating.options.split('\n').map((s) => s.trim()).filter(Boolean).map((en) => ({ label: { en } })) : undefined;
      const { data } = await productTypeService.addField({
        label: { en: creating.label.trim() },
        type: creating.type,
        ...(options ? { options, variant_forming: true } : {}),
      });
      const added = data.fields.find((f) => !type?.fields.some((x) => x.key === f.key));
      setType(data);
      if (added) setPicked((p) => [...p, added.key]);
      setCreating(null);
      setToast({ text: `“${creating.label.trim()}” added to the attribute library`, type: 'success' });
    } catch (e) {
      setToast({ text: serverText(e), type: 'error' });
    }
  };

  /** Adds the typed option to the new variant option's list (no duplicates, any capitalisation). */
  const addNewVariantOption = () => {
    if (!newVariant) return;
    const v = newVariant.draft.trim();
    if (!v) return;
    if (newVariant.options.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setNewVariant({ ...newVariant, note: `${v} is already in the list` });
      return;
    }
    setNewVariant({ ...newVariant, options: [...newVariant.options, v], draft: '', note: null });
  };

  /** Saves a new choice list usable for variants to the library (R40), then uses it on this product. */
  const createVariantOption = async () => {
    if (!newVariant?.label.trim() || !newVariant.options.length) return;
    try {
      const { data } = await productTypeService.addField({
        label: { en: newVariant.label.trim() },
        type: 'enum',
        options: newVariant.options.map((en) => ({ label: { en } })),
        variant_forming: true,
      });
      const added = data.fields.find((f) => !type?.fields.some((x) => x.key === f.key));
      setType(data);
      if (added) {
        setAxes((cur) => [...cur, { key: added.key, values: added.options.filter((o) => !o.deprecated).map((o) => o.value) }]);
        /* Items are built from the variant options now: the single plain item goes. */
        setRows((cur) => cur.filter((r) => r.id || r.attributes.length));
        setPreview(null);
      }
      setToast({ text: `“${newVariant.label.trim()}” added to the attribute library and to this ${label.lowerSingular('allProducts')}`, type: 'success' });
      setNewVariant(null);
    } catch (e) {
      setNewVariant({ ...newVariant, note: serverText(e) });
    }
  };

  const combinationCount = allAxes.reduce((n, a) => n * Math.max(a.values.length, 1), 1);

  /** The "Add variant option" menu: existing choice lists with a preview of their values; Admins can create one. */
  const variantMenu = (style: 'primary' | 'link') => {
    const q = variantMenuQuery.trim().toLowerCase();
    const list = variantCandidates.filter((f) => !q || f.label.en.toLowerCase().includes(q));
    const close = () => {
      setVariantMenuOpen(false);
      setVariantMenuQuery('');
    };
    return (
      <div className="relative inline-block text-left">
        <Button
          variant={style === 'primary' ? 'primary' : 'ghost'}
          size="sm"
          startIcon="add"
          endIcon="expand_more"
          aria-haspopup="menu"
          aria-expanded={variantMenuOpen}
          onClick={() => setVariantMenuOpen((o) => !o)}
        >
          {style === 'primary' ? 'Add variant option' : 'Add another option'}
        </Button>
        {variantMenuOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={close} />
            <div
              role="menu"
              aria-label="Variant options"
              className={`absolute z-30 mt-1.5 w-72 ${style === 'primary' ? 'left-1/2 -translate-x-1/2' : 'left-0'} bg-surface-container-lowest rounded-xl shadow-2xl border border-surface-container-high py-1.5 text-left`}
            >
              {variantCandidates.length > 4 && (
                <div className="px-2 pb-1.5">
                  <input
                    aria-label="Search variant options"
                    autoFocus
                    className={smallInput}
                    placeholder="Search options"
                    value={variantMenuQuery}
                    onChange={(e) => setVariantMenuQuery(e.target.value)}
                  />
                </div>
              )}
              {list.map((f) => {
                const live = f.unit_family ? [`Sizes · ${UNITS_BY_FAMILY[f.unit_family].join(', ')}`] : f.options.filter((o) => !o.deprecated).map((o) => o.label.en);
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="menuitem"
                    aria-label={`Use ${f.label.en}`}
                    onClick={() => {
                      addAxis(f.key);
                      close();
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-surface-container-low"
                  >
                    <span className="font-medium text-on-surface">{f.label.en}</span>
                    <span className="text-xs text-on-surface-variant truncate max-w-[9rem]">
                      {live.slice(0, 2).join(', ')}
                      {live.length > 2 ? `, +${live.length - 2}` : ''}
                    </span>
                  </button>
                );
              })}
              {list.length === 0 && (
                <p className="px-3 py-2 text-xs text-on-surface-variant" data-testid="no-variant-options">
                  {variantCandidates.length ? 'No option matches.' : 'No choice lists ready for variants yet.'}
                </p>
              )}
              <div className="h-px bg-surface-container-high my-1" />
              {isAdmin ? (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setNewVariant({ label: '', options: [], draft: '', note: null });
                    close();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    add
                  </span>
                  Create new option…
                </button>
              ) : (
                <p className="px-3 py-2 text-xs text-on-surface-variant">Ask an Admin to create one in Attributes.</p>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  /* ------------------------------------------------ items: shared helpers */

  const valueLabel = (key: string, value: unknown) => {
    /* A size is stored as its base amount: show it as entered ("1 l", not 1000). */
    if (sizeAxis && key === sizeAxis.key) {
      const s = sizeAxis.values.find((x) => measureBase(x) === value);
      if (s) return measureText(s);
    }
    return fields.get(key)?.options.find((o) => o.value === value)?.label.en ?? String(value);
  };
  /** The item's size, from the product's sizes (or what was saved). */
  const rowMeasure = (r: ItemRow): Measure | null => {
    if (sizeAxis) {
      const v = r.attributes.find((a) => a.key === sizeAxis.key)?.value;
      const s = sizeAxis.values.find((x) => measureBase(x) === v);
      if (s) return { ...s, base_amount: measureBase(s) };
    }
    return r.original?.measure ?? null;
  };
  /** "₹36.00 / 100 ml" while typing (R46); the server works out the saved one the same way. */
  const perUnitText = (r: ItemRow): string | null => {
    const p = parseRupees(r.price);
    if ('error' in p) return null;
    /* A pack of 4 × 500 ml is priced per 2 l. */
    const base = baseOf(r);
    const m = r.pack ? (base ? rowMeasure(base) : null) : rowMeasure(r);
    const measure = m && r.pack ? { ...m, base_amount: m.base_amount * r.pack.quantity } : m;
    const u = pricePerUnitOf(p.minor, measure, fulfilment === 'rental' ? r.priceUnit : 'each');
    return u ? `${formatMoney(u.amount_minor, currency)} / ${u.per}` : null;
  };
  /** "₹21,999 > ₹19,999" when the price is above the MRP (both filled in); null otherwise. */
  const priceOverMrp = (r: ItemRow): string | null => {
    const p = parseRupees(r.price);
    const m = parseRupees(r.mrp);
    if ('error' in p || 'error' in m || p.minor === null || m.minor === null || p.minor <= m.minor) return null;
    return `${formatMoney(p.minor, currency)} > ${formatMoney(m.minor, currency)}`;
  };
  /** "Save 10 %" against buying the singles (R49) — both priced, same tax-inclusive. */
  const packSavingText = (r: ItemRow): string | null => {
    const base = baseOf(r);
    if (!r.pack || !base || r.taxInclusive !== base.taxInclusive) return null;
    const pp = parseRupees(r.price);
    const bp = parseRupees(base.price);
    if ('error' in pp || 'error' in bp || pp.minor === null || !bp.minor) return null;
    const percent = Math.round((1 - pp.minor / (bp.minor * r.pack.quantity)) * 1000) / 10;
    return percent > 0 ? `Save ${percent} %` : percent < 0 ? `${-percent} % dearer than ${r.pack.quantity} singles` : null;
  };
  /** "Petrol · Red" for a variant; the product name for a single item. */
  const plainTitle = (r: ItemRow) => (r.attributes.length ? r.attributes.map((a) => valueLabel(a.key, a.value)).join(' · ') : nameEn.trim() || 'Item');
  /** "Petrol · Red", or "Petrol · Red · Pack of 4" for a pack. */
  const itemTitle = (r: ItemRow) => (r.pack ? `${plainTitle(r)} · Pack of ${r.pack.quantity}` : plainTitle(r));
  /** The picture a customer would see: the item's own → its option's (e.g. Red) → the product's. */
  const itemThumb = (r: ItemRow): { url?: string; from: string | null } => {
    if (r.media[0]) return { url: resolveAssetUrl(r.media[0].url), from: null };
    for (const a of r.attributes) {
      const m = optionMedia[`${a.key}=${a.value}`]?.[0];
      if (m) return { url: resolveAssetUrl(m.url), from: `uses ${valueLabel(a.key, a.value)} photos` };
    }
    if (media[0]) return { url: resolveAssetUrl(media[0].url), from: `uses ${label.lowerSingular('allProducts')} photos` };
    return { from: null };
  };
  const itemPrice = (r: ItemRow) => {
    const p = parseRupees(r.price);
    if ('error' in p) return 'Check the price';
    return formatMoney(p.minor, currency);
  };
  const itemStock = (r: ItemRow) => {
    if (!effectiveTrack(r)) return 'Not tracked';
    /* A pack's stock is its base's (R48); a bundle's is its components'. */
    if (r.pack) return r.original?.availability.status === 'tracked' ? `${r.original.availability.available} available (from base)` : 'From the base item';
    if (isBundle) return 'From its components';
    if (!r.id) return `${r.stock.trim() || 0} in stock`;
    return r.original?.availability.status === 'tracked' ? `${r.original.availability.on_hand} in stock` : '0 in stock';
  };

  /* Header summary: variants · price range · stock. */
  const itemsSummary = (() => {
    const prices = liveRows.map((r) => parseRupees(r.price)).map((p) => ('minor' in p ? p.minor : null)).filter((m): m is number => m !== null);
    const range = prices.length ? (Math.min(...prices) === Math.max(...prices) ? formatMoney(Math.min(...prices), currency) : `${formatMoney(Math.min(...prices), currency)} – ${formatMoney(Math.max(...prices), currency)}`) : null;
    const stock = liveRows.filter((r) => !r.pack && effectiveTrack(r)).reduce((n, r) => n + (r.id ? (r.original?.availability.status === 'tracked' ? r.original.availability.on_hand : 0) : Number(r.stock) || 0), 0);
    return [`${liveRows.length} ${liveRows.length === 1 ? 'variant' : 'variants'}`, range, `${stock} in stock`].filter(Boolean).join(' · ');
  })();

  const toggleSelected = (rowId: string) =>
    setSelectedRows((cur) => {
      const next = new Set(cur);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  const allSelected = liveRows.length > 0 && liveRows.every((r) => selectedRows.has(r.rowId));

  /** "Apply to selected": the same price / MRP / stock / status on many items at once. */
  const applyBulk = () => {
    const chosen = rows.filter((r) => selectedRows.has(r.rowId) && !r.deleted && !r.remove);
    if (!chosen.length) return;
    if (bulk.field === 'price' || bulk.field === 'mrp') {
      if ('error' in parseRupees(bulk.value)) return setBulk({ ...bulk, note: 'Enter ₹ with at most 2 decimals' });
      chosen.forEach((r) => updateRow(r.rowId, { [bulk.field]: bulk.value.trim() } as Partial<ItemRow>));
    } else if (bulk.field === 'stock') {
      if (!/^\d+$/.test(bulk.value.trim())) return setBulk({ ...bulk, note: 'Stock must be a whole number' });
      /* Initial stock only for new, tracked items; existing stock changes through adjustments. */
      chosen.filter((r) => !r.id && !r.pack && !isBundle && effectiveTrack(r) && !serialTracked).forEach((r) => updateRow(r.rowId, { stock: bulk.value.trim() }));
    } else {
      chosen.forEach((r) => updateRow(r.rowId, { status: bulk.value === 'inactive' ? 'inactive' : 'active' }));
    }
    setBulk({ ...bulk, note: `Applied to ${chosen.length} ${chosen.length === 1 ? 'item' : 'items'}` });
  };

  /** The everyday fields: SKU, price, MRP, stock, status. */
  const itemMainFields = (r: ItemRow) => {
    const name = r.sku || 'item';
    const off = r.deleted || r.remove;
    const tracked = effectiveTrack(r);
    return (
      <>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-on-surface-variant">SKU</label>
          <input aria-label={`SKU ${name}`} className={`${smallInput} ${duplicateSkus.has(r.sku.trim()) ? 'border-error' : ''}`} value={r.sku} disabled={off} onChange={(e) => updateRow(r.rowId, { sku: e.target.value })} />
          {duplicateSkus.has(r.sku.trim()) && <span className="text-[11px] text-error">Used twice</span>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-on-surface-variant">Price (₹)</label>
          <input aria-label={`Price ${name}`} inputMode="decimal" className={`${smallInput} ${'error' in parseRupees(r.price) ? 'border-error' : ''}`} placeholder="Not priced" value={r.price} disabled={off} onChange={(e) => updateRow(r.rowId, { price: e.target.value })} />
          {perUnitText(r) && (
            <span className="text-[11px] text-on-surface-variant" data-testid={`per-unit-${name}`}>
              {perUnitText(r)}
            </span>
          )}
          {packSavingText(r) && (
            <span className="text-[11px] font-medium text-secondary" data-testid={`saving-${name}`}>
              {packSavingText(r)}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-on-surface-variant">MRP (₹)</label>
          <input aria-label={`MRP ${name}`} inputMode="decimal" className={`${smallInput} ${priceOverMrp(r) ? 'border-amber-400' : ''}`} value={r.mrp} disabled={off} onChange={(e) => updateRow(r.rowId, { mrp: e.target.value })} />
          {/* A warning only — saving is still allowed. */}
          {priceOverMrp(r) && (
            <span className="text-[11px] text-amber-700" data-testid={`price-over-mrp-${name}`}>
              ⚠ Price is above MRP ({priceOverMrp(r)})
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-on-surface-variant">{!r.id && tracked && !serialTracked && !r.pack && !isBundle ? 'Initial stock' : 'Stock'}</label>
          {/* Stock is entered once, for new tracked items; later changes are stock adjustments (Phase 4).
              Serial tracking: the units are the stock — added after saving, never typed here. */}
          {r.pack ? (
            /* A pack has no stock of its own: it is worked out from the base (R48). */
            <span className="h-9 flex items-center text-xs text-on-surface-variant" data-testid={`pack-stock-${name}`}>
              {!tracked
                ? 'Not tracked'
                : r.original?.availability.status === 'tracked'
                  ? `${r.original.availability.available} from ${baseOf(r)?.sku || 'the base'}`
                  : `From ${baseOf(r)?.sku || 'the base item'}`}
            </span>
          ) : isBundle && tracked ? (
            <span className="h-9 flex items-center text-xs text-on-surface-variant">From its components</span>
          ) : !r.id && tracked && serialTracked ? (
            <span className="h-9 flex items-center text-xs text-on-surface-variant" data-testid={`units-note-${name}`}>
              Add units after saving
            </span>
          ) : !r.id && tracked ? (
            <input aria-label={`Initial stock ${name}`} inputMode="numeric" className={smallInput} value={r.stock} onChange={(e) => updateRow(r.rowId, { stock: e.target.value })} />
          ) : (
            <span className="h-9 flex items-center text-xs text-on-surface-variant">{itemStock(r)}</span>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-on-surface-variant">Status</label>
          <select aria-label={`Status ${name}`} className={smallInput} value={r.status} disabled={off} onChange={(e) => updateRow(r.rowId, { status: e.target.value as ItemRow['status'] })}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </>
    );
  };

  /** The rest: Track inventory, tax overrides (once tax is set), rental unit, this item's images, delete / restore. */
  const itemMoreFields = (r: ItemRow, opts: { images?: boolean } = {}) => {
    const name = r.sku || 'item';
    const off = r.deleted || r.remove;
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* A single item follows the product's Always available / Track inventory choice; a pack its base's. */}
          {allAxes.length > 0 && !r.pack && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-on-surface-variant">Track inventory</label>
            <select aria-label={`Track inventory ${name}`} className={smallInput} value={r.track} disabled={off} onChange={(e) => updateRow(r.rowId, { track: e.target.value as ItemRow['track'] })}>
              <option value="same">Same as {label.lowerSingular('allProducts')} ({trackInventory ? 'On' : 'Off'})</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </div>
          )}
          {fulfilment === 'rental' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-on-surface-variant">Price per</label>
              <select aria-label={`Price per ${name}`} className={smallInput} value={r.priceUnit} disabled={off} onChange={(e) => updateRow(r.rowId, { priceUnit: e.target.value as PriceUnit })}>
                {PRICE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          )}
          {showItemTax && (
            <>
              <label className="flex items-center gap-2 text-xs font-medium text-on-surface-variant pt-5">
                <input type="checkbox" aria-label={`Includes GST ${name}`} className="w-4 h-4 accent-primary" checked={r.taxInclusive} disabled={off} onChange={(e) => updateRow(r.rowId, { taxInclusive: e.target.checked })} />
                Incl. GST
              </label>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-on-surface-variant">GST</label>
                <select aria-label={`GST ${name}`} className={smallInput} value={r.gst} disabled={off} onChange={(e) => updateRow(r.rowId, { gst: e.target.value })}>
                  <option value="">Same</option>
                  {GST_RATES.map((g) => (
                    <option key={g} value={String(g)}>
                      {g}%
                    </option>
                  ))}
                </select>
              </div>
              {fulfilment !== 'service' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-on-surface-variant">HSN</label>
                  <input aria-label={`HSN ${name}`} className={smallInput} placeholder="Same" value={r.hsn} disabled={off} onChange={(e) => updateRow(r.rowId, { hsn: e.target.value })} />
                </div>
              )}
            </>
          )}
        </div>
        {allAxes.length > 0 && (
          <div className="rounded-lg border border-surface-container-high">
            <button
              type="button"
              aria-expanded={Boolean(r.limitsOpen)}
              onClick={() => updateRow(r.rowId, { limitsOpen: !r.limitsOpen })}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-on-surface"
            >
              <span>
                Purchase limits for this item ·{' '}
                <span className="text-on-surface-variant font-normal">
                  {limitsSummaryText(limitsInput(r.limits)) ? `own: ${limitsSummaryText(limitsInput(r.limits))}` : limitsSummaryText(limitsInput(limits)) ? `same as ${label.lowerSingular('allProducts')}` : 'none'}
                </span>
              </span>
              <span className="material-symbols-outlined text-base text-on-surface-variant" aria-hidden="true">
                {r.limitsOpen ? 'expand_less' : 'expand_more'}
              </span>
            </button>
            {r.limitsOpen && (
              <div className="px-3 pb-3">
                <LimitsFields name={`Limit ${name}`} value={r.limits} inherited={limits} disabled={off} onChange={(next) => updateRow(r.rowId, { limits: next })} />
              </div>
            )}
          </div>
        )}
        {allAxes.length > 0 && opts.images !== false && (
          <MediaUploader label={`Images for ${itemTitle(r)} only`} value={r.media.map((m) => ({ url: m.url, kind: m.kind }))} onChange={(next) => updateRow(r.rowId, { media: next })} />
        )}
        {itemActions(r)}
      </div>
    );
  };

  /** Packs (R47–R49) are not offered on serial-tracked or bundle products. */
  const canAddPack = (r: ItemRow) => !r.pack && !r.deleted && !r.remove && !isBundle && !serialTracked;

  const addPack = () => {
    if (!packDraft) return;
    const base = rows.find((x) => x.rowId === packDraft.rowId);
    if (!base) return setPackDraft(null);
    const q = packDraft.quantity.trim();
    if (!/^\d+$/.test(q) || Number(q) < 2) return setPackDraft({ ...packDraft, note: 'A pack holds a whole number of 2 or more' });
    const quantity = Number(q);
    const same = rows.find((x) => !x.deleted && !x.remove && x.pack?.quantity === quantity && baseOf(x)?.rowId === base.rowId);
    if (same) return setPackDraft({ ...packDraft, note: `${itemTitle(same)} already exists` });
    const price = parseRupees(packDraft.price);
    if ('error' in price) return setPackDraft({ ...packDraft, note: price.error });
    const row = newRow(
      { sku: packDraft.sku.trim(), attributes: base.attributes, price: packDraft.price.trim(), pack: { baseItemId: base.id, baseRowId: base.rowId, quantity } },
      base.taxInclusive
    );
    /* Placed after its base (and the base's other packs). */
    setRows((cur) => {
      const at = cur.findIndex((x) => x.rowId === base.rowId);
      let end = at + 1;
      while (end < cur.length && cur[end].pack && (cur[end].pack!.baseRowId === base.rowId || (base.id && cur[end].pack!.baseItemId === base.id))) end++;
      return [...cur.slice(0, end), row, ...cur.slice(end)];
    });
    setPackDraft(null);
  };

  const packForm = (r: ItemRow) => {
    if (packDraft?.rowId !== r.rowId) return null;
    const name = r.sku || 'item';
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/[0.03] p-3" data-testid={`pack-form-${name}`}>
        <p className="text-xs font-semibold text-on-surface">New pack of {itemTitle(r)}</p>
        <div className="grid grid-cols-3 gap-2">
          <input aria-label={`Pack quantity ${name}`} inputMode="numeric" placeholder="Qty, e.g. 4" className={smallInput} value={packDraft.quantity} onChange={(e) => setPackDraft({ ...packDraft, quantity: e.target.value, note: null })} />
          <input aria-label={`Pack price ${name}`} inputMode="decimal" placeholder="Pack price ₹" className={smallInput} value={packDraft.price} onChange={(e) => setPackDraft({ ...packDraft, price: e.target.value, note: null })} />
          <input aria-label={`Pack SKU ${name}`} placeholder="SKU (optional)" className={smallInput} value={packDraft.sku} onChange={(e) => setPackDraft({ ...packDraft, sku: e.target.value, note: null })} />
        </div>
        {packDraft.note && (
          <p className="text-xs text-error" role="alert">
            {packDraft.note}
          </p>
        )}
        <p className="text-[11px] text-on-surface-variant">A pack has no stock of its own — it is sold from {itemTitle(r)}'s stock.</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPackDraft(null)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={addPack}>
            Add pack
          </Button>
        </div>
      </div>
    );
  };

  const itemActions = (r: ItemRow, opts: { packs?: boolean } = {}) => {
    const name = r.sku || 'item';
    return (
      <div className="flex flex-col gap-2">
      <div className="flex justify-end gap-3 text-xs">
        {canAddPack(r) && opts.packs !== false && (
          <button
            type="button"
            className="text-primary font-medium mr-auto"
            aria-label={`Add pack of ${name}`}
            onClick={() => setPackDraft({ rowId: r.rowId, quantity: '', price: '', sku: '', note: null })}
          >
            + Add pack
          </button>
        )}
        {!r.id && (allAxes.length > 0 || r.pack) && (
          <button
            type="button"
            className="text-error font-medium"
            aria-label={`Remove ${name}`}
            /* A new item's packs go with it. */
            onClick={() => setRows((cur) => cur.filter((x) => x.rowId !== r.rowId && x.pack?.baseRowId !== r.rowId))}
          >
            Remove
          </button>
        )}
        {r.id && !r.deleted && isAdmin && (
          <button type="button" className="text-error font-medium" aria-label={r.remove ? `Keep ${name}` : `Delete ${name}`} onClick={() => updateRow(r.rowId, { remove: !r.remove })}>
            {r.remove ? 'Keep' : 'Delete'}
          </button>
        )}
        {r.id && r.deleted && isAdmin && (
          <button type="button" className="text-primary font-medium" aria-label={r.remove === false ? `Keep ${name} deleted` : `Restore ${name}`} onClick={() => updateRow(r.rowId, { remove: r.remove === false ? undefined : false })}>
            {r.remove === false ? 'Undo restore' : 'Restore'}
          </button>
        )}
      </div>
      {opts.packs !== false && packForm(r)}
      </div>
    );
  };

  const thumbBox = (r: ItemRow, size: 'card' | 'row') => {
    const t = itemThumb(r);
    const box = size === 'card' ? 'w-full h-32' : 'w-12 h-12';
    return (
      <div className={`${box} rounded-lg bg-surface-container-low flex items-center justify-center overflow-hidden shrink-0 relative`}>
        {t.url ? (
          <img src={t.url} alt="" className={`w-full h-full object-cover ${t.from ? 'opacity-50' : ''}`} />
        ) : (
          <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">
            add_photo_alternate
          </span>
        )}
        {r.media.length > 1 && <span className="absolute top-1 right-1 text-[10px] font-semibold px-1.5 rounded-full bg-on-surface/70 text-white">{r.media.length}</span>}
      </div>
    );
  };

  const statusBadge = (r: ItemRow) =>
    r.deleted ? (
      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-error-container/40 text-error">Deleted</span>
    ) : r.remove ? (
      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-error-container/40 text-error">Will be deleted</span>
    ) : (
      <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${r.status === 'active' ? 'bg-secondary-fixed/30 text-secondary' : 'bg-surface-container-high text-on-surface-variant'}`}>
        {r.status === 'active' ? 'Active' : 'Inactive'}
      </span>
    );

  /* ---------------------------------------------------------- save */

  /** Client-side checks that would only bounce off the server; the server still decides. */
  const localProblems = (): string[] => {
    const out: string[] = [];
    if (!nameEn.trim()) out.push('A name (English) is required');
    if (axes.some((a) => !a.values.length)) out.push('Each variant option needs at least one value ticked');
    if (sizeAxis && !sizeAxis.values.length) out.push(`Add at least one ${fields.get(sizeAxis.key)?.label.en ?? 'size'}`);
    out.push(...limitsProblems(limits, ''));
    if (allAxes.length && !liveRows.length) out.push('Create at least one combination in Variants');
    for (const r of liveRows) {
      const p = parseRupees(r.price);
      const m = parseRupees(r.mrp);
      if ('error' in p) out.push(`${r.sku || 'Item'}: price — ${p.error}`);
      if ('error' in m) out.push(`${r.sku || 'Item'}: MRP — ${m.error}`);
      if (r.stock.trim() && !/^\d+$/.test(r.stock.trim())) out.push(`${r.sku || 'Item'}: stock must be a whole number`);
      out.push(...limitsProblems(r.limits, `${r.sku || 'Item'}: `));
    }
    if (duplicateSkus.size) out.push(`SKU used twice: ${[...duplicateSkus].join(', ')}`);
    /* A new pack names its base by SKU; with several items the base needs one. */
    const normals = liveRows.filter((r) => !r.pack);
    for (const r of liveRows.filter((x) => x.pack && !x.id)) {
      const base = baseOf(r);
      if (!base || base.deleted || base.remove) out.push(`${itemTitle(r)}: its base item is gone — remove the pack`);
      else if (!base.id && !base.sku.trim() && normals.length > 1) out.push(`Give ${plainTitle(base)} a SKU so its pack can refer to it`);
    }
    return out;
  };

  const productBody = (): Omit<ProductInput, 'items'> => {
    const attributes: AttributeValue[] = Object.entries(values)
      .filter(([key, v]) => !isEmpty(v) && !axisKeys.has(key) && (isVisible(key) || fields.get(key)?.deprecated))
      .filter(([key]) => fields.has(key))
      .map(([key, value]) => ({ key, value: value as AttributeValueType }));
    const service = fulfilment === 'service';
    const optionList = Object.entries(optionMedia)
      .filter(([k, m]) => m.length && axes.some((a) => `${a.key}=` === k.slice(0, a.key.length + 1) && a.values.includes(k.slice(a.key.length + 1))))
      .map(([k, m]) => {
        const at = k.indexOf('=');
        return { attribute_key: k.slice(0, at), value: k.slice(at + 1), media: m };
      });
    return {
      name: { en: nameEn.trim(), ...(nameTa.trim() ? { ta: nameTa.trim() } : {}), ...(nameHi.trim() ? { hi: nameHi.trim() } : {}) },
      ...(description.trim() ? { description: { en: description.trim() } } : {}),
      ...(slug.trim() && (slugTouched || editing) ? { slug: slug.trim() } : {}),
      brand: brand.trim(),
      category_ids: categoryIds,
      primary_category_id: primaryId,
      attributes,
      variant_axes: allAxes,
      fulfilment,
      track_inventory: trackInventory,
      ...(trackInventory ? { tracking } : {}),
      hsn_code: service ? null : hsn.trim() || null,
      sac_code: service ? sac.trim() || null : null,
      gst_rate: gst === '' ? null : Number(gst),
      media,
      option_media: optionList,
      /* Replaces what is stored; null = no limits. */
      purchase_limits: limitsInput(limits),
      is_bundle: isBundle,
    };
  };

  const itemBody = (r: ItemRow): ItemPatch => {
    const price = parseRupees(r.price) as { minor: number | null };
    const mrp = parseRupees(r.mrp) as { minor: number | null };
    return {
      sku: r.sku.trim() || undefined,
      price: price.minor === null ? null : { amount_minor: price.minor, currency, tax_inclusive: r.taxInclusive, price_unit: fulfilment === 'rental' ? r.priceUnit : 'each' },
      compare_at_minor: mrp.minor,
      gst_rate: r.gst === '' ? null : Number(r.gst),
      hsn_code: r.hsn.trim() || null,
      track_inventory: r.track === 'same' ? null : r.track === 'on',
      media: r.media,
      status: r.status,
      /* One item: the product's limits are its limits, so no override is sent. */
      purchase_limits: allAxes.length ? limitsInput(r.limits) : null,
    };
  };

  /** Only what changed on an existing item — and never its stock. */
  const itemChanges = (r: ItemRow): ItemPatch | null => {
    const o = r.original!;
    const b = itemBody(r);
    const patch: ItemPatch = {};
    if ((b.sku ?? '') !== o.sku) patch.sku = b.sku;
    const oldPrice = o.price ? JSON.stringify([o.price.amount_minor, o.price.tax_inclusive, o.price.price_unit]) : 'null';
    const newPrice = b.price ? JSON.stringify([b.price.amount_minor, b.price.tax_inclusive, b.price.price_unit]) : 'null';
    if (oldPrice !== newPrice) patch.price = b.price;
    if (b.compare_at_minor !== o.compare_at_minor) patch.compare_at_minor = b.compare_at_minor;
    if (b.gst_rate !== o.gst_rate) patch.gst_rate = b.gst_rate;
    if (b.hsn_code !== o.hsn_code) patch.hsn_code = b.hsn_code;
    if (b.track_inventory !== o.track_inventory) patch.track_inventory = b.track_inventory;
    if (JSON.stringify(b.media) !== JSON.stringify(o.media ?? [])) patch.media = b.media;
    if (b.status !== o.status) patch.status = b.status;
    if (JSON.stringify(b.purchase_limits ?? null) !== JSON.stringify(limitsInput(limitsText(o.purchase_limits)))) patch.purchase_limits = b.purchase_limits;
    return Object.keys(patch).length ? patch : null;
  };

  const save = async (publish: boolean) => {
    setFormError(null);
    setProblems([]);
    const local = localProblems();
    if (local.length) {
      setProblems(local);
      setTimeout(() => scrollToId('problems'), 0);
      return;
    }
    setSaving(publish ? 'publish' : 'draft');
    let productId = existing?.id;
    try {
      if (!existing) {
        const created = await productV2Service.create({
          ...productBody(),
          items: liveRows.map((r) => {
            const body = itemBody(r) as ItemInput;
            if (r.pack) {
              /* A pack names its base by SKU (it has no id yet) and takes its values. */
              const sku = baseOf(r)?.sku.trim();
              body.pack_of = { ...(sku ? { base_sku: sku } : {}), quantity: r.pack.quantity };
              return body;
            }
            if (allAxes.length) body.attributes = r.attributes;
            if (r.stock.trim() && effectiveTrack(r) && !serialTracked && !isBundle) body.initial_stock = Number(r.stock);
            return body;
          }),
        });
        productId = created.id;
      } else {
        /* Product first (so newly ticked option values exist), then items by id:
           adds before deletes, so the last active item is never removed first. */
        await productV2Service.update(existing.id, productBody());
        for (const r of rows.filter((x) => !x.id && !x.deleted && !x.remove && !x.pack)) {
          const body = { ...(itemBody(r) as ItemInput), attributes: r.attributes };
          if (r.stock.trim() && effectiveTrack(r) && !serialTracked && !isBundle) body.initial_stock = Number(r.stock);
          await productV2Service.addItem(existing.id, body);
        }
        /* New packs after their bases exist: by the base's id, or its SKU when the base is new too. */
        for (const r of rows.filter((x) => !x.id && !x.deleted && !x.remove && x.pack)) {
          const base = baseOf(r);
          const pack_of = base?.id ? { base_item_id: base.id, quantity: r.pack!.quantity } : { base_sku: base?.sku.trim(), quantity: r.pack!.quantity };
          await productV2Service.addItem(existing.id, { ...(itemBody(r) as ItemInput), pack_of });
        }
        for (const r of rows.filter((x) => x.id && !x.deleted && !x.remove)) {
          const patch = itemChanges(r);
          if (patch) await productV2Service.updateItem(existing.id, r.id!, patch);
        }
        for (const r of rows.filter((x) => x.id && x.remove && !x.deleted)) await productV2Service.deleteItem(existing.id, r.id!);
        for (const r of rows.filter((x) => x.id && x.deleted && x.remove === false)) await productV2Service.restoreItem(existing.id, r.id!);
      }
      writeSession({ fulfilment, tracking });

      if (publish) {
        try {
          await productV2Service.publish(productId!);
        } catch (e: any) {
          const reasons: string[] = e?.fieldErrors ? Object.values(e.fieldErrors) : [e?.message || 'Could not publish'];
          /* Saved as a draft; stay on the form with the reasons. */
          if (!existing) navigate(`/v2/products/${productId}/edit`, { replace: true, state: { publishProblems: reasons } });
          else {
            setProblems(reasons);
            fillFrom(await productV2Service.get(productId!, true), type);
            setTimeout(() => scrollToId('problems'), 0);
          }
          return;
        }
      }
      navigate(`/v2/products/${productId}`);
    } catch (e) {
      setFormError(serverText(e));
      /* Edits already applied stay applied: reload so the form shows the truth. */
      if (existing) {
        try {
          fillFrom(await productV2Service.get(existing.id, true), type);
        } catch {
          /* keep what is on screen */
        }
      }
    } finally {
      setSaving(null);
    }
  };

  /* -------------------------------------------------------- render */

  if (!canEdit) {
    return (
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm" role="alert">
        Read-only — only an Admin or Editor can add or change {label.lower('allProducts')}.
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="p-4 rounded-xl bg-error-container/40 border border-error/20 text-sm text-error" role="alert">
        {loadError}
      </div>
    );
  }
  if (!ready) return <p className="text-sm text-on-surface-variant">Loading…</p>;
  if (!type) {
    return (
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm" role="alert">
        Choose a business category in Settings → Business & Products first.
      </div>
    );
  }

  const fieldRow = (f: FieldDefinition, opts: { removable?: boolean } = {}) => (
    <div key={f.key} className="flex flex-col gap-1" data-testid={`field-${f.key}`}>
      <div className="flex items-center justify-between">
        <label className={labelClass}>
          {f.label.en}
          {f.required ? ' *' : ''}
          {f.unit && f.type !== 'number' ? ` (${f.unit})` : ''}
        </label>
        {opts.removable && (
          <button type="button" className="text-xs text-error" aria-label={`Remove ${f.label.en}`} onClick={() => { setPicked((p) => p.filter((k) => k !== f.key)); setValue(f.key, undefined); }}>
            Remove
          </button>
        )}
      </div>
      <AttributeInput field={f} value={values[f.key]} onChange={(v) => setValue(f.key, v)} />
    </div>
  );

  const taxCodeLabel = fulfilment === 'service' ? 'SAC code' : 'HSN code';

  /* The basic fields, one card per field group (e.g. "vehicle"); ungrouped ones stay in Basics. */
  const basicGroups = basicFields.reduce<Record<string, FieldDefinition[]>>((g, f) => ({ ...g, [f.group ?? '']: [...(g[f.group ?? ''] ?? []), f] }), {});
  const basicField = (f: FieldDefinition) =>
    isVisible(f.key) ? (
      fieldRow(f)
    ) : (
      <p key={f.key} className="text-xs text-on-surface-variant self-end">
        {f.label.en} is not shown for the chosen {label.lower('categories')}.
      </p>
    );
  const groupTitle = (g: string) => g.charAt(0).toUpperCase() + g.slice(1).replace(/_/g, ' ');

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      <Toast message={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div className="flex flex-col">
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
            {editing ? `Edit ${singular}` : `Add New ${singular}`}
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            {editing ? existing?.slug : `Fields come from your ${label.lower('categories')} and the attribute library`}
          </p>
        </div>
        {/* The page's actions, in the header */}
        <div className="flex items-center gap-space-xs flex-wrap" data-testid="form-actions">
          <Button variant="ghost" size="md" onClick={() => navigate(editing ? `/v2/products/${id}` : '/v2/products')}>
            Cancel
          </Button>
          <Button variant="soft" size="md" startIcon={saving === 'draft' ? <Icon name="sync" spin size="sm" /> : 'save'} onClick={() => void save(false)} disabled={saving !== null}>
            {saving === 'draft' ? 'Saving...' : 'Save draft'}
          </Button>
          <Button variant="primary" size="md" startIcon={saving === 'publish' ? <Icon name="sync" spin size="sm" /> : 'publish'} onClick={() => void save(true)} disabled={saving !== null}>
            {saving === 'publish' ? 'Publishing...' : 'Publish'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-space-md items-start">
        {/* Left: the sections as cards */}
        <div className="flex flex-col gap-space-md min-w-0">
      {formError && (
        <div className="mb-4 p-3 rounded-xl bg-error-container/40 border border-error/20 flex items-center gap-2 text-error text-sm" data-testid="form-error">
          <Icon name="error" size="sm" />
          <span role="alert">{formError}</span>
        </div>
      )}

      {/* Basics */}
        <section className={`${card} scroll-mt-4`} aria-label="Basics" id={sectionId('Basics')}>
          <CardTitle icon="description" title="Basics" />
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="p-name-en">Name (English) *</label>
            <input id="p-name-en" aria-label="Name (English)" className={inputClass} value={nameEn} maxLength={200} onChange={(e) => onName(e.target.value)} />
          </div>
          {/* Tamil / Hindi names as an Advanced option: closed by default, the count shows what is filled. */}
          <div className="flex flex-col gap-3">
            <button
              type="button"
              aria-expanded={langOpen}
              aria-controls="name-languages"
              onClick={() => setLangOpen((o) => !o)}
              className="flex items-center gap-1 text-sm font-medium text-primary self-start"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                {langOpen ? 'expand_more' : 'chevron_right'}
              </span>
              Advanced · Other languages{langFilled ? ` (${langFilled})` : ''}
            </button>
            {langOpen && (
              <div id="name-languages" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className={labelClass} htmlFor="p-name-ta">Tamil</label>
                  <input id="p-name-ta" aria-label="Name (Tamil)" className={inputClass} value={nameTa} maxLength={200} onChange={(e) => setNameTa(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={labelClass} htmlFor="p-name-hi">Hindi</label>
                  <input id="p-name-hi" aria-label="Name (Hindi)" className={inputClass} value={nameHi} maxLength={200} onChange={(e) => setNameHi(e.target.value)} />
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="p-slug">Slug</label>
              <input id="p-slug" aria-label="Slug" className={inputClass} value={slug} maxLength={120} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} />
              <span className="text-xs text-on-surface-variant">Made from the name; a clash gets “-2” when saved.</span>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="p-brand">Brand</label>
              <input id="p-brand" aria-label="Brand" className={inputClass} value={brand} maxLength={120} onChange={(e) => setBrand(e.target.value)} />
            </div>
          </div>
          {basicGroups[''] && <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{basicGroups[''].map(basicField)}</div>}
        </section>

      {/* Fields always on the form — template, required or grouped — a card per field group */}
      {Object.entries(basicGroups)
        .filter(([g]) => g)
        .map(([g, list]) => (
          <section key={g} className={`${card} scroll-mt-4`} aria-label={groupTitle(g)}>
            <CardTitle icon="tune" title={groupTitle(g)} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{list.map(basicField)}</div>
          </section>
        ))}

      {/* 2 Categories */}
      {(
        <section className={`${card} scroll-mt-4`} aria-label="Categories" id={sectionId('Categories')}>
          <CardTitle icon="folder" title="Categories" />
          <p className="text-sm text-on-surface-variant">
            Choose one or more {label.lower('categories')}. The first chosen is the primary one; the form shows the fields of all of them together.
          </p>
          {flatCats.length === 0 && <p className="text-sm text-on-surface-variant">No {label.lower('categories')} yet — add them on the {label.plural('categories')} (new) screen.</p>}
          {flatCats.length > 0 && (
            <input
              type="search"
              aria-label={`Search ${label.lower('categories')}`}
              className={inputClass}
              placeholder={`Search ${label.lower('categories')}`}
              value={categoryQuery}
              onChange={(e) => setCategoryQuery(e.target.value)}
            />
          )}
          {/* Badges: click to choose / un-choose; ★ marks (and sets) the primary one. */}
          <div className="flex flex-wrap gap-2" data-testid="category-badges">
            {shownCategories.map(({ node }) => {
              const on = categoryIds.includes(node.id);
              const primary = on && primaryId === node.id;
              return (
                <span
                  key={node.id}
                  className={`inline-flex items-center rounded-full border text-xs transition-colors ${
                    on ? 'bg-primary/10 border-primary/40 text-primary font-semibold' : 'border-surface-container-high text-on-surface hover:bg-surface-container-low'
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={`Category ${node.name.en}`}
                    onClick={() => toggleCategory(node.id)}
                    className={`flex items-center gap-1 py-1 ${on ? 'pl-2.5 pr-1' : 'px-2.5'}`}
                  >
                    {on && (
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">
                        check
                      </span>
                    )}
                    {categoryPath(node)}
                  </button>
                  {on && (
                    <button
                      type="button"
                      aria-label={primary ? `${node.name.en} is the primary ${label.lowerSingular('categories')}` : `Make ${node.name.en} primary`}
                      title={primary ? 'Primary' : 'Make primary'}
                      onClick={() => setPrimaryId(node.id)}
                      className="pr-2 pl-0.5 py-1 flex items-center"
                    >
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: primary ? "'FILL' 1" : "'FILL' 0" }} aria-hidden="true">
                        star
                      </span>
                    </button>
                  )}
                </span>
              );
            })}
            {flatCats.length > 0 && shownCategories.length === 0 && (
              <p className="text-xs text-on-surface-variant">No {label.lower('categories')} match “{categoryQuery.trim()}”.</p>
            )}
          </div>
          <p className="text-xs text-on-surface-variant" data-testid="visible-fields">
            Fields shown: {visible ? [...visible].map((k) => fields.get(k)?.label.en ?? k).join(', ') || 'none' : 'all attributes'}
          </p>
        </section>
      )}

      {/* Product settings (R13a–R13c) */}
        <section className={`${card} scroll-mt-4`} aria-label="Fulfilment · Track inventory · Tracking">
          <CardTitle icon="inventory_2" title="Fulfilment · Track inventory · Tracking" />
          <div className="flex flex-col gap-4" data-testid="product-settings">
            {/* One setting (track_inventory) as two radio buttons: exactly one is chosen.
                Track inventory shows the Tracking choice below it. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start" role="radiogroup" aria-label="Stock">
              {(
                [
                  { name: 'Always available', on: !trackInventory, value: false, hint: 'Not tracked — no stock count' },
                  { name: 'Track inventory', on: trackInventory, value: true, hint: 'Keep a stock count' },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.name}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    opt.on ? 'border-primary/50 bg-primary/5' : 'border-surface-container-high hover:bg-surface-container-low'
                  }`}
                >
                  <input
                    type="radio"
                    name="track-inventory"
                    aria-label={opt.name}
                    className="mt-0.5 w-4 h-4 accent-primary"
                    checked={opt.on}
                    onChange={() => setTrackInventory(opt.value)}
                  />
                  <span className="flex flex-col">
                    <span className={labelClass}>{opt.name}</span>
                    <span className="text-xs text-on-surface-variant">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
            {trackInventory && (
              <div className="flex flex-col gap-1 sm:max-w-xs">
                <label className={labelClass} htmlFor="p-tracking">Tracking</label>
                <select id="p-tracking" aria-label="Tracking" className={inputClass} value={tracking} onChange={(e) => setTracking(e.target.value as Tracking)}>
                  {(Object.keys(TRACKING_LABELS) as Tracking[]).map((t) => (
                    <option key={t} value={t}>
                      {TRACKING_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Fulfilment as an Advanced option: closed by default, showing the current value. */}
            <div className="border-t border-surface-container-low pt-3 flex flex-col gap-3">
              <button
                type="button"
                aria-expanded={fulfilmentOpen}
                aria-controls="fulfilment-advanced"
                onClick={() => setFulfilmentOpen((o) => !o)}
                className="flex items-center gap-1 text-sm font-medium text-primary self-start"
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  {fulfilmentOpen ? 'expand_more' : 'chevron_right'}
                </span>
                Advanced · {FULFILMENT_LABELS[fulfilment]}
                {isBundle ? ' · Bundle' : ''}
              </button>
              {fulfilmentOpen && (
                <div id="fulfilment-advanced" className="flex flex-col gap-1 sm:max-w-xs">
                  <label className={labelClass} htmlFor="p-fulfilment">Fulfilment</label>
                  <select id="p-fulfilment" aria-label="Fulfilment" className={inputClass} value={fulfilment} onChange={(e) => onFulfilment(e.target.value as Fulfilment)}>
                    {(Object.keys(FULFILMENT_LABELS) as Fulfilment[]).map((f) => (
                      <option key={f} value={f}>
                        {FULFILMENT_LABELS[f]}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {fulfilmentOpen && (
                <label className="flex items-start gap-2 sm:max-w-md cursor-pointer">
                  <input
                    type="checkbox"
                    aria-label="Sold as a bundle"
                    className="mt-0.5 w-4 h-4 accent-primary"
                    checked={isBundle}
                    disabled={rows.some((r) => r.pack && !r.deleted)}
                    onChange={(e) => setIsBundle(e.target.checked)}
                  />
                  <span className="flex flex-col">
                    <span className={labelClass}>Sold as a bundle</span>
                    <span className="text-xs text-on-surface-variant">
                      Its stock comes from the items it contains — choose them on the {label.lowerSingular('allProducts')} page after saving.
                      {rows.some((r) => r.pack && !r.deleted) ? ' (Not with packs.)' : ''}
                    </span>
                  </span>
                </label>
              )}
            </div>
          </div>
        </section>

      {/* 5 Variants */}
      {(
        <section className={`${card} scroll-mt-4`} aria-label="Variants" id={sectionId('Variants')}>
          {/* An accordion: closed by default, the header shows the variant options in use. */}
          <button
            type="button"
            aria-expanded={variantsOpen}
            aria-controls="variants-body"
            onClick={() => setVariantsOpen((o) => !o)}
            className="flex items-center justify-between gap-3 w-full text-left"
          >
            <CardTitle
              icon="style"
              title={allAxes.length ? `Variants · ${allAxes.map((a) => fields.get(a.key)?.label.en ?? a.key).join(', ')}` : 'Variants'}
            />
            <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">
              {variantsOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          {variantsOpen && (
          <div id="variants-body" className="flex flex-col gap-4">
          {/* No variants yet: a clear empty state with one action. */}
          {allAxes.length === 0 && !newVariant && (
            <div
              className="flex flex-col items-center text-center gap-2 py-8 px-4 rounded-xl border border-dashed border-surface-container-high bg-surface-container-low/40"
              data-testid="variants-empty"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Icon name="style" size="lg" />
              </div>
              <p className="text-sm font-semibold text-on-surface">This {label.lowerSingular('allProducts')} is sold as one item</p>
              <p className="text-xs text-on-surface-variant max-w-sm">Add options like Colour or Size to sell it in different versions.</p>
              {!axesLocked && <div className="mt-2">{variantMenu('primary')}</div>}
            </div>
          )}

          {/* One row per variant option: name, selected count, value pills, + Add value. */}
          {axes.map((axis) => {
            const f = fields.get(axis.key);
            if (!f) return null;
            const kept = existing?.variant_axes.find((a) => a.key === axis.key)?.values ?? [];
            const shown = f.options.filter((o) => !o.deprecated || axis.values.includes(o.value));
            const adding = addingValueFor === axis.key;
            return (
              <div key={axis.key} className="flex flex-col gap-3 rounded-xl border border-surface-container-high p-4" data-testid={`axis-${axis.key}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-semibold text-sm text-on-surface truncate">{f.label.en}</span>
                    <span className="text-xs text-on-surface-variant whitespace-nowrap">
                      {axis.values.length} of {shown.length} selected
                    </span>
                  </div>
                  {!axesLocked && (
                    <button
                      type="button"
                      onClick={() => removeAxis(axis.key)}
                      aria-label={`Remove variant option ${f.label.en}`}
                      title="Remove"
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors"
                    >
                      <Icon name="delete" size="sm" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {shown.map((o) => {
                    const on = axis.values.includes(o.value);
                    /* A value existing items use cannot be unticked here (the server refuses it). */
                    const locked = on && kept.includes(o.value) && existingItems.some((r) => r.attributes.some((a) => a.key === axis.key && a.value === o.value));
                    return (
                      <label
                        key={o.value}
                        title={locked ? 'Used by an item — cannot be removed here' : undefined}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors select-none ${
                          on ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-lowest text-on-surface border-surface-container-high hover:border-primary/50'
                        } ${locked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          aria-label={`${f.label.en} ${o.label.en}`}
                          checked={on}
                          disabled={locked}
                          onChange={() => toggleAxisValue(axis.key, o.value)}
                        />
                        {on && (
                          <span className="material-symbols-outlined text-sm" aria-hidden="true">
                            check
                          </span>
                        )}
                        {o.label.en}
                      </label>
                    );
                  })}

                  {/* + Add value: a pill that turns into a small box (saved to the shared attribute, R44). */}
                  {adding ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/50 bg-surface-container-lowest pl-3 pr-1 py-0.5">
                      <input
                        aria-label={`New ${f.label.en} option`}
                        autoFocus
                        className="w-28 bg-transparent text-xs focus:outline-none py-1"
                        placeholder="New value"
                        value={newOption[axis.key] ?? ''}
                        maxLength={120}
                        onChange={(e) => {
                          setNewOption((o) => ({ ...o, [axis.key]: e.target.value }));
                          setOptionWarning((w) => ({ ...w, [axis.key]: '' }));
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void addOption(axis.key);
                          }
                          if (e.key === 'Escape') setAddingValueFor(null);
                        }}
                      />
                      <button
                        type="button"
                        aria-label={`Add ${f.label.en} value`}
                        onClick={() => void addOption(axis.key)}
                        className="px-2 py-1 rounded-full text-xs font-semibold text-primary hover:bg-primary/10"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        aria-label="Close"
                        onClick={() => setAddingValueFor(null)}
                        className="px-1.5 py-1 rounded-full text-xs text-on-surface-variant hover:bg-surface-container-low"
                      >
                        ✕
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingValueFor(axis.key)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-surface-container-high text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">
                        add
                      </span>
                      Add value
                    </button>
                  )}
                </div>

                {optionWarning[axis.key] && (
                  <div className="flex items-center gap-2 text-xs text-amber-700" role="alert">
                    <span>{optionWarning[axis.key]}</span>
                    <button type="button" className="font-semibold underline" onClick={() => void addOption(axis.key, true)}>
                      Add anyway
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* A measured size (R45): amounts with a unit of the attribute's family — 500 ml, 1 l, 5 l. */}
          {sizeAxis &&
            (() => {
              const f = fields.get(sizeAxis.key);
              if (!f) return null;
              const units = f.unit_family ? UNITS_BY_FAMILY[f.unit_family] : [];
              return (
                <div className="flex flex-col gap-3 rounded-xl border border-surface-container-high p-4" data-testid={`axis-${sizeAxis.key}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="font-semibold text-sm text-on-surface truncate">{f.label.en}</span>
                      <span className="text-xs text-on-surface-variant whitespace-nowrap">
                        {sizeAxis.values.length} {sizeAxis.values.length === 1 ? 'size' : 'sizes'}
                      </span>
                    </div>
                    {!axesLocked && (
                      <button
                        type="button"
                        onClick={() => removeAxis(sizeAxis.key)}
                        aria-label={`Remove variant option ${f.label.en}`}
                        title="Remove"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/30 transition-colors"
                      >
                        <Icon name="delete" size="sm" />
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {sizeAxis.values.map((v) => {
                      const base = measureBase(v);
                      /* A size existing items use cannot be removed here (the server refuses it). */
                      const used = existingItems.some((r) => r.attributes.some((a) => a.key === sizeAxis.key && a.value === base));
                      return (
                        <span
                          key={base}
                          title={used ? 'Used by an item — cannot be removed here' : undefined}
                          className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-primary text-on-primary text-xs font-medium"
                        >
                          {measureText(v)}
                          {!used && (
                            <button type="button" aria-label={`Remove size ${measureText(v)}`} onClick={() => removeSize(base)} className="px-1.5 leading-none opacity-80 hover:opacity-100">
                              ✕
                            </button>
                          )}
                        </span>
                      );
                    })}
                    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/50 bg-surface-container-lowest pl-3 pr-1 py-0.5">
                      <input
                        aria-label={`${f.label.en} amount`}
                        inputMode="decimal"
                        className="w-16 bg-transparent text-xs focus:outline-none py-1"
                        placeholder="Amount"
                        value={newSize.amount}
                        onChange={(e) => setNewSize({ ...newSize, amount: e.target.value, note: null })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addSize();
                          }
                        }}
                      />
                      <select
                        aria-label={`${f.label.en} unit`}
                        className="bg-transparent text-xs focus:outline-none py-1"
                        value={newSize.unit || units[0]}
                        onChange={(e) => setNewSize({ ...newSize, unit: e.target.value, note: null })}
                      >
                        {units.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label={`Add ${f.label.en} size`}
                        onClick={addSize}
                        disabled={!newSize.amount.trim()}
                        className="px-2 py-1 rounded-full text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-40"
                      >
                        Add
                      </button>
                    </span>
                  </div>
                  {newSize.note && (
                    <p className="text-xs text-error" role="alert">
                      {newSize.note}
                    </p>
                  )}
                  <p className="text-xs text-on-surface-variant">Each size is its own item with its own price and stock; the price per unit is worked out from the price.</p>
                </div>
              );
            })()}

          {/* Admin: a new variant option, written inline like the rows above, saved to the library (R40). */}
          {newVariant && (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/40 bg-primary/[0.03] p-4" data-testid="new-variant-option">
              <input
                aria-label="Variant option name"
                className={smallInput}
                placeholder="Option name, e.g. Size"
                value={newVariant.label}
                maxLength={120}
                onChange={(e) => setNewVariant({ ...newVariant, label: e.target.value, note: null })}
              />
              <div className="flex flex-wrap items-center gap-2" aria-label="Variant option values">
                {newVariant.options.map((v) => (
                  <span key={v} className="inline-flex items-center gap-1 pl-3 pr-1 py-1 rounded-full bg-primary text-on-primary text-xs font-medium">
                    {v}
                    <button
                      type="button"
                      aria-label={`Remove ${v}`}
                      onClick={() => setNewVariant({ ...newVariant, options: newVariant.options.filter((x) => x !== v) })}
                      className="px-1.5 leading-none opacity-80 hover:opacity-100"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/50 bg-surface-container-lowest pl-3 pr-1 py-0.5">
                  <input
                    aria-label="Variant option value"
                    className="w-28 bg-transparent text-xs focus:outline-none py-1"
                    placeholder="Add value"
                    value={newVariant.draft}
                    maxLength={120}
                    onChange={(e) => setNewVariant({ ...newVariant, draft: e.target.value, note: null })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addNewVariantOption();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={addNewVariantOption}
                    disabled={!newVariant.draft.trim()}
                    className="px-2 py-1 rounded-full text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-40"
                  >
                    Add
                  </button>
                </span>
              </div>
              {newVariant.note && (
                <p className="text-xs text-error" role="alert">
                  {newVariant.note}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setNewVariant(null)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={() => void createVariantOption()} disabled={!newVariant.label.trim() || !newVariant.options.length}>
                  Save
                </Button>
              </div>
            </div>
          )}

          {axesLocked && <p className="text-xs text-on-surface-variant">Items exist, so the variant options are fixed — you can tick more values and add the new combinations.</p>}

          {/* Footer: add another option on the left, preview on the right. */}
          {(allAxes.length > 0 || newVariant) && (
            <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
              <div>{!axesLocked && !newVariant && variantMenu('link')}</div>
              {allAxes.length > 0 && (
                <Button variant="primary" size="sm" startIcon="grid_view" onClick={() => void runPreview()} disabled={allAxes.some((a) => !a.values.length)}>
                  {allAxes.some((a) => !a.values.length) ? 'Preview combinations' : `Preview ${combinationCount} combination${combinationCount === 1 ? '' : 's'}`}
                </Button>
              )}
            </div>
          )}

          {preview && (
            <div className="flex flex-col gap-2" data-testid="variant-preview">
              <p className="text-sm text-on-surface-variant">
                {preview.length} combinations — tick the ones you sell ({preview.filter((c) => !c.exists).length} new).
              </p>
              <table className="text-sm" aria-label="Combinations">
                <tbody>
                  {preview.map((c) => (
                    <tr key={c.attribute_signature} className="border-b border-surface-container-low">
                      <td className="py-1 pr-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-primary"
                          aria-label={`Combination ${c.attributes.map((a) => valueLabel(a.key, a.value)).join(' / ')}`}
                          disabled={c.exists}
                          checked={c.exists || previewPicked.has(c.attribute_signature)}
                          onChange={() =>
                            setPreviewPicked((s) => {
                              const n = new Set(s);
                              if (n.has(c.attribute_signature)) n.delete(c.attribute_signature);
                              else n.add(c.attribute_signature);
                              return n;
                            })
                          }
                        />
                      </td>
                      <td className="py-1 pr-4">{c.attributes.map((a) => valueLabel(a.key, a.value)).join(' / ')}</td>
                      <td className="py-1 text-xs text-on-surface-variant">{c.exists ? 'Already an item' : c.suggested_sku}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div>
                <Button variant="primary" size="sm" onClick={createSelected} disabled={![...previewPicked].some((s) => preview.some((c) => c.attribute_signature === s && !c.exists))}>
                  Create selected
                </Button>
              </div>
            </div>
          )}
          </div>
          )}
        </section>
      )}

      {/* 6 Items — one item: a simple form; variants: Grid (photo cards) or List (rows) */}
      {(
        <section className={`${card} scroll-mt-4`} aria-label="Items" id={sectionId('Items')}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle icon="view_list" title={allAxes.length ? 'Items' : 'Pricing & stock'} />
            {allAxes.length > 0 && rows.length > 0 && (
              <div className="inline-flex rounded-lg border border-surface-container-high p-0.5" role="group" aria-label="Items view">
                {(['grid', 'list'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={itemsView === v}
                    aria-label={v === 'grid' ? 'Grid view' : 'List view'}
                    title={v === 'grid' ? 'Grid view' : 'List view'}
                    onClick={() => setItemsView(v)}
                    className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${itemsView === v ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                  >
                    <span className="material-symbols-outlined text-base" aria-hidden="true">
                      {v === 'grid' ? 'grid_view' : 'view_list'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* No variants: one item, shown as a plain form with its picture. */}
          {allAxes.length === 0 &&
            rows
              .filter((r) => !r.deleted && !r.pack)
              .slice(0, 1)
              .map((r) => (
                <div key={r.rowId} className="flex flex-col md:flex-row gap-6" data-testid={`row-${r.sku || r.rowId}`}>
                  {/* One item: its pictures are the product's (the sidebar images card is not shown). */}
                  <div className="md:w-72 shrink-0">
                    <ImageGallery label={`${singular} images`} value={media} onChange={setMedia} />
                  </div>
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">{itemMainFields(r)}</div>
                    {itemMoreFields(r)}
                  </div>
                </div>
              ))}

          {/* A product without variants: its packs (e.g. Box of 4) under the single item. */}
          {allAxes.length === 0 && rows.some((r) => r.pack && !r.deleted) && (
            <div className="flex flex-col gap-3 border-t border-surface-container-low pt-3" data-testid="packs">
              <h3 className="text-sm font-semibold text-on-surface">Packs</h3>
              {rows
                .filter((r) => r.pack && !r.deleted)
                .map((r) => (
                  <div key={r.rowId} className={`flex flex-col gap-2 rounded-xl border border-surface-container-high p-3 ${r.remove ? 'opacity-60' : ''}`} data-testid={`row-${r.sku || r.rowId}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-on-surface">{itemTitle(r)}</span>
                      {statusBadge(r)}
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{itemMainFields(r)}</div>
                    {itemActions(r)}
                  </div>
                ))}
            </div>
          )}

          {allAxes.length > 0 && rows.length === 0 && (
            <p className="text-sm text-on-surface-variant">No items yet — create them from the combinations in Variants.</p>
          )}

          {allAxes.length > 0 && rows.length > 0 && (
            <>
              {/* Summary + selection + Apply to selected */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-on-surface-variant" data-testid="items-summary">
                  {itemsSummary}
                </p>
                <label className="flex items-center gap-2 text-xs font-medium text-on-surface-variant cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-primary"
                    aria-label="Select all items"
                    checked={allSelected}
                    onChange={() => setSelectedRows(allSelected ? new Set() : new Set(liveRows.map((r) => r.rowId)))}
                  />
                  Select all
                </label>
              </div>
              {selectedRows.size > 0 && (
                <div className="flex items-center gap-2 flex-wrap px-3 py-2 rounded-lg bg-primary-container/10 border border-primary/20" data-testid="bulk-bar">
                  <span className="text-xs font-semibold text-primary">{selectedRows.size} selected · Apply to selected:</span>
                  <select aria-label="Field to apply" className={`${smallInput} w-32`} value={bulk.field} onChange={(e) => setBulk({ field: e.target.value as typeof bulk.field, value: e.target.value === 'status' ? 'active' : '', note: null })}>
                    <option value="price">Price ₹</option>
                    <option value="mrp">MRP ₹</option>
                    <option value="stock">Initial stock</option>
                    <option value="status">Status</option>
                  </select>
                  {bulk.field === 'status' ? (
                    <select aria-label="Value to apply" className={`${smallInput} w-32`} value={bulk.value} onChange={(e) => setBulk({ ...bulk, value: e.target.value, note: null })}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  ) : (
                    <input aria-label="Value to apply" inputMode="decimal" className={`${smallInput} w-36`} value={bulk.value} onChange={(e) => setBulk({ ...bulk, value: e.target.value, note: null })} />
                  )}
                  <Button variant="primary" size="sm" onClick={applyBulk}>
                    Apply
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedRows(new Set())}>
                    Clear
                  </Button>
                  {bulk.note && <span className="text-xs text-on-surface-variant">{bulk.note}</span>}
                </div>
              )}

              {/* GRID: photo-first cards; clicking one opens it in a popup */}
              {itemsView === 'grid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="items-grid">
                  {rows.map((r) => {
                    const t = itemThumb(r);
                    const off = r.deleted || r.remove;
                    return (
                      <div key={r.rowId} className={`relative rounded-xl border border-surface-container-high p-3 flex flex-col gap-2 hover:border-primary/40 transition-colors ${off ? 'opacity-60' : ''}`} data-testid={`row-${r.sku || r.rowId}`}>
                        <div className="flex items-center justify-between">
                          {!r.deleted && !r.remove ? (
                            <input type="checkbox" className="w-4 h-4 accent-primary" aria-label={`Select ${itemTitle(r)}`} checked={selectedRows.has(r.rowId)} onChange={() => toggleSelected(r.rowId)} />
                          ) : (
                            <span />
                          )}
                          {statusBadge(r)}
                        </div>
                        <button type="button" aria-label={`Open ${itemTitle(r)}`} aria-haspopup="dialog" onClick={() => setOpenItem(r.rowId)} className="flex flex-col gap-2 text-left">
                          {thumbBox(r, 'card')}
                          {t.from && <span className="text-[11px] text-on-surface-variant -mt-1">{t.from}</span>}
                          <span className="font-semibold text-sm text-on-surface truncate">{itemTitle(r)}</span>
                          <span className="text-[11px] text-on-surface-variant truncate">{r.sku || 'SKU made on save'}</span>
                          <span className="flex items-center justify-between text-sm">
                            <span className="font-semibold text-on-surface">{itemPrice(r)}</span>
                            <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                              {itemStock(r)}
                              <span className="material-symbols-outlined text-base" aria-hidden="true">
                                expand_more
                              </span>
                            </span>
                          </span>
                          {perUnitText(r) && <span className="text-[11px] text-on-surface-variant -mt-1">{perUnitText(r)}</span>}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* LIST: compact rows; More details expands below a row */}
              {itemsView === 'list' && (
                <div className="flex flex-col divide-y divide-surface-container-low border border-surface-container-high rounded-xl" data-testid="items-list">
                  {rows.map((r) => {
                    const open = openItem === r.rowId;
                    const off = r.deleted || r.remove;
                    return (
                      <div key={r.rowId} className={`p-3 flex flex-col gap-3 ${off ? 'opacity-60' : ''}`} data-testid={`row-${r.sku || r.rowId}`}>
                        <div className="flex items-center gap-3 flex-wrap lg:flex-nowrap">
                          {!r.deleted && !r.remove ? (
                            <input type="checkbox" className="w-4 h-4 accent-primary shrink-0" aria-label={`Select ${itemTitle(r)}`} checked={selectedRows.has(r.rowId)} onChange={() => toggleSelected(r.rowId)} />
                          ) : (
                            <span className="w-4 shrink-0" />
                          )}
                          {thumbBox(r, 'row')}
                          <div className="min-w-[8rem] flex flex-col">
                            <span className="font-semibold text-sm text-on-surface truncate">{itemTitle(r)}</span>
                            <span className="flex items-center gap-1">{statusBadge(r)}</span>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 flex-1">{itemMainFields(r)}</div>
                          <button
                            type="button"
                            aria-expanded={open}
                            aria-label={open ? `Hide details for ${itemTitle(r)}` : `More details for ${itemTitle(r)}`}
                            onClick={() => setOpenItem(open ? null : r.rowId)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low shrink-0"
                          >
                            <span className="material-symbols-outlined" aria-hidden="true">
                              {open ? 'expand_less' : 'more_horiz'}
                            </span>
                          </button>
                        </div>
                        {open && <div className="pl-7">{itemMoreFields(r)}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
          <p className="text-xs text-on-surface-variant">Prices in ₹ (paise are kept exactly). Empty = “Not priced”. Stock for existing items changes through stock adjustments.</p>
        </section>
      )}

      {/* The per-option images card (Colour = Red …) is hidden for now: photos go on the product or on each variant.
         Existing option images are kept and sent back unchanged on save. */}

      {/* Description */}
        <section className={`${card} scroll-mt-4`} aria-label="Description">
          <CardTitle icon="notes" title="Description" />
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="p-desc">Description</label>
            <textarea id="p-desc" aria-label="Description" rows={3} className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary resize-none text-sm" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

        </section>

      {/* Tax — below Description, as an accordion */}
      {(
        <section className={`${card} scroll-mt-4`} aria-label="Tax" id={sectionId('Tax')}>
          {/* An accordion: closed by default, the header shows what is filled. */}
          <button
            type="button"
            aria-expanded={taxOpen}
            aria-controls="tax-body"
            onClick={() => setTaxOpen((o) => !o)}
            className="flex items-center justify-between gap-3 w-full text-left"
          >
            <CardTitle icon="sell" title={taxSummary ? `Tax · ${taxSummary}` : 'Tax'} />
            <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">
              {taxOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          {taxOpen && (
          <div id="tax-body">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="p-taxcode">{taxCodeLabel}</label>
              <input
                id="p-taxcode"
                aria-label={taxCodeLabel}
                inputMode="numeric"
                className={inputClass}
                placeholder={fulfilment === 'service' ? 'e.g. 998714' : 'e.g. 8703'}
                value={fulfilment === 'service' ? sac : hsn}
                onChange={(e) => (fulfilment === 'service' ? setSac(e.target.value) : setHsn(e.target.value))}
              />
              <span className="text-xs text-on-surface-variant">{fulfilment === 'service' ? 'Services use a SAC code.' : 'Goods use an HSN code.'} 4–8 digits.</span>
            </div>
            <div className="flex flex-col gap-1">
              <label className={labelClass} htmlFor="p-gst">GST rate</label>
              <select id="p-gst" aria-label="GST rate" className={inputClass} value={gst} onChange={(e) => setGst(e.target.value)}>
                <option value="">—</option>
                {GST_RATES.map((r) => (
                  <option key={r} value={String(r)}>
                    {r}%
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className={labelClass}>Prices include GST</span>
              <label className="flex items-center gap-2 h-10 text-sm">
                <input
                  type="checkbox"
                  aria-label="Prices include GST"
                  className="w-4 h-4 accent-primary"
                  checked={taxInclusive}
                  onChange={(e) => {
                    setTaxInclusive(e.target.checked);
                    /* The default for items still following it; each item can differ. */
                    setRows((cur) => cur.map((r) => (r.id ? r : { ...r, taxInclusive: e.target.checked })));
                  }}
                />
                {taxInclusive ? 'Yes (MRP-style)' : 'No — GST added at checkout'}
              </label>
            </div>
          </div>
          </div>
          )}
        </section>
      )}

      {/* Purchase limits (R50) — optional, as an accordion */}
      <section className={`${card} scroll-mt-4`} aria-label="Purchase limits" id={sectionId('Purchase limits')}>
        <button
          type="button"
          aria-expanded={limitsOpen}
          aria-controls="limits-body"
          onClick={() => setLimitsOpen((o) => !o)}
          className="flex items-center justify-between gap-3 w-full text-left"
        >
          <CardTitle icon="production_quantity_limits" title={limitsSummaryText(limitsInput(limits)) ? `Purchase limits · ${limitsSummaryText(limitsInput(limits))}` : 'Purchase limits'} />
          <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">
            {limitsOpen ? 'expand_less' : 'expand_more'}
          </span>
        </button>
        {limitsOpen && (
          <div id="limits-body" className="flex flex-col gap-3">
            <p className="text-xs text-on-surface-variant">
              Optional — leave empty for no limit.{allAxes.length > 0 ? ' Each item can set its own (open an item → Purchase limits for this item).' : ''} Shown to
              customers now; enforced at checkout once orders exist.
            </p>
            <LimitsFields name="Limit" value={limits} onChange={setLimits} />
          </div>
        )}
      </section>

      {/* More attributes — below Description, as an accordion */}
      {(
        <section className={`${card} scroll-mt-4`} aria-label="More attributes" id={sectionId('More attributes')}>
          {/* An accordion: closed by default, the count shows what is inside. */}
          <button
            type="button"
            aria-expanded={moreOpen}
            aria-controls="more-attributes-body"
            onClick={() => setMoreOpen((o) => !o)}
            className="flex items-center justify-between gap-3 w-full text-left"
          >
            <CardTitle icon="list" title={moreFilled ? `More attributes · ${moreFilled}` : 'More attributes'} />
            <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">
              {moreOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          {moreOpen && (
          <div id="more-attributes-body" className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pickedShown.map((k) => fields.get(k)).filter(Boolean).map((f) => fieldRow(f!, { removable: true }))}
          </div>
          {pickedShown.length === 0 && <p className="text-sm text-on-surface-variant">Only the basic fields so far. Add more from the attribute library.</p>}

          <div className="flex flex-col gap-2 border-t border-surface-container-low pt-3">
            <label className={labelClass} htmlFor="p-picker">+ Add attribute</label>
            <input id="p-picker" aria-label="Find an attribute" className={inputClass} placeholder="Search the attribute library" value={pickerQuery} onChange={(e) => setPickerQuery(e.target.value)} />
            <div className="flex flex-col gap-2" data-testid="attribute-picker">
              {Object.entries(
                pickable
                  .filter((f) => f.label.en.toLowerCase().includes(pickerQuery.trim().toLowerCase()))
                  .reduce<Record<string, FieldDefinition[]>>((g, f) => ({ ...g, [f.group || 'Other']: [...(g[f.group || 'Other'] ?? []), f] }), {})
              ).map(([group, list]) => (
                <div key={group}>
                  <p className="text-[10.5px] font-bold text-outline uppercase tracking-wider">{group}</p>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {list.map((f) => (
                      <button key={f.key} type="button" className="px-2.5 py-1 rounded-full border border-surface-container-high text-xs hover:bg-surface-container-low" onClick={() => setPicked((p) => [...p, f.key])}>
                        + {f.label.en} <span className="text-outline">({FIELD_TYPE_LABELS[f.type]})</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {pickable.length === 0 && <p className="text-xs text-on-surface-variant">Every attribute that fits is already on the form.</p>}
            </div>
            {isAdmin && (
              <div>
                <Button variant="soft" size="sm" startIcon="add" onClick={() => setCreating({ label: '', type: 'text', options: '' })}>
                  Create new attribute
                </Button>
              </div>
            )}
          </div>

          {retiredKept.length > 0 && (
            <div className="border-t border-surface-container-low pt-3 text-sm" data-testid="retired-values">
              <p className={labelClass}>Retired attributes (read-only, kept on save)</p>
              {retiredKept.map((f) => (
                <p key={f.key} className="text-on-surface-variant">
                  {f.label.en}: {String(typeof values[f.key] === 'object' ? (values[f.key] as any).en : values[f.key])}
                </p>
              ))}
            </div>
          )}
          </div>
          )}
        </section>
      )}
        </div>

        {/* Right: images and the summary — stays in view */}
        <aside className="flex flex-col gap-space-md lg:sticky lg:top-4" data-testid="save-panel">
          {/* With variants the product images live here; a single item shows them in Pricing & stock. */}
          {allAxes.length > 0 && (
            <section className={card} aria-label={`${singular} images`}>
              <CardTitle icon="image" title={`${singular} images`} />
              <MediaUploader label={`${singular} images`} value={media.map((m) => ({ url: m.url, kind: m.kind }))} onChange={(next) => setMedia(next.map((m, i) => ({ ...m, sort_order: i })))} accept={['image', 'video']} />
            </section>
          )}

          <section className={card} aria-label="Summary">
        <div className="text-xs text-on-surface-variant flex flex-col gap-1" data-testid="review">
          <p className="text-sm text-on-surface">
            <strong>{nameEn || '(no name)'}</strong> · {FULFILMENT_LABELS[fulfilment]} · Track inventory {trackInventory ? `on (${TRACKING_LABELS[tracking]})` : 'off'}
          </p>
          <p>
            {categoryIds.length} {label.lower('categories')} · {liveRows.length} {liveRows.length === 1 ? 'item' : 'items'} · GST {gst || '—'}% ·{' '}
            {fulfilment === 'service' ? `SAC ${sac || '—'}` : `HSN ${hsn || '—'}`} · A draft can be incomplete; publishing needs the required fields and an active item.
          </p>
          {limitsSummaryText(limitsInput(limits)) && <p>Limits: {limitsSummaryText(limitsInput(limits))}</p>}
        </div>
          </section>

      {problems.length > 0 && (
        <div id="problems" className="p-4 rounded-xl bg-error-container/40 border border-error/20 text-error scroll-mt-4" role="alert" data-testid="problems">
          <p className="text-sm font-semibold mb-1">{editing || (location.state as any)?.publishProblems ? 'Saved as a draft — not published yet:' : 'Please fix:'}</p>
          <ul className="list-disc pl-5 text-sm">
            {problems.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

        </aside>
      </div>

      {/* Grid: the open item in a popup (design Oct 2026): Basic Information · Purchase Limits · Packs · More.
          Changes apply to the form straight away; Save draft / Publish saves them. */}
      {itemsView === 'grid' &&
        allAxes.length > 0 &&
        (() => {
          const at = rows.findIndex((x) => x.rowId === openItem);
          if (at < 0) return null;
          const r = rows[at];
          const prev = rows[at - 1];
          const next = rows[at + 1];
          const name = r.sku || 'item';
          const off = r.deleted || r.remove;
          const packsOfThis = rows.filter((x) => x.pack && !x.deleted && baseOf(x)?.rowId === r.rowId);

          /** Typed packs become items when leaving the popup; an invalid one keeps it open. */
          const commitPacks = (): boolean => {
            const filled = popupPacks.filter((d) => d.quantity.trim() || d.price.trim() || d.sku.trim());
            const made: ItemRow[] = [];
            const taken = new Set(packsOfThis.filter((x) => !x.remove).map((x) => x.pack!.quantity));
            for (const d of filled) {
              const q = d.quantity.trim();
              if (!/^\d+$/.test(q) || Number(q) < 2) return setPopupPackNote('Each pack needs a whole number of 2 or more'), false;
              if (taken.has(Number(q))) return setPopupPackNote(`A pack of ${q} already exists`), false;
              const price = parseRupees(d.price);
              if ('error' in price) return setPopupPackNote(price.error), false;
              taken.add(Number(q));
              made.push(
                newRow(
                  { sku: d.sku.trim(), attributes: r.attributes, price: d.price.trim(), pack: { baseItemId: r.id, baseRowId: r.rowId, quantity: Number(q) } },
                  r.taxInclusive
                )
              );
            }
            if (made.length) {
              setRows((cur) => {
                const i = cur.findIndex((x) => x.rowId === r.rowId);
                let end = i + 1;
                while (end < cur.length && cur[end].pack && baseOf(cur[end])?.rowId === r.rowId) end++;
                return [...cur.slice(0, end), ...made, ...cur.slice(end)];
              });
            }
            setPopupPacks([]);
            setPopupPackNote(null);
            return true;
          };
          const leave = (target: string | null) => {
            if (!commitPacks()) return;
            setOpenItem(target);
          };

          const card = 'rounded-xl border border-surface-container-high p-4 flex flex-col gap-3';
          const head = (icon: string, text: string, right?: React.ReactNode) => (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Icon name={icon} size="sm" />
                </div>
                <h3 className="text-sm font-semibold text-on-surface">{text}</h3>
              </div>
              {right}
            </div>
          );

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-label={itemTitle(r)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') leave(null);
              }}
            >
              <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto border border-surface-container-high flex flex-col" data-testid="item-popup">
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-surface-container-low">
                  <div className="flex items-center gap-3 min-w-0">
                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">{itemTitle(r)}</h2>
                    {statusBadge(r)}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm text-on-surface-variant mr-2">
                      {at + 1} of {rows.length}
                    </span>
                    <Button variant="outline" size="icon-sm" startIcon="chevron_left" disabled={!prev} onClick={() => prev && leave(prev.rowId)} aria-label="Previous variant" title="Previous" />
                    <Button variant="outline" size="icon-sm" startIcon="chevron_right" disabled={!next} onClick={() => next && leave(next.rowId)} aria-label="Next variant" title="Next" />
                    <Button variant="ghost" size="icon-sm" startIcon="close" onClick={() => leave(null)} aria-label="Close" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[minmax(0,22rem)_1fr]">
                  <div className="p-6 md:border-r border-surface-container-low">
                    <ImageGallery label="Images for this variant" value={r.media} onChange={(m) => updateRow(r.rowId, { media: m })} />
                  </div>

                  <div className="p-6 flex flex-col gap-4">
                    {/* Basic Information */}
                    <section className={card} aria-label="Basic Information">
                      {head('inventory_2', 'Basic Information')}
                      <div className="grid grid-cols-2 gap-3">
                        {itemMainFields(r)}
                        {!r.pack && (
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-on-surface-variant">Track inventory</label>
                            <select aria-label={`Track inventory ${name}`} className={smallInput} value={r.track} disabled={off} onChange={(e) => updateRow(r.rowId, { track: e.target.value as ItemRow['track'] })}>
                              <option value="same">Same as {label.lowerSingular('allProducts')} ({trackInventory ? 'On' : 'Off'})</option>
                              <option value="on">On</option>
                              <option value="off">Off</option>
                            </select>
                          </div>
                        )}
                        {/* Rental price unit and the tax overrides (only once tax is set). */}
                              {fulfilment === 'rental' && (
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs font-medium text-on-surface-variant">Price per</label>
                                  <select aria-label={`Price per ${name}`} className={smallInput} value={r.priceUnit} disabled={off} onChange={(e) => updateRow(r.rowId, { priceUnit: e.target.value as PriceUnit })}>
                                    {PRICE_UNITS.map((u) => (
                                      <option key={u} value={u}>
                                        {u}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                              {showItemTax && (
                                <>
                                  <label className="flex items-center gap-2 text-xs font-medium text-on-surface-variant pt-5">
                                    <input type="checkbox" aria-label={`Includes GST ${name}`} className="w-4 h-4 accent-primary" checked={r.taxInclusive} disabled={off} onChange={(e) => updateRow(r.rowId, { taxInclusive: e.target.checked })} />
                                    Incl. GST
                                  </label>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-on-surface-variant">GST</label>
                                    <select aria-label={`GST ${name}`} className={smallInput} value={r.gst} disabled={off} onChange={(e) => updateRow(r.rowId, { gst: e.target.value })}>
                                      <option value="">Same</option>
                                      {GST_RATES.map((g) => (
                                        <option key={g} value={String(g)}>
                                          {g}%
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  {fulfilment !== 'service' && (
                                    <div className="flex flex-col gap-1">
                                      <label className="text-xs font-medium text-on-surface-variant">HSN</label>
                                      <input aria-label={`HSN ${name}`} className={smallInput} placeholder="Same" value={r.hsn} disabled={off} onChange={(e) => updateRow(r.rowId, { hsn: e.target.value })} />
                                    </div>
                                  )}
                                </>
                              )}
                      </div>
                    </section>

                    {/* Purchase Limits (min / max per order) */}
                    <section className={card} aria-label="Purchase Limits">
                      <button
                        type="button"
                        aria-expanded={Boolean(r.limitsOpen)}
                        onClick={() => updateRow(r.rowId, { limitsOpen: !r.limitsOpen })}
                        className="w-full text-left"
                      >
                        {head(
                          'shopping_cart',
                          'Purchase Limits',
                          <span className="flex items-center gap-2 text-xs text-on-surface-variant">
                            {limitsSummaryText(limitsInput(r.limits)) || (limitsSummaryText(limitsInput(limits)) ? `Same as ${label.lowerSingular('allProducts')}` : 'None')}
                            <span className="material-symbols-outlined text-base" aria-hidden="true">
                              {r.limitsOpen ? 'expand_less' : 'expand_more'}
                            </span>
                          </span>
                        )}
                      </button>
                      {r.limitsOpen && <LimitsFields name={`Limit ${name}`} value={r.limits} inherited={limits} disabled={off} onChange={(nextLimits) => updateRow(r.rowId, { limits: nextLimits })} />}
                    </section>

                    {/* Packs of this variant (R47–R49) */}
                    {r.pack ? (
                      <section className={card} aria-label="Packs">
                        {head('inventory', 'Pack')}
                        <p className="text-sm text-on-surface-variant">
                          A pack of {r.pack.quantity} × {baseOf(r) ? plainTitle(baseOf(r)!) : 'its base item'} — sold from that item's stock.
                        </p>
                      </section>
                    ) : (
                      canAddPack(r) && (
                        <section className={card} aria-label="Packs">
                          {head(
                            'inventory',
                            'Packs',
                            <Button variant="outline" size="sm" startIcon="add" onClick={() => setPopupPacks((cur) => [...cur, { key: Date.now(), quantity: '', price: '', sku: '' }])}>
                              Add pack
                            </Button>
                          )}
                          {packsOfThis.length === 0 && popupPacks.length === 0 && (
                            <p className="text-xs text-on-surface-variant">No packs. Sell this item in bigger quantities (e.g. a box of 4) with "Add pack".</p>
                          )}
                          {packsOfThis.map((x) => {
                            const xn = x.sku || 'pack';
                            return (
                              <div key={x.rowId} className={`rounded-lg bg-surface-container-low/60 p-3 flex flex-col gap-2 ${x.remove ? 'opacity-60' : ''}`} data-testid={`popup-pack-${xn}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-semibold text-on-surface">
                                    Pack of {x.pack!.quantity}
                                    {packSavingText(x) && <span className="ml-2 text-xs font-medium text-secondary">{packSavingText(x)}</span>}
                                  </span>
                                  {!x.id ? (
                                    <button type="button" className="text-xs font-medium text-error flex items-center gap-1" aria-label={`Remove ${xn}`} onClick={() => setRows((cur) => cur.filter((y) => y.rowId !== x.rowId))}>
                                      <span className="material-symbols-outlined text-sm" aria-hidden="true">
                                        delete
                                      </span>
                                      Remove
                                    </button>
                                  ) : (
                                    isAdmin && (
                                      <button type="button" className="text-xs font-medium text-error" aria-label={x.remove ? `Keep ${xn}` : `Delete ${xn}`} onClick={() => updateRow(x.rowId, { remove: !x.remove })}>
                                        {x.remove ? 'Keep' : 'Delete'}
                                      </button>
                                    )
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <input aria-label={`Price ${xn}`} inputMode="decimal" placeholder="Pack price ₹" className={smallInput} value={x.price} disabled={x.remove} onChange={(e) => updateRow(x.rowId, { price: e.target.value })} />
                                  <input aria-label={`SKU ${xn}`} placeholder="SKU (optional)" className={smallInput} value={x.sku} disabled={x.remove} onChange={(e) => updateRow(x.rowId, { sku: e.target.value })} />
                                </div>
                              </div>
                            );
                          })}
                          {popupPacks.map((d, i) => (
                            <div key={d.key} className="rounded-lg border border-primary/30 bg-primary/[0.03] p-3 flex flex-col gap-2" data-testid="popup-pack-draft">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-on-surface">New pack of {itemTitle(r)}</span>
                                <button
                                  type="button"
                                  className="text-xs font-medium text-error flex items-center gap-1"
                                  aria-label="Remove new pack"
                                  onClick={() => setPopupPacks((cur) => cur.filter((y) => y.key !== d.key))}
                                >
                                  <span className="material-symbols-outlined text-sm" aria-hidden="true">
                                    delete
                                  </span>
                                  Remove
                                </button>
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                {(
                                  [
                                    ['quantity', 'Quantity', 'e.g. 4', 'numeric'],
                                    ['price', 'Pack price (₹)', 'e.g. 10000', 'decimal'],
                                    ['sku', 'SKU (optional)', 'e.g. PACK-001', 'text'],
                                  ] as const
                                ).map(([k, text, ph, mode]) => (
                                  <div key={k} className="flex flex-col gap-1">
                                    <label className="text-xs font-medium text-on-surface-variant">{text}</label>
                                    <input
                                      aria-label={`New pack ${text} ${i + 1}`}
                                      inputMode={mode}
                                      placeholder={ph}
                                      className={smallInput}
                                      value={d[k]}
                                      onChange={(e) => {
                                        setPopupPackNote(null);
                                        setPopupPacks((cur) => cur.map((y) => (y.key === d.key ? { ...y, [k]: e.target.value } : y)));
                                      }}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                          {popupPackNote && (
                            <p className="text-xs text-error" role="alert">
                              {popupPackNote}
                            </p>
                          )}
                        </section>
                      )
                    )}

                  </div>
                </div>

                <div className="flex justify-between items-center gap-3 px-6 py-4 border-t border-surface-container-low">
                  <div className="flex items-center gap-4 min-w-0">
                    {/* This variant: a new one is removed now (with its new packs); a saved one is marked, and
                        deleted on Save draft / Publish (Admins); a deleted one can be restored. */}
                    {!r.id ? (
                      <Button
                        variant="danger"
                        size="md"
                        startIcon="delete"
                        aria-label={`Remove variant ${itemTitle(r)}`}
                        onClick={() => {
                          setPopupPacks([]);
                          setPopupPackNote(null);
                          setRows((cur) => cur.filter((x) => x.rowId !== r.rowId && x.pack?.baseRowId !== r.rowId));
                          setOpenItem(next?.rowId ?? prev?.rowId ?? null);
                        }}
                      >
                        Remove variant
                      </Button>
                    ) : r.deleted ? (
                      isAdmin && (
                        <Button variant="ghost" size="md" startIcon="restore_from_trash" onClick={() => updateRow(r.rowId, { remove: r.remove === false ? undefined : false })}>
                          {r.remove === false ? 'Undo restore' : 'Restore'}
                        </Button>
                      )
                    ) : (
                      isAdmin && (
                        <Button
                          variant={r.remove ? 'outline' : 'danger'}
                          size="md"
                          startIcon={r.remove ? 'undo' : 'delete'}
                          aria-label={r.remove ? `Keep variant ${itemTitle(r)}` : `Delete variant ${itemTitle(r)}`}
                          onClick={() => updateRow(r.rowId, { remove: !r.remove })}
                        >
                          {r.remove ? 'Keep' : 'Delete variant'}
                        </Button>
                      )
                    )}
                    <span className="hidden sm:flex text-xs text-on-surface-variant items-center gap-1.5 truncate">
                      <span className="material-symbols-outlined text-base" aria-hidden="true">
                        info
                      </span>
                      {r.remove && r.id && !r.deleted ? 'Deleted when you Save draft or Publish.' : 'Changes are kept in the form — Save draft or Publish to save them.'}
                    </span>
                  </div>
                  <Button variant="primary" size="md" onClick={() => leave(null)} autoFocus>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Admin shortcut: a new attribute goes into the shared library (R40) */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Create new attribute">
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md border border-surface-container-high p-6 flex flex-col gap-4">
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Create new attribute</h2>
            <p className="text-xs text-on-surface-variant">It is saved to the attribute library and can be used by every {label.lowerSingular('allProducts')}.</p>
            <input aria-label="Attribute name" className={inputClass} placeholder="e.g. Warranty" value={creating.label} onChange={(e) => setCreating({ ...creating, label: e.target.value })} />
            <select aria-label="Attribute type" className={inputClass} value={creating.type} onChange={(e) => setCreating({ ...creating, type: e.target.value as FieldType })}>
              {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            {creating.type === 'enum' && (
              <textarea aria-label="Attribute options" rows={3} className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high text-sm" placeholder="Options — one per line" value={creating.options} onChange={(e) => setCreating({ ...creating, options: e.target.value })} />
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
              <Button variant="ghost" size="md" onClick={() => setCreating(null)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={() => void createAttribute()} disabled={!creating.label.trim()}>
                Save attribute
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
