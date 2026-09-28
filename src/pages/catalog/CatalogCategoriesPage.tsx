import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Icon } from '../../components/common';
import {
  CommerceSummary,
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
import { CommerceConfigForm } from '../../components/catalog/forms';
import { catalogCategoryService, typeService } from '../../services/catalog.service';
import { CatalogCategory, CommerceConfig, ProductType } from '../../types/catalog.types';

/**
 * Catalog categories — the tree, and the commerce config products inherit.
 *
 * Commerce lives here rather than on a product because it describes how a
 * business sells a whole class of thing. "Cars are quoted on request with a
 * lead time" is true of every car; repeating it per product guarantees it will
 * eventually disagree with itself.
 */

interface TreeRow {
  category: CatalogCategory;
  depth: number;
}

/** Flattens the tree for rendering while keeping the parent order. */
const flatten = (rows: CatalogCategory[]): TreeRow[] => {
  const byParent = new Map<string, CatalogCategory[]>();
  for (const c of rows) {
    const key = c.parentId ?? '__root__';
    byParent.set(key, [...(byParent.get(key) ?? []), c]);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.name.localeCompare(b.name));

  const out: TreeRow[] = [];
  const walk = (parent: string, depth: number) => {
    for (const c of byParent.get(parent) ?? []) {
      out.push({ category: c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk('__root__', 0);

  /* Anything whose parent is missing would otherwise vanish from the tree.
     Surfacing it at the root is better than losing it silently. */
  const seen = new Set(out.map((r) => r.category.id));
  for (const c of rows) if (!seen.has(c.id)) out.push({ category: c, depth: 0 });

  return out;
};

export default function CatalogCategoriesPage(): JSX.Element {
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<CatalogCategory | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [commerce, setCommerce] = useState<CommerceConfig | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<CatalogCategory | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cats, ts] = await Promise.all([
        catalogCategoryService.list(showDeleted),
        typeService.list(),
      ]);
      setCategories(cats);
      setTypes(ts);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [showDeleted]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => flatten(categories), [categories]);
  const typeName = useMemo(() => new Map(types.map((t) => [t.id, t.name])), [types]);

  /** What a category would inherit if it declared nothing of its own. */
  const inheritedFor = useCallback(
    (parent: string | null | undefined): CommerceConfig | undefined => {
      const byId = new Map(categories.map((c) => [c.id, c]));
      let cursor = parent ?? null;
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor)) {
        seen.add(cursor);
        const node = byId.get(cursor);
        if (!node) break;
        if (node.commerce?.pricing?.model) return node.commerce;
        cursor = node.parentId ?? null;
      }
      return undefined;
    },
    [categories]
  );

  const openNew = (parent?: CatalogCategory) => {
    setEditing(null);
    setName('');
    setDescription('');
    setParentId(parent?.id ?? '');
    setTypeId('');
    setCommerce(null);
    setModal(true);
  };

  const openEdit = async (category: CatalogCategory) => {
    setBusy(true);
    try {
      const full = await catalogCategoryService.get(category.id);
      setEditing(full);
      setName(full.name);
      setDescription(full.description ?? '');
      setParentId(full.parentId ?? '');
      setTypeId(full.typeId ?? '');
      setCommerce(full.commerce ?? null);
      setModal(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        name,
        description,
        parentId: parentId || null,
        typeId: typeId || undefined,
        commerce: commerce ?? undefined,
      };

      if (editing) await catalogCategoryService.update(editing.id, body);
      else await catalogCategoryService.create(body);

      setModal(false);
      setNotice(editing ? 'Category updated.' : `Category "${name}" created.`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (category: CatalogCategory) => {
    setBusy(true);
    try {
      const { message } = await catalogCategoryService.restore(category.id);
      /* The server says so when the parent is still deleted, which leaves the
         row restored but unreachable in the tree — worth passing on verbatim. */
      setNotice(message || `"${category.name}" restored.`);
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
    setError(null);
    try {
      await catalogCategoryService.remove(confirmDelete.id);
      setNotice(`"${confirmDelete.name}" deleted — it can be restored.`);
      setConfirmDelete(null);
      await load();
    } catch (e: any) {
      /* Blocked by live children or live products; the message names which. */
      setError(e.message);
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  };

  /* A category cannot become its own descendant, so those options are removed
     from the parent picker rather than letting the server refuse the save. */
  const parentOptions = useMemo(() => {
    if (!editing) return rows;
    const banned = new Set<string>([editing.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const { category } of rows) {
        if (category.parentId && banned.has(category.parentId) && !banned.has(category.id)) {
          banned.add(category.id);
          grew = true;
        }
      }
    }
    return rows.filter((r) => !banned.has(r.category.id));
  }, [rows, editing]);

  if (loading) return <LoadingState label="Loading categories…" />;

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">Catalog Categories</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 max-w-3xl">
            A tree. Each node can declare <strong>how it sells</strong> — pricing and availability —
            and everything beneath it inherits that until one deliberately overrides it.
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
          <Button variant="primary" startIcon="add" onClick={() => openNew()} disabled={!types.length}>
            New category
          </Button>
        </div>
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <SuccessBanner message={notice} onDismiss={() => setNotice(null)} />

      {!types.length && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-tertiary-fixed/40 text-on-tertiary-fixed border border-tertiary/20 flex items-start gap-2.5">
          <Icon name="info" size="sm" className="mt-0.5 shrink-0" />
          <p className="text-sm">
            No product types exist yet. A category points at a type to decide what fields its
            products have — create one under <strong>Catalog Setup</strong> first.
          </p>
        </div>
      )}

      {!rows.length ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/40">
          <EmptyState
            icon="account_tree"
            title="No categories yet"
            description="Create a top-level category — Cars, Rooms, Treatments — and configure how that part of the business sells."
            action={
              types.length ? (
                <Button variant="primary" startIcon="add" onClick={() => openNew()}>
                  Create the first category
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-outline-variant/40 overflow-hidden">
          <div className="divide-y divide-outline-variant/40">
            {rows.map(({ category, depth }) => {
              const declares = Boolean(category.commerce?.pricing?.model);
              const effective = category.effectiveCommerce ?? category.commerce;
              const effType = category.effectiveTypeId ?? category.typeId;

              return (
                <div
                  key={category.id}
                  className={`px-4 py-3 flex items-center gap-3 transition-colors group ${
                    category.is_deleted
                      ? 'bg-surface-container-low/60 opacity-70'
                      : 'hover:bg-surface-container-low/60'
                  }`}
                  style={{ paddingLeft: `${16 + depth * 24}px` }}
                >
                  {depth > 0 && (
                    <Icon name="subdirectory_arrow_right" size="sm" color="outline" className="shrink-0 -ml-5" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-semibold truncate ${
                          category.is_deleted ? 'text-on-surface-variant line-through' : 'text-on-surface'
                        }`}
                      >
                        {category.name}
                      </span>
                      {category.is_deleted && (
                        <Badge variant="error" size="sm">
                          deleted
                        </Badge>
                      )}
                      {effType && (
                        <Badge variant="neutral" size="sm" icon="category">
                          {typeName.get(effType) ?? 'unknown type'}
                        </Badge>
                      )}
                      <Badge variant="outline" size="sm">
                        {category.productsCount ?? 0} product{category.productsCount === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    <div className="mt-1.5">
                      <CommerceSummary commerce={effective} inherited={!declares && Boolean(effective)} />
                    </div>
                  </div>

                  {category.is_deleted ? (
                    <Button size="sm" variant="ghost" startIcon="restore" onClick={() => restore(category)} disabled={busy}>
                      Restore
                    </Button>
                  ) : (
                  <div className="flex items-center gap-1 shrink-0 transition-opacity">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Add a subcategory"
                      onClick={() => openNew(category)}

                      startIcon="add"
                    />
                    <Button size="icon-sm" variant="ghost" title="Edit" onClick={() => openEdit(category)} startIcon="edit" />
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="Delete"
                      onClick={() => setConfirmDelete(category)}
                      startIcon="delete"
                    />
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Modal
        open={modal}
        title={editing ? `Edit ${editing.name}` : 'New category'}
        subtitle={editing ? undefined : 'Categories inherit commerce from their parent'}
        width="max-w-2xl"
        onClose={() => setModal(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={busy} disabled={!name.trim()}>
              {editing ? 'Save changes' : 'Create category'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Name" required>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sedans"
              autoFocus
            />
          </Field>

          <Field label="Description">
            <textarea
              className={inputClass}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Parent" hint="Leave empty for a top-level category">
              <select className={selectClass} value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">— none (top level) —</option>
                {parentOptions.map(({ category, depth }) => (
                  <option key={category.id} value={category.id}>
                    {' '.repeat(depth * 3)}
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Product type"
              hint={
                typeId
                  ? 'Products here use this type.'
                  : 'Leave empty to inherit from the parent.'
              }
            >
              <select className={selectClass} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                <option value="">— inherit —</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="pt-2 border-t border-outline-variant/40">
            <h4 className="text-xs font-bold text-on-surface uppercase tracking-wide mb-3">Commerce</h4>
            <CommerceConfigForm
              value={commerce}
              onChange={setCommerce}
              inherited={inheritedFor(parentId || null)}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title={`Delete "${confirmDelete?.name}"?`}
        danger
        busy={busy}
        confirmLabel="Delete category"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={remove}
        body={
          <p>
            A soft delete — the category keeps its id and can be restored. It is refused while it
            still has live subcategories or live products, and the message will say which.
          </p>
        }
      />
    </div>
  );
}
