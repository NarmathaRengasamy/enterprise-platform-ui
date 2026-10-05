import React, { useCallback, useEffect, useState } from 'react';
import { Button, Icon } from '../common';
import { stockService } from '../../services/stock.service';
import { teamService } from '../../services/team.service';
import type { ItemStock, MovementSource, StockMovementPage } from '../../types/stock.types';
import { AdjustStockModal } from './AdjustStockModal';

/**
 * One item's stock (plan 4.4) for the details page's variant popup, in two
 * parts that share one source (`useItemStock`):
 *
 *   StockInfoCard   — left column: On hand · Reserved · Available, reorder
 *                     point, low stock, Adjust Stock (Admin / Editor)
 *   StockHistory    — "preview" (latest 2, View all) on Overview, "full"
 *                     (paged) on the Inventory tab
 *
 *   pack → from its base item; bundle → from its components; not tracked →
 *   always available; serial → its units are the stock (no manual Adjust).
 */

const SOURCE_LABELS: Record<MovementSource, string> = {
  adjust: 'Adjustment',
  initial: 'Initial stock',
  opening: 'Opening balance',
  unit: 'Unit',
  sale: 'Sale',
};

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

/* Team members' names, fetched once for the page (ids stay as they are when unknown). */
let namesCache: Promise<Map<string, string>> | null = null;
const loadNames = () => {
  namesCache ??= teamService
    .getTeamMembers()
    .then((list) => new Map(list.map((m) => [m.id, m.name])))
    .catch(() => new Map<string, string>());
  return namesCache;
};
export const useUserNames = () => {
  const [names, setNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let alive = true;
    void loadNames().then((m) => alive && setNames(m));
    return () => {
      alive = false;
    };
  }, []);
  return (id: string) => (id === 'system' ? 'System' : names.get(id) ?? id);
};

/** The stock, its history and the actions on them, for one item. */
export const useItemStock = (itemId: string, opts: { canEdit: boolean; onChanged?: () => void; historySize?: number }) => {
  const [stock, setStock] = useState<ItemStock | null>(null);
  const [history, setHistory] = useState<StockMovementPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const size = opts.historySize ?? 10;

  const loadHistory = useCallback(
    async (page = 1) => {
      try {
        setHistory(await stockService.movements(itemId, page, size));
      } catch (e: any) {
        setError(e?.message || 'Could not load the stock history');
      }
    },
    [itemId, size]
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      const s = await stockService.get(itemId);
      setStock(s);
      /* History only for items with stock of their own, and only for Admins / Editors. */
      if (opts.canEdit && s.kind === 'item' && s.availability.status === 'tracked') await loadHistory(1);
      else setHistory(null);
    } catch (e: any) {
      setError(e?.message || 'Could not load the stock');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, opts.canEdit, loadHistory]);

  useEffect(() => {
    setStock(null);
    setHistory(null);
    void load();
  }, [load]);

  /** After an adjustment / reorder point / unit change. */
  const changed = (next?: ItemStock) => {
    if (next) setStock(next);
    void (next ? loadHistory(1) : load());
    opts.onChanged?.();
  };

  return { stock, history, error, loadHistory, changed };
};

export type ItemStockState = ReturnType<typeof useItemStock>;

const Tile: React.FC<{ icon: string; label: string; value: number }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 rounded-xl bg-surface-container-low px-3 py-3">
    <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
      <Icon name={icon} size="sm" />
    </div>
    <div>
      <p className="text-[11px] text-on-surface-variant">{label}</p>
      <p className="text-lg font-bold text-on-surface leading-tight" data-testid={`stock-${label.toLowerCase().replace(' ', '-')}`}>
        {value}
      </p>
    </div>
  </div>
);

/** Left column of the popup: the figures and the actions. */
export const StockInfoCard: React.FC<{
  itemId: string;
  title: string;
  canEdit: boolean;
  state: ItemStockState;
  /** "Add units in Inventory" for serial items. */
  onOpenInventory?: () => void;
}> = ({ itemId, title, canEdit, state, onOpenInventory }) => {
  const { stock, error, changed } = state;
  const [adjusting, setAdjusting] = useState(false);
  const [reorder, setReorder] = useState('');
  const [reorderNote, setReorderNote] = useState<string | null>(null);

  useEffect(() => {
    if (stock) setReorder(String(stock.rows[0]?.reorder_point ?? 0));
  }, [stock]);

  const saveReorder = async () => {
    if (!/^\d+$/.test(reorder.trim())) return setReorderNote('A whole number of 0 or more');
    try {
      changed(await stockService.setReorderPoint(itemId, Number(reorder.trim())));
      setReorderNote('Saved');
    } catch (e: any) {
      setReorderNote(e?.message || 'Could not save');
    }
  };

  const head = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Icon name="inventory_2" size="md" />
        </div>
        <h3 className="text-base font-semibold text-on-surface">Stock Information</h3>
      </div>
      {stock?.availability.status === 'tracked' && stock.availability.low_stock && (
        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700" data-testid="low-stock">
          Low stock
        </span>
      )}
    </div>
  );

  if (error) {
    return (
      <div className="flex flex-col gap-3" data-testid="stock-panel">
        {head}
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      </div>
    );
  }
  if (!stock) {
    return (
      <div className="flex flex-col gap-3" data-testid="stock-panel">
        {head}
        <p className="text-xs text-on-surface-variant">Loading stock…</p>
      </div>
    );
  }

  const a = stock.availability;
  const tracked = a.status === 'tracked';
  const ownStock = stock.kind === 'item' && tracked;

  return (
    <div className="flex flex-col gap-4" data-testid="stock-panel">
      {head}

      {!tracked && <p className="text-sm text-on-surface-variant">Not tracked — always available (Track inventory is off).</p>}
      {tracked && stock.kind === 'pack' && (
        <p className="text-sm text-on-surface">
          <strong>{a.available}</strong> available — from the base item{stock.pack_of?.base_sku ? ` (${stock.pack_of.base_sku})` : ''}: each pack takes{' '}
          {stock.pack_of?.quantity} from it. Adjust the base item's stock.
        </p>
      )}
      {tracked && stock.kind === 'bundle' && (
        <p className="text-sm text-on-surface">
          <strong>{a.available}</strong> available — from its components. Adjust the components' stock.
        </p>
      )}

      {ownStock && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Tile icon="inventory" label="On hand" value={a.on_hand} />
            <Tile icon="lock" label="Reserved" value={a.reserved} />
            <Tile icon="check_circle" label="Available" value={a.available} />
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-on-surface-variant" htmlFor={`reorder-${itemId}`}>
                  Reorder point
                </label>
                <input
                  id={`reorder-${itemId}`}
                  aria-label="Reorder point"
                  inputMode="numeric"
                  className="w-28 h-10 px-3 rounded-lg bg-surface-container-lowest border border-surface-container-high text-sm focus:outline-none focus:border-primary"
                  value={reorder}
                  onChange={(e) => {
                    setReorder(e.target.value);
                    setReorderNote(null);
                  }}
                />
              </div>
              <Button variant="outline" size="md" onClick={() => void saveReorder()}>
                Save
              </Button>
              <span className="flex-1" />
              {stock.can_adjust ? (
                <Button variant="primary" size="md" startIcon="tune" onClick={() => setAdjusting(true)}>
                  Adjust Stock
                </Button>
              ) : stock.tracking === 'serial' ? (
                <Button variant="soft" size="md" startIcon="qr_code_2" onClick={onOpenInventory}>
                  Add units in Inventory
                </Button>
              ) : (
                stock.adjust_note && <span className="text-xs text-on-surface-variant pb-2">{stock.adjust_note}</span>
              )}
              {reorderNote && <span className="basis-full text-xs text-on-surface-variant">{reorderNote}</span>}
            </div>
          )}
        </>
      )}

      {adjusting && ownStock && (
        <AdjustStockModal
          itemId={itemId}
          title={title}
          onHand={a.on_hand}
          onClose={() => setAdjusting(false)}
          onDone={(s) => {
            setAdjusting(false);
            changed(s);
          }}
        />
      )}
    </div>
  );
};

/** Stock movements: the latest few with "View all" (preview), or every page (full). */
export const StockHistory: React.FC<{
  state: ItemStockState;
  mode: 'preview' | 'full';
  onViewAll?: () => void;
}> = ({ state, mode, onViewAll }) => {
  const { history, stock, loadHistory } = state;
  const nameOf = useUserNames();
  /* The preview always shows the newest entries, even after paging on the Inventory tab. */
  useEffect(() => {
    if (mode === 'preview' && history && history.page !== 1) void loadHistory(1);
  }, [mode, history, loadHistory]);
  if (!stock || stock.kind !== 'item' || stock.availability.status !== 'tracked') return null;
  const rows = history ? (mode === 'preview' ? history.items.slice(0, 2) : history.items) : [];

  return (
    <div className="flex flex-col gap-3" data-testid={mode === 'preview' ? 'stock-history-preview' : 'stock-history'}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon name="history" size="md" />
          </div>
          <h3 className="text-base font-semibold text-on-surface">Stock History</h3>
        </div>
        {mode === 'preview' && history && history.total > 0 && (
          <button type="button" className="text-sm font-semibold text-primary flex items-center gap-0.5" onClick={onViewAll}>
            View all
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              chevron_right
            </span>
          </button>
        )}
      </div>

      {!history ? (
        <p className="text-xs text-on-surface-variant">Loading…</p>
      ) : history.total === 0 ? (
        <p className="text-sm text-on-surface-variant">No changes yet.</p>
      ) : (
        <div className="rounded-xl border border-surface-container-high overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-container-low">
              <tr className="text-left text-on-surface-variant">
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Change</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium text-right">After</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-t border-surface-container-low align-top">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {when(m.created_at)}
                    <span className="block text-xs text-on-surface-variant">{nameOf(m.created_by)}</span>
                  </td>
                  <td className={`px-3 py-2 font-semibold ${m.delta > 0 ? 'text-secondary' : 'text-error'}`}>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                  <td className="px-3 py-2">
                    {m.reason}
                    <span className="block text-xs text-on-surface-variant">{SOURCE_LABELS[m.source] ?? m.source}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{m.on_hand_after}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {mode === 'full' && history && history.pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <Button variant="ghost" size="xs" disabled={history.page <= 1} onClick={() => void loadHistory(history.page - 1)}>
            Newer
          </Button>
          <span>
            Page {history.page} of {history.pages}
          </span>
          <Button variant="ghost" size="xs" disabled={history.page >= history.pages} onClick={() => void loadHistory(history.page + 1)}>
            Older
          </Button>
        </div>
      )}
    </div>
  );
};
