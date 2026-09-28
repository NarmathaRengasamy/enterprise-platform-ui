import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Icon } from '../../components/common';
import {
  AttributeChips,
  AvailabilityPill,
  CommerceSummary,
  ConfirmDialog,
  Modal,
  EmptyState,
  ErrorBanner,
  Field,
  formatMoney,
  inputClass,
  ItemPriceLabel,
  LoadingState,
  PriceRange,
  SuccessBanner,
} from '../../components/catalog/primitives';
import {
  AvailabilityManagerModal,
  ItemEditorModal,
  PriceManagerModal,
} from '../../components/catalog/itemPanels';
import {
  availabilityService,
  catalogProductService,
  chargeService,
  mediaUrl,
  vocabularyValues,
  typeService,
} from '../../services/catalog.service';
import {
  CatalogItem,
  CatalogProduct,
  ChargeBreakdown,
  ResolvedCharge,
  SlotDay,
} from '../../types/catalog.types';

/**
 * One product, in full.
 *
 * The money and availability panels resolve per item rather than per product,
 * because that is where both actually live — and because the answer differs
 * per combination.
 */

export default function CatalogProductDetailsPage(): JSX.Element {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [openItem, setOpenItem] = useState<CatalogItem | null>(null);
  const [breakdown, setBreakdown] = useState<ChargeBreakdown | null>(null);
  const [chosenOptional, setChosenOptional] = useState<Record<string, number>>({});
  const [slots, setSlots] = useState<SlotDay | null>(null);
  const [slotDate, setSlotDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [adjustFor, setAdjustFor] = useState<CatalogItem | null>(null);
  const [delta, setDelta] = useState('');

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [vocabulary, setVocabulary] = useState<Record<string, string[]>>({});

  /* Each sub-record gets its own editor: an item, its prices and its
     availability rows are separate records, and having to rebuild the product
     to change one of them is exactly what this avoids. */
  const [editItem, setEditItem] = useState<CatalogItem | null>(null);
  const [priceFor, setPriceFor] = useState<CatalogItem | null>(null);
  const [availFor, setAvailFor] = useState<CatalogItem | null>(null);
  const [confirmItem, setConfirmItem] = useState<CatalogItem | null>(null);

  const load = useCallback(async () => {
    if (!productId) return;
    try {
      setProduct(await catalogProductService.get(productId));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Only for the open choice fields, and only as suggestions — a failure here
     leaves the inputs working, just without a list to pick from. */
  useEffect(() => {
    if (!product?.typeId) return;
    let cancelled = false;
    typeService
      .vocabulary(product.typeId)
      .then((v) => !cancelled && setVocabulary(vocabularyValues(v)))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [product?.typeId]);

  /* ------------------------------------------------------- item popup */

  const openItemPanel = async (item: CatalogItem) => {
    setOpenItem(item);
    setBreakdown(null);
    setSlots(null);
    setChosenOptional({});
    try {
      setBreakdown(await chargeService.resolve(item.id));
    } catch (e: any) {
      setError(e.message);
    }
  };

  const loadSlots = async () => {
    if (!openItem) return;
    setBusy(true);
    try {
      setSlots(await availabilityService.slots(openItem.id, slotDate));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const adjustStock = async () => {
    if (!adjustFor || !delta) return;
    setBusy(true);
    setError(null);
    try {
      const row = await availabilityService.adjust(adjustFor.id, Number(delta));
      setNotice(`Stock for ${adjustFor.sku} is now ${row.onHand}.`);
      setAdjustFor(null);
      setDelta('');
      await load();
    } catch (e: any) {
      /* An oversell is a 409 naming the real count — shown verbatim. */
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async () => {
    if (!confirmItem || !productId) return;
    setBusy(true);
    setError(null);
    try {
      await catalogProductService.removeItem(productId, confirmItem.id);
      setNotice(`Item ${confirmItem.sku} deleted.`);
      setConfirmItem(null);
      await load();
    } catch (e: any) {
      /* The last item cannot go — it is where price and stock live. */
      setError(e.message);
      setConfirmItem(null);
    } finally {
      setBusy(false);
    }
  };

  const afterSubEdit = async (message: string) => {
    setNotice(message);
    await load();
  };

  const removeProduct = async () => {
    if (!productId) return;
    setBusy(true);
    try {
      const deleted = await catalogProductService.remove(productId);
      navigate('/catalog/products', {
        state: { notice: `"${deleted.name}" deleted (${deleted.itemsDeleted ?? 0} items).` },
      });
    } catch (e: any) {
      setError(e.message);
      setConfirmDelete(false);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading product…" />;
  if (!product) {
    return (
      <div className="flex flex-col w-full pt-space-xs">
        <ErrorBanner message={error ?? 'Product not found'} />
        <Button variant="outline" onClick={() => navigate('/catalog/products')}>
          Back to catalogue
        </Button>
      </div>
    );
  }

  const unit = product.commerce?.pricing.unit;

  /* The optional add-ons the user has ticked, so the running total is live. */
  const optionalTotal = (breakdown?.optional ?? []).reduce(
    (sum, c) => sum + (chosenOptional[c.id] ?? 0) * (c.amount ?? 0),
    0
  );

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div className="flex items-start gap-3 min-w-0">
          <Button size="icon-sm" variant="ghost" onClick={() => navigate('/catalog/products')}
          startIcon="arrow_back"
        />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight truncate">{product.name}</h1>
              <Badge variant={product.status === 'active' ? 'secondary' : 'outline'} size="sm">
                {product.status}
              </Badge>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              <code className="text-xs px-1.5 py-0.5 rounded bg-surface-container">{product.sku}</code>
              {product.brand && <> · {product.brand}</>}
              {product.typeName && <> · {product.typeName}</>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" startIcon="edit" onClick={() => navigate(`/catalog/products/${product.id}/edit`)}>
            Edit
          </Button>
          <Button variant="ghost" startIcon="delete" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </div>
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <SuccessBanner message={notice} onDismiss={() => setNotice(null)} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* ---------------------------------------------------- items */}
        <section className="bg-surface rounded-2xl border border-outline-variant/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/40 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-on-surface">
                Items ({product.items?.length ?? 0})
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Click the name for the price breakdown, or use the actions to edit each one.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              startIcon="add"
              onClick={() => navigate(`/catalog/products/${product.id}/edit`)}
            >
              Add item
            </Button>
          </div>

          {!product.items?.length ? (
            <EmptyState icon="category" title="No items" description="This product has nothing sellable configured." />
          ) : (
            <div className="divide-y divide-outline-variant/40">
              {product.items.map((item) => (
                <div key={item.id} className="px-5 py-3.5 hover:bg-surface-container-low/60 transition-colors group/item">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => openItemPanel(item)}
                      className="min-w-0 flex-1 text-left group"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                          {item.valueLabel || item.sku}
                        </span>
                        <code className="text-[11px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                          {item.sku}
                        </code>
                      </div>
                      {item.optionLabel && (
                        <p className="text-[11px] text-on-surface-variant mt-0.5">{item.optionLabel}</p>
                      )}
                      {item.description && (
                        <p className="text-xs text-on-surface-variant mt-1">{item.description}</p>
                      )}
                      <div className="mt-2">
                        <AttributeChips attributes={item.attributes} fields={product.fields} />
                      </div>
                    </button>

                    <div className="text-right shrink-0 space-y-1.5">
                      <ItemPriceLabel price={item.price} unit={unit} />
                      <div>
                        <AvailabilityPill state={item.availability} />
                      </div>
                      {item.availability?.strategy === 'quantity' && (
                        <button
                          type="button"
                          onClick={() => setAdjustFor(item)}
                          className="text-[11px] text-primary hover:underline font-medium"
                        >
                          Adjust stock
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Every sub-record of the item is reachable from here, so
                      changing one price never means rebuilding the product. */}
                  <div className="flex items-center gap-1 mt-2.5 transition-opacity">
                    <Button size="xs" variant="ghost" startIcon="edit" onClick={() => setEditItem(item)}>
                      Edit
                    </Button>
                    <Button size="xs" variant="ghost" startIcon="sell" onClick={() => setPriceFor(item)}>
                      Prices
                    </Button>
                    <Button size="xs" variant="ghost" startIcon="inventory" onClick={() => setAvailFor(item)}>
                      Availability
                    </Button>
                    <Button size="xs" variant="ghost" startIcon="delete" onClick={() => setConfirmItem(item)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* -------------------------------------------------- sidebar */}
        <aside className="space-y-4">
          {/* Read-only on purpose: uploading and reordering belong in the
              editor, where a save can be cancelled. */}
          {product.media?.length ? (
            <div className="bg-surface rounded-2xl border border-outline-variant/40 p-4">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wide mb-3">
                Media
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[...product.media]
                  .sort((a, b) => a.sort - b.sort)
                  .map((asset) => (
                    <div
                      key={asset.id}
                      className={`aspect-square rounded-lg overflow-hidden bg-surface-container flex items-center justify-center border ${
                        asset.isThumbnail ? 'border-primary' : 'border-outline-variant/40'
                      }`}
                      title={asset.isThumbnail ? 'Thumbnail' : undefined}
                    >
                      {asset.kind === 'image' ? (
                        <img
                          src={mediaUrl(asset.url)}
                          alt={asset.alt ?? ''}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Icon name="play_circle" size="lg" color="outline" />
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ) : null}

          <div className="bg-surface rounded-2xl border border-outline-variant/40 p-4">
            <h3 className="text-xs font-bold text-on-surface uppercase tracking-wide mb-3">Commerce</h3>
            <CommerceSummary commerce={product.commerce} />
            <div className="mt-3 pt-3 border-t border-outline-variant/40 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-on-surface-variant">Price</span>
                <PriceRange product={product} className="text-sm" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-on-surface-variant">Availability</span>
                <span className="text-sm text-on-surface">{product.availabilityLabel}</span>
              </div>
            </div>
          </div>

          {product.attributes?.length ? (
            <div className="bg-surface rounded-2xl border border-outline-variant/40 p-4">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wide mb-3">Details</h3>
              <div className="space-y-2">
                {product.attributes.map((a) => {
                  const field = product.fields?.find((f) => f.key === a.key);
                  return (
                    <div key={a.key} className="flex items-center justify-between gap-2">
                      <span className="text-xs text-on-surface-variant">{field?.label ?? a.key}</span>
                      <span className="text-sm text-on-surface font-medium">{a.value}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {product.description && (
            <div className="bg-surface rounded-2xl border border-outline-variant/40 p-4">
              <h3 className="text-xs font-bold text-on-surface uppercase tracking-wide mb-2">Description</h3>
              <p className="text-sm text-on-surface-variant whitespace-pre-wrap">{product.description}</p>
            </div>
          )}
        </aside>
      </div>

      {/* -------------------------------------------------- item popup */}
      <Modal
        open={Boolean(openItem)}
        title={openItem?.valueLabel || openItem?.sku || 'Item'}
        subtitle={openItem?.sku}
        width="max-w-2xl"
        onClose={() => setOpenItem(null)}
      >
        {!breakdown ? (
          <LoadingState label="Resolving price and charges…" />
        ) : (
          <div className="space-y-5">
            {/* ------------------------------------------- the money */}
            <div>
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide mb-3">
                {breakdown.priceLabel || 'Price'}
              </h4>

              <div className="rounded-xl border border-outline-variant/50 overflow-hidden">
                <div className="px-4 py-3 bg-surface-container-low flex items-center justify-between gap-2">
                  <span className="text-sm text-on-surface-variant">Base</span>
                  <span className="text-base font-bold text-on-surface">
                    {breakdown.base === null ? (
                      <span className="text-sm font-medium italic text-on-surface-variant">
                        {breakdown.pricingModel === 'on_request' ? 'On request' : 'Not priced'}
                      </span>
                    ) : (
                      formatMoney(breakdown.base, breakdown.currency)
                    )}
                  </span>
                </div>

                {breakdown.required.map((c) => (
                  <ChargeRow key={c.id} charge={c} currency={breakdown.currency} />
                ))}

                <div className="px-4 py-3 bg-primary-container/30 flex items-center justify-between gap-2 border-t border-outline-variant/50">
                  <span className="text-sm font-semibold text-on-surface">Total</span>
                  <span className="text-base font-bold text-on-surface">
                    {breakdown.totalRequired === null ? (
                      <span className="text-sm font-medium italic text-on-surface-variant">
                        Quote required
                      </span>
                    ) : (
                      formatMoney(breakdown.totalRequired + optionalTotal, breakdown.currency)
                    )}
                  </span>
                </div>
              </div>

              {breakdown.note && (
                <p className="text-xs text-on-surface-variant mt-2 flex items-start gap-1.5">
                  <Icon name="info" size="xs" className="mt-0.5 shrink-0" />
                  {breakdown.note}
                </p>
              )}
            </div>

            {/* ---------------------------------------- optional add-ons */}
            {breakdown.optional.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide mb-2">
                  Optional add-ons
                </h4>
                <p className="text-[11px] text-on-surface-variant mb-2.5">
                  Never included in the total until chosen.
                </p>
                <div className="space-y-1.5">
                  {breakdown.optional.map((c) => {
                    const qty = chosenOptional[c.id] ?? 0;
                    return (
                      <div
                        key={c.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-outline-variant/50 bg-surface-container-lowest"
                      >
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={qty > 0}
                          onChange={(e) =>
                            setChosenOptional((c2) => ({ ...c2, [c.id]: e.target.checked ? 1 : 0 }))
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-on-surface block truncate">{c.label}</span>
                          <span className="text-[11px] text-on-surface-variant">
                            from {c.source.level}
                          </span>
                        </div>
                        {c.maxQuantity > 1 && qty > 0 && (
                          <input
                            type="number"
                            min={1}
                            max={c.maxQuantity}
                            value={qty}
                            onChange={(e) =>
                              setChosenOptional((c2) => ({
                                ...c2,
                                [c.id]: Math.min(c.maxQuantity, Math.max(1, Number(e.target.value))),
                              }))
                            }
                            className="w-14 px-2 py-1 rounded-lg bg-surface-container text-xs text-center border border-outline-variant/40"
                          />
                        )}
                        <span className="text-sm font-semibold text-on-surface shrink-0">
                          {c.amount === null ? '—' : formatMoney(c.amount, c.currency)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---------------------------------------------- availability */}
            <div>
              <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide mb-2">
                Availability
              </h4>
              <AvailabilityPill state={openItem?.availability} />

              {(openItem?.availability?.strategy === 'time_slot' ||
                openItem?.availability?.detail?.needsSlot) && (
                <div className="mt-3 space-y-2.5">
                  <div className="flex items-end gap-2">
                    <Field label="Date" className="flex-1">
                      <input
                        type="date"
                        className={inputClass}
                        value={slotDate}
                        onChange={(e) => setSlotDate(e.target.value)}
                      />
                    </Field>
                    <Button variant="outline" onClick={loadSlots} loading={busy}>
                      Show slots
                    </Button>
                  </div>

                  {slots && (
                    <div>
                      <p className="text-xs text-on-surface-variant mb-2">
                        {slots.available} of {slots.total} free on {slots.date}
                      </p>
                      {!slots.total ? (
                        <p className="text-xs text-on-surface-variant italic">
                          Closed that day — no opening hours are configured for it.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {slots.slots.map((s) => (
                            <span
                              key={s.startsAt}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                                s.available
                                  ? 'bg-secondary-fixed/40 text-on-secondary-fixed border-secondary/20'
                                  : 'bg-surface-container text-on-surface-variant/50 border-outline-variant/40 line-through'
                              }`}
                            >
                              {new Date(s.startsAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ------------------------------------------------- stock popup */}
      <Modal
        open={Boolean(adjustFor)}
        title="Adjust stock"
        subtitle={adjustFor?.sku}
        onClose={() => setAdjustFor(null)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdjustFor(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={adjustStock} loading={busy} disabled={!delta}>
              Apply
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            Stock moves by a <strong>delta</strong>, not an absolute figure — two concurrent sales
            that each read 10 and write 9 would lose a unit.
          </p>

          <div className="px-4 py-3 rounded-xl bg-surface-container-low">
            <span className="text-xs text-on-surface-variant">Currently on hand</span>
            <p className="text-xl font-bold text-on-surface">
              {adjustFor?.availability?.detail?.onHand ?? '—'}
            </p>
          </div>

          <Field label="Change" hint="Negative sells, positive receives. e.g. -2 or +10">
            <input
              className={inputClass}
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="-2"
              autoFocus
            />
          </Field>

          <div className="flex gap-2">
            {[-1, -5, 5, 10].map((n) => (
              <Button key={n} size="sm" variant="outline" onClick={() => setDelta(String(n))}>
                {n > 0 ? `+${n}` : n}
              </Button>
            ))}
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------- sub-record editors */}
      <ItemEditorModal
        open={Boolean(editItem)}
        productId={product.id}
        item={editItem}
        fields={product.fields ?? []}
        vocabulary={vocabulary}
        onClose={() => setEditItem(null)}
        onSaved={afterSubEdit}
      />

      <PriceManagerModal
        open={Boolean(priceFor)}
        item={priceFor}
        commerce={product.commerce}
        onClose={() => setPriceFor(null)}
        onChanged={afterSubEdit}
      />

      <AvailabilityManagerModal
        open={Boolean(availFor)}
        item={availFor}
        commerce={product.commerce}
        onClose={() => setAvailFor(null)}
        onChanged={afterSubEdit}
      />

      <ConfirmDialog
        open={Boolean(confirmItem)}
        title={`Delete item ${confirmItem?.sku}?`}
        danger
        busy={busy}
        confirmLabel="Delete item"
        onCancel={() => setConfirmItem(null)}
        onConfirm={removeItem}
        body={
          <>
            <p className="mb-2">
              A soft delete — the item, its prices and its availability rows are flagged together
              and can be restored as a set.
            </p>
            <p>
              The <strong>last</strong> item of a product cannot be deleted, because it is where
              price and stock live. Delete the product instead.
            </p>
          </>
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${product.name}"?`}
        danger
        busy={busy}
        confirmLabel="Delete product"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={removeProduct}
        body={
          <>
            <p className="mb-2">
              A soft delete. The product and its {product.items?.length ?? 0} item(s), together with
              their prices and availability, are flagged rather than removed — and can be restored
              as a set.
            </p>
            <p>
              Its SKU <code className="px-1 rounded bg-surface-container">{product.sku}</code> becomes
              free to reuse immediately.
            </p>
          </>
        }
      />
    </div>
  );
}

/**
 * One charge line.
 *
 * A percentage that has no base price shows its note instead of an amount —
 * "18% GST applies, calculated once the price is confirmed" is useful, whereas
 * a zero would simply be wrong.
 */
const ChargeRow: React.FC<{ charge: ResolvedCharge; currency: string }> = ({ charge, currency }) => (
  <div className="px-4 py-2.5 flex items-center justify-between gap-3 border-t border-outline-variant/40">
    <div className="min-w-0">
      <span className="text-sm text-on-surface block truncate">{charge.label}</span>
      <span className="text-[11px] text-on-surface-variant">
        from {charge.source.level}
        {charge.note && ` · ${charge.note}`}
      </span>
    </div>
    <span className="text-sm font-medium text-on-surface shrink-0">
      {charge.amount === null ? (
        <span className="text-on-surface-variant italic text-xs">pending</span>
      ) : (
        formatMoney(charge.amount, charge.currency || currency)
      )}
    </span>
  </div>
);
