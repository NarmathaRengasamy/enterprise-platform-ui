import React, { useState, useRef, useEffect } from 'react';
import { INITIAL_CATEGORIES } from '../data/mockData';

export default function CategoriesPage({ setActiveModule }) {
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState(null);

  // Selection state
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);

  // Filter & Refresh states
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'with-products' | 'empty'
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'name-asc' | 'products-desc'
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filterRef = useRef(null);

  // Close filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
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

  const handleToggleSelectCategory = (id) => {
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

  const handleAddCategorySubmit = (e) => {
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

  const handleDeleteCategory = (id) => {
    setCategories(categories.filter((c) => c.id !== id));
    setSelectedCategoryIds((prev) => prev.filter((item) => item !== id));
    setOpenDropdownId(null);
  };

  return (
    <div className="flex flex-col w-full pt-space-xs">
      {/* Top Command & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg">
        <div>
          <div className="flex items-center gap-space-xs mb-space-2xs">
            <span className="font-caption text-caption text-primary font-bold uppercase tracking-wider">
              Catalog Architecture
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full font-label-sm text-label-sm bg-secondary-container text-on-secondary-container font-semibold">
              Active Store
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
            Categories
          </h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            Manage your product categories, tax hierarchies, and store grouping
          </p>
        </div>
        <div className="flex items-center gap-space-sm flex-wrap">
          <button
            type="button"
            onClick={() => alert("Categories exported successfully")}
            className="inline-flex items-center gap-space-xs px-space-md py-2 rounded-xl bg-surface-container-lowest text-on-surface hover:bg-surface-container transition-all shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg text-outline">file_download</span>
            <span className="font-label-md text-label-md font-semibold">Export</span>
          </button>
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-space-xs px-space-md py-2 rounded-xl bg-primary-container text-on-primary font-semibold hover:bg-primary transition-all shadow-md shadow-primary/20 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">add</span>
            <span className="font-label-md text-label-md">Add Category</span>
          </button>
        </div>
      </div>

      {/* Operational Overview Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg">
        {/* Stat 1 */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-caption text-caption uppercase tracking-wider text-on-surface-variant font-semibold">
              Total Categories
            </span>
            <span className="font-headline-lg text-headline-lg font-bold text-on-surface mt-1">
              {categories.length}
            </span>
            <span className="font-caption text-caption text-secondary flex items-center gap-0.5 mt-1">
              <span className="material-symbols-outlined text-xs">trending_up</span> 100% active
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-xl">category</span>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-caption text-caption uppercase tracking-wider text-on-surface-variant font-semibold">
              Assigned Products
            </span>
            <span className="font-headline-lg text-headline-lg font-bold text-on-surface mt-1">75</span>
            <span className="font-caption text-caption text-secondary flex items-center gap-0.5 mt-1">
              <span className="material-symbols-outlined text-xs">check_circle</span> 0 uncategorized
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-xl">inventory_2</span>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-caption text-caption uppercase tracking-wider text-on-surface-variant font-semibold">
              Top Distribution
            </span>
            <span className="font-headline-lg text-headline-lg font-bold text-on-surface mt-1">Electronics</span>
            <span className="font-caption text-caption text-on-surface-variant mt-1">
              33.3% of catalog inventory
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-xl">devices</span>
          </div>
        </div>

        {/* Stat 4 with mini sparkline chart */}
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-caption text-caption uppercase tracking-wider text-on-surface-variant font-semibold">
              Inventory Density
            </span>
            <span className="font-headline-lg text-headline-lg font-bold text-on-surface mt-1">
              18.75 <span className="font-label-sm text-label-sm font-normal text-on-surface-variant">avg/cat</span>
            </span>
            <span className="font-caption text-caption text-secondary mt-1">Optimal allocation</span>
          </div>
          <div className="w-16 h-10 flex items-end">
            <svg className="w-full h-8 text-primary" fill="none" preserveAspectRatio="none" viewBox="0 0 64 28">
              <path d="M2 22 L18 8 L34 16 L50 4 L62 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path>
              <path d="M2 22 L18 8 L34 16 L50 4 L62 12 V 28 H 2 Z" fill="currentColor" fillOpacity="0.1"></path>
            </svg>
          </div>
        </div>
      </div>

      {/* Primary Content Card & Table Container (relative without overflow-hidden so popovers are never clipped) */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm flex flex-col relative">
        {/* Filter and Search Header */}
        <div className="p-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm bg-surface-container-lowest rounded-t-xl">
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search categories..."
              className="w-full h-10 pl-10 pr-space-md bg-surface-container-low text-on-surface placeholder:text-outline font-body-sm text-body-sm rounded-xl outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all border border-transparent focus:border-surface-container"
            />
          </div>
          <div className="flex items-center gap-space-xs self-end sm:self-auto relative">
            {/* Filter Dropdown */}
            <div className="relative" ref={filterRef}>
              <button
                type="button"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={`inline-flex items-center gap-1.5 px-3.5 h-10 rounded-xl font-label-sm text-label-sm cursor-pointer transition-all border ${
                  isFilterOpen || filterType !== 'all' || sortBy !== 'default'
                    ? 'bg-primary/10 text-primary border-primary/30 ring-2 ring-primary/15 font-semibold'
                    : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface border-transparent'
                }`}
              >
                <span className="material-symbols-outlined text-base">filter_list</span>
                <span>
                  {filterType === 'with-products'
                    ? 'With Products'
                    : filterType === 'empty'
                    ? 'Empty (0)'
                    : sortBy === 'name-asc'
                    ? 'Name A-Z'
                    : sortBy === 'products-desc'
                    ? 'Most Products'
                    : 'Filter'}
                </span>
                <span className="material-symbols-outlined text-xs text-outline ml-0.5">expand_more</span>
              </button>

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
                        <span className="material-symbols-outlined text-sm text-primary">check</span>
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
                        <span className="material-symbols-outlined text-sm text-primary">check</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Refresh Button with Spin Action */}
            <button
              type="button"
              onClick={handleRefresh}
              title="Reload categories"
              className={`p-2 rounded-xl text-outline hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer ${
                isRefreshing ? 'bg-surface-container-low text-primary' : ''
              }`}
            >
              <span className={`material-symbols-outlined text-lg ${isRefreshing ? 'animate-spin text-primary' : ''}`}>
                refresh
              </span>
            </button>
          </div>
        </div>

        {/* Bulk Action Bar (When Rows Selected) */}
        {selectedCategoryIds.length > 0 && (
          <div className="px-space-md py-2 bg-primary-container/10 border-y border-primary/20 flex items-center justify-between animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{selectedCategoryIds.length} {selectedCategoryIds.length === 1 ? 'category' : 'categories'} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBulkDelete}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-error bg-error-container/30 hover:bg-error-container transition-colors cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Delete Selected</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategoryIds([])}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/70">
                <th className="py-3 px-space-md font-caption text-caption uppercase tracking-wider text-on-surface-variant font-semibold" scope="col">
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
                </th>
                <th className="py-3 px-space-md font-caption text-caption uppercase tracking-wider text-on-surface-variant font-semibold" scope="col">
                  Description
                </th>
                <th className="py-3 px-space-md font-caption text-caption uppercase tracking-wider text-on-surface-variant font-semibold" scope="col">
                  Products
                </th>
                <th className="py-3 px-space-md font-caption text-caption uppercase tracking-wider text-on-surface-variant font-semibold text-right" scope="col">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low/40 font-body-sm text-body-sm">
              {filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-outline text-xs">
                    No categories found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat) => {
                  const isSelected = selectedCategoryIds.includes(cat.id);
                  return (
                    <tr
                      key={cat.id}
                      className={`hover:bg-surface-container-low/50 transition-colors group ${
                        isSelected ? 'bg-primary/[0.04]' : ''
                      }`}
                    >
                      <td className="py-3.5 px-space-md">
                        <div className="flex items-center gap-3">
                          <input
                            className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectCategory(cat.id)}
                          />
                          <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shrink-0">
                            <span className="material-symbols-outlined text-xl">{cat.icon}</span>
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
                      </td>
                      <td className="py-3.5 px-space-md text-on-surface-variant max-w-xs">
                        <span className="truncate block">{cat.description}</span>
                      </td>
                      <td className="py-3.5 px-space-md">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm bg-primary-fixed/30 text-on-primary-fixed font-semibold">
                          <span className="material-symbols-outlined text-sm">inventory</span>
                          <span>{cat.productsCount}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-space-md text-right relative">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setNewCatName(cat.name);
                              setNewCatCode(cat.id);
                              setNewCatDesc(cat.description);
                              setIsAddModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-outline hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
                            title="Edit Category"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={() => setOpenDropdownId(openDropdownId === cat.id ? null : cat.id)}
                              className="p-1.5 rounded-lg text-outline hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-base">more_horiz</span>
                            </button>
                            {openDropdownId === cat.id && (
                              <div className="absolute right-0 top-full mt-1 w-44 bg-surface-container-lowest rounded-xl shadow-xl z-30 py-1.5 border border-surface-container-high">
                                <button
                                  type="button"
                                  onClick={() => { setActiveModule('products'); setOpenDropdownId(null); }}
                                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-on-surface font-body-sm text-body-sm hover:bg-surface-container-low transition-colors"
                                >
                                  <span className="material-symbols-outlined text-base text-outline">visibility</span>
                                  View Products
                                </button>
                                <div className="h-px bg-surface-container-high my-1" />
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(cat.id)}
                                  className="w-full text-left flex items-center gap-2 px-3 py-1.5 text-error font-body-sm text-body-sm hover:bg-error-container/30 transition-colors"
                                >
                                  <span className="material-symbols-outlined text-base text-error">delete</span>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Category Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm">
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-surface-container-high p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">category</span>
                <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  {newCatCode ? 'Edit Category' : 'Add New Category'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-outline hover:bg-surface-container transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
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
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container font-title-sm text-label-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-on-primary font-semibold shadow-sm hover:bg-primary-container"
                >
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
