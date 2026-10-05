import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '../common';
import { bundleService } from '../../services/stock.service';
import { productV2Service } from '../../services/productV2.service';
import type { BundleComponents } from '../../types/stock.types';
import type { ProductSummary, ProductV2 } from '../../types/productV2.types';

/**
 * What one bundle item is made of (plan 4.4, design §3.5): e.g. a "Service kit"
 * = 1 × oil filter + 4 × spark plug. Items of any product may be picked, but
 * not packs (use the base item × quantity) and not other bundles (no nesting).
 * The bundle has no stock of its own: its availability is the smallest
 * ⌊available ÷ quantity⌋ over its components. Saved as a whole list.
 */

interface Row {
  component_item_id: string;
  quantity: string;
  label: string;
}

const inputClass =
  'h-9 px-2 rounded-lg bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-sm';

const serverText = (e: any) => (e?.fieldErrors && Object.values(e.fieldErrors).join(' · ')) || e?.message || 'Something went wrong';

const availabilityText = (a: BundleComponents['availability']) =>
  !a ? '—' : a.status === 'not_tracked' ? 'Not tracked' : `${a.available} available`;

export const BundleComponentsEditor: React.FC<{
  bundleItemId: string;
  canEdit: boolean;
  onChanged?: () => void;
}> = ({ bundleItemId, canEdit, onChanged }) => {
  const [saved, setSaved] = useState<BundleComponents | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<ProductSummary[]>([]);
  const [openProduct, setOpenProduct] = useState<ProductV2 | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const fill = (b: BundleComponents) => {
    setSaved(b);
    setRows(
      b.components.map((c) => ({
        component_item_id: c.component_item_id,
        quantity: String(c.quantity),
        label: `${c.product_name ?? 'Item'} · ${c.sku ?? c.component_item_id}`,
      }))
    );
  };

  const load = useCallback(async () => {
    try {
      fill(await bundleService.get(bundleItemId));
    } catch (e) {
      setError(serverText(e));
    }
  }, [bundleItemId]);

  useEffect(() => {
    void load();
  }, [load]);

  /* Product search for the picker (bundles are left out: no nesting). */
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setFound([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await productV2Service.search({ search: q, limit: 8 });
        setFound(res.items.filter((p) => !p.is_bundle));
      } catch {
        setFound([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const pickProduct = async (id: string) => {
    try {
      setOpenProduct(await productV2Service.get(id));
    } catch (e) {
      setError(serverText(e));
    }
  };

  const addItem = (p: ProductV2, itemId: string, sku: string) => {
    setNote(null);
    if (rows.some((r) => r.component_item_id === itemId)) return setNote(`${sku} is already in the bundle — change its quantity instead`);
    setRows((cur) => [...cur, { component_item_id: itemId, quantity: '1', label: `${p.name.en} · ${sku}` }]);
  };

  const bad = rows.find((r) => !/^[1-9]\d*$/.test(r.quantity.trim()));
  const dirty =
    JSON.stringify(rows.map((r) => [r.component_item_id, r.quantity.trim()])) !==
    JSON.stringify((saved?.components ?? []).map((c) => [c.component_item_id, String(c.quantity)]));

  const save = async () => {
    if (bad) return;
    setBusy(true);
    setError(null);
    try {
      fill(await bundleService.replace(bundleItemId, rows.map((r) => ({ component_item_id: r.component_item_id, quantity: Number(r.quantity.trim()) }))));
      setNote('Saved');
      onChanged?.();
    } catch (e) {
      setError(serverText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!saved) return error ? <p className="text-sm text-error" role="alert">{error}</p> : <p className="text-xs text-on-surface-variant">Loading the bundle…</p>;

  return (
    <div className="flex flex-col gap-3" data-testid="bundle-editor">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-on-surface">Bundle components</h3>
        <span className="text-xs text-on-surface-variant" data-testid="bundle-availability">
          Bundle: {availabilityText(saved.availability)}
        </span>
      </div>

      {rows.length === 0 && <p className="text-xs text-on-surface-variant">No components yet — the bundle shows as "Not tracked" until it has some.</p>}
      {rows.length > 0 && (
        <ul className="flex flex-col divide-y divide-surface-container-low" aria-label="Components">
          {rows.map((r, i) => {
            const comp = saved.components.find((c) => c.component_item_id === r.component_item_id);
            return (
              <li key={r.component_item_id} className="flex items-center gap-2 py-1.5 text-sm">
                <input
                  aria-label={`Quantity of ${r.label}`}
                  inputMode="numeric"
                  disabled={!canEdit}
                  className={`${inputClass} w-16 ${!/^[1-9]\d*$/.test(r.quantity.trim()) ? 'border-error' : ''}`}
                  value={r.quantity}
                  onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
                />
                <span className="text-on-surface-variant">×</span>
                <span className="flex-1 min-w-0 truncate">{r.label}</span>
                <span className="text-xs text-on-surface-variant shrink-0">{comp ? availabilityText(comp.availability) : 'new'}</span>
                {canEdit && (
                  <button type="button" aria-label={`Remove ${r.label}`} className="text-xs font-medium text-error" onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <div className="flex flex-col gap-2 rounded-lg border border-surface-container-high p-3">
          <input aria-label="Find an item for the bundle" className={inputClass} placeholder="Search products to add their items" value={query} onChange={(e) => setQuery(e.target.value)} />
          {found.length > 0 && !openProduct && (
            <ul className="flex flex-col" aria-label="Products found">
              {found.map((p) => (
                <li key={p.id}>
                  <button type="button" className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-surface-container-low" onClick={() => void pickProduct(p.id)}>
                    {p.name.en} <span className="text-xs text-on-surface-variant">· {p.item_count} items</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {openProduct && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-on-surface">{openProduct.name.en}</span>
                <button type="button" className="text-primary font-medium" onClick={() => setOpenProduct(null)}>
                  Back
                </button>
              </div>
              {/* Packs are left out: add the base item × quantity instead. */}
              {openProduct.items
                .filter((it) => !it.pack_of && it.id !== bundleItemId)
                .map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    aria-label={`Add ${it.sku} to the bundle`}
                    className="flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-surface-container-low"
                    onClick={() => addItem(openProduct, it.id, it.sku)}
                  >
                    <span>{it.sku}</span>
                    <span className="text-xs text-on-surface-variant">{it.availability.status === 'tracked' ? `${it.availability.available} available` : 'Not tracked'}</span>
                  </button>
                ))}
            </div>
          )}
          {note && <p className="text-xs text-on-surface-variant">{note}</p>}
        </div>
      )}

      {error && (
        <p className="text-xs text-error" role="alert">
          {error}
        </p>
      )}
      {canEdit && (
        <div className="flex justify-end">
          <Button variant="primary" size="sm" onClick={() => void save()} loading={busy} disabled={busy || !dirty || Boolean(bad)}>
            Save components
          </Button>
        </div>
      )}
    </div>
  );
};

export default BundleComponentsEditor;
