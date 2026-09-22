import React, { useState, useRef, useEffect } from 'react';
import { INITIAL_CATEGORIES } from '../data/mockData';
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
  Icon
} from '../components/common';

interface CategoriesPageProps {
  setActiveModule: (module: string) => void;
}

export default function CategoriesPage({ setActiveModule }: CategoriesPageProps) {
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Selection state
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);

  // Filter & Refresh states
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'with-products' | 'empty'
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'name-asc' | 'products-desc'
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);

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

  // New Category Form State
  const [newCatName, setNewCatName] = useState('');
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('category');

  // Filtered & Sorted Categories
  const filteredCategories = categories
    .filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterType === 'with-products') return c.productsCount > 0;
      if (filterType === 'empty') return c.productsCount === 0;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'products-desc') return b.productsCount - a.productsCount;
      return 0;
    });

  // Select All handlers
  const isAllSelected =
    filteredCategories.length > 0 &&
    filteredCategories.every((c) => selectedCategoryIds.includes(c.id));
  const isSomeSelected = selectedCategoryIds.length > 0 && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedCategoryIds([]);
    } else {
      setSelectedCategoryIds(filteredCategories.map((c) => c.id));
    }
  };

  const handleToggleSelectCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    setCategories((prev) => prev.filter((c) => !selectedCategoryIds.includes(c.id)));
    setSelectedCategoryIds([]);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setSearchQuery('');
    setFilterType('all');
    setSortBy('default');
    setSelectedCategoryIds([]);
    setTimeout(() => {
      setCategories(INITIAL_CATEGORIES);
      setIsRefreshing(false);
    }, 400);
  };

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;
    const newCategory = {
      id: newCatCode || `CAT-00${categories.length + 1}`,
      name: newCatName,
      description: newCatDesc || 'General category item',
      productsCount: 0,
      updated: 'Just now',
      icon: newCatIcon || 'category',
      color: 'primary'
    };
    setCategories([newCategory, ...categories]);
    setNewCatName('');
    setNewCatCode('');
    setNewCatDesc('');
    setIsAddModalOpen(false);
  };

  const handleDeleteCategory = (id: string) => {
    setCategories(categories.filter((c) => c.id !== id));
    setSelectedCategoryIds((prev) => prev.filter((item) => item !== id));
    setOpenDropdownId(null);
  };

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div className="flex flex-col">
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">Categories</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Organize and classify products across channels
          </p>
        </div>
        <div className="flex items-center gap-space-xs">
          <Button
            variant="hover"
            size="md"
            startIcon="arrow_back"
            onClick={() => setActiveModule('products')}
          >
            Back to Products
          </Button>

          <Button
            variant="primary"
            size="md"
            startIcon="add"
            onClick={() => {
              setNewCatName('');
              setNewCatCode('');
              setNewCatDesc('');
              setIsAddModalOpen(true);
            }}
          >
            Add Category
          </Button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg">
        <MetricsCard
          title="Total Categories"
          value={categories.length}
          trend="100% active status"
          trendType="positive"
          icon="category"
          variant="primary"
        />

        <MetricsCard
          title="Assigned SKUs"
          value={categories.reduce((sum, c) => sum + c.productsCount, 0)}
          trend="100% categorized"
          trendType="positive"
          trendIcon="check_circle"
          icon="inventory_2"
          variant="secondary"
        />

        <MetricsCard
          title="Top Distribution"
          value="Electronics"
          subtitle="33.3% of catalog inventory"
          icon="devices"
          variant="neutral"
        />

        <MetricsCard
          title="Inventory Density"
          value="18.75 avg/cat"
          trend="Optimal allocation"
          trendType="positive"
          icon="analytics"
          variant="tertiary"
        />
      </div>

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

              {/* Short & Clean Filter Menu */}
              {isFilterOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-2xl shadow-2xl z-50 py-1.5 border border-slate-200 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-1.5 text-[10.5px] font-bold text-outline uppercase tracking-wider">
                    Filter By Status
                  </div>
                  {[
                    { id: 'all', label: 'All Categories' },
                    { id: 'with-products', label: 'With Products (>0)' },
                    { id: 'empty', label: 'Empty (0 Products)' },
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
                    { id: 'default', label: 'Default Order' },
                    { id: 'name-asc', label: 'Name (A to Z)' },
                    { id: 'products-desc', label: 'Most Products' },
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

            {/* Refresh Button with Spin Action */}
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

        {/* Bulk Action Bar (When Rows Selected) */}
        {selectedCategoryIds.length > 0 && (
          <div className="px-space-md py-2 bg-primary-container/10 border-y border-primary/20 flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Icon name="check_circle" size="sm" color="primary" />
              <span>{selectedCategoryIds.length} {selectedCategoryIds.length === 1 ? 'category' : 'categories'} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="danger"
                size="sm"
                startIcon="delete"
                onClick={handleBulkDelete}
              >
                Delete Selected
              </Button>
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

        {/* Standardized Data Table */}
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
            {filteredCategories.length === 0 ? (
              <TableEmptyState
                icon="category"
                title="No categories found"
                description="No categories matched your search or filter criteria."
                colSpan={4}
              />
            ) : (
              filteredCategories.map((cat, idx) => {
                const isSelected = selectedCategoryIds.includes(cat.id);
                const isBottomRows = idx >= Math.max(0, filteredCategories.length - 2);
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
                          <Icon name={cat.icon} size="lg" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-title-sm text-title-sm text-on-surface font-semibold group-hover:text-primary transition-colors truncate">
                            {cat.name}
                          </span>
                          <span className="font-caption text-caption text-on-surface-variant">
                            {cat.id} • Updated {cat.updated}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-on-surface-variant max-w-xs">
                      <span className="truncate block">{cat.description}</span>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm bg-primary-fixed/30 text-on-primary-fixed font-semibold">
                        <Icon name="inventory" size="xs" />
                        <span>{cat.productsCount}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right relative">
                      <div className="inline-flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          startIcon="edit"
                          onClick={() => {
                            setNewCatName(cat.name);
                            setNewCatCode(cat.id);
                            setNewCatDesc(cat.description);
                            setIsAddModalOpen(true);
                          }}
                          title="Edit Category"
                          aria-label="Edit Category"
                        />
                        <div className="relative inline-block text-left">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            startIcon="more_horiz"
                            onClick={() => setOpenDropdownId(openDropdownId === cat.id ? null : cat.id)}
                            aria-label="More actions"
                          />
                          {openDropdownId === cat.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20 cursor-default"
                                onClick={() => setOpenDropdownId(null)}
                              />
                              <div
                                className={`absolute right-0 ${
                                  isBottomRows
                                    ? 'bottom-full mb-1.5 origin-bottom-right'
                                    : 'top-full mt-1.5 origin-top-right'
                                } w-44 bg-surface-container-lowest rounded-xl shadow-2xl z-30 py-1.5 border border-surface-container-high animate-in fade-in zoom-in-95`}
                              >
                                <button
                                  type="button"
                                  onClick={() => { setActiveModule('products'); setOpenDropdownId(null); }}
                                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-on-surface font-body-sm text-body-sm hover:bg-surface-container-low transition-colors"
                                >
                                  <Icon name="visibility" size="sm" color="outline" />
                                  View Products
                                </button>
                                <div className="h-px bg-surface-container-high my-1" />
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(cat.id)}
                                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-error font-body-sm text-body-sm hover:bg-error-container/30 transition-colors"
                                >
                                  <Icon name="delete" size="sm" color="error" />
                                  Delete
                                </button>
                              </div>
                            </>
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
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm">
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-surface-container-high p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
              <div className="flex items-center gap-2">
                <Icon name="category" size="lg" color="primary" />
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  {newCatCode ? 'Edit Category' : 'Add New Category'}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                startIcon="close"
                onClick={() => setIsAddModalOpen(false)}
                aria-label="Close modal"
              />
            </div>

            <form onSubmit={handleAddCategorySubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface">Category Name *</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Ergonomic Desks & Seating"
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface">Category Code</label>
                  <input
                    type="text"
                    value={newCatCode}
                    onChange={(e) => setNewCatCode(e.target.value)}
                    placeholder="CAT-005"
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary uppercase"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface">Icon Symbol</label>
                  <select
                    value={newCatIcon}
                    onChange={(e) => setNewCatIcon(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary"
                  >
                    <option value="category">Default Category</option>
                    <option value="devices">Electronics / Devices</option>
                    <option value="headphones">Accessories</option>
                    <option value="chair">Furniture / Home</option>
                    <option value="apparel">Fashion / Apparel</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface">Description</label>
                <textarea
                  rows={3}
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Brief summary of products categorized under this group..."
                  className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                >
                  Save Category
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
