import React, { useState } from 'react';
import { INITIAL_ARTICLES, INITIAL_COLLECTIONS } from '../data/mockData';

export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState('kb'); // 'kb' or 'collections'
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
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

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

  const filteredArticles = articles.filter((a) => {
    const matchesSearch =
      a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || a.category.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const handleCreateArticleSubmit = (e) => {
    e.preventDefault();
    if (!newTitle) return;
    const newArt = {
      id: `art-${Date.now()}`,
      title: newTitle,
      category: newCat,
      categoryColor: 'primary',
      readTime: '3 min read',
      visibility: 'Public article',
      updated: 'Just now',
      icon: 'description',
      iconBg: 'bg-primary-container/10 text-primary',
      catBg: 'bg-surface-container text-primary',
      views: '1',
      content: newContent
    };
    setArticles([newArt, ...articles]);
    setNewTitle('');
    setNewContent('');
    setIsCreateArticleOpen(false);
  };

  const handleGenerateImportDocs = () => {
    setIsGeneratingDocs(true);
    setTimeout(() => {
      setIsGeneratingDocs(false);
      setGenerationSuccess(true);
      setTimeout(() => {
        setGenerationSuccess(false);
        setIsImportModalOpen(false);
      }, 1200);
    }, 1000);
  };

  return (
    <div className="flex flex-col w-full pt-space-xs">
      {/* Top Segmented Tab Navigation */}
      <div className="w-full bg-surface-container-lowest rounded-xl shadow-sm px-space-md pt-space-xs mb-space-lg flex items-center gap-space-lg select-none">
        <button
          type="button"
          onClick={() => setActiveTab('kb')}
          className={`relative pb-space-sm font-title-sm text-title-sm transition-colors flex items-center gap-space-2xs focus:outline-none cursor-pointer ${
            activeTab === 'kb' ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">menu_book</span>
          <span>Knowledge Base</span>
          {activeTab === 'kb' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('collections')}
          className={`relative pb-space-sm font-title-sm text-title-sm transition-colors flex items-center gap-space-2xs focus:outline-none cursor-pointer ${
            activeTab === 'collections' ? 'text-primary font-semibold' : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">collections_bookmark</span>
          <span>Collections</span>
          {activeTab === 'collections' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
          )}
        </button>
      </div>

      {activeTab === 'kb' ? (
        /* KNOWLEDGE BASE VIEW */
        <div className="flex flex-col w-full space-y-space-lg">
          {/* Top KPI Micro-Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider font-semibold">
                  Total Articles
                </span>
                <span className="font-headline-lg text-headline-lg text-on-surface mt-1 font-bold">
                  24
                </span>
                <span className="font-label-sm text-label-sm text-secondary flex items-center gap-0.5 mt-0.5 font-medium">
                  <span className="material-symbols-outlined text-xs">trending_up</span> +3 this week
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-xl">description</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider font-semibold">
                  Total Views
                </span>
                <span className="font-headline-lg text-headline-lg text-on-surface mt-1 font-bold">
                  14.2k
                </span>
                <span className="font-label-sm text-label-sm text-secondary flex items-center gap-0.5 mt-0.5 font-medium">
                  <span className="material-symbols-outlined text-xs">visibility</span> 98.4% helpful rating
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-xl">insights</span>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider font-semibold">
                  Active Categories
                </span>
                <span className="font-headline-lg text-headline-lg text-on-surface mt-1 font-bold">
                  6
                </span>
                <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-0.5 mt-0.5 font-medium">
                  Across 2 workspaces
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-xl">folder_open</span>
              </div>
            </div>
          </div>

          {/* Main Table Container */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm flex flex-col overflow-hidden">
            {/* Table Header & Action Section */}
            <div className="p-space-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md">
              <div className="flex flex-col">
                <h1 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
                  Knowledge Base
                </h1>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Manage help articles and documents
                </p>
              </div>
              <div className="flex items-center gap-space-xs self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="bg-surface-container text-on-surface hover:bg-surface-container-high px-space-md py-2 rounded-xl font-label-md text-label-md font-semibold transition-all flex items-center gap-space-2xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">file_upload</span>
                  <span>Import</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateArticleOpen(true)}
                  className="bg-primary-container text-on-primary hover:bg-primary px-space-md py-2 rounded-xl font-label-md text-label-md font-semibold shadow-sm transition-all flex items-center gap-space-2xs cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  <span>Create Article</span>
                </button>
              </div>
            </div>

            {/* Search and Filter Bar */}
            <div className="px-space-lg pb-space-md flex items-center justify-between gap-space-md">
              <div className="relative w-full max-w-sm">
                <span className="material-symbols-outlined absolute left-space-sm top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search articles..."
                  className="w-full pl-9 pr-space-md py-2 bg-surface-container-low rounded-xl font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-inner"
                />
              </div>
              <div className="flex items-center gap-space-xs">
                <div className="relative">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="flex items-center gap-space-2xs pl-space-sm pr-7 py-2 rounded-xl bg-surface-container-low text-on-surface-variant font-label-sm text-label-sm border-0 focus:outline-none appearance-none cursor-pointer"
                  >
                    <option value="All">All Categories</option>
                    <option value="Orders">Orders</option>
                    <option value="Shipping">Shipping</option>
                    <option value="General">General</option>
                  </select>
                  <span className="material-symbols-outlined text-xs text-outline absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    expand_more
                  </span>
                </div>
                <button
                  type="button"
                  className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant transition-colors"
                  title="Table options"
                >
                  <span className="material-symbols-outlined text-base">view_column</span>
                </button>
              </div>
            </div>

            {/* Structured Data Table */}
            <div className="w-full overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low">
                    <th className="py-space-xs px-space-lg font-caption text-caption text-on-surface-variant uppercase tracking-wider font-semibold w-12" scope="col">
                      <input className="rounded accent-primary cursor-pointer" type="checkbox" />
                    </th>
                    <th className="py-space-xs px-space-lg font-caption text-caption text-on-surface-variant uppercase tracking-wider font-semibold" scope="col">
                      Title
                    </th>
                    <th className="py-space-xs px-space-lg font-caption text-caption text-on-surface-variant uppercase tracking-wider font-semibold" scope="col">
                      Category
                    </th>
                    <th className="py-space-xs px-space-lg font-caption text-caption text-on-surface-variant uppercase tracking-wider font-semibold" scope="col">
                      Updated
                    </th>
                    <th className="py-space-xs px-space-lg font-caption text-caption text-on-surface-variant uppercase tracking-wider font-semibold text-right" scope="col">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y-0">
                  {filteredArticles.map((art) => (
                    <tr key={art.id} className="article-row hover:bg-surface-container-low/70 transition-colors group">
                      <td className="py-3 px-space-lg">
                        <input className="rounded accent-primary cursor-pointer" type="checkbox" />
                      </td>
                      <td className="py-3 px-space-lg">
                        <div className="flex items-center gap-space-xs">
                          <div className={`w-8 h-8 rounded-xl ${art.iconBg} flex items-center justify-center shrink-0`}>
                            <span className="material-symbols-outlined text-base">{art.icon}</span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="article-title font-title-sm text-title-sm text-on-surface font-semibold group-hover:text-primary transition-colors cursor-pointer truncate">
                              {art.title}
                            </span>
                            <span className="font-caption text-caption text-on-surface-variant">
                              {art.visibility} • {art.readTime}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-space-lg">
                        <span className={`article-cat inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm ${art.catBg} font-medium`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${art.category === 'Orders' ? 'bg-primary' : art.category === 'Shipping' ? 'bg-secondary' : 'bg-tertiary'}`}></span>
                          {art.category}
                        </span>
                      </td>
                      <td className="py-3 px-space-lg font-body-sm text-body-sm text-on-surface-variant">
                        {art.updated}
                      </td>
                      <td className="py-3 px-space-lg text-right relative">
                        <button
                          type="button"
                          onClick={() => setOpenActionMenuId(openActionMenuId === art.id ? null : art.id)}
                          className="action-trigger p-1.5 rounded-xl hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors focus:outline-none cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-lg leading-none">more_horiz</span>
                        </button>
                        {openActionMenuId === art.id && (
                          <div className="action-dropdown absolute right-space-lg top-10 w-40 bg-surface-container-lowest rounded-xl shadow-xl z-30 py-1 flex flex-col text-left border border-surface-container-high">
                            <button
                              type="button"
                              onClick={() => { alert(`Editing ${art.title}`); setOpenActionMenuId(null); }}
                              className="px-space-sm py-1.5 font-body-sm text-body-sm text-on-surface hover:bg-surface-container-low flex items-center gap-space-xs transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">edit</span> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => { alert(`Previewing ${art.title}`); setOpenActionMenuId(null); }}
                              className="px-space-sm py-1.5 font-body-sm text-body-sm text-on-surface hover:bg-surface-container-low flex items-center gap-space-xs transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">visibility</span> Preview
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setArticles(articles.filter(a => a.id !== art.id));
                                setOpenActionMenuId(null);
                              }}
                              className="px-space-sm py-1.5 font-body-sm text-body-sm text-error hover:bg-error-container/30 flex items-center gap-space-xs transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span> Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-space-lg py-space-sm bg-surface-container-lowest flex items-center justify-between border-t border-surface-container-low">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Showing 1 to {filteredArticles.length} of {filteredArticles.length} articles
              </span>
              <div className="flex items-center gap-space-2xs select-none">
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface transition-colors focus:outline-none disabled:opacity-40" disabled>
                  <span className="material-symbols-outlined text-base">chevron_left</span>
                </button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center font-label-md text-label-md font-semibold bg-primary-container text-on-primary shadow-sm focus:outline-none">
                  1
                </button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface transition-colors focus:outline-none">
                  <span className="material-symbols-outlined text-base">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          {/* Secondary Context / Reference Banner */}
          <div className="bg-surface-container-low rounded-xl p-space-md flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
            <div className="flex items-center gap-space-md">
              <div className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary shrink-0 overflow-hidden shadow-sm">
                <img
                  alt="Reference Interface Visual"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAsCCwOK2lTWvLWddFm6N23-T4x4iqI-xMWW3CCSo7ksxTL6y24zV5qSviYL7b84XNx2HhmL8DeAemy-BO63jvbthSvRQgPIPXWDm0eT6t5uCHSturIjRARkkpGK8clItFrGpI4BJZdVN5xLiMXuSc2Qayk4jXmkqyRcl2FZYVzd1gcEGipBMSd9_jswQdL-w_JDf8JgycFG3lJqFwHNtxFbED5m1ssAavrNIt-1NitFp2dxE8orJCxfWy8qmLJj7ZkrA"
                />
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
            <button
              type="button"
              onClick={() => setActiveTab('collections')}
              className="bg-surface-container-lowest text-primary hover:bg-surface-container-high px-space-md py-2 rounded-xl font-label-md text-label-md font-semibold transition-all shadow-sm shrink-0 cursor-pointer"
            >
              Browse Collections
            </button>
          </div>
        </div>
      ) : (
        /* COLLECTIONS VIEW (Secondary Tab Content) */
        <div className="flex flex-col w-full space-y-space-lg">
          <div className="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md">
            <div className="flex flex-col">
              <h2 className="font-headline-md text-headline-md text-on-surface font-bold tracking-tight">
                Article Collections
              </h2>
              <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                Group articles into browseable subject folders for your support site
              </p>
            </div>
            <button
              type="button"
              onClick={() => alert("Create New Collection dialog")}
              className="bg-primary-container text-on-primary hover:bg-primary px-space-md py-2 rounded-xl font-label-md text-label-md font-semibold shadow-sm transition-all flex items-center gap-space-2xs cursor-pointer"
            >
              <span className="material-symbols-outlined text-base">create_new_folder</span>
              <span>New Collection</span>
            </button>
          </div>

          {/* Collections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
            {/* Collection 1 */}
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between border border-surface-container-high">
              <div>
                <div className="flex items-center justify-between mb-space-sm">
                  <div className="w-10 h-10 rounded-xl bg-primary-container/10 text-primary flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">shopping_cart</span>
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
                <button
                  type="button"
                  onClick={() => { setActiveTab('kb'); }}
                  className="text-primary hover:text-on-primary-fixed-variant font-label-sm text-label-sm font-semibold flex items-center gap-0.5 cursor-pointer"
                >
                  Manage <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Collection 2 */}
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between border border-surface-container-high">
              <div>
                <div className="flex items-center justify-between mb-space-sm">
                  <div className="w-10 h-10 rounded-xl bg-secondary-container/20 text-secondary flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">flight_takeoff</span>
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
                <button
                  type="button"
                  onClick={() => { setActiveTab('kb'); }}
                  className="text-primary hover:text-on-primary-fixed-variant font-label-sm text-label-sm font-semibold flex items-center gap-0.5 cursor-pointer"
                >
                  Manage <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Collection 3 */}
            <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between border border-surface-container-high">
              <div>
                <div className="flex items-center justify-between mb-space-sm">
                  <div className="w-10 h-10 rounded-xl bg-tertiary-fixed/40 text-tertiary flex items-center justify-center">
                    <span className="material-symbols-outlined text-xl">live_help</span>
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
                <button
                  type="button"
                  onClick={() => { setActiveTab('kb'); }}
                  className="text-primary hover:text-on-primary-fixed-variant font-label-sm text-label-sm font-semibold flex items-center gap-0.5 cursor-pointer"
                >
                  Manage <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXACT DEDICATED STANDALONE MODAL OVERLAY (From 10b._knowledge_base_import_sources_catalog_md_generator/code.html) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-space-lg backdrop-blur-md bg-on-surface/35 select-none" id="import-articles-modal">
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] w-full max-w-[920px] overflow-hidden z-10 flex flex-col max-h-[92vh] border border-surface-container-highest/60">
            {/* Modal Header */}
            <div className="px-space-lg py-space-md bg-surface-container-lowest flex items-center justify-between border-b border-surface-container">
              <div className="flex items-center gap-space-sm">
                <div className="w-10 h-10 rounded-xl bg-primary-container/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl text-primary">upload_file</span>
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
              <button
                aria-label="Close modal"
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-outline hover:bg-surface-container hover:text-on-surface transition-colors focus:outline-none cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Body: 2 Options Side-by-Side */}
            <div className="p-space-lg overflow-y-auto space-y-space-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-lg items-stretch">
                {/* OPTION A: Files & Cloud Storage */}
                <div className="bg-surface-container-lowest rounded-xl p-space-md ring-2 ring-primary shadow-sm flex flex-col justify-between relative pt-5">
                  <div className="absolute -top-3 right-space-md">
                    <span className="bg-primary text-on-primary font-label-sm text-caption px-3 py-0.5 rounded-full uppercase tracking-wider font-semibold shadow-sm">
                      RECOMMENDED
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-space-xs mb-1">
                      <span className="material-symbols-outlined text-primary text-xl">cloud_upload</span>
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
                        <button
                          type="button"
                          onClick={() => alert("Connecting Google Drive cloud sync...")}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-sm text-label-sm transition-colors border border-outline-variant/30 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base text-primary">add_to_drive</span>
                          <span className="font-medium">Google Drive</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => alert("Connecting Dropbox cloud sync...")}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-sm text-label-sm transition-colors border border-outline-variant/30 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base text-primary">cloud_queue</span>
                          <span className="font-medium">Dropbox</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => alert("Connecting OneDrive cloud sync...")}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-sm text-label-sm transition-colors border border-outline-variant/30 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base text-primary">cloud_sync</span>
                          <span className="font-medium">OneDrive</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => alert("Selecting files from Local PC...")}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-label-sm text-label-sm transition-colors border border-outline-variant/30 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-base text-outline">devices</span>
                          <span className="font-medium">Local PC</span>
                        </button>
                      </div>
                    </div>

                    {/* Drag & Drop Zone */}
                    <div className="p-space-lg rounded-xl bg-surface-container-low/60 border-2 border-dashed border-outline-variant/80 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface-container/50 transition-colors mb-space-sm py-7">
                      <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-primary mb-2 shadow-inner">
                        <span className="material-symbols-outlined text-xl">upload</span>
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

                {/* EXACT OPTION B: Generate .md from Catalog */}
                <div className="bg-surface-container-lowest rounded-xl p-space-md ring-1 ring-surface-container-highest shadow-sm flex flex-col justify-between relative pt-5">
                  <div className="absolute -top-3 right-space-md">
                    <span className="bg-secondary text-on-secondary font-label-sm text-caption px-3 py-0.5 rounded-full uppercase tracking-wider font-semibold shadow-sm">
                      SMART CATALOG SYNC
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-space-xs mb-1">
                      <span className="material-symbols-outlined text-secondary text-xl">auto_stories</span>
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
                      <span className="material-symbols-outlined text-secondary text-base shrink-0">check_circle</span>
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
                <span className="material-symbols-outlined text-base text-primary">info</span>
                Articles are created as drafts for your review before publishing
              </span>
              <div className="flex items-center gap-space-xs">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="bg-surface-container text-on-surface hover:bg-surface-container-high px-space-md py-2.5 rounded-xl font-label-md text-label-md font-semibold transition-all focus:outline-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateImportDocs}
                  className="bg-primary-container text-on-primary hover:bg-primary px-space-md py-2.5 rounded-xl font-label-md text-label-md font-semibold shadow-sm transition-all flex items-center gap-space-2xs focus:outline-none cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">auto_awesome</span>
                  <span>
                    {isGeneratingDocs ? 'Compiling Markdown...' : generationSuccess ? 'Docs Imported Successfully!' : 'Generate & Import Markdown Docs'}
                  </span>
                </button>
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
              <button onClick={() => setIsCreateArticleOpen(false)} className="text-outline hover:text-on-surface cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
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
                <button
                  type="button"
                  onClick={() => setIsCreateArticleOpen(false)}
                  className="px-4 py-2 text-xs rounded-xl text-on-surface-variant hover:bg-surface-container cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs rounded-xl bg-primary text-on-primary font-semibold shadow-sm hover:bg-primary-container cursor-pointer"
                >
                  Publish Article
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
