import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Product } from '../types';
import { productService } from '../services/product.service';
import { Button, Icon, StatusBadge } from '../components/common';

interface ProductDetailsPageProps {
  setActiveModule?: (module: string) => void;
  selectedProduct?: Product | null;
  setSelectedProduct?: (product: Product) => void;
}

export default function ProductDetailsPage({
  setActiveModule,
  selectedProduct: propProduct,
  setSelectedProduct,
}: ProductDetailsPageProps) {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(propProduct || null);
  const [isLoading, setIsLoading] = useState(!propProduct && Boolean(id));
  const [error, setError] = useState<string | null>(null);

  const [selectedThumbIndex, setSelectedThumbIndex] = useState(0);
  const [mediaTab, setMediaTab] = useState<'images' | 'videos'>('images');
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [copiedSku, setCopiedSku] = useState(false);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      setIsLoading(true);
      setError(null);
      productService
        .getProductById(id)
        .then((data) => {
          setProduct(data);
          setSelectedProduct?.(data);
        })
        .catch((err) => {
          setError(err?.message || 'Product not found.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (propProduct) {
      setProduct(propProduct);
      setIsLoading(false);
    }
  }, [id, propProduct?.id]);

  useEffect(() => {
    setSelectedThumbIndex(0);
    setSelectedVariantIndex(0);
  }, [product?.id, product?.sku]);

  const variantsList = product?.variants && product.variants.length > 0
    ? product.variants
    : [];

  const hasVariants = variantsList.length > 0;
  const activeVariant = hasVariants ? (variantsList[selectedVariantIndex] || variantsList[0]) : null;

  // Selected Variant Price or fallback to base price
  const activePrice = activeVariant && activeVariant.price !== undefined && activeVariant.price !== null && Number(activeVariant.price) > 0
    ? Number(activeVariant.price)
    : (product?.price || 0);

  // Selected Variant SKU or product SKU
  const activeSku = activeVariant?.sku || product?.sku || '';

  // Selected Variant Status or product stock status
  const activeStatus = activeVariant?.status || product?.stockStatus || 'In Stock';

  // Selected Variant Stock / Capacity
  const getActiveStockDisplay = () => {
    if (activeVariant) {
      if (activeVariant.stock !== undefined && activeVariant.stock !== null && String(activeVariant.stock).trim() !== '') {
        const clean = typeof activeVariant.stock === 'string'
          ? activeVariant.stock.replace(/\s*units/gi, '').trim()
          : String(activeVariant.stock);
        return clean || 'Unspecified';
      }
      if (activeVariant.capacity !== undefined && activeVariant.capacity !== null && Number(activeVariant.capacity) >= 0) {
        return String(activeVariant.capacity);
      }
      return 'Unspecified';
    }
    if (product?.stock !== undefined && product?.stock !== null) {
      return String(product.stock);
    }
    return 'Unspecified';
  };

  const handleCopySku = () => {
    if (!activeSku) return;
    navigator.clipboard.writeText(activeSku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
  };

  const handleDeleteProduct = async () => {
    if (!product) return;
    setIsDeleting(true);
    try {
      await productService.deleteProduct(product.id || product.sku);
      setDeleteModalOpen(false);
      setActiveModule?.('products');
      navigate('/products');
    } catch (err: any) {
      alert(`Could not delete product: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="font-body-md text-body-md text-on-surface-variant">Loading product details...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-error/10 text-error flex items-center justify-center">
          <span className="material-symbols-outlined text-3xl">inventory_2</span>
        </div>
        <div>
          <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
            {error || 'Product Not Found'}
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-md">
            The requested product could not be located in the catalog. It may have been deleted or the SKU is incorrect.
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          startIcon="arrow_back"
          onClick={() => {
            setActiveModule?.('products');
            navigate('/products');
          }}
        >
          Back to Products Catalog
        </Button>
      </div>
    );
  }

  // Combine variant images with product gallery
  const variantGallery = activeVariant?.images && activeVariant.images.length > 0
    ? activeVariant.images.map((src: string, idx: number) => ({ id: `v-${idx}`, label: `${activeVariant.value || 'Variant'} ${idx + 1}`, src }))
    : [];

  const baseGallery = product.gallery && product.gallery.length > 0
    ? product.gallery
    : product.image
      ? [
          { id: 0, label: 'Front', src: product.image },
          { id: 1, label: 'Side', src: product.image },
          { id: 2, label: 'Angled', src: product.image },
          { id: 3, label: 'Detail', src: product.image },
        ]
      : [];

  const gallery = variantGallery.length > 0 ? [...variantGallery, ...baseGallery] : baseGallery;
  const currentImage = gallery[selectedThumbIndex]?.src || product.image;

  return (
    <div className="flex flex-col w-full pt-space-xs">
      {/* Sub-Header / Utility Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-space-md mb-space-lg">
        <div className="flex items-center gap-space-xs">
          <Button
            variant="hover"
            size="md"
            startIcon="arrow_back"
            onClick={() => {
              setActiveModule?.('products');
              navigate('/products');
            }}
          >
            Back to Products
          </Button>
          <span className="text-outline text-xs">/</span>
          <span className="font-caption text-caption uppercase tracking-wider text-outline px-2 py-1 rounded bg-surface-container-high font-semibold">
            SKU: {product.sku}
          </span>
        </div>
        <div className="flex items-center gap-space-xs">
          <Button
            variant="hover"
            size="md"
            startIcon="delete"
            onClick={() => setDeleteModalOpen(true)}
            className="text-error hover:bg-error-container/20"
          >
            Delete
          </Button>
          <Button
            variant="primary"
            size="md"
            startIcon="edit"
            onClick={() => {
              setSelectedProduct?.(product);
              setActiveModule?.('edit-product');
              navigate(`/products/${product.id || product.sku}/edit`);
            }}
          >
            Edit Product
          </Button>
        </div>
      </div>

      {/* Main 2-Column Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
        {/* LEFT COLUMN: Media Display (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-space-lg min-w-0">
          {/* Primary Showcase Card */}
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container-low/60 relative group overflow-hidden">
            <div className="absolute top-space-md left-space-md z-10 flex gap-space-2xs">
              <span className="px-2.5 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur text-on-surface font-caption text-caption shadow-sm flex items-center gap-1 font-semibold">
                <Icon name="verified" size="xs" color="primary" />
                High Resolution
              </span>
            </div>

            {/* Featured Display Container */}
            <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-surface-container-low flex items-center justify-center p-4">
              {currentImage ? (
                <img
                  alt={product.name}
                  src={currentImage}
                  className="w-full h-full object-contain object-center transition-all duration-300 group-hover:scale-[1.02]"
                />
              ) : (
                <span className="material-symbols-outlined text-outline text-6xl">
                  inventory_2
                </span>
              )}
            </div>

            {/* Thumbnail Selector Ribbon */}
            {gallery.length > 1 && (
              <div className="mt-space-md grid grid-cols-4 gap-space-sm">
                {gallery.map((thumb: any, idx: number) => (
                  <button
                    key={thumb.id || idx}
                    type="button"
                    onClick={() => setSelectedThumbIndex(idx)}
                    className={`group/thumb relative rounded-lg overflow-hidden aspect-[4/3] bg-surface-container-low transition-all cursor-pointer ${
                      selectedThumbIndex === idx
                        ? 'ring-2 ring-primary shadow-sm bg-surface-container-high'
                        : 'hover:bg-surface-container-high'
                    }`}
                  >
                    <img alt={thumb.label} src={thumb.src} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 right-1 px-1 rounded bg-surface-container-lowest/90 font-caption text-caption text-on-surface text-[10px]">
                      {thumb.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Media Management Section / Gallery Tabs */}
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container-low/60">
            <div className="flex items-center justify-between pb-space-sm mb-space-md border-b border-surface-container-low">
              <div className="flex items-center gap-space-xs">
                <span className="font-title-md text-title-md text-on-surface font-semibold">Media Gallery</span>
                <span className="font-caption text-caption text-outline px-2 py-0.5 rounded-full bg-surface-container-high font-medium">
                  {gallery.length + (product.videos?.length || 0)} items
                </span>
              </div>
              {/* Tab Bar */}
              <div className="inline-flex p-1 rounded-xl bg-surface-container">
                <button
                  type="button"
                  onClick={() => setMediaTab('images')}
                  className={`px-3 py-1 rounded-lg font-title-sm text-title-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                    mediaTab === 'images'
                      ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <Icon name="photo_library" size="xs" />
                  <span>Images ({gallery.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMediaTab('videos')}
                  className={`px-3 py-1 rounded-lg font-title-sm text-title-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                    mediaTab === 'videos'
                      ? 'bg-surface-container-lowest text-primary shadow-sm font-semibold'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <Icon name="videocam" size="xs" />
                  <span>Videos ({product.videos?.length || 0})</span>
                </button>
              </div>
            </div>

            {/* Media Grid: Images */}
            {mediaTab === 'images' ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
                {gallery.map((img: any, i: number) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden aspect-square bg-surface-container-low shadow-sm">
                    <img alt="Gallery item" src={img.src} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    {i === 0 && (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded font-caption text-caption bg-surface-container-lowest/90 text-on-surface text-[10px] font-semibold">
                        Primary
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* Media Grid: Videos */
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
                {(product.videos && product.videos.length > 0) ? (
                  product.videos.map((vid: any, vIdx: number) => (
                    <div key={vid.id || vIdx} className="relative group rounded-lg overflow-hidden aspect-square bg-surface-container-low shadow-sm">
                      <img alt="Video thumbnail" src={vid.thumbnail || product.image} className="w-full h-full object-cover opacity-90" />
                      <div className="absolute inset-0 bg-on-surface/30 flex items-center justify-center">
                        <div className="w-9 h-9 rounded-full bg-surface-container-lowest/90 backdrop-blur flex items-center justify-center shadow-md">
                          <Icon name="play_arrow" size="lg" color="primary" className="ml-0.5" />
                        </div>
                      </div>
                      <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded font-caption text-caption bg-on-surface/80 text-surface-container-lowest text-[10px]">
                        {vid.duration || 'Video'}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-8 text-center text-on-surface-variant font-caption text-caption">
                    No videos attached to this product.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Product Specifications (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-space-lg min-w-0">
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm border border-surface-container-low/60 flex flex-col gap-space-md">
            {/* Title & Stock Status */}
            <div className="flex flex-col gap-space-2xs">
              <div className="flex items-start justify-between gap-space-sm">
                <h1 className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
                  {product.name}
                </h1>
                <StatusBadge status={activeStatus} />
              </div>
              {/* SKU Meta Tag */}
              <div className="flex items-center gap-space-2xs">
                <span className="font-body-sm text-body-sm text-outline">SKU:</span>
                <span className="font-body-sm text-body-sm font-semibold text-on-surface-variant font-mono">
                  {activeSku}
                </span>
                <button
                  type="button"
                  onClick={handleCopySku}
                  className="ml-1 text-outline hover:text-primary transition-colors cursor-pointer"
                  title="Copy SKU"
                  aria-label="Copy SKU"
                >
                  <Icon name={copiedSku ? 'check' : 'content_copy'} size="xs" color={copiedSku ? 'secondary' : 'outline'} />
                </button>
              </div>
            </div>

            {/* Price & Operational Analytics */}
            <div className="p-space-md rounded-xl bg-surface-container-low flex items-baseline justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-caption text-caption uppercase tracking-wider text-outline font-semibold">
                    {hasVariants ? 'Selected Variant Price' : 'Retail Price'}
                  </span>
                  {hasVariants && activeVariant && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                      {activeVariant.value || activeVariant.title || 'Selected'}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-space-xs mt-0.5">
                  {activePrice > 0 ? (
                    <span className="font-display-lg text-display-lg text-primary font-bold tracking-tight">
                      ₹{activePrice.toLocaleString()}
                    </span>
                  ) : (
                    <span className="font-title-lg text-title-lg text-primary font-bold italic tracking-tight">
                      Not priced (On enquiry)
                    </span>
                  )}
                  {product.originalPrice && product.originalPrice > 0 && (
                    <span className="font-body-sm text-body-sm text-outline line-through">
                      ₹{product.originalPrice.toLocaleString()}
                    </span>
                  )}
                  {product.discount && (
                    <span className="font-label-sm text-label-sm text-secondary font-semibold">
                      {product.discount}
                    </span>
                  )}
                </div>
              </div>
              {product.margin && (
                <div className="flex flex-col items-end">
                  <span className="font-caption text-caption uppercase tracking-wider text-outline font-semibold">Margin</span>
                  <span className="font-title-sm text-title-sm text-on-surface font-semibold mt-0.5">
                    {product.margin}
                  </span>
                </div>
              )}
            </div>

            {/* Category Row */}
            <div className="flex flex-col gap-space-2xs pt-space-xs">
              <span className="font-caption text-caption uppercase tracking-wider text-outline font-semibold">Category</span>
              <div className="flex items-center gap-space-2xs flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-container-high text-on-surface font-body-sm text-body-sm font-semibold">
                  <Icon name="category" size="xs" color="primary" />
                  {product.category}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container text-on-surface-variant font-caption text-caption">
                  Catalog Verified
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-space-2xs pt-space-xs">
              <span className="font-caption text-caption uppercase tracking-wider text-outline font-semibold">Description</span>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed whitespace-pre-line">
                {product.description || 'No description provided for this product.'}
              </p>
              {hasVariants && activeVariant?.description && (
                <div className="mt-2 p-3 rounded-xl bg-surface-container-low/70 border border-surface-container-high text-body-sm text-on-surface">
                  <span className="font-semibold text-primary block mb-0.5">{activeVariant.value || activeVariant.title} notes:</span>
                  <p className="text-on-surface-variant leading-relaxed whitespace-pre-line">{activeVariant.description}</p>
                </div>
              )}
            </div>

            {/* Variants Selector */}
            {hasVariants && (
              <div className="flex flex-col gap-space-2xs pt-space-xs">
                <div className="flex items-center justify-between">
                  <span className="font-caption text-caption uppercase tracking-wider text-outline font-semibold">
                    Available Variants ({variantsList.length})
                  </span>
                  {activeVariant && (
                    <span className="font-caption text-caption text-primary font-semibold">
                      Selected: {activeVariant.value || activeVariant.title || `Variant ${selectedVariantIndex + 1}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-space-sm flex-wrap mt-1">
                  {variantsList.map((v: any, vIdx: number) => {
                    const isSelected = selectedVariantIndex === vIdx;
                    const label = v.value || v.title || `Variant ${vIdx + 1}`;
                    const vPrice = v.price !== undefined && v.price !== null && Number(v.price) > 0 ? Number(v.price) : null;
                    const vStatus = v.status || 'In Stock';
                    const isOut = String(vStatus).toLowerCase().includes('out') || String(vStatus).toLowerCase().includes('unavail');

                    return (
                      <button
                        key={v.id || v.sku || `${label}-${vIdx}`}
                        type="button"
                        onClick={() => {
                          setSelectedVariantIndex(vIdx);
                          setSelectedThumbIndex(0);
                        }}
                        className={`px-3.5 py-2 rounded-xl text-body-sm font-semibold transition-all flex items-center gap-2 cursor-pointer border ${
                          isSelected
                            ? 'bg-primary text-on-primary border-primary shadow-md ring-2 ring-primary/20'
                            : isOut
                              ? 'bg-surface-container-low text-outline border-surface-container-high opacity-70 hover:opacity-100 hover:border-outline'
                              : 'bg-surface-container-lowest text-on-surface border-surface-container-high hover:border-primary/50 hover:bg-surface-container-low'
                        }`}
                      >
                        {isSelected && <Icon name="check" size="xs" color="inherit" />}
                        <span>{label}</span>
                        {vPrice !== null && (
                          <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-md ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-surface-container text-primary'
                          }`}>
                            ₹{vPrice.toLocaleString()}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Inventory Snapshot */}
            <div className="grid grid-cols-3 gap-space-sm pt-space-xs">
              <div className="p-space-sm rounded-xl bg-surface-container-low flex flex-col">
                <span className="font-caption text-caption text-outline uppercase tracking-wider">Available</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold mt-1 truncate" title={getActiveStockDisplay()}>
                  {getActiveStockDisplay()}
                </span>
                <span className="font-caption text-caption text-secondary font-medium">
                  {activeStatus === 'Out of Stock' ? 'Sold Out' : activeStatus === 'Low Stock' ? 'Limited Stock' : 'Available'}
                </span>
              </div>
              <div className="p-space-sm rounded-xl bg-surface-container-low flex flex-col">
                <span className="font-caption text-caption text-outline uppercase tracking-wider">Committed</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold mt-1">
                  {product.committed || 0}
                </span>
                <span className="font-caption text-caption text-outline font-medium">In Orders</span>
              </div>
              <div className="p-space-sm rounded-xl bg-surface-container-low flex flex-col">
                <span className="font-caption text-caption text-outline uppercase tracking-wider">Reorder Point</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold mt-1">
                  {product.reorderPoint || 10}
                </span>
                <span className="font-caption text-caption text-outline font-medium">Safety stock</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
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
                  Are you sure you want to delete <span className="font-semibold">{product.name}</span> ({product.sku})? This will permanently remove it from the catalog.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-container-low">
              <Button
                variant="ghost"
                size="md"
                disabled={isDeleting}
                onClick={() => setDeleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                disabled={isDeleting}
                startIcon={isDeleting ? 'progress_activity' : 'delete'}
                onClick={handleDeleteProduct}
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
