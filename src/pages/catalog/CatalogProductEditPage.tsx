import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Icon } from '../../components/common';
import {
  EmptyState,
  ErrorBanner,
  Field,
  inputClass,
  LoadingState,
  selectClass,
} from '../../components/catalog/primitives';
import { AttributeFields, attributesToMap, mapToAttributes } from '../../components/catalog/forms';
import { MediaManager } from '../../components/catalog/MediaManager';
import {
  catalogCategoryService,
  catalogProductService,
  chargeService,
  typeService,
  vocabularyValues,
} from '../../services/catalog.service';
import {
  AttributeValue,
  CatalogCategory,
  CatalogCharge,
  CommerceConfig,
  FieldDefinition,
  ItemInput,
  MediaAsset,
  ProductType,
} from '../../types/catalog.types';

/**
 * Create / edit a product.
 *
 * The form has no fixed shape: it is built from the `FieldDefinition[]` the
 * product's type declares, which is what lets one screen serve a dealership,
 * a clinic and a clothing shop.
 *
 * Variant generation is **offered, not imposed**. A dealership does not stock
 * every trim in every colour, so the matrix is previewed and the user prunes
 * the rows before anything is saved.
 */

interface DraftItem {
  /** Present only for rows that already exist server-side. */
  id?: string;
  key: string;
  attributes: AttributeValue[];
  sku: string;
  optionLabel: string;
  valueLabel: string;
  description: string;
  /** This variant's own pictures. Empty means it shows the product's. */
  media: MediaAsset[];
  price: string;
  stock: string;
  leadDays: string;
  /** An existing row the user removed — it is deleted on save. */
  removed?: boolean;
}

const signature = (attributes: AttributeValue[]): string =>
  [...attributes].map((a) => `${a.key}=${a.value}`).sort().join('|');

export default function CatalogProductEditPage(): JSX.Element {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(productId);

  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [type, setType] = useState<ProductType | null>(null);
  const [commerce, setCommerce] = useState<CommerceConfig | null>(null);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('draft');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [typeId, setTypeId] = useState('');
  const [productAttrs, setProductAttrs] = useState<Record<string, string>>({});
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [vocabulary, setVocabulary] = useState<Record<string, string[]>>({});
  const [items, setItems] = useState<DraftItem[]>([]);

  const [selection, setSelection] = useState<Record<string, string[]>>({});
  /* What is being typed into each open axis, before Enter commits it. */
  const [openDraft, setOpenDraft] = useState<Record<string, string>>({});
  const [allCharges, setAllCharges] = useState<CatalogCharge[]>([]);
  /* Collapsed by default: this panel explains the form rather than being part
     of it, so it should not compete with the fields for attention. The header
     still carries the two models and the charge count. */
  const [explainOpen, setExplainOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ----------------------------------------------------------- loading */

  useEffect(() => {
    /* Charges are fetched once and filtered client-side. The resolved
       endpoint works per ITEM, and on a new product no item exists yet — so
       the preview walks the category tree itself. */
    Promise.all([catalogCategoryService.list(), typeService.list(), chargeService.list()])
      .then(([c, t, ch]) => {
        setCategories(c);
        setTypes(t);
        setAllCharges(ch);
      })
      .catch((e) => setError(e.message))
      .finally(() => !isEdit && setLoading(false));
  }, [isEdit]);

  useEffect(() => {
    if (!productId) return;
    catalogProductService
      .get(productId)
      .then((p) => {
        setSku(p.sku);
        setName(p.name);
        setDescription(p.description ?? '');
        setBrand(p.brand ?? '');
        setStatus(p.status);
        setCategoryIds(p.categoryIds ?? []);
        setTypeId(p.typeId);
        setProductAttrs(attributesToMap(p.attributes));
        setMedia(p.media ?? []);
        setCommerce(p.commerce ?? null);
        setItems(
          (p.items ?? []).map((i) => ({
            id: i.id,
            key: i.id,
            attributes: i.attributes ?? [],
            sku: i.sku,
            optionLabel: i.optionLabel ?? '',
            valueLabel: i.valueLabel ?? '',
            description: i.description ?? '',
            media: i.media ?? [],
            price: typeof i.price?.amount === 'number' ? String(i.price.amount) : '',
            stock:
              typeof i.availability?.detail?.onHand === 'number'
                ? String(i.availability.detail.onHand)
                : '',
            leadDays:
              typeof i.availability?.detail?.leadDays === 'number'
                ? String(i.availability.detail.leadDays)
                : '',
          }))
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [productId]);

  /** The type is chosen explicitly, or inherited from the first category. */
  const effectiveTypeId = useMemo(() => {
    if (typeId) return typeId;
    for (const id of categoryIds) {
      const c = categories.find((x) => x.id === id);
      if (c?.effectiveTypeId) return c.effectiveTypeId;
    }
    return '';
  }, [typeId, categoryIds, categories]);

  useEffect(() => {
    if (!effectiveTypeId) {
      setType(null);
      return;
    }
    let cancelled = false;
    typeService
      .get(effectiveTypeId)
      .then((t) => !cancelled && setType(t))
      .catch(() => !cancelled && setType(null));

    /* Suggestions only, so a failure here is not worth an error banner — the
       fields still work, they just stop offering what others have typed. */
    typeService
      .vocabulary(effectiveTypeId)
      .then((v) => !cancelled && setVocabulary(vocabularyValues(v)))
      .catch(() => !cancelled && setVocabulary({}));

    return () => {
      cancelled = true;
    };
  }, [effectiveTypeId]);

  /* Commerce follows the category, so the item rows know whether to ask for a
     stock count, a lead time, or nothing at all. */
  useEffect(() => {
    if (isEdit) return;
    const first = categoryIds.map((id) => categories.find((c) => c.id === id)).find(Boolean);
    setCommerce(first?.effectiveCommerce ?? null);
  }, [categoryIds, categories, isEdit]);

  const fields: FieldDefinition[] = type?.fields ?? [];
  const axes = useMemo(() => fields.filter((f) => f.variantForming && !f.deprecated), [fields]);
  const liveItems = items.filter((i) => !i.removed);

  /**
   * The charges this product will pick up from the categories chosen.
   *
   * Walks each selected category up to the root, because a charge on a parent
   * applies to everything beneath it — the same rule the server uses when it
   * resolves a real item.
   */
  const inheritedCharges = useMemo(() => {
    if (!categoryIds.length) return [] as { charge: CatalogCharge; from: string }[];

    const byId = new Map(categories.map((c) => [c.id, c]));
    const chain = new Map<string, string>(); // category id -> its name

    for (const id of categoryIds) {
      let cursor: string | null | undefined = id;
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        const node = byId.get(cursor);
        if (!node) break;
        chain.set(node.id, node.name);
        cursor = node.parentId ?? null;
      }
    }

    /* A nearer charge with the same name replaces a broader one, so only the
       first of each name survives — mirroring the server. */
    const winners = new Map<string, { charge: CatalogCharge; from: string }>();
    for (const c of allCharges) {
      if (c.scope.level !== 'category') continue;
      const from = chain.get(c.scope.refId);
      if (!from) continue;
      if (!winners.has(c.name)) winners.set(c.name, { charge: c, from });
    }
    return [...winners.values()];
  }, [categoryIds, categories, allCharges]);

  /** Non-variant field labels, for the explanation panel. */
  const productLevelLabels = fields
    .filter((f) => !f.variantForming && !f.deprecated)
    .map((f) => f.label);

  const pricingModel = commerce?.pricing.model;
  const availabilityModel = commerce?.availability.model;
  const showPrice = pricingModel !== 'on_request' && pricingModel !== 'free';
  const showStock = availabilityModel === 'quantity';
  const showLead = availabilityModel === 'lead_time';

  /* ------------------------------------------------------------ matrix */

  const generate = async () => {
    if (!effectiveTypeId) return;
    setError(null);
    try {
      const result = await catalogProductService.matrix(effectiveTypeId, selection, sku || 'SKU');
      const existing = new Set(liveItems.map((i) => signature(i.attributes)));

      /* Only genuinely new combinations are appended. Regenerating after
         editing a row must not wipe the price the user just typed in. */
      const added = result.items
        .filter((m) => !existing.has(signature(m.attributes)))
        .map<DraftItem>((m) => ({
          key: `new-${signature(m.attributes)}`,
          attributes: m.attributes,
          sku: m.sku,
          optionLabel: m.optionLabel,
          valueLabel: m.valueLabel,
          description: '',
          media: [],
          price: '',
          stock: '',
          leadDays: '',
        }));

      if (!added.length) {
        setError('Every combination in that selection already exists below.');
        return;
      }
      setItems((current) => [...current, ...added]);
    } catch (e: any) {
      setError(e.message);
    }
  };

  /**
   * Commits a typed value onto an open axis.
   *
   * Deduped case-insensitively here as well as on the server, so the chip list
   * cannot show Blue and blue side by side while you are still typing.
   */
  const addOpenValue = (key: string) => {
    const raw = (openDraft[key] ?? '').trim();
    if (!raw) return;

    setSelection((current) => {
      const chosen = current[key] ?? [];
      if (chosen.some((v) => v.toLowerCase() === raw.toLowerCase())) return current;
      return { ...current, [key]: [...chosen, raw] };
    });
    setOpenDraft((d) => ({ ...d, [key]: '' }));
  };

  const removeOpenValue = (key: string, value: string) =>
    setSelection((current) => {
      const next = (current[key] ?? []).filter((v) => v !== value);
      const out = { ...current };
      if (next.length) out[key] = next;
      else delete out[key];
      return out;
    });

  const addSingleItem = () => {
    if (liveItems.length) return;
    setItems([
      {
        key: 'single',
        attributes: [],
        sku: sku || '',
        optionLabel: '',
        valueLabel: '',
        description: '',
        media: [],
        price: '',
        stock: '',
        leadDays: '',
      },
    ]);
  };

  /* A product with no variant axes still needs exactly one item — that is
     where its price and stock live. It is created silently rather than asking. */
  useEffect(() => {
    if (!isEdit && type && !axes.length && !items.length) addSingleItem();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, axes.length, isEdit]);

  const patchItem = (key: string, patch: Partial<DraftItem>) =>
    setItems((current) => current.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const dropItem = (key: string) =>
    setItems((current) =>
      current
        .map((i) => (i.key === key ? { ...i, removed: true } : i))
        /* An unsaved row can just go; a saved one is kept so it can be deleted
           server-side on save. */
        .filter((i) => !(i.key === key && !i.id))
    );

  /* ------------------------------------------------------------- save */

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const payloadItems: ItemInput[] = liveItems.map((i) => ({
        attributes: i.attributes,
        sku: i.sku || undefined,
        description: i.description || undefined,
        ...(i.media.length ? { media: i.media } : {}),
        /* Absent means absent. Sending 0 for a blank price would turn "not
           priced yet" into "priced at zero", which is the v1 bug. */
        ...(i.price !== '' ? { price: Number(i.price) } : {}),
        ...(i.stock !== '' ? { stock: Number(i.stock) } : {}),
        ...(i.leadDays !== '' ? { leadDays: Number(i.leadDays) } : {}),
      }));

      if (isEdit && productId) {
        await catalogProductService.update(productId, {
          sku,
          name,
          description,
          brand: brand || undefined,
          status,
          categoryIds,
          attributes: mapToAttributes(productAttrs),
          media,
        });

        /* Items are their own records, so they are reconciled one by one
           rather than replaced wholesale — replacing would mint new ids and
           break every price and booking pointing at the old ones. */
        for (const item of items) {
          if (item.removed && item.id) {
            await catalogProductService.removeItem(productId, item.id);
            continue;
          }
          const body: ItemInput = {
            attributes: item.attributes,
            description: item.description || undefined,
            media: item.media,
            ...(item.price !== '' ? { price: Number(item.price) } : {}),
            ...(item.stock !== '' ? { stock: Number(item.stock) } : {}),
            ...(item.leadDays !== '' ? { leadDays: Number(item.leadDays) } : {}),
          };
          if (item.id) await catalogProductService.updateItem(productId, item.id, body);
          else await catalogProductService.addItem(productId, { ...body, sku: item.sku || undefined });
        }

        navigate(`/catalog/products/${productId}`);
      } else {
        const created = await catalogProductService.create({
          sku,
          name,
          description,
          brand: brand || undefined,
          typeId: typeId || undefined,
          categoryIds,
          status,
          attributes: mapToAttributes(productAttrs),
          media,
          items: payloadItems,
        });
        navigate(`/catalog/products/${created.id}`);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  /* The server enforces this too; checking here means the user is told before
     a round trip rather than by a 422 after one. */
  const mediaConfig = type?.media;
  const needsImage =
    Boolean(mediaConfig?.images.enabled && mediaConfig.images.required) &&
    !media.some((a) => a.kind === 'image');

  const canSave =
    sku.trim() && name.trim() && effectiveTypeId && liveItems.length > 0 && !needsImage;

  if (loading) return <LoadingState label="Loading product…" />;

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div className="flex items-start gap-3">
          <Button size="icon-sm" variant="ghost" onClick={() => navigate('/catalog/products')} startIcon="arrow_back" />
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
              {isEdit ? 'Edit product' : 'New product'}
            </h1>
            <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              {type ? (
                <>
                  Built from <strong>{type.name}</strong>
                  {axes.length > 0 && ` · ${axes.map((a) => a.label).join(' × ')}`}
                </>
              ) : (
                'Pick a category or type to load its fields'
              )}
            </p>
          </div>
        </div>
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />

      <div className="space-y-5">
        {/* ------------------------------------------------- basics */}
        <section className="bg-surface rounded-2xl border border-outline-variant/40 p-5">
          <h2 className="text-sm font-bold text-on-surface mb-4">Basics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Name" required>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field
              label="SKU"
              required
              hint="The human-readable handle. Ids are UUIDs generated by the server."
            >
              <input
                className={inputClass}
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Brand">
              <input className={inputClass} value={brand} onChange={(e) => setBrand(e.target.value)} />
            </Field>
            <Field label="Status" hint="Lifecycle, not stock — a draft is unpublished, not unavailable.">
              <select
                className={selectClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <Field label="Description" className="sm:col-span-2">
              <textarea
                className={inputClass}
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </Field>
          </div>
        </section>

        {/* -------------------------------------- categories and type */}
        <section className="bg-surface rounded-2xl border border-outline-variant/40 p-5">
          <h2 className="text-sm font-bold text-on-surface mb-1">Placement</h2>
          <p className="text-xs text-on-surface-variant mb-4">
            A product can sit in several categories — a watch belongs in Watches <em>and</em> Gifts.
            The type and the commerce config are inherited from the first one that declares them.
          </p>

          <div className="flex flex-wrap gap-2 mb-3.5">
            {categories.map((c) => {
              const on = categoryIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setCategoryIds((current) =>
                      on ? current.filter((x) => x !== c.id) : [...current, c.id]
                    )
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    on
                      ? 'bg-primary-container text-on-primary-container border-primary/30'
                      : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/50 hover:bg-surface-container'
                  }`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>

          <Field
            label="Product type"
            hint={
              typeId
                ? 'Set explicitly — overrides whatever the category says.'
                : effectiveTypeId
                  ? `Inherited from the category: ${types.find((t) => t.id === effectiveTypeId)?.name ?? ''}`
                  : 'Pick a category that declares a type, or choose one here.'
            }
          >
            <select
              className={selectClass}
              value={typeId}
              disabled={isEdit}
              onChange={(e) => setTypeId(e.target.value)}
            >
              <option value="">— inherit from category —</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          {isEdit && (
            <p className="text-[11px] text-on-surface-variant mt-1.5">
              The type cannot change after creation — every stored attribute is validated against it.
            </p>
          )}
        </section>

        {/* ------------------------------------- product attributes */}
        {type && (
          <section className="bg-surface rounded-2xl border border-outline-variant/40 p-5">
            <h2 className="text-sm font-bold text-on-surface mb-1">Details</h2>
            <p className="text-xs text-on-surface-variant mb-4">
              Fields that describe the product as a whole. Variant-forming fields are set per item below.
            </p>
            <AttributeFields
              fields={fields}
              values={productAttrs}
              scope="product"
              vocabulary={vocabulary}
              onChange={(key, value) => setProductAttrs((c) => ({ ...c, [key]: value }))}
            />
          </section>
        )}

        {/* ------------------------------------------ product media */}
        {type && (mediaConfig?.images.enabled || mediaConfig?.videos.enabled) && (
          <section className="bg-surface rounded-2xl border border-outline-variant/40 p-5">
            <h2 className="text-sm font-bold text-on-surface mb-1">
              Pictures{mediaConfig?.videos.enabled ? ' and videos' : ''}
            </h2>
            <p className="text-xs text-on-surface-variant mb-4">
              These show on the product page, in the order below. The one marked as the thumbnail is
              the cover used in listings.
              {axes.length > 0 && ' A variant can override them with its own further down.'}
            </p>
            <MediaManager config={mediaConfig} value={media} onChange={setMedia} />
            {needsImage && (
              <p className="text-xs text-error mt-3">
                {type.name} requires at least one image before this can be saved.
              </p>
            )}
          </section>
        )}

        {/* ----------------------------------------------- variants */}
        {type && axes.length > 0 && (
          <section className="bg-surface rounded-2xl border border-outline-variant/40 p-5">
            <h2 className="text-sm font-bold text-on-surface mb-1">Generate variants</h2>
            <p className="text-xs text-on-surface-variant mb-4">
              Pick the values you actually carry. The grid is a starting point — delete the rows you
              do not stock before saving.
            </p>

            <div className="space-y-3.5">
              {axes.map((axis) => (
                <div key={axis.key}>
                  <span className="text-xs font-semibold text-on-surface-variant block mb-1.5">
                    {axis.label}
                  </span>
                  {(axis.options ?? []).length > 0 ? (
                    /* FIXED list — pick from the declared options. */
                    <div className="flex flex-wrap gap-1.5">
                      {(axis.options ?? []).map((option) => {
                        const on = (selection[axis.key] ?? []).includes(option);
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              setSelection((current) => {
                                const chosen = current[axis.key] ?? [];
                                const next = chosen.includes(option)
                                  ? chosen.filter((v) => v !== option)
                                  : [...chosen, option];
                                const out = { ...current };
                                if (next.length) out[axis.key] = next;
                                else delete out[axis.key];
                                return out;
                              })
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              on
                                ? 'bg-primary text-on-primary border-primary'
                                : 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/50 hover:bg-surface-container'
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    /* OPEN list — this product decides its own values. */
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          className={inputClass}
                          /* The same spellings the server will snap to, shown
                             while there is still a chance to pick one. */
                          list={vocabulary[axis.key]?.length ? `axis-${axis.key}` : undefined}
                          value={openDraft[axis.key] ?? ''}
                          onChange={(e) =>
                            setOpenDraft((d) => ({ ...d, [axis.key]: e.target.value }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              /* the form would otherwise submit */
                              e.preventDefault();
                              addOpenValue(axis.key);
                            }
                          }}
                          placeholder={`Type a ${axis.label.toLowerCase()} and press Enter`}
                        />
                        <Button
                          variant="outline"
                          onClick={() => addOpenValue(axis.key)}
                          disabled={!(openDraft[axis.key] ?? '').trim()}
                        >
                          Add
                        </Button>
                      </div>

                      {vocabulary[axis.key]?.length ? (
                        <datalist id={`axis-${axis.key}`}>
                          {vocabulary[axis.key].map((v) => (
                            <option key={v} value={v} />
                          ))}
                        </datalist>
                      ) : null}

                      {(selection[axis.key] ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {(selection[axis.key] ?? []).map((value) => (
                            <span
                              key={value}
                              className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg text-xs font-medium bg-primary text-on-primary"
                            >
                              {value}
                              <button
                                type="button"
                                onClick={() => removeOpenValue(axis.key, value)}
                                className="w-4 h-4 rounded flex items-center justify-center hover:bg-on-primary/20"
                                aria-label={`Remove ${value}`}
                              >
                                <Icon name="close" size="xs" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      <p className="text-[11px] text-on-surface-variant">
                        This axis has no fixed list — the values you type apply to this product
                        only. Spellings already used elsewhere are reused automatically.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-outline-variant/40">
              <Button
                variant="outline"
                startIcon="grid_view"
                onClick={generate}
                disabled={!Object.keys(selection).length}
              >
                Generate combinations
              </Button>
              {Object.keys(selection).length > 0 && (
                <span className="text-xs text-on-surface-variant">
                  {Object.values(selection).reduce((n, v) => n * v.length, 1)} combination
                  {Object.values(selection).reduce((n, v) => n * v.length, 1) === 1 ? '' : 's'}
                </span>
              )}
            </div>
          </section>
        )}

        {/* -------------------------------------------------- items */}
        <section className="bg-surface rounded-2xl border border-outline-variant/40 overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant/40 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-on-surface">
                Items {liveItems.length > 0 && `(${liveItems.length})`}
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                The things actually sold. Price and stock hang off these, not off the product.
              </p>
            </div>
            {!axes.length && !liveItems.length && (
              <Button size="sm" variant="outline" startIcon="add" onClick={addSingleItem}>
                Add the item
              </Button>
            )}
          </div>

          {!liveItems.length ? (
            <EmptyState
              icon="category"
              title="No items yet"
              description={
                axes.length
                  ? 'Choose values above and generate the combinations you carry.'
                  : 'This type has no variant axes, so the product has a single item.'
              }
            />
          ) : (
            <div className="divide-y divide-outline-variant/40">
              {liveItems.map((item) => (
                <div key={item.key} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-on-surface">
                          {item.valueLabel || 'Single item'}
                        </span>
                        {item.optionLabel && (
                          <span className="text-[11px] text-on-surface-variant">{item.optionLabel}</span>
                        )}
                        {item.id && (
                          <Badge variant="outline" size="sm">
                            saved
                          </Badge>
                        )}
                      </div>
                      <code className="text-[11px] text-on-surface-variant">{item.sku}</code>
                    </div>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Remove this item"
                      onClick={() => dropItem(item.key)}

                      startIcon="close"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {showPrice && (
                      <Field label="Price" hint="Leave blank if not priced yet">
                        <input
                          className={inputClass}
                          type="number"
                          min={0}
                          value={item.price}
                          onChange={(e) => patchItem(item.key, { price: e.target.value })}
                          placeholder="—"
                        />
                      </Field>
                    )}

                    {showStock && (
                      <Field label="Stock" hint="Blank means not tracked, not zero">
                        <input
                          className={inputClass}
                          type="number"
                          min={0}
                          value={item.stock}
                          onChange={(e) => patchItem(item.key, { stock: e.target.value })}
                          placeholder="—"
                        />
                      </Field>
                    )}

                    {showLead && (
                      <Field label="Lead days">
                        <input
                          className={inputClass}
                          type="number"
                          min={0}
                          value={item.leadDays}
                          onChange={(e) => patchItem(item.key, { leadDays: e.target.value })}
                          placeholder="—"
                        />
                      </Field>
                    )}

                    <Field
                      label="Description"
                      className={showPrice && showStock ? 'sm:col-span-2' : 'sm:col-span-2 lg:col-span-3'}
                    >
                      <input
                        className={inputClass}
                        value={item.description}
                        onChange={(e) => patchItem(item.key, { description: e.target.value })}
                        placeholder="What makes this combination different"
                        maxLength={1000}
                      />
                    </Field>
                  </div>

                  {/* Optional per variant. A shop that photographs every colour
                      uses it; one that does not leaves it empty and the
                      variant shows the product's own pictures. */}
                  {mediaConfig?.images.enabled && axes.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-outline-variant/30">
                      <MediaManager
                        config={mediaConfig}
                        variant
                        label={`Pictures for ${item.valueLabel || 'this item'} (optional)`}
                        value={item.media}
                        onChange={(next) => patchItem(item.key, { media: next })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {pricingModel === 'on_request' && liveItems.length > 0 && (
            <div className="px-5 py-3 bg-surface-container-low border-t border-outline-variant/40 flex items-start gap-2">
              <Icon name="info" size="xs" color="outline" className="mt-0.5" />
              <p className="text-[11px] text-on-surface-variant">
                This category quotes on request, so no price is asked for. Required charges still
                apply and are shown to customers alongside the quote.
              </p>
            </div>
          )}
        </section>

        {/* What the chosen category actually does.
            Sits below the items on purpose: this is the section that explains
            why the item rows above ask for a price, a stock count, or neither. */}
        <section className="bg-surface rounded-2xl border border-outline-variant/40 overflow-hidden">
          <button
            type="button"
            onClick={() => setExplainOpen((v) => !v)}
            aria-expanded={explainOpen}
            className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-surface-container-low transition-colors"
          >
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-on-surface">What this category does</h2>

              {explainOpen ? (
                <p className="text-xs text-on-surface-variant mt-0.5">
                  All inherited from the categories ticked above — none of it is set on the
                  product itself.
                </p>
              ) : (
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  {categoryIds.length ? (
                    <>
                      <Badge variant="neutral" size="sm" icon="sell">
                        {(pricingModel ?? 'fixed').replace(/_/g, ' ')}
                      </Badge>
                      <Badge variant="neutral" size="sm" icon="inventory">
                        {(availabilityModel ?? 'quantity').replace(/_/g, ' ')}
                      </Badge>
                      {inheritedCharges.length > 0 && (
                        <Badge variant="primary" size="sm" icon="receipt_long">
                          {inheritedCharges.length} charge
                          {inheritedCharges.length === 1 ? '' : 's'}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-on-surface-variant">
                      Tick a category above to see what it does
                    </span>
                  )}
                </div>
              )}
            </div>

            <Icon
              name="expand_more"
              size="sm"
              color="outline"
              className={`shrink-0 transition-transform duration-200 ${
                explainOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {!explainOpen ? null : !categoryIds.length ? (
            <div className="px-5 py-6 flex items-start gap-2.5 border-t border-outline-variant/40">
              <Icon name="touch_app" size="sm" color="outline" className="mt-0.5 shrink-0" />
              <p className="text-sm text-on-surface-variant">
                Tick a category above and this will show which fields you get, whether a price and
                stock are asked for, and which charges the product picks up.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/40 border-t border-outline-variant/40">
              {/* ------------------------------------------------- fields */}
              <div className="px-5 py-4 flex items-start gap-3">
                <Icon name="category" size="sm" color="primary" className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface">
                    Fields come from{' '}
                    {type ? <span className="text-primary">{type.name}</span> : 'no type yet'}
                  </p>
                  {type ? (
                    <p className="text-xs text-on-surface-variant mt-1">
                      {axes.length > 0 ? (
                        <>
                          <strong>{axes.map((a) => a.label).join(' × ')}</strong> make the
                          variants above
                          {productLevelLabels.length > 0 && (
                            <> · {productLevelLabels.join(', ')} describe the whole product</>
                          )}
                        </>
                      ) : (
                        'This type has no variant axes, so the product has a single item.'
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-on-surface-variant mt-1">
                      This category declares no type. Pick one under Placement, or choose a
                      category that has one.
                    </p>
                  )}
                </div>
              </div>

              {/* ------------------------------------------------ pricing */}
              <div className="px-5 py-4 flex items-start gap-3">
                <Icon name="sell" size="sm" color="primary" className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface">
                    {showPrice ? 'Each item is priced' : 'No price is asked'}
                    <Badge variant="neutral" size="sm" className="ml-2">
                      {(pricingModel ?? 'fixed').replace(/_/g, ' ')}
                    </Badge>
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {showPrice ? (
                      <>
                        A <strong>Price</strong> box appears on every item row above
                        {commerce?.pricing.unit ? ` — charged per ${commerce.pricing.unit}` : ''}
                        . Leave it blank and the item reads as <em>Not priced</em>, never as zero.
                      </>
                    ) : pricingModel === 'free' ? (
                      'Everything here is free of charge.'
                    ) : (
                      <>
                        Customers see{' '}
                        <strong>{commerce?.pricing.label || 'Price on request'}</strong> instead of
                        a number. Any charges below still apply and are shown separately.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* ------------------------------------------- availability */}
              <div className="px-5 py-4 flex items-start gap-3">
                <Icon name="inventory" size="sm" color="primary" className="mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface">
                    {showStock
                      ? 'Stock is counted per item'
                      : showLead
                        ? 'A lead time is asked for'
                        : 'Availability is not counted'}
                    <Badge variant="neutral" size="sm" className="ml-2">
                      {(availabilityModel ?? 'quantity').replace(/_/g, ' ')}
                    </Badge>
                  </p>
                  <p className="text-xs text-on-surface-variant mt-1">
                    {showStock ? (
                      <>
                        A <strong>Stock</strong> box appears on every item row. Blank means{' '}
                        <em>not tracked</em> — it does not mean none in stock.
                      </>
                    ) : showLead ? (
                      <>
                        A <strong>Lead days</strong> box appears instead of a stock count — how
                        long the customer waits.
                      </>
                    ) : availabilityModel === 'time_slot' ? (
                      'Customers book a slot. Set the opening hours on the item after saving.'
                    ) : availabilityModel === 'capacity_per_date' ? (
                      'Availability is a count per date. Add the dates on the item after saving.'
                    ) : (
                      'Nothing is counted — the product is simply listed as available.'
                    )}
                  </p>
                </div>
              </div>

              {/* ------------------------------------------------ charges */}
              <div className="px-5 py-4 flex items-start gap-3">
                <Icon name="receipt_long" size="sm" color="primary" className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-on-surface mb-1">
                    {inheritedCharges.length
                      ? `${inheritedCharges.length} charge${
                          inheritedCharges.length === 1 ? '' : 's'
                        } will apply`
                      : 'No charges apply'}
                  </p>

                  {inheritedCharges.length ? (
                    <div className="space-y-1.5 mt-2">
                      {inheritedCharges.map(({ charge, from }) => (
                        <div
                          key={charge.id}
                          className="flex items-center gap-2 flex-wrap text-xs px-3 py-2 rounded-lg bg-surface-container"
                        >
                          <span className="font-semibold text-on-surface">
                            {charge.label || charge.name}
                          </span>
                          <span className="text-on-surface">
                            {charge.basis === 'percent'
                              ? `${charge.percent}%`
                              : `${charge.currency ?? 'INR'} ${charge.amount}`}
                          </span>
                          <Badge variant={charge.required ? 'primary' : 'outline'} size="sm">
                            {charge.required ? 'always applied' : 'optional'}
                          </Badge>
                          <span className="text-on-surface-variant ml-auto">from {from}</span>
                        </div>
                      ))}
                      <p className="text-[11px] text-on-surface-variant pt-1">
                        Optional ones are offered to the customer and are never included in a total
                        until they choose them.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-on-surface-variant">
                      Nothing is attached to these categories. Add fees or taxes under{' '}
                      <strong>Catalogue → Charges</strong> and they apply here automatically.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Save bar.
          Sticky inside the content column rather than fixed to the viewport:
          the sidebar is `fixed left-0`, so a viewport-fixed bar runs underneath
          it and the page has no access to the sidebar's open/closed width. The
          negative margin lets it bleed to the edges of the main padding. */}
      <div className="sticky bottom-0 z-30 -mx-space-lg mt-space-lg px-space-lg py-3 bg-surface/95 backdrop-blur-sm border-t border-outline-variant/40">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-on-surface-variant">
            {!effectiveTypeId
              ? 'Pick a category or a type to continue'
              : !liveItems.length
                ? 'At least one item is required — it is where price and stock live'
                : `${liveItems.length} item${liveItems.length === 1 ? '' : 's'} ready to save`}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/catalog/products')}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={saving} disabled={!canSave}>
              {isEdit ? 'Save changes' : 'Create product'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
