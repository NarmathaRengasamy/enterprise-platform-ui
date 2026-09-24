import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  MetricsCard,
  Icon,
  Button,
} from '../components/common';
import {
  knowledgeService,
  KbFile,
  KbFolder,
  KnowledgeStats,
} from '../services/knowledge.service';
import { productService } from '../services/product.service';
import { categoryService } from '../services/category.service';

const renderInline = (str: string): React.ReactNode => {
  const parts = str.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={i} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={i} className="italic text-slate-800">
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={i}
          className="px-1 py-0.5 rounded bg-slate-100 text-blue-600 font-mono text-[11px] border border-slate-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
};

const renderSimpleMarkdown = (text: string) => {
  if (!text.trim()) {
    return (
      <p className="text-slate-400 italic text-xs">
        Nothing to preview yet. Start typing your article in the Write tab.
      </p>
    );
  }

  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if line is a table row (starts and ends with |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 1) {
        const parseRow = (r: string) =>
          r
            .slice(1, -1)
            .split('|')
            .map((c) => c.trim());

        const isSeparator = (r: string) => /^\|(\s*:?-+:?\s*\|)+$/.test(r);

        const headerLine = tableLines[0];
        const headers = parseRow(headerLine);
        const dataLines = tableLines.slice(1).filter((l) => !isSeparator(l));
        const rows = dataLines.map(parseRow);

        elements.push(
          <div key={`table-${i}`} className="overflow-x-auto my-2.5 rounded-xl border border-slate-200 shadow-2xs">
            <table className="min-w-full divide-y divide-slate-200 text-xs text-left">
              <thead className="bg-slate-100/90 font-semibold text-slate-800">
                <tr>
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="px-3.5 py-2.5 border-r last:border-r-0 border-slate-200 font-bold">
                      {renderInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-50/60 transition-colors">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-3.5 py-2 border-r last:border-r-0 border-slate-100 text-slate-700">
                        {renderInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={`h3-${i}`} className="text-xs sm:text-sm font-bold text-slate-900 mt-2">
          {renderInline(trimmed.replace('### ', ''))}
        </h4>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={`h2-${i}`} className="text-sm sm:text-base font-bold text-slate-900 mt-3 pb-1 border-b border-slate-100">
          {renderInline(trimmed.replace('## ', ''))}
        </h3>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={`h1-${i}`} className="text-base sm:text-lg font-black text-slate-900 mt-3 pb-1 border-b border-slate-200">
          {renderInline(trimmed.replace('# ', ''))}
        </h2>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={`list-${i}`} className="flex items-start gap-2 pl-2">
          <span className="text-blue-600 font-bold">•</span>
          <span className="text-slate-700">{renderInline(trimmed.substring(2))}</span>
        </div>
      );
      i++;
      continue;
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)/);
      elements.push(
        <div key={`numlist-${i}`} className="flex items-start gap-2 pl-2">
          <span className="font-semibold text-slate-600 text-xs">{match ? match[1] + '.' : '•'}</span>
          <span className="text-slate-700">{renderInline(match ? match[2] : trimmed)}</span>
        </div>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-4 border-blue-500 bg-blue-50/60 px-3 py-2 rounded-r-lg text-blue-950 text-xs my-1"
        >
          {renderInline(trimmed.replace('> ', ''))}
        </blockquote>
      );
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      i++;
      continue;
    }

    if (!trimmed) {
      elements.push(<div key={`space-${i}`} className="h-1" />);
      i++;
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="leading-relaxed text-slate-700">
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div className="space-y-2 text-xs sm:text-sm">{elements}</div>;
};

export default function KnowledgeBasePage() {
  // Data state
  const [files, setFiles] = useState<KbFile[]>([]);
  const [folders, setFolders] = useState<KbFolder[]>([]);
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [productCount, setProductCount] = useState<number>(0);
  const [categoryCount, setCategoryCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platformWarning, setPlatformWarning] = useState<string | null>(null);

  // Filters & selection
  const [selectedFolderId, setSelectedFolderId] = useState<string>('ALL'); // 'ALL' | 'ROOT' | folderId
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'processing' | 'pending' | 'error'>('ALL');

  // Import Modal State (Matching Screenshot)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [modalDestinationFolder, setModalDestinationFolder] = useState<string>('');
  const [activeImportTab, setActiveImportTab] = useState<'pc' | 'catalog'>('pc');

  // Option A (Files & Cloud Storage)
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Option B (Generate .md from Catalog)
  const [includeProducts, setIncludeProducts] = useState(true);
  const [includeCategories, setIncludeCategories] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<'qa' | 'reference'>('qa');
  const [isGeneratingCatalog, setIsGeneratingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Create Article Modal State
  const [isCreateArticleOpen, setIsCreateArticleOpen] = useState(false);
  const [articleTitle, setArticleTitle] = useState('');
  const [articleCategory, setArticleCategory] = useState('');
  const [articleContent, setArticleContent] = useState('');
  const [articleEditorTab, setArticleEditorTab] = useState<'write' | 'preview'>('write');
  const [isPublishingArticle, setIsPublishingArticle] = useState(false);
  const [createArticleError, setCreateArticleError] = useState<string | null>(null);

  // Create Folder Modal
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);

  // Tree & Search state matching Studio
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<{ query: string; matches: KbFile[] } | null>(null);
  const [isTestingSearch, setIsTestingSearch] = useState(false);

  // Delete Modals
  const [deleteConfirmFile, setDeleteConfirmFile] = useState<KbFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load Data
  const loadData = async (folderFilter = selectedFolderId) => {
    setIsLoading(true);
    setError(null);
    setPlatformWarning(null);

    try {
      const [statsData, foldersData, prodStats, catStats] = await Promise.all([
        knowledgeService.getKnowledgeStats().catch((err: any) => {
          if (err.message?.includes('409') || err.message?.includes('Perfox')) {
            setPlatformWarning('Perfox platform connection is not configured.');
          }
          return {
            totalFiles: 0,
            indexedFiles: 0,
            notIndexed: 0,
            totalChunks: 0,
            totalSizeBytes: 0,
          };
        }),
        knowledgeService.getFolders().catch(() => []),
        productService.getProductStats().catch(() => ({ total: 0 })),
        categoryService.getCategoryStats().catch(() => ({ totalCategories: 0 })),
      ]);

      let filesData: KbFile[] = [];
      if (folderFilter === 'ALL') {
        const fileLists = await Promise.all([
          knowledgeService.getFiles().catch(() => []),
          ...foldersData.map((f) => knowledgeService.getFiles(f.id).catch(() => [])),
        ]);
        const seen = new Set<string>();
        filesData = fileLists.flat().filter((file) => {
          if (!file?.id || seen.has(file.id)) return false;
          seen.add(file.id);
          return true;
        });
      } else if (folderFilter === 'ROOT') {
        filesData = await knowledgeService.getFiles().catch(() => []);
      } else {
        filesData = await knowledgeService.getFiles(folderFilter).catch(() => []);
      }

      setStats(statsData);
      setFolders(foldersData);
      setFiles(filesData);
      setProductCount(prodStats?.total || 0);
      setCategoryCount(catStats?.totalCategories || 0);
    } catch (err: any) {
      console.error('Failed to load Knowledge Base data:', err);
      if (err.message?.includes('409') || err.message?.includes('Configure the Perfox')) {
        setPlatformWarning(
          'The Knowledge Base requires an active Perfox connection. Please configure credentials in the Developer Hub.'
        );
      } else {
        setError(err.message || 'Failed to load knowledge base data.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedFolderId);
  }, [selectedFolderId]);

  // Filtered Files
  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      // Folder filter
      if (selectedFolderId === 'ROOT' && file.folderId) return false;
      if (selectedFolderId !== 'ALL' && selectedFolderId !== 'ROOT' && file.folderId !== selectedFolderId) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'ALL' && file.status !== statusFilter) {
        return false;
      }

      // Search query filter
      if (debouncedSearch.trim()) {
        const query = debouncedSearch.toLowerCase();
        const matchesName = file.name.toLowerCase().includes(query);
        const matchesFolder = (file.folderName || '').toLowerCase().includes(query);
        const matchesMime = (file.mimeType || '').toLowerCase().includes(query);
        return matchesName || matchesFolder || matchesMime;
      }

      return true;
    });
  }, [files, selectedFolderId, statusFilter, debouncedSearch]);

  // Checkbox helpers
  const isAllSelected =
    filteredFiles.length > 0 && filteredFiles.every((f) => selectedFileIds.includes(f.id));
  const isSomeSelected = selectedFileIds.length > 0 && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedFileIds([]);
    } else {
      setSelectedFileIds(filteredFiles.map((f) => f.id));
    }
  };

  const handleToggleSelectFile = (id: string) => {
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Option A: Upload File from PC
  const handleUploadSubmit = async () => {
    if (!selectedUploadFile) {
      setUploadError('Please choose a file from your computer.');
      return;
    }

    if (selectedUploadFile.size > 25 * 1024 * 1024) {
      setUploadError('File size exceeds the 25MB limit.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const uploaded = await knowledgeService.uploadRawFile(
        selectedUploadFile,
        modalDestinationFolder || undefined
      );

      setToastMessage({
        text: `"${uploaded.name}" uploaded successfully! Indexing in background.`,
        type: 'success',
      });
      setSelectedUploadFile(null);
      setIsImportModalOpen(false);
      await loadData(selectedFolderId);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  // Option B: Generate .md from Catalog
  const handleGenerateCatalogSubmit = async () => {
    if (!includeProducts && !includeCategories) {
      setCatalogError('Please select at least products or categories.');
      return;
    }

    setIsGeneratingCatalog(true);
    setCatalogError(null);

    try {
      const result = await knowledgeService.generateCatalog({
        folderId: modalDestinationFolder || undefined,
        includeProducts,
        includeCategories,
        template: selectedTemplate,
        replaceExisting: true,
      });

      setToastMessage({
        text: `Compiled ${result.productCount} product(s) and ${result.categoryCount} category(ies) into "${result.file.name}"!`,
        type: 'success',
      });
      setIsImportModalOpen(false);
      await loadData(selectedFolderId);
    } catch (err: any) {
      setCatalogError(err.message || 'Failed to generate catalog markdown.');
    } finally {
      setIsGeneratingCatalog(false);
    }
  };

  // Unified Modal Submit Handler
  const handleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeImportTab === 'pc') {
      handleUploadSubmit();
    } else {
      handleGenerateCatalogSubmit();
    }
  };

  // Create Article Submit Handler
  const handleCreateArticleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = articleTitle.trim();
    const content = articleContent.trim();

    if (!title) {
      setCreateArticleError('Article title is required.');
      return;
    }
    if (!content) {
      setCreateArticleError('Article content is required.');
      return;
    }

    setIsPublishingArticle(true);
    setCreateArticleError(null);

    try {
      let targetFolderId: string | undefined = undefined;

      if (articleCategory && articleCategory !== 'ROOT' && articleCategory !== 'General') {
        const matched = folders.find(
          (f) => f.id === articleCategory || f.name.toLowerCase() === articleCategory.toLowerCase()
        );
        if (matched) {
          targetFolderId = matched.id;
        } else {
          try {
            const newFolder = await knowledgeService.createFolder({ name: articleCategory });
            targetFolderId = newFolder.id;
          } catch {
            // Fallback if folder creation is optional
          }
        }
      }

      const uploaded = await knowledgeService.createMarkdownFile({
        name: title,
        content,
        folderId: targetFolderId,
      });

      setToastMessage({
        text: `Article "${uploaded.name || title}" published successfully!`,
        type: 'success',
      });
      setArticleTitle('');
      setArticleContent('');
      setArticleCategory('');
      setArticleEditorTab('write');
      setIsCreateArticleOpen(false);
      await loadData(selectedFolderId);
    } catch (err: any) {
      setCreateArticleError(err.message || 'Failed to publish article.');
    } finally {
      setIsPublishingArticle(false);
    }
  };

  // Insert markdown snippet into article content
  const handleInsertMarkdownSnippet = (snippet: string) => {
    setArticleContent((prev) => (prev ? `${prev}\n\n${snippet}` : snippet));
  };

  // Create Folder
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) {
      setCreateFolderError('Folder name is required.');
      return;
    }

    setIsCreatingFolder(true);
    setCreateFolderError(null);

    try {
      const created = await knowledgeService.createFolder({
        name: newFolderName.trim(),
        parentId: newFolderParentId ? newFolderParentId : undefined,
      });

      setToastMessage({
        text: `Folder "${created.name}" created successfully.`,
        type: 'success',
      });
      setNewFolderName('');
      setNewFolderParentId('');
      setIsCreateFolderOpen(false);
      setModalDestinationFolder(created.id);
      await loadData(selectedFolderId);
    } catch (err: any) {
      setCreateFolderError(err.message || 'Failed to create folder.');
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // Delete Folder
  const handleDeleteFolder = async (folderId: string, folderName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete folder "${folderName}"?`)) return;

    try {
      const res = await knowledgeService.deleteFolder(folderId);
      setToastMessage({
        text: `Folder "${folderName}" deleted.${res.affectedAgents?.length ? ` Affected agents: ${res.affectedAgents.join(', ')}` : ''}`,
        type: 'success',
      });
      if (selectedFolderId === folderId) {
        setSelectedFolderId('ROOT');
      }
      await loadData(selectedFolderId === folderId ? 'ROOT' : selectedFolderId);
    } catch (err: any) {
      setToastMessage({
        text: err.message || 'Failed to delete folder.',
        type: 'error',
      });
    }
  };

  // Toggle tree expansion
  const toggleFolderExpanded = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (selectedFolderId === 'ALL') {
      return [{ id: 'ALL', name: 'All Documents' }];
    }
    if (selectedFolderId === 'ROOT') {
      return [{ id: 'ROOT', name: 'Root' }];
    }
    const crumbs: { id: string; name: string }[] = [];
    let curr: KbFolder | undefined = folders.find((f) => f.id === selectedFolderId);
    while (curr) {
      crumbs.unshift({ id: curr.id, name: curr.name });
      if (!curr.parentId) break;
      curr = folders.find((f) => f.id === curr?.parentId);
    }
    return [{ id: 'ROOT', name: 'Root' }, ...crumbs];
  }, [selectedFolderId, folders]);

  // Child folders in active view
  const currentChildFolders = useMemo(() => {
    if (selectedFolderId === 'ALL') return [];
    if (selectedFolderId === 'ROOT') return folders.filter((f) => !f.parentId);
    return folders.filter((f) => f.parentId === selectedFolderId);
  }, [selectedFolderId, folders]);

  // Test Knowledge Search
  const handleTestSearch = () => {
    if (!testQuery.trim()) return;
    setIsTestingSearch(true);
    setTimeout(() => {
      const q = testQuery.toLowerCase();
      const matches = files.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.folderName || '').toLowerCase().includes(q) ||
          (f.mimeType || '').toLowerCase().includes(q)
      );
      setTestResults({ query: testQuery, matches });
      setIsTestingSearch(false);
    }, 350);
  };

  // Delete Single File
  const handleDeleteFile = async () => {
    if (!deleteConfirmFile) return;
    setIsDeleting(true);

    try {
      await knowledgeService.deleteFile(deleteConfirmFile.id);
      setToastMessage({
        text: `"${deleteConfirmFile.name}" removed from knowledge base.`,
        type: 'success',
      });
      setSelectedFileIds((prev) => prev.filter((id) => id !== deleteConfirmFile.id));
      setDeleteConfirmFile(null);
      await loadData(selectedFolderId);
    } catch (err: any) {
      setToastMessage({
        text: `Delete failed: ${err.message || 'Unknown error'}`,
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmFile(null);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedFileIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedFileIds.length} selected files?`)) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      await Promise.all(
        selectedFileIds.map((id) => knowledgeService.deleteFile(id).catch(() => null))
      );
      setToastMessage({
        text: `Removed ${selectedFileIds.length} files from knowledge base.`,
        type: 'success',
      });
      setSelectedFileIds([]);
      await loadData(selectedFolderId);
    } catch (err: any) {
      setToastMessage({ text: `Bulk delete error: ${err.message}`, type: 'error' });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Helper: Format bytes
  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Helper: Get Icon by File Type
  const getFileIcon = (name: string, mime: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf' || mime?.includes('pdf')) {
      return { icon: 'picture_as_pdf', color: 'text-rose-500 bg-rose-50' };
    }
    if (['doc', 'docx'].includes(ext || '') || mime?.includes('word')) {
      return { icon: 'description', color: 'text-blue-500 bg-blue-50' };
    }
    if (['xls', 'xlsx', 'csv'].includes(ext || '') || mime?.includes('sheet') || mime?.includes('csv')) {
      return { icon: 'table_chart', color: 'text-emerald-500 bg-emerald-50' };
    }
    if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext || '') || mime?.includes('image')) {
      return { icon: 'image', color: 'text-purple-500 bg-purple-50' };
    }
    if (ext === 'md' || mime?.includes('markdown')) {
      return { icon: 'edit_note', color: 'text-amber-500 bg-amber-50' };
    }
    return { icon: 'article', color: 'text-slate-500 bg-slate-100' };
  };

  // Helper: Status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Indexed
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Indexing
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Queued
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
            {status || 'Unknown'}
          </span>
        );
    }
  };

  // Find active folder name
  const destinationFolderDisplay = useMemo(() => {
    if (!modalDestinationFolder) return 'Root level';
    const found = folders.find((f) => f.id === modalDestinationFolder);
    return found ? found.name : 'Root level';
  }, [modalDestinationFolder, folders]);

  return (
    <div className="flex flex-col gap-y-space-lg w-full pt-space-xs">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 ${
              toastMessage.type === 'success'
                ? 'bg-emerald-900 text-white border-emerald-700'
                : 'bg-rose-900 text-white border-rose-700'
            }`}
          >
            <Icon name={toastMessage.type === 'success' ? 'check_circle' : 'error'} size="sm" />
            {toastMessage.text}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold flex items-center gap-2.5">
            Knowledge Base
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Import reference files or compile live product catalogs into AI-searchable knowledge.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setArticleTitle('');
              setArticleContent('');
              setArticleCategory(selectedFolderId !== 'ALL' && selectedFolderId !== 'ROOT' ? selectedFolderId : 'Orders & Checkout');
              setCreateArticleError(null);
              setIsCreateArticleOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-container bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-label-md text-label-md font-semibold transition-all shadow-2xs cursor-pointer"
          >
            <Icon name="add" size="sm" />
            <span>Create Article</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setModalDestinationFolder(selectedFolderId === 'ALL' || selectedFolderId === 'ROOT' ? '' : selectedFolderId);
              setSelectedUploadFile(null);
              setUploadError(null);
              setCatalogError(null);
              setIsImportModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-label-md text-label-md font-semibold transition-all shadow-xs cursor-pointer"
          >
            <Icon name="upload_file" size="sm" />
            <span>Import</span>
          </button>
        </div>
      </div>

      {/* Platform Connection Notice */}
      {platformWarning && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Icon name="warning" className="text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-amber-800">
            <span className="font-semibold">Platform Setup Notice:</span> {platformWarning}
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
        <MetricsCard
          title="Total Documents"
          value={stats ? String(stats.totalFiles) : '0'}
          trend={`${folders.length} folder${folders.length === 1 ? '' : 's'}`}
          trendType="neutral"
          icon="description"
        />
        <MetricsCard
          title="Indexed & Searchable"
          value={stats ? String(stats.indexedFiles) : '0'}
          trend="Searchable by AI"
          trendType="positive"
          icon="verified"
        />
        <MetricsCard
          title="Indexing / Queued"
          value={stats ? String(stats.notIndexed) : '0'}
          trend="Background processing"
          trendType="neutral"
          icon="hourglass_top"
        />
        <MetricsCard
          title="Total Knowledge Storage"
          value={stats ? formatBytes(stats.totalSizeBytes) : '0 B'}
          trend={`${stats?.totalChunks || 0} vector chunks`}
          trendType="neutral"
          icon="storage"
        />
      </div>

      {/* Main Layout: SOURCES Tree Sidebar + Content Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        {/* Left Sidebar: SOURCES Tree (Col 3 of 12) */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 space-y-3.5 flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Icon name="folder_open" size="sm" className="text-slate-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                SOURCES
              </span>
            </div>
          </div>

          {/* Tree Navigation */}
          <div className="space-y-1 font-medium text-xs">
            {/* All Documents */}
            <button
              type="button"
              onClick={() => setSelectedFolderId('ALL')}
              className={`w-full text-left px-3 py-2 rounded-xl flex items-center transition-all ${
                selectedFolderId === 'ALL'
                  ? 'bg-primary/10 text-primary font-semibold border border-primary/20 shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Icon
                  name="description"
                  size="xs"
                  className={selectedFolderId === 'ALL' ? 'text-primary' : 'text-slate-400'}
                />
                <span className="truncate">All Documents</span>
              </div>
            </button>

            {/* Manual Uploads / Root */}
            <div>
              <div
                onClick={() => setSelectedFolderId('ROOT')}
                className={`w-full text-left px-3 py-2 rounded-xl flex items-center cursor-pointer transition-all ${
                  selectedFolderId === 'ROOT'
                    ? 'bg-primary/10 text-primary font-semibold border border-primary/20 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <button
                    type="button"
                    onClick={(e) => toggleFolderExpanded('ROOT', e)}
                    className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                  >
                    <Icon
                      name={expandedFolderIds.has('ROOT') || expandedFolderIds.size === 0 ? 'expand_more' : 'chevron_right'}
                      size="xs"
                    />
                  </button>
                  <Icon name="folder" size="xs" className="text-amber-500" />
                  <span className="truncate">Manual Uploads</span>
                </div>
              </div>

              {/* Top-level and nested folder hierarchy */}
              <div className="pl-3.5 space-y-0.5 mt-1 border-l border-slate-100 ml-3">
                {folders
                  .filter((f) => !f.parentId)
                  .map((folder) => {
                    const hasKids = folders.some((child) => child.parentId === folder.id);
                    const isExpanded = expandedFolderIds.has(folder.id);
                    const isSelected = selectedFolderId === folder.id;

                    return (
                      <div key={folder.id} className="space-y-0.5">
                        <div
                          onClick={() => setSelectedFolderId(folder.id)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-primary/10 text-primary font-semibold border border-primary/20 shadow-2xs'
                              : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                          title={folder.summary || folder.name}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {hasKids ? (
                              <button
                                type="button"
                                onClick={(e) => toggleFolderExpanded(folder.id, e)}
                                className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
                              >
                                <Icon name={isExpanded ? 'expand_more' : 'chevron_right'} size="xs" />
                              </button>
                            ) : (
                              <span className="w-3 inline-block text-center text-slate-300 text-[10px]">•</span>
                            )}
                            <Icon
                              name="folder"
                              size="xs"
                              className={isSelected ? 'text-primary' : 'text-amber-500'}
                            />
                            <span className="truncate text-xs">{folder.name}</span>
                          </div>
                        </div>

                        {/* Children if expanded */}
                        {hasKids && (isExpanded || isSelected) && (
                          <div className="pl-3.5 space-y-0.5 border-l border-slate-200/60 ml-2.5 my-0.5">
                            {folders
                              .filter((c) => c.parentId === folder.id)
                              .map((child) => {
                                const isChildSelected = selectedFolderId === child.id;
                                return (
                                  <div
                                    key={child.id}
                                    onClick={() => setSelectedFolderId(child.id)}
                                    className={`w-full text-left px-2.5 py-1 rounded-lg flex items-center cursor-pointer transition-all text-xs ${
                                      isChildSelected
                                        ? 'bg-primary/10 text-primary font-semibold border border-primary/20 shadow-2xs'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 truncate">
                                      <Icon name="folder" size="xs" className="text-amber-400" />
                                      <span className="truncate">{child.name}</span>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Area: Explorer Table (Col 9 of 12) */}
        <div className="lg:col-span-9 bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col p-5 sm:p-6 space-y-4">
          {/* Top Bar: Search, Refresh, New Folder, Upload */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            {/* Left: Filter files + Refresh */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter files..."
                  className="w-52 sm:w-64 text-xs rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <Icon name="search" size="xs" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>

              <button
                type="button"
                onClick={() => loadData(selectedFolderId)}
                title="Refresh documents"
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-2xs cursor-pointer"
              >
                <Icon name="sync" size="xs" className={isLoading ? 'animate-spin text-primary' : ''} />
              </button>
            </div>

            {/* Right: New Folder + Upload Action Buttons */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setNewFolderParentId(selectedFolderId !== 'ALL' && selectedFolderId !== 'ROOT' ? selectedFolderId : '');
                  setNewFolderName('');
                  setCreateFolderError(null);
                  setIsCreateFolderOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
              >
                <Icon name="create_new_folder" size="xs" className="text-slate-500" />
                <span>New Folder</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModalDestinationFolder(selectedFolderId === 'ALL' || selectedFolderId === 'ROOT' ? '' : selectedFolderId);
                  setSelectedUploadFile(null);
                  setUploadError(null);
                  setCatalogError(null);
                  setIsImportModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Icon name="upload" size="xs" />
                <span>Upload</span>
              </button>
            </div>
          </div>

          {/* Breadcrumb Path */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium flex-wrap py-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1">PATH:</span>
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <React.Fragment key={crumb.id}>
                  {idx > 0 && <span className="text-slate-300 select-none">›</span>}
                  <button
                    type="button"
                    onClick={() => setSelectedFolderId(crumb.id)}
                    className={`px-1.5 py-0.5 rounded-md transition-colors ${
                      isLast
                        ? 'font-bold text-slate-900 bg-slate-100'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {crumb.name}
                  </button>
                </React.Fragment>
              );
            })}
          </div>

          {/* Table of Subfolders & Files */}
          <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-2xs">
            <table className="w-full text-left text-xs sm:text-sm text-slate-600">
              <thead className="bg-slate-50/90 text-slate-400 font-bold text-[10px] border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => el && (el.indeterminate = isSomeSelected)}
                      onChange={handleToggleSelectAll}
                      className="rounded text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                    />
                  </th>
                  <th className="py-3.5 px-4">NAME</th>
                  <th className="py-3.5 px-3">STATUS</th>
                  <th className="py-3.5 px-3">CHUNKS</th>
                  <th className="py-3.5 px-3">SIZE</th>
                  <th className="py-3.5 px-3">UPDATED</th>
                  <th className="py-3.5 px-4 text-right">ACTIONS</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Icon name="sync" className="animate-spin text-primary" size="md" />
                        <span className="text-xs font-medium">Loading knowledge documents...</span>
                      </div>
                    </td>
                  </tr>
                )}

                {/* 1. Render Child Subfolders inside this level */}
                {!isLoading &&
                  currentChildFolders.map((subfolder) => (
                    <tr
                      key={`subfolder-${subfolder.id}`}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => setSelectedFolderId(subfolder.id)}
                    >
                      <td className="py-3.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <span className="w-3.5 inline-block text-slate-300">•</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center shrink-0 border border-amber-100">
                            <Icon name="folder" size="xs" />
                          </div>
                          <span className="font-semibold text-slate-800 hover:text-primary hover:underline transition-colors">
                            {subfolder.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-xs text-slate-400">—</td>
                      <td className="py-3.5 px-3 text-xs text-slate-400">—</td>
                      <td className="py-3.5 px-3 text-xs text-slate-400">—</td>
                      <td className="py-3.5 px-3 text-xs text-slate-500 whitespace-nowrap">
                        {subfolder.updatedAt
                          ? new Date(subfolder.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => handleDeleteFolder(subfolder.id, subfolder.name, e)}
                            className="text-xs text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete folder"
                          >
                            <Icon name="delete" size="xs" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                {/* 2. Render Files */}
                {!isLoading &&
                  filteredFiles.map((file) => {
                    const isSelected = selectedFileIds.includes(file.id);
                    const { icon, color } = getFileIcon(file.name, file.mimeType);

                    return (
                      <tr
                        key={file.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isSelected ? 'bg-primary/5' : ''
                        }`}
                      >
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectFile(file.id)}
                            className="rounded text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                          />
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${color}`}>
                              <Icon name={icon} size="xs" />
                            </div>
                            <div className="truncate max-w-xs sm:max-w-md">
                              <span className="font-semibold text-slate-800 block truncate text-xs sm:text-sm" title={file.name}>
                                {file.name}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {renderStatusBadge(file.status)}
                        </td>

                        <td className="py-3.5 px-3 text-xs text-slate-600">
                          {file.chunkCount || '—'}
                        </td>

                        <td className="py-3.5 px-3 text-xs text-slate-600 whitespace-nowrap">
                          {formatBytes(file.sizeBytes)}
                        </td>

                        <td className="py-3.5 px-3 text-xs text-slate-500 whitespace-nowrap">
                          {file.uploadedAt
                            ? new Date(file.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            : '—'}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmFile(file)}
                              className="text-xs text-rose-600 hover:text-rose-700 font-semibold hover:underline transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                {/* Empty State */}
                {!isLoading && currentChildFolders.length === 0 && filteredFiles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-14 px-4 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                          <Icon name="folder_open" size="lg" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="font-semibold text-slate-800 text-sm">No documents or subfolders</p>
                          <p className="text-xs text-slate-400">Upload files or create folders to organize your knowledge base.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-[11px] text-slate-400 pt-1 flex items-center justify-between">
            <span>
              Showing {filteredFiles.length} file{filteredFiles.length === 1 ? '' : 's'}
              {currentChildFolders.length > 0 ? ` and ${currentChildFolders.length} subfolder${currentChildFolders.length === 1 ? '' : 's'}` : ''}
            </span>
            {selectedFileIds.length > 0 && (
              <span className="font-semibold text-primary">
                {selectedFileIds.length} item{selectedFileIds.length === 1 ? '' : 's'} selected
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: Import Knowledge Base Articles (EXACT MATCH TO SCREENSHOT)         */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-4xl w-full p-6 sm:p-7 space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 shadow-sm border border-blue-100">
                  <Icon name="description" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">
                      Import Knowledge Base Articles
                    </h3>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 tracking-wide">
                      Importer
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select your preferred source to bulk import or auto-generate markdown articles
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>

            <form onSubmit={handleModalSubmit} className="space-y-5">
              {/* Top Destination Bar */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shrink-0 shadow-2xs">
                    <Icon name="folder_special" size="sm" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      DESTINATION
                    </span>
                    <span className="text-sm font-semibold text-slate-800">
                      {destinationFolderDisplay}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select
                      value={modalDestinationFolder}
                      onChange={(e) => setModalDestinationFolder(e.target.value)}
                      className="text-xs font-medium rounded-xl border border-slate-200 bg-white pl-3 pr-8 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-2xs appearance-none cursor-pointer"
                    >
                      <option value="">Root level</option>
                      {folders.map((folder) => {
                        const indent = folder.depth && folder.depth > 0 ? `${'\u00A0\u00A0'.repeat(folder.depth)}↳ ` : '';
                        return (
                          <option key={folder.id} value={folder.id}>
                            {indent}{folder.name}
                          </option>
                        );
                      })}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                      <Icon name="expand_more" size="xs" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setNewFolderParentId(modalDestinationFolder || '');
                      setNewFolderName('');
                      setCreateFolderError(null);
                      setIsCreateFolderOpen(true);
                    }}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
                  >
                    <Icon name="create_new_folder" size="sm" />
                    New folder
                  </button>
                </div>
              </div>

              {/* Two Option Cards Side-by-Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ------------------------------------------------------------- */}
                {/* Option A: Files & Cloud Storage                              */}
                {/* ------------------------------------------------------------- */}
                <div
                  onClick={() => setActiveImportTab('pc')}
                  className={`relative rounded-2xl p-5 border-2 transition-all flex flex-col justify-between cursor-pointer ${
                    activeImportTab === 'pc'
                      ? 'border-blue-500 bg-blue-50/10 shadow-sm ring-2 ring-blue-500/10'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  {/* Top Badge */}
                  <div className="absolute -top-3 right-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white tracking-wider uppercase shadow-xs">
                      RECOMMENDED
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    {/* Header */}
                    <div className="flex items-start gap-2.5">
                      <div className="text-blue-600 mt-0.5">
                        <Icon name="cloud_upload" size="md" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          Option A: Files & Cloud Storage
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Upload local documents or sync from cloud storage providers (PDF, Word, TXT, MD, CSV)
                        </p>
                      </div>
                    </div>

                    {/* CONNECT CLOUD PROVIDERS */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                        CONNECT CLOUD PROVIDERS
                      </span>
                      <div className="grid grid-cols-3 gap-1.5 mb-2">
                        <button
                          type="button"
                          disabled
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-[11px] font-medium flex items-center justify-center gap-1 cursor-not-allowed opacity-60"
                        >
                          <Icon name="cloud_off" size="sm" />
                          Google Drive
                        </button>
                        <button
                          type="button"
                          disabled
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-[11px] font-medium flex items-center justify-center gap-1 cursor-not-allowed opacity-60"
                        >
                          <Icon name="cloud_off" size="sm" />
                          Dropbox
                        </button>
                        <button
                          type="button"
                          disabled
                          className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-400 text-[11px] font-medium flex items-center justify-center gap-1 cursor-not-allowed opacity-60"
                        >
                          <Icon name="cloud_off" size="sm" />
                          OneDrive
                        </button>
                      </div>

                      {/* Local PC Active Selector */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl border-2 border-slate-800 bg-white text-slate-900 text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:bg-slate-50 transition-colors"
                      >
                        <Icon name="computer" size="sm" />
                        Local PC
                      </button>
                    </div>

                    {/* Dropzone Box */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          if (file.size > 25 * 1024 * 1024) {
                            setUploadError('File exceeds 25MB limit.');
                            setSelectedUploadFile(null);
                          } else {
                            setSelectedUploadFile(file);
                            setUploadError(null);
                            setActiveImportTab('pc');
                          }
                        }
                      }}
                      accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.md,.txt,.json,.jpg,.jpeg,.png,.webp"
                      className="hidden"
                    />

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-colors ${
                        selectedUploadFile
                          ? 'border-blue-500 bg-blue-50/40'
                          : 'border-blue-300/80 bg-blue-50/20 hover:border-blue-500 hover:bg-blue-50/40'
                      }`}
                    >
                      {selectedUploadFile ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-2xs">
                            <Icon name="description" />
                          </div>
                          <span className="font-bold text-xs text-slate-800 truncate max-w-xs block">
                            {selectedUploadFile.name}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {formatBytes(selectedUploadFile.size)}
                          </span>
                          <span className="text-[11px] font-semibold text-blue-600 underline mt-0.5">
                            Click to change file
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-slate-500">
                          <div className="w-9 h-9 rounded-xl bg-blue-100/70 text-blue-600 flex items-center justify-center">
                            <Icon name="upload" size="sm" />
                          </div>
                          <span className="font-bold text-xs text-slate-800">
                            Drag & drop files here
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Supports .md, .pdf, .docx, .json up to 25.0 MB
                          </span>
                        </div>
                      )}
                    </div>

                    {uploadError && activeImportTab === 'pc' && (
                      <p className="text-xs text-rose-600 font-medium">{uploadError}</p>
                    )}
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* Option B: Generate .md from Catalog                           */}
                {/* ------------------------------------------------------------- */}
                <div
                  onClick={() => setActiveImportTab('catalog')}
                  className={`relative rounded-2xl p-5 border-2 transition-all flex flex-col justify-between cursor-pointer ${
                    activeImportTab === 'catalog'
                      ? 'border-emerald-500 bg-emerald-50/10 shadow-sm ring-2 ring-emerald-500/10'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  {/* Top Badge */}
                  <div className="absolute -top-3 right-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white tracking-wider uppercase shadow-xs">
                      SMART CATALOG SYNC
                    </span>
                  </div>

                  <div className="space-y-3.5">
                    {/* Header */}
                    <div className="flex items-start gap-2.5">
                      <div className="text-emerald-600 mt-0.5">
                        <Icon name="auto_stories" size="md" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          Option B: Generate .md from Catalog
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                          Automatically compile dynamic Markdown knowledge articles directly from your existing Products and Categories inventory
                        </p>
                      </div>
                    </div>

                    {/* SOURCE SELECTOR */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        SOURCE SELECTOR
                      </span>

                      <label className="flex items-center gap-2 text-xs text-slate-800 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeProducts}
                          onChange={(e) => {
                            setIncludeProducts(e.target.checked);
                            setActiveImportTab('catalog');
                          }}
                          className="rounded text-primary focus:ring-primary h-4 w-4"
                        />
                        <span>Include all products ({productCount || 11})</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-slate-800 font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeCategories}
                          onChange={(e) => {
                            setIncludeCategories(e.target.checked);
                            setActiveImportTab('catalog');
                          }}
                          className="rounded text-primary focus:ring-primary h-4 w-4"
                        />
                        <span>Include categories ({categoryCount || 7})</span>
                      </label>

                      <div className="flex items-start gap-1.5 text-[11px] text-slate-400 italic pt-1">
                        <Icon name="info" size="sm" className="shrink-0 mt-0.5 text-slate-400" />
                        <span>Price and stock are left out — they change, and an indexed document would keep answering with the old value.</span>
                      </div>
                    </div>

                    {/* Template Selector */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <label className="text-xs font-semibold text-slate-700 shrink-0">
                        Template
                      </label>
                      <select
                        value={selectedTemplate}
                        onChange={(e) => {
                          setSelectedTemplate(e.target.value as any);
                          setActiveImportTab('catalog');
                        }}
                        className="text-xs font-medium rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-2xs flex-1 max-w-[220px]"
                      >
                        <option value="qa">Structured Q&A / FAQ Markdown</option>
                        <option value="reference">Product Catalog Reference</option>
                      </select>
                    </div>

                    {/* Green Check Banner */}
                    <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-2.5 flex items-center gap-2 text-xs text-emerald-800 font-medium">
                      <Icon name="check_circle" size="sm" className="text-emerald-600 shrink-0" />
                      <span>
                        Generates one markdown file covering {productCount || 11} products and {categoryCount || 7} categories, ready to publish into the knowledge base
                      </span>
                    </div>

                    {catalogError && activeImportTab === 'catalog' && (
                      <p className="text-xs text-rose-600 font-medium">{catalogError}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Icon name="info" size="sm" className="text-slate-400" />
                  <span>Files are uploaded to Perfox and only answer queries once it has indexed them.</span>
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsImportModalOpen(false)}
                    disabled={isUploading || isGeneratingCatalog}
                    className="px-4 py-2 text-xs"
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={
                      (activeImportTab === 'pc' && (!selectedUploadFile || isUploading)) ||
                      (activeImportTab === 'catalog' && isGeneratingCatalog)
                    }
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs px-5 py-2 font-semibold shadow-xs"
                  >
                    {isUploading || isGeneratingCatalog ? (
                      <>
                        <Icon name="sync" className="animate-spin" size="sm" />
                        {activeImportTab === 'pc' ? 'Uploading...' : 'Generating Catalog...'}
                      </>
                    ) : (
                      <>
                        <Icon name="cloud_upload" size="sm" />
                        {activeImportTab === 'pc' ? 'Upload files' : 'Generate & Sync'}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Create Article (ENHANCED UI)                                       */}
      {/* ========================================================================= */}
      {isCreateArticleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-2xl w-full p-6 sm:p-7 space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                  <Icon name="edit_note" size="md" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">Create Article</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 uppercase tracking-wider">
                      Knowledge Base
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateArticleOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>

            <form onSubmit={handleCreateArticleSubmit} className="space-y-4">
              {createArticleError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <Icon name="error" size="sm" />
                  {createArticleError}
                </div>
              )}

              {/* Field 1: Article Title */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800">
                    Article Title <span className="text-rose-500">*</span>
                  </label>
                  {articleTitle.trim() && (
                    <span className="text-[10px] font-medium text-slate-400">
                      Saved as: <code className="font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{articleTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'article'}.md</code>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <Icon name="title" size="sm" />
                  </div>
                  <input
                    type="text"
                    value={articleTitle}
                    onChange={(e) => setArticleTitle(e.target.value)}
                    placeholder="e.g. Return and Replacement Guidelines"
                    required
                    className="w-full text-xs sm:text-sm rounded-xl border border-blue-200/80 bg-blue-50/15 pl-10 pr-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all shadow-2xs font-medium"
                  />
                </div>
              </div>

              {/* Field 2: Target Folder */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Target Folder
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-amber-500">
                    <Icon name="folder" size="sm" />
                  </div>
                  <select
                    value={articleCategory}
                    onChange={(e) => setArticleCategory(e.target.value)}
                    className="w-full text-xs sm:text-sm rounded-xl border border-blue-200/80 bg-blue-50/15 pl-10 pr-10 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white appearance-none transition-all cursor-pointer shadow-2xs font-medium"
                  >
                    <option value="">Root level (No folder)</option>
                    {folders.map((folder) => {
                      const indent = folder.depth && folder.depth > 0 ? `${'\u00A0\u00A0'.repeat(folder.depth)}↳ ` : '';
                      return (
                        <option key={folder.id} value={folder.id}>
                          {indent}{folder.name}
                        </option>
                      );
                    })}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
                    <Icon name="expand_more" size="sm" />
                  </div>
                </div>
              </div>


              {/* Field 3: Content (Markdown) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <span>Content (Markdown)</span>
                    <span className="text-rose-500">*</span>
                  </label>

                  <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setArticleEditorTab('write')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        articleEditorTab === 'write'
                          ? 'bg-white text-blue-700 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setArticleEditorTab('preview')}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        articleEditorTab === 'preview'
                          ? 'bg-white text-blue-700 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Preview
                    </button>
                  </div>
                </div>

                {/* Markdown Formatting Helper Toolbar */}
                {articleEditorTab === 'write' && (
                  <div className="flex flex-wrap items-center justify-between gap-1 p-1.5 bg-slate-50 rounded-xl border border-slate-200/80">
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleInsertMarkdownSnippet('## Section Heading')}
                        className="px-2 py-0.5 text-[11px] font-bold rounded-md hover:bg-slate-200 text-slate-700"
                        title="Heading 2"
                      >
                        H2
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertMarkdownSnippet('### Subsection')}
                        className="px-2 py-0.5 text-[11px] font-bold rounded-md hover:bg-slate-200 text-slate-700"
                        title="Heading 3"
                      >
                        H3
                      </button>
                      <span className="w-px h-3.5 bg-slate-300 mx-0.5"></span>
                      <button
                        type="button"
                        onClick={() => handleInsertMarkdownSnippet('**bold text**')}
                        className="px-2 py-0.5 text-[11px] font-bold rounded-md hover:bg-slate-200 text-slate-700"
                        title="Bold"
                      >
                        <b>B</b>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertMarkdownSnippet('*italic text*')}
                        className="px-2 py-0.5 text-[11px] italic rounded-md hover:bg-slate-200 text-slate-700"
                        title="Italic"
                      >
                        <i>I</i>
                      </button>
                      <span className="w-px h-3.5 bg-slate-300 mx-0.5"></span>
                      <button
                        type="button"
                        onClick={() => handleInsertMarkdownSnippet('- List item\n- Second item')}
                        className="px-2 py-0.5 text-[11px] rounded-md hover:bg-slate-200 text-slate-700 flex items-center gap-1"
                        title="Bullet List"
                      >
                        <Icon name="format_list_bulleted" size="xs" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertMarkdownSnippet('> **Note:** Important customer guideline')}
                        className="px-2 py-0.5 text-[11px] rounded-md hover:bg-slate-200 text-slate-700 flex items-center gap-1"
                        title="Callout Quote"
                      >
                        <Icon name="format_quote" size="xs" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertMarkdownSnippet('| Policy | Details |\n| --- | --- |\n| Return window | 30 days |')}
                        className="px-2 py-0.5 text-[11px] rounded-md hover:bg-slate-200 text-slate-700 flex items-center gap-1"
                        title="Markdown Table"
                      >
                        <Icon name="table_chart" size="xs" />
                      </button>
                    </div>

                    <span className="text-[10px] text-slate-400 pr-1 font-medium">
                      {articleContent.trim() ? `${articleContent.trim().split(/\s+/).length} words` : '0 words'}
                    </span>
                  </div>
                )}

                {articleEditorTab === 'write' ? (
                  <textarea
                    rows={6}
                    value={articleContent}
                    onChange={(e) => setArticleContent(e.target.value)}
                    placeholder="Write article instructions or guidelines..."
                    required
                    className="w-full text-xs sm:text-sm rounded-xl border border-blue-200/80 bg-blue-50/15 p-3.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all resize-y shadow-2xs font-mono leading-relaxed"
                  />
                ) : (
                  <div className="min-h-[150px] max-h-[220px] overflow-y-auto p-4 rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm text-slate-800 space-y-2.5">
                    {renderSimpleMarkdown(articleContent)}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  {/* <Icon name="bolt" size="xs" className="text-amber-500" /> */}
                  {/* <span>Auto-indexed for AI customer support queries.</span> */}
                </div>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsCreateArticleOpen(false)}
                    disabled={isPublishingArticle}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!articleTitle.trim() || !articleContent.trim() || isPublishingArticle}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl px-5 py-2.5 shadow-sm text-xs flex items-center gap-2"
                  >
                    {isPublishingArticle ? (
                      <>
                        <Icon name="sync" className="animate-spin" size="xs" />
                        Publishing...
                      </>
                    ) : (
                      'Publish Article'
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Create New Folder */}
      {isCreateFolderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Icon name="create_new_folder" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create New Folder</h3>
                  <p className="text-xs text-slate-500">Group related articles and reference files</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateFolderOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <Icon name="close" />
              </button>
            </div>

            <form onSubmit={handleCreateFolderSubmit} className="space-y-4">
              {createFolderError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <Icon name="error" size="sm" />
                  {createFolderError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Folder Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g., Product Catalogues 2026"
                  required
                  className="w-full text-sm rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Parent Folder (Optional)
                </label>
                <div className="relative">
                  <select
                    value={newFolderParentId}
                    onChange={(e) => setNewFolderParentId(e.target.value)}
                    className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                  >
                    <option value="">Root level (Top-level folder)</option>
                    {folders.map((folder) => {
                      const indent = folder.depth && folder.depth > 0 ? `${'\u00A0\u00A0'.repeat(folder.depth)}↳ ` : '';
                      return (
                        <option key={folder.id} value={folder.id}>
                          {indent}{folder.name}
                        </option>
                      );
                    })}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                    <Icon name="expand_more" size="sm" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Nest this folder inside an existing folder, or leave as Root level.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateFolderOpen(false)}
                  disabled={isCreatingFolder}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!newFolderName.trim() || isCreatingFolder}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  {isCreatingFolder ? 'Creating...' : 'Create Folder'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Confirmation */}
      {deleteConfirmFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Icon name="delete_forever" size="lg" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Delete Document</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <span className="font-semibold text-slate-700">"{deleteConfirmFile.name}"</span>? This will permanently remove it from your AI knowledge base.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirmFile(null)}
                disabled={isDeleting}
                className="w-full"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDeleteFile}
                disabled={isDeleting}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
