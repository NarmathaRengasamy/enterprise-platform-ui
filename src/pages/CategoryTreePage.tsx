import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLabels } from '../context/SiteSettingsContext';
import {
  Button,
  Icon,
  MetricsCard,
  SearchInput,
  Table,
  TableBody,
  TableCell,
  TableEmptyState,
  TableHead,
  TableHeadCell,
  TableRow,
  Toast,
  ToastMessage,
} from '../components/common';
import { IconPicker } from '../components/common/IconPicker';
import { CategoryIcon } from '../components/common/CategoryIcon';
import { catalogCategoryService } from '../services/catalogCategory.service';
import { productTypeService } from '../services/productType.service';
import type { ProductType, Translated } from '../types/productType.types';
import {
  CATEGORY_CODE_PATTERN,
  CategoryInput,
  CategoryList,
  CategoryNode,
  CategoryPatch,
  CategoryStats,
  CategoryStatus,
  MAX_CATEGORY_DEPTH,
} from '../types/catalogCategory.types';

/**
 * The new categories (Phase 2 / 2b), beside the current Categories screen
 * until the Phase 5 cut-over. Laid out like `CategoriesPage.tsx` — header,
 * KPI cards, toolbar, table, modal — and named from the renamable label.
 *
 * Flat by default: one sortable table. With the tree switched on (Settings →
 * Business & Products) categories nest up to five levels as indented rows, and
 * a sub-category inherits its parent's visible fields unless it sets its own
 * (design §3.2, R11–R15b). Visible fields sit under a collapsed "Advanced"
 * section (R12); categories set no fulfilment or tracking (R13). Product
 * counts and the KPI cards come from the new products (products_v2). The
 * server decides every rule; its 409 / 422 messages are shown as they come.
 */

const inputClass =
  'w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high ' +
  'focus:outline-none focus:border-primary text-sm disabled:opacity-50';
const labelClass = 'font-label-md text-label-md text-on-surface font-medium';
const menuItemClass =
  'w-full text-left flex items-center gap-2 px-3 py-1.5 text-on-surface font-body-sm text-body-sm hover:bg-surface-container-low transition-colors cursor-pointer';

type StatusFilter = 'all' | 'active' | 'hidden';
type SortBy = 'order' | 'name' | 'newest';

/** The server's own words: field messages when it sent them, else its message. */
const serverText = (e: any): string =>
  (e?.fieldErrors && Object.values(e.fieldErrors).join(' · ')) || e?.message || 'Something went wrong';

/* ------------------------------------------------------------ tree helpers */

interface Located {
  node: CategoryNode;
  depth: number;
}

/** Every node by id with its level (a top-level category is 1). */
const indexTree = (roots: CategoryNode[]) => {
  const byId = new Map<string, Located>();
  const walk = (nodes: CategoryNode[], depth: number) => {
    for (const node of nodes) {
      byId.set(node.id, { node, depth });
      walk(node.children, depth + 1);
    }
  };
  walk(roots, 1);
  return byId;
};

const liveChildren = (node: CategoryNode) => node.children.filter((c) => !c.is_deleted);

const descendantIds = (node: CategoryNode): Set<string> => {
  const out = new Set<string>();
  const walk = (n: CategoryNode) =>
    n.children.forEach((c) => {
      out.add(c.id);
      walk(c);
    });
  walk(node);
  return out;
};

/** Levels in a node's own live subtree: a leaf is 1. */
const heightOf = (node: CategoryNode): number => {
  const kids = liveChildren(node);
  return 1 + (kids.length ? Math.max(...kids.map(heightOf)) : 0);
};

/** Same match as the export: code or any name, ignoring case. */
const matchesSearch = (node: CategoryNode, q: string) =>
  !q || [node.code, node.name.en, node.name.ta, node.name.hi].some((s) => s?.toLowerCase().includes(q));

/** Keeps matching nodes and the path down to them; `matched` holds the real matches. */
const filterTree = (nodes: CategoryNode[], keep: (n: CategoryNode) => boolean, matched: Set<string>): CategoryNode[] =>
  nodes.flatMap((n) => {
    const children = filterTree(n.children, keep, matched);
    const hit = keep(n);
    if (hit) matched.add(n.id);
    return hit || children.length ? [{ ...n, children }] : [];
  });

const COMPARE: Record<SortBy, ((a: CategoryNode, b: CategoryNode) => number) | null> = {
  order: null, // the server's order: sort_order within each parent
  name: (a, b) => a.name.en.localeCompare(b.name.en),
  newest: (a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''),
};

/** Sorts siblings; children always stay under their parent. */
const sortTree = (nodes: CategoryNode[], by: SortBy): CategoryNode[] => {
  const compare = COMPARE[by];
  if (!compare) return nodes;
  return [...nodes].sort(compare).map((n) => ({ ...n, children: sortTree(n.children, by) }));
};

const countLive = (nodes: CategoryNode[], status?: CategoryStatus): number =>
  nodes.reduce(
    (sum, n) => sum + (!n.is_deleted && (!status || n.status === status) ? 1 : 0) + countLive(n.children, status),
    0
  );

/* ----------------------------------------------------------------- editor */

interface EditorState {
  mode: 'add' | 'edit';
  id?: string;
  code: string;
  en: string;
  ta: string;
  hi: string;
  description: string;
  /** The description's other languages, kept as they are when editing. */
  descriptionRest: Omit<Translated, 'en'>;
  parent_id: string | null;
  icon: string;
  color: string;
  status: CategoryStatus;
  inheritFields: boolean;
  fieldKeys: string[];
  /** The Advanced section (visible fields) is expanded. */
  advancedOpen: boolean;
  /** It was opened at least once — only then are visible fields sent on save. */
  advancedTouched: boolean;
}

const blankEditor = (parent_id: string | null = null): EditorState => ({
  mode: 'add',
  code: '',
  en: '',
  ta: '',
  hi: '',
  description: '',
  descriptionRest: {},
  parent_id,
  icon: '',
  color: '',
  status: 'active',
  inheritFields: true,
  fieldKeys: [],
  advancedOpen: false,
  advancedTouched: false,
});

const editorFor = (c: CategoryNode): EditorState => {
  const { en: description = '', ...descriptionRest } = c.description ?? { en: '' };
  return {
    mode: 'edit',
    id: c.id,
    code: c.code,
    en: c.name.en,
    ta: c.name.ta ?? '',
    hi: c.name.hi ?? '',
    description,
    descriptionRest,
    parent_id: c.orphan ? null : c.parent_id,
    icon: c.icon === 'category' ? '' : c.icon,
    color: c.color,
    status: c.status,
    inheritFields: c.visible_field_keys.length === 0,
    fieldKeys: c.visible_field_keys,
    advancedOpen: false,
    advancedTouched: false,
  };
};

interface Inherited {
  from: string;
  keys: string[];
}

/** The overlay + card the Categories page uses for its modals. */
const Modal: React.FC<{ label: string; wide?: boolean; children: React.ReactNode }> = ({ label, wide, children }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-150"
    role="dialog"
    aria-modal="true"
    aria-label={label}
  >
    <div
      className={`relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto border border-surface-container-high p-6 flex flex-col gap-4`}
    >
      {children}
    </div>
  </div>
);

const ModalHeader: React.FC<{ icon: string; title: string; onClose: () => void; aside?: React.ReactNode }> = ({
  icon,
  title,
  onClose,
  aside,
}) => (
  <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
    <div className="flex items-center gap-2">
      <Icon name={icon} size="lg" color="primary" />
      <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">{title}</h2>
      {aside}
    </div>
    <Button variant="ghost" size="icon-sm" startIcon="close" onClick={onClose} aria-label="Close modal" />
  </div>
);

const ModalError: React.FC<{ text: string | null }> = ({ text }) =>
  text ? (
    <div className="p-3 rounded-xl bg-error-container/40 border border-error/20 flex items-center gap-2 text-error text-xs font-medium">
      <Icon name="error" size="sm" />
      {/* The alert is the message alone, so it reads exactly as the server sent it. */}
      <span role="alert">{text}</span>
    </div>
  ) : null;

const CategoryEditor: React.FC<{
  title: string;
  saveLabel: string;
  state: EditorState;
  onChange: (next: EditorState) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
  treeMode: boolean;
  attributes: { key: string; label: string }[];
  inherited: Inherited;
  parentChoices: { id: string; label: string }[];
}> = ({ title, saveLabel, state, onChange, onCancel, onSave, saving, error, treeMode, attributes, inherited, parentChoices }) => {
  const set = (patch: Partial<EditorState>) => onChange({ ...state, ...patch });
  /* Tamil / Hindi as an Advanced option (like the product form): closed by default,
     open when the category already has one, the count shows what is filled. */
  const [langOpen, setLangOpen] = React.useState(Boolean(state.ta.trim() || state.hi.trim()));
  const langFilled = [state.ta, state.hi].filter((t) => t.trim()).length;
  const code = state.code.trim().toLowerCase();
  const codeInvalid = state.mode === 'add' && code !== '' && !CATEGORY_CODE_PATTERN.test(code);
  const canSave =
    !saving && state.en.trim() !== '' && (state.mode === 'edit' || (code !== '' && !codeInvalid)) &&
    (state.inheritFields || state.fieldKeys.length > 0);
  const labelOf = (key: string) => attributes.find((a) => a.key === key)?.label ?? key;
  const ownFields = !state.inheritFields && state.fieldKeys.length > 0;
  const toggleKey = (key: string) =>
    set({ fieldKeys: state.fieldKeys.includes(key) ? state.fieldKeys.filter((k) => k !== key) : [...state.fieldKeys, key] });

  return (
    <Modal label={title} wide>
      <ModalHeader
        icon="category"
        title={title}
        onClose={onCancel}
        aside={state.mode === 'edit' ? <code className="text-xs text-outline">{state.code}</code> : undefined}
      />
      <ModalError text={error} />

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) onSave();
        }}
      >
        {state.mode === 'add' && (
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="cat-code">Code *</label>
            <input
              id="cat-code"
              aria-label="Code"
              className={inputClass}
              placeholder="e.g. t-shirts"
              value={state.code}
              maxLength={60}
              onChange={(e) => set({ code: e.target.value })}
            />
            <span className={`text-xs ${codeInvalid ? 'text-error' : 'text-on-surface-variant'}`}>
              2–60 characters: lowercase letters, digits, “-” or “_”. It cannot be changed later.
            </span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="cat-en">Name (English) *</label>
            <input id="cat-en" aria-label="Name (English)" className={inputClass} value={state.en} maxLength={120} onChange={(e) => set({ en: e.target.value })} />
          </div>
          <button
            type="button"
            aria-expanded={langOpen}
            aria-controls="cat-other-languages"
            onClick={() => setLangOpen((o) => !o)}
            className="flex items-center gap-1 text-sm font-medium text-primary self-start"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {langOpen ? 'expand_more' : 'chevron_right'}
            </span>
            Advanced · Other languages{langFilled ? ` (${langFilled})` : ''}
          </button>
          {langOpen && (
            <div id="cat-other-languages" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelClass} htmlFor="cat-ta">Tamil</label>
                <input id="cat-ta" aria-label="Name (Tamil)" className={inputClass} value={state.ta} maxLength={120} onChange={(e) => set({ ta: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass} htmlFor="cat-hi">Hindi</label>
                <input id="cat-hi" aria-label="Name (Hindi)" className={inputClass} value={state.hi} maxLength={120} onChange={(e) => set({ hi: e.target.value })} />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelClass} htmlFor="cat-desc">Description</label>
          <textarea
            id="cat-desc"
            aria-label="Description"
            rows={3}
            className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary resize-none text-sm"
            value={state.description}
            maxLength={120}
            onChange={(e) => set({ description: e.target.value })}
          />
        </div>

        {state.mode === 'add' && treeMode && (
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="cat-parent">Parent</label>
            <select
              id="cat-parent"
              aria-label="Parent"
              className={inputClass}
              value={state.parent_id ?? ''}
              onChange={(e) => set({ parent_id: e.target.value || null })}
            >
              <option value="">Top level</option>
              {parentChoices.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <span className={labelClass}>Icon</span>
            {/* Picked from lucide-react (saved as "lucide:<name>"); older typed names still show. */}
            <IconPicker value={state.icon} color={/^#[0-9a-f]{6}$/i.test(state.color) ? state.color : undefined} onChange={(icon) => set({ icon })} />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="cat-color">Colour</label>
            <div className="flex gap-2">
              <input
                type="color"
                aria-label="Pick colour"
                className="h-10 w-11 rounded-xl border border-surface-container-high bg-surface-container-low"
                value={/^#[0-9a-f]{6}$/i.test(state.color) ? state.color : '#64748b'}
                onChange={(e) => set({ color: e.target.value })}
              />
              <input id="cat-color" aria-label="Colour" className={inputClass} placeholder="#64748b" value={state.color} maxLength={30} onChange={(e) => set({ color: e.target.value })} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelClass} htmlFor="cat-status">Status</label>
            <select id="cat-status" aria-label="Status" className={inputClass} value={state.status} onChange={(e) => set({ status: e.target.value as CategoryStatus })}>
              <option value="active">Active</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
        </div>

        <div className="border-t border-surface-container-low pt-3">
          <button
            type="button"
            aria-expanded={state.advancedOpen}
            aria-controls="category-advanced"
            onClick={() => set({ advancedOpen: !state.advancedOpen, advancedTouched: true })}
            className="flex items-center gap-1 text-sm font-medium text-primary"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              {state.advancedOpen ? 'expand_more' : 'chevron_right'}
            </span>
            {ownFields ? `Advanced · ${state.fieldKeys.length} ${state.fieldKeys.length === 1 ? 'field' : 'fields'}` : 'Advanced'}
          </button>
        </div>

        {state.advancedOpen && (
          <fieldset id="category-advanced" className="text-sm">
            <legend className={`${labelClass} mb-1`}>Visible fields</legend>
            <p className="text-xs text-on-surface-variant mb-1">Limit which attributes products in this category show.</p>
            <label className="flex items-start gap-2 py-1">
              <input
                type="radio"
                name="visible-fields"
                aria-label="Inherit visible fields"
                checked={state.inheritFields}
                onChange={() => set({ inheritFields: true })}
              />
              <span>
                Inherit from {inherited.from}
                <span className="block text-xs text-on-surface-variant" data-testid="inherited-fields">
                  {inherited.keys.length ? inherited.keys.map(labelOf).join(', ') : 'No attributes yet'}
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 py-1">
              <input
                type="radio"
                name="visible-fields"
                aria-label="Only these fields"
                disabled={attributes.length === 0}
                checked={!state.inheritFields}
                onChange={() => set({ inheritFields: false, fieldKeys: state.fieldKeys.length ? state.fieldKeys : inherited.keys })}
              />
              Only these fields
            </label>
            {!state.inheritFields && (
              <div className="ml-6 mt-1 flex flex-wrap gap-x-5 gap-y-1">
                {attributes.map((a) => (
                  <label key={a.key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded accent-primary"
                      aria-label={`Show ${a.label}`}
                      checked={state.fieldKeys.includes(a.key)}
                      onChange={() => toggleKey(a.key)}
                    />
                    {a.label}
                  </label>
                ))}
                {state.fieldKeys.length === 0 && <p className="w-full text-xs text-error">Pick at least one, or inherit.</p>}
              </div>
            )}
            {attributes.length === 0 && (
              <p className="text-xs text-on-surface-variant mt-1">Choose a business category in Settings to limit the visible fields.</p>
            )}
          </fieldset>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
          <Button variant="ghost" size="md" type="button" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            type="submit"
            disabled={!canSave}
            startIcon={saving ? <Icon name="sync" spin size="sm" /> : undefined}
          >
            {saving ? 'Saving...' : saveLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

/* --------------------------------------------------------------- move to */

const MoveDialog: React.FC<{
  node: CategoryNode;
  choices: { id: string; label: string }[];
  onCancel: () => void;
  onMove: (parentId: string | null) => void;
  saving: boolean;
}> = ({ node, choices, onCancel, onMove, saving }) => {
  const [target, setTarget] = useState(node.orphan ? '' : (node.parent_id ?? ''));
  return (
    <Modal label={`Move ${node.name.en}`}>
      <ModalHeader icon="drive_file_move" title={`Move “${node.name.en}” to…`} onClose={onCancel} />
      <p className="text-xs text-on-surface-variant">
        Its sub-categories move with it. It cannot go under itself or one of its own sub-categories.
      </p>
      <select aria-label="New parent" className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">Top level</option>
        {choices.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
        <Button variant="ghost" size="md" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button variant="primary" size="md" disabled={saving} onClick={() => onMove(target || null)}>
          {saving ? 'Moving...' : 'Move'}
        </Button>
      </div>
    </Modal>
  );
};

/* ------------------------------------------------------------------ page */

interface Row {
  node: CategoryNode;
  depth: number;
}

export default function CategoryTreePage() {
  const label = useLabels();
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const canEdit = isAdmin || user?.role === 'Editor';
  const navigate = useNavigate();
  const singular = label.singular('categories');
  const plural = label.plural('categories');

  const [list, setList] = useState<CategoryList | null>(null);
  const [type, setType] = useState<ProductType | null>(null);
  /* The product-based KPI cards (Phase 3: counted from the new products). */
  const [stats, setStats] = useState<CategoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  /* Toolbar */
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('order');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  /* Table */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState<null | 'delete' | 'status'>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  /* Modals */
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [moving, setMoving] = useState<CategoryNode | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<CategoryNode | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setIsFilterOpen(false);
    };
    if (isFilterOpen) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [isFilterOpen]);

  /* Escape closes an open row menu, as well as a click outside it. */
  useEffect(() => {
    if (!openDropdownId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenDropdownId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openDropdownId]);

  const load = useCallback(async (withDeleted: boolean) => {
    setLoadError(null);
    try {
      const [l, t, st] = await Promise.all([
        catalogCategoryService.list(withDeleted),
        productTypeService.get(),
        /* The figures are a nicety: the list still shows if they fail. */
        catalogCategoryService.stats().catch(() => null),
      ]);
      setList(l);
      setType(t);
      setStats(st);
    } catch (e: any) {
      setLoadError(e.message || `Could not load the ${label.lower('categories')}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load(showDeleted);
  }, [load, showDeleted]);

  const reload = () => load(showDeleted);

  const treeMode = list?.mode === 'tree';
  const index = useMemo(() => indexTree(list?.categories ?? []), [list]);
  const attributes = useMemo(
    () => (type?.fields ?? []).filter((f) => !f.deprecated).map((f) => ({ key: f.key, label: f.label.en })),
    [type]
  );

  const q = debouncedSearch.trim().toLowerCase();
  const filtering = q !== '' || statusFilter !== 'all';
  /* Rows that really match; ancestors kept only for the path are shown dimmed. */
  const { shown, matched } = useMemo(() => {
    const hits = new Set<string>();
    const roots = list?.categories ?? [];
    const kept = filtering
      ? filterTree(roots, (n) => matchesSearch(n, q) && (statusFilter === 'all' || n.status === statusFilter), hits)
      : roots;
    return { shown: sortTree(kept, sortBy), matched: hits };
  }, [list, q, statusFilter, sortBy, filtering]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (nodes: CategoryNode[], depth: number) =>
      nodes.forEach((node) => {
        out.push({ node, depth });
        if (filtering || !collapsed.has(node.id)) walk(node.children, depth + 1);
      });
    walk(shown, 1);
    return out;
  }, [shown, collapsed, filtering]);

  /* Reordering needs the stored order and the full list of siblings on screen. */
  const reorderable = canEdit && sortBy === 'order' && !filtering;
  const selectable = rows.filter((r) => !r.node.is_deleted && (!filtering || matched.has(r.node.id)));
  const isAllSelected = selectable.length > 0 && selectable.every((r) => selectedIds.includes(r.node.id));
  const isSomeSelected = selectedIds.length > 0 && !isAllSelected;

  const total = countLive(list?.categories ?? []);
  const hiddenCount = countLive(list?.categories ?? [], 'hidden');

  const labelWithPath = (id: string): string => {
    const parts: string[] = [];
    for (let at = index.get(id); at; at = at.node.parent_id && !at.node.orphan ? index.get(at.node.parent_id) : undefined) {
      parts.unshift(at.node.name.en);
    }
    return parts.join(' › ');
  };

  /** Live categories a node (or a new one, `self` = null) may sit under. */
  const parentChoices = (self: CategoryNode | null) => {
    const excluded = self ? descendantIds(self).add(self.id) : new Set<string>();
    const height = self ? heightOf(self) : 1;
    return [...index.values()]
      .filter(({ node, depth }) => !node.is_deleted && !excluded.has(node.id) && depth + height <= MAX_CATEGORY_DEPTH)
      .map(({ node }) => ({ id: node.id, label: labelWithPath(node.id) }));
  };

  /** What a category gets when it sets nothing itself. */
  const inheritedFor = (parentId: string | null): Inherited => {
    const parent = treeMode && parentId ? index.get(parentId)?.node : undefined;
    if (parent) return { from: `“${parent.name.en}”`, keys: parent.resolved_visible_field_keys };
    return { from: 'the business (all attributes)', keys: attributes.map((a) => a.key) };
  };

  const siblingsOf = (node: CategoryNode): CategoryNode[] => {
    const parent = node.parent_id && !node.orphan ? index.get(node.parent_id)?.node : undefined;
    return (parent ? parent.children : (list?.categories ?? [])).filter((c) => !c.is_deleted && !c.orphan);
  };

  const fail = (e: any, prefix = '') => setToast({ text: `${prefix}${serverText(e)}`, type: 'error' });
  const done = async (text: string) => {
    setToast({ text, type: 'success' });
    await reload();
  };

  /* ------------------------------------------------------------ actions */

  const handleRefresh = () => {
    setIsRefreshing(true);
    void reload();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await catalogCategoryService.exportCsv({
        search: debouncedSearch.trim() || undefined,
        status: statusFilter,
        include_deleted: showDeleted,
      });
      setToast({ text: `${plural} exported successfully.`, type: 'success' });
    } catch (e: any) {
      setToast({ text: `Export failed: ${e.message || 'Unknown error'}`, type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  const openAdd = (parentId: string | null = null) => {
    setFormError(null);
    setOpenDropdownId(null);
    setEditor(blankEditor(parentId));
  };
  const openEdit = (node: CategoryNode) => {
    setFormError(null);
    setOpenDropdownId(null);
    setEditor(editorFor(node));
  };

  const saveEditor = async () => {
    if (!editor) return;
    setSaving(true);
    setFormError(null);
    const name: Translated = {
      en: editor.en.trim(),
      ...(editor.ta.trim() ? { ta: editor.ta.trim() } : {}),
      ...(editor.hi.trim() ? { hi: editor.hi.trim() } : {}),
    };
    const common: CategoryPatch = {
      name,
      ...(editor.description.trim() ? { description: { ...editor.descriptionRest, en: editor.description.trim() } } : {}),
      /* Advanced never opened: leave the category's visible fields as they are. */
      ...(editor.mode === 'add' || editor.advancedTouched
        ? { visible_field_keys: editor.inheritFields ? [] : editor.fieldKeys }
        : {}),
      icon: editor.icon.trim() || 'category',
      color: editor.color.trim(),
      status: editor.status,
    };
    try {
      if (editor.mode === 'add') {
        const input: CategoryInput = {
          ...common,
          name,
          code: editor.code.trim().toLowerCase(),
          ...(treeMode && editor.parent_id ? { parent_id: editor.parent_id } : {}),
        };
        await catalogCategoryService.create(input);
        setEditor(null);
        await done(`${singular} “${name.en}” created successfully.`);
      } else {
        await catalogCategoryService.update(editor.id!, common);
        setEditor(null);
        await done(`${singular} “${name.en}” updated successfully.`);
      }
    } catch (e) {
      /* Keep the modal open with the server's reason, so nothing typed is lost. */
      setFormError(serverText(e));
    } finally {
      setSaving(false);
    }
  };

  const move = async (node: CategoryNode, delta: -1 | 1) => {
    setOpenDropdownId(null);
    const ids = siblingsOf(node).map((s) => s.id);
    const from = ids.indexOf(node.id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    const parentId = node.parent_id && !node.orphan ? node.parent_id : null;
    try {
      await catalogCategoryService.reorder(parentId, ids);
      await reload();
    } catch (e) {
      fail(e);
    }
  };

  const moveTo = async (parentId: string | null) => {
    if (!moving) return;
    setSaving(true);
    try {
      await catalogCategoryService.update(moving.id, { parent_id: parentId });
      const where = parentId ? `under “${index.get(parentId)?.node.name.en}”` : 'to the top level';
      setMoving(null);
      await done(`“${moving.name.en}” moved ${where}`);
    } catch (e) {
      fail(e);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const node = deleteConfirm;
    setIsDeleting(true);
    try {
      await catalogCategoryService.remove(node.id);
      setSelectedIds((prev) => prev.filter((id) => id !== node.id));
      setDeleteConfirm(null);
      await done(`${singular} “${node.name.en}” deleted — it can be restored from Show deleted.`);
    } catch (e) {
      setDeleteConfirm(null);
      fail(e, 'Cannot delete: ');
    } finally {
      setIsDeleting(false);
    }
  };

  const restore = async (node: CategoryNode) => {
    setOpenDropdownId(null);
    try {
      await catalogCategoryService.restore(node.id);
      await done(`${singular} “${node.name.en}” restored`);
    } catch (e) {
      fail(e, 'Cannot restore: ');
    }
  };

  /** Runs one call per selected row; failures stay selected and are reported by name. */
  const runBulk = async (kind: 'delete' | 'status', call: (id: string) => Promise<unknown>, ids: string[], verb: string) => {
    setBulkBusy(kind);
    const failed: { id: string; text: string }[] = [];
    for (const id of ids) {
      try {
        await call(id);
      } catch (e) {
        failed.push({ id, text: `${index.get(id)?.node.name.en ?? id}: ${serverText(e)}` });
      }
    }
    const okCount = ids.length - failed.length;
    setSelectedIds(failed.map((f) => f.id));
    setToast(
      failed.length
        ? { text: `${verb} ${okCount} of ${ids.length}. Not changed — ${failed.map((f) => f.text).join('; ')}`, type: okCount ? 'warning' : 'error' }
        : { text: `${verb} ${okCount} ${okCount === 1 ? label.lowerSingular('categories') : label.lower('categories')}.`, type: 'success' }
    );
    setBulkBusy(null);
    await reload();
  };

  const bulkDelete = () => {
    if (!window.confirm(`Delete ${selectedIds.length} selected ${label.lower('categories')}? They can be restored from Show deleted.`)) return;
    /* Deepest first, so a parent selected with its children is not refused. */
    const ids = [...selectedIds].sort((a, b) => (index.get(b)?.depth ?? 0) - (index.get(a)?.depth ?? 0));
    void runBulk('delete', (id) => catalogCategoryService.remove(id), ids, 'Deleted');
  };

  const bulkStatus = (status: CategoryStatus) =>
    void runBulk('status', (id) => catalogCategoryService.update(id, { status }), selectedIds, status === 'active' ? 'Activated' : 'Hid');

  const toggleCollapsed = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const filterButtonLabel =
    statusFilter === 'active' ? 'Active' : statusFilter === 'hidden' ? 'Hidden' : sortBy === 'name' ? 'Name A-Z' : sortBy === 'newest' ? 'Newest' : 'Filter';

  /* ------------------------------------------------------------ render */

  const renderRow = ({ node, depth }: Row, idx: number) => {
    const name = node.name.en;
    const deleted = !!node.is_deleted;
    const context = filtering && !matched.has(node.id); // kept only to show the path
    const siblings = deleted || node.orphan ? [] : siblingsOf(node);
    const position = siblings.findIndex((s) => s.id === node.id);
    const canReorder = reorderable && !deleted && !node.orphan && siblings.length > 1;
    const hasChildren = node.children.length > 0;
    const open = filtering || !collapsed.has(node.id);
    const canAddChild = canEdit && !deleted && treeMode && depth < MAX_CATEGORY_DEPTH && !node.orphan;
    const canMove = canEdit && !deleted && treeMode;
    const canDelete = isAdmin && !deleted;
    const hasMenu = canReorder || canAddChild || canMove || canDelete;
    const isSelected = selectedIds.includes(node.id);
    const isBottomRows = idx >= Math.max(0, rows.length - 2);
    const fieldsNote = node.visible_field_keys.length
      ? `${node.resolved_visible_field_keys.length} fields`
      : node.resolved_visible_field_keys.length === attributes.length
        ? 'all fields'
        : `${node.resolved_visible_field_keys.length} fields (inherited)`;

    return (
      <TableRow
        key={node.id}
        selected={isSelected}
        className={`group ${deleted || context ? 'opacity-60' : ''}`}
        data-testid={`cat-${node.code}${deleted ? '-deleted' : ''}`}
        aria-level={treeMode ? depth : undefined}
      >
        <TableCell>
          <div className="flex items-center gap-3" style={treeMode ? { paddingLeft: `${(depth - 1) * 1.5}rem` } : undefined}>
            <input
              className="w-4 h-4 rounded text-primary accent-primary cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              type="checkbox"
              aria-label={`Select ${name}`}
              checked={isSelected}
              disabled={deleted || context}
              onChange={() =>
                setSelectedIds((prev) => (prev.includes(node.id) ? prev.filter((i) => i !== node.id) : [...prev, node.id]))
              }
            />
            {treeMode && (
              <button
                type="button"
                aria-label={`${open ? 'Collapse' : 'Expand'} ${name}`}
                aria-expanded={hasChildren ? open : undefined}
                disabled={!hasChildren}
                onClick={() => toggleCollapsed(node.id)}
                className="w-5 text-outline disabled:invisible"
              >
                <span className="material-symbols-outlined text-base">{open ? 'expand_more' : 'chevron_right'}</span>
              </button>
            )}
            <div
              className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0"
              style={node.color ? { color: node.color } : undefined}
            >
              <CategoryIcon value={node.icon === 'category' ? '' : node.icon} size={20} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-title-sm text-title-sm text-on-surface font-semibold group-hover:text-primary transition-colors truncate">
                {name}
              </span>
              <span className="font-caption text-caption text-on-surface-variant">
                {node.code}
                {[node.name.ta, node.name.hi].filter(Boolean).map((t) => ` • ${t}`).join('')} • {fieldsNote}
                {node.orphan && (
                  <span
                    className="ml-2 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-50 text-amber-700"
                    title="Its parent is missing or deleted — move it or restore the parent"
                  >
                    Parent missing
                  </span>
                )}
              </span>
            </div>
          </div>
        </TableCell>
        <TableCell className="text-on-surface-variant max-w-xs">
          <span className="truncate block">{node.description?.en || '—'}</span>
        </TableCell>
        <TableCell>
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm bg-primary-fixed/30 text-on-primary-fixed font-semibold"
            title={`${label.plural('allProducts')} filed in this ${label.lowerSingular('categories')}`}
            data-testid={`product-count-${node.code}`}
          >
            <Icon name="inventory" size="xs" />
            <span>{node.product_count ?? 0}</span>
          </div>
        </TableCell>
        <TableCell>
          {deleted ? (
            <span className="text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full bg-error-container/40 text-error">Deleted</span>
          ) : node.status === 'hidden' ? (
            <span className="text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface-variant">Hidden</span>
          ) : (
            <span className="text-[11px] font-semibold uppercase px-2.5 py-1 rounded-full bg-secondary-fixed/30 text-secondary">Active</span>
          )}
        </TableCell>
        <TableCell className="w-28 text-right whitespace-nowrap relative">
          <div className="inline-flex items-center justify-end gap-1.5">
            {canEdit && !deleted && (
              <Button variant="ghost" size="icon-sm" startIcon="edit" onClick={() => openEdit(node)} title={`Edit ${singular}`} aria-label={`Edit ${name}`} />
            )}
            {isAdmin && deleted && (
              <Button variant="ghost" size="icon-sm" startIcon="restore_from_trash" onClick={() => void restore(node)} title={`Restore ${singular}`} aria-label={`Restore ${name}`} />
            )}
            {hasMenu && (
              <div className="relative inline-block text-left">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  startIcon="more_horiz"
                  onClick={() => setOpenDropdownId(openDropdownId === node.id ? null : node.id)}
                  aria-label={`More actions for ${name}`}
                />
                {openDropdownId === node.id && (
                  <>
                    <div className="fixed inset-0 z-20 cursor-default" onClick={() => setOpenDropdownId(null)} />
                    <div
                      role="menu"
                      className={`absolute right-0 ${
                        isBottomRows ? 'bottom-full mb-1.5 origin-bottom-right' : 'top-full mt-1.5 origin-top-right'
                      } w-52 bg-surface-container-lowest rounded-xl shadow-2xl z-30 py-1.5 border border-surface-container-high animate-in fade-in zoom-in-95`}
                    >
                      {canReorder && (
                        <>
                          <button type="button" role="menuitem" aria-label={`Move ${name} up`} disabled={position <= 0} onClick={() => void move(node, -1)} className={`${menuItemClass} disabled:opacity-40`}>
                            <Icon name="arrow_upward" size="sm" color="outline" />
                            Move up
                          </button>
                          <button type="button" role="menuitem" aria-label={`Move ${name} down`} disabled={position === siblings.length - 1} onClick={() => void move(node, 1)} className={`${menuItemClass} disabled:opacity-40`}>
                            <Icon name="arrow_downward" size="sm" color="outline" />
                            Move down
                          </button>
                        </>
                      )}
                      {canAddChild && (
                        <button type="button" role="menuitem" aria-label={`Add sub-category to ${name}`} onClick={() => openAdd(node.id)} className={menuItemClass}>
                          <Icon name="subdirectory_arrow_right" size="sm" color="outline" />
                          Add sub-category
                        </button>
                      )}
                      {canMove && (
                        <button
                          type="button"
                          role="menuitem"
                          aria-label={`Move ${name} to another parent`}
                          onClick={() => {
                            setOpenDropdownId(null);
                            setMoving(node);
                          }}
                          className={menuItemClass}
                        >
                          <Icon name="drive_file_move" size="sm" color="outline" />
                          Move to…
                        </button>
                      )}
                      {canDelete && (
                        <>
                          {(canReorder || canAddChild || canMove) && <div className="h-px bg-surface-container-high my-1" />}
                          <button
                            type="button"
                            role="menuitem"
                            aria-label={`Delete ${name}`}
                            onClick={() => {
                              setOpenDropdownId(null);
                              setDeleteConfirm(node);
                            }}
                            className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-error font-body-sm text-body-sm hover:bg-error-container/30 transition-colors cursor-pointer"
                          >
                            <Icon name="delete" size="sm" color="error" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      <Toast message={toast} onDismiss={() => setToast(null)} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div className="flex flex-col">
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">{plural}</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5" data-testid="category-summary">
            {list ? `${treeMode ? 'Tree' : 'Flat list'} · ` : ''}Organize and classify {label.lower('allProducts')} across channels
          </p>
        </div>
        <div className="flex items-center gap-space-xs flex-wrap">
          <Button variant="hover" size="md" startIcon="arrow_back" onClick={() => navigate('/v2/products')}>
            Back to {label.plural('allProducts')}
          </Button>
          {canEdit && (
            <Button
              variant="soft"
              size="md"
              startIcon={isExporting ? <Icon name="sync" spin size="sm" /> : 'download'}
              onClick={() => void handleExport()}
              disabled={isExporting}
            >
              {isExporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          )}
          {canEdit && list && (
            <Button variant="primary" size="md" startIcon="add" onClick={() => openAdd()}>
              Add {singular}
            </Button>
          )}
        </div>
      </div>

      {/* KPI cards, like the Categories page — counted from the new products */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg" data-testid="category-kpis">
        <MetricsCard
          title={`Total ${plural}`}
          value={total}
          subtitle={`${total - hiddenCount} active · ${hiddenCount} hidden`}
          icon="category"
          variant="primary"
        />
        <MetricsCard
          title="Assigned SKUs"
          value={stats?.assigned_skus ?? '—'}
          subtitle={stats ? `${stats.categorised_products} ${label.lower('allProducts')} in ${label.lower('categories')}` : 'Figures unavailable'}
          icon="inventory_2"
          variant="secondary"
        />
        <MetricsCard
          title="Top Distribution"
          value={stats?.top_distribution ? stats.top_distribution.name.en : stats ? 'None' : '—'}
          subtitle={
            stats?.top_distribution
              ? `${stats.top_distribution.percentage}% of ${label.lower('allProducts')} in ${label.lower('categories')}`
              : `No ${label.lower('allProducts')} in ${label.lower('categories')} yet`
          }
          icon="devices"
          variant="neutral"
        />
        <MetricsCard
          title="Inventory Density"
          value={stats ? `${stats.average_per_category} avg/cat` : '—'}
          subtitle={`${label.plural('allProducts')} per ${label.lowerSingular('categories')}`}
          icon="analytics"
          variant="tertiary"
        />
      </div>

      {loadError && (
        <div className="mb-4 p-4 rounded-xl bg-error-container/40 border border-error/20 flex items-center justify-between" role="alert">
          <div className="flex items-center gap-3 text-error">
            <Icon name="error" size="md" />
            <span className="text-sm font-medium">{loadError}</span>
          </div>
          <Button variant="danger" size="sm" onClick={() => void reload()}>
            Retry
          </Button>
        </div>
      )}

      {list && !canEdit && (
        <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-sm text-on-surface">
          <Icon name="visibility" size="md" />
          <span>Read-only — only an Admin or Editor can change the {label.lower('categories')}.</span>
        </div>
      )}

      {/* The flat-list hint ("… are a flat list. To add sub-categories …") is not shown (Oct 2026); the tree is switched on in Settings → Business & Products. */}

      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-low/60 flex flex-col relative">
        {/* Toolbar */}
        <div className="p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm bg-surface-container-lowest rounded-t-xl">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${label.lower('categories')} by name or code...`}
            aria-label={`Search ${label.lower('categories')}`}
          />

          <div className="flex items-center gap-space-xs self-end sm:self-auto relative">
            <label className="flex items-center gap-2 text-xs font-medium text-on-surface-variant mr-1 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-primary"
                checked={showDeleted}
                onChange={(e) => {
                  setSelectedIds([]);
                  setShowDeleted(e.target.checked);
                }}
              />
              Show deleted
            </label>

            <div className="relative" ref={filterRef}>
              <Button
                variant={isFilterOpen || statusFilter !== 'all' || sortBy !== 'order' ? 'soft' : 'hover'}
                size="md"
                startIcon="filter_list"
                endIcon="expand_more"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                aria-label="Filter and sort"
                aria-expanded={isFilterOpen}
              >
                {filterButtonLabel}
              </Button>

              {isFilterOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl shadow-2xl z-50 py-1.5 border border-slate-200 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10.5px] font-bold text-outline uppercase tracking-wider">Filter By Status</div>
                  {[
                    { id: 'all' as const, text: `All ${plural}` },
                    { id: 'active' as const, text: 'Active' },
                    { id: 'hidden' as const, text: 'Hidden' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={statusFilter === item.id}
                      onClick={() => {
                        setStatusFilter(item.id);
                        setSelectedIds([]);
                        setIsFilterOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        statusFilter === item.id ? 'bg-primary/10 text-primary font-semibold' : 'text-on-surface hover:bg-slate-50'
                      }`}
                    >
                      <span>{item.text}</span>
                      {statusFilter === item.id && <Icon name="check" size="sm" color="primary" />}
                    </button>
                  ))}

                  <div className="h-px bg-slate-100 my-1" />

                  <div className="px-3 py-1.5 text-[10.5px] font-bold text-outline uppercase tracking-wider">Sort By</div>
                  {[
                    { id: 'order' as const, text: 'Sort order' },
                    { id: 'name' as const, text: 'Name (A to Z)' },
                    { id: 'newest' as const, text: 'Newest first' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={sortBy === item.id}
                      onClick={() => {
                        setSortBy(item.id);
                        setIsFilterOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        sortBy === item.id ? 'bg-primary/10 text-primary font-semibold' : 'text-on-surface hover:bg-slate-50'
                      }`}
                    >
                      <span>{item.text}</span>
                      {sortBy === item.id && <Icon name="check" size="sm" color="primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="hover"
              size="icon"
              startIcon={isRefreshing ? <Icon name="refresh" spin color="primary" size="md" /> : 'refresh'}
              onClick={handleRefresh}
              title={`Reload ${label.lower('categories')}`}
              aria-label={`Reload ${label.lower('categories')}`}
            />
          </div>
        </div>

        {/* Bulk action bar */}
        {canEdit && selectedIds.length > 0 && (
          <div className="px-space-md py-2 bg-primary-container/10 border-y border-primary/20 flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Icon name="check_circle" size="sm" color="primary" />
              <span>
                {selectedIds.length} {selectedIds.length === 1 ? label.lowerSingular('categories') : label.lower('categories')} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="soft" size="sm" startIcon="visibility" onClick={() => bulkStatus('active')} disabled={!!bulkBusy}>
                Set Active
              </Button>
              <Button variant="soft" size="sm" startIcon="visibility_off" onClick={() => bulkStatus('hidden')} disabled={!!bulkBusy}>
                {bulkBusy === 'status' ? 'Updating...' : 'Set Hidden'}
              </Button>
              {isAdmin && (
                <Button
                  variant="danger"
                  size="sm"
                  startIcon={bulkBusy === 'delete' ? <Icon name="sync" spin size="xs" /> : 'delete'}
                  onClick={bulkDelete}
                  disabled={!!bulkBusy}
                >
                  {bulkBusy === 'delete' ? 'Deleting...' : 'Delete Selected'}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                Clear Selection
              </Button>
            </div>
          </div>
        )}

        <Table aria-label={plural}>
          <TableHead>
            <tr>
              <TableHeadCell>
                <div className="flex items-center gap-2">
                  {canEdit && (
                    <input
                      className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                      type="checkbox"
                      aria-label="Select all"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={() => setSelectedIds(isAllSelected ? [] : selectable.map((r) => r.node.id))}
                      title={isAllSelected ? 'Deselect all' : 'Select all'}
                    />
                  )}
                  <span>Name</span>
                </div>
              </TableHeadCell>
              <TableHeadCell>Description</TableHeadCell>
              <TableHeadCell>{label.plural('allProducts')}</TableHeadCell>
              <TableHeadCell>Status</TableHeadCell>
              <TableHeadCell className="w-28 text-right">
                <div className="flex items-center justify-end w-full">Actions</div>
              </TableHeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx} data-testid="category-loading-row">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded bg-surface-container-high animate-pulse" />
                      <div className="w-9 h-9 rounded-lg bg-surface-container-high animate-pulse" />
                      <div className="flex flex-col gap-1.5">
                        <div className="w-28 h-4 rounded bg-surface-container-high animate-pulse" />
                        <div className="w-16 h-3 rounded bg-surface-container-high animate-pulse" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="w-48 h-3.5 rounded bg-surface-container-high animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="w-8 h-4 rounded bg-surface-container-high animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="w-14 h-6 rounded-full bg-surface-container-high animate-pulse" />
                  </TableCell>
                  <TableCell className="w-28 text-right whitespace-nowrap">
                    <div className="flex justify-end">
                      <div className="w-16 h-8 rounded bg-surface-container-high animate-pulse" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableEmptyState
                icon="category"
                title={`No ${label.lower('categories')} found`}
                description={
                  q
                    ? `No ${label.lower('categories')} matched "${debouncedSearch.trim()}". Try a different keyword.`
                    : filtering
                      ? 'Nothing matches this filter.'
                      : canEdit
                        ? `Get started by creating your first ${label.lowerSingular('categories')}, or create the starter ones from Settings.`
                        : `No ${label.lower('categories')} yet.`
                }
                colSpan={5}
              />
            ) : (
              rows.map(renderRow)
            )}
          </TableBody>
        </Table>
      </div>

      {editor && (
        <CategoryEditor
          title={editor.mode === 'add' ? `Add New ${singular}` : `Edit ${singular}`}
          saveLabel={editor.mode === 'add' ? `Save ${singular}` : `Update ${singular}`}
          state={editor}
          onChange={setEditor}
          onCancel={() => setEditor(null)}
          onSave={() => void saveEditor()}
          saving={saving}
          error={formError}
          treeMode={treeMode}
          attributes={attributes}
          inherited={inheritedFor(editor.parent_id)}
          parentChoices={parentChoices(null)}
        />
      )}

      {moving && (
        <MoveDialog node={moving} choices={parentChoices(moving)} onCancel={() => setMoving(null)} onMove={(p) => void moveTo(p)} saving={saving} />
      )}

      {deleteConfirm && (
        <Modal label={`Delete ${deleteConfirm.name.en}`}>
          <div className="flex items-center gap-3 text-error">
            <div className="w-10 h-10 rounded-xl bg-error-container/50 flex items-center justify-center shrink-0">
              <Icon name="warning" size="lg" color="error" />
            </div>
            <div className="flex flex-col">
              <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Delete {singular}</h3>
              <span className="text-xs text-on-surface-variant">It can be restored from Show deleted.</span>
            </div>
          </div>
          <p className="text-sm text-on-surface">
            Are you sure you want to delete {label.lowerSingular('categories')} <strong>"{deleteConfirm.name.en}"</strong> ({deleteConfirm.code})?
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
            <Button variant="ghost" size="md" onClick={() => setDeleteConfirm(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={() => void confirmDelete()}
              disabled={isDeleting}
              startIcon={isDeleting ? <Icon name="sync" spin size="sm" /> : 'delete'}
            >
              {isDeleting ? 'Deleting...' : `Delete ${singular}`}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
