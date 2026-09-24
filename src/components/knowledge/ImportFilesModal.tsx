import React, { useMemo, useRef, useState } from 'react';
import { knowledgeApi, productsApi, categoriesApi, ApiError } from '../../api';
import type { KbFolder } from '../../api';
import { useApi } from '../../hooks/useApi';
import { Button, ErrorBanner } from '../common';

interface ImportFilesModalProps {
  open: boolean;
  onClose: () => void;
  /** Called once anything imported successfully, so the list can reload. */
  onUploaded: () => void;
  /** The folder being viewed, pre-selected as the destination. '' is the root. */
  defaultFolderId?: string;
}

type Outcome = 'queued' | 'uploading' | 'done' | 'failed';

interface Item {
  name: string;
  sizeBytes: number;
  status: Outcome;
  percent: number;
  error?: string;
  /** Set for a picked file; absent for the server-generated catalog row. */
  file?: File;
}

type Source = 'files' | 'catalog';
type Template = 'qa' | 'reference';

const MAX_BYTES = 25 * 1024 * 1024;

const formatSize = (bytes: number): string => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

/**
 * Import Knowledge Base Articles.
 *
 * Two sources: files from this machine, or markdown generated from the catalog
 * already in this platform. The destination is chosen here — the root of the
 * knowledge base, or any folder, including one created on the spot.
 */
export default function ImportFilesModal({
  open,
  onClose,
  onUploaded,
  defaultFolderId = '',
}: ImportFilesModalProps) {
  const [source, setSource] = useState<Source>('files');

  /* Where this import lands. Empty is the root of the knowledge base — there is
     no configured folder any more, the choice is made here each time. */
  /* Defaults to the folder the page is showing — importing while inside a
     folder should land there, not at the root. Still changeable below. */
  const [destinationId, setDestinationId] = useState(defaultFolderId);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isSavingFolder, setIsSavingFolder] = useState(false);

  const [items, setItems] = useState<Item[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  /* Option B selections */
  const [includeProducts, setIncludeProducts] = useState(true);
  const [includeCategories, setIncludeCategories] = useState(true);
  const [template, setTemplate] = useState<Template>('qa');

  /* Counts come from the catalog itself — the "generates N docs" line has to be
     true, so nothing here is a fixed number. */
  const productsState = useApi(() => productsApi.list({ limit: 100 }), [], { enabled: open });
  const categoriesState = useApi(() => categoriesApi.list(), [], { enabled: open });
  const foldersState = useApi(() => knowledgeApi.listFolders(), [], { enabled: open });

  const folders: KbFolder[] = foldersState.data?.folders ?? [];
  const destinationName =
    folders.find((f) => f.id === destinationId)?.name ?? 'Root level';

  const products = productsState.data?.data ?? [];
  const categories = categoriesState.data?.data ?? [];
  const productCount = includeProducts ? products.length : 0;
  const categoryCount = includeCategories ? categories.length : 0;
  const generatedCount = productCount + categoryCount;

  const catalogLoading = productsState.loading || categoriesState.loading;

  /* Re-syncs when the dialog is reopened somewhere else in the tree. */
  React.useEffect(() => {
    if (open) setDestinationId(defaultFolderId);
  }, [open, defaultFolderId]);

  if (!open) return null;

  const addFiles = (incoming: FileList | null) => {
    if (!incoming?.length) return;
    setError('');

    const accepted: Item[] = [];
    const rejected: string[] = [];
    Array.from(incoming).forEach((file) => {
      /* Checked here as well as on the server, so nobody waits on an upload that
         was always going to be refused. */
      if (file.size > MAX_BYTES) {
        rejected.push(`${file.name} (${formatSize(file.size)})`);
        return;
      }
      if (file.size === 0) {
        rejected.push(`${file.name} (empty)`);
        return;
      }
      accepted.push({ name: file.name, sizeBytes: file.size, status: 'queued', percent: 0, file });
    });

    if (rejected.length) {
      setError(`Skipped — files must be under ${formatSize(MAX_BYTES)}: ${rejected.join(', ')}`);
    }
    setItems((prev) => [...prev, ...accepted]);
  };

  const runQueue = async (queue: Item[]) => {
    setItems(queue);
    setIsImporting(true);
    let anySucceeded = false;

    for (let index = 0; index < queue.length; index += 1) {
      const item = queue[index];
      setItems((prev) =>
        prev.map((it, i) =>
          i === index ? { ...it, status: 'uploading', percent: 0, error: undefined } : it
        )
      );

      try {
        if (item.file) {
          await knowledgeApi.uploadFile(item.file, destinationId || undefined, (percent) =>
            setItems((prev) => prev.map((it, i) => (i === index ? { ...it, percent } : it)))
          );
        }
        anySucceeded = true;
        setItems((prev) =>
          prev.map((it, i) => (i === index ? { ...it, status: 'done', percent: 100 } : it))
        );
      } catch (err) {
        /* One failure must not abandon the rest of the queue. */
        const message = err instanceof ApiError ? err.message : 'Import failed.';
        setItems((prev) =>
          prev.map((it, i) => (i === index ? { ...it, status: 'failed', error: message } : it))
        );
      }
    }

    setIsImporting(false);
    if (anySucceeded) onUploaded();
  };

  const handleImport = async () => {
    setError('');
    if (source === 'files') {
      const pending = items.filter((i) => i.status !== 'done');
      if (!pending.length) return;
      await runQueue(items.filter((i) => i.status !== 'done'));
      return;
    }
    if (!generatedCount) {
      setError('Select at least one source to generate from.');
      return;
    }

    /* The document is compiled on the server: it has the whole catalogue, the
       browser would only ever see one page of it, and which fields are left out
       is not the client's decision to make. */
    setIsImporting(true);
    setItems([
      { name: 'product-catalog.md', sizeBytes: 0, status: 'uploading', percent: 0 },
    ]);
    try {
      const result = await knowledgeApi.generateCatalog({
        ...(destinationId ? { folderId: destinationId } : {}),
        includeProducts,
        includeCategories,
        template,
        /* Without this a re-import stacks another copy and the agent answers
           from whichever it happens to match. */
        replaceExisting: true,
      });
      setItems([
        {
          name: result.file.name,
          sizeBytes: result.sizeBytes,
          status: 'done',
          percent: 100,
        },
      ]);
      onUploaded();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not generate the catalog.';
      setItems([
        { name: 'product-catalog.md', sizeBytes: 0, status: 'failed', percent: 0, error: message },
      ]);
      setError(message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      setError('Enter a name for the new folder.');
      return;
    }
    setError('');
    setIsSavingFolder(true);
    try {
      const result = await knowledgeApi.createFolder({ name });
      /* Selected straight away: someone creating a folder mid-import wants to
         import into it. */
      setDestinationId(result.folder.id);
      setNewFolderName('');
      setIsCreatingFolder(false);
      foldersState.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the folder.');
    } finally {
      setIsSavingFolder(false);
    }
  };

  const close = () => {
    if (isImporting) return;
    setItems([]);
    setError('');
    setIsCreatingFolder(false);
    setNewFolderName('');
    onClose();
  };

  const doneCount = items.filter((i) => i.status === 'done').length;
  const failedCount = items.filter((i) => i.status === 'failed').length;
  /* Option B now yields a single file however many rows go into it. */
  const readyCount =
    source === 'files' ? items.filter((i) => i.status !== 'done').length : generatedCount ? 1 : 0;

  const panelClass = (active: boolean) =>
    `relative flex flex-col gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
      active
        ? 'border-primary bg-primary/[0.03] shadow-sm'
        : 'border-surface-container-high bg-surface-container-low/30 hover:border-outline-variant'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-surface-container flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">upload_file</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
                  Import Knowledge Base Articles
                </h2>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary">
                  Importer
                </span>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Select your preferred source to bulk import or auto-generate markdown articles
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            startIcon="close"
            type="button"
            disabled={isImporting}
            onClick={close}
          />
        </div>

        <div className="p-5 flex flex-col gap-space-md overflow-y-auto">
          {error && <ErrorBanner message={error} />}

          {/* Destination — chosen per import, for whichever option is used. */}
          <div className="flex flex-col gap-2 p-4 rounded-2xl bg-surface-container-low/50 border border-surface-container">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-lg text-on-surface-variant">
                  {destinationId ? 'folder_open' : 'home_storage'}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-caption text-caption text-outline uppercase tracking-wider font-semibold">
                    Destination
                  </span>
                  <span className="font-title-sm text-title-sm font-bold text-on-surface truncate">
                    {destinationName}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  disabled={isImporting || foldersState.loading}
                  className="h-9 px-3 text-xs rounded-xl bg-surface-container-lowest text-on-surface border border-surface-container-high cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                >
                  <option value="">Root level</option>
                  {/* Indented by depth: a select cannot nest, so the hierarchy
                      is shown with leading spaces and the full path as the
                      tooltip, rather than a flat list where two folders of the
                      same name are indistinguishable. */}
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id} title={folder.displayPath}>
                      {`${'  '.repeat(folder.depth)}${folder.depth ? '└ ' : ''}${folder.name}`}
                    </option>
                  ))}
                </select>
                {!isCreatingFolder && (
                  <Button
                    variant="outline"
                    size="sm"
                    startIcon="create_new_folder"
                    type="button"
                    disabled={isImporting}
                    onClick={() => setIsCreatingFolder(true)}
                  >
                    New folder
                  </Button>
                )}
              </div>
            </div>

            {isCreatingFolder && (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="New folder name"
                  autoFocus
                  className="flex-1 h-9 px-3 text-xs rounded-xl bg-surface-container-lowest text-on-surface border border-surface-container-high placeholder:text-outline/60 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    type="button"
                    loading={isSavingFolder}
                    onClick={handleCreateFolder}
                  >
                    Create
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={isSavingFolder}
                    onClick={() => {
                      setIsCreatingFolder(false);
                      setNewFolderName('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* ------------------------------ Option A ------------------------------ */}
            <div className={panelClass(source === 'files')} onClick={() => setSource('files')}>
              <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary text-on-primary">
                RECOMMENDED
              </span>

              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl text-primary">cloud_upload</span>
                <h3 className="font-title-md text-title-md font-bold text-on-surface">
                  Option A: Files &amp; Cloud Storage
                </h3>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Upload local documents or sync from cloud storage providers (PDF, Word, TXT, MD, CSV)
              </p>

              <div className="flex flex-col gap-1.5">
                <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider font-semibold">
                  Connect cloud providers
                </span>
                <div className="flex flex-wrap gap-2">
                  {/* No connector exists for these yet, so they are shown as
                      unavailable rather than as buttons that quietly do nothing. */}
                  {['Google Drive', 'Dropbox', 'OneDrive'].map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      disabled
                      title={`${provider} is not connected to this workspace yet`}
                      className="flex items-center gap-1.5 px-3 h-9 rounded-xl border border-surface-container-high bg-surface-container-low text-on-surface-variant text-xs font-medium opacity-50 cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-base">cloud_off</span>
                      {provider}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSource('files');
                      inputRef.current?.click();
                    }}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-xl border border-outline-variant/60 bg-surface-container-lowest text-on-surface text-xs font-semibold hover:bg-surface-container-low cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">computer</span>
                    Local PC
                  </button>
                </div>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  setSource('files');
                  addFiles(e.dataTransfer.files);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSource('files');
                  inputRef.current?.click();
                }}
                className={`flex flex-col items-center justify-center gap-1.5 py-8 px-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-center ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-surface-container-high bg-surface-container-lowest hover:bg-surface-container-low'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">upload</span>
                </div>
                <span className="font-title-sm text-title-sm font-semibold text-on-surface">
                  Drag &amp; drop files here
                </span>
                <span className="font-caption text-caption text-on-surface-variant">
                  Supports .md, .pdf, .docx, .json up to {formatSize(MAX_BYTES)}
                </span>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    /* Reset so picking the same file twice still fires a change. */
                    e.target.value = '';
                  }}
                />
              </div>

              <label className="flex items-center justify-between gap-2 opacity-50 cursor-not-allowed">
                <span className="font-body-sm text-body-sm text-on-surface">
                  Auto-sync updates periodically
                </span>
                <input
                  type="checkbox"
                  disabled
                  title="Scheduled sync is not available yet"
                  className="w-4 h-4 accent-primary cursor-not-allowed"
                />
              </label>

            </div>

            {/* ------------------------------ Option B ------------------------------ */}
            <div className={panelClass(source === 'catalog')} onClick={() => setSource('catalog')}>
              <span className="absolute -top-2.5 right-4 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white">
                SMART CATALOG SYNC
              </span>

              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xl text-emerald-600">menu_book</span>
                <h3 className="font-title-md text-title-md font-bold text-on-surface">
                  Option B: Generate .md from Catalog
                </h3>
              </div>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Automatically compile dynamic Markdown knowledge articles directly from your existing
                Products and Categories inventory
              </p>

              <div className="flex flex-col gap-2">
                <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider font-semibold">
                  Source selector
                </span>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeProducts}
                    onChange={(e) => setIncludeProducts(e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <span className="font-body-sm text-body-sm text-on-surface">
                    Include all products{' '}
                    <span className="text-on-surface-variant">
                      ({catalogLoading ? '…' : products.length})
                    </span>
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeCategories}
                    onChange={(e) => setIncludeCategories(e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <span className="font-body-sm text-body-sm text-on-surface">
                    Include categories &amp; taxonomies{' '}
                    <span className="text-on-surface-variant">
                      ({catalogLoading ? '…' : categories.length})
                    </span>
                  </span>
                </label>

                {/* Nothing in this platform holds shipping or returns policy text. */}
                <label className="flex items-center gap-2 opacity-50 cursor-not-allowed">
                  <input
                    type="checkbox"
                    disabled
                    title="No shipping or returns policy content exists in this platform yet"
                    className="w-4 h-4 accent-primary cursor-not-allowed"
                  />
                  <span className="font-body-sm text-body-sm text-on-surface">
                    Include shipping &amp; return policies
                  </span>
                </label>

                {/* Stated rather than silent: someone generating docs should know
                    why the price is not in them. */}
                <div className="flex items-start gap-1.5 text-on-surface-variant pt-1">
                  <span className="material-symbols-outlined text-base shrink-0">info</span>
                  <span
                    className="font-caption text-caption"
                    title="Omitted: price, originalPrice, discount, margin, stock, stockStatus, committed, reorderPoint"
                  >
                    Price and stock are left out — they change, and an indexed document would
                    keep answering with the old value.
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-body-sm text-body-sm text-on-surface">Template</span>
                <select
                  value={template}
                  onChange={(e) => setTemplate(e.target.value as Template)}
                  onClick={(e) => e.stopPropagation()}
                  className="h-9 px-3 text-xs rounded-xl bg-surface-container-lowest text-on-surface border border-surface-container-high cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="qa">Structured Q&amp;A / FAQ Markdown</option>
                  <option value="reference">Reference sheet</option>
                </select>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800">
                <span className="material-symbols-outlined text-base shrink-0">check_circle</span>
                <span className="font-caption text-caption">
                  {catalogLoading
                    ? 'Counting what can be generated…'
                    : generatedCount === 0
                      ? 'Nothing selected — tick a source above.'
                      : `Generates one markdown file covering ${productCount} product${productCount === 1 ? '' : 's'} and ${categoryCount} categor${categoryCount === 1 ? 'y' : 'ies'}, ready to publish into the knowledge base`}
                </span>
              </div>
            </div>
          </div>

          {/* Queue — shown once there is something to report */}
          {items.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider">
                {items.length} item{items.length === 1 ? '' : 's'}
                {doneCount ? ` · ${doneCount} imported` : ''}
                {failedCount ? ` · ${failedCount} failed` : ''}
              </span>

              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                {items.map((item, index) => (
                  <div
                    key={`${item.name}-${index}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low/60 border border-surface-container"
                  >
                    <span
                      className={`material-symbols-outlined text-lg shrink-0 ${
                        item.status === 'done'
                          ? 'text-emerald-600'
                          : item.status === 'failed'
                            ? 'text-error'
                            : 'text-on-surface-variant'
                      }`}
                    >
                      {item.status === 'done'
                        ? 'check_circle'
                        : item.status === 'failed'
                          ? 'error'
                          : 'description'}
                    </span>

                    <div className="flex flex-col min-w-0 flex-1 gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-body-sm text-body-sm text-on-surface font-medium truncate">
                          {item.name}
                        </span>
                        <span className="font-caption text-caption text-on-surface-variant shrink-0">
                          {formatSize(item.sizeBytes)}
                        </span>
                      </div>

                      {item.status === 'uploading' && item.file && (
                        <div className="h-1 rounded-pill bg-surface-container-high overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${item.percent}%` }}
                          />
                        </div>
                      )}
                      {item.status === 'failed' && (
                        <span className="font-caption text-caption text-error">{item.error}</span>
                      )}
                    </div>

                    {item.status === 'queued' && !isImporting && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        startIcon="close"
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                        title="Remove from the queue"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-1.5 text-on-surface-variant">
            <span className="material-symbols-outlined text-base shrink-0">info</span>
            <span className="font-caption text-caption">
              Files are uploaded to Perfox and only answer queries once it has indexed them.
            </span>
          </div>
          <div className="flex items-center justify-end gap-space-xs">
            <Button variant="hover" size="md" type="button" disabled={isImporting} onClick={close}>
              {doneCount && !readyCount ? 'Done' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              size="md"
              startIcon={source === 'catalog' ? 'auto_awesome' : 'cloud_upload'}
              type="button"
              loading={isImporting}
              disabled={!readyCount || catalogLoading}
              onClick={handleImport}
            >
              {source === 'catalog'
                ? 'Generate & import catalog'
                : `Upload ${readyCount || ''} file${readyCount === 1 ? '' : 's'}`.trim()}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
