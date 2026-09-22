import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { INITIAL_PRODUCTS } from '../data/mockData';
import { Product } from '../types';
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
  Icon
} from '../components/common';

interface ProductsPageProps {
  setActiveModule?: (module: string) => void;
  setSelectedProduct?: (product: Product) => void;
}

export default function ProductsPage({ setActiveModule, setSelectedProduct }: ProductsPageProps) {
  const navigate = useNavigate();
  const [products] = useState<Product[]>(INITIAL_PRODUCTS as Product[]);
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
          value={products.length}
          trend="100% active"
          trendType="positive"
          icon="inventory_2"
          variant="primary"
        />

        <MetricsCard
          title="In Stock"
          value={inStockCount}
          trend={`${Math.round((inStockCount / Math.max(1, products.length)) * 100)}% Healthy`}
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
                Filter: {selectedCategory}
              </Button>

              {filterMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest rounded-xl shadow-xl z-30 py-1.5 border border-surface-container-high">
                  {['All', 'Electronics', 'Accessories', 'Home', 'Fashion'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => { setSelectedCategory(cat); setFilterMenuOpen(false); }}
                      className={`w-full text-left px-3 py-1.5 font-body-sm text-body-sm transition-colors cursor-pointer ${
                        selectedCategory === cat
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-on-surface hover:bg-surface-container-low'
                      }`}
                    >
                      {cat}
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
            {paginatedProducts.length === 0 ? (
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
                    if (setActiveModule) setActiveModule('product-details');
                    navigate(`/products/${p.id}`);
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
                    ₹{p.price.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.stockStatus} />
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      startIcon="edit"
                      onClick={() => {
                        if (setSelectedProduct) setSelectedProduct(p);
                        if (setActiveModule) setActiveModule('edit-product');
                        navigate(`/products/${p.id}/edit`);
                      }}
                      title="Edit Product"
                      aria-label="Edit Product"
                    />
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
          totalItems={filteredProducts.length}
          itemsPerPage={itemsPerPage}
          itemLabel="products"
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}
