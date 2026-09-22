import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Button,
  MetricsCard,
  Table,
  TableHead,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableEmptyState,
  SearchInput,
  Icon,
} from '../components/common';
import {
  categoryService,
  CategoryItem,
  CategoryStats,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../services/category.service';
import { useAuth } from '../hooks/useAuth';

interface CategoriesPageProps {
  setActiveModule: (module: string) => void;
}

export default function CategoriesPage({ setActiveModule }: CategoriesPageProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const canEdit = user?.role === 'Admin' || user?.role === 'Editor';

  // Data states
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [stats, setStats] = useState<CategoryStats>({
    totalCategories: 0,
    assignedSkus: 0,
    topDistribution: null,
    averagePerCategory: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'with-products' | 'empty'>('all');
  const [sortBy, setSortBy] = useState<'default' | 'name-asc' | 'products-desc'>('default');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Selection & Bulk Actions
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Modals & Menu State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [deleteConfirmCat, setDeleteConfirmCat] = useState<CategoryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Modal Form State
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formIcon, setFormIcon] = useState('category');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const filterRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss toast after 4s
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFilterOpen]);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const statsData = await categoryService.getCategoryStats();
      setStats(statsData);
    } catch (err: any) {
      console.warn('Could not load category stats:', err);
    }
  }, []);

  // Load categories list from API
  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const hasProductsParam =
        filterType === 'with-products' ? 'true' : filterType === 'empty' ? 'false' : undefined;

      let sortByParam: string | undefined = undefined;
      let sortOrderParam: 'asc' | 'desc' | undefined = undefined;

      if (sortBy === 'name-asc') {
        sortByParam = 'name';
        sortOrderParam = 'asc';
      } else if (sortBy === 'products-desc') {
        sortByParam = 'productsCount';
        sortOrderParam = 'desc';
      }

      const [data] = await Promise.all([
        categoryService.getCategories({
          search: debouncedSearch.trim() || undefined,
          hasProducts: hasProductsParam,
          sortBy: sortByParam,
          sortOrder: sortOrderParam,
        }),
        loadStats(),
      ]);

      setCategories(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load categories from server.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [debouncedSearch, filterType, sortBy, loadStats]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Handle Refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    loadCategories();
  };

  // Export CSV
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      await categoryService.exportCategories();
      setToastMessage({ text: 'Categories exported successfully.', type: 'success' });
    } catch (err: any) {
      setToastMessage({ text: `Export failed: ${err.message || 'Unknown error'}`, type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  // Open Add Modal
  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setFormName('');
    setFormCode('');
    setFormDesc('');
    setFormIcon('category');
    setModalError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormCode(cat.id);
    setFormDesc(cat.description || '');
    setFormIcon(cat.icon || 'category');
    setModalError(null);
    setIsModalOpen(true);
    setOpenDropdownId(null);
  };

  // Save Modal Form (Create or Update)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setModalError('Category name is required.');
      return;
    }

    setIsSubmitting(true);
    setModalError(null);

    try {
      if (editingCategory) {
        // Update existing category
        const payload: UpdateCategoryInput = {
          name: formName.trim(),
          description: formDesc.trim() || 'General category item',
          icon: formIcon,
          color: 'primary',
        };
        await categoryService.updateCategory(editingCategory.id, payload);
        setToastMessage({ text: `Category "${formName}" updated successfully.`, type: 'success' });
      } else {
        // Create new category
        const payload: CreateCategoryInput = {
          id: formCode.trim() || undefined,
          name: formName.trim(),
          description: formDesc.trim() || 'General category item',
          icon: formIcon,
          color: 'primary',
        };
        await categoryService.createCategory(payload);
        setToastMessage({ text: `Category "${formName}" created successfully.`, type: 'success' });
      }

      setIsModalOpen(false);
      await loadCategories();
    } catch (err: any) {
      setModalError(err.message || 'Failed to save category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Single Delete Category
  const handleDeleteCategory = async () => {
    if (!deleteConfirmCat) return;

    setIsDeleting(true);
    try {
      await categoryService.deleteCategory(deleteConfirmCat.id);
      setToastMessage({
        text: `Category "${deleteConfirmCat.name}" was deleted successfully.`,
        type: 'success',
      });
      setSelectedCategoryIds((prev) => prev.filter((id) => id !== deleteConfirmCat.id));
      setDeleteConfirmCat(null);
      await loadCategories();
    } catch (err: any) {
      setToastMessage({
        text: `Cannot delete: ${err.message || 'Operation failed'}`,
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
      setDeleteConfirmCat(null);
    }
  };

  // Bulk Delete Categories
  const handleBulkDelete = async () => {
    if (selectedCategoryIds.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedCategoryIds.length} selected categories?`)) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const result = await categoryService.bulkDeleteCategories(selectedCategoryIds);
      let msg = `Deleted ${result.deleted} categories.`;
      if (result.skipped > 0) {
        msg += ` ${result.skipped} skipped (products still assigned).`;
      }
      setToastMessage({
        text: msg,
        type: result.skipped > 0 ? 'warning' : 'success',
      });
      setSelectedCategoryIds([]);
      await loadCategories();
    } catch (err: any) {
      setToastMessage({
        text: `Bulk delete failed: ${err.message}`,
        type: 'error',
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Select All handlers
  const isAllSelected =
    categories.length > 0 && categories.every((c) => selectedCategoryIds.includes(c.id));
  const isSomeSelected = selectedCategoryIds.length > 0 && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCategoryIds([]);
    } else {
      setSelectedCategoryIds(categories.map((c) => c.id));
    }
  };

  const handleToggleSelectCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      {/* Toast Banner */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            toastMessage.type === 'success'
              ? 'bg-green-900/90 text-green-100 border-green-700/60'
              : toastMessage.type === 'warning'
              ? 'bg-amber-900/90 text-amber-100 border-amber-700/60'
              : 'bg-red-900/90 text-red-100 border-red-700/60'
          }`}
        >
          <Icon
            name={
              toastMessage.type === 'success'
                ? 'check_circle'
                : toastMessage.type === 'warning'
                ? 'warning'
                : 'error'
            }
            size="md"
          />
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-white/70 hover:text-white"
            aria-label="Dismiss"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div className="flex flex-col">
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">Categories</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Organize and classify products across channels
          </p>
        </div>
        <div className="flex items-center gap-space-xs flex-wrap">
          <Button
            variant="hover"
            size="md"
            startIcon="arrow_back"
            onClick={() => setActiveModule('products')}
          >
            Back to Products
          </Button>

          <Button
            variant="soft"
            size="md"
            startIcon={isExporting ? <Icon name="sync" spin size="sm" /> : 'download'}
            onClick={handleExportCSV}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </Button>

          {canEdit && (
            <Button
              variant="primary"
              size="md"
              startIcon="add"
              onClick={handleOpenAddModal}
            >
              Add Category
            </Button>
          )}
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg">
        <MetricsCard
          title="Total Categories"
          value={stats.totalCategories}
          trend="100% active status"
          trendType="positive"
          icon="category"
          variant="primary"
        />

        <MetricsCard
          title="Assigned SKUs"
          value={stats.assignedSkus}
          trend="100% categorized"
          trendType="positive"
          trendIcon="check_circle"
          icon="inventory_2"
          variant="secondary"
        />

        <MetricsCard
          title="Top Distribution"
          value={stats.topDistribution ? stats.topDistribution.name : 'None'}
          subtitle={
            stats.topDistribution
              ? `${stats.topDistribution.percentage}% of catalog inventory`
              : 'No assigned products'
          }
          icon="devices"
          variant="neutral"
        />

        <MetricsCard
          title="Inventory Density"
          value={`${stats.averagePerCategory} avg/cat`}
          trend="Optimal allocation"
          trendType="positive"
          icon="analytics"
          variant="tertiary"
        />
      </div>

      {/* Error Retry Banner */}
      {error && (
        <div className="mb-4 p-4 rounded-xl bg-error-container/40 border border-error/20 flex items-center justify-between">
          <div className="flex items-center gap-3 text-error">
            <Icon name="error" size="md" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <Button variant="danger" size="sm" onClick={loadCategories}>
            Retry
          </Button>
        </div>
      )}

      {/* Primary Content Card & Table Container */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-low/60 flex flex-col relative">
        {/* Filter and Search Header */}
        <div className="p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm bg-surface-container-lowest rounded-t-xl">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search categories..."
          />

          <div className="flex items-center gap-space-xs self-end sm:self-auto relative">
            {/* Filter Dropdown */}
            <div className="relative" ref={filterRef}>
              <Button
                variant={isFilterOpen || filterType !== 'all' || sortBy !== 'default' ? 'soft' : 'hover'}
                size="md"
                startIcon="filter_list"
                endIcon="expand_more"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
              >
                {filterType === 'with-products'
                  ? 'With Products'
                  : filterType === 'empty'
                  ? 'Empty (0)'
                  : sortBy === 'name-asc'
                  ? 'Name A-Z'
                  : sortBy === 'products-desc'
                  ? 'Most Products'
                  : 'Filter'}
              </Button>

              {/* Filter Menu */}
              {isFilterOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl shadow-2xl z-50 py-1.5 border border-slate-200 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10.5px] font-bold text-outline uppercase tracking-wider">
                    Filter By Status
                  </div>
                  {[
                    { id: 'all' as const, label: 'All Categories' },
                    { id: 'with-products' as const, label: 'With Products (>0)' },
                    { id: 'empty' as const, label: 'Empty (0 Products)' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setFilterType(item.id);
                        setIsFilterOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        filterType === item.id
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-on-surface hover:bg-slate-50'
                      }`}
                    >
                      <span>{item.label}</span>
                      {filterType === item.id && (
                        <Icon name="check" size="sm" color="primary" />
                      )}
                    </button>
                  ))}

                  <div className="h-px bg-slate-100 my-1" />

                  <div className="px-3 py-1.5 text-[10.5px] font-bold text-outline uppercase tracking-wider">
                    Sort By
                  </div>
                  {[
                    { id: 'default' as const, label: 'Default Order' },
                    { id: 'name-asc' as const, label: 'Name (A to Z)' },
                    { id: 'products-desc' as const, label: 'Most Products' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSortBy(item.id);
                        setIsFilterOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        sortBy === item.id
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-on-surface hover:bg-slate-50'
                      }`}
                    >
                      <span>{item.label}</span>
                      {sortBy === item.id && (
                        <Icon name="check" size="sm" color="primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <Button
              variant="hover"
              size="icon"
              startIcon={isRefreshing ? <Icon name="refresh" spin color="primary" size="md" /> : 'refresh'}
              onClick={handleRefresh}
              title="Reload categories"
              aria-label="Reload categories"
            />
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedCategoryIds.length > 0 && (
          <div className="px-space-md py-2 bg-primary-container/10 border-y border-primary/20 flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Icon name="check_circle" size="sm" color="primary" />
              <span>{selectedCategoryIds.length} {selectedCategoryIds.length === 1 ? 'category' : 'categories'} selected</span>
            </div>
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Button
                  variant="danger"
                  size="sm"
                  startIcon={isBulkDeleting ? <Icon name="sync" spin size="xs" /> : 'delete'}
                  onClick={handleBulkDelete}
                  disabled={isBulkDeleting}
                >
                  {isBulkDeleting ? 'Deleting...' : 'Delete Selected'}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCategoryIds([])}
              >
                Clear Selection
              </Button>
            </div>
          </div>
        )}

        {/* Categories Data Table */}
        <Table>
          <TableHead>
            <tr>
              <TableHeadCell>
                <div className="flex items-center gap-2">
                  <input
                    className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomeSelected;
                    }}
                    onChange={handleToggleSelectAll}
                    title={isAllSelected ? "Deselect all" : "Select all"}
                  />
                  <span>Name</span>
                </div>
              </TableHeadCell>
              <TableHeadCell>Description</TableHeadCell>
              <TableHeadCell>Products</TableHeadCell>
              <TableHeadCell className="text-right">Actions</TableHeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {isLoading ? (
              // Loading Skeleton
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx}>
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
                    <div className="w-12 h-6 rounded-full bg-surface-container-high animate-pulse" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="w-8 h-8 rounded bg-surface-container-high animate-pulse inline-block" />
                  </TableCell>
                </TableRow>
              ))
            ) : categories.length === 0 ? (
              <TableEmptyState
                icon="category"
                title="No categories found"
                description={
                  searchQuery
                    ? `No categories matched "${searchQuery}". Try a different keyword.`
                    : 'Get started by creating your first product category.'
                }
                colSpan={4}
              />
            ) : (
              categories.map((cat) => {
                const isSelected = selectedCategoryIds.includes(cat.id);
                return (
                  <TableRow
                    key={cat.id}
                    selected={isSelected}
                    className="group"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <input
                          className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectCategory(cat.id)}
                        />
                        <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0">
                          <Icon name={cat.icon || 'category'} size="lg" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-title-sm text-title-sm text-on-surface font-semibold group-hover:text-primary transition-colors truncate">
                            {cat.name}
                          </span>
                          <span className="font-caption text-caption text-on-surface-variant">
                            {cat.id} {cat.updated ? `• Updated ${cat.updated}` : ''}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-on-surface-variant max-w-xs">
                      <span className="truncate block">{cat.description || '—'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm bg-primary-fixed/30 text-on-primary-fixed font-semibold">
                        <Icon name="inventory" size="xs" />
                        <span>{cat.productsCount ?? 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right relative">
                      <div className="inline-flex items-center justify-end gap-1">
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            startIcon="edit"
                            onClick={() => handleOpenEditModal(cat)}
                            title="Edit Category"
                            aria-label="Edit Category"
                          />
                        )}
                        <div className="relative inline-block text-left">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            startIcon="more_horiz"
                            onClick={() => setOpenDropdownId(openDropdownId === cat.id ? null : cat.id)}
                            aria-label="More actions"
                          />
                          {openDropdownId === cat.id && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-surface-container-lowest rounded-xl shadow-xl z-30 py-1.5 border border-surface-container-high">
                              <button
                                type="button"
                                onClick={() => { setActiveModule('products'); setOpenDropdownId(null); }}
                                className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-on-surface font-body-sm text-body-sm hover:bg-surface-container-low transition-colors"
                              >
                                <Icon name="visibility" size="sm" color="outline" />
                                View Products
                              </button>
                              {isAdmin && (
                                <>
                                  <div className="h-px bg-surface-container-high my-1" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteConfirmCat(cat);
                                      setOpenDropdownId(null);
                                    }}
                                    className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-error font-body-sm text-body-sm hover:bg-error-container/30 transition-colors"
                                  >
                                    <Icon name="delete" size="sm" color="error" />
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-surface-container-high p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
              <div className="flex items-center gap-2">
                <Icon name="category" size="lg" color="primary" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                startIcon="close"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
              />
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-error-container/40 border border-error/20 flex items-center gap-2 text-error text-xs font-medium">
                <Icon name="error" size="sm" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface font-medium">Category Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Ergonomic Desks & Seating"
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface font-medium">Category Code</label>
                  <input
                    type="text"
                    disabled={Boolean(editingCategory)}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="CAT-005"
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary uppercase text-sm disabled:opacity-50"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface font-medium">Icon Symbol</label>
                  <select
                    value={formIcon}
                    onChange={(e) => setFormIcon(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-sm"
                  >
                    <option value="category">Default Category</option>
                    <option value="devices">Electronics / Devices</option>
                    <option value="headphones">Accessories</option>
                    <option value="chair">Furniture / Home</option>
                    <option value="apparel">Fashion / Apparel</option>
                    <option value="inventory_2">Inventory / Packages</option>
                    <option value="bolt">Hardware / Power</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface font-medium">Description</label>
                <textarea
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Brief summary of products categorized under this group..."
                  className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary resize-none text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
                <Button
                  variant="ghost"
                  size="md"
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={isSubmitting}
                  startIcon={isSubmitting ? <Icon name="sync" spin size="sm" /> : undefined}
                >
                  {isSubmitting ? 'Saving...' : editingCategory ? 'Update Category' : 'Save Category'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmCat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-surface-container-high p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-error">
              <div className="w-10 h-10 rounded-xl bg-error-container/50 flex items-center justify-center shrink-0">
                <Icon name="warning" size="lg" color="error" />
              </div>
              <div className="flex flex-col">
                <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">Delete Category</h3>
                <span className="text-xs text-on-surface-variant">This action cannot be undone.</span>
              </div>
            </div>

            <p className="text-sm text-on-surface">
              Are you sure you want to delete category <strong>"{deleteConfirmCat.name}"</strong> ({deleteConfirmCat.id})?
            </p>

            {deleteConfirmCat.productsCount > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                <Icon name="info" size="sm" />
                <span>
                  <strong>Note:</strong> This category has {deleteConfirmCat.productsCount} assigned product{deleteConfirmCat.productsCount === 1 ? '' : 's'}. Deleting will be rejected by the server unless products are first reassigned.
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setDeleteConfirmCat(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleDeleteCategory}
                disabled={isDeleting}
                startIcon={isDeleting ? <Icon name="sync" spin size="sm" /> : 'delete'}
              >
                {isDeleting ? 'Deleting...' : 'Delete Category'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
