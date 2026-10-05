import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button, Icon, Toast, ToastMessage } from '../components/common';
import { productTypeService } from '../services/productType.service';
import {
  FIELD_TYPE_LABELS,
  FieldDefinition,
  FieldInput,
  FieldPatch,
  FieldType,
  OptionInput,
  ProductType,
  UNIT_FAMILY_LABELS,
  UNITS_BY_FAMILY,
  UnitFamily,
} from '../types/productType.types';

/**
 * Attributes (Phase 1) — replaces "Product Types".
 *
 * The fields every product form is built from: the ones pre-loaded from the
 * business category (badge Template) plus the admin's own (badge Custom).
 * Template fields keep their key and type forever; any field can be relabelled,
 * reordered, retired and restored (design §3.1, §7.2, §7.3).
 */

const inputClass =
  'w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-sm ' +
  'focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-slate-50 disabled:text-outline';

const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS) as FieldType[];

/* ----------------------------------------------------------- editor */

interface EditorState {
  mode: 'add' | 'edit';
  field?: FieldDefinition;
  en: string;
  ta: string;
  hi: string;
  type: FieldType;
  unit: string;
  /** Number fields: '' = none; set = usable as a measured size for variants (R45). */
  unit_family: UnitFamily | '';
  min: string;
  max: string;
  /** Existing options (edit): shown with a retire toggle, never removable when locked. */
  existing: { value: string; label: string; deprecated: boolean }[];
  /** New options, one per line. */
  newOptions: string;
  variant_forming: boolean;
  filterable: boolean;
  required: boolean;
  group: string;
}

const blankEditor = (): EditorState => ({
  mode: 'add',
  en: '',
  ta: '',
  hi: '',
  type: 'text',
  unit: '',
  unit_family: '',
  min: '',
  max: '',
  existing: [],
  newOptions: '',
  variant_forming: false,
  filterable: false,
  required: false,
  group: '',
});

const editorFor = (f: FieldDefinition): EditorState => ({
  mode: 'edit',
  field: f,
  en: f.label.en,
  ta: f.label.ta ?? '',
  hi: f.label.hi ?? '',
  type: f.type,
  unit: f.unit ?? '',
  unit_family: f.unit_family ?? '',
  min: f.min !== undefined ? String(f.min) : '',
  max: f.max !== undefined ? String(f.max) : '',
  existing: f.options.map((o) => ({ value: o.value, label: o.label.en, deprecated: o.deprecated })),
  newOptions: '',
  variant_forming: f.variant_forming,
  filterable: f.filterable,
  required: f.required,
  group: f.group ?? '',
});

const num = (s: string): number | undefined => (s.trim() === '' ? undefined : Number(s));

const FieldEditor: React.FC<{
  state: EditorState;
  onChange: (next: EditorState) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}> = ({ state, onChange, onCancel, onSave, saving }) => {
  const set = (patch: Partial<EditorState>) => onChange({ ...state, ...patch });
  /* A template field keeps its meaning: its type, unit, limits and variant
     setting are fixed. (A custom field in use is locked too — the server says
     so if it is.) */
  const locked = state.mode === 'edit' && state.field?.source === 'template';
  const isEnum = state.type === 'enum';

  /* New options are added one at a time (input + Add / Enter) and kept as lines in
     `newOptions`, so saving works as before — all of them in one Save. */
  const [draft, setDraft] = useState('');
  const [optionNote, setOptionNote] = useState<string | null>(null);
  const newList = state.newOptions.split('\n').map((x) => x.trim()).filter(Boolean);
  const addDraft = () => {
    const v = draft.trim();
    if (!v) return;
    const taken = [...state.existing.map((o) => o.label), ...newList].some((x) => x.toLowerCase() === v.toLowerCase());
    if (taken) {
      setOptionNote(`${v} is already in the list`);
      return;
    }
    set({ newOptions: [...newList, v].join('\n') });
    setDraft('');
    setOptionNote(null);
  };
  const removeNew = (v: string) => set({ newOptions: newList.filter((x) => x !== v).join('\n') });
  const isNumber = state.type === 'number';
  /* A number with a unit family is a measured size: it can form variants, even on
     a template field (the server refuses a change once products use it — 409). */
  const measured = isNumber && state.unit_family !== '';
  const familyUnits = state.unit_family ? UNITS_BY_FAMILY[state.unit_family] : [];
  const canVary = (isEnum && !locked) || measured;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label={state.mode === 'add' ? 'Add attribute' : 'Edit attribute'}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold">{state.mode === 'add' ? 'Add attribute' : `Edit “${state.field?.label.en}”`}</h2>
          {state.field && <code className="text-xs text-outline">{state.field.key}</code>}
        </div>

        <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <label className="sm:col-span-1">
            <span className="block font-medium mb-1">Name (English) *</span>
            <input aria-label="Name (English)" className={inputClass} value={state.en} maxLength={120} onChange={(e) => set({ en: e.target.value })} />
          </label>
          <label>
            <span className="block font-medium mb-1">Tamil</span>
            <input aria-label="Name (Tamil)" className={inputClass} value={state.ta} maxLength={120} onChange={(e) => set({ ta: e.target.value })} />
          </label>
          <label>
            <span className="block font-medium mb-1">Hindi</span>
            <input aria-label="Name (Hindi)" className={inputClass} value={state.hi} maxLength={120} onChange={(e) => set({ hi: e.target.value })} />
          </label>

          <label>
            <span className="block font-medium mb-1">Type</span>
            <select
              aria-label="Type"
              className={inputClass}
              disabled={locked}
              value={state.type}
              onChange={(e) => {
                const type = e.target.value as FieldType;
                /* Any choice list can be used for variants by default (R43). */
                set({ type, variant_forming: type === 'enum', ...(type !== 'number' ? { unit_family: '' as const } : {}) });
              }}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>

          {isNumber && (
            <>
              <label>
                <span className="block font-medium mb-1">Unit family</span>
                <select
                  aria-label="Unit family"
                  className={inputClass}
                  value={state.unit_family}
                  onChange={(e) => {
                    const family = e.target.value as UnitFamily | '';
                    if (!family) {
                      /* Without a family a number cannot form variants. */
                      set({ unit_family: '', variant_forming: false });
                      return;
                    }
                    const units = UNITS_BY_FAMILY[family];
                    /* Keep the unit if it belongs; otherwise use the family's base unit (unless the unit is fixed). */
                    const unit = units.includes(state.unit.trim().toLowerCase()) ? state.unit.trim().toLowerCase() : locked ? state.unit : units[0];
                    set({ unit_family: family, unit });
                  }}
                >
                  <option value="">None</option>
                  {(Object.keys(UNITS_BY_FAMILY) as UnitFamily[]).map((fam) => (
                    <option key={fam} value={fam}>
                      {UNIT_FAMILY_LABELS[fam]} ({UNITS_BY_FAMILY[fam].join(', ')})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="block font-medium mb-1">Unit</span>
                {measured ? (
                  <select aria-label="Unit" className={inputClass} disabled={locked} value={state.unit} onChange={(e) => set({ unit: e.target.value })}>
                    {!familyUnits.includes(state.unit) && <option value={state.unit}>{state.unit || '—'}</option>}
                    {familyUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input aria-label="Unit" className={inputClass} disabled={locked} placeholder="kg, GB, inch" value={state.unit} maxLength={20} onChange={(e) => set({ unit: e.target.value })} />
                )}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label>
                  <span className="block font-medium mb-1">Min</span>
                  <input aria-label="Min" type="number" className={inputClass} disabled={locked} value={state.min} onChange={(e) => set({ min: e.target.value })} />
                </label>
                <label>
                  <span className="block font-medium mb-1">Max</span>
                  <input aria-label="Max" type="number" className={inputClass} disabled={locked} value={state.max} onChange={(e) => set({ max: e.target.value })} />
                </label>
              </div>
            </>
          )}

          {measured && (
            <p className="sm:col-span-3 text-xs text-outline -mt-2">
              A measured size: products can sell it in several sizes (e.g. 500 ml, 1 l), each with its own price and stock, and show the price per unit.
            </p>
          )}

          <label className={isNumber ? 'sm:col-span-2' : 'sm:col-span-2'}>
            <span className="block font-medium mb-1">Group (form section)</span>
            <input aria-label="Group" className={inputClass} placeholder="e.g. specs" value={state.group} maxLength={60} onChange={(e) => set({ group: e.target.value })} />
          </label>

          {isEnum && (
            <div className="sm:col-span-3">
              <span className="block font-medium mb-1">Options</span>
              {state.existing.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-2">
                  {state.existing.map((o, i) => (
                    <li key={o.value}>
                      <button
                        type="button"
                        title={o.deprecated ? 'Retired — click to restore' : 'Click to retire'}
                        onClick={() => {
                          const existing = [...state.existing];
                          existing[i] = { ...o, deprecated: !o.deprecated };
                          set({ existing });
                        }}
                        className={`px-2 py-1 rounded-full border text-xs ${o.deprecated ? 'line-through text-outline border-slate-200' : 'border-slate-300'}`}
                      >
                        {o.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {newList.length > 0 && (
                <ul className="mb-2 flex flex-wrap gap-2" aria-label="New options">
                  {newList.map((v) => (
                    <li key={v} className="flex items-center gap-1 pl-2 pr-1 py-1 rounded-full border border-primary/40 bg-primary/5 text-xs text-primary">
                      {v}
                      <span className="text-[10px] uppercase font-semibold opacity-70">new</span>
                      <button type="button" aria-label={`Remove ${v}`} onClick={() => removeNew(v)} className="px-1 leading-none">
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  aria-label="New option"
                  className={inputClass}
                  placeholder="Type an option, then Add (or press Enter)"
                  value={draft}
                  maxLength={120}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setOptionNote(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDraft();
                    }
                  }}
                />
                <Button variant="outline" onClick={addDraft} disabled={!draft.trim()}>
                  Add
                </Button>
              </div>
              {optionNote && (
                <p className="text-xs text-error mt-1" role="alert">
                  {optionNote}
                </p>
              )}
              <p className="text-xs text-outline mt-1">Existing options can be retired (click) but not removed or renamed.</p>
            </div>
          )}

          <div className="sm:col-span-3 flex flex-wrap gap-5">
            <label
              className="flex items-center gap-2"
              title={
                measured
                  ? 'Products can be sold in several sizes of this (chosen on each product)'
                  : isNumber
                    ? 'Set a unit family first — then this number can be used for variants'
                    : !isEnum
                      ? 'Only choice lists, or numbers with a unit family, can be used for variants'
                      : 'Products can build their variants from this list (chosen on each product)'
              }
            >
              <input type="checkbox" aria-label="Can be used for variants" disabled={!canVary} checked={state.variant_forming} onChange={(e) => set({ variant_forming: e.target.checked })} />
              Can be used for variants
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" aria-label="Filterable" checked={state.filterable} onChange={(e) => set({ filterable: e.target.checked })} />
              Show as a filter
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" aria-label="Required" checked={state.required} onChange={(e) => set({ required: e.target.checked })} />
              Required
            </label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} loading={saving} disabled={!state.en.trim() || saving}>
            {state.mode === 'add' ? 'Add attribute' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------- page */

export default function AttributesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const navigate = useNavigate();

  const [type, setType] = useState<ProductType | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const load = async () => {
    setLoadError(null);
    try {
      setType(await productTypeService.get());
    } catch (e: any) {
      setLoadError(e.message || 'Could not load the attributes');
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const done = (next: ProductType, notice?: string, fallback?: string) => {
    setType(next);
    if (notice || fallback) setToast({ text: notice ?? fallback!, type: 'success' });
  };
  const fail = (e: any) => setToast({ text: e?.message || 'Something went wrong', type: 'error' });

  const saveEditor = async () => {
    if (!editor) return;
    setSaving(true);
    const label = {
      en: editor.en.trim(),
      ...(editor.ta.trim() ? { ta: editor.ta.trim() } : {}),
      ...(editor.hi.trim() ? { hi: editor.hi.trim() } : {}),
    };
    const added: OptionInput[] = editor.newOptions
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((en) => ({ label: { en } }));
    const isNumber = editor.type === 'number';
    try {
      if (editor.mode === 'add') {
        const input: FieldInput = {
          label,
          type: editor.type,
          ...(isNumber && editor.unit.trim() ? { unit: editor.unit.trim() } : {}),
          ...(isNumber && editor.unit_family ? { unit_family: editor.unit_family } : {}),
          ...(isNumber && num(editor.min) !== undefined ? { min: num(editor.min) } : {}),
          ...(isNumber && num(editor.max) !== undefined ? { max: num(editor.max) } : {}),
          ...(editor.type === 'enum' ? { options: added } : {}),
          variant_forming: editor.variant_forming,
          filterable: editor.filterable,
          required: editor.required,
          ...(editor.group.trim() ? { group: editor.group.trim() } : {}),
        };
        const { data, notice } = await productTypeService.addField(input);
        done(data, notice, `“${label.en}” added`);
      } else {
        const f = editor.field!;
        const patch: FieldPatch = {
          label,
          filterable: editor.filterable,
          required: editor.required,
          group: editor.group.trim() || null,
        };
        if (f.source === 'custom') {
          patch.type = editor.type;
          patch.variant_forming = editor.variant_forming;
          if (isNumber) {
            patch.unit = editor.unit.trim() || null;
            patch.min = num(editor.min) ?? null;
            patch.max = num(editor.max) ?? null;
          }
        }
        /* The unit family (and, with it, variants) may be set on a template number too (R45). */
        if (isNumber && (editor.unit_family || null) !== (f.unit_family ?? null)) patch.unit_family = editor.unit_family || null;
        if (isNumber && f.source === 'template' && editor.variant_forming !== f.variant_forming) patch.variant_forming = editor.variant_forming;
        if (editor.type === 'enum') {
          patch.options = [
            ...editor.existing.map((o) => ({ value: o.value, label: { en: o.label }, deprecated: o.deprecated })),
            ...added,
          ];
        }
        const { data, notice } = await productTypeService.updateField(f.key, patch);
        done(data, notice, `“${label.en}” saved`);
      }
      setEditor(null);
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  const toggleRetired = async (f: FieldDefinition) => {
    try {
      const { data } = await productTypeService.updateField(f.key, { deprecated: !f.deprecated });
      done(data, undefined, f.deprecated ? `“${f.label.en}” restored` : `“${f.label.en}” retired`);
    } catch (e) {
      fail(e);
    }
  };

  const move = async (index: number, delta: -1 | 1) => {
    if (!type) return;
    const keys = type.fields.map((f) => f.key);
    const target = index + delta;
    if (target < 0 || target >= keys.length) return;
    [keys[index], keys[target]] = [keys[target], keys[index]];
    try {
      done(await productTypeService.reorder(keys));
    } catch (e) {
      fail(e);
    }
  };

  const remove = async (f: FieldDefinition) => {
    if (!window.confirm(`Delete “${f.label.en}”? This cannot be undone.`)) return;
    try {
      done(await productTypeService.deleteField(f.key), undefined, `“${f.label.en}” deleted`);
    } catch (e) {
      fail(e);
    }
  };

  const upgrade = async () => {
    try {
      const { data, notice } = await productTypeService.upgrade();
      done(data, notice);
    } catch (e) {
      fail(e);
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full pb-10">
      <Toast message={toast} onDismiss={() => setToast(null)} />

      <header className="flex items-start justify-between gap-6 flex-wrap pt-1">
        <div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight">Attributes</h1>
          <p className="text-sm text-outline mt-0.5">
            {type
              ? `${type.name.en} · ${type.fields.length} attributes · version ${type.type_version}`
              : 'The fields every product form is built from.'}
          </p>
        </div>
        {type && isAdmin && (
          <Button variant="primary" onClick={() => setEditor(blankEditor())}>
            Add attribute
          </Button>
        )}
      </header>

      {loadError && (
        <div className="mt-5 flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200" role="alert">
          <p className="flex-1 text-sm text-error">{loadError}</p>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Retry
          </Button>
        </div>
      )}

      {!isAdmin && type && (
        <p className="mt-4 text-sm text-on-surface px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
          Read-only — only an Admin can change the attributes.
        </p>
      )}

      {type?.template_update_available && isAdmin && (
        <div className="mt-4 flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
          <p className="flex-1 text-sm">A newer version of the {type.name.en} template is available. Updating only adds fields and options.</p>
          <Button variant="outline" size="sm" onClick={() => void upgrade()}>
            Update template
          </Button>
        </div>
      )}

      {loaded && !loadError && !type && (
        <div className="mt-8 text-center py-12 rounded-xl border border-dashed border-slate-300" data-testid="attributes-empty">
          <Icon name="storefront" size="xl" />
          <p className="mt-3 text-sm text-on-surface">No business category yet.</p>
          <p className="text-sm text-outline">Choose one in Settings → Business & Products to load your product fields.</p>
          <div className="mt-4">
            <Button variant="primary" onClick={() => navigate('/settings')}>
              Go to Settings
            </Button>
          </div>
        </div>
      )}

      {type && (
        <div className="mt-5 bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm" aria-label="Attributes">
            <thead className="text-xs text-outline border-b border-slate-200">
              <tr>
                <th className="text-left font-medium px-4 py-2">Name</th>
                <th className="text-left font-medium px-4 py-2">Key</th>
                <th className="text-left font-medium px-4 py-2">Type</th>
                <th className="text-left font-medium px-4 py-2">Options</th>
                <th className="text-left font-medium px-4 py-2">Flags</th>
                <th className="text-left font-medium px-4 py-2">Source</th>
                {isAdmin && <th className="px-4 py-2" />}
              </tr>
            </thead>
            <tbody>
              {type.fields.map((f, i) => (
                <tr key={f.key} data-testid={`attr-${f.key}`} className={`border-b border-slate-100 ${f.deprecated ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-2">
                    <span className="font-medium">{f.label.en}</span>
                    {f.deprecated && <span className="ml-2 text-[10px] font-semibold uppercase text-outline">Retired</span>}
                    {(f.label.ta || f.label.hi) && (
                      <div className="text-xs text-outline">{[f.label.ta, f.label.hi].filter(Boolean).join(' · ')}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <code className="text-xs">{f.key}</code>
                    {f.source === 'template' && (
                      <span className="ml-1 material-symbols-outlined text-[14px] text-outline align-middle" title="Key and type are fixed">
                        lock
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {FIELD_TYPE_LABELS[f.type]}
                    {f.unit ? ` (${f.unit})` : ''}
                    {f.unit_family && <span className="block text-[11px] text-outline">Measured · {UNIT_FAMILY_LABELS[f.unit_family]}</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-outline max-w-[16rem] truncate" title={f.options.map((o) => o.label.en).join(', ')}>
                    {f.type === 'enum' ? (f.options.length ? f.options.map((o) => o.label.en).join(', ') : 'No options yet') : '—'}
                  </td>
                  <td className="px-4 py-2 text-xs whitespace-nowrap">
                    {[f.variant_forming && 'Variants', f.filterable && 'Filter', f.required && 'Required'].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                        f.source === 'template' ? 'bg-slate-100 text-outline' : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {f.source === 'template' ? 'Template' : 'Custom'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-2 whitespace-nowrap text-right">
                      <button type="button" aria-label={`Move ${f.label.en} up`} disabled={i === 0} onClick={() => void move(i, -1)} className="px-1 text-outline disabled:opacity-30">
                        ↑
                      </button>
                      <button type="button" aria-label={`Move ${f.label.en} down`} disabled={i === type.fields.length - 1} onClick={() => void move(i, 1)} className="px-1 text-outline disabled:opacity-30">
                        ↓
                      </button>
                      <button type="button" aria-label={`Edit ${f.label.en}`} onClick={() => setEditor(editorFor(f))} className="px-2 text-primary">
                        Edit
                      </button>
                      <button type="button" aria-label={`${f.deprecated ? 'Restore' : 'Retire'} ${f.label.en}`} onClick={() => void toggleRetired(f)} className="px-2 text-outline">
                        {f.deprecated ? 'Restore' : 'Retire'}
                      </button>
                      {f.source === 'custom' && (
                        <button type="button" aria-label={`Delete ${f.label.en}`} onClick={() => void remove(f)} className="px-2 text-error">
                          Delete
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editor && (
        <FieldEditor state={editor} onChange={setEditor} onCancel={() => setEditor(null)} onSave={() => void saveEditor()} saving={saving} />
      )}
    </div>
  );
}
