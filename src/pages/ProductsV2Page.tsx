import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLabels } from '../context/SiteSettingsContext';
import {
  Button,
  Icon,
  Pagination,
  SearchInput,
  Table,
  TableBody,
  TableCell,
  TableEmptyState,
  TableHead,
  TableHeadCell,
  TableRow,
  Toast,
  ToastMessage,
} from '../components/common';
import { productV2Service } from '../services/productV2.service';
import { catalogCategoryService } from '../services/catalogCategory.service';
import { productTypeService } from '../services/productType.service';
import type { CategoryNode } from '../types/catalogCategory.types';
import type { ProductType } from '../types/productType.types';
import {
  availabilityLabel,
  ProductSearchResult,
  ProductSort,
  ProductStatus,
  ProductSummary,
  STATUS_LABELS,
} from '../types/productV2.types';
import { formatMoney } from '../utils/money';
import { resolveAssetUrl } from '../utils/assetUrl';

/**
 * The new products (Phase 3), beside the current product list until the
 * Phase 5 cut-over. Everything is searched, filtered, sorted and paged by the
 * server (POST /v2/products/search); prices are shown from paise, "Not priced"
 * when there is none, and availability as "12 in stock" or "Not tracked".
 */

const selectClass =
  'h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-sm';
/* One toolbar row: every dropdown the same size. */
const filterClass = `${selectClass} w-full sm:w-44`;

const SORT_LABELS: Record<ProductSort, string> = {
  relevance: 'Best match',
  newest: 'Newest first',
  name: 'Name (A to Z)',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  /* By the smallest size (R46); products without sizes last. */
  size_asc: 'Size: small to large',
  size_desc: 'Size: large to small',
};
const PAGE_SIZES = [10, 20, 50, 100];

const serverText = (e: any): string =>
  (e?.fieldErrors && Object.values(e.fieldErrors).join(' · ')) || e?.message || 'Something went wrong';

/** Categories as options, indented by level in tree mode. */
const categoryOptions = (nodes: CategoryNode[], depth = 0): { id: string; label: string }[] =>
  nodes
    .filter((n) => !n.is_deleted)
    .flatMap((n) => [{ id: n.id, label: `${'— '.repeat(depth)}${n.name.en}` }, ...categoryOptions(n.children, depth + 1)]);

const flatCategories = (nodes: CategoryNode[]): CategoryNode[] => nodes.flatMap((n) => [n, ...flatCategories(n.children)]);

export default function ProductsV2Page() {
  const label = useLabels();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const canEdit = isAdmin || user?.role === 'Editor';
  const plural = label.plural('allProducts');
  const singular = label.singular('allProducts');

  const [result, setResult] = useState<ProductSearchResult | null>(null);
  const [type, setType] = useState<ProductType | null>(null);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  /* Filters */
  const [searchQuery, setSearchQuery] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  /* 'deleted' lists only deleted products, where they can be restored (Admin / Editor). */
  const [status, setStatus] = useState<ProductStatus | 'all' | 'deleted'>('all');
  /* One value per attribute (a dropdown each). */
  const [attrFilters, setAttrFilters] = useState<Record<string, (string | boolean)[]>>({});
  const [sort, setSort] = useState<ProductSort | ''>('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [deleteConfirm, setDeleteConfirm] = useState<ProductSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /* Typing settles for 300 ms before a search is sent. */
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    Promise.all([productTypeService.get(), catalogCategoryService.list(false)])
      .then(([t, c]) => {
        setType(t);
        setCategories(c.categories);
      })
      .catch(() => undefined); // the list still works without the filter options
  }, []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setResult(
        await productV2Service.search({
          ...(search ? { search } : {}),
          ...(categoryId ? { category_id: categoryId } : {}),
          ...(canEdit ? { status } : {}),
          ...(Object.keys(attrFilters).length ? { attributes: attrFilters } : {}),
          ...(sort ? { sort } : {}),
          page,
          limit,
        })
      );
    } catch (e: any) {
      setLoadError(e.message || `Could not load the ${label.lower('allProducts')}`);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryId, status, attrFilters, sort, page, limit, canEdit]);

  useEffect(() => {
    void load();
  }, [load]);

  const fields = useMemo(() => new Map((type?.fields ?? []).map((f) => [f.key, f])), [type]);
  const categoryById = useMemo(() => new Map(flatCategories(categories).map((c) => [c.id, c])), [categories]);
  const optionLabel = (key: string, value: string | boolean) => {
    const f = fields.get(key);
    if (f?.type === 'boolean') return value === true || value === 'true' ? 'Yes' : 'No';
    return f?.options.find((o) => o.value === value)?.label.en ?? String(value);
  };

  /** A facet dropdown: one value, or '' for all. Values travel as text; yes / no become booleans. */
  const setFacet = (key: string, text: string) => {
    setPage(1);
    setAttrFilters((current) => {
      const copy = { ...current };
      if (!text) delete copy[key];
      else copy[key] = [fields.get(key)?.type === 'boolean' ? text === 'true' : text];
      return copy;
    });
  };

  const clearFilters = () => {
    setSearchQuery('');
    setCategoryId('');
    setStatus('all');
    setAttrFilters({});
    setSort('');
    setPage(1);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      await productV2Service.remove(deleteConfirm.id);
      setToast({ text: `${singular} “${deleteConfirm.name.en}” deleted — it can be restored from Status → Deleted.`, type: 'success' });
      setDeleteConfirm(null);
      await load();
    } catch (e) {
      setDeleteConfirm(null);
      setToast({ text: `Cannot delete: ${serverText(e)}`, type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const restore = async (p: ProductSummary) => {
    try {
      await productV2Service.restore(p.id);
      setToast({ text: `${singular} “${p.name.en}” restored`, type: 'success' });
      await load();
    } catch (e) {
      setToast({ text: `Cannot restore: ${serverText(e)}`, type: 'error' });
    }
  };

  const facets = Object.entries(result?.facets ?? {}).filter(([, buckets]) => buckets.length);
  const hasFilters = Boolean(searchQuery || categoryId || sort) || status !== 'all' || Object.keys(attrFilters).length > 0;
  const items = result?.items ?? [];

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      <Toast message={toast} onDismiss={() => setToast(null)} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div className="flex flex-col">
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">{plural}</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            The new {label.lower('allProducts')} — with variants, tax and stock settings
          </p>
        </div>
        <div className="flex items-center gap-space-xs flex-wrap">
          {canEdit && (
            <Button variant="primary" size="md" startIcon="add" onClick={() => navigate('/v2/products/add')}>
              Add {singular}
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="mb-4 p-4 rounded-xl bg-error-container/40 border border-error/20 flex items-center justify-between" role="alert">
          <div className="flex items-center gap-3 text-error">
            <Icon name="error" size="md" />
            <span className="text-sm font-medium">{loadError}</span>
          </div>
          <Button variant="danger" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-low/60 flex flex-col relative">
        {/* Toolbar: search, then every filter as a same-size dropdown, in one row that wraps on small screens */}
        <div className="p-space-md flex flex-col gap-space-sm bg-surface-container-lowest rounded-t-xl">
          <div className="flex flex-wrap items-center gap-space-xs" data-testid="product-filters">
            <div className="flex-1 min-w-[16rem]">
              <SearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${label.lower('allProducts')} by name or brand...`}
                aria-label={`Search ${label.lower('allProducts')}`}
                fullWidth
              />
            </div>
            <select aria-label={label.singular('categories')} className={filterClass} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }}>
              <option value="">All {label.lower('categories')}</option>
              {categoryOptions(categories).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            {canEdit ? (
              <select aria-label="Status" className={filterClass} value={status} onChange={(e) => { setStatus(e.target.value as ProductStatus | 'all' | 'deleted'); setPage(1); }}>
                <option value="all">All statuses</option>
                {(Object.keys(STATUS_LABELS) as ProductStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
                <option value="deleted">Deleted</option>
              </select>
            ) : (
              <span className="h-10 w-full sm:w-44 px-3 flex items-center text-xs text-on-surface-variant">Active {label.lower('allProducts')} only</span>
            )}
            {/* Attribute filters (Body type, Fuel …): one dropdown each, with product counts */}
            {facets.map(([key, buckets]) => {
              const name = fields.get(key)?.label.en ?? key;
              const chosen = attrFilters[key]?.[0];
              return (
                <select
                  key={key}
                  aria-label={name}
                  className={filterClass}
                  value={chosen === undefined ? '' : String(chosen)}
                  onChange={(e) => setFacet(key, e.target.value)}
                  data-testid={`facet-${key}`}
                >
                  <option value="">All {name.toLowerCase()}</option>
                  {buckets.map((b) => (
                    <option key={String(b.value)} value={String(b.value)}>
                      {optionLabel(key, b.value)} ({b.count})
                    </option>
                  ))}
                </select>
              );
            })}
            <select aria-label="Sort" className={filterClass} value={sort} onChange={(e) => { setSort(e.target.value as ProductSort | ''); setPage(1); }}>
              <option value="">{search ? SORT_LABELS.relevance : SORT_LABELS.newest}</option>
              {(['newest', 'name', 'price_asc', 'price_desc', 'size_asc', 'size_desc'] as ProductSort[]).map((s) => (
                <option key={s} value={s}>
                  {SORT_LABELS[s]}
                </option>
              ))}
            </select>
            <Button variant="hover" size="icon" startIcon="refresh" onClick={() => void load()} title="Reload" aria-label={`Reload ${label.lower('allProducts')}`} />
          </div>
          {hasFilters && (
            <div>
              <Button variant="ghost" size="sm" startIcon="filter_alt_off" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          )}
        </div>

        <Table aria-label={plural}>
          <TableHead>
            <tr>
              <TableHeadCell>Name</TableHeadCell>
              <TableHeadCell>{label.singular('categories')}</TableHeadCell>
              <TableHeadCell>Price</TableHeadCell>
              <TableHeadCell>Availability</TableHeadCell>
              <TableHeadCell>Items</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell className="w-28 text-right">Actions</TableHeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i} data-testid="product-loading-row">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <div className="h-4 w-20 rounded bg-surface-container-high animate-pulse" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableEmptyState
                icon="inventory_2"
                title={`No ${label.lower('allProducts')} found`}
                description={hasFilters ? 'Nothing matches these filters.' : canEdit ? `Add your first ${label.lowerSingular('allProducts')}.` : `No ${label.lower('allProducts')} yet.`}
                colSpan={7}
              />
            ) : (
              items.map((p) => {
                const deleted = !!p.is_deleted;
                const primary = p.primary_category_id ? categoryById.get(p.primary_category_id) : undefined;
                const image = resolveAssetUrl(p.media?.[0]?.url);
                return (
                  <TableRow key={p.id} data-testid={`product-${p.slug}`} className={`group ${deleted ? 'opacity-60' : ''}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0 overflow-hidden">
                          {image ? <img src={image} alt="" className="w-full h-full object-cover" /> : <Icon name="inventory_2" size="lg" />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <button
                            type="button"
                            className="text-left font-title-sm text-title-sm text-on-surface font-semibold group-hover:text-primary transition-colors truncate"
                            onClick={() => navigate(`/v2/products/${p.id}`)}
                          >
                            {p.name.en}
                          </button>
                          <span className="font-caption text-caption text-on-surface-variant">
                            {p.slug}
                            {p.brand ? ` • ${p.brand}` : ''}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-on-surface-variant">
                      {primary?.name.en ?? '—'}
                      {p.category_ids.length > 1 && <span className="text-xs text-outline"> +{p.category_ids.length - 1}</span>}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-on-surface">{formatMoney(p.from_price?.amount_minor ?? null, p.from_price?.currency ?? p.currency)}</span>
                      {p.item_count > 1 && p.from_price && <span className="text-xs text-outline"> from</span>}
                      {p.from_price?.tax_inclusive && (
                        <span className="ml-2 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">incl. GST</span>
                      )}
                    </TableCell>
                    <TableCell className="text-on-surface-variant whitespace-nowrap">{availabilityLabel(p.availability)}</TableCell>
                    <TableCell className="text-on-surface-variant">{p.item_count}</TableCell>
                    <TableCell>
                      {deleted ? (
                        <span className="text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full bg-error-container/40 text-error">Deleted</span>
                      ) : (
                        <span
                          className={`text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full ${
                            p.status === 'active'
                              ? 'bg-secondary-fixed/30 text-secondary'
                              : p.status === 'draft'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-surface-container-high text-on-surface-variant'
                          }`}
                        >
                          {STATUS_LABELS[p.status]}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="w-28 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {!deleted && (
                          <Button variant="ghost" size="icon-sm" startIcon="visibility" onClick={() => navigate(`/v2/products/${p.id}`)} aria-label={`View ${p.name.en}`} />
                        )}
                        {canEdit && !deleted && (
                          <Button variant="ghost" size="icon-sm" startIcon="edit" onClick={() => navigate(`/v2/products/${p.id}/edit`)} aria-label={`Edit ${p.name.en}`} />
                        )}
                        {isAdmin && !deleted && (
                          <Button variant="ghost" size="icon-sm" startIcon="delete" onClick={() => setDeleteConfirm(p)} aria-label={`Delete ${p.name.en}`} />
                        )}
                        {isAdmin && deleted && (
                          <Button variant="ghost" size="icon-sm" startIcon="restore_from_trash" onClick={() => void restore(p)} aria-label={`Restore ${p.name.en}`} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {result && result.total > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap px-space-md py-space-sm border-t border-surface-container-low">
            <label className="flex items-center gap-2 text-xs text-on-surface-variant">
              Per page
              <select aria-label="Per page" className={selectClass} value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <Pagination
              currentPage={result.page}
              totalPages={result.pages}
              totalItems={result.total}
              itemsPerPage={result.limit}
              itemLabel={label.lower('allProducts')}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-label={`Delete ${deleteConfirm.name.en}`}
        >
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-surface-container-high p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-error">
              <div className="w-10 h-10 rounded-xl bg-error-container/50 flex items-center justify-center shrink-0">
                <Icon name="warning" size="lg" color="error" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Delete {singular}</h3>
                <span className="text-xs text-on-surface-variant">It and its items can be restored from Status → Deleted.</span>
              </div>
            </div>
            <p className="text-sm text-on-surface">
              Are you sure you want to delete <strong>"{deleteConfirm.name.en}"</strong> ({deleteConfirm.item_count}{' '}
              {deleteConfirm.item_count === 1 ? 'item' : 'items'})?
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
              <Button variant="ghost" size="md" onClick={() => setDeleteConfirm(null)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="danger" size="md" onClick={() => void confirmDelete()} disabled={isDeleting} startIcon={isDeleting ? <Icon name="sync" spin size="sm" /> : 'delete'}>
                {isDeleting ? 'Deleting...' : `Delete ${singular}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
