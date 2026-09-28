import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { StoreError, StoreLoading, StockLine } from './StoreLayout';
import storeService, {
  StoreCategory,
  StoreProduct,
  priceLabel,
  storeAsset,
} from '../../services/store.service';

/**
 * The shop front page.
 *
 * Categories first, then the newest products. Both come from the public API,
 * so what appears here is exactly what the catalogue says is published —
 * there is no separate "website content" to keep in sync.
 */
export default function StoreLandingPage(): JSX.Element {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([storeService.categories(), storeService.products({ limit: 6 })])
      .then(([cats, page]) => {
        /* Only categories that actually have something to show. An empty
           category on a shop front is a dead end. */
        setCategories(cats.filter((c) => c.productsCount > 0));
        setProducts(page.data);
        setTotal(page.total);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <StoreLoading label="Loading the shop…" />;

  return (
    <>
      <StoreError message={error} />

      {/* ------------------------------------------------------- hero */}
      <section className="border-b border-slate-100 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-6xl mx-auto px-5 py-20 sm:py-28">
          <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase mb-4">
            Phones · Accessories · Repairs
          </p>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight max-w-3xl leading-[1.05]">
            Good phones, honest repairs.
          </h1>
          <p className="mt-5 text-lg text-slate-600 max-w-xl">
            Browse what's in stock today, or bring your phone in — repairs are quoted after we've
            looked at it, never before.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/store/products"
              className="px-5 py-3 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors"
            >
              Shop {total > 0 ? `all ${total}` : 'now'}
            </Link>
            <a
              href="#categories"
              className="px-5 py-3 rounded-xl border border-slate-300 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              Browse by category
            </a>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- categories */}
      {categories.length > 0 && (
        <section id="categories" className="max-w-6xl mx-auto px-5 py-16">
          <h2 className="text-2xl font-bold tracking-tight mb-1">Browse</h2>
          <p className="text-slate-500 text-sm mb-8">
            Each part of the shop works a little differently.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate(`/store/products?category=${c.id}`)}
                className="text-left p-6 rounded-2xl border border-slate-200 hover:border-slate-900 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-lg group-hover:text-slate-900">{c.name}</h3>
                  <span className="text-xs text-slate-400 shrink-0 mt-1">
                    {c.productsCount} item{c.productsCount === 1 ? '' : 's'}
                  </span>
                </div>
                {c.description && (
                  <p className="text-sm text-slate-500 mb-3">{c.description}</p>
                )}
                {/* The pricing label is the honest headline for this category —
                    "Quoted after inspection" is more useful than a fake price. */}
                <span className="inline-block text-xs font-medium text-slate-600 bg-slate-100 rounded-full px-2.5 py-1">
                  {c.pricing.label ||
                    (c.pricing.model === 'on_request' ? 'Quoted on request' : 'Fixed prices')}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------- newest */}
      {products.length > 0 && (
        <section className="max-w-6xl mx-auto px-5 pb-8">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-1">Latest</h2>
              <p className="text-slate-500 text-sm">Newest in the shop.</p>
            </div>
            <Link
              to="/store/products"
              className="text-sm font-semibold text-slate-900 hover:underline shrink-0"
            >
              See everything →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {!categories.length && !products.length && !error && (
        <div className="max-w-6xl mx-auto px-5 py-32 text-center">
          <h2 className="text-xl font-semibold mb-2">Nothing published yet</h2>
          <p className="text-slate-500 text-sm">
            Products appear here once they are marked <strong>active</strong> in the catalogue.
          </p>
        </div>
      )}
    </>
  );
}

/* ----------------------------------------------------------------- card */

export const ProductCard: React.FC<{ product: StoreProduct }> = ({ product }) => (
  <Link
    to={`/store/product/${product.id}`}
    className="block rounded-2xl border border-slate-200 overflow-hidden hover:border-slate-900 hover:shadow-md transition-all group"
  >
    <div className="aspect-[4/3] bg-slate-50 flex items-center justify-center overflow-hidden">
      {product.image ? (
        <img
          src={storeAsset(product.image)}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
        />
      ) : (
        <span className="material-symbols-outlined text-5xl text-slate-300">smartphone</span>
      )}
    </div>

    <div className="p-5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <h3 className="font-semibold leading-snug group-hover:text-slate-900">{product.name}</h3>
        {product.brand && (
          <span className="text-xs text-slate-400 shrink-0 mt-0.5">{product.brand}</span>
        )}
      </div>

      {product.items.length > 1 && (
        <p className="text-xs text-slate-400 mb-2">
          {product.items.length} options
        </p>
      )}

      <p className="font-bold text-lg mt-2">{priceLabel(product)}</p>
      <div className="mt-2">
        <StockLine label={product.availabilityLabel} available={product.available} />
      </div>
    </div>
  </Link>
);
