import React, { useState, useEffect } from 'react';
import { INITIAL_PRODUCTS } from '../data/mockData';

export default function ProductsPage({ setActiveModule, setSelectedProduct }) {
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Filter products based on search and category
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  // Compute pagination
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  const startItem = filteredProducts.length === 0 ? 0 : startIndex + 1;
  const endItem = Math.min(startIndex + itemsPerPage, filteredProducts.length);

  const inStockCount = products.filter((p) => p.stockStatus === 'In Stock').length;
  const lowStockCount = products.filter((p) => p.stockStatus !== 'In Stock').length;
  const uniqueCategoriesCount = new Set(products.map((p) => p.category)).size;

  const handleExportCSV = () => {
    const headers = "ID,Product Name,SKU,Category,Price,Stock Status,Stock\n";
    const rows = filteredProducts.map(p => `"${p.id}","${p.name}","${p.sku}","${p.category}",${p.price},"${p.stockStatus}",${p.stock}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'omniflow_products.csv';
    a.click();
  };

  return (
    <div className="flex flex-col w-full">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div className="flex flex-col">
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">Products</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Manage your product catalog and inventory</p>
        </div>
        <div className="flex items-center gap-space-xs">
          <button
            type="button"
            onClick={() => setActiveModule('add-product')}
            className="inline-flex items-center justify-center gap-space-xs px-space-md py-2 rounded-xl bg-primary text-on-primary font-title-sm text-title-sm hover:bg-primary-container transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg leading-none">add</span>
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg">
        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Total Catalog</span>
            <span className="font-headline-md text-headline-md text-on-surface font-bold mt-1">{products.length}</span>
            <span className="font-label-sm text-label-sm text-secondary flex items-center gap-0.5 mt-0.5 font-medium">
              <span className="material-symbols-outlined text-xs">trending_up</span> 100% active
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-xl">inventory_2</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">In Stock</span>
            <span className="font-headline-md text-headline-md text-on-surface font-bold mt-1">{inStockCount}</span>
            <span className="font-label-sm text-label-sm text-secondary flex items-center gap-0.5 mt-0.5 font-medium">
              <span className="material-symbols-outlined text-xs">check_circle</span> {Math.round((inStockCount / Math.max(1, products.length)) * 100)}% Healthy
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-secondary-fixed/30 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-xl">verified</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Low Stock Warning</span>
            <span className="font-headline-md text-headline-md text-tertiary font-bold mt-1">{lowStockCount}</span>
            <span className="font-label-sm text-label-sm text-tertiary flex items-center gap-0.5 mt-0.5 font-medium">
              <span className="material-symbols-outlined text-xs">priority_high</span> Action required
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-tertiary-fixed/30 flex items-center justify-center text-tertiary">
            <span className="material-symbols-outlined text-xl">warning</span>
          </div>
        </div>

        <div 
          onClick={() => setActiveModule('categories')}
          className="bg-surface-container-lowest p-space-md rounded-xl shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow"
        >
          <div className="flex flex-col">
            <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Categories</span>
            <span className="font-headline-md text-headline-md text-on-surface font-bold mt-1">{uniqueCategoriesCount} Active</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-0.5 mt-0.5 font-medium">
              Across all sales channels
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface-variant">
            <span className="material-symbols-outlined text-xl">category</span>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Table Search & Filter Bar */}
        <div className="p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm bg-surface-container-lowest">
          <div className="relative w-full sm:w-80">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full pl-9 pr-space-md py-2 bg-surface rounded-xl font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-space-xs w-full sm:w-auto justify-end relative">
            <div className="relative">
              <button
                type="button"
                onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                className="inline-flex items-center gap-space-xs px-space-md py-2 rounded-xl bg-surface hover:bg-surface-container text-on-surface font-title-sm text-title-sm transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg text-on-surface-variant">filter_list</span>
                <span>Filter: {selectedCategory}</span>
              </button>

              {filterMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest rounded-xl shadow-xl z-30 py-1.5 border border-surface-container-high">
                  {['All', 'Electronics', 'Accessories', 'Home', 'Fashion'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setSelectedCategory(cat); setFilterMenuOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 font-body-sm text-body-sm ${selectedCategory === cat ? 'bg-primary/10 text-primary font-semibold' : 'text-on-surface hover:bg-surface-container-low'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              title="Export CSV"
              className="inline-flex items-center justify-center p-2 rounded-xl bg-surface hover:bg-surface-container text-on-surface-variant transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">file_download</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-caption text-caption uppercase tracking-wider">
                <th className="py-3 px-space-md font-semibold w-20">Image</th>
                <th className="py-3 px-space-md font-semibold">Product Name</th>
                <th className="py-3 px-space-md font-semibold">SKU</th>
                <th className="py-3 px-space-md font-semibold">Category</th>
                <th className="py-3 px-space-md font-semibold">Price</th>
                <th className="py-3 px-space-md font-semibold">Stock</th>
                <th className="py-3 px-space-md font-semibold text-right w-16">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-low/40">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-outline text-xs">
                    No products found matching your search.
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => {
                      if (setSelectedProduct) setSelectedProduct(p);
                      setActiveModule('product-details');
                    }}
                    className="hover:bg-surface-container-low/50 transition-colors group cursor-pointer"
                  >
                    <td className="py-3 px-space-md">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-container-high flex items-center justify-center relative shadow-sm">
                        <img
                          alt={p.name}
                          src={p.image}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      </div>
                    </td>
                    <td className="py-3 px-space-md font-title-sm text-title-sm text-on-surface font-semibold group-hover:text-primary transition-colors">
                      {p.name}
                    </td>
                    <td className="py-3 px-space-md font-body-sm text-body-sm text-outline">
                      {p.sku}
                    </td>
                    <td className="py-3 px-space-md">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-surface-container font-label-sm text-label-sm text-on-surface font-medium">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3 px-space-md font-title-sm text-title-sm text-on-surface font-bold">
                      ₹{p.price.toLocaleString()}
                    </td>
                    <td className="py-3 px-space-md">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold ${
                          p.stockStatus === 'In Stock'
                            ? 'bg-secondary-fixed/40 text-on-secondary-fixed'
                            : 'bg-tertiary-fixed/60 text-on-tertiary-fixed'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${p.stockStatus === 'In Stock' ? 'bg-secondary' : 'bg-tertiary'}`}></span>
                        {p.stockStatus}
                      </span>
                    </td>
                    <td className="py-3 px-space-md text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => {
                          if (setSelectedProduct) setSelectedProduct(p);
                          setActiveModule('edit-product');
                        }}
                        title="Edit Product"
                        className="p-1 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-lg leading-none">edit</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Dynamic Pagination & Footer */}
        <div className="p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm bg-surface-container-lowest border-t border-surface-container-low">
          <span className="font-body-sm text-body-sm text-on-surface-variant order-2 sm:order-1">
            Showing <span className="font-semibold text-on-surface">{startItem}</span> to <span className="font-semibold text-on-surface">{endItem}</span> of <span className="font-semibold text-on-surface">{filteredProducts.length}</span> products
          </span>
          <div className="flex items-center gap-1 order-1 sm:order-2">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-outline hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
              title="Previous page"
            >
              <span className="material-symbols-outlined text-lg">chevron_left</span>
            </button>
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                onClick={() => setCurrentPage(pageNum)}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                  safeCurrentPage === pageNum
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {pageNum}
              </button>
            ))}
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-outline hover:bg-surface-container hover:text-on-surface transition-colors disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
              title="Next page"
            >
              <span className="material-symbols-outlined text-lg">chevron_right</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
