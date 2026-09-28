import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { StoreError, StoreLoading, StockLine } from './StoreLayout';
import storeService, {
  StoreBreakdown,
  StoreItem,
  StoreMedia,
  StoreProduct,
  money,
  storeAsset,
} from '../../services/store.service';

/**
 * One product, with a variant picker and the real price breakdown.
 *
 * The breakdown is fetched per selected variant rather than computed here —
 * charge inheritance, override rules and the order percentages apply in are
 * all server-side, and duplicating any of that in the browser would eventually
 * disagree with the till.
 */
/**
 * Turns a YouTube or Vimeo watch link into one that can be framed.
 *
 * A plain watch URL refuses to load in an iframe, so pasting one and showing
 * it verbatim would leave a blank square with nothing to explain it.
 */
const embedUrl = (url: string): string => {
  const youtube = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/i);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
};

export default function StoreProductPage(): JSX.Element {
  const { productId } = useParams<{ productId: string }>();

  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [selected, setSelected] = useState<StoreItem | null>(null);
  const [breakdown, setBreakdown] = useState<StoreBreakdown | null>(null);
  const [chosen, setChosen] = useState<Record<string, number>>({});
  const [frame, setFrame] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    storeService
      .product(productId)
      .then((p) => {
        setProduct(p);
        /* Prefer something a customer can actually buy today. */
        setSelected(p.items.find((i) => i.available) ?? p.items[0] ?? null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [productId]);

  useEffect(() => {
    if (!selected) return;
    setBreakdown(null);
    setChosen({});
    storeService
      .charges(selected.id)
      .then(setBreakdown)
      .catch((e) => setError(e.message));
  }, [selected]);

  /* The variant picker: one row per axis, built from the item attributes. */
  const axes = useMemo(() => {
    const map = new Map<string, { label: string; values: string[] }>();
    for (const item of product?.items ?? []) {
      for (const a of item.attributes) {
        const entry = map.get(a.key) ?? { label: a.label, values: [] };
        if (!entry.values.includes(a.value)) entry.values.push(a.value);
        map.set(a.key, entry);
      }
    }
    return [...map.entries()].map(([key, v]) => ({ key, ...v }));
  }, [product]);

  const pick = (key: string, value: string) => {
    if (!product || !selected) return;
    const wanted = new Map(selected.attributes.map((a) => [a.key, a.value]));
    wanted.set(key, value);
    /* Land on the exact combination if it exists; otherwise the closest one
       that has the value just clicked, so the picker never dead-ends. */
    const exact = product.items.find((i) =>
      i.attributes.every((a) => wanted.get(a.key) === a.value)
    );
    setSelected(
      exact ?? product.items.find((i) => i.attributes.some((a) => a.key === key && a.value === value)) ?? selected
    );
  };

  /**
   * What the gallery shows.
   *
   * A variant with its own pictures replaces the product's rather than adding
   * to them — a shopper who picks Blue should see the blue phone, not the red
   * one first with blue somewhere further along.
   */
  const gallery = useMemo<StoreMedia[]>(() => {
    const own = selected?.media ?? [];
    const list = own.length ? own : product?.media ?? [];
    if (list.length) return [...list].sort((a, b) => a.sort - b.sort);

    /* Products from before media existed carry a bare `image` and nothing
       else. Showing it beats showing the placeholder. */
    const legacy = selected?.image || product?.image;
    return legacy
      ? [{ id: 'legacy', kind: 'image', url: legacy, source: 'upload', sort: 0 }]
      : [];
  }, [selected, product]);

  /* Switching variant starts the gallery again — frame 3 of the old set means
     nothing in the new one. */
  useEffect(() => setFrame(0), [selected?.id]);

  const shown = gallery[frame] ?? gallery[0];

  const optionalTotal = (breakdown?.optional ?? []).reduce(
    (sum, c) => sum + (chosen[c.id] ?? 0) * (c.amount ?? 0),
    0
  );

  if (loading) return <StoreLoading label="Loading…" />;
  if (!product) {
    return (
      <div className="max-w-6xl mx-auto px-5 py-32 text-center">
        <h1 className="text-xl font-semibold mb-2">Product not found</h1>
        <p className="text-slate-500 text-sm mb-6">It may have been taken off the shop.</p>
        <Link to="/store/products" className="text-sm font-semibold underline">
          Back to the shop
        </Link>
      </div>
    );
  }

  const currency = breakdown?.currency ?? product.pricing.currency;

  return (
    <div className="max-w-6xl mx-auto px-5 py-10">
      <StoreError message={error} />

      <nav className="text-sm text-slate-400 mb-8">
        <Link to="/store" className="hover:text-slate-900">Home</Link>
        <span className="mx-2">/</span>
        <Link to="/store/products" className="hover:text-slate-900">Shop</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-600">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* ----------------------------------------------- gallery */}
        <div>
          <div className="aspect-square rounded-3xl bg-slate-50 flex items-center justify-center overflow-hidden">
            {shown ? (
              shown.kind === 'image' ? (
                <img
                  src={storeAsset(shown.url)}
                  alt={shown.alt || product.name}
                  className="w-full h-full object-cover"
                />
              ) : shown.source === 'link' ? (
                <iframe
                  src={embedUrl(shown.url)}
                  title={product.name}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={storeAsset(shown.url)} controls className="w-full h-full object-cover" />
              )
            ) : (
              <span className="material-symbols-outlined text-8xl text-slate-200">smartphone</span>
            )}
          </div>

          {gallery.length > 1 && (
            <div className="flex gap-2.5 mt-4 overflow-x-auto pb-1">
              {gallery.map((asset, index) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setFrame(index)}
                  aria-label={`View ${index + 1} of ${gallery.length}`}
                  className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors ${
                    index === frame ? 'border-slate-900' : 'border-transparent hover:border-slate-300'
                  }`}
                >
                  {asset.kind === 'image' ? (
                    <img
                      src={storeAsset(asset.url)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="w-full h-full bg-slate-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-slate-400">play_circle</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ------------------------------------------------ detail */}
        <div>
          {product.brand && (
            <p className="text-sm text-slate-400 mb-1">{product.brand}</p>
          )}
          <h1 className="text-3xl font-bold tracking-tight mb-3">{product.name}</h1>
          {product.description && (
            <p className="text-slate-600 mb-6">{product.description}</p>
          )}

          {/* variant picker */}
          {axes.length > 0 && (
            <div className="space-y-5 mb-8">
              {axes.map((axis) => {
                const current = selected?.attributes.find((a) => a.key === axis.key)?.value;
                return (
                  <div key={axis.key}>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      {axis.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {axis.values.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => pick(axis.key, v)}
                          className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                            current === v
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 hover:border-slate-500'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selected?.description && (
            <p className="text-sm text-slate-500 mb-6">{selected.description}</p>
          )}

          {/* ------------------------------------------ the money */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden mb-6">
            <div className="px-5 py-4 flex items-center justify-between gap-3 bg-slate-50">
              <span className="text-sm text-slate-500">
                {breakdown?.priceLabel || 'Price'}
              </span>
              <span className="text-2xl font-bold">
                {breakdown
                  ? breakdown.base === null
                    ? <span className="text-base font-semibold text-slate-500">On request</span>
                    : money(breakdown.base, currency)
                  : '—'}
              </span>
            </div>

            {(breakdown?.required ?? []).map((c) => (
              <div
                key={c.id}
                className="px-5 py-3 flex items-center justify-between gap-3 border-t border-slate-100 text-sm"
              >
                <span className="text-slate-600">
                  {c.label}
                  {c.note && <span className="block text-xs text-slate-400">{c.note}</span>}
                </span>
                <span className="font-medium">
                  {c.amount === null ? (
                    <span className="text-slate-400 text-xs italic">once quoted</span>
                  ) : (
                    money(c.amount, c.currency || currency)
                  )}
                </span>
              </div>
            ))}

            <div className="px-5 py-4 flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-900 text-white">
              <span className="text-sm font-medium">Total</span>
              <span className="text-xl font-bold">
                {breakdown?.totalRequired === null || breakdown?.totalRequired === undefined ? (
                  <span className="text-base font-semibold">Quote required</span>
                ) : (
                  money(breakdown.totalRequired + optionalTotal, currency)
                )}
              </span>
            </div>
          </div>

          {breakdown?.note && (
            <p className="text-xs text-slate-500 mb-6 flex items-start gap-1.5">
              <span className="material-symbols-outlined text-sm">info</span>
              {breakdown.note}
            </p>
          )}

          {/* optional add-ons */}
          {(breakdown?.optional ?? []).length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Add-ons
              </p>
              <div className="space-y-2">
                {breakdown!.optional.map((c) => {
                  const qty = chosen[c.id] ?? 0;
                  return (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 cursor-pointer hover:border-slate-400 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={qty > 0}
                        onChange={(e) =>
                          setChosen((s) => ({ ...s, [c.id]: e.target.checked ? 1 : 0 }))
                        }
                        className="accent-slate-900"
                      />
                      <span className="flex-1 text-sm">{c.label}</span>
                      {c.maxQuantity > 1 && qty > 0 && (
                        <input
                          type="number"
                          min={1}
                          max={c.maxQuantity}
                          value={qty}
                          onChange={(e) =>
                            setChosen((s) => ({
                              ...s,
                              [c.id]: Math.min(c.maxQuantity, Math.max(1, Number(e.target.value))),
                            }))
                          }
                          className="w-14 px-2 py-1 rounded-lg border border-slate-300 text-xs text-center"
                        />
                      )}
                      <span className="text-sm font-semibold">
                        {c.amount === null ? '—' : money(c.amount, c.currency || currency)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-6">
            <StockLine label={selected?.availabilityLabel} available={selected?.available} />
          </div>

          <button
            type="button"
            disabled={!selected}
            className="w-full py-4 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors disabled:opacity-40"
          >
            {breakdown?.base === null ? 'Request a quote' : 'Add to basket'}
          </button>
          {/* Honest about what exists: the catalogue has no orders module yet. */}
          <p className="text-xs text-slate-400 text-center mt-3">
            Checkout is not connected yet — call the shop to confirm.
          </p>

          {product.attributes.length > 0 && (
            <div className="mt-10 pt-8 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
                Details
              </p>
              <dl className="space-y-2.5">
                {product.attributes.map((a) => (
                  <div key={a.key} className="flex justify-between gap-4 text-sm">
                    <dt className="text-slate-500">{a.label}</dt>
                    <dd className="font-medium text-right">{a.value}</dd>
                  </div>
                ))}
                {selected && (
                  <div className="flex justify-between gap-4 text-sm">
                    <dt className="text-slate-500">SKU</dt>
                    <dd className="font-mono text-xs text-right">{selected.sku}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
