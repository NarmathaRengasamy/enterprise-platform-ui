import React, { useState } from 'react';
import { Button } from '../common';
import { stockService } from '../../services/stock.service';
import type { ItemStock } from '../../types/stock.types';

/**
 * Adjust stock (plan 4.4, design §7.7): add or take out a whole number of
 * units, with a reason. The server applies it atomically and never below 0;
 * its refusals (409) are shown as sent — "Only 0 in stock", "Not tracked",
 * "adjust the base item", "add or sell units instead".
 */

const inputClass =
  'w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-sm';

export const AdjustStockModal: React.FC<{
  itemId: string;
  /** Shown in the title, e.g. "Petrol · Red". */
  title: string;
  /** Current on hand, for the "after" preview. */
  onHand: number;
  onClose: () => void;
  /** Called with the server's fresh stock after a successful adjustment. */
  onDone: (stock: ItemStock) => void;
}> = ({ itemId, title, onHand, onClose, onDone }) => {
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const qty = /^[1-9]\d*$/.test(quantity.trim()) ? Number(quantity.trim()) : null;
  const delta = qty === null ? null : direction === 'in' ? qty : -qty;
  const after = delta === null ? null : onHand + delta;
  const problem =
    quantity.trim() && qty === null ? 'Enter a whole number of 1 or more' : after !== null && after < 0 ? `Only ${onHand} in stock` : null;

  const save = async () => {
    if (delta === null || problem || !reason.trim()) return;
    setSaving(true);
    setError(null);
    try {
      onDone(await stockService.adjust(itemId, { delta, reason: reason.trim() }));
    } catch (e: any) {
      setError((e?.fieldErrors && Object.values(e.fieldErrors).join(' · ')) || e?.message || 'Could not adjust the stock');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Adjust stock for ${title}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md border border-surface-container-high flex flex-col">
        <div className="px-6 py-4 border-b border-surface-container-low">
          <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Adjust stock</h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {title} · {onHand} on hand now
          </p>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="inline-flex rounded-lg border border-surface-container-high p-0.5 self-start" role="group" aria-label="Direction">
            {(
              [
                ['in', 'Add stock', 'add'],
                ['out', 'Take out', 'remove'],
              ] as const
            ).map(([value, text, icon]) => (
              <button
                key={value}
                type="button"
                aria-pressed={direction === value}
                onClick={() => setDirection(value)}
                className={`px-3 h-8 rounded-md text-sm font-medium flex items-center gap-1 ${
                  direction === value ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                <span className="material-symbols-outlined text-base" aria-hidden="true">
                  {icon}
                </span>
                {text}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-on-surface" htmlFor="adjust-qty">
              Quantity
            </label>
            <input id="adjust-qty" aria-label="Quantity" inputMode="numeric" autoFocus className={`${inputClass} ${problem ? 'border-error' : ''}`} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            {problem ? (
              <span className="text-xs text-error">{problem}</span>
            ) : (
              after !== null && <span className="text-xs text-on-surface-variant" data-testid="adjust-after">{after} on hand after this</span>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-on-surface" htmlFor="adjust-reason">
              Reason *
            </label>
            <input
              id="adjust-reason"
              aria-label="Reason"
              className={inputClass}
              maxLength={200}
              placeholder={direction === 'in' ? 'e.g. Received from supplier' : 'e.g. Damaged, sold at the counter'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-surface-container-low">
          <Button variant="ghost" size="md" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={() => void save()} loading={saving} disabled={saving || delta === null || Boolean(problem) || !reason.trim()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdjustStockModal;
