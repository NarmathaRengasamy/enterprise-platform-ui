import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StoreError, StoreLoading } from './StoreLayout';
import { ProductCard } from './StoreLandingPage';
import storeService, { StoreCategory, StoreFacet, StoreProduct } from '../../services/store.service';

/**
 * The shop listing.
 *
 * Filters live in the URL, so a filtered view can be linked, bookmarked and
 * shared — which is the whole point of a storefront URL.
 */
export default function StoreProductsPage(): JSX.Element {
  const [params, setParams] = useSearchParams();

  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [facets, setFacets] = useState<StoreFacet[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState(params.get('q') ?? '');
  const [debounced, setDebounced] = useState(search);

  const categoryId = params.get('category') ?? '';
  const page = Number(params.get('page') ?? 1);
  const sort = params.get('sort') ?? 'createdAt';

  /* attr.colour=Black,White in the URL → { colour: ['Black','White'] } */
  const attributes: Record<string, string[]> = {};
  params.forEach((value, key) => {
    if (key.startsWith('attr.')) {
      attributes[key.slice(5)] = value.split(',').filter(Boolean);
    }
  });

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    storeService.categories().then(setCategories).catch(() => undefined);
  }, []);

  const patch = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      Object.entries(changes).forEach(([k, v]) => {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      });
      /* Any filter change invalidates the page number — staying on page 4 of a
         narrower result set shows an empty grid that looks like a failure. */
      if (!('page' in changes)) next.delete('page');
      setParams(next, { replace: true });
    },
    [params, setParams]
  );

  useEffect(() => {
    setLoading(true);
    storeService
      .products({
        search: debounced || undefined,
        categoryId: categoryId || undefined,
        attributes: Object.keys(attributes).length ? attributes : undefined,
        sortBy: sort as any,
        sortOrder: sort === 'name' ? 'asc' : 'desc',
        page,
        limit: 12,
        facets: true,
      })
      .then((res) => {
        setProducts(res.data);
        setFacets(res.facets ?? []);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, categoryId, sort, page, params.toString()]);

  const toggleFacet = (key: string, value: string) => {
    const current = attributes[key] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    patch({ [`attr.${key}`]: next.length ? next.join(',') : null });
  };

  const activeCount = Object.values(attributes).flat().length + (categoryId ? 1 : 0);

  return (
    <div className="max-w-6xl mx-auto px-5 py-12">
      <StoreError message={error} />

      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Shop</h1>
        <p className="text-slate-500 text-sm">
          {loading ? 'Searching…' : `${total} item${total === 1 ? '' : 's'}`}
          {activeCount > 0 && ' matching your filters'}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[230px_1fr] gap-10">
        {/* --------------------------------------------------- filters */}
        <aside className="space-y-7">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Search
            </label>
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                patch({ q: e.target.value || null });
              }}
              placeholder="iPhone, blue, 128GB…"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Category
            </label>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => patch({ category: null })}
                className={`block w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                  !categoryId ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Everything
              </button>
              {categories
                .filter((c) => c.productsCount > 0)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => patch({ category: c.id })}
                    className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                      categoryId === c.id
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="truncate">{c.name}</span>
                    <span
                      className={`text-xs shrink-0 ${
                        categoryId === c.id ? 'text-slate-300' : 'text-slate-400'
                      }`}
                    >
                      {c.productsCount}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          {/* Facets are built from the items that actually match, so a value
              showing (0) never appears at all. */}
          {facets.map((f) => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {f.label}
              </label>
              <div className="space-y-1.5">
                {f.values.map((v) => {
                  const on = (attributes[f.key] ?? []).includes(v.value);
                  return (
                    <label
                      key={v.value}
                      className="flex items-center gap-2 cursor-pointer text-sm text-slate-600"
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggleFacet(f.key, v.value)}
                        className="accent-slate-900"
                      />
                      <span className={`flex-1 truncate ${on ? 'text-slate-900 font-medium' : ''}`}>
                        {v.value}
                      </span>
                      <span className="text-xs text-slate-400">{v.count}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => setParams(new URLSearchParams(), { replace: true })}
              className="text-sm text-slate-500 hover:text-slate-900 underline"
            >
              Clear all filters
            </button>
          )}
        </aside>

        {/* --------------------------------------------------- results */}
        <section>
          <div className="flex justify-end mb-5">
            <select
              value={sort}
              onChange={(e) => patch({ sort: e.target.value })}
              className="px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-slate-900"
            >
              <option value="createdAt">Newest first</option>
              <option value="name">Name A–Z</option>
              <option value="brand">Brand</option>
            </select>
          </div>

          {loading ? (
            <StoreLoading label="Finding products…" />
          ) : !products.length ? (
            <div className="py-28 text-center">
              <h2 className="text-lg font-semibold mb-1">Nothing matches</h2>
              <p className="text-slate-500 text-sm">
                Try removing a filter — the numbers beside each option show what's available.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-12">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => patch({ page: String(page - 1) })}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-sm disabled:opacity-40 hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-500 px-3">
                    {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => patch({ page: String(page + 1) })}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-sm disabled:opacity-40 hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
