import React, { useEffect, useMemo, useState } from 'react';
import { knowledgeApi, KbFile } from '../api';
import { useApi } from '../hooks/useApi';
import ImportFilesModal from '../components/knowledge/ImportFilesModal';
import {
  Button,
  MetricsCard,
  Icon,
  SearchInput,
  StatusBadge,
  LoadingState,
  ErrorState,
  ErrorBanner
} from '../components/common';

/* `text/markdown` is the only type this page creates, but the folder may hold
   anything that was uploaded to Perfox directly, so the label is derived rather
   than assumed. */
const MIME_LABELS: Record<string, string> = {
  'text/markdown': 'Markdown',
  'text/plain': 'Plain text',
  'text/csv': 'CSV',
  'application/pdf': 'PDF',
  'application/json': 'JSON',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word'
};

const mimeLabel = (mimeType: string): string => {
  if (!mimeType) return 'Unknown';
  return MIME_LABELS[mimeType] || mimeType.split('/').pop()?.toUpperCase() || mimeType;
};

const mimeIcon = (mimeType: string): string => {
  if (mimeType === 'application/pdf') return 'picture_as_pdf';
  if (mimeType.startsWith('text/')) return 'description';
  if (mimeType.startsWith('image/')) return 'image';
  return 'draft';
};

const formatSize = (bytes: number): string => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso: string): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/* Mirrors the server's own rule so the dialog can show the name that will
   actually be written, rather than leaving the user to guess. */
const previewFileName = (name: string): string => {
  const cleaned = name
    .trim()
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.+$/, '')
    .trim();
  const base = cleaned || 'untitled';
  return /\.md$/i.test(base) ? base : `${base}.md`;
};

export default function KnowledgeBasePage() {
  /* Browsed one level at a time: '' is the root of the knowledge base. Perfox
     scopes its file listing the same way, so a level is one request rather than
     a walk of the whole tree. */
  const [currentFolderId, setCurrentFolderId] = useState('');

  /* Perfox pages the file listing with a forward-only cursor, so the page grows
     by appending rather than jumping between numbered pages. */
  const PAGE_SIZE = 50;

  const filesState = useApi(
    () => knowledgeApi.listFiles(currentFolderId, { limit: PAGE_SIZE }),
    [currentFolderId]
  );

  /* Pages fetched after the first, kept apart from it so a refetch of page one
     does not have to know about them. */
  const [extraFiles, setExtraFiles] = useState<KbFile[]>([]);
  const [cursor, setCursor] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const statsState = useApi(() => knowledgeApi.stats(), []);
  const foldersState = useApi(() => knowledgeApi.listFolders(), []);

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastUploaded, setLastUploaded] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  /* The file awaiting confirmation, so a delete is never one stray click. */
  const [pendingDelete, setPendingDelete] = useState<KbFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  /* Folder actions. Renaming edits in place; deleting is confirmed, and Perfox
     refuses while the folder still holds anything. */
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);
  const [folderNotice, setFolderNotice] = useState('');

  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  /* Empty means the root of the knowledge base — there is no fixed folder. */
  const [newFolderId, setNewFolderId] = useState('');

  /* The first page plus everything loaded after it. Deduplicated by id: a file
     uploaded mid-browse can arrive in a later page as well as in the local
     merge on page one. */
  const files = useMemo(() => {
    const merged = [...(filesState.data?.files || []), ...extraFiles];
    const byId = new Map<string, KbFile>();
    merged.forEach((file) => byId.set(file.id, file));
    return [...byId.values()];
  }, [filesState.data, extraFiles]);

  /* Reset whenever the first page is replaced — a different folder, or a
     refresh — otherwise an old folder's pages would linger below the new one. */
  useEffect(() => {
    setExtraFiles([]);
    setCursor(filesState.data?.nextCursor ?? '');
  }, [filesState.data]);

  const loadMore = async () => {
    if (!cursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setSaveError('');
    try {
      const page = await knowledgeApi.listFiles(currentFolderId, {
        limit: PAGE_SIZE,
        cursor,
      });
      setExtraFiles((current) => [...current, ...(page.files ?? [])]);
      setCursor(page.nextCursor ?? '');
    } catch (err) {
      setSaveError(err?.message || 'Could not load more files.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const stats = statsState.data;
  const allFolders = foldersState.data?.folders || [];

  /* Only the folders that sit at the level being viewed. */
  const visibleFolders = useMemo(
    () =>
      allFolders.filter((folder) =>
        currentFolderId ? folder.parentId === currentFolderId : !folder.parentId
      ),
    [allFolders, currentFolderId]
  );

  const currentFolder = allFolders.find((folder) => folder.id === currentFolderId);

  /* How many subfolders each folder holds, so a card can say it has more inside
     rather than looking empty when its files are all one level down. */
  const childCount = useMemo(() => {
    const counts = new Map<string, number>();
    allFolders.forEach((folder) => {
      if (!folder.parentId) return;
      counts.set(folder.parentId, (counts.get(folder.parentId) ?? 0) + 1);
    });
    return counts;
  }, [allFolders]);

  /* Root -> … -> here, walked up by parentId so a nested folder still shows its
     way back. */
  const breadcrumb = useMemo(() => {
    const trail: { id: string; name: string }[] = [];
    let node = currentFolder;
    while (node) {
      trail.unshift({ id: node.id, name: node.name });
      node = allFolders.find((folder) => folder.id === node?.parentId);
    }
    return trail;
  }, [currentFolder, allFolders]);

  const openFolder = (folderId: string) => {
    setCurrentFolderId(folderId);
    setSearchQuery('');
  };

  /* Filtered in the browser: the folder holds a handful of files and the API has
     no search parameter, so a round trip per keystroke would buy nothing. */
  const visibleFiles = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return files;
    return files.filter((file: KbFile) => file.name.toLowerCase().includes(term));
  }, [files, searchQuery]);

  const refresh = () => {
    filesState.refetch();
    statsState.refetch();
    foldersState.refetch();
  };

  const handleRenameFolder = async () => {
    if (!renaming) return;
    const name = renaming.name.trim();
    if (!name) return;

    setSaveError('');
    setIsRenaming(true);
    try {
      await knowledgeApi.renameFolder(renaming.id, name);
      setRenaming(null);
      foldersState.refetch();
    } catch (err) {
      setSaveError(err?.message || 'Could not rename the folder.');
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;

    setSaveError('');
    setIsDeletingFolder(true);
    try {
      const result = await knowledgeApi.deleteFolder(folderToDelete.id);
      /* Perfox names what was drawing on it, so the consequence is stated
         rather than left to be discovered. */
      setFolderNotice(
        result.affectedAgents?.length
          ? `"${folderToDelete.name}" deleted — ${result.affectedAgents.join(', ')} no longer answer from it.`
          : `"${folderToDelete.name}" deleted.`
      );
      setFolderToDelete(null);
      /* Standing inside the folder that just went is a dead end. */
      if (currentFolderId === folderToDelete.id) setCurrentFolderId('');
      refresh();
    } catch (err) {
      /* A 409 is the folder still holding something — the message already says
         what to clear out, so it is shown as-is. */
      setSaveError(err?.message || 'Could not delete the folder.');
      setFolderToDelete(null);
    } finally {
      setIsDeletingFolder(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setSaveError('');
    setIsDeleting(true);
    try {
      await knowledgeApi.deleteFile(pendingDelete.id);
      setPendingDelete(null);
      refresh();
    } catch (err) {
      setSaveError(err?.message || 'Could not delete the file.');
    } finally {
      setIsDeleting(false);
    }
  };

  const closeCreate = () => {
    setIsCreateOpen(false);
    setNewName('');
    setNewContent('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newContent.trim()) return;

    setSaveError('');
    setIsSaving(true);
    try {
      const created = await knowledgeApi.createMarkdownFile({
        ...(newFolderId ? { folderId: newFolderId } : {}),
        name: newName,
        content: newContent
      });
      /* Perfox indexes asynchronously, so the row lands with a non-active status
         and the note below tells the user why. */
      setLastUploaded(created?.file?.name || previewFileName(newName));
      closeCreate();
      refresh();
    } catch (err: any) {
      setSaveError(err?.message || 'The file could not be uploaded.');
    } finally {
      setIsSaving(false);
    }
  };

  if (filesState.loading && !filesState.data) {
    return <LoadingState label="Loading knowledge-base files…" />;
  }

  /* 409 means no folder is selected — that is a configuration step, not a
     failure, so it points at where to fix it instead of offering a retry. */
  if (filesState.error && !filesState.data) {
    return <ErrorState message={filesState.error} onRetry={filesState.refetch} />;
  }

  return (
    <div className="flex flex-col gap-space-lg w-full pt-space-xs pb-10">
      {saveError && <ErrorBanner message={saveError} />}
      {filesState.error && <ErrorBanner message={filesState.error} onRetry={filesState.refetch} />}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 font-caption text-caption text-outline flex-wrap">
            <span>OmniFlow</span>
            <Icon name="chevron_right" size="xs" />
            <button
              type="button"
              onClick={() => openFolder('')}
              className={
                currentFolderId
                  ? 'hover:text-primary transition-colors'
                  : 'text-primary font-semibold cursor-default'
              }
              disabled={!currentFolderId}
            >
              Knowledge Base
            </button>
            {breadcrumb.map((crumb, index) => (
              <React.Fragment key={crumb.id}>
                <Icon name="chevron_right" size="xs" />
                <button
                  type="button"
                  onClick={() => openFolder(crumb.id)}
                  className={
                    index === breadcrumb.length - 1
                      ? 'text-primary font-semibold cursor-default'
                      : 'hover:text-primary transition-colors'
                  }
                  disabled={index === breadcrumb.length - 1}
                >
                  {crumb.name}
                </button>
              </React.Fragment>
            ))}
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            Knowledge Base Files
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant max-w-3xl">
            The documents your agents answer from, stored in your Perfox workspace. Open a folder
            to see what is inside it; new files are uploaded to wherever you are.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-space-xs self-start md:self-auto">
          <Button variant="secondary" size="md" startIcon="refresh" onClick={refresh}>
            Refresh
          </Button>
          <Button variant="secondary" size="md" startIcon="upload_file" onClick={() => setIsImportOpen(true)}>
            Import
          </Button>
          <Button
            variant="primary"
            size="md"
            startIcon="note_add"
            onClick={() => {
              setNewFolderId(currentFolderId);
              setIsCreateOpen(true);
            }}
          >
            New File
          </Button>
        </div>
      </div>

      {/* A file is stored the moment it uploads but answers nothing until Perfox
          has indexed it — said once, where it matters. */}
      {lastUploaded && (
        <div className="flex items-center justify-between gap-3 px-space-md py-2.5 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="cloud_upload" size="sm" color="primary" />
            <span className="font-body-sm text-body-sm text-on-surface truncate">
              <strong>{lastUploaded}</strong> uploaded. Perfox is indexing it — refresh in a moment
              to see it become searchable.
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setLastUploaded('')}>
            Dismiss
          </Button>
        </div>
      )}

      {folderNotice && (
        <div className="flex items-center justify-between gap-3 px-space-md py-2.5 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name="folder_delete" size="sm" color="primary" />
            <span className="font-body-sm text-body-sm text-on-surface truncate">{folderNotice}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setFolderNotice('')}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <MetricsCard
          title="Total Files"
          value={stats?.totalFiles ?? files.length}
          icon="folder_open"
          variant="primary"
          subtitle="Across the knowledge base"
        />
        <MetricsCard
          title="Searchable"
          value={stats?.indexedFiles ?? files.filter((f: KbFile) => f.status === 'active').length}
          icon="check_circle"
          variant="secondary"
          subtitle="Indexed by Perfox"
        />
        <MetricsCard
          title="Not Indexed"
          value={stats?.notIndexed ?? files.filter((f: KbFile) => f.status !== 'active').length}
          icon="error"
          variant={stats?.notIndexed ? 'tertiary' : 'neutral'}
          subtitle="Stored, but answering nothing"
        />
        <MetricsCard
          title="Total Size"
          value={formatSize(stats?.totalSizeBytes ?? 0)}
          icon="database"
          variant="neutral"
          subtitle={`${stats?.totalChunks ?? 0} indexed chunks`}
        />
      </div>

      {/* Folders at this level. Hidden when there are none, so a leaf folder is
          not padded with an empty section. */}
      {visibleFolders.length > 0 && (
        <div className="flex flex-col gap-space-sm">
          <h2 className="font-title-md text-title-md text-on-surface font-bold">
            Folders ({visibleFolders.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-space-md">
            {visibleFolders.map((folder) => (
              <div
                key={folder.id}
                className="group relative flex items-start gap-3 p-space-md rounded-2xl border border-surface-container bg-surface-container-lowest hover:border-primary/40 transition-colors"
              >
                {renaming?.id === folder.id ? (
                  /* Renamed in place — a dialog for one short field would be
                     more ceremony than the change deserves. */
                  <div className="flex flex-col gap-2 w-full">
                    <input
                      autoFocus
                      value={renaming.name}
                      onChange={(e) => setRenaming({ id: folder.id, name: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameFolder();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-primary/40 bg-surface-container-lowest font-body-sm text-body-sm text-on-surface outline-none focus:border-primary"
                      maxLength={200}
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleRenameFolder}
                        disabled={isRenaming || !renaming.name.trim()}
                      >
                        {isRenaming ? 'Saving…' : 'Save'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setRenaming(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => openFolder(folder.id)}
                      className="flex items-start gap-3 text-left min-w-0 flex-1"
                    >
                      <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Icon name="folder" size="md" />
                      </span>
                      <span className="flex flex-col min-w-0 gap-0.5">
                        <span className="font-label-lg text-label-lg text-on-surface font-semibold truncate">
                          {folder.name}
                        </span>
                        <span className="font-caption text-caption text-on-surface-variant">
                          {folder.fileCount === 1 ? '1 file' : `${folder.fileCount} files`}
                          {childCount.get(folder.id)
                            ? ` · ${childCount.get(folder.id)} ${
                                childCount.get(folder.id) === 1 ? 'subfolder' : 'subfolders'
                              }`
                            : ''}
                        </span>
                        {folder.summary && (
                          <span className="font-caption text-caption text-outline line-clamp-2 mt-0.5">
                            {folder.summary}
                          </span>
                        )}
                      </span>
                    </button>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        startIcon="edit"
                        title="Rename folder"
                        aria-label={`Rename ${folder.name}`}
                        onClick={() => setRenaming({ id: folder.id, name: folder.name })}
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        startIcon="delete"
                        title="Delete folder"
                        aria-label={`Delete ${folder.name}`}
                        onClick={() => setFolderToDelete({ id: folder.id, name: folder.name })}
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File table */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-surface-container overflow-hidden">
        <div className="p-space-md border-b border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm">
          <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
            Files in {currentFolder?.name ?? 'Root level'} ({visibleFiles.length})
          </h2>
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            placeholder="Search by file name"
            size="md"
            className="sm:w-72"
          />
        </div>

        {visibleFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-space-xl text-center">
            <div className="w-11 h-11 rounded-xl bg-surface-container flex items-center justify-center">
              <Icon name="folder_off" size="xl" color="outline" />
            </div>
            <span className="font-title-sm text-title-sm text-on-surface font-semibold">
              {searchQuery
                ? 'No file matches that name'
                : currentFolder
                  ? `No files in ${currentFolder.name} yet`
                  : 'No files at the root level — open a folder to see what is inside it'}
            </span>
            <p className="font-body-sm text-body-sm text-on-surface-variant max-w-md">
              {searchQuery
                ? 'Clear the search to see everything in the folder.'
                : 'Create a markdown file and it is uploaded to Perfox, ready for your agents to answer from.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low/60 font-caption text-caption text-on-surface-variant uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-space-md font-semibold">File name</th>
                  <th className="py-3 px-space-md font-semibold">Folder</th>
                  <th className="py-3 px-space-md font-semibold">Type</th>
                  <th className="py-3 px-space-md font-semibold">Size</th>
                  <th className="py-3 px-space-md font-semibold">Uploaded</th>
                  <th className="py-3 px-space-md font-semibold">Status</th>
                  <th className="py-3 px-space-md font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {visibleFiles.map((file: KbFile) => (
                  <tr key={file.id} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3 px-space-md">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon name={mimeIcon(file.mimeType)} size="md" color="primary" />
                        <div className="min-w-0">
                          <span className="font-body-md text-body-md text-on-surface font-semibold block truncate">
                            {file.name}
                          </span>
                          <span className="font-caption text-caption text-outline font-mono block truncate">
                            {file.id}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-space-md">
                      <span className="inline-flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
                        <span className="material-symbols-outlined text-base">
                          {file.folderName === 'Root level' ? 'home_storage' : 'folder'}
                        </span>
                        {file.folderName || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-space-md">
                      <span className="font-body-sm text-body-sm text-on-surface-variant">
                        {mimeLabel(file.mimeType)}
                      </span>
                    </td>
                    <td className="py-3 px-space-md font-body-sm text-body-sm text-on-surface-variant">
                      {formatSize(file.sizeBytes)}
                    </td>
                    <td className="py-3 px-space-md font-body-sm text-body-sm text-on-surface-variant whitespace-nowrap">
                      {formatDate(file.uploadedAt)}
                    </td>
                    <td className="py-3 px-space-md">
                      <div className="flex flex-col gap-0.5">
                        <StatusBadge status={file.status} size="sm" />
                        <span className="font-caption text-caption text-outline">
                          {file.status === 'active'
                            ? `${file.chunkCount} chunk${file.chunkCount === 1 ? '' : 's'}`
                            : 'Not searchable yet'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-space-md text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        startIcon="delete"
                        onClick={() => setPendingDelete(file)}
                        title={`Delete ${file.name}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Forward-only cursor, so this appends rather than paging. Hidden once
            Perfox stops returning a cursor — that is the end of the folder. */}
        {cursor && !searchQuery && (
          <div className="flex items-center justify-center gap-3 p-space-md border-t border-surface-container">
            <Button
              variant="secondary"
              size="md"
              startIcon="expand_more"
              onClick={loadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? 'Loading…' : 'Load more files'}
            </Button>
            <span className="font-caption text-caption text-outline">
              {files.length} loaded so far
            </span>
          </div>
        )}

        {/* Search only filters what has been loaded, so say so rather than let
            an empty result read as "no such file in this folder". */}
        {cursor && searchQuery && (
          <div className="px-space-md py-2.5 border-t border-surface-container">
            <span className="font-caption text-caption text-on-surface-variant">
              Searching the {files.length} files loaded so far — clear the search to load more.
            </span>
          </div>
        )}
      </div>

      {/* Create file modal */}
      <ImportFilesModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onUploaded={refresh}
        defaultFolderId={currentFolderId}
      />

      {/* Perfox refuses while the folder holds anything, and never cascades — so
          this confirms the folder itself, not its contents. */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container max-w-md w-full p-space-md flex flex-col gap-space-sm">
            <h3 className="font-title text-title text-on-surface font-bold">Delete this folder?</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              <span className="font-semibold">{folderToDelete.name}</span> will be removed from the
              Perfox knowledge base. A folder holding files or subfolders cannot be deleted — clear
              it out first. Nothing inside it is ever removed by this.
            </p>
            <div className="flex items-center justify-end gap-space-xs pt-1">
              <Button variant="ghost" size="md" onClick={() => setFolderToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                startIcon="delete"
                onClick={handleDeleteFolder}
                disabled={isDeletingFolder}
              >
                {isDeletingFolder ? 'Deleting…' : 'Delete folder'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Deleting removes the file from Perfox, so it is confirmed first. */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container max-w-md w-full p-space-md flex flex-col gap-space-sm">
            <h3 className="font-title text-title text-on-surface font-bold">Delete this file?</h3>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              <span className="font-semibold">{pendingDelete.name}</span> will be removed from the
              Perfox knowledge base. Your agents will stop answering from it. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-space-xs pt-1">
              <Button
                variant="hover"
                size="md"
                disabled={isDeleting}
                onClick={() => setPendingDelete(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                startIcon="delete"
                loading={isDeleting}
                onClick={handleDelete}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-200">
          <form
            onSubmit={handleCreate}
            className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-2xl border border-surface-container-high flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh]"
          >
            <div className="px-5 py-3.5 bg-surface-container-low/70 border-b border-surface-container flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-xs">
                  <Icon name="note_add" size="md" />
                </div>
                <div>
                  <h2 className="font-title-md text-title-md text-on-surface font-bold">
                    New Knowledge Base File
                  </h2>
                  <p className="text-[11px] text-on-surface-variant">
                    Saved as markdown and uploaded to Perfox
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" startIcon="close" onClick={closeCreate} type="button" />
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="kb-file-name" className="text-xs font-semibold text-on-surface">
                  File name
                </label>
                <input
                  id="kb-file-name"
                  type="text"
                  required
                  maxLength={200}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Refund policy"
                  className="h-10 px-3 rounded-xl bg-surface-container-low text-body-sm font-body-sm text-on-surface border border-surface-container focus:outline-none focus:border-primary"
                />
                <span className="font-caption text-caption text-outline">
                  Uploaded as{' '}
                  <span className="font-mono text-on-surface-variant">
                    {previewFileName(newName)}
                  </span>
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="kb-file-folder" className="text-xs font-semibold text-on-surface">
                  Destination
                </label>
                <select
                  id="kb-file-folder"
                  value={newFolderId}
                  onChange={(e) => setNewFolderId(e.target.value)}
                  className="h-10 px-3 rounded-xl bg-surface-container-low text-body-sm font-body-sm text-on-surface border border-surface-container cursor-pointer focus:outline-none focus:border-primary"
                >
                  <option value="">Root level</option>
                  {/* Same indentation rule as the import dialog. */}
                  {allFolders.map((folder) => (
                    <option key={folder.id} value={folder.id} title={folder.displayPath}>
                      {`${'  '.repeat(folder.depth)}${folder.depth ? '└ ' : ''}${folder.name}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 flex-1">
                <label htmlFor="kb-file-content" className="text-xs font-semibold text-on-surface">
                  Content (Markdown)
                </label>
                <textarea
                  id="kb-file-content"
                  required
                  rows={14}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder={'# Refund policy\n\nRefunds are issued within 7 working days of…'}
                  className="px-3 py-2.5 rounded-xl bg-surface-container-low font-mono text-xs text-on-surface border border-surface-container focus:outline-none focus:border-primary resize-y"
                />
              </div>
            </div>

            <div className="px-5 py-3.5 bg-surface-container-low/70 border-t border-surface-container flex items-center justify-end gap-2">
              <Button variant="hover" size="md" type="button" onClick={closeCreate} disabled={isSaving}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                type="submit"
                startIcon="cloud_upload"
                loading={isSaving}
                disabled={isSaving || !newName.trim() || !newContent.trim()}
              >
                {isSaving ? 'Uploading…' : 'Create & Upload'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
