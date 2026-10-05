import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../common';
import { unitService } from '../../services/stock.service';
import { NEXT_UNIT_STATUS, UNIT_STATUS_LABELS } from '../../types/stock.types';
import type { ItemUnit, UnitStatus } from '../../types/stock.types';

/**
 * Serial / batch units of one item (plan 4.4) — shown only when the item is
 * tracked and its product's tracking is serial or batch.
 *
 *   serial: the units ARE the stock — adding an in-stock unit is +1, selling
 *           one −1, a return +1 (the server writes each as a stock movement)
 *   batch:  the batch number is a label on the unit; stock is adjusted normally
 *
 * Add one, or paste many lines at once (all or nothing). Status moves one
 * step: In stock → Sold → Returned → In stock.
 */

const inputClass =
  'h-9 px-2 rounded-lg bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-sm';

const STATUS_STYLE: Record<UnitStatus, string> = {
  in_stock: 'bg-secondary-fixed/30 text-secondary',
  sold: 'bg-surface-container-high text-on-surface-variant',
  returned: 'bg-amber-50 text-amber-700',
};

const NEXT_ACTION: Record<UnitStatus, string> = { in_stock: 'Mark sold', sold: 'Mark returned', returned: 'Back in stock' };

const serverText = (e: any) => (e?.fieldErrors && Object.values(e.fieldErrors).join(' · ')) || e?.message || 'Something went wrong';

export const SerialUnitsPanel: React.FC<{
  itemId: string;
  tracking: 'serial' | 'batch';
  canEdit: boolean;
  /** After a change that moves stock (serial), so the page can refresh its figures. */
  onChanged?: () => void;
}> = ({ itemId, tracking, canEdit, onChanged }) => {
  const serial = tracking === 'serial';
  const noun = serial ? 'Serial number' : 'Batch number';
  const [units, setUnits] = useState<ItemUnit[] | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<UnitStatus | ''>('');
  const [single, setSingle] = useState('');
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setUnits((await unitService.list(itemId, { search, status: status || undefined })).units);
    } catch (e) {
      setError(serverText(e));
    }
  }, [itemId, search, status]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 250);
    return () => clearTimeout(t);
  }, [load]);

  const numbers = (pasting ? pasted.split(/\r?\n/) : [single]).map((s) => s.trim()).filter(Boolean);

  const add = async () => {
    if (!numbers.length) return;
    setBusy(true);
    setError(null);
    try {
      await unitService.add(itemId, numbers.map((n) => (serial ? { serial_no: n } : { batch_no: n })));
      setSingle('');
      setPasted('');
      setPasting(false);
      await load();
      if (serial) onChanged?.();
    } catch (e) {
      setError(serverText(e));
    } finally {
      setBusy(false);
    }
  };

  const advance = async (u: ItemUnit) => {
    setError(null);
    try {
      await unitService.update(u.id, { status: NEXT_UNIT_STATUS[u.status] });
      await load();
      if (serial) onChanged?.();
    } catch (e) {
      setError(serverText(e));
    }
  };

  const remove = async (u: ItemUnit) => {
    if (!window.confirm(`Remove unit ${u.serial_no ?? u.batch_no}?`)) return;
    setError(null);
    try {
      await unitService.remove(u.id);
      await load();
      if (serial) onChanged?.();
    } catch (e) {
      setError(serverText(e));
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="units-panel">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-on-surface">{serial ? 'Serial units' : 'Batches'}</h3>
        <span className="text-xs text-on-surface-variant">
          {serial ? 'The units are the stock: adding one is +1, selling one −1.' : 'Batch numbers label the units; stock is adjusted as usual.'}
        </span>
      </div>

      {canEdit && (
        <div className="flex flex-col gap-2 rounded-lg border border-surface-container-high p-3">
          {pasting ? (
            <textarea
              aria-label={`${noun}s, one per line`}
              rows={4}
              className={`${inputClass} h-auto py-2`}
              placeholder={`One ${noun.toLowerCase()} per line`}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
          ) : (
            <input
              aria-label={noun}
              className={inputClass}
              placeholder={serial ? 'e.g. chassis / VIN / IMEI' : 'e.g. B-2026-10'}
              value={single}
              onChange={(e) => setSingle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void add();
                }
              }}
            />
          )}
          <div className="flex items-center justify-between gap-2">
            <button type="button" className="text-xs font-medium text-primary" onClick={() => setPasting((p) => !p)}>
              {pasting ? 'Add one instead' : 'Paste many'}
            </button>
            <Button variant="primary" size="sm" startIcon="add" onClick={() => void add()} loading={busy} disabled={busy || !numbers.length}>
              {numbers.length > 1 ? `Add ${numbers.length} units` : 'Add unit'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <input aria-label="Search units" className={`${inputClass} flex-1`} placeholder={`Search by ${noun.toLowerCase()}`} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Unit status" className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as UnitStatus | '')}>
          <option value="">All</option>
          {(Object.keys(UNIT_STATUS_LABELS) as UnitStatus[]).map((s) => (
            <option key={s} value={s}>
              {UNIT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-xs text-error" role="alert">
          {error}
        </p>
      )}

      {units === null ? (
        <p className="text-xs text-on-surface-variant">Loading units…</p>
      ) : units.length === 0 ? (
        <p className="text-xs text-on-surface-variant">{search || status ? 'No unit matches.' : 'No units yet.'}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-surface-container-low max-h-64 overflow-y-auto" aria-label="Units">
          {units.map((u) => (
            <li key={u.id} className="flex items-center justify-between gap-2 py-1.5 text-sm" data-testid={`unit-${u.serial_no ?? u.batch_no}`}>
              <span className="min-w-0 truncate">
                <span className="font-medium text-on-surface">{u.serial_no ?? u.batch_no}</span>
                {u.serial_no && u.batch_no && <span className="text-xs text-on-surface-variant"> · batch {u.batch_no}</span>}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${STATUS_STYLE[u.status]}`}>{UNIT_STATUS_LABELS[u.status]}</span>
                {canEdit && (
                  <>
                    <button type="button" className="text-xs font-medium text-primary" aria-label={`${NEXT_ACTION[u.status]}: ${u.serial_no ?? u.batch_no}`} onClick={() => void advance(u)}>
                      {NEXT_ACTION[u.status]}
                    </button>
                    <button type="button" className="text-xs font-medium text-error" aria-label={`Remove unit ${u.serial_no ?? u.batch_no}`} onClick={() => void remove(u)}>
                      Remove
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SerialUnitsPanel;
