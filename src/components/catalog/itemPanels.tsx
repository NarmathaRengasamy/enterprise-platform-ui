import React, { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Icon } from '../common';
import {
  ConfirmDialog,
  ErrorBanner,
  Field,
  formatMoney,
  inputClass,
  LoadingState,
  Modal,
  selectClass,
} from './primitives';
import { AttributeFields, attributesToMap, mapToAttributes, OpeningHoursEditor } from './forms';
import { availabilityService, catalogProductService, priceService } from '../../services/catalog.service';
import {
  AVAILABILITY_MODELS,
  AvailabilityModel,
  CatalogAvailabilityRow,
  CatalogItem,
  CatalogPrice,
  CommerceConfig,
  FieldDefinition,
} from '../../types/catalog.types';

/**
 * Editors for the records that hang off a single item.
 *
 * An item's price and availability are their own records, not fields on it —
 * which is what makes price lists, quantity bands, seasonal rates and
 * multi-location stock possible. That only helps if you can actually reach
 * them, so each gets a manager of its own rather than being editable solely
 * through the convenience field on the product form.
 */

/* ============================================================ item editor */

export const ItemEditorModal: React.FC<{
  open: boolean;
  productId: string;
  item: CatalogItem | null;
  fields: FieldDefinition[];
  /** Values already used for the open choice fields, offered as suggestions. */
  vocabulary?: Record<string, string[]>;
  onClose: () => void;
  onSaved: (message: string) => void;
}> = ({ open, productId, item, fields, vocabulary, onClose, onSaved }) => {
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [status, setStatus] = useState<'draft' | 'active' | 'archived'>('active');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setAttrs(attributesToMap(item.attributes));
    setDescription(item.description ?? '');
    setSku(item.sku);
    setStatus(item.status);
    setError(null);
  }, [item]);

  const save = async () => {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      await catalogProductService.updateItem(productId, item.id, {
        attributes: mapToAttributes(attrs),
        description: description || undefined,
        sku,
        status,
      });
      onSaved('Item updated.');
      onClose();
    } catch (e: any) {
      /* Changing attributes onto a combination that already exists is a 409 —
         shown as-is, because it names the clashing values. */
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Edit item"
      subtitle={item?.sku}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={busy}>
            Save changes
          </Button>
        </div>
      }
    >
      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <div className="space-y-4">
        <AttributeFields
          fields={fields}
          values={attrs}
          scope="item"
          vocabulary={vocabulary}
          onChange={(key, value) => setAttrs((c) => ({ ...c, [key]: value }))}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Field label="SKU">
            <input className={inputClass} value={sku} onChange={(e) => setSku(e.target.value.toUpperCase())} />
          </Field>
          <Field label="Status" hint="Lifecycle, not stock">
            <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
        </div>

        <Field label="Description">
          <textarea
            className={inputClass}
            rows={2}
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
};

/* ========================================================== price manager */

interface PriceDraft {
  amount: string;
  currency: string;
  priceListId: string;
  minQuantity: string;
  validFrom: string;
  validTo: string;
}

const BLANK_PRICE: PriceDraft = {
  amount: '',
  currency: 'INR',
  priceListId: 'default',
  minQuantity: '1',
  validFrom: '',
  validTo: '',
};

/** `2026-10-14` from the API's ISO instant, for a date input. */
const toDateInput = (value?: string | null): string =>
  value ? new Date(value).toISOString().slice(0, 10) : '';

const toIso = (value: string): string | null =>
  value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null;

export const PriceManagerModal: React.FC<{
  open: boolean;
  item: CatalogItem | null;
  commerce?: CommerceConfig;
  onClose: () => void;
  onChanged: (message: string) => void;
}> = ({ open, item, commerce, onClose, onChanged }) => {
  const [rows, setRows] = useState<CatalogPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CatalogPrice | null>(null);
  const [draft, setDraft] = useState<PriceDraft>(BLANK_PRICE);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<CatalogPrice | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const load = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    try {
      setRows(await priceService.list({ itemId: item.id, includeDeleted: showDeleted || undefined }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [item, showDeleted]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const restore = async (row: CatalogPrice) => {
    setBusy(true);
    try {
      await priceService.restore(row.id);
      onChanged('Price restored.');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const startAdd = () => {
    setEditing(null);
    setDraft({ ...BLANK_PRICE, currency: commerce?.pricing.currency ?? 'INR' });
    setAdding(true);
  };

  const startEdit = (row: CatalogPrice) => {
    setEditing(row);
    setDraft({
      amount: String(row.amount),
      currency: row.currency,
      priceListId: row.priceListId,
      minQuantity: String(row.minQuantity ?? 1),
      validFrom: toDateInput(row.validFrom as string),
      validTo: toDateInput(row.validTo as string),
    });
    setAdding(true);
  };

  const save = async () => {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const body = {
        amount: Number(draft.amount),
        currency: draft.currency,
        minQuantity: Number(draft.minQuantity) || 1,
        validFrom: toIso(draft.validFrom),
        validTo: toIso(draft.validTo),
      };
      if (editing) {
        await priceService.update(editing.id, body);
      } else {
        /* priceListId is fixed at creation: moving a price between books would
           silently change who it applies to. */
        await priceService.create({ ...body, itemId: item.id, priceListId: draft.priceListId });
      }
      setAdding(false);
      onChanged(editing ? 'Price updated.' : 'Price added.');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await priceService.remove(confirm.id);
      setConfirm(null);
      onChanged('Price deleted.');
      await load();
    } catch (e: any) {
      setError(e.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Modal
        open={open && !adding}
        title="Prices"
        subtitle={item?.sku}
        width="max-w-2xl"
        onClose={onClose}
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" startIcon="add" onClick={startAdd}>
              Add a price
            </Button>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                />
                <span className="text-xs text-on-surface-variant">Show deleted</span>
              </label>
              <Button variant="ghost" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        }
      >
        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        <p className="text-xs text-on-surface-variant mb-3">
          An item can hold several prices. The one that applies is chosen by price list, then by
          the highest quantity band you qualify for, then by date — so a B2B rate never loses to a
          retail one.
        </p>

        {loading ? (
          <LoadingState label="Loading prices…" />
        ) : !rows.length ? (
          <div className="text-center py-8">
            <Icon name="sell" size="xl" color="outline" />
            <p className="text-sm text-on-surface-variant mt-2">
              No prices yet — this item reads as <strong>Not priced</strong>.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-outline-variant/50 divide-y divide-outline-variant/40 overflow-hidden">
            {rows.map((row) => (
              <div
                key={row.id}
                className={`px-3.5 py-3 flex items-center gap-3 group bg-surface-container-lowest ${
                  row.is_deleted ? 'opacity-70' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-bold ${
                        row.is_deleted ? 'text-on-surface-variant line-through' : 'text-on-surface'
                      }`}
                    >
                      {formatMoney(row.amount, row.currency)}
                    </span>
                    {row.is_deleted && (
                      <Badge variant="error" size="sm">
                        deleted
                      </Badge>
                    )}
                    <Badge variant={row.priceListId === 'default' ? 'outline' : 'primary'} size="sm">
                      {row.priceListId}
                    </Badge>
                    {(row.minQuantity ?? 1) > 1 && (
                      <Badge variant="tertiary" size="sm">
                        {row.minQuantity}+ units
                      </Badge>
                    )}
                  </div>
                  {(row.validFrom || row.validTo) && (
                    <p className="text-[11px] text-on-surface-variant mt-0.5">
                      {row.validFrom ? toDateInput(row.validFrom as string) : 'any time'} →{' '}
                      {row.validTo ? toDateInput(row.validTo as string) : 'open ended'}
                    </p>
                  )}
                </div>
                {row.is_deleted ? (
                  <Button size="xs" variant="outline" startIcon="restore" disabled={busy} onClick={() => restore(row)}>
                    Restore
                  </Button>
                ) : (
                  <div className="flex items-center gap-1 shrink-0 transition-opacity">
                    <Button size="icon-sm" variant="ghost" title="Edit" onClick={() => startEdit(row)} startIcon="edit" />
                    <Button size="icon-sm" variant="ghost" title="Delete" onClick={() => setConfirm(row)} startIcon="delete" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={adding}
        title={editing ? 'Edit price' : 'Add a price'}
        subtitle={item?.sku}
        onClose={() => setAdding(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={busy} disabled={draft.amount === ''}>
              {editing ? 'Save changes' : 'Add price'}
            </Button>
          </div>
        }
      >
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Amount" required>
              <input
                className={inputClass}
                type="number"
                min={0}
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                autoFocus
              />
            </Field>
            <Field label="Currency">
              <input
                className={inputClass}
                maxLength={3}
                value={draft.currency}
                onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field
              label="Price list"
              hint={editing ? 'Fixed once created' : 'default, b2b, staff — your own names'}
            >
              <input
                className={inputClass}
                value={draft.priceListId}
                disabled={Boolean(editing)}
                onChange={(e) => setDraft({ ...draft, priceListId: e.target.value })}
              />
            </Field>
            <Field label="Applies from quantity" hint="1 for a normal price; 11 for an 11+ band">
              <input
                className={inputClass}
                type="number"
                min={1}
                value={draft.minQuantity}
                onChange={(e) => setDraft({ ...draft, minQuantity: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Valid from" hint="Leave blank for no start date">
              <input
                className={inputClass}
                type="date"
                value={draft.validFrom}
                onChange={(e) => setDraft({ ...draft, validFrom: e.target.value })}
              />
            </Field>
            <Field label="Valid to" hint="Leave blank for open ended">
              <input
                className={inputClass}
                type="date"
                value={draft.validTo}
                onChange={(e) => setDraft({ ...draft, validTo: e.target.value })}
              />
            </Field>
          </div>

          <p className="text-[11px] text-on-surface-variant px-3 py-2 rounded-lg bg-surface-container">
            A seasonal rate is just a second price with a date window. The windowed one wins while
            it is live, and the plain one takes over again afterwards.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete this price?"
        danger
        busy={busy}
        confirmLabel="Delete price"
        onCancel={() => setConfirm(null)}
        onConfirm={remove}
        body={
          <p>
            A soft delete — it can be restored. If this was the item's only price it will read as
            <strong> Not priced</strong> until another is added.
          </p>
        }
      />
    </>
  );
};

/* =================================================== availability manager */

interface AvailDraft {
  strategy: AvailabilityModel;
  locationId: string;
  onHand: string;
  date: string;
  capacity: string;
  slotMinutes: string;
  openingHours: Record<string, string>;
  resourceId: string;
  inchargeId: string;
  leadDays: string;
  note: string;
}

const BLANK_AVAIL: AvailDraft = {
  strategy: 'quantity',
  locationId: 'default',
  onHand: '',
  date: '',
  capacity: '',
  slotMinutes: '60',
  openingHours: {},
  resourceId: '',
  inchargeId: '',
  leadDays: '',
  note: '',
};

const describeRow = (row: CatalogAvailabilityRow): string => {
  switch (row.strategy) {
    case 'quantity':
      return `${row.onHand ?? 0} on hand`;
    case 'capacity_per_date':
      return `${row.capacity ?? 0} on ${row.date}`;
    case 'time_slot':
      return `${row.slotMinutes} min slots`;
    case 'lead_time':
      return `${row.leadDays} day lead time`;
    default:
      return row.strategy.replace(/_/g, ' ');
  }
};

export const AvailabilityManagerModal: React.FC<{
  open: boolean;
  item: CatalogItem | null;
  commerce?: CommerceConfig;
  onClose: () => void;
  onChanged: (message: string) => void;
}> = ({ open, item, commerce, onClose, onChanged }) => {
  const [rows, setRows] = useState<CatalogAvailabilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<CatalogAvailabilityRow | null>(null);
  const [draft, setDraft] = useState<AvailDraft>(BLANK_AVAIL);
  const [confirm, setConfirm] = useState<CatalogAvailabilityRow | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const load = useCallback(async () => {
    if (!item) return;
    setLoading(true);
    try {
      setRows(
        await availabilityService.list({ itemId: item.id, includeDeleted: showDeleted || undefined })
      );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [item, showDeleted]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const restore = async (row: CatalogAvailabilityRow) => {
    setBusy(true);
    try {
      await availabilityService.restore(row.id);
      onChanged('Availability row restored.');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const startAdd = () => {
    setEditing(null);
    /* Default to whatever the category declares — that is the strategy the
       resolver will actually use, so any other choice would be inert. */
    setDraft({ ...BLANK_AVAIL, strategy: commerce?.availability.model ?? 'quantity' });
    setAdding(true);
  };

  const startEdit = (row: CatalogAvailabilityRow) => {
    setEditing(row);
    setDraft({
      strategy: row.strategy,
      locationId: row.locationId ?? 'default',
      onHand: row.onHand !== undefined ? String(row.onHand) : '',
      date: row.date ?? '',
      capacity: row.capacity !== undefined ? String(row.capacity) : '',
      slotMinutes: row.slotMinutes !== undefined ? String(row.slotMinutes) : '60',
      openingHours: row.openingHours ?? {},
      resourceId: row.resourceId ?? '',
      inchargeId: row.inchargeId ?? '',
      leadDays: row.leadDays !== undefined ? String(row.leadDays) : '',
      note: row.note ?? '',
    });
    setAdding(true);
  };

  const save = async () => {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        itemId: item.id,
        locationId: draft.locationId || 'default',
        strategy: draft.strategy,
      };
      if (draft.strategy === 'quantity') body.onHand = Number(draft.onHand);
      if (draft.strategy === 'capacity_per_date') {
        body.date = draft.date;
        body.capacity = Number(draft.capacity);
      }
      if (draft.strategy === 'time_slot') {
        body.slotMinutes = Number(draft.slotMinutes);
        body.openingHours = draft.openingHours;
        if (draft.resourceId) body.resourceId = draft.resourceId;
        if (draft.inchargeId) body.inchargeId = draft.inchargeId;
      }
      if (draft.strategy === 'lead_time') body.leadDays = Number(draft.leadDays);
      if (draft.note) body.note = draft.note;

      /* Always an upsert, keyed on item + location + strategy + date — so
         re-saving the same day's capacity corrects it instead of stacking a
         second row that silently doubles it. */
      await availabilityService.upsert(body);
      setAdding(false);
      onChanged(editing ? 'Availability updated.' : 'Availability added.');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await availabilityService.remove(confirm.id);
      setConfirm(null);
      onChanged('Availability row deleted.');
      await load();
    } catch (e: any) {
      setError(e.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const declared = commerce?.availability.model;
  const needs = {
    onHand: draft.strategy === 'quantity',
    dated: draft.strategy === 'capacity_per_date',
    slots: draft.strategy === 'time_slot',
    lead: draft.strategy === 'lead_time',
  };

  const canSave =
    (!needs.onHand || draft.onHand !== '') &&
    (!needs.dated || (draft.date !== '' && draft.capacity !== '')) &&
    (!needs.slots || (draft.slotMinutes !== '' && Object.keys(draft.openingHours).length > 0)) &&
    (!needs.lead || draft.leadDays !== '');

  return (
    <>
      <Modal
        open={open && !adding}
        title="Availability"
        subtitle={item?.sku}
        width="max-w-2xl"
        onClose={onClose}
        footer={
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" startIcon="add" onClick={startAdd}>
              Add a row
            </Button>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={showDeleted}
                  onChange={(e) => setShowDeleted(e.target.checked)}
                />
                <span className="text-xs text-on-surface-variant">Show deleted</span>
              </label>
              <Button variant="ghost" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        }
      >
        <ErrorBanner message={error} onDismiss={() => setError(null)} />

        <p className="text-xs text-on-surface-variant mb-3">
          One row per location, strategy and date. The category declares{' '}
          <strong>{declared?.replace(/_/g, ' ') ?? 'nothing yet'}</strong>, and only rows matching
          it are used when resolving availability.
        </p>

        {loading ? (
          <LoadingState label="Loading availability…" />
        ) : !rows.length ? (
          <div className="text-center py-8">
            <Icon name="inventory" size="xl" color="outline" />
            <p className="text-sm text-on-surface-variant mt-2">
              No rows — this item reads as <strong>Availability not tracked</strong>, which is not
              the same as out of stock.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-outline-variant/50 divide-y divide-outline-variant/40 overflow-hidden">
            {rows.map((row) => {
              const inert = declared && row.strategy !== declared;
              return (
                <div
                  key={row.id}
                  className={`px-3.5 py-3 flex items-center gap-3 group bg-surface-container-lowest ${
                    row.is_deleted ? 'opacity-70' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-semibold ${
                          row.is_deleted ? 'text-on-surface-variant line-through' : 'text-on-surface'
                        }`}
                      >
                        {describeRow(row)}
                      </span>
                      {row.is_deleted && (
                        <Badge variant="error" size="sm">
                          deleted
                        </Badge>
                      )}
                      <Badge variant="neutral" size="sm">
                        {row.strategy.replace(/_/g, ' ')}
                      </Badge>
                      {row.locationId !== 'default' && (
                        <Badge variant="outline" size="sm" icon="store">
                          {row.locationId}
                        </Badge>
                      )}
                      {inert && (
                        <Badge variant="error" size="sm" title="The category uses a different strategy">
                          not in use
                        </Badge>
                      )}
                    </div>
                    {(row.inchargeId || row.resourceId || row.note) && (
                      <p className="text-[11px] text-on-surface-variant mt-0.5">
                        {[row.inchargeId, row.resourceId, row.note].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                  {row.is_deleted ? (
                    <Button
                      size="xs"
                      variant="outline"
                      startIcon="restore"
                      disabled={busy}
                      onClick={() => restore(row)}
                    >
                      Restore
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0 transition-opacity">
                      <Button size="icon-sm" variant="ghost" title="Edit" onClick={() => startEdit(row)} startIcon="edit" />
                      <Button size="icon-sm" variant="ghost" title="Delete" onClick={() => setConfirm(row)} startIcon="delete" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      <Modal
        open={adding}
        title={editing ? 'Edit availability' : 'Add availability'}
        subtitle={item?.sku}
        width="max-w-2xl"
        onClose={() => setAdding(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={busy} disabled={!canSave}>
              {editing ? 'Save changes' : 'Add row'}
            </Button>
          </div>
        }
      >
        <ErrorBanner message={error} onDismiss={() => setError(null)} />
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field
              label="Strategy"
              hint={
                declared && draft.strategy !== declared
                  ? `The category uses "${declared.replace(/_/g, ' ')}" — a row of another kind is stored but never read.`
                  : undefined
              }
            >
              <select
                className={selectClass}
                value={draft.strategy}
                onChange={(e) => setDraft({ ...draft, strategy: e.target.value as AvailabilityModel })}
              >
                {AVAILABILITY_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Location" hint="A shop, warehouse, room or court">
              <input
                className={inputClass}
                value={draft.locationId}
                onChange={(e) => setDraft({ ...draft, locationId: e.target.value })}
                placeholder="default"
              />
            </Field>
          </div>

          {needs.onHand && (
            <Field label="On hand" required hint="The count that depletes as you sell">
              <input
                className={inputClass}
                type="number"
                min={0}
                value={draft.onHand}
                onChange={(e) => setDraft({ ...draft, onHand: e.target.value })}
              />
            </Field>
          )}

          {needs.dated && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Date" required>
                <input
                  className={inputClass}
                  type="date"
                  value={draft.date}
                  onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />
              </Field>
              <Field label="Capacity" required hint="How many are available that day">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={draft.capacity}
                  onChange={(e) => setDraft({ ...draft, capacity: e.target.value })}
                />
              </Field>
            </div>
          )}

          {needs.slots && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <Field label="Slot length (min)" required>
                  <input
                    className={inputClass}
                    type="number"
                    min={5}
                    step={5}
                    value={draft.slotMinutes}
                    onChange={(e) => setDraft({ ...draft, slotMinutes: e.target.value })}
                  />
                </Field>
                <Field label="Resource" hint="Room, bay, court">
                  <input
                    className={inputClass}
                    value={draft.resourceId}
                    onChange={(e) => setDraft({ ...draft, resourceId: e.target.value })}
                  />
                </Field>
                <Field label="Person" hint="Doctor, stylist, coach">
                  <input
                    className={inputClass}
                    value={draft.inchargeId}
                    onChange={(e) => setDraft({ ...draft, inchargeId: e.target.value })}
                  />
                </Field>
              </div>
              <OpeningHoursEditor
                value={draft.openingHours}
                onChange={(openingHours) => setDraft({ ...draft, openingHours })}
              />
            </>
          )}

          {needs.lead && (
            <Field label="Lead days" required hint="How long the customer waits">
              <input
                className={inputClass}
                type="number"
                min={0}
                value={draft.leadDays}
                onChange={(e) => setDraft({ ...draft, leadDays: e.target.value })}
              />
            </Field>
          )}

          <Field label="Note" hint="Shown instead of the generated label, when set">
            <input
              className={inputClass}
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder="2 in white, rest to order"
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title="Delete this availability row?"
        danger
        busy={busy}
        confirmLabel="Delete row"
        onCancel={() => setConfirm(null)}
        onConfirm={remove}
        body={
          <p>
            A soft delete. With no rows left the item reads as{' '}
            <strong>Availability not tracked</strong> — not as out of stock.
          </p>
        }
      />
    </>
  );
};
