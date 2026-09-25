import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { productService, ProductStats } from '../services/product.service';
import { categoryService, CategoryItem } from '../services/category.service';
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
  Pagination,
  SearchInput,
  StatusBadge,
  Icon,
} from '../components/common';

interface ProductsPageProps {
  setActiveModule?: (module: string) => void;
  setSelectedProduct?: (product: Product) => void;
}

export default function ProductsPage({ setActiveModule, setSelectedProduct }: ProductsPageProps) {
  const navigate = useNavigate();

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  
  // Query & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 8;

  // UI status
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Helper to calculate and format price display (e.g. price range for products with different variant prices)
  const formatProductPrice = (p: Product) => {
    if (p.variants && p.variants.length > 0) {
      const validPrices = p.variants
        .map((v) => (typeof v.price === 'number' ? v.price : Number(v.price)))
        .filter((price) => !isNaN(price) && price > 0);

      if (validPrices.length > 0) {
        const min = Math.min(...validPrices);
        const max = Math.max(...validPrices);
        if (min !== max) {
          return `₹${min.toLocaleString()} - ₹${max.toLocaleString()}`;
        }
        return `₹${min.toLocaleString()}`;
      }
    }
    if (p.price !== undefined && p.price !== null && Number(p.price) > 0) {
      return `₹${Number(p.price).toLocaleString()}`;
    }
    return <span className="text-on-surface-variant font-normal text-xs italic">Not priced</span>;
  };

  // Load stats and categories on mount
  const loadStatsAndCategories = useCallback(async () => {
    try {
      const [statsData, categoriesData] = await Promise.all([
        productService.getProductStats().catch(() => null),
        categoryService.getCategories().catch(() => []),
      ]);
      if (statsData) setStats(statsData);
      if (categoriesData) setCategories(categoriesData);
    } catch (err) {
      console.warn('Could not load product stats or categories:', err);
    }
  }, []);

  useEffect(() => {
    loadStatsAndCategories();
  }, [loadStatsAndCategories]);

  // Load paginated products from API
  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await productService.getProducts({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch.trim() || undefined,
        category: selectedCategory === 'All' ? undefined : selectedCategory,
        status: selectedStatus === 'All' ? undefined : selectedStatus,
      });

      setProducts(response.data || []);
      setTotalPages(response.totalPages || 1);
      setTotalItems(response.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load products from server.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, debouncedSearch, selectedCategory, selectedStatus]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategory, selectedStatus]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      await productService.exportProducts({
        category: selectedCategory === 'All' ? undefined : selectedCategory,
        status: selectedStatus === 'All' ? undefined : selectedStatus,
        search: debouncedSearch.trim() || undefined,
      });
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setIsDeleting(true);
    try {
      await productService.deleteProduct(id);
      setDeleteConfirmId(null);
      await loadProducts();
      await loadStatsAndCategories();
    } catch (err: any) {
      alert(`Could not delete product: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Metrics calculation fallbacks
  const totalCatalog = stats?.total ?? totalItems;
  const inStockCount = stats?.inStock ?? products.filter((p) => p.stockStatus === 'In Stock').length;
  const lowStockCount = stats?.lowStock ?? products.filter((p) => p.stockStatus === 'Low Stock').length;
  const uniqueCategoriesCount = stats?.categoriesCount ?? (categories.length || new Set(products.map((p) => p.category)).size);

  return (
    <div className="flex flex-col w-full">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg pt-space-xs">
        <div className="flex flex-col">
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">Products</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">Manage your product catalog, inventory, and variants</p>
        </div>
        <div className="flex items-center gap-space-xs">
          <Button
            variant="primary"
            size="md"
            startIcon="add"
            onClick={() => {
              setActiveModule?.('add-product');
              navigate('/products/add');
            }}
          >
            Add Product
          </Button>
        </div>
      </div>

      {/* 4 Standard Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md mb-space-lg">
        <MetricsCard
          title="Total Catalog"
          value={totalCatalog}
          trend={`${stats?.inStockPercentage ?? 100}% in stock`}
          trendType="positive"
          icon="inventory_2"
          variant="primary"
        />

        <MetricsCard
          title="In Stock"
          value={inStockCount}
          trend={`${stats?.inStockPercentage ?? 100}% Healthy`}
          trendType="positive"
          trendIcon="check_circle"
          icon="verified"
          variant="secondary"
        />

        <MetricsCard
          title="Low Stock Warning"
          value={lowStockCount}
          trend={lowStockCount > 0 ? 'Action required' : 'Optimal'}
          trendType={lowStockCount > 0 ? 'warning' : 'positive'}
          icon="warning"
          variant="tertiary"
        />

        <MetricsCard
          title="Categories"
          value={`${uniqueCategoriesCount} Active`}
          subtitle="Across all business units"
          icon="category"
          variant="neutral"
          onClick={() => setActiveModule?.('categories')}
        />
      </div>

      {/* Main Table Container */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-low/60 flex flex-col">
        {/* Table Search & Filter Bar */}
        <div className="p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm bg-surface-container-lowest rounded-t-xl">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by title, SKU or category..."
          />

          <div className="flex items-center gap-space-xs w-full sm:w-auto justify-end relative flex-wrap">
            {/* Category Filter */}
            <div className="relative">
              <Button
                variant="hover"
                size="md"
                startIcon="filter_list"
                onClick={() => {
                  setFilterMenuOpen(!filterMenuOpen);
                  setStatusMenuOpen(false);
                }}
              >
                Category: {selectedCategory}
              </Button>

              {filterMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setFilterMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-64 bg-surface-container-lowest rounded-xl shadow-2xl z-50 py-1.5 border border-surface-container-high max-h-64 overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={() => { setSelectedCategory('All'); setFilterMenuOpen(false); }}
                      className={`w-full text-left px-3.5 py-2 font-body-sm text-body-sm transition-colors cursor-pointer ${
                        selectedCategory === 'All'
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-on-surface hover:bg-surface-container-low'
                      }`}
                    >
                      All Categories
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id || cat.name}
                        type="button"
                        onClick={() => { setSelectedCategory(cat.name); setFilterMenuOpen(false); }}
                        className={`w-full text-left px-3.5 py-2 font-body-sm text-body-sm transition-colors cursor-pointer ${
                          selectedCategory === cat.name
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-on-surface hover:bg-surface-container-low'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Button
                variant="hover"
                size="md"
                startIcon="tune"
                onClick={() => {
                  setStatusMenuOpen(!statusMenuOpen);
                  setFilterMenuOpen(false);
                }}
              >
                Status: {selectedStatus}
              </Button>

              {statusMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setStatusMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest rounded-xl shadow-2xl z-50 py-1.5 border border-surface-container-high max-h-60 overflow-y-auto overscroll-contain animate-in fade-in zoom-in-95">
                    {['All', 'In Stock', 'Low Stock', 'Out of Stock', 'Unspecified'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => { setSelectedStatus(st); setStatusMenuOpen(false); }}
                        className={`w-full text-left px-3.5 py-2 font-body-sm text-body-sm transition-colors cursor-pointer ${
                          selectedStatus === st
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-on-surface hover:bg-surface-container-low'
                        }`}
                      >
                        {st === 'All' ? 'All Statuses' : st}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* CSV Export Button */}
            <Button
              variant="hover"
              size="icon"
              startIcon={isExporting ? 'progress_activity' : 'file_download'}
              onClick={handleExportCSV}
              disabled={isExporting}
              title="Export filtered catalog to CSV"
              aria-label="Export CSV"
            />
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-4 my-2 p-3 rounded-xl bg-error-container/30 border border-error/20 flex items-center justify-between text-on-surface">
            <div className="flex items-center gap-2">
              <Icon name="error" color="error" size="sm" />
              <span className="text-body-sm">{error}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={loadProducts}>
              Retry
            </Button>
          </div>
        )}

        {/* Standardized Data Table */}
        <Table>
          <TableHead>
            <tr>
              <TableHeadCell className="w-20">Image</TableHeadCell>
              <TableHeadCell>Product Name</TableHeadCell>
              <TableHeadCell>SKU</TableHeadCell>
              <TableHeadCell>Category</TableHeadCell>
              <TableHeadCell>Price</TableHeadCell>
              <TableHeadCell>Stock</TableHeadCell>
              <TableHeadCell className="text-right w-24">Actions</TableHeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {isLoading ? (
              // Loading skeleton rows
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={`skeleton-${idx}`}>
                  <TableCell>
                    <div className="w-12 h-12 rounded-xl bg-surface-container-high animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-40 bg-surface-container-high rounded animate-pulse mb-1" />
                    <div className="h-3 w-20 bg-surface-container rounded animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-24 bg-surface-container-high rounded animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-6 w-28 bg-surface-container-high rounded-lg animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-4 w-16 bg-surface-container-high rounded animate-pulse" />
                  </TableCell>
                  <TableCell>
                    <div className="h-6 w-20 bg-surface-container-high rounded-full animate-pulse" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="h-8 w-16 bg-surface-container-high rounded-lg animate-pulse ml-auto" />
                  </TableCell>
                </TableRow>
              ))
            ) : products.length === 0 ? (
              <TableEmptyState
                icon="inventory_2"
                title="No products found"
                description={
                  searchQuery || selectedCategory !== 'All' || selectedStatus !== 'All'
                    ? 'No products matched your search or filters.'
                    : 'Your catalog is empty. Click "Add Product" to create your first offering.'
                }
                colSpan={7}
              />
            ) : (
              products.map((p) => (
                <TableRow
                  key={p.id || p.sku}
                  clickable
                  onClick={() => {
                    if (setSelectedProduct) setSelectedProduct(p);
                    if (setActiveModule) setActiveModule('product-details');
                    navigate(`/products/${p.id || p.sku}`);
                  }}
                  className="group"
                >
                  <TableCell>
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-container-high flex items-center justify-center relative shadow-sm">
                      {p.image ? (
                        <img
                          alt={p.name}
                          src={p.image}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-outline text-2xl">
                          inventory_2
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-title-sm text-title-sm font-semibold group-hover:text-primary transition-colors">
                    <div>{p.name}</div>
                    {p.variants && p.variants.length > 0 && (
                      <span className="text-[11px] text-outline font-normal">
                        {p.variants.length} variant{p.variants.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-outline font-mono text-xs">
                    {p.sku}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-surface-container font-label-sm text-label-sm text-on-surface font-medium">
                      {p.category}
                    </span>
                  </TableCell>
                  <TableCell className="font-title-sm text-title-sm font-bold whitespace-nowrap">
                    {formatProductPrice(p)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.stockStatus || (p.stock !== undefined && p.stock !== null ? (p.stock > 10 ? 'In Stock' : p.stock > 0 ? 'Low Stock' : 'Out of Stock') : 'Unspecified')} />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        startIcon="edit"
                        onClick={() => {
                          if (setSelectedProduct) setSelectedProduct(p);
                          if (setActiveModule) setActiveModule('edit-product');
                          navigate(`/products/${p.id || p.sku}/edit`);
                        }}
                        title="Edit Product"
                        aria-label="Edit Product"
                      />
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        startIcon="delete"
                        onClick={() => setDeleteConfirmId(p.id || p.sku)}
                        title="Delete Product"
                        aria-label="Delete Product"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Standardized Reusable Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          itemLabel="products"
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl max-w-md w-full p-6 border border-surface-container-high flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-error/10 text-error flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div>
                <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                  Delete Product?
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Are you sure you want to delete SKU <span className="font-mono font-semibold">{deleteConfirmId}</span>? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-container-low">
              <Button
                variant="ghost"
                size="md"
                disabled={isDeleting}
                onClick={() => setDeleteConfirmId(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                disabled={isDeleting}
                startIcon={isDeleting ? 'progress_activity' : 'delete'}
                onClick={() => handleDeleteProduct(deleteConfirmId)}
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
