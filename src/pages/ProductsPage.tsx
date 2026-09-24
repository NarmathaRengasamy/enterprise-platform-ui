import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { productsApi, categoriesApi, authApi } from '../api';
import { useApi, useDebounced } from '../hooks/useApi';
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
  ErrorBanner
} from '../components/common';

interface ProductsPageProps {
  setActiveModule: (module: string) => void;
  setSelectedProduct?: (product: Product) => void;
  /** Opens the list pre-filtered, e.g. arriving from a category's "View Products". */
  initialCategoryId?: string | null;
  onCategoryFilterApplied?: () => void;
}

export default function ProductsPage({
  setActiveModule,
  setSelectedProduct,
  initialCategoryId,
  onCategoryFilterApplied
}: ProductsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  /* Holds the category's id ('All' means unfiltered) — the name is only for the label. */
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId || 'All');

  /* Consume the incoming filter once, so going back to Products later starts clean. */
  useEffect(() => {
    if (!initialCategoryId) return;
    setSelectedCategoryId(initialCategoryId);
    onCategoryFilterApplied?.();
  }, [initialCategoryId]);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  /* Deleting is irreversible, so the row hands the product to a confirm step
     rather than acting on the click. */
  const [pendingDelete, setPendingDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  /* Search hits the API, so wait for a pause in typing. */
  const debouncedSearch = useDebounced(searchQuery);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategoryId]);

  /* Server-side search / filter / pagination. */
  const productsState = useApi(
    () =>
      productsApi.list({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        categoryId: selectedCategoryId === 'All' ? undefined : selectedCategoryId
      }),
    [currentPage, debouncedSearch, selectedCategoryId]
  );

  /* The metric cards describe the whole catalog, so they can't be derived from the
     current page. There is no /products/stats endpoint yet — this pulls the catalog
     once, unfiltered, purely for the counts. */
  const catalogState = useApi(() => productsApi.list({ limit: 100 }), []);
  const categoriesState = useApi(() => categoriesApi.list(), []);
  /* DELETE /products/:id is Admin-only, so the button reflects that. */
  const currentUser = useApi(() => authApi.me(), []);
  const canDelete = currentUser.data?.role === 'Admin';

  const paginatedProducts = (productsState.data?.data || []) as Product[];
  const totalItems = productsState.data?.total ?? 0;
  const totalPages = Math.max(1, productsState.data?.totalPages ?? 1);
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const catalog = (catalogState.data?.data || []) as Product[];
  const totalCatalog = catalogState.data?.total ?? catalog.length;
  const inStockCount = catalog.filter((p) => p.stockStatus === 'In Stock').length;
  /* Only products that HAVE a status and are not in stock. A product with no
     stock figure is unknown, not low. */
  const lowStockCount = catalog.filter(
    (p) => p.stockStatus && p.stockStatus !== 'In Stock'
  ).length;

  const categoryOptions = categoriesState.data?.data || [];
  const selectedCategoryLabel =
    selectedCategoryId === 'All'
      ? 'All'
      : categoryOptions.find((c: any) => c.id === selectedCategoryId)?.name ?? selectedCategoryId;
  const uniqueCategoriesCount = categoriesState.data?.total ?? categoryOptions.length;

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleteError('');
    setIsDeleting(true);
    try {
      await productsApi.remove(pendingDelete.id);
      setPendingDelete(null);
      /* The row is gone, so the page and the catalog-wide counters both move. */
      productsState.refetch();
      catalogState.refetch();
    } catch (err: any) {
      setDeleteError(err?.message || 'Could not delete the product.');
    } finally {
      setIsDeleting(false);
    }
  };

  /* Exports what the current filters select, not just the visible page. No
     /products/export endpoint yet, so the rows are fetched and serialised here. */
  const handleExportCSV = async () => {
    try {
      const all = await productsApi.list({
        limit: 1000,
        search: debouncedSearch || undefined,
        categoryId: selectedCategoryId === 'All' ? undefined : selectedCategoryId
      });
      const headers = 'ID,Product Name,SKU,Category,Price,Stock Status,Stock\n';
      const rows = (all.data || [])
        .map(
          (p: any) =>
            `"${p.id}","${p.name}","${p.sku}","${p.category}",${p.price},"${p.stockStatus}",${p.stock}`
        )
        .join('\n');
      const blob = new Blob([headers + rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'omniflow_products.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* the banner above the table already surfaces API failures */
    }
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
          <Button
            variant="primary"
            size="md"
            startIcon="add"
            onClick={() => setActiveModule('add-product')}
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
          trend="100% active"
          trendType="positive"
          icon="inventory_2"
          variant="primary"
        />

        <MetricsCard
          title="In Stock"
          value={inStockCount}
          trend={`${Math.round((inStockCount / Math.max(1, catalog.length)) * 100)}% Healthy`}
          trendType="positive"
          trendIcon="check_circle"
          icon="verified"
          variant="secondary"
        />

        <MetricsCard
          title="Low Stock Warning"
          value={lowStockCount}
          trend="Action required"
          trendType="warning"
          icon="warning"
          variant="tertiary"
        />

        <MetricsCard
          title="Categories"
          value={`${uniqueCategoriesCount} Active`}
          subtitle="Across all sales channels"
          icon="category"
          variant="neutral"
          onClick={() => setActiveModule('categories')}
        />
      </div>

      {productsState.error && (
        <ErrorBanner
          message={productsState.error}
          onRetry={productsState.refetch}
          className="mb-space-md"
        />
      )}

      {/* Main Table Container */}
      <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-surface-container-low/60 overflow-hidden flex flex-col">
        {/* Table Search & Filter Bar */}
        <div className="p-space-md flex flex-col sm:flex-row items-center justify-between gap-space-sm bg-surface-container-lowest">
          <SearchInput
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
          />

          <div className="flex items-center gap-space-xs w-full sm:w-auto justify-end relative">
            <div className="relative">
              <Button
                variant="hover"
                size="md"
                startIcon="filter_list"
                onClick={() => setFilterMenuOpen(!filterMenuOpen)}
              >
                Filter: {selectedCategoryLabel}
              </Button>

              {filterMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest rounded-xl shadow-xl z-30 py-1.5 border border-surface-container-high">
                  {[{ id: 'All', name: 'All' }, ...categoryOptions].map((cat: any) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => { setSelectedCategoryId(cat.id); setFilterMenuOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 font-body-sm text-body-sm transition-colors cursor-pointer ${
                        selectedCategoryId === cat.id
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-on-surface hover:bg-surface-container-low'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="hover"
              size="icon"
              startIcon="file_download"
              onClick={handleExportCSV}
              title="Export CSV"
              aria-label="Export CSV"
            />
          </div>
        </div>

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
              <TableHeadCell className="text-right w-16">Actions</TableHeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {productsState.loading ? (
              <TableEmptyState
                icon="progress_activity"
                title="Loading products…"
                description="Fetching the catalog from the API."
                colSpan={7}
              />
            ) : paginatedProducts.length === 0 ? (
              <TableEmptyState
                icon="inventory_2"
                title="No products found"
                description="No products matched your search or category filter."
                colSpan={7}
              />
            ) : (
              paginatedProducts.map((p) => (
                <TableRow
                  key={p.id}
                  clickable
                  onClick={() => {
                    if (setSelectedProduct) setSelectedProduct(p);
                    setActiveModule('product-details');
                  }}
                  className="group"
                >
                  <TableCell>
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-surface-container-high flex items-center justify-center relative shadow-sm">
                      <img
                        alt={p.name}
                        src={p.image}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-title-sm text-title-sm font-semibold group-hover:text-primary transition-colors">
                    {p.name}
                  </TableCell>
                  <TableCell className="text-outline">
                    {p.sku}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-surface-container font-label-sm text-label-sm text-on-surface font-medium">
                      {p.category}
                    </span>
                  </TableCell>
                  <TableCell className="font-title-sm text-title-sm font-bold">
                    {typeof p.price === 'number' ? `₹${p.price.toLocaleString()}` : 'Not priced'}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.stockStatus || 'Unspecified'} />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        startIcon="edit"
                        onClick={() => {
                          if (setSelectedProduct) setSelectedProduct(p);
                          setActiveModule('edit-product');
                        }}
                        title="Edit Product"
                        aria-label="Edit Product"
                      />
                      {/* Deleting is Admin-only on the API, so the control is
                          disabled rather than left to fail with a 403. */}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        startIcon="delete"
                        disabled={!canDelete}
                        onClick={() => setPendingDelete(p)}
                        title={canDelete ? 'Delete Product' : 'Only an Admin can delete a product'}
                        aria-label="Delete Product"
                        className={canDelete ? 'text-error hover:bg-error-container/40' : ''}
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
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          itemsPerPage={itemsPerPage}
          itemLabel="products"
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Delete confirmation — the action cannot be undone, so it names the
          product being removed rather than asking a generic "are you sure". */}
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-product-title"
        >
          <div className="bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md border border-surface-container-high p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-error-container/50 text-error flex items-center justify-center shrink-0">
                <Icon name="delete" size="lg" color="error" />
              </div>
              <div className="flex flex-col min-w-0">
                <h2
                  id="delete-product-title"
                  className="font-headline-sm text-headline-sm text-on-surface font-bold"
                >
                  Delete this product?
                </h2>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  <strong className="text-on-surface">{pendingDelete.name}</strong> (
                  {pendingDelete.sku}) will be removed from the catalog. This cannot be undone.
                </p>
              </div>
            </div>

            {deleteError && (
              <span className="font-body-sm text-body-sm text-error">{deleteError}</span>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-low">
              <Button
                variant="ghost"
                size="md"
                disabled={isDeleting}
                onClick={() => {
                  setPendingDelete(null);
                  setDeleteError('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                startIcon="delete"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
              >
                {isDeleting ? 'Deleting…' : 'Delete Product'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
