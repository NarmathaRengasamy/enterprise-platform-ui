import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLabels } from '../context/SiteSettingsContext';
import {
  Button,
  Icon,
  MetricsCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
  Toast,
  ToastMessage,
} from '../components/common';
import { productV2Service } from '../services/productV2.service';
import { productTypeService } from '../services/productType.service';
import { catalogCategoryService } from '../services/catalogCategory.service';
import type { CategoryNode } from '../types/catalogCategory.types';
import type { FieldDefinition, ProductType } from '../types/productType.types';
import {
  AnyVariantAxis,
  Media,
  AttributeValue,
  availabilityLabel,
  FULFILMENT_LABELS,
  isMeasuredAxis,
  limitsSummaryText,
  MeasuredValue,
  measureText,
  ProductV2,
  STATUS_LABELS,
  TRACKING_LABELS,
} from '../types/productV2.types';
import { formatMoney } from '../utils/money';
import { StockHistory, StockInfoCard, useItemStock } from '../components/products/StockPanel';
import { checkMediaFile, mediaService } from '../services/media.service';
import { SerialUnitsPanel } from '../components/products/SerialUnitsPanel';
import { BundleComponentsEditor } from '../components/products/BundleComponentsEditor';
import { resolveAssetUrl } from '../utils/assetUrl';

/**
 * One new product (Phase 3): the product settings (Fulfilment · Track
 * inventory · Tracking), its attributes, the items with price, tax and
 * availability, media (with the per-option images) and the audit trail.
 * Retired attributes are shown read-only.
 */

const serverText = (e: any): string =>
  (e?.fieldErrors && Object.values(e.fieldErrors).join(' · ')) || e?.message || 'Something went wrong';

/** A stored value as a person reads it. */
export const showValue = (f: FieldDefinition | undefined, v: AttributeValue['value']): string => {
  if (v === null || v === undefined) return '—';
  if (!f) return typeof v === 'object' ? (v as any).en : String(v);
  switch (f.type) {
    case 'enum':
      return f.options.find((o) => o.value === v)?.label.en ?? String(v);
    case 'boolean':
      return v ? 'Yes' : 'No';
    case 'number':
      return `${v}${f.unit ? ` ${f.unit}` : ''}`;
    case 'translated_text':
      return [(v as any).en, (v as any).ta, (v as any).hi].filter(Boolean).join(' · ');
    default:
      return String(v);
  }
};

const ITEMS_VIEW_KEY = 'v2_details_items_view';

const flatCategories = (nodes: CategoryNode[]): CategoryNode[] => nodes.flatMap((n) => [n, ...flatCategories(n.children)]);

export default function ProductV2DetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const label = useLabels();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const canEdit = isAdmin || user?.role === 'Editor';
  const singular = label.singular('allProducts');

  const [product, setProduct] = useState<ProductV2 | null>(null);
  const [type, setType] = useState<ProductType | null>(null);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishProblems, setPublishProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState<null | 'publish' | 'archive' | 'delete'>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  /* Items: Grid (photo cards) or Table — remembered in this browser, Grid by default. */
  const [itemsView, setItemsViewState] = useState<'grid' | 'table'>(() => {
    try {
      return localStorage.getItem(ITEMS_VIEW_KEY) === 'table' ? 'table' : 'grid';
    } catch {
      return 'grid';
    }
  });
  const setItemsView = (v: 'grid' | 'table') => {
    setItemsViewState(v);
    try {
      localStorage.setItem(ITEMS_VIEW_KEY, v);
    } catch {
      /* private mode: just not remembered */
    }
  };
  /* The variant shown in the popup, and which of its pictures is shown large. */
  const [openItem, setOpenItemState] = useState<string | null>(null);
  const [shownImage, setShownImage] = useState(0);
  const setOpenItem = (itemId: string | null) => {
    setOpenItemState(itemId);
    setShownImage(0);
  };

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [p, t, c] = await Promise.all([
        productV2Service.get(id),
        productTypeService.get(),
        catalogCategoryService.list(false).catch(() => ({ mode: 'flat' as const, categories: [] })),
      ]);
      setProduct(p);
      setType(t);
      setCategories(c.categories);
    } catch (e: any) {
      setLoadError(e.message || `Could not load the ${label.lowerSingular('allProducts')}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const fields = useMemo(() => new Map((type?.fields ?? []).map((f) => [f.key, f])), [type]);
  const categoryById = useMemo(() => new Map(flatCategories(categories).map((c) => [c.id, c])), [categories]);

  const publish = async () => {
    if (!product) return;
    setBusy('publish');
    setPublishProblems([]);
    try {
      setProduct(await productV2Service.publish(product.id));
      setToast({ text: `${singular} published`, type: 'success' });
    } catch (e: any) {
      /* The server lists each reason (422); show them as sent. */
      setPublishProblems(e?.fieldErrors ? Object.values(e.fieldErrors) : [e?.message || 'Could not publish']);
    } finally {
      setBusy(null);
    }
  };

  const archive = async () => {
    if (!product) return;
    setBusy('archive');
    try {
      setProduct(await productV2Service.archive(product.id));
      setToast({ text: `${singular} archived`, type: 'success' });
    } catch (e) {
      setToast({ text: serverText(e), type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!product) return;
    setBusy('delete');
    try {
      await productV2Service.remove(product.id);
      navigate('/v2/products');
    } catch (e) {
      setConfirmDelete(false);
      setToast({ text: `Cannot delete: ${serverText(e)}`, type: 'error' });
    } finally {
      setBusy(null);
    }
  };

  if (loadError) {
    return (
      <div className="flex flex-col w-full pb-space-2xl">
        <div className="mb-4 p-4 rounded-xl bg-error-container/40 border border-error/20 flex items-center justify-between" role="alert">
          <div className="flex items-center gap-3 text-error">
            <Icon name="error" size="md" />
            <span className="text-sm font-medium">{loadError}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/v2/products')}>
              Back
            </Button>
            <Button variant="danger" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!product) return <p className="text-sm text-on-surface-variant">Loading…</p>;

  const p = product;
  const eff = p.effective;
  const from = p.items
    .filter((i) => i.status === 'active' && i.resolved_price)
    .sort((a, b) => a.resolved_price!.amount_minor - b.resolved_price!.amount_minor)[0]?.resolved_price;
  const taxCode = p.hsn_code ? `HSN ${p.hsn_code}` : p.sac_code ? `SAC ${p.sac_code}` : 'No HSN / SAC';
  /* Tax is optional (Option B): with none set — on the product or any item — no tax detail is shown. */
  const hasTax = Boolean(p.hsn_code || p.sac_code || p.gst_rate !== null || p.items.some((i) => i.gst_rate !== null || i.hsn_code));
  /* The measured-size variant option (R45), if any: its values are amounts with a unit. */
  const sizeKey = p ? (p.variant_axes as AnyVariantAxis[]).find(isMeasuredAxis)?.key : undefined;
  const valueOf = (item: ProductV2['items'][number], key: string) =>
    key === sizeKey && item.measure ? measureText(item.measure) : showValue(fields.get(key), item.attributes.find((a) => a.key === key)?.value as any);
  /** "Red · 1 l" for a variant; the SKU when the product has no variant options. */
  const itemTitle = (item: ProductV2['items'][number]) => (p.variant_axes.length ? p.variant_axes.map((a) => valueOf(item, a.key)).join(' · ') : item.sku);
  /**
   * The picture a customer sees for an item, and where it comes from: its own
   * photos → its option's (e.g. Red) → the product's — the same order as the
   * server's `effective.media`.
   */
  const itemPhotos = (item: ProductV2['items'][number]): { list: Media[]; from: string | null } => {
    if (item.media?.length) return { list: item.media, from: null };
    for (const a of item.attributes) {
      const hit = p.option_media.find((o) => o.attribute_key === a.key && o.value === String(a.value) && o.media.length);
      if (hit) return { list: hit.media, from: `uses ${valueOf(item, a.key)} photos` };
    }
    if (p.media.length) return { list: p.media, from: `uses ${label.lowerSingular('allProducts')} photos` };
    return { list: [], from: null };
  };
  /** A square picture of the item; faded when it is borrowed (option or product photos). */
  const thumb = (item: ProductV2['items'][number], box: string) => {
    const pic = itemPhotos(item);
    const m = pic.list[0];
    const src = m ? resolveAssetUrl(m.url) : null;
    const cls = `w-full h-full object-cover ${pic.from ? 'opacity-50' : ''}`;
    return (
      <div className={`${box} rounded-lg bg-surface-container-low flex items-center justify-center overflow-hidden shrink-0 relative`} title={pic.from ?? undefined} data-testid={`item-image-${item.sku}`}>
        {src && m?.kind === 'video' ? (
          <video src={src} className={cls} muted />
        ) : src ? (
          <img src={src} alt={pic.from ? '' : itemTitle(item)} className={cls} />
        ) : (
          <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">
            image
          </span>
        )}
        {!pic.from && pic.list.length > 1 && (
          <span className="absolute top-1 right-1 text-[10px] font-semibold px-1.5 rounded-full bg-on-surface/70 text-white">{pic.list.length}</span>
        )}
      </div>
    );
  };
  const priceText = (item: ProductV2['items'][number]) =>
    `${formatMoney(item.resolved_price?.amount_minor ?? null, item.resolved_price?.currency ?? p.currency)}${
      item.resolved_price && item.resolved_price.price_unit !== 'each' ? ` / ${item.resolved_price.price_unit}` : ''
    }`;
  const perUnit = (item: ProductV2['items'][number]) =>
    item.price_per_unit ? `${formatMoney(item.price_per_unit.amount_minor, item.price_per_unit.currency)} / ${item.price_per_unit.per}` : null;
  /** Phase 4: available at or below the reorder point. */
  const lowStock = (item: ProductV2['items'][number]) =>
    item.availability.status === 'tracked' && item.availability.low_stock ? (
      <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700" data-testid={`low-stock-${item.sku}`}>
        Low stock
      </span>
    ) : null;
  const statusPill = (item: ProductV2['items'][number]) => (
    <span
      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
        item.status === 'active' ? 'bg-secondary-fixed/30 text-secondary' : 'bg-surface-container-high text-on-surface-variant'
      }`}
    >
      {item.status === 'active' ? 'Active' : 'Inactive'}
    </span>
  );

  /** An option value, or a size ("500 ml"). */
  const axisValueText = (key: string, v: unknown) =>
    typeof v === 'object' && v !== null ? measureText(v as MeasuredValue) : showValue(fields.get(key), v as AttributeValue['value']);

  return (
    <div className="flex flex-col w-full pb-space-2xl" data-testid="product-details">
      <Toast message={toast} onDismiss={() => setToast(null)} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">{p.name.en}</h1>
            <span
              className={`text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full ${
                p.status === 'active' ? 'bg-secondary-fixed/30 text-secondary' : p.status === 'draft' ? 'bg-amber-50 text-amber-700' : 'bg-surface-container-high text-on-surface-variant'
              }`}
              data-testid="product-status"
            >
              {STATUS_LABELS[p.status]}
            </span>
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            {p.slug}
            {p.brand ? ` • ${p.brand}` : ''}
            {[p.name.ta, p.name.hi].filter(Boolean).map((t) => ` • ${t}`).join('')}
          </p>
        </div>
        <div className="flex items-center gap-space-xs flex-wrap">
          <Button variant="hover" size="md" startIcon="arrow_back" onClick={() => navigate('/v2/products')}>
            Back to {label.plural('allProducts')}
          </Button>
          {canEdit && (
            <Button variant="soft" size="md" startIcon="edit" onClick={() => navigate(`/v2/products/${p.id}/edit`)}>
              Edit
            </Button>
          )}
          {canEdit && p.status !== 'active' && (
            <Button variant="primary" size="md" startIcon="publish" onClick={() => void publish()} disabled={busy !== null}>
              {busy === 'publish' ? 'Publishing...' : 'Publish'}
            </Button>
          )}
          {canEdit && p.status === 'active' && (
            <Button variant="soft" size="md" startIcon="archive" onClick={() => void archive()} disabled={busy !== null}>
              {busy === 'archive' ? 'Archiving...' : 'Archive'}
            </Button>
          )}
          {isAdmin && (
            <Button variant="danger" size="md" startIcon="delete" onClick={() => setConfirmDelete(true)} disabled={busy !== null}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {publishProblems.length > 0 && (
        <div className="mb-4 p-4 rounded-xl bg-error-container/40 border border-error/20 text-error" role="alert">
          <p className="text-sm font-semibold mb-1">This {label.lowerSingular('allProducts')} cannot be published yet:</p>
          <ul className="list-disc pl-5 text-sm">
            {publishProblems.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {/* The product settings (R13a–R13c) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg" data-testid="product-settings">
        <MetricsCard title="Price" value={formatMoney(from?.amount_minor ?? null, from?.currency ?? p.currency)} subtitle={from ? (hasTax ? (from.tax_inclusive ? 'incl. GST' : 'excl. GST') : 'Lowest active price') : 'No active priced item'} icon="payments" variant="primary" />
        {/* Variants: how many, how many active, how many packs (normal items and packs alike). */}
        {(() => {
          const packs = p.items.filter((i) => i.pack_of).length;
          const variants = p.items.length - packs;
          const active = p.items.filter((i) => !i.pack_of && i.status === 'active').length;
          return (
            <MetricsCard
              title="Variants"
              value={`${variants} ${variants === 1 ? 'variant' : 'variants'}`}
              subtitle={[`${active} active`, packs ? `${packs} ${packs === 1 ? 'pack' : 'packs'}` : null].filter(Boolean).join(' · ')}
              icon="style"
              variant="secondary"
            />
          );
        })()}
        <MetricsCard
          title="Track inventory"
          value={eff.track_inventory ? 'On' : 'Off'}
          subtitle={eff.track_inventory ? `Tracking: ${TRACKING_LABELS[eff.tracking]}` : 'Not tracked — always available'}
          icon="inventory"
          variant="tertiary"
        />
        <MetricsCard title="Availability" value={availabilityLabel(p.availability)} subtitle={hasTax ? `${taxCode} · GST ${p.gst_rate ?? '—'}%` : p.availability.status === 'tracked' ? 'Across active items' : undefined} icon="warehouse" variant="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-space-md mb-space-lg">
        {/* Attributes */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-low/60 p-space-md">
          <h2 className="font-title-md text-title-md font-semibold text-on-surface mb-2">Details</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm" data-testid="product-attributes">
            <div className="flex justify-between gap-3 border-b border-surface-container-low py-1">
              <dt className="font-semibold text-on-surface">{label.plural('categories')}</dt>
              <dd className="text-on-surface text-right">
                {p.category_ids.length
                  ? p.category_ids.map((c) => `${categoryById.get(c)?.name.en ?? c}${c === p.primary_category_id && p.category_ids.length > 1 ? ' (primary)' : ''}`).join(', ')
                  : '—'}
              </dd>
            </div>
            {p.attributes.map((a) => {
              const f = fields.get(a.key);
              return (
                <div key={a.key} className="flex justify-between gap-3 border-b border-surface-container-low py-1">
                  <dt className="font-semibold text-on-surface">
                    {f?.label.en ?? a.key}
                    {f?.deprecated && <span className="ml-1 text-[10px] font-semibold uppercase text-outline">Retired · read-only</span>}
                  </dt>
                  <dd className="text-on-surface text-right">{showValue(f, a.value)}</dd>
                </div>
              );
            })}
            {p.variant_axes.map((axis) => (
              <div key={axis.key} className="flex justify-between gap-3 border-b border-surface-container-low py-1">
                <dt className="font-semibold text-on-surface">{fields.get(axis.key)?.label.en ?? axis.key} (variants)</dt>
                <dd className="text-on-surface text-right">{axis.values.map((v) => axisValueText(axis.key, v)).join(', ')}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-b border-surface-container-low py-1" data-testid="product-limits">
              <dt className="font-semibold text-on-surface">Purchase limits</dt>
              <dd className="text-on-surface text-right">{limitsSummaryText(p.purchase_limits) || 'None'}</dd>
            </div>
          </dl>
          {p.description?.en && <p className="text-sm text-on-surface-variant mt-3 whitespace-pre-line">{p.description.en}</p>}
        </section>

      </div>

      {/* Items — Grid (photo cards) or Table; a click opens the variant in a popup */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-low/60 flex flex-col mb-space-lg">
        <div className="p-space-md flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-title-md text-title-md font-semibold text-on-surface">Items</h2>
          <div className="inline-flex rounded-lg border border-surface-container-high p-0.5" role="group" aria-label="Items view">
            {(['grid', 'table'] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={itemsView === v}
                aria-label={v === 'grid' ? 'Grid view' : 'Table view'}
                title={v === 'grid' ? 'Grid view' : 'Table view'}
                onClick={() => setItemsView(v)}
                className={`w-8 h-7 rounded-md flex items-center justify-center ${itemsView === v ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  {v === 'grid' ? 'grid_view' : 'table_rows'}
                </span>
              </button>
            ))}
          </div>
        </div>

        {itemsView === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 px-space-md pb-space-md" data-testid="items-grid">
            {p.items.map((item) => {
              const pic = itemPhotos(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Open ${itemTitle(item)}`}
                  aria-haspopup="dialog"
                  onClick={() => setOpenItem(item.id)}
                  className="text-left rounded-xl border border-surface-container-high p-3 flex flex-col gap-2 hover:border-primary/50 hover:shadow-sm transition"
                  data-testid={`item-${item.sku}`}
                >
                  {thumb(item, 'w-full h-32')}
                  {pic.from && <span className="text-[11px] text-on-surface-variant -mt-1">{pic.from}</span>}
                  <span className="font-semibold text-sm text-on-surface truncate">{itemTitle(item)}</span>
                  <span className="text-[11px] text-on-surface-variant truncate">{item.sku}</span>
                  <span className="text-sm font-semibold text-on-surface">{priceText(item)}</span>
                  {perUnit(item) && <span className="text-[11px] text-on-surface-variant -mt-1">{perUnit(item)}</span>}
                  <span className="flex items-center justify-between gap-2 text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      {availabilityLabel(item.availability)}
                      {lowStock(item)}
                    </span>
                    {statusPill(item)}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <Table aria-label="Items">
            <TableHead>
              <tr>
                <TableHeadCell>
                  <span className="sr-only">Image</span>
                </TableHeadCell>
                <TableHeadCell>SKU</TableHeadCell>
                {p.variant_axes.map((a) => (
                  <TableHeadCell key={a.key}>{fields.get(a.key)?.label.en ?? a.key}</TableHeadCell>
                ))}
                <TableHeadCell>Price</TableHeadCell>
                <TableHeadCell>MRP</TableHeadCell>
                {hasTax && <TableHeadCell>Tax</TableHeadCell>}
                <TableHeadCell>Availability</TableHeadCell>
                <TableHeadCell>Limits</TableHeadCell>
                <TableHeadCell>Status</TableHeadCell>
              </tr>
            </TableHead>
            <TableBody>
              {p.items.map((item) => (
                <TableRow key={item.id} clickable onClick={() => setOpenItem(item.id)} className="cursor-pointer" data-testid={`item-${item.sku}`}>
                  <TableCell className="w-14">{thumb(item, 'w-12 h-12')}</TableCell>
                  <TableCell className="font-semibold text-on-surface">
                    <button type="button" className="text-left hover:text-primary" aria-label={`Open ${itemTitle(item)}`} aria-haspopup="dialog" onClick={(e) => { e.stopPropagation(); setOpenItem(item.id); }}>
                      {item.sku}
                    </button>
                    {itemPhotos(item).from && <span className="block text-[11px] font-normal text-on-surface-variant">{itemPhotos(item).from}</span>}
                  </TableCell>
                  {p.variant_axes.map((a) => (
                    <TableCell key={a.key}>{valueOf(item, a.key)}</TableCell>
                  ))}
                  <TableCell>
                    {priceText(item)}
                    {hasTax && item.resolved_price?.tax_inclusive && <span className="ml-1 text-[10px] uppercase text-outline">incl. GST</span>}
                    {/* Worked out by the server, never stored (R46). */}
                    {perUnit(item) && (
                      <span className="block text-[11px] text-outline" data-testid={`per-unit-${item.sku}`}>
                        {perUnit(item)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-on-surface-variant">{item.compare_at_minor !== null ? formatMoney(item.compare_at_minor, p.currency) : '—'}</TableCell>
                  {hasTax && (
                    <TableCell className="text-on-surface-variant text-xs">
                      GST {item.effective.gst_rate ?? '—'}%{item.effective.hsn_code ? ` · HSN ${item.effective.hsn_code}` : ''}
                    </TableCell>
                  )}
                  <TableCell className="text-on-surface-variant whitespace-nowrap">
                    {availabilityLabel(item.availability)} {lowStock(item)}
                  </TableCell>
                  <TableCell className="text-on-surface-variant text-xs" data-testid={`limits-${item.sku}`}>
                    {item.limits_summary || '—'}
                  </TableCell>
                  <TableCell>{statusPill(item)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Media */}
      {/* Common pictures: the product's and the per-option ones (e.g. every Red variant). A variant's own photos are in its popup. */}
      {(p.media.length > 0 || p.option_media.length > 0) && (
        <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-low/60 p-space-md" data-testid="product-media">
          <h2 className="font-title-md text-title-md font-semibold text-on-surface mb-2">Media</h2>
          <div className="flex flex-wrap gap-3">
            {p.media.map((m) => (
              <MediaThumb key={m.url} url={m.url} kind={m.kind} alt={m.alt || p.name.en} />
            ))}
          </div>
          {p.option_media.map((o) => (
            <div key={`${o.attribute_key}-${o.value}`} className="mt-3">
              <p className="text-xs font-semibold text-on-surface-variant mb-1">
                {fields.get(o.attribute_key)?.label.en ?? o.attribute_key} = {showValue(fields.get(o.attribute_key), o.value)}
              </p>
              <div className="flex flex-wrap gap-3">
                {o.media.map((m) => (
                  <MediaThumb key={m.url} url={m.url} kind={m.kind} alt={`${p.name.en} ${o.value}`} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* One variant in a popup: pictures and stock on the left, its details in tabs on the right. */}
      {openItem &&
        (() => {
          const at = p.items.findIndex((i) => i.id === openItem);
          if (at < 0) return null;
          const item = p.items[at];
          return (
            <VariantPopup
              product={p}
              item={item}
              index={at}
              total={p.items.length}
              onPrev={at > 0 ? () => setOpenItem(p.items[at - 1].id) : undefined}
              onNext={at < p.items.length - 1 ? () => setOpenItem(p.items[at + 1].id) : undefined}
              onClose={() => setOpenItem(null)}
              onEdit={canEdit ? () => navigate(`/v2/products/${p.id}/edit`) : undefined}
              onReload={() => void load()}
              canEdit={canEdit}
              hasTax={hasTax}
              title={itemTitle(item)}
              subtitle={[p.primary_category_id ? categoryById.get(p.primary_category_id)?.name.en : null, p.brand, itemTitle(item)].filter(Boolean).join(' · ')}
              photos={itemPhotos(item)}
              optionRows={p.variant_axes.map((a): [string, string] => [fields.get(a.key)?.label.en ?? a.key, valueOf(item, a.key)])}
              priceText={priceText(item)}
              perUnit={perUnit(item)}
              baseSku={item.pack_of ? p.items.find((x) => x.id === item.pack_of!.base_item_id)?.sku ?? null : null}
            />
          );
        })()}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Delete ${p.name.en}`}>
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md border border-surface-container-high p-6 flex flex-col gap-4">
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Delete {singular}</h3>
            <p className="text-sm text-on-surface">
              Delete <strong>"{p.name.en}"</strong> and its {p.items.length} {p.items.length === 1 ? 'item' : 'items'}? It can be restored from Show deleted.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
              <Button variant="ghost" size="md" onClick={() => setConfirmDelete(false)} disabled={busy === 'delete'}>
                Cancel
              </Button>
              <Button variant="danger" size="md" onClick={() => void remove()} disabled={busy === 'delete'}>
                {busy === 'delete' ? 'Deleting...' : `Delete ${singular}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ====================================================== the variant popup */

type Item = ProductV2['items'][number];
type Tab = 'overview' | 'inventory' | 'more';

const Row: React.FC<{ k: string; children: React.ReactNode }> = ({ k, children }) => (
  <div className="grid grid-cols-[minmax(7rem,40%)_1fr] gap-4 border-b border-surface-container-low py-3 last:border-0">
    <dt className="font-semibold text-on-surface">{k}</dt>
    <dd className="text-on-surface">{children}</dd>
  </div>
);

const CardHead: React.FC<{ icon: string; title: string; right?: React.ReactNode }> = ({ icon, title, right }) => (
  <div className="flex items-center justify-between gap-2 mb-1">
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
        <Icon name={icon} size="md" />
      </div>
      <h3 className="text-base font-semibold text-on-surface">{title}</h3>
    </div>
    {right}
  </div>
);

/** Green in stock · amber low · red none · grey not tracked. */
const availabilityDot = (a: Item['availability']) =>
  a.status !== 'tracked' ? 'bg-outline' : a.available <= 0 ? 'bg-error' : a.low_stock ? 'bg-amber-500' : 'bg-green-600';

/**
 * One variant (design mock, Oct 2026): pictures (arrows, full screen, + Add
 * image for Admins / Editors — saved on the variant straight away) and Stock
 * Information on the left; Overview · Inventory · Additional Info on the right.
 * "View all" in the history opens the Inventory tab. The tab stays as it is
 * when moving with ‹ / ›.
 */
const VariantPopup: React.FC<{
  product: ProductV2;
  item: Item;
  index: number;
  total: number;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onEdit?: () => void;
  onReload: () => void;
  canEdit: boolean;
  hasTax: boolean;
  title: string;
  subtitle: string;
  photos: { list: Media[]; from: string | null };
  optionRows: [string, string][];
  priceText: string;
  perUnit: string | null;
  baseSku: string | null;
}> = ({ product: p, item, index, total, onPrev, onNext, onClose, onEdit, onReload, canEdit, hasTax, title, subtitle, photos, optionRows, priceText, perUnit, baseSku }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [shown, setShown] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const stock = useItemStock(item.id, { canEdit, onChanged: onReload, historySize: 10 });

  useEffect(() => {
    setShown(0);
    setPhotoError(null);
    setCopied(false);
  }, [item.id]);

  /* Viewers have no Inventory tab (history, units and bundles are for Admins / Editors). */
  const tabs: [Tab, string][] = canEdit ? [['overview', 'Overview'], ['inventory', 'Inventory'], ['more', 'Additional Info']] : [['overview', 'Overview'], ['more', 'Additional Info']];
  const current = tabs.some(([t]) => t === tab) ? tab : 'overview';

  const list = photos.list;
  const at = Math.min(shown, Math.max(list.length - 1, 0));
  const pic = list[at];
  const src = pic ? resolveAssetUrl(pic.url) : undefined;
  const own = !photos.from && Boolean(item.media?.length);

  const tracked = item.effective.track_inventory;
  const unitsTracking = canEdit && !item.pack_of && !p.is_bundle && tracked && (item.effective.tracking === 'serial' || item.effective.tracking === 'batch') ? item.effective.tracking : null;

  /** + Add image: uploaded, then saved as this variant's own photos. */
  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setPhotoError(null);
    setUploading(true);
    try {
      const added: Media[] = [];
      for (const file of Array.from(files)) {
        const problem = checkMediaFile(file, ['image', 'video']);
        if (problem) throw new Error(`${file.name}: ${problem}`);
        const stored = await mediaService.upload(file);
        added.push({ url: stored.url, kind: stored.kind });
      }
      const next = [...(item.media ?? []), ...added].map((m, i) => ({ ...m, sort_order: i }));
      await productV2Service.updateItem(p.id, item.id, { media: next });
      onReload();
    } catch (e: any) {
      setPhotoError(e?.message || 'Could not add the image');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const removePhoto = async (i: number) => {
    setPhotoError(null);
    try {
      const next = (item.media ?? []).filter((_, x) => x !== i).map((m, x) => ({ ...m, sort_order: x }));
      await productV2Service.updateItem(p.id, item.id, { media: next });
      setShown(0);
      onReload();
    } catch (e: any) {
      setPhotoError(e?.message || 'Could not remove the image');
    }
  };

  const copySku = async () => {
    try {
      await navigator.clipboard?.writeText(item.sku);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: nothing to do */
    }
  };

  const media = (m: Media, cls: string, alt: string) =>
    m.kind === 'video' ? <video src={resolveAssetUrl(m.url)} className={cls} controls={cls.includes('contain')} muted /> : <img src={resolveAssetUrl(m.url)} alt={alt} className={cls} />;

  const additional: [string, React.ReactNode][] = [
    ...(hasTax ? [['Tax', `GST ${item.effective.gst_rate ?? '—'}%${item.effective.hsn_code ? ` · HSN ${item.effective.hsn_code}` : ''}`] as [string, React.ReactNode]] : []),
    ...(perUnit ? [['Price per unit', perUnit] as [string, React.ReactNode]] : []),
    ...(item.pack_of
      ? [['Pack', `${item.pack_of.quantity} × ${baseSku ?? 'base item'}${item.pack_saving && item.pack_saving.percent > 0 ? ` · saves ${item.pack_saving.percent} %` : ''}`] as [string, React.ReactNode]]
      : []),
    ['Photos', own ? 'Its own photos' : photos.from ? `No photos of its own — ${photos.from}` : 'No photos'],
    ...(item.resolved_price && item.resolved_price.price_unit !== 'each' ? [['Priced per', item.resolved_price.price_unit] as [string, React.ReactNode]] : []),
    ...(item.digital_delivery ? [['Digital delivery', item.digital_delivery] as [string, React.ReactNode]] : []),
    ['Status', item.status === 'active' ? 'Active' : 'Inactive'],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-testid="item-view"
      onKeyDown={(e) => {
        if (e.key === 'Escape') (fullScreen ? setFullScreen(false) : onClose());
      }}
    >
      <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-y-auto border border-surface-container-high flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">{title}</h2>
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full ${
                  item.status === 'active' ? 'bg-secondary-fixed/30 text-secondary' : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'active' ? 'bg-green-600' : 'bg-outline'}`} />
                {item.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-sm text-on-surface-variant mt-0.5 truncate" data-testid="item-view-subtitle">
              {subtitle}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-sm text-on-surface-variant mr-2">
              {index + 1} of {total}
            </span>
            <Button variant="outline" size="icon-sm" startIcon="chevron_left" disabled={!onPrev} onClick={onPrev} aria-label="Previous variant" title="Previous" />
            <Button variant="outline" size="icon-sm" startIcon="chevron_right" disabled={!onNext} onClick={onNext} aria-label="Next variant" title="Next" />
            <Button variant="ghost" size="icon-sm" startIcon="close" onClick={onClose} aria-label="Close" />
          </div>
        </div>

        <div className="px-6 pb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: pictures and stock (the same on every tab) */}
          <div className="flex flex-col gap-4 min-w-0">
            <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden border border-surface-container-high bg-surface-container-low flex items-center justify-center">
              {pic ? (
                media(pic, 'w-full h-full object-cover', title)
              ) : (
                <span className="flex flex-col items-center gap-1 text-on-surface-variant text-sm">
                  <span className="material-symbols-outlined text-4xl" aria-hidden="true">
                    image
                  </span>
                  No photos
                </span>
              )}
              {pic && (
                <button
                  type="button"
                  aria-label="Full screen"
                  onClick={() => setFullScreen(true)}
                  className="absolute top-3 right-3 w-9 h-9 rounded-lg bg-surface-container-lowest/90 shadow flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">
                    fullscreen
                  </span>
                </button>
              )}
              {list.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={() => setShown((at - 1 + list.length) % list.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-on-surface/40 text-white flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      chevron_left
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={() => setShown((at + 1) % list.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-on-surface/40 text-white flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined" aria-hidden="true">
                      chevron_right
                    </span>
                  </button>
                </>
              )}
            </div>
            {photos.from && <p className="text-xs text-on-surface-variant -mt-2">No photos of its own — {photos.from}.</p>}

            <div className="flex flex-wrap gap-3">
              {list.map((m, i) => (
                <div key={`${m.url}-${i}`} className={`relative w-24 h-20 rounded-xl overflow-hidden border-2 ${i === at ? 'border-primary' : 'border-transparent'}`}>
                  <button type="button" onClick={() => setShown(i)} aria-label={`Show image ${i + 1}`} className="w-full h-full">
                    {media(m, 'w-full h-full object-cover', `Image ${i + 1}`)}
                  </button>
                  {canEdit && own && (
                    <button
                      type="button"
                      aria-label={`Remove image ${i + 1}`}
                      onClick={() => void removePhoto(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[11px] leading-5"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {canEdit && (
                <button
                  type="button"
                  aria-label="Add image"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="w-24 h-20 rounded-xl border-2 border-dashed border-surface-container-high text-on-surface-variant flex flex-col items-center justify-center text-xs gap-0.5 hover:border-primary/50 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined" aria-hidden="true">
                    add
                  </span>
                  {uploading ? 'Uploading…' : 'Add image'}
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime" multiple className="hidden" onChange={(e) => void addPhotos(e.target.files)} />
            </div>
            {canEdit && !own && photos.from && <p className="text-[11px] text-on-surface-variant -mt-2">Adding an image gives this variant its own photos.</p>}
            {photoError && (
              <p className="text-xs text-error" role="alert">
                {photoError}
              </p>
            )}

            <div className="rounded-xl border border-surface-container-high p-4">
              <StockInfoCard itemId={item.id} title={title} canEdit={canEdit} state={stock} onOpenInventory={() => setTab('inventory')} />
            </div>
          </div>

          {/* Right: tabs */}
          <div className="flex flex-col gap-4 min-w-0">
            <div className="flex gap-6 border-b border-surface-container-high" role="tablist" aria-label="Variant">
              {tabs.map(([t, text]) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={current === t}
                  onClick={() => setTab(t)}
                  className={`pb-2.5 -mb-px text-sm font-semibold border-b-2 transition-colors ${current === t ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
                >
                  {text}
                </button>
              ))}
            </div>

            {current === 'overview' && (
              <>
                <section className="rounded-xl border border-surface-container-high p-4" aria-label="Product Details">
                  <CardHead icon="description" title="Product Details" />
                  <dl className="text-sm" data-testid="item-view-details">
                    <Row k="SKU">
                      <span className="flex items-center justify-between gap-2">
                        <span className="break-all">{item.sku}</span>
                        <button type="button" aria-label="Copy SKU" title="Copy" onClick={() => void copySku()} className="text-on-surface-variant hover:text-primary shrink-0">
                          <span className="material-symbols-outlined text-base" aria-hidden="true">
                            {copied ? 'check' : 'content_copy'}
                          </span>
                        </button>
                      </span>
                    </Row>
                    {optionRows.map(([k, v]) => (
                      <Row key={k} k={k}>
                        {v}
                      </Row>
                    ))}
                    {item.pack_of && (
                      <Row k="Pack">
                        {item.pack_of.quantity} × {baseSku ?? 'base item'}
                        {item.pack_saving && item.pack_saving.percent > 0 && <span className="block text-xs text-secondary">Saves {item.pack_saving.percent} %</span>}
                      </Row>
                    )}
                    <Row k="Price">
                      {priceText}
                      {hasTax && item.resolved_price && <span className="ml-1 text-[10px] uppercase text-outline">{item.resolved_price.tax_inclusive ? 'incl. GST' : '+ GST'}</span>}
                      {perUnit && <span className="block text-xs text-on-surface-variant">{perUnit}</span>}
                    </Row>
                    <Row k="MRP">{item.compare_at_minor !== null ? formatMoney(item.compare_at_minor, p.currency) : '—'}</Row>
                    <Row k="Track inventory">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${tracked ? 'bg-secondary-fixed/30 text-secondary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                          {tracked ? 'On' : 'Off'}
                        </span>
                        {/* "No units (quantity only)" is left out; serial / batch tracking is still named. */}
                        {tracked && item.effective.tracking !== 'none' && <span className="text-on-surface-variant">· {TRACKING_LABELS[item.effective.tracking]}</span>}
                      </span>
                    </Row>
                    <Row k="Availability">
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${availabilityDot(item.availability)}`} />
                        {availabilityLabel(item.availability)}
                      </span>
                    </Row>
                    <Row k="Purchase limits">
                      {item.limits_summary || 'None'}
                      {item.purchase_limits && <span className="block text-xs text-on-surface-variant">This item has its own limits</span>}
                    </Row>
                  </dl>
                </section>
                {canEdit && (
                  <section className="rounded-xl border border-surface-container-high p-4">
                    <StockHistory state={stock} mode="preview" onViewAll={() => setTab('inventory')} />
                  </section>
                )}
              </>
            )}

            {current === 'inventory' && (
              <>
                <section className="rounded-xl border border-surface-container-high p-4">
                  {stock.stock && stock.stock.kind === 'item' && stock.stock.availability.status === 'tracked' ? (
                    <StockHistory state={stock} mode="full" />
                  ) : (
                    <p className="text-sm text-on-surface-variant">
                      {item.pack_of
                        ? `A pack has no stock history of its own — see the base item${baseSku ? ` (${baseSku})` : ''}.`
                        : p.is_bundle
                          ? 'A bundle has no stock history of its own — see its components.'
                          : 'Not tracked — no stock history.'}
                    </p>
                  )}
                </section>
                {unitsTracking && (
                  <section className="rounded-xl border border-surface-container-high p-4">
                    <SerialUnitsPanel key={`units-${item.id}`} itemId={item.id} tracking={unitsTracking} canEdit={canEdit} onChanged={() => stock.changed()} />
                  </section>
                )}
                {p.is_bundle && !item.pack_of && (
                  <section className="rounded-xl border border-surface-container-high p-4">
                    <BundleComponentsEditor key={`bundle-${item.id}`} bundleItemId={item.id} canEdit={canEdit} onChanged={() => stock.changed()} />
                  </section>
                )}
              </>
            )}

            {current === 'more' && (
              <section className="rounded-xl border border-surface-container-high p-4" aria-label="Additional Info">
                <CardHead icon="info" title="Additional Info" />
                <dl className="text-sm" data-testid="item-view-more">
                  {additional.map(([k, v]) => (
                    <Row key={k} k={k}>
                      {v}
                    </Row>
                  ))}
                </dl>
              </section>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end items-center gap-3 px-6 py-4 border-t border-surface-container-low">
          <Button variant="outline" size="md" onClick={onClose} autoFocus>
            Close
          </Button>
          {onEdit && (
            <Button variant="primary" size="md" startIcon="edit" onClick={onEdit}>
              Edit Product
            </Button>
          )}
        </div>
      </div>

      {/* Full screen picture */}
      {fullScreen && pic && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-6" role="dialog" aria-label="Picture, full screen" onClick={() => setFullScreen(false)}>
          {media(pic, 'max-w-full max-h-full object-contain', title)}
          <button type="button" aria-label="Close full screen" className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center">
            <span className="material-symbols-outlined" aria-hidden="true">
              close
            </span>
          </button>
          {list.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation();
                  setShown((at - 1 + list.length) % list.length);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  chevron_left
                </span>
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation();
                  setShown((at + 1) % list.length);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/15 text-white flex items-center justify-center"
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  chevron_right
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const MediaThumb: React.FC<{ url: string; kind: 'image' | 'video'; alt: string }> = ({ url, kind, alt }) => {
  const src = resolveAssetUrl(url);
  if (!src) return null;
  return kind === 'video' ? (
    <video src={src} className="w-28 h-28 rounded-lg object-cover bg-surface-container-high" controls />
  ) : (
    <img src={src} alt={alt} className="w-28 h-28 rounded-lg object-cover bg-surface-container-high" />
  );
};
