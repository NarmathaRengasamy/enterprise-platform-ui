import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Icon, Pagination } from '../../components/common';
import {
  AttributeChips,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  LoadingState,
  PriceRange,
  ProductAvailabilityPill,
  SuccessBanner,
  inputClass,
  selectClass,
} from '../../components/catalog/primitives';
import {
  catalogCategoryService,
  catalogProductService,
  mediaUrl,
  typeService,
} from '../../services/catalog.service';
import { CatalogCategory, CatalogProduct, Facet, ProductType } from '../../types/catalog.types';

/**
 * The catalogue list.
 *
 * Filtering goes through POST /products/search rather than the GET: attribute
 * filters are a map of arrays, which does not fit a query string cleanly, and
 * the same call returns the facet sidebar built from the items that actually
 * match.
 */

const LIMIT = 20;

export default function CatalogProductsPage(): JSX.Element {
  const navigate = useNavigate();

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [facets, setFacets] = useState<Facet[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [status, setStatus] = useState('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [attributes, setAttributes] = useState<Record<string, string[]>>({});
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CatalogProduct | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    Promise.all([catalogCategoryService.list(), typeService.list()])
      .then(([c, t]) => {
        setCategories(c);
        setTypes(t);
      })
      .catch((e) => setError(e.message));
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await catalogProductService.search({
        search: debounced || undefined,
        categoryId: categoryId || undefined,
        typeId: typeId || undefined,
        status: status || undefined,
        inStockOnly: inStockOnly || undefined,
        includeDeleted: showDeleted || undefined,
        attributes: Object.keys(attributes).length ? attributes : undefined,
        sortBy,
        sortOrder,
        page,
        limit: LIMIT,
        facets: true,
      });
      setProducts(res.data);
      setFacets(res.facets ?? []);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [debounced, categoryId, typeId, status, inStockOnly, attributes, sortBy, sortOrder, page, showDeleted]);

  useEffect(() => {
    void run();
  }, [run]);

  /* Any filter change invalidates the current page — staying on page 4 of a
     narrower result set shows an empty list that looks like a failure. */
  useEffect(() => {
    setPage(1);
  }, [debounced, categoryId, typeId, status, inStockOnly, attributes]);

  const restore = async (id: string, name: string) => {
    setBusy(true);
    try {
      await catalogProductService.restore(id);
      setNotice(`"${name}" restored, with its items, prices and stock.`);
      await run();
    } catch (e: any) {
      /* Most often the SKU was reused while it was deleted. */
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      const gone = await catalogProductService.remove(confirmDelete.id);
      setNotice(
        `"${confirmDelete.name}" deleted with ${gone.itemsDeleted ?? 0} item(s). Its SKU is free to reuse.`
      );
      setConfirmDelete(null);
      await run();
    } catch (e: any) {
      setError(e.message);
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const toggleFacet = (key: string, value: string) => {
    setAttributes((current) => {
      const chosen = current[key] ?? [];
      const next = chosen.includes(value) ? chosen.filter((v) => v !== value) : [...chosen, value];
      const out = { ...current };
      if (next.length) out[key] = next;
      else delete out[key];
      return out;
    });
  };

  const activeFilters =
    (categoryId ? 1 : 0) +
    (typeId ? 1 : 0) +
    (status ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    Object.keys(attributes).length;

  const clearAll = () => {
    setCategoryId('');
    setTypeId('');
    setStatus('');
    setInStockOnly(false);
    setAttributes({});
    setSearch('');
  };

  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">Catalog</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            {total} product{total === 1 ? '' : 's'}
            {activeFilters > 0 && ' matching the current filters'}
          </p>
        </div>
        <Button variant="primary" startIcon="add" onClick={() => navigate('/catalog/products/new')}>
          New product
        </Button>
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <SuccessBanner message={notice} onDismiss={() => setNotice(null)} />

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        {/* --------------------------------------------------- filters */}
        <aside className="space-y-4">
          <div className="bg-surface rounded-2xl border border-outline-variant/40 p-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wide">Filters</h3>
              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Clear all ({activeFilters})
                </button>
              )}
            </div>

            <select className={selectClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {' '.repeat((c.depth ?? 0) * 3)}
                  {c.name}
                </option>
              ))}
            </select>

            <select className={selectClass} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">All types</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-primary"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
              />
              <span className="text-sm text-on-surface">Available only</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-outline-variant/40">
              <input
                type="checkbox"
                className="accent-primary"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
              />
              <span className="text-sm text-on-surface-variant">Show deleted</span>
            </label>
          </div>

          {/* Facets come from the items that match, with live counts. */}
          {facets.map((facet) => (
            <div key={facet.key} className="bg-surface rounded-2xl border border-outline-variant/40 p-4">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wide mb-2.5">
                {facet.label}
              </h3>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {facet.values.map((v) => {
                  const checked = (attributes[facet.key] ?? []).includes(v.value);
                  return (
                    <label
                      key={v.value}
                      className="flex items-center gap-2 cursor-pointer group py-0.5"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={checked}
                        onChange={() => toggleFacet(facet.key, v.value)}
                      />
                      <span
                        className={`text-sm flex-1 truncate ${
                          checked ? 'text-on-surface font-medium' : 'text-on-surface-variant'
                        }`}
                      >
                        {v.value}
                      </span>
                      <span className="text-[11px] text-on-surface-variant/70 shrink-0">{v.count}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* ---------------------------------------------------- results */}
        <section className="space-y-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Icon
                name="search"
                size="sm"
                color="outline"
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                className={`${inputClass} pl-9`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, SKU, brand or any attribute value…"
              />
            </div>
            <select
              className={`${selectClass} w-auto`}
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split(':');
                setSortBy(by);
                setSortOrder(order as 'asc' | 'desc');
              }}
            >
              <option value="createdAt:desc">Newest first</option>
              <option value="createdAt:asc">Oldest first</option>
              <option value="name:asc">Name A–Z</option>
              <option value="name:desc">Name Z–A</option>
              <option value="sku:asc">SKU A–Z</option>
            </select>
          </div>

          {loading ? (
            <LoadingState label="Searching the catalogue…" />
          ) : !products.length ? (
            <div className="bg-surface rounded-2xl border border-outline-variant/40">
              <EmptyState
                icon="inventory_2"
                title={activeFilters || debounced ? 'Nothing matches' : 'No products yet'}
                description={
                  activeFilters || debounced
                    ? 'Try clearing a filter — the facet counts show what is actually available.'
                    : 'Add a product and its variants. The form is built from the type its category declares.'
                }
                action={
                  activeFilters || debounced ? (
                    <Button variant="outline" onClick={clearAll}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button variant="primary" startIcon="add" onClick={() => navigate('/catalog/products/new')}>
                      Add a product
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                {products.map((p) => (
                  /* A div, not a button: a deleted row carries its own Restore
                     button, and a button inside a button is invalid markup. */
                  <div
                    key={p.id}
                    className={`w-full bg-surface rounded-2xl border p-4 transition-all group ${
                      p.is_deleted
                        ? 'border-dashed border-outline-variant/60 opacity-70'
                        : 'border-outline-variant/40 hover:border-primary/40 hover:shadow-sm cursor-pointer'
                    }`}
                    onClick={() => !p.is_deleted && navigate(`/catalog/products/${p.id}`)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center shrink-0 overflow-hidden">
                        {p.image ? (
                          <img src={mediaUrl(p.image)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Icon name="inventory_2" size="lg" color="outline" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm font-semibold transition-colors ${
                              p.is_deleted
                                ? 'text-on-surface-variant line-through'
                                : 'text-on-surface group-hover:text-primary'
                            }`}
                          >
                            {p.name}
                          </span>
                          {p.is_deleted && (
                            <Badge variant="error" size="sm">
                              deleted
                            </Badge>
                          )}
                          <code className="text-[11px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                            {p.sku}
                          </code>
                          {p.status !== 'active' && (
                            <Badge variant="outline" size="sm">
                              {p.status}
                            </Badge>
                          )}
                          {p.brand && (
                            <span className="text-xs text-on-surface-variant">{p.brand}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap mt-1.5">
                          {p.categoryIds?.slice(0, 2).map((id) => (
                            <Badge key={id} variant="neutral" size="sm" icon="folder">
                              {categoryName.get(id) ?? 'Unknown'}
                            </Badge>
                          ))}
                          <span className="text-xs text-on-surface-variant">
                            {p.items?.length ?? 0} item{p.items?.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        {p.attributes?.length ? (
                          <div className="mt-2">
                            <AttributeChips attributes={p.attributes} fields={p.fields} max={4} />
                          </div>
                        ) : null}
                      </div>

                      <div className="text-right shrink-0 space-y-1.5">
                        <PriceRange product={p} className="text-sm block" />
                        <ProductAvailabilityPill product={p} />
                        {p.is_deleted ? (
                          <Button
                            size="xs"
                            variant="outline"
                            startIcon="restore"
                            disabled={busy}
                            onClick={(e) => {
                              e.stopPropagation();
                              restore(p.id, p.name);
                            }}
                          >
                            Restore
                          </Button>
                        ) : (
                          /* stopPropagation: the whole card navigates, and a
                             click on an action must not do both. */
                          <div className="flex items-center justify-end gap-1 pt-0.5">
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              title="Edit"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/catalog/products/${p.id}/edit`);
                              }}

                              startIcon="edit"
                            />
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              title="Delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete(p);
                              }}
                              startIcon="delete"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  totalItems={total}
                  itemsPerPage={LIMIT}
                />
              )}
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Delete "${confirmDelete?.name}"?`}
        danger
        busy={busy}
        confirmLabel="Delete product"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={remove}
        body={
          <>
            <p className="mb-2">
              A soft delete. The product and its {confirmDelete?.items?.length ?? 0} item(s), with
              their prices and availability, are flagged together and can be restored as a set.
            </p>
            <p>
              Its SKU <code className="px-1 rounded bg-surface-container">{confirmDelete?.sku}</code>{' '}
              becomes free to reuse immediately.
            </p>
          </>
        }
      />
    </div>
  );
}
