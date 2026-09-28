import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Icon } from '../../components/common';
import {
  ConfirmDialog,
  Modal,
  EmptyState,
  ErrorBanner,
  Field,
  inputClass,
  LoadingState,
  selectClass,
  SuccessBanner,
} from '../../components/catalog/primitives';
import {
  availabilityService,
  bookingService,
  catalogProductService,
} from '../../services/catalog.service';
import { CatalogBooking, CatalogItem, CatalogProduct, SlotDay } from '../../types/catalog.types';

/**
 * Bookings, and the slot picker that creates them.
 *
 * Only products whose category uses a slot or dated-capacity strategy are
 * bookable, so the item picker is filtered to those — offering a t-shirt for
 * 3pm on Tuesday would be nonsense.
 */

const today = () => new Date().toISOString().slice(0, 10);

export default function CatalogBookingsPage(): JSX.Element {
  const [bookings, setBookings] = useState<CatalogBooking[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [status, setStatus] = useState('');
  const [confirmCancel, setConfirmCancel] = useState<CatalogBooking | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CatalogBooking | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  /* Editing reuses the create form, with the slot pre-selected. */
  const [editing, setEditing] = useState<CatalogBooking | null>(null);

  const [modal, setModal] = useState(false);
  const [itemId, setItemId] = useState('');
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<SlotDay | null>(null);
  const [chosen, setChosen] = useState<{ startsAt: string; endsAt: string } | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [inchargeId, setInchargeId] = useState('');

  const load = useCallback(async () => {
    try {
      const [b, p] = await Promise.all([
        bookingService.list({
          status: status || undefined,
          limit: 50,
          includeDeleted: showDeleted || undefined,
        }),
        catalogProductService.search({ limit: 100, status: 'active' }),
      ]);
      setBookings(b.data);
      setProducts(p.data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [status, showDeleted]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Items whose category actually schedules something. */
  const bookableItems = useMemo(() => {
    const rows: { item: CatalogItem; product: CatalogProduct }[] = [];
    for (const p of products) {
      const model = p.commerce?.availability.model;
      if (model !== 'time_slot' && model !== 'capacity_per_date') continue;
      for (const item of p.items ?? []) rows.push({ item, product: p });
    }
    return rows;
  }, [products]);

  const itemLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const { item, product } of bookableItems) {
      map.set(item.id, `${product.name}${item.valueLabel ? ` — ${item.valueLabel}` : ''}`);
    }
    return map;
  }, [bookableItems]);

  const selected = bookableItems.find((r) => r.item.id === itemId);
  const requiresIncharge = Boolean(selected?.product.commerce?.availability.requiresIncharge);
  const isDated = selected?.product.commerce?.availability.model === 'capacity_per_date';

  const loadSlots = async () => {
    if (!itemId) return;
    setBusy(true);
    setChosen(null);
    try {
      setSlots(await availabilityService.slots(itemId, date));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const book = async () => {
    if (!itemId) return;
    setBusy(true);
    setError(null);
    try {
      /* A dated-capacity item is a count, not a calendar — there is no slot to
         pick, so the whole day is sent and the server checks what is left. */
      const startsAt = chosen?.startsAt ?? `${date}T09:00:00.000Z`;
      const endsAt = chosen?.endsAt ?? `${date}T10:00:00.000Z`;

      const body = {
        itemId,
        startsAt,
        endsAt,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        inchargeId: inchargeId || undefined,
      };

      if (editing) await bookingService.update(editing.id, body);
      else await bookingService.create(body);

      setModal(false);
      setEditing(null);
      setNotice(editing ? 'Booking updated.' : 'Booking confirmed.');
      setChosen(null);
      setSlots(null);
      setCustomerName('');
      setCustomerPhone('');
      await load();
    } catch (e: any) {
      /* A clash is a 409 that says so plainly — shown verbatim. */
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (b: CatalogBooking) => {
    setEditing(b);
    setItemId(b.itemId);
    setDate(String(b.startsAt).slice(0, 10));
    setChosen({ startsAt: String(b.startsAt), endsAt: String(b.endsAt) });
    setCustomerName(b.customerName ?? '');
    setCustomerPhone(b.customerPhone ?? '');
    setInchargeId(b.inchargeId ?? '');
    setSlots(null);
    setModal(true);
  };

  const removeBooking = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await bookingService.remove(confirmDelete.id);
      setNotice('Booking deleted — it can be restored.');
      setConfirmDelete(null);
      await load();
    } catch (e: any) {
      setError(e.message);
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (b: CatalogBooking) => {
    setBusy(true);
    try {
      await bookingService.restore(b.id);
      setNotice('Booking restored.');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirmCancel) return;
    setBusy(true);
    try {
      await bookingService.cancel(confirmCancel.id);
      setNotice('Booking cancelled — the slot is free again.');
      setConfirmCancel(null);
      await load();
    } catch (e: any) {
      setError(e.message);
      setConfirmCancel(null);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState label="Loading bookings…" />;

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">Bookings</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Appointments, slots and dated capacity across the catalogue.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className={`${selectClass} w-auto`} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="held">Held</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
          </select>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="accent-primary"
              checked={showDeleted}
              onChange={(e) => setShowDeleted(e.target.checked)}
            />
            <span className="text-xs text-on-surface-variant">Show deleted</span>
          </label>
          <Button
            variant="primary"
            startIcon="add"
            onClick={() => {
              setEditing(null);
              setChosen(null);
              setSlots(null);
              setCustomerName('');
              setCustomerPhone('');
              setInchargeId('');
              setModal(true);
            }}
            disabled={!bookableItems.length}
          >
            New booking
          </Button>
        </div>
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <SuccessBanner message={notice} onDismiss={() => setNotice(null)} />

      {!bookableItems.length && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-tertiary-fixed/40 text-on-tertiary-fixed border border-tertiary/20 flex items-start gap-2.5">
          <Icon name="info" size="sm" className="mt-0.5 shrink-0" />
          <p className="text-sm">
            Nothing is bookable yet. A product becomes bookable when its category uses the{' '}
            <strong>time slots</strong> or <strong>capacity per date</strong> availability model.
          </p>
        </div>
      )}

      {!bookings.length ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/40">
          <EmptyState
            icon="event"
            title="No bookings"
            description="Bookings made here and through the API both appear in this list."
          />
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-outline-variant/40 overflow-hidden divide-y divide-outline-variant/40">
          {bookings.map((b) => {
            const start = new Date(b.startsAt);
            const end = new Date(b.endsAt);
            const cancelled = b.status === 'cancelled';
            return (
              <div
                key={b.id}
                className={`px-5 py-3.5 flex items-center gap-4 group ${
                  cancelled || b.is_deleted ? 'opacity-60' : ''
                }`}
              >
                <div className="w-14 text-center shrink-0">
                  <p className="text-[11px] text-on-surface-variant uppercase">
                    {start.toLocaleDateString([], { month: 'short' })}
                  </p>
                  <p className="text-lg font-bold text-on-surface leading-none">{start.getDate()}</p>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-sm font-semibold ${
                        cancelled ? 'text-on-surface-variant line-through' : 'text-on-surface'
                      }`}
                    >
                      {itemLabel.get(b.itemId) ?? b.itemId.slice(0, 8)}
                    </span>
                    <Badge
                      variant={cancelled ? 'error' : b.status === 'confirmed' ? 'secondary' : 'tertiary'}
                      size="sm"
                    >
                      {b.status}
                    </Badge>
                    {b.is_deleted && (
                      <Badge variant="error" size="sm">
                        deleted
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                    {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {b.customerName && <> · {b.customerName}</>}
                    {b.customerPhone && <> · {b.customerPhone}</>}
                    {b.inchargeId && <> · with {b.inchargeId}</>}
                  </p>
                </div>

                {b.is_deleted ? (
                  <Button size="sm" variant="outline" startIcon="restore" disabled={busy} onClick={() => restore(b)}>
                    Restore
                  </Button>
                ) : (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon-sm" variant="ghost" title="Edit / reschedule" onClick={() => openEdit(b)} startIcon="edit" />
                    {!cancelled && (
                      <Button size="icon-sm" variant="ghost" title="Cancel" onClick={() => setConfirmCancel(b)} startIcon="event_busy" />
                    )}
                    <Button size="icon-sm" variant="ghost" title="Delete" onClick={() => setConfirmDelete(b)} startIcon="delete" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modal}
        title={editing ? 'Edit booking' : 'New booking'}
        width="max-w-2xl"
        onClose={() => setModal(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={book}
              loading={busy}
              disabled={!itemId || (!isDated && !chosen) || (requiresIncharge && !inchargeId)}
            >
              {editing ? 'Save changes' : 'Confirm booking'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="What" required>
            <select
              className={selectClass}
              value={itemId}
              onChange={(e) => {
                setItemId(e.target.value);
                setSlots(null);
                setChosen(null);
              }}
            >
              <option value="">Select…</option>
              {bookableItems.map(({ item, product }) => (
                <option key={item.id} value={item.id}>
                  {product.name}
                  {item.valueLabel ? ` — ${item.valueLabel}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex items-end gap-2">
            <Field label="Date" required className="flex-1">
              <input
                type="date"
                className={inputClass}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSlots(null);
                  setChosen(null);
                }}
              />
            </Field>
            {!isDated && (
              <Button variant="outline" onClick={loadSlots} loading={busy} disabled={!itemId}>
                Find slots
              </Button>
            )}
          </div>

          {isDated && itemId && (
            <p className="text-xs text-on-surface-variant px-3 py-2 rounded-lg bg-surface-container flex items-start gap-1.5">
              <Icon name="info" size="xs" className="mt-0.5 shrink-0" />
              This is dated capacity, not a calendar — the server checks how many are left on the
              date rather than whether a specific time is free.
            </p>
          )}

          {slots && (
            <div>
              <p className="text-xs text-on-surface-variant mb-2">
                {slots.available} of {slots.total} free
              </p>
              {!slots.total ? (
                <p className="text-sm text-on-surface-variant italic">
                  Closed that day — no opening hours are configured for it.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {slots.slots.map((s) => {
                    const on = chosen?.startsAt === s.startsAt;
                    return (
                      <button
                        key={s.startsAt}
                        type="button"
                        disabled={!s.available}
                        onClick={() => {
                          setChosen({ startsAt: s.startsAt, endsAt: s.endsAt });
                          if (s.inchargeId) setInchargeId(s.inchargeId);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          on
                            ? 'bg-primary text-on-primary border-primary'
                            : s.available
                              ? 'bg-surface-container-lowest text-on-surface border-outline-variant/50 hover:bg-surface-container'
                              : 'bg-surface-container text-on-surface-variant/40 border-outline-variant/30 line-through cursor-not-allowed'
                        }`}
                      >
                        {new Date(s.startsAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-outline-variant/40">
            <Field label="Customer name">
              <input
                className={inputClass}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <input
                className={inputClass}
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </Field>
          </div>

          {requiresIncharge && (
            <Field
              label="Assigned to"
              required
              hint="This category requires a named person — the booking is refused without one."
            >
              <input
                className={inputClass}
                value={inchargeId}
                onChange={(e) => setInchargeId(e.target.value)}
                placeholder="doctor-mehta"
              />
            </Field>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete this booking?"
        danger
        busy={busy}
        confirmLabel="Delete booking"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={removeBooking}
        body={
          <>
            <p className="mb-2">
              Deleting removes it from the list entirely. Use <strong>Cancel</strong> instead when
              the customer called off a real appointment — that keeps the record visible.
            </p>
            <p>A soft delete, so it can be restored. Either way the slot is freed.</p>
          </>
        }
      />

      <ConfirmDialog
        open={Boolean(confirmCancel)}
        title="Cancel this booking?"
        danger
        busy={busy}
        confirmLabel="Cancel booking"
        onCancel={() => setConfirmCancel(null)}
        onConfirm={cancel}
        body={
          <p>
            The booking is marked cancelled rather than deleted — the slot frees up immediately and
            the record survives for the history.
          </p>
        }
      />
    </div>
  );
}
