import React, { useState, useRef, useEffect } from 'react';
import { INITIAL_ARTICLES, INITIAL_COLLECTIONS } from '../data/mockData';
import {
  Button,
  MetricsCard,
  Pagination,
  Icon,
  SearchInput
} from '../components/common';

export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState<'kb' | 'collections'>('kb');
  const [articles, setArticles] = useState([
    {
      id: 'art-1',
      title: 'How to place an order',
      category: 'Orders',
      categoryColor: 'primary',
      readTime: '4 min read',
      visibility: 'Public article',
      updated: '10 Sep 2026',
      icon: 'shopping_bag',
      iconBg: 'bg-primary-container/10 text-primary',
      catBg: 'bg-surface-container text-primary',
      views: '2,420'
    },
    {
      id: 'art-2',
      title: 'Shipping information',
      category: 'Shipping',
      categoryColor: 'secondary',
      readTime: '2 min read',
      visibility: 'Public article',
      updated: '09 Sep 2026',
      icon: 'local_shipping',
      iconBg: 'bg-secondary-container/20 text-secondary',
      catBg: 'bg-secondary-container/30 text-on-secondary-container',
      views: '1,890'
    },
    {
      id: 'art-3',
      title: 'FAQ',
      category: 'General',
      categoryColor: 'tertiary',
      readTime: '6 min read',
      visibility: 'Pinned',
      updated: '08 Sep 2026',
      icon: 'quiz',
      iconBg: 'bg-tertiary-fixed/40 text-tertiary',
      catBg: 'bg-tertiary-fixed/30 text-tertiary',
      views: '4,120'
    }
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCreateArticleOpen, setIsCreateArticleOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Selection state
  const [selectedArticleIds, setSelectedArticleIds] = useState<string[]>([]);

  // Table Options state
  const [isTableOptionsOpen, setIsTableOptionsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    category: true,
    views: true,
    updated: true,
    actions: true
  });
  const [tableDensity, setTableDensity] = useState<'comfortable' | 'compact'>('comfortable');
  const [tableSortBy, setTableSortBy] = useState('default');

  const tableOptionsRef = useRef<HTMLDivElement>(null);

  // Close table options dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tableOptionsRef.current && !tableOptionsRef.current.contains(e.target as Node)) {
        setIsTableOptionsOpen(false);
      }
    };
    if (isTableOptionsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTableOptionsOpen]);

  // New Article Form
  const [newTitle, setNewTitle] = useState('');
  const [newCat, setNewCat] = useState('Orders');
  const [newContent, setNewContent] = useState('');

  // Option B Form State
  const [includeProducts, setIncludeProducts] = useState(true);
  const [includeCategories, setIncludeCategories] = useState(true);
  const [includePolicies, setIncludePolicies] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState('Structured Q&A / FAQ Markdown');
  const [isGeneratingDocs, setIsGeneratingDocs] = useState(false);
  const [generationSuccess, setGenerationSuccess] = useState(false);

  // Filtered & Sorted Articles
  const filteredArticles = articles
    .filter((a) => {
      const matchesSearch =
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || a.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (tableSortBy === 'title-asc') return a.title.localeCompare(b.title);
      if (tableSortBy === 'views-desc') {
        const aViews = parseInt(a.views.replace(/,/g, ''), 10) || 0;
        const bViews = parseInt(b.views.replace(/,/g, ''), 10) || 0;
        return bViews - aViews;
      }
      return 0;
    });

  // Select All Handlers
  const isAllSelected =
    filteredArticles.length > 0 &&
    filteredArticles.every((a) => selectedArticleIds.includes(a.id));
  const isSomeSelected = selectedArticleIds.length > 0 && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedArticleIds([]);
    } else {
      setSelectedArticleIds(filteredArticles.map((a) => a.id));
    }
  };

  const handleToggleSelectArticle = (id: string) => {
    setSelectedArticleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    setArticles((prev) => prev.filter((a) => !selectedArticleIds.includes(a.id)));
    setSelectedArticleIds([]);
  };

  const handleCreateArticleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;

    const newArticle = {
      id: `art-${Date.now()}`,
      title: newTitle,
      category: newCat,
      categoryColor: newCat === 'Orders' ? 'primary' : newCat === 'Shipping' ? 'secondary' : 'tertiary',
      readTime: '3 min read',
      visibility: 'Public article',
      updated: 'Just now',
      icon: newCat === 'Orders' ? 'shopping_bag' : newCat === 'Shipping' ? 'local_shipping' : 'quiz',
      iconBg: newCat === 'Orders' ? 'bg-primary-container/10 text-primary' : newCat === 'Shipping' ? 'bg-secondary-container/20 text-secondary' : 'bg-tertiary-fixed/40 text-tertiary',
      catBg: newCat === 'Orders' ? 'bg-surface-container text-primary' : newCat === 'Shipping' ? 'bg-secondary-container/30 text-on-secondary-container' : 'bg-tertiary-fixed/30 text-tertiary',
      views: '0'
    };

    setArticles([newArticle, ...articles]);
    setNewTitle('');
    setNewContent('');
    setIsCreateArticleOpen(false);
  };

  const handleDeleteArticle = (id: string) => {
    setArticles(articles.filter((a) => a.id !== id));
    setSelectedArticleIds((prev) => prev.filter((item) => item !== id));
    setOpenActionMenuId(null);
  };

  const handleGenerateImportDocs = () => {
    setIsGeneratingDocs(true);
    setTimeout(() => {
      const generated = [
        {
          id: `gen-1`,
          title: 'Product Catalog: Urban Tech Minimalist Backpack Overview',
          category: 'Orders',
          categoryColor: 'primary',
          readTime: '5 min read',
          visibility: 'Public article',
          updated: 'Just now',
          icon: 'inventory_2',
          iconBg: 'bg-primary-container/10 text-primary',
          catBg: 'bg-surface-container text-primary',
          views: '0'
        },
        {
          id: `gen-2`,
          title: 'Shipping and Return Policies for Electronics',
          category: 'Shipping',
          categoryColor: 'secondary',
          readTime: '3 min read',
          visibility: 'Public article',
          updated: 'Just now',
          icon: 'local_shipping',
          iconBg: 'bg-secondary-container/20 text-secondary',
          catBg: 'bg-secondary-container/30 text-on-secondary-container',
          views: '0'
        }
      ];
      setArticles((prev) => [...generated, ...prev]);
      setIsGeneratingDocs(false);
      setGenerationSuccess(true);
      setTimeout(() => {
        setIsImportModalOpen(false);
        setGenerationSuccess(false);
      }, 1200);
    }, 1500);
  };

  return (
    <div className="flex flex-col w-full pb-space-2xl">
      {/* Module Navigation Tabs */}
      <div className="flex items-center gap-space-lg border-b border-surface-container-low mb-space-lg">
        <button
          type="button"
          onClick={() => setActiveTab('kb')}
          className={`pb-space-sm font-title-sm text-title-sm flex items-center gap-space-xs transition-colors relative cursor-pointer ${
            activeTab === 'kb' ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Icon name="library_books" size="md" />
          <span>Knowledge Base</span>
          {activeTab === 'kb' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('collections')}
          className={`pb-space-sm font-title-sm text-title-sm flex items-center gap-space-xs transition-colors relative cursor-pointer ${
            activeTab === 'collections' ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Icon name="collections_bookmark" size="md" />
          <span>Collections</span>
          {activeTab === 'collections' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
      </div>

      {activeTab === 'kb' ? (
        /* KNOWLEDGE BASE VIEW */
        <div className="flex flex-col w-full space-y-space-lg">
          {/* Top KPI Standardized Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            <MetricsCard
              title="Total Articles"
              value={articles.length}
              trend="+3 this week"
              trendType="positive"
              icon="description"
              variant="primary"
            />

            <MetricsCard
              title="Total Views"
              value="14.2k"
              trend="98.4% helpful rating"
              trendType="positive"
              trendIcon="visibility"
              icon="insights"
              variant="secondary"
            />

            <MetricsCard
              title="Active Categories"
              value="6"
              subtitle="Across 2 workspaces"
              icon="folder_open"
              variant="neutral"
            />
          </div>

          {/* Main Table Container */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-low/60 flex flex-col relative">
            {/* Table Header & Action Section */}
            <div className="p-space-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md rounded-t-xl">
              <div className="flex flex-col">
                <h1 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
                  Knowledge Base
                </h1>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Manage help articles and documents
                </p>
              </div>
              <div className="flex items-center gap-space-xs self-start md:self-auto">
                <Button
                  variant="secondary"
                  size="md"
                  startIcon="file_upload"
                  onClick={() => setIsImportModalOpen(true)}
                >
                  Import
                </Button>

                <Button
                  variant="primary"
                  size="md"
                  startIcon="add"
                  onClick={() => setIsCreateArticleOpen(true)}
                >
                  Create Article
                </Button>
              </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="px-space-lg pb-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
              <SearchInput
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search articles..."
              />

              <div className="flex items-center gap-space-xs self-end sm:self-auto relative">
                {/* Category Filter */}
                <div className="relative">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="h-10 bg-surface-container-low hover:bg-surface-container text-on-surface font-label-sm text-label-sm py-2 pl-3 pr-8 rounded-xl border border-transparent focus:border-surface-container focus:outline-none appearance-none cursor-pointer transition-colors"
                  >
                    <option value="All">All Categories</option>
                    <option value="Orders">Orders</option>
                    <option value="Shipping">Shipping</option>
                    <option value="General">General</option>
                  </select>
                  <span className="material-symbols-outlined text-sm text-outline absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                    expand_more
                  </span>
                </div>

                {/* Table Options Dropdown */}
                <div className="relative" ref={tableOptionsRef}>
                  <Button
                    variant={isTableOptionsOpen ? 'soft' : 'hover'}
                    size="md"
                    startIcon="tune"
                    onClick={() => setIsTableOptionsOpen(!isTableOptionsOpen)}
                  >
                    Table Options
                  </Button>

                  {/* Clean Table Options Popover */}
                  {isTableOptionsOpen && (
                    <div className="absolute right-0 top-full mt-1.5 w-60 bg-white rounded-2xl shadow-2xl z-50 p-3 border border-slate-200 ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-150">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-outline mb-2">
                        Visible Columns
                      </div>
                      <div className="space-y-1.5 mb-3">
                        <label className="flex items-center justify-between text-xs text-on-surface hover:bg-slate-50 p-1 rounded-lg cursor-pointer">
                          <span>Category</span>
                          <input
                            type="checkbox"
                            checked={visibleColumns.category}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, category: e.target.checked })}
                            className="accent-primary rounded"
                          />
                        </label>
                        <label className="flex items-center justify-between text-xs text-on-surface hover:bg-slate-50 p-1 rounded-lg cursor-pointer">
                          <span>Views</span>
                          <input
                            type="checkbox"
                            checked={visibleColumns.views}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, views: e.target.checked })}
                            className="accent-primary rounded"
                          />
                        </label>
                        <label className="flex items-center justify-between text-xs text-on-surface hover:bg-slate-50 p-1 rounded-lg cursor-pointer">
                          <span>Updated Date</span>
                          <input
                            type="checkbox"
                            checked={visibleColumns.updated}
                            onChange={(e) => setVisibleColumns({ ...visibleColumns, updated: e.target.checked })}
                            className="accent-primary rounded"
                          />
                        </label>
                      </div>

                      <div className="h-px bg-slate-100 my-2" />

                      <div className="text-[11px] font-bold uppercase tracking-wider text-outline mb-2">
                        Row Spacing
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTableDensity('comfortable')}
                          className={`py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                            tableDensity === 'comfortable' ? 'bg-primary/10 text-primary font-semibold' : 'bg-slate-50 text-on-surface-variant hover:bg-slate-100'
                          }`}
                        >
                          Comfortable
                        </button>
                        <button
                          type="button"
                          onClick={() => setTableDensity('compact')}
                          className={`py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                            tableDensity === 'compact' ? 'bg-primary/10 text-primary font-semibold' : 'bg-slate-50 text-on-surface-variant hover:bg-slate-100'
                          }`}
                        >
                          Compact
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bulk Actions Banner */}
            {selectedArticleIds.length > 0 && (
              <div className="px-space-lg py-2 bg-primary-container/10 border-y border-primary/20 flex items-center justify-between animate-in fade-in duration-150">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Icon name="check_circle" size="sm" color="primary" />
                  <span>{selectedArticleIds.length} {selectedArticleIds.length === 1 ? 'article' : 'articles'} selected</span>
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
                    onClick={() => setSelectedArticleIds([])}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            )}

            {/* Articles Table */}
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low text-on-surface-variant font-caption text-caption uppercase tracking-wider">
                    <th className="py-3 px-space-lg font-semibold w-12">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeSelected;
                        }}
                        onChange={handleToggleSelectAll}
                        className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                        title={isAllSelected ? "Deselect all" : "Select all"}
                      />
                    </th>
                    <th className="py-3 px-space-md font-semibold">Title</th>
                    {visibleColumns.category && <th className="py-3 px-space-md font-semibold">Category</th>}
                    {visibleColumns.views && <th className="py-3 px-space-md font-semibold">Views</th>}
                    {visibleColumns.updated && <th className="py-3 px-space-md font-semibold">Updated</th>}
                    {visibleColumns.actions && <th className="py-3 px-space-lg font-semibold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low/40">
                  {filteredArticles.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-outline text-xs">
                        No knowledge base articles found.
                      </td>
                    </tr>
                  ) : (
                    filteredArticles.map((art) => {
                      const isSelected = selectedArticleIds.includes(art.id);
                      return (
                        <tr
                          key={art.id}
                          className={`hover:bg-surface-container-low/50 transition-colors group ${
                            isSelected ? 'bg-primary/[0.04]' : ''
                          }`}
                        >
                          <td className={`px-space-lg ${tableDensity === 'compact' ? 'py-2' : 'py-3.5'}`}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectArticle(art.id)}
                              className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                            />
                          </td>
                          <td className={`px-space-md ${tableDensity === 'compact' ? 'py-2' : 'py-3.5'}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${art.iconBg}`}>
                                <Icon name={art.icon} size="md" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-title-sm text-title-sm text-on-surface font-semibold group-hover:text-primary transition-colors truncate">
                                  {art.title}
                                </span>
                                <span className="font-caption text-caption text-on-surface-variant">
                                  {art.readTime} • {art.visibility}
                                </span>
                              </div>
                            </div>
                          </td>
                          {visibleColumns.category && (
                            <td className={`px-space-md ${tableDensity === 'compact' ? 'py-2' : 'py-3.5'}`}>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${art.catBg}`}>
                                {art.category}
                              </span>
                            </td>
                          )}
                          {visibleColumns.views && (
                            <td className={`px-space-md font-body-sm text-body-sm text-on-surface ${tableDensity === 'compact' ? 'py-2' : 'py-3.5'}`}>
                              {art.views}
                            </td>
                          )}
                          {visibleColumns.updated && (
                            <td className={`px-space-md font-caption text-caption text-outline ${tableDensity === 'compact' ? 'py-2' : 'py-3.5'}`}>
                              {art.updated}
                            </td>
                          )}
                          {visibleColumns.actions && (
                            <td className={`px-space-lg text-right ${tableDensity === 'compact' ? 'py-2' : 'py-3.5'}`}>
                              <div className="inline-flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  startIcon="edit"
                                  title="Edit Article"
                                  aria-label="Edit Article"
                                />
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  startIcon="delete"
                                  onClick={() => handleDeleteArticle(art.id)}
                                  title="Delete Article"
                                  aria-label="Delete Article"
                                />
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Standardized Reusable Pagination */}
            <Pagination
              currentPage={1}
              totalPages={1}
              totalItems={filteredArticles.length}
              itemsPerPage={10}
              itemLabel="articles"
              onPageChange={() => {}}
            />
          </div>

          {/* Secondary Context / Reference Banner with Themed Icon */}
          <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
            <div className="flex items-center gap-space-md">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-sm">
                <Icon name="collections_bookmark" size="xl" color="primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                  Need to organize articles into categories?
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Group topics logically and publish curated public help collections for customer self-service.
                </span>
              </div>
            </div>
            <Button
              variant="hover"
              size="md"
              onClick={() => setActiveTab('collections')}
            >
              Browse Collections
            </Button>
          </div>
        </div>
      ) : (
        /* COLLECTIONS VIEW (Secondary Tab Content) */
        <div className="flex flex-col w-full space-y-space-lg">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-low/60 p-space-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md">
            <div className="flex flex-col">
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
                Article Collections
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Group articles into browseable subject folders for your support site
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              startIcon="create_new_folder"
              onClick={() => alert("Create New Collection dialog")}
            >
              New Collection
            </Button>
          </div>

          {/* Collections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            {/* Collection 1 */}
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between border border-surface-container-high">
              <div>
                <div className="flex items-center justify-between mb-space-sm">
                  <div className="w-10 h-10 rounded-xl bg-primary-container/10 text-primary flex items-center justify-center">
                    <Icon name="shopping_cart" size="lg" color="primary" />
                  </div>
                  <span className="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-surface-container text-primary font-semibold">
                    12 Articles
                  </span>
                </div>
                <h3 className="font-title-md text-title-md text-on-surface font-semibold">Orders &amp; Fulfillment</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Checkouts, tracking updates, invoicing, and cancelations.</p>
              </div>
              <div className="mt-space-md pt-space-sm flex items-center justify-between border-t border-surface-container-low">
                <span className="font-caption text-caption text-outline">Updated 2 days ago</span>
                <Button
                  variant="ghost"
                  size="sm"
                  endIcon="arrow_forward"
                  onClick={() => { setActiveTab('kb'); }}
                >
                  Manage
                </Button>
              </div>
            </div>

            {/* Collection 2 */}
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between border border-surface-container-high">
              <div>
                <div className="flex items-center justify-between mb-space-sm">
                  <div className="w-10 h-10 rounded-xl bg-secondary-container/20 text-secondary flex items-center justify-center">
                    <Icon name="flight_takeoff" size="lg" color="secondary" />
                  </div>
                  <span className="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-secondary-container/30 text-on-secondary-container font-semibold">
                    8 Articles
                  </span>
                </div>
                <h3 className="font-title-md text-title-md text-on-surface font-semibold">Shipping &amp; Logistics</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">Carriers, regional delivery rates, customs clearance, and lead times.</p>
              </div>
              <div className="mt-space-md pt-space-sm flex items-center justify-between border-t border-surface-container-low">
                <span className="font-caption text-caption text-outline">Updated 5 days ago</span>
                <Button
                  variant="ghost"
                  size="sm"
                  endIcon="arrow_forward"
                  onClick={() => { setActiveTab('kb'); }}
                >
                  Manage
                </Button>
              </div>
            </div>

            {/* Collection 3 */}
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between border border-surface-container-high">
              <div>
                <div className="flex items-center justify-between mb-space-sm">
                  <div className="w-10 h-10 rounded-xl bg-tertiary-fixed/40 text-tertiary flex items-center justify-center">
                    <Icon name="live_help" size="lg" color="tertiary" />
                  </div>
                  <span className="font-label-sm text-label-sm px-2.5 py-0.5 rounded-full bg-tertiary-fixed/30 text-tertiary font-semibold">
                    4 Articles
                  </span>
                </div>
                <h3 className="font-title-md text-title-md text-on-surface font-semibold">Customer FAQ &amp; Policies</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">General inquiries, refund timelines, safety guidelines, and company terms.</p>
              </div>
              <div className="mt-space-md pt-space-sm flex items-center justify-between border-t border-surface-container-low">
                <span className="font-caption text-caption text-outline">Updated 1 week ago</span>
                <Button
                  variant="ghost"
                  size="sm"
                  endIcon="arrow_forward"
                  onClick={() => { setActiveTab('kb'); }}
                >
                  Manage
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Import Modal Overlay */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-space-lg backdrop-blur-md bg-on-surface/35 select-none" id="import-articles-modal">
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-[920px] overflow-hidden z-10 flex flex-col max-h-[92vh] border border-surface-container-highest/60">
            {/* Modal Header */}
            <div className="px-space-lg py-space-md bg-surface-container-lowest flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center gap-space-sm">
                <div className="w-10 h-10 rounded-xl bg-primary-container/10 text-primary flex items-center justify-center shrink-0">
                  <Icon name="upload_file" size="xl" color="primary" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold tracking-tight">
                      Import Knowledge Base Articles
                    </h2>
                    <span className="px-2 py-0.5 rounded-full font-label-sm text-caption bg-primary-fixed text-primary font-semibold">
                      v2.4 Importer
                    </span>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Select your preferred source to bulk import or auto-generate markdown articles
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                startIcon="close"
                onClick={() => setIsImportModalOpen(false)}
                aria-label="Close modal"
              />
            </div>

            {/* Modal Body */}
            <div className="p-space-lg overflow-y-auto space-y-space-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg items-stretch">
                {/* OPTION A */}
                <div className="bg-surface-container-lowest rounded-xl p-space-md ring-2 ring-primary shadow-sm flex flex-col justify-between relative pt-5">
                  <div className="absolute -top-3 right-space-md">
                    <span className="bg-primary text-on-primary font-label-sm text-caption px-3 py-0.5 rounded-full uppercase tracking-wider font-semibold shadow-sm">
                      RECOMMENDED
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-space-xs mb-1">
                      <Icon name="cloud_upload" size="lg" color="primary" />
                      <h3 className="font-title-md text-title-md text-on-surface font-bold">
                        Option A: Files &amp; Cloud Storage
                      </h3>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm leading-snug">
                      Upload local documents or sync from cloud storage providers (PDF, Word, TXT, MD, CSV)
                    </p>

                    {/* Cloud Providers Buttons */}
                    <div className="mb-space-sm">
                      <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider block mb-1.5 font-semibold">
                        CONNECT CLOUD PROVIDERS
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          startIcon="add_to_drive"
                          onClick={() => alert("Connecting Google Drive cloud sync...")}
                        >
                          Google Drive
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          startIcon="cloud_queue"
                          onClick={() => alert("Connecting Dropbox cloud sync...")}
                        >
                          Dropbox
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          startIcon="cloud_sync"
                          onClick={() => alert("Connecting OneDrive cloud sync...")}
                        >
                          OneDrive
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          startIcon="devices"
                          onClick={() => alert("Selecting files from Local PC...")}
                        >
                          Local PC
                        </Button>
                      </div>
                    </div>

                    {/* Drag & Drop Zone */}
                    <div className="p-space-lg rounded-xl bg-surface-container-low/60 border-2 border-dashed border-outline-variant/80 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-container/50 transition-colors mb-space-sm py-7">
                      <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary mb-2 shadow-inner">
                        <Icon name="upload" size="lg" color="primary" />
                      </div>
                      <span className="font-title-sm text-title-sm text-on-surface font-bold">
                        Drag &amp; drop files here
                      </span>
                      <span className="font-caption text-caption text-on-surface-variant mt-0.5">
                        Supports .md, .pdf, .docx, .json up to 50MB
                      </span>
                    </div>

                    {/* Controls */}
                    <div className="space-y-2 pt-1 border-t border-surface-container/60">
                      <label className="flex items-center justify-between cursor-pointer py-0.5">
                        <span className="font-body-sm text-body-sm text-on-surface font-medium">
                          Auto-sync updates periodically
                        </span>
                        <input
                          defaultChecked
                          className="accent-primary rounded h-4 w-4 cursor-pointer"
                          type="checkbox"
                        />
                      </label>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-body-sm text-body-sm text-on-surface font-medium shrink-0">
                          Target Category
                        </span>
                        <div className="relative">
                          <select className="bg-surface-container-low text-on-surface font-label-sm text-label-sm py-1.5 pl-2.5 pr-8 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer">
                            <option>Auto-detect from document</option>
                            <option>Orders</option>
                            <option>Shipping</option>
                            <option>General FAQ</option>
                          </select>
                          <span className="material-symbols-outlined text-sm text-outline absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                            expand_more
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* OPTION B */}
                <div className="bg-surface-container-lowest rounded-xl p-space-md ring-1 ring-surface-container-highest shadow-sm flex flex-col justify-between relative pt-5">
                  <div className="absolute -top-3 right-space-md">
                    <span className="bg-secondary text-on-secondary font-label-sm text-caption px-3 py-0.5 rounded-full uppercase tracking-wider font-semibold shadow-sm">
                      SMART CATALOG SYNC
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-space-xs mb-1">
                      <Icon name="auto_stories" size="lg" color="secondary" />
                      <h3 className="font-title-md text-title-md text-on-surface font-bold">
                        Option B: Generate .md from Catalog
                      </h3>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mb-space-sm leading-snug">
                      Automatically compile dynamic Markdown knowledge articles directly from your existing Products and Categories inventory
                    </p>

                    {/* Source Selector Checkboxes */}
                    <div className="mb-space-sm">
                      <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider block mb-1.5 font-semibold">
                        SOURCE SELECTOR
                      </span>
                      <div className="space-y-1">
                        <label className="flex items-center gap-space-xs cursor-pointer p-1 rounded-lg hover:bg-surface-container-low transition-colors">
                          <input
                            checked={includeProducts}
                            onChange={(e) => setIncludeProducts(e.target.checked)}
                            className="accent-primary rounded h-4 w-4 cursor-pointer"
                            type="checkbox"
                          />
                          <span className="font-body-sm text-body-sm text-on-surface font-medium">
                            Include All Products (SKU, Specs, FAQs)
                          </span>
                        </label>
                        <label className="flex items-center gap-space-xs cursor-pointer p-1 rounded-lg hover:bg-surface-container-low transition-colors">
                          <input
                            checked={includeCategories}
                            onChange={(e) => setIncludeCategories(e.target.checked)}
                            className="accent-primary rounded h-4 w-4 cursor-pointer"
                            type="checkbox"
                          />
                          <span className="font-body-sm text-body-sm text-on-surface font-medium">
                            Include Categories &amp; Taxonomies
                          </span>
                        </label>
                        <label className="flex items-center gap-space-xs cursor-pointer p-1 rounded-lg hover:bg-surface-container-low transition-colors">
                          <input
                            checked={includePolicies}
                            onChange={(e) => setIncludePolicies(e.target.checked)}
                            className="accent-primary rounded h-4 w-4 cursor-pointer"
                            type="checkbox"
                          />
                          <span className="font-body-sm text-body-sm text-on-surface font-medium">
                            Include Shipping &amp; Return policies
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Template & Collection Settings */}
                    <div className="space-y-2 pt-2 border-t border-surface-container/80 mb-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-body-sm text-body-sm text-on-surface font-medium shrink-0">
                          Template
                        </span>
                        <div className="relative">
                          <select
                            value={selectedTemplate}
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                            className="bg-surface-container-low text-on-surface font-label-sm text-label-sm py-1.5 pl-2.5 pr-8 rounded-lg border-0 focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
                          >
                            <option value="Structured Q&amp;A / FAQ Markdown">Structured Q&amp;A / FAQ Markdown</option>
                            <option value="Comprehensive Wiki Catalog">Comprehensive Wiki Catalog</option>
                            <option value="Feature Summary Tables">Feature Summary Tables</option>
                          </select>
                          <span className="material-symbols-outlined text-sm text-outline absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                            expand_more
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-body-sm text-body-sm text-on-surface font-medium">Collection</span>
                        <span className="font-label-sm text-label-sm text-outline font-medium">'Product Catalog Docs'</span>
                      </div>
                    </div>

                    {/* Preview Alert Box */}
                    <div className="p-2.5 rounded-xl bg-secondary-container/20 border border-secondary/20 flex items-center gap-2 mt-auto">
                      <Icon name="check_circle" size="sm" color="secondary" />
                      <span className="font-caption text-caption text-on-secondary-container font-semibold leading-tight">
                        Generates 12 Product MDs + 4 Category Guides ready to publish into Knowledge Base
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="px-space-lg py-space-md bg-surface-container-low/80 flex items-center justify-between border-t border-surface-container">
              <span className="font-body-sm text-body-sm text-on-surface-variant flex items-center gap-1.5">
                <Icon name="info" size="sm" color="primary" />
                Articles are created as drafts for your review before publishing
              </span>
              <div className="flex items-center gap-space-xs">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setIsImportModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  startIcon="auto_awesome"
                  loading={isGeneratingDocs}
                  onClick={handleGenerateImportDocs}
                >
                  {generationSuccess ? 'Docs Imported Successfully!' : 'Generate & Import Markdown Docs'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Article Modal */}
      {isCreateArticleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-surface-container-high flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-low">
              <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">Create Article</h2>
              <Button
                variant="ghost"
                size="icon-sm"
                startIcon="close"
                onClick={() => setIsCreateArticleOpen(false)}
                aria-label="Close modal"
              />
            </div>

            <form onSubmit={handleCreateArticleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Article Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Return and Replacement Guidelines"
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-sm"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Category</label>
                <select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-sm"
                >
                  <option value="Orders">Orders &amp; Checkout</option>
                  <option value="Shipping">Shipping &amp; Delivery</option>
                  <option value="General">General FAQ</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-on-surface">Content (Markdown)</label>
                <textarea
                  rows={4}
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Write article instructions or guidelines..."
                  className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-sm resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setIsCreateArticleOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                >
                  Publish Article
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
