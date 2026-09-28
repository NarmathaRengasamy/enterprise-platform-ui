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
  ValueListEditor,
} from '../../components/catalog/primitives';
import { typeService } from '../../services/catalog.service';
import {
  FIELD_TYPES,
  FieldDefinition,
  FieldType,
  MediaConfig,
  ProductType,
  VocabularyEntry,
} from '../../types/catalog.types';

/**
 * Catalog Setup — product types and their fields.
 *
 * The first screen of v2 and the prerequisite for every other one: a Category
 * points at a type, and a Product's entire form is built from the fields
 * declared here. Nothing else can be configured until this exists.
 */

interface DraftField {
  label: string;
  type: FieldType;
  options: string[];
  /**
   * Whether the values are decided per product instead of declared here.
   *
   * Kept separate from `options.length` on purpose. Empty options *is* how an
   * open list is stored, but it must not be how one is **chosen** — falling
   * into it by leaving a box blank is what turns a taxonomy into a pile of
   * free text. Here it takes a deliberate tick.
   */
  openList: boolean;
  variantForming: boolean;
  filterable: boolean;
  required: boolean;
}

const BLANK_FIELD: DraftField = {
  label: '',
  type: 'text',
  options: [],
  openList: false,
  variantForming: false,
  filterable: false,
  required: false,
};

/** A type with neither pictures nor videos. Both are opt-in. */
const NO_MEDIA: MediaConfig = { images: { enabled: false }, videos: { enabled: false } };

export default function CatalogSetupPage(): JSX.Element {
  const [types, setTypes] = useState<ProductType[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProductType | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  const [typeModal, setTypeModal] = useState(false);
  const [editingType, setEditingType] = useState<ProductType | null>(null);
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');
  const [media, setMedia] = useState<MediaConfig>(NO_MEDIA);

  const [fieldModal, setFieldModal] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftField>(BLANK_FIELD);

  const [confirm, setConfirm] = useState<{ kind: 'type' | 'field'; key?: string } | null>(null);

  /* Values in use for each open choice field, refreshed with the type. Used
     both to show how far a list has drifted and to promote it into a fixed
     one without retyping it. */
  const [vocabulary, setVocabulary] = useState<Record<string, VocabularyEntry[]>>({});
  const [promoting, setPromoting] = useState<FieldDefinition | null>(null);
  const [keep, setKeep] = useState<string[]>([]);

  const loadTypes = useCallback(async () => {
    try {
      const rows = await typeService.list(showDeleted);
      setTypes(rows);
      setSelectedId((current) => current ?? rows.find((t) => !t.is_deleted)?.id ?? null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [showDeleted]);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  /* Counts only — a failure here costs the promote panel, not the screen, so
     it deliberately does not raise an error banner. */
  const loadVocabulary = useCallback(async (typeId: string) => {
    try {
      setVocabulary(await typeService.vocabulary(typeId));
    } catch {
      setVocabulary({});
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setVocabulary({});
      return;
    }
    let cancelled = false;
    typeService
      .get(selectedId)
      .then((row) => {
        if (!cancelled) setDetail(row);
      })
      .catch((e) => !cancelled && setError(e.message));
    void loadVocabulary(selectedId);
    return () => {
      cancelled = true;
    };
  }, [selectedId, loadVocabulary]);

  const refresh = async () => {
    await loadTypes();
    if (selectedId) {
      setDetail(await typeService.get(selectedId));
      await loadVocabulary(selectedId);
    }
  };

  /* ------------------------------------------------------------- types */

  const openNewType = () => {
    setEditingType(null);
    setTypeName('');
    setTypeDescription('');
    setMedia(NO_MEDIA);
    setTypeModal(true);
  };

  const openEditType = () => {
    if (!detail) return;
    setEditingType(detail);
    setTypeName(detail.name);
    setTypeDescription(detail.description ?? '');
    setMedia(detail.media ?? NO_MEDIA);
    setTypeModal(true);
  };

  const saveType = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editingType) {
        /* The fields are managed individually below, and the id never
           changes. Everything else about the type is edited here. */
        await typeService.update(editingType.id, {
          name: typeName,
          description: typeDescription,
          media,
        });
        setTypeModal(false);
        setNotice('Type updated.');
        await refresh();
      } else {
        const created = await typeService.create({
          name: typeName,
          description: typeDescription,
          media,
        });
        setTypeModal(false);
        setSelectedId(created.id);
        setNotice(`Type "${created.name}" created. Add its fields next.`);
        await loadTypes();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const deleteType = async () => {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await typeService.remove(detail.id);
      setConfirm(null);
      setSelectedId(null);
      setNotice(`"${detail.name}" deleted. It can be restored from the deleted list.`);
      await loadTypes();
    } catch (e: any) {
      /* The 409 here is the useful one: it names how many products still use
         the type, which is exactly what the user needs to decide what to do. */
      setError(e.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const restoreType = async (id: string) => {
    setBusy(true);
    try {
      const restored = await typeService.restore(id);
      setNotice(`"${restored.name}" restored.`);
      await loadTypes();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------------------------------------ fields */

  const openNewField = () => {
    setEditingKey(null);
    setDraft(BLANK_FIELD);
    setFieldModal(true);
  };

  const openEditField = (field: FieldDefinition) => {
    setEditingKey(field.key);
    setDraft({
      label: field.label,
      type: field.type,
      options: field.options ?? [],
      /* Stored with no options *is* an open list — that is the only way it can
         be recorded. The tick just makes it visible and reversible. */
      openList: field.type === 'choice' && !(field.options ?? []).length,
      variantForming: Boolean(field.variantForming),
      filterable: Boolean(field.filterable),
      required: Boolean(field.required),
    });
    setFieldModal(true);
  };

  /* An open list is stored as no options at all — the tick is a UI concept,
     the absence of a list is what the server understands. */
  const fieldOptions = draft.openList ? [] : draft.options;

  const saveField = async () => {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      if (editingKey) {
        /* Key and type are immutable server-side, so they are not sent. */
        await typeService.updateField(detail.id, editingKey, {
          label: draft.label,
          options: draft.type === 'choice' ? fieldOptions : undefined,
          variantForming: draft.variantForming,
          filterable: draft.filterable,
          required: draft.required,
        });
      } else {
        const created = await typeService.addField(detail.id, {
          label: draft.label,
          type: draft.type,
          options: draft.type === 'choice' ? fieldOptions : undefined,
          variantForming: draft.variantForming,
          filterable: draft.filterable,
          required: draft.required,
        });
        /* A field added to a type that already has products is forced optional
           by the server. Saying so avoids a silent surprise on the next save. */
        const saved = created.fields.find((f) => f.label === draft.label.trim());
        if (draft.required && saved && !saved.required) {
          setNotice(
            `"${draft.label}" was added as optional — products already exist on this type, and making it required would invalidate them. Backfill the values, then mark it required.`
          );
        }
      }
      setFieldModal(false);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeField = async (key: string) => {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      const { message } = await typeService.removeField(detail.id, key);
      setConfirm(null);
      setNotice(message);
      await refresh();
    } catch (e: any) {
      setError(e.message);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  /* ------------------------------------------------ promote an open list */

  /**
   * Turns the values a field has accumulated into its declared list.
   *
   * This is the way out of an open list, and the reason having one is
   * defensible: you use it to discover what the values actually are, then you
   * make them official. Everything already stored keeps working, because the
   * list is built from what is stored.
   */
  const openPromote = (field: FieldDefinition) => {
    setPromoting(field);
    /* Everything ticked to start with. The point of the screen is to let you
       untick the typos, not to make you re-select the real values. */
    setKeep((vocabulary[field.key] ?? []).map((entry) => entry.value));
  };

  const promote = async () => {
    if (!detail || !promoting) return;
    setBusy(true);
    setError(null);
    try {
      await typeService.updateField(detail.id, promoting.key, { options: keep });
      setPromoting(null);
      setNotice(
        `"${promoting.label}" is now a fixed list of ${keep.length} value${keep.length === 1 ? '' : 's'}.`
      );
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleDeprecated = async (field: FieldDefinition) => {
    if (!detail) return;
    setBusy(true);
    try {
      await typeService.updateField(detail.id, field.key, { deprecated: !field.deprecated });
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const liveTypes = useMemo(() => types.filter((t) => !t.is_deleted), [types]);
  const deletedTypes = useMemo(() => types.filter((t) => t.is_deleted), [types]);

  const variantAxes = (detail?.fields ?? []).filter((f) => f.variantForming && !f.deprecated);
  /* An open axis has no declared values, so the product count is unknowable
     from here — it depends on what each product enters. */
  const openAxes = variantAxes.filter((f) => !(f.options ?? []).length);
  const fixedAxes = variantAxes.filter((f) => (f.options ?? []).length > 0);
  const combinations = fixedAxes.reduce((n, f) => n * Math.max(1, (f.options ?? []).length), 1);

  if (loading) return <LoadingState label="Loading catalog setup…" />;

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">Catalog Setup</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5 max-w-3xl">
            A <strong>type</strong> declares what fields a product has. Categories point at a type,
            and every product form is built from it — so this is where a new vertical starts.
          </p>
        </div>
        <Button variant="primary" startIcon="add" onClick={openNewType}>
          New type
        </Button>
      </header>

      <ErrorBanner message={error} onDismiss={() => setError(null)} />
      <SuccessBanner message={notice} onDismiss={() => setNotice(null)} />

      {!liveTypes.length && !deletedTypes.length ? (
        <div className="bg-surface rounded-2xl border border-outline-variant/40">
          <EmptyState
            icon="category"
            title="No product types yet"
            description="Start with the thing you sell — Vehicle, Room, Consultation, Apparel — then declare the fields that describe it."
            action={
              <Button variant="primary" startIcon="add" onClick={openNewType}>
                Create the first type
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5">
          {/* ------------------------------------------------ type list */}
          <aside className="space-y-2">
            {liveTypes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left px-3.5 py-3 rounded-xl border transition-all ${
                  selectedId === t.id
                    ? 'bg-primary-container border-primary/30 shadow-xs'
                    : 'bg-surface border-outline-variant/40 hover:bg-surface-container-low'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm font-semibold truncate ${
                      selectedId === t.id ? 'text-on-primary-container' : 'text-on-surface'
                    }`}
                  >
                    {t.name}
                  </span>
                  <Badge variant="outline" size="sm">
                    {t.fields?.length ?? 0}
                  </Badge>
                </div>
                {t.description && (
                  <p className="text-xs text-on-surface-variant mt-0.5 truncate">{t.description}</p>
                )}
              </button>
            ))}

            <label className="flex items-center gap-2 px-3.5 pt-3 cursor-pointer">
              <input
                type="checkbox"
                className="accent-primary"
                checked={showDeleted}
                onChange={(e) => setShowDeleted(e.target.checked)}
              />
              <span className="text-xs text-on-surface-variant">Show deleted</span>
            </label>

            {showDeleted &&
              deletedTypes.map((t) => (
                <div
                  key={t.id}
                  className="px-3.5 py-2.5 rounded-xl border border-dashed border-outline-variant/60 bg-surface-container-low flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-on-surface-variant line-through truncate">{t.name}</p>
                    <p className="text-[11px] text-on-surface-variant/70">
                      deleted {t.deletedAt ? new Date(t.deletedAt).toLocaleDateString() : ''}
                    </p>
                  </div>
                  <Button size="xs" variant="ghost" onClick={() => restoreType(t.id)} disabled={busy}>
                    Restore
                  </Button>
                </div>
              ))}
          </aside>

          {/* ---------------------------------------------- type detail */}
          <section className="bg-surface rounded-2xl border border-outline-variant/40 overflow-hidden">
            {!detail ? (
              <EmptyState icon="touch_app" title="Select a type" description="Pick a type on the left to edit its fields." />
            ) : (
              <>
                <div className="px-5 py-4 border-b border-outline-variant/40 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-on-surface">{detail.name}</h2>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      {detail.description || 'No description'} ·{' '}
                      <strong>{detail.productCount ?? 0}</strong> product
                      {detail.productCount === 1 ? '' : 's'} built from this
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" startIcon="add" onClick={openNewField}>
                      Add field
                    </Button>
                    <Button size="sm" variant="ghost" startIcon="edit" onClick={openEditType}>
                      Rename
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      startIcon="delete"
                      onClick={() => setConfirm({ kind: 'type' })}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {(detail.media?.images.enabled || detail.media?.videos.enabled) && (
                  <div className="px-5 py-3 bg-surface-container-low border-b border-outline-variant/40 flex items-center gap-2 flex-wrap">
                    <Icon name="photo_library" size="sm" color="primary" />
                    <span className="text-xs text-on-surface-variant">
                      {detail.media?.images.enabled && (
                        <>
                          Images <strong className="text-on-surface">on</strong>
                          {detail.media.images.required ? ' and required' : ' and optional'}
                        </>
                      )}
                      {detail.media?.images.enabled && detail.media?.videos.enabled && ' · '}
                      {detail.media?.videos.enabled && (
                        <>
                          Videos <strong className="text-on-surface">on</strong>
                        </>
                      )}
                    </span>
                    <span className="text-[11px] text-on-surface-variant/70">
                      (change under Rename)
                    </span>
                  </div>
                )}

                {variantAxes.length > 0 && (
                  <div className="px-5 py-3 bg-surface-container-low border-b border-outline-variant/40 flex items-center gap-2 flex-wrap">
                    <Icon name="grid_view" size="sm" color="primary" />
                    <span className="text-xs text-on-surface-variant">
                      <strong className="text-on-surface">{variantAxes.length}</strong> variant{' '}
                      {variantAxes.length === 1 ? 'axis' : 'axes'} →{' '}
                      {openAxes.length > 0 ? (
                        <>
                          combinations decided <strong className="text-on-surface">per product</strong>
                        </>
                      ) : (
                        <>
                          <strong className="text-on-surface">{combinations}</strong> possible
                          combination{combinations === 1 ? '' : 's'} per product
                        </>
                      )}
                    </span>
                    <span className="text-[11px] text-on-surface-variant/70">
                      ({variantAxes
                        .map((f) => f.label + (!(f.options ?? []).length ? ' (open)' : ''))
                        .join(' × ')})
                    </span>
                  </div>
                )}

                {!detail.fields?.length ? (
                  <EmptyState
                    icon="list_alt"
                    title="No fields yet"
                    description="Add the attributes that describe this thing. Mark a choice field as variant-forming to make it part of the combination grid."
                    action={
                      <Button variant="primary" startIcon="add" onClick={openNewField}>
                        Add the first field
                      </Button>
                    }
                  />
                ) : (
                  <div className="divide-y divide-outline-variant/40">
                    {detail.fields.map((f) => (
                      <div
                        key={f.key}
                        className={`px-5 py-3.5 flex items-start justify-between gap-4 ${
                          f.deprecated ? 'bg-surface-container-low/60' : ''
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-sm font-semibold ${
                                f.deprecated ? 'text-on-surface-variant line-through' : 'text-on-surface'
                              }`}
                            >
                              {f.label}
                            </span>
                            <code className="text-[11px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                              {f.key}
                            </code>
                            <Badge variant="neutral" size="sm">
                              {f.type}
                            </Badge>
                            {f.variantForming && (
                              <Badge variant="primary" size="sm" icon="grid_view">
                                variant axis
                              </Badge>
                            )}
                            {f.type === 'choice' && !f.options?.length && (
                              <Badge variant="tertiary" size="sm" icon="edit_note">
                                open list
                              </Badge>
                            )}
                            {f.filterable && (
                              <Badge variant="tertiary" size="sm" icon="filter_alt">
                                filter
                              </Badge>
                            )}
                            {f.required && (
                              <Badge variant="outline" size="sm">
                                required
                              </Badge>
                            )}
                            {f.deprecated && (
                              <Badge variant="error" size="sm">
                                retired
                              </Badge>
                            )}
                          </div>

                          {f.type === 'choice' && !f.options?.length ? (
                            <div className="mt-1.5">
                              <p className="text-[11px] text-on-surface-variant">
                                Open list — whoever creates a product types the values.
                              </p>

                              {(vocabulary[f.key] ?? []).length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                                  {(vocabulary[f.key] ?? []).slice(0, 8).map((entry) => (
                                    <span
                                      key={entry.value}
                                      className="px-1.5 py-0.5 rounded bg-surface-container text-[11px] text-on-surface-variant"
                                      title={`Used by ${entry.count} record${entry.count === 1 ? '' : 's'}`}
                                    >
                                      {entry.value}
                                      <span className="text-on-surface-variant/60"> ×{entry.count}</span>
                                    </span>
                                  ))}
                                  {(vocabulary[f.key] ?? []).length > 8 && (
                                    <span className="text-[11px] text-on-surface-variant/70">
                                      +{(vocabulary[f.key] ?? []).length - 8} more
                                    </span>
                                  )}
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    startIcon="playlist_add_check"
                                    onClick={() => openPromote(f)}
                                    disabled={f.deprecated}
                                  >
                                    Make this a fixed list
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : null}

                          {f.options?.length ? (
                            <div className="flex items-center gap-1 flex-wrap mt-1.5">
                              {f.options.map((o) => (
                                <span
                                  key={o}
                                  className="px-1.5 py-0.5 rounded bg-surface-container text-[11px] text-on-surface-variant"
                                >
                                  {o}
                                </span>
                              ))}
                            </div>
                          ) : null}

                          {f.deprecated && (
                            <p className="text-[11px] text-on-surface-variant mt-1.5">
                              Retired, not deleted — products keep the values they already hold.
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => toggleDeprecated(f)}
                            title={f.deprecated ? 'Bring this field back' : 'Retire this field'}
                            startIcon={f.deprecated ? 'restore' : 'visibility_off'}
                          />
                          <Button size="icon-sm" variant="ghost" onClick={() => openEditField(f)} title="Edit" startIcon="edit" />
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => setConfirm({ kind: 'field', key: f.key })}
                            title="Remove"
                            startIcon="delete"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {/* ---------------------------------------------------- type popup */}
      <Modal
        open={typeModal}
        title={editingType ? `Edit ${editingType.name}` : 'New product type'}
        subtitle={editingType ? 'Fields are managed on the list behind this' : 'What kind of thing is being sold?'}
        onClose={() => setTypeModal(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setTypeModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={saveType} loading={busy} disabled={!typeName.trim()}>
              {editingType ? 'Save changes' : 'Create type'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Name" required hint="Vehicle, Room, Consultation, Apparel…">
            <input
              className={inputClass}
              value={typeName}
              onChange={(e) => setTypeName(e.target.value)}
              placeholder="Vehicle"
              autoFocus
            />
          </Field>
          <Field label="Description">
            <textarea
              className={inputClass}
              rows={3}
              value={typeDescription}
              onChange={(e) => setTypeDescription(e.target.value)}
              placeholder="Cars, as a dealership configures them"
            />
          </Field>

          {/* Media is a property of the type, not of each product: every car
              gets pictures or none does. Deciding it once here is what lets
              the product form show an upload box at all. */}
          <div className="pt-1 border-t border-outline-variant/40 space-y-3">
            <p className="text-xs font-semibold text-on-surface-variant pt-3">Pictures and videos</p>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                checked={media.images.enabled}
                onChange={(e) =>
                  setMedia({
                    ...media,
                    images: e.target.checked
                      ? { ...media.images, enabled: true }
                      : { enabled: false, required: false },
                  })
                }
              />
              <span className="flex-1">
                <span className="text-sm font-medium text-on-surface block">Images</span>
                <span className="text-xs text-on-surface-variant">
                  Products get a gallery, and one image is picked as the listing thumbnail.
                </span>
              </span>
            </label>

            <label
              className={`flex items-start gap-2.5 pl-6 ${
                media.images.enabled ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                disabled={!media.images.enabled}
                checked={Boolean(media.images.required)}
                onChange={(e) =>
                  setMedia({ ...media, images: { ...media.images, required: e.target.checked } })
                }
              />
              <span className="flex-1">
                <span className="text-sm font-medium text-on-surface block">At least one required</span>
                <span className="text-xs text-on-surface-variant">
                  {(detail?.productCount ?? 0) > 0 && editingType
                    ? 'Existing products without an image keep working until they are next saved.'
                    : 'A product cannot be saved without a picture.'}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                checked={media.videos.enabled}
                onChange={(e) => setMedia({ ...media, videos: { enabled: e.target.checked } })}
              />
              <span className="flex-1">
                <span className="text-sm font-medium text-on-surface block">Videos</span>
                <span className="text-xs text-on-surface-variant">
                  Uploaded files or a YouTube / Vimeo link. Never used as the thumbnail.
                </span>
              </span>
            </label>
          </div>
        </div>
      </Modal>

      {/* --------------------------------------------------- field popup */}
      <Modal
        open={fieldModal}
        title={editingKey ? 'Edit field' : 'Add field'}
        subtitle={editingKey ? `Key "${editingKey}" cannot change` : undefined}
        onClose={() => setFieldModal(false)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setFieldModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={saveField}
              loading={busy}
              disabled={
                !draft.label.trim() ||
                /* A choice field with neither a list nor the tick is the
                   accident this whole block exists to prevent. */
                (draft.type === 'choice' && !draft.openList && !draft.options.length)
              }
            >
              {editingKey ? 'Save changes' : 'Add field'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field
            label="Label"
            required
            hint={
              editingKey
                ? 'Safe to rename — the underlying key stays the same, so no data is orphaned.'
                : 'The key is derived from this once, then fixed.'
            }
          >
            <input
              className={inputClass}
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="Colour"
              autoFocus
            />
          </Field>

          <Field
            label="Type"
            hint={editingKey ? 'Immutable once created.' : FIELD_TYPES.find((t) => t.value === draft.type)?.hint}
          >
            <select
              className={selectClass}
              value={draft.type}
              disabled={Boolean(editingKey)}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  type: e.target.value as FieldType,
                  /* Only a choice field can form variants, so switching away
                     has to clear the flag or the save is rejected. */
                  variantForming: e.target.value === 'choice' ? draft.variantForming : false,
                })
              }
            >
              {FIELD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          {draft.type === 'choice' && (
            <>
              <Field
                label="Options"
                required={!draft.openList}
                hint={
                  draft.openList
                    ? 'Not used while the values are decided per product.'
                    : 'A fixed list — matched case-insensitively and stored exactly as typed here.'
                }
              >
                <ValueListEditor
                  values={draft.options}
                  disabled={draft.openList}
                  onChange={(options) => setDraft({ ...draft, options })}
                  placeholder="Type an option and press Enter"
                />
              </Field>

              {/* The open case is a deliberate tick rather than an empty box.
                  Leaving a box blank is not a decision, and this one has
                  consequences that last as long as the catalogue does. */}
              <label className="flex items-start gap-2.5 cursor-pointer -mt-1">
                <input
                  type="checkbox"
                  className="mt-0.5 accent-primary"
                  checked={draft.openList}
                  onChange={(e) => setDraft({ ...draft, openList: e.target.checked })}
                />
                <span className="flex-1">
                  <span className="text-sm font-medium text-on-surface block">
                    Values decided per product
                  </span>
                  <span className="text-xs text-on-surface-variant">
                    For lists you cannot know upfront — shade names that differ per supplier,
                    storage sizes that differ per model. Prefer a fixed list when you can write
                    one: it validates, it keeps the filters bounded, and it can be ordered.
                  </span>
                </span>
              </label>

              {draft.openList && (
                <p className="text-xs text-on-surface-variant flex items-start gap-1.5 px-3 py-2 rounded-lg bg-surface-container -mt-1">
                  <Icon name="info" size="xs" className="mt-0.5 shrink-0" />
                  <span>
                    The product form offers a box to type into rather than fixed buttons.
                    Spellings already used are reused automatically, so <em>blue</em> becomes
                    {' '}<em>Blue</em> if that is what came first. Once the values settle you can
                    turn them into a fixed list from the field row, without retyping them.
                  </span>
                </p>
              )}
            </>
          )}

          <div className="space-y-2.5 pt-1">
            <label
              className={`flex items-start gap-2.5 ${
                draft.type === 'choice' ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
              }`}
            >
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                disabled={draft.type !== 'choice'}
                checked={draft.variantForming}
                onChange={(e) => setDraft({ ...draft, variantForming: e.target.checked })}
              />
              <span className="flex-1">
                <span className="text-sm font-medium text-on-surface block">Forms variants</span>
                <span className="text-xs text-on-surface-variant">
                  {draft.type === 'choice'
                    ? 'Part of the combination grid — Colour × Size produces one item each.'
                    : 'Only a choice field can do this: a free-text axis would make the combination count unbounded.'}
                </span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                checked={draft.filterable}
                onChange={(e) => setDraft({ ...draft, filterable: e.target.checked })}
              />
              <span className="flex-1">
                <span className="text-sm font-medium text-on-surface block">Filterable</span>
                <span className="text-xs text-on-surface-variant">Offered as a facet in the product list.</span>
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5 accent-primary"
                checked={draft.required}
                onChange={(e) => setDraft({ ...draft, required: e.target.checked })}
              />
              <span className="flex-1">
                <span className="text-sm font-medium text-on-surface block">Required</span>
                <span className="text-xs text-on-surface-variant">
                  {(detail?.productCount ?? 0) > 0 && !editingKey
                    ? `This type already has ${detail?.productCount} product(s), so a new required field is added as optional — making it required would invalidate them.`
                    : 'A product cannot be saved without a value.'}
                </span>
              </span>
            </label>
          </div>
        </div>
      </Modal>

      {/* ------------------------------------------------- promote popup */}
      <Modal
        open={Boolean(promoting)}
        title={`Make "${promoting?.label}" a fixed list`}
        subtitle="Built from the values already in use — nothing to retype"
        onClose={() => setPromoting(null)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setPromoting(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={promote} loading={busy} disabled={!keep.length}>
              Lock the list ({keep.length})
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">
            From now on the product form offers these as buttons instead of a text box, and
            anything else is rejected. Untick the typos and the one-offs.
          </p>

          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {(vocabulary[promoting?.key ?? ''] ?? []).map((entry) => {
              const ticked = keep.includes(entry.value);
              return (
                <label
                  key={entry.value}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${
                    ticked
                      ? 'border-outline-variant/50 bg-surface-container-lowest'
                      : 'border-outline-variant/30 bg-surface-container-low opacity-60'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-primary"
                    checked={ticked}
                    onChange={(e) =>
                      setKeep((current) =>
                        e.target.checked
                          ? [...current, entry.value]
                          : current.filter((v) => v !== entry.value)
                      )
                    }
                  />
                  <span className="flex-1 text-sm text-on-surface">{entry.value}</span>
                  <Badge variant={entry.count > 1 ? 'neutral' : 'outline'} size="sm">
                    {entry.count} record{entry.count === 1 ? '' : 's'}
                  </Badge>
                </label>
              );
            })}
          </div>

          {/* The consequence, stated before it is chosen rather than
              discovered later by a save that will not go through. */}
          {(vocabulary[promoting?.key ?? ''] ?? []).some((e) => !keep.includes(e.value)) && (
            <p className="text-xs text-on-surface-variant flex items-start gap-1.5 px-3 py-2 rounded-lg bg-surface-container">
              <Icon name="warning" size="xs" color="error" className="mt-0.5 shrink-0" />
              <span>
                Products holding an unticked value <strong>keep it</strong> — nothing is rewritten.
                But the next time someone edits one of them, this field will have to be answered
                from the new list. Untick only what you are prepared to correct.
              </span>
            </p>
          )}

          <p className="text-xs text-on-surface-variant flex items-start gap-1.5">
            <Icon name="info" size="xs" className="mt-0.5 shrink-0" />
            <span>
              Reversible: clear the options again on the field and it goes back to being an open
              list. The order here is the order the buttons appear in.
            </span>
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm?.kind === 'type'}
        title={`Delete "${detail?.name}"?`}
        danger
        busy={busy}
        confirmLabel="Delete type"
        onCancel={() => setConfirm(null)}
        onConfirm={deleteType}
        body={
          <>
            <p className="mb-2">
              This is a soft delete — the type keeps its id and can be restored. It is refused while
              any live product is still built from it.
            </p>
            {(detail?.productCount ?? 0) > 0 && (
              <p className="text-on-error">
                {detail?.productCount} product(s) currently use this type, so the delete will be
                refused until they are removed.
              </p>
            )}
          </>
        }
      />

      <ConfirmDialog
        open={confirm?.kind === 'field'}
        title="Remove this field?"
        danger
        busy={busy}
        confirmLabel="Remove field"
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.key && removeField(confirm.key)}
        body={
          <p>
            If any product holds a value for it, the field is <strong>retired</strong> rather than
            deleted and the data is kept. Only a field nothing has ever used is removed outright.
          </p>
        }
      />
    </div>
  );
}
