import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Icon } from '../../components/common';
import {
  ConfirmDialog,
  Modal,
  EmptyState,
  ErrorBanner,
  Field,
  formatMoney,
  inputClass,
  LoadingState,
  selectClass,
  SuccessBanner,
} from '../../components/catalog/primitives';
import {
  catalogCategoryService,
  catalogProductService,
  chargeService,
} from '../../services/catalog.service';
import { CatalogCategory, CatalogCharge, CatalogProduct, ChargeBasis } from '../../types/catalog.types';

/**
 * Additional charges — the money that is not the price.
 *
 * Deliberately separate from pricing: a dealership vehicle is quoted on request
 * and still carries a known registration fee, which is impossible to express if
 * charges live inside a price.
 */

interface Draft {
  name: string;
  label: string;
  level: 'category' | 'product' | 'item';
  refId: string;
  basis: ChargeBasis;
  amount: string;
  percent: string;
  percentOf: 'base' | 'base_plus_charges';
  required: boolean;
  maxQuantity: string;
  currency: string;
  showInListing: boolean;
}

const BLANK: Draft = {
  name: '',
  label: '',
  level: 'category',
  refId: '',
  basis: 'fixed',
  amount: '',
  percent: '',
  percentOf: 'base',
  required: true,
  maxQuantity: '1',
  currency: 'INR',
  showInListing: false,
};

const BASES: { value: ChargeBasis; label: string; hint: string }[] = [
  { value: 'fixed', label: 'Fixed amount', hint: 'A flat figure' },
  { value: 'percent', label: 'Percentage', hint: 'Of the price, or of the price plus other charges' },
  { value: 'per_unit', label: 'Per unit', hint: 'Multiplied by quantity' },
  { value: 'per_time', label: 'Per time', hint: 'Multiplied by nights or hours' },
];

export default function CatalogChargesPage(): JSX.Element {
  const [charges, setCharges] = useState<CatalogCharge[]>([]);
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<CatalogCharge | null>(null);
  const [draft, setDraft] = useState<Draft>(BLANK);
  const [confirmDelete, setConfirmDelete] = useState<CatalogCharge | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ch, cat, prod] = await Promise.all([
        chargeService.list(undefined, undefined, showDeleted),
        catalogCategoryService.list(),
        catalogProductService.search({ limit: 100 }),
      ]);
      setCharges(ch);
      setCategories(cat);
      setProducts(prod.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [showDeleted]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameFor = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    products.forEach((p) => map.set(p.id, p.name));
    return map;
  }, [categories, products]);

  const openNew = () => {
    setEditing(null);
    setDraft(BLANK);
    setModal(true);
  };

  const openEdit = (charge: CatalogCharge) => {
    setEditing(charge);
    setDraft({
      name: charge.name,
      label: charge.label ?? '',
      level: charge.scope.level,
      refId: charge.scope.refId,
      basis: charge.basis,
      amount: charge.amount !== undefined ? String(charge.amount) : '',
      percent: charge.percent !== undefined ? String(charge.percent) : '',
      percentOf: charge.percentOf ?? 'base',
      required: charge.required,
      maxQuantity: String(charge.maxQuantity ?? 1),
      currency: charge.currency ?? 'INR',
      showInListing: Boolean(charge.showInListing),
    });
    setModal(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const isPercent = draft.basis === 'percent';
      const body: Partial<CatalogCharge> = {
        name: draft.name,
        label: draft.label || undefined,
        basis: draft.basis,
        required: draft.required,
        maxQuantity: Number(draft.maxQuantity) || 1,
        currency: draft.currency,
        showInListing: draft.showInListing,
        ...(isPercent
          ? { percent: Number(draft.percent), percentOf: draft.percentOf }
          : { amount: Number(draft.amount) }),
      };

      if (editing) {
        await chargeService.update(editing.id, body);
      } else {
        await chargeService.create({
          ...body,
          scope: { level: draft.level, refId: draft.refId },
        });
      }
      setModal(false);
      setNotice(editing ? 'Charge updated.' : `"${draft.name}" created.`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await chargeService.remove(confirmDelete.id);
      setNotice(
        `"${confirmDelete.name}" deleted. It stops being collected from now on — totals already quoted are unchanged.`
      );
      setConfirmDelete(null);
      await load();
    } catch (e: any) {
      setError(e.message);
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (charge: CatalogCharge) => {
    setBusy(true);
    try {
      await chargeService.restore(charge.id);
      setNotice(`"${charge.name}" restored — it applies again from now on.`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const grouped = useMemo(() => {
    const byLevel: Record<string, CatalogCharge[]> = { category: [], product: [], item: [] };
    charges.forEach((c) => byLevel[c.scope.level]?.push(c));
    return byLevel;
  }, [charges]);

  const refOptions = draft.level === 'category' ? categories : draft.level === 'product' ? products : [];

  if (loading) return <LoadingState label="Loading charges…" />;

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">Charges</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 max-w-3xl">
            Fees, taxes and optional add-ons. A charge at a nearer scope <strong>overrides</strong> a
            broader one with the same name — which is how one category waives a platform-wide fee.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="accent-primary"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
            />
            <span className="text-xs text-on-surface-variant">Show deleted</span>
          </label>
          <Button variant="primary" startIcon="add" onClick={openNew}>
            New charge
          </Button>
        </div>
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <SuccessBanner message={notice} onDismiss={() => setNotice(null)} />

      {!charges.length ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/40">
          <EmptyState
            icon="receipt_long"
            title="No charges configured"
            description="Most businesses set two or three at category level once — GST, a service charge, a registration fee — and never touch them again."
            action={
              <Button variant="primary" startIcon="add" onClick={openNew}>
                Add the first charge
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-5">
          {(['category', 'product', 'item'] as const).map((level) =>
            grouped[level].length ? (
              <section key={level} className="bg-surface rounded-2xl border border-outline-variant/40 overflow-hidden">
                <div className="px-5 py-3 border-b border-outline-variant/40 bg-surface-container-low">
                  <h2 className="text-xs font-bold text-on-surface uppercase tracking-wide">
                    {level} level
                    <span className="ml-2 font-normal normal-case text-on-surface-variant">
                      {level === 'category'
                        ? '— applies to everything beneath it'
                        : level === 'product'
                          ? '— applies to every item of that product'
                          : '— applies to one item only'}
                    </span>
                  </h2>
                </div>

                <div className="divide-y divide-outline-variant/40">
                  {grouped[level].map((c) => (
                    <div
                      key={c.id}
                      className={`px-5 py-3.5 flex items-center gap-4 group ${
                        c.is_deleted ? 'opacity-70 bg-surface-container-low/60' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm font-semibold ${
                              c.is_deleted ? 'text-on-surface-variant line-through' : 'text-on-surface'
                            }`}
                          >
                            {c.label || c.name}
                          </span>
                          {c.is_deleted && (
                            <Badge variant="error" size="sm">
                              deleted
                            </Badge>
                          )}
                          <Badge variant={c.required ? 'primary' : 'outline'} size="sm">
                            {c.required ? 'required' : 'optional'}
                          </Badge>
                          {c.showInListing && (
                            <Badge variant="tertiary" size="sm" icon="visibility">
                              in listing
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-on-surface-variant mt-0.5">
                          on <strong>{nameFor.get(c.scope.refId) ?? c.scope.refId}</strong>
                          {c.basis === 'percent' && c.percentOf === 'base_plus_charges' && (
                            <> · applied after other charges</>
                          )}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-on-surface">
                          {c.basis === 'percent'
                            ? `${c.percent}%`
                            : formatMoney(c.amount, c.currency ?? 'INR')}
                        </span>
                        <p className="text-[11px] text-on-surface-variant">
                          {c.basis.replace(/_/g, ' ')}
                        </p>
                      </div>

                      {c.is_deleted ? (
                        <Button size="sm" variant="ghost" startIcon="restore" onClick={() => restore(c)} disabled={busy}>
                          Restore
                        </Button>
                      ) : (
                        <div className="flex items-center gap-1 shrink-0 transition-opacity">
                          <Button size="icon-sm" variant="ghost" onClick={() => openEdit(c)} title="Edit" startIcon="edit" />
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setConfirmDelete(c)}
                            title="Delete"
                            startIcon="delete"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            ) : null
          )}
        </div>
      )}

      <Modal
        open={modal}
        title={editing ? `Edit ${editing.name}` : 'New charge'}
        subtitle={editing ? 'Scope cannot change — create a new charge instead' : undefined}
        width="max-w-2xl"
        onClose={() => setModal(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={save}
              loading={busy}
              disabled={
                !draft.name.trim() ||
                (!editing && !draft.refId) ||
                (draft.basis === 'percent' ? !draft.percent : !draft.amount)
              }
            >
              {editing ? 'Save changes' : 'Create charge'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field
            label="Name"
            required
            hint="The override key — a nearer scope with the same name replaces this one."
          >
            <input
              className={inputClass}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Registration"
              autoFocus
            />
          </Field>

          <Field label="Label" hint="What the customer sees, if different from the name">
            <input
              className={inputClass}
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="RTO registration"
            />
          </Field>

          {!editing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Applies to" required>
                <select
                  className={selectClass}
                  value={draft.level}
                  onChange={(e) => setDraft({ ...draft, level: e.target.value as any, refId: '' })}
                >
                  <option value="category">A category</option>
                  <option value="product">A product</option>
                  <option value="item">A single item</option>
                </select>
              </Field>

              <Field label={draft.level === 'item' ? 'Item id' : 'Which one'} required>
                {draft.level === 'item' ? (
                  <input
                    className={inputClass}
                    value={draft.refId}
                    onChange={(e) => setDraft({ ...draft, refId: e.target.value })}
                    placeholder="Item UUID"
                  />
                ) : (
                  <select
                    className={selectClass}
                    value={draft.refId}
                    onChange={(e) => setDraft({ ...draft, refId: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {refOptions.map((o: any) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          )}

          <Field label="Basis" hint={BASES.find((b) => b.value === draft.basis)?.hint}>
            <select
              className={selectClass}
              value={draft.basis}
              onChange={(e) => setDraft({ ...draft, basis: e.target.value as ChargeBasis })}
            >
              {BASES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </Field>

          {draft.basis === 'percent' ? (
            <div className="space-y-3.5">
              <Field label="Percent" required>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={draft.percent}
                  onChange={(e) => setDraft({ ...draft, percent: e.target.value })}
                  placeholder="18"
                />
              </Field>

              <Field
                label="Applied to"
                hint="Choose the second option for a tax that also applies to a service charge."
              >
                <select
                  className={selectClass}
                  value={draft.percentOf}
                  onChange={(e) => setDraft({ ...draft, percentOf: e.target.value as any })}
                >
                  <option value="base">The base price only</option>
                  <option value="base_plus_charges">The base price plus other required charges</option>
                </select>
              </Field>

              <p className="text-xs text-on-surface-variant flex items-start gap-1.5 px-3 py-2 rounded-lg bg-surface-container">
                <Icon name="info" size="xs" className="mt-0.5 shrink-0" />
                On an unpriced product this reports "calculated once the price is confirmed" rather
                than showing zero.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Amount" required>
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  placeholder="15000"
                />
              </Field>
              <Field label="Currency">
                <input
                  className={inputClass}
                  value={draft.currency}
                  onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
                  maxLength={3}
                />
              </Field>
            </div>
          )}

          <div className="space-y-2.5 pt-1 border-t border-outline-variant/40">
            <label className="flex items-start gap-2.5 cursor-pointer pt-3">
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                checked={draft.required}
                onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
              />
              <span className="flex-1">
                <span className="text-sm font-medium text-on-surface block">Required</span>
                <span className="text-xs text-on-surface-variant">
                  Always applied and included in the total. Turn off for an add-on the customer picks.
                </span>
              </span>
            </label>

            {!draft.required && (
              <Field label="Maximum quantity" hint="e.g. up to 3 extra beds">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={draft.maxQuantity}
                  onChange={(e) => setDraft({ ...draft, maxQuantity: e.target.value })}
                />
              </Field>
            )}

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                checked={draft.showInListing}
                onChange={(e) => setDraft({ ...draft, showInListing: e.target.checked })}
              />
              <span className="flex-1">
                <span className="text-sm font-medium text-on-surface block">Show in listings</span>
                <span className="text-xs text-on-surface-variant">
                  Adds "+ charges" to the card, rather than only appearing on the detail page.
                </span>
              </span>
            </label>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Delete "${confirmDelete?.name}"?`}
        danger
        busy={busy}
        confirmLabel="Delete charge"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={remove}
        body={
          <p>
            A soft delete. The charge stops being collected on the next resolve, but{' '}
            <strong>no total is rewritten retrospectively</strong> — an order already quoted at the
            old figure keeps it.
          </p>
        }
      />
    </div>
  );
}
