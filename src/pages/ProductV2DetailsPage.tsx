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

const when = (iso?: string) => (iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

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
  const primary = p.primary_category_id ? categoryById.get(p.primary_category_id) : undefined;
  const taxCode = p.hsn_code ? `HSN ${p.hsn_code}` : p.sac_code ? `SAC ${p.sac_code}` : 'No HSN / SAC';
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
        <MetricsCard title="Price" value={formatMoney(from?.amount_minor ?? null, from?.currency ?? p.currency)} subtitle={from ? (from.tax_inclusive ? 'incl. GST' : 'excl. GST') : 'No active priced item'} icon="payments" variant="primary" />
        <MetricsCard title="Fulfilment" value={FULFILMENT_LABELS[eff.fulfilment]} subtitle={p.fulfilment ? 'Set on this product' : 'From the business default'} icon="local_shipping" variant="secondary" />
        <MetricsCard
          title="Track inventory"
          value={eff.track_inventory ? 'On' : 'Off'}
          subtitle={eff.track_inventory ? `Tracking: ${TRACKING_LABELS[eff.tracking]}` : 'Not tracked — always available'}
          icon="inventory"
          variant="tertiary"
        />
        <MetricsCard title="Availability" value={availabilityLabel(p.availability)} subtitle={`${taxCode} · GST ${p.gst_rate ?? '—'}%`} icon="warehouse" variant="neutral" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-space-md mb-space-lg">
        {/* Attributes */}
        <section className="lg:col-span-2 bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-low/60 p-space-md">
          <h2 className="font-title-md text-title-md font-semibold text-on-surface mb-2">Details</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm" data-testid="product-attributes">
            <div className="flex justify-between gap-3 border-b border-surface-container-low py-1">
              <dt className="text-on-surface-variant">{label.plural('categories')}</dt>
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
                  <dt className="text-on-surface-variant">
                    {f?.label.en ?? a.key}
                    {f?.deprecated && <span className="ml-1 text-[10px] font-semibold uppercase text-outline">Retired · read-only</span>}
                  </dt>
                  <dd className="text-on-surface text-right">{showValue(f, a.value)}</dd>
                </div>
              );
            })}
            {p.variant_axes.map((axis) => (
              <div key={axis.key} className="flex justify-between gap-3 border-b border-surface-container-low py-1">
                <dt className="text-on-surface-variant">{fields.get(axis.key)?.label.en ?? axis.key} (variants)</dt>
                <dd className="text-on-surface text-right">{axis.values.map((v) => axisValueText(axis.key, v)).join(', ')}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-b border-surface-container-low py-1" data-testid="product-limits">
              <dt className="text-on-surface-variant">Purchase limits</dt>
              <dd className="text-on-surface text-right">{limitsSummaryText(p.purchase_limits) || 'None'}</dd>
            </div>
          </dl>
          {p.description?.en && <p className="text-sm text-on-surface-variant mt-3 whitespace-pre-line">{p.description.en}</p>}
        </section>

        {/* Audit */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-low/60 p-space-md text-sm" data-testid="product-audit">
          <h2 className="font-title-md text-title-md font-semibold text-on-surface mb-2">History</h2>
          <p className="text-on-surface-variant">Created {when(p.created_at)} by {p.created_by ?? '—'}</p>
          <p className="text-on-surface-variant">Updated {when(p.updated_at)} by {p.updated_by ?? '—'}</p>
          <p className="text-on-surface-variant">Primary {label.lowerSingular('categories')}: {primary?.name.en ?? '—'}</p>
          <p className="text-on-surface-variant">Attribute set version {p.type_version}</p>
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
                    {availabilityLabel(item.availability)}
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
                <TableHeadCell>Tax</TableHeadCell>
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
                    {item.resolved_price?.tax_inclusive && <span className="ml-1 text-[10px] uppercase text-outline">incl. GST</span>}
                    {/* Worked out by the server, never stored (R46). */}
                    {perUnit(item) && (
                      <span className="block text-[11px] text-outline" data-testid={`per-unit-${item.sku}`}>
                        {perUnit(item)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-on-surface-variant">{item.compare_at_minor !== null ? formatMoney(item.compare_at_minor, p.currency) : '—'}</TableCell>
                  <TableCell className="text-on-surface-variant text-xs">
                    GST {item.effective.gst_rate ?? '—'}%{item.effective.hsn_code ? ` · HSN ${item.effective.hsn_code}` : ''}
                  </TableCell>
                  <TableCell className="text-on-surface-variant whitespace-nowrap">{availabilityLabel(item.availability)}</TableCell>
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

      {/* One variant: its pictures and details (read-only). */}
      {openItem &&
        (() => {
          const at = p.items.findIndex((i) => i.id === openItem);
          if (at < 0) return null;
          const item = p.items[at];
          const prev = p.items[at - 1];
          const next = p.items[at + 1];
          const pics = itemPhotos(item);
          const shown = pics.list[Math.min(shownImage, Math.max(pics.list.length - 1, 0))];
          const src = shown ? resolveAssetUrl(shown.url) : null;
          const rows: [string, React.ReactNode][] = [
            ['SKU', item.sku],
            ...p.variant_axes.map((a): [string, React.ReactNode] => [fields.get(a.key)?.label.en ?? a.key, valueOf(item, a.key)]),
            [
              'Price',
              <>
                {priceText(item)}
                {item.resolved_price && <span className="ml-1 text-[10px] uppercase text-outline">{item.resolved_price.tax_inclusive ? 'incl. GST' : '+ GST'}</span>}
                {perUnit(item) && <span className="block text-xs text-on-surface-variant">{perUnit(item)}</span>}
              </>,
            ],
            ['MRP', item.compare_at_minor !== null ? formatMoney(item.compare_at_minor, p.currency) : '—'],
            ['Tax', `GST ${item.effective.gst_rate ?? '—'}%${item.effective.hsn_code ? ` · HSN ${item.effective.hsn_code}` : ''}`],
            ['Track inventory', item.effective.track_inventory ? `On · ${TRACKING_LABELS[item.effective.tracking]}` : 'Off'],
            ['Availability', availabilityLabel(item.availability)],
            [
              'Purchase limits',
              <>
                {item.limits_summary || 'None'}
                {item.purchase_limits && <span className="block text-xs text-on-surface-variant">This item has its own limits</span>}
              </>,
            ],
          ];
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm"
              role="dialog"
              aria-modal="true"
              aria-label={itemTitle(item)}
              data-testid="item-view"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpenItem(null);
              }}
            >
              <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-surface-container-high flex flex-col">
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-surface-container-low">
                  <div className="flex items-center gap-2 min-w-0">
                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">{itemTitle(item)}</h2>
                    {statusPill(item)}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-on-surface-variant mr-1">
                      {at + 1} of {p.items.length}
                    </span>
                    <Button variant="ghost" size="icon-sm" startIcon="chevron_left" disabled={!prev} onClick={() => prev && setOpenItem(prev.id)} aria-label="Previous variant" title="Previous" />
                    <Button variant="ghost" size="icon-sm" startIcon="chevron_right" disabled={!next} onClick={() => next && setOpenItem(next.id)} aria-label="Next variant" title="Next" />
                    <Button variant="ghost" size="icon-sm" startIcon="close" onClick={() => setOpenItem(null)} aria-label="Close" />
                  </div>
                </div>

                <div className="px-6 py-5 flex flex-col md:flex-row gap-6">
                  {/* Pictures: the big one, then every one as a thumbnail */}
                  <div className="md:w-80 shrink-0 flex flex-col gap-2">
                    <div className="w-full aspect-[4/3] rounded-xl overflow-hidden border border-surface-container-high bg-surface-container-low flex items-center justify-center">
                      {src && shown?.kind === 'video' ? (
                        <video src={src} className="w-full h-full object-cover" controls />
                      ) : src ? (
                        <img src={src} alt={itemTitle(item)} className="w-full h-full object-cover" />
                      ) : (
                        <span className="flex flex-col items-center gap-1 text-on-surface-variant text-sm">
                          <span className="material-symbols-outlined text-3xl" aria-hidden="true">
                            image
                          </span>
                          No photos
                        </span>
                      )}
                    </div>
                    {pics.from && <p className="text-xs text-on-surface-variant">No photos of its own — {pics.from}.</p>}
                    {pics.list.length > 1 && (
                      <div className="flex flex-wrap gap-2">
                        {pics.list.map((m, i) => (
                          <button
                            key={`${m.url}-${i}`}
                            type="button"
                            onClick={() => setShownImage(i)}
                            aria-label={`Show image ${i + 1}`}
                            className={`w-14 h-14 rounded-lg overflow-hidden border-2 ${i === Math.min(shownImage, pics.list.length - 1) ? 'border-primary' : 'border-transparent'}`}
                          >
                            {m.kind === 'video' ? (
                              <video src={resolveAssetUrl(m.url) ?? undefined} className="w-full h-full object-cover" muted />
                            ) : (
                              <img src={resolveAssetUrl(m.url) ?? undefined} alt={`Image ${i + 1}`} className="w-full h-full object-cover" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <dl className="flex-1 grid grid-cols-1 gap-y-1 text-sm self-start" data-testid="item-view-details">
                    {rows.map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-4 border-b border-surface-container-low py-1.5">
                        <dt className="text-on-surface-variant">{k}</dt>
                        <dd className="text-on-surface text-right">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="flex justify-end items-center gap-2 px-6 py-4 border-t border-surface-container-low">
                  {canEdit && (
                    <Button variant="outline" size="md" startIcon="edit" onClick={() => navigate(`/v2/products/${p.id}/edit`)}>
                      Edit
                    </Button>
                  )}
                  <Button variant="primary" size="md" onClick={() => setOpenItem(null)} autoFocus>
                    Close
                  </Button>
                </div>
              </div>
            </div>
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

const MediaThumb: React.FC<{ url: string; kind: 'image' | 'video'; alt: string }> = ({ url, kind, alt }) => {
  const src = resolveAssetUrl(url);
  if (!src) return null;
  return kind === 'video' ? (
    <video src={src} className="w-28 h-28 rounded-lg object-cover bg-surface-container-high" controls />
  ) : (
    <img src={src} alt={alt} className="w-28 h-28 rounded-lg object-cover bg-surface-container-high" />
  );
};
