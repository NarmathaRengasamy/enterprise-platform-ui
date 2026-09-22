import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { INITIAL_PRODUCTS } from '../data/mockData';
import { Product } from '../types';
import { Button, Icon, StatusBadge } from '../components/common';

interface ProductDetailsPageProps {
  setActiveModule?: (module: string) => void;
  selectedProduct?: Product | null;
  setSelectedProduct?: (product: Product) => void;
}

export default function ProductDetailsPage({ setActiveModule, selectedProduct, setSelectedProduct }: ProductDetailsPageProps) {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const product =
    selectedProduct ||
    (id ? INITIAL_PRODUCTS.find((p) => String(p.id) === String(id)) : null) ||
    (INITIAL_PRODUCTS[0] as Product);
  const [selectedThumbIndex, setSelectedThumbIndex] = useState(0);
  const [mediaTab, setMediaTab] = useState<'images' | 'videos'>('images');
  const [selectedVariant, setSelectedVariant] = useState('');
  const [copiedSku, setCopiedSku] = useState(false);

  useEffect(() => {
    setSelectedThumbIndex(0);
    if (product.variants && product.variants.length > 0) {
      setSelectedVariant(product.variants[0].value);
    } else {
      setSelectedVariant('Standard');
    }
  }, [product.id]);

  const gallery = (product as any).gallery || [
    { id: 0, label: "Front", src: product.image },
    { id: 1, label: "Side", src: product.image },
    { id: 2, label: "Angled", src: product.image },
    { id: 3, label: "Detail", src: product.image }
  ];

  const currentImage = gallery[selectedThumbIndex]?.src || product.image;

  const handleCopySku = () => {
    navigator.clipboard.writeText(product.sku);
    setCopiedSku(true);
    setTimeout(() => setCopiedSku(false), 2000);
  };

  const variantsList = product.variants || [
    { option: "Option", value: "Standard", price: product.price, stock: `${product.stock} units`, status: product.stockStatus }
  ];

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
            startIcon="content_copy"
            onClick={() => alert(`Duplicated product ${product.name}`)}
          >
            Duplicate
          </Button>
          <Button
            variant="hover"
            size="md"
            startIcon="share"
            onClick={() => alert(`Share link generated for ${product.name}`)}
          >
            Share
          </Button>
          <Button
            variant="primary"
            size="md"
            startIcon="edit"
            onClick={() => {
              setSelectedProduct?.(product);
              setActiveModule?.('edit-product');
              navigate(`/products/${product.id}/edit`);
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
              <img
                alt={product.name}
                src={currentImage}
                className="w-full h-full object-contain object-center transition-all duration-300 group-hover:scale-[1.02]"
              />
            </div>

            {/* Thumbnail Selector Ribbon */}
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
          </div>

          {/* Media Management Section / Gallery Tabs */}
          <div className="bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container-low/60">
            <div className="flex items-center justify-between pb-space-sm mb-space-md border-b border-surface-container-low">
              <div className="flex items-center gap-space-xs">
                <span className="font-title-md text-title-md text-on-surface font-semibold">Media Gallery</span>
                <span className="font-caption text-caption text-outline px-2 py-0.5 rounded-full bg-surface-container-high font-medium">
                  {gallery.length + ((product as any).videos?.length || 0)} items
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
                  <span>Videos ({(product as any).videos?.length || 0})</span>
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
                {((product as any).videos || []).map((vid: any) => (
                  <div key={vid.id} className="relative group rounded-lg overflow-hidden aspect-square bg-surface-container-low shadow-sm">
                    <img alt="Video thumbnail" src={vid.thumbnail} className="w-full h-full object-cover opacity-90" />
                    <div className="absolute inset-0 bg-on-surface/30 flex items-center justify-center">
                      <div className="w-9 h-9 rounded-full bg-surface-container-lowest/90 backdrop-blur flex items-center justify-center shadow-md">
                        <Icon name="play_arrow" size="lg" color="primary" className="ml-0.5" />
                      </div>
                    </div>
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded font-caption text-caption bg-on-surface/80 text-surface-container-lowest text-[10px]">
                      {vid.duration}
                    </span>
                  </div>
                ))}
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
                <StatusBadge status={product.stockStatus} />
              </div>
              {/* SKU Meta Tag */}
              <div className="flex items-center gap-space-2xs">
                <span className="font-body-sm text-body-sm text-outline">SKU:</span>
                <span className="font-body-sm text-body-sm font-semibold text-on-surface-variant">
                  {product.sku}
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
                <span className="font-caption text-caption uppercase tracking-wider text-outline font-semibold">Retail Price</span>
                <div className="flex items-baseline gap-space-xs mt-0.5">
                  <span className="font-display-lg text-display-lg text-primary font-bold tracking-tight">
                    ₹{product.price.toLocaleString()}
                  </span>
                  {(product as any).originalPrice && (
                    <span className="font-body-sm text-body-sm text-outline line-through">
                      ₹{(product as any).originalPrice?.toLocaleString()}
                    </span>
                  )}
                  {(product as any).discount && (
                    <span className="font-label-sm text-label-sm text-secondary font-semibold">
                      {(product as any).discount}
                    </span>
                  )}
                </div>
              </div>
              {(product as any).margin && (
                <div className="flex flex-col items-end">
                  <span className="font-caption text-caption uppercase tracking-wider text-outline font-semibold">Margin</span>
                  <span className="font-title-sm text-title-sm text-on-surface font-semibold mt-0.5">
                    {(product as any).margin}
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
                  Omnichannel Verified
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-space-2xs pt-space-xs">
              <span className="font-caption text-caption uppercase tracking-wider text-outline font-semibold">Description</span>
              <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Variants Selector */}
            <div className="flex flex-col gap-space-2xs pt-space-xs">
              <div className="flex items-center justify-between">
                <span className="font-caption text-caption uppercase tracking-wider text-outline font-semibold">Variants</span>
                <span className="font-caption text-caption text-primary cursor-pointer hover:underline">Size &amp; Option Guide</span>
              </div>
              <div className="flex items-center gap-space-sm flex-wrap mt-1">
                {variantsList.map((v: any) => (
                  <Button
                    key={v.value}
                    variant={selectedVariant === v.value ? 'primary' : 'hover'}
                    size="md"
                    startIcon={selectedVariant === v.value ? 'check' : undefined}
                    onClick={() => setSelectedVariant(v.value)}
                  >
                    {v.value}
                  </Button>
                ))}
              </div>
            </div>

            {/* Inventory Snapshot */}
            <div className="grid grid-cols-3 gap-space-sm pt-space-xs">
              <div className="p-space-sm rounded-xl bg-surface-container-low flex flex-col">
                <span className="font-caption text-caption text-outline uppercase tracking-wider">Available</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold mt-1">
                  {product.stock}
                </span>
                <span className="font-caption text-caption text-secondary font-medium">In Warehouse</span>
              </div>
              <div className="p-space-sm rounded-xl bg-surface-container-low flex flex-col">
                <span className="font-caption text-caption text-outline uppercase tracking-wider">Committed</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold mt-1">
                  {(product as any).committed || 0}
                </span>
                <span className="font-caption text-caption text-outline font-medium">In Orders</span>
              </div>
              <div className="p-space-sm rounded-xl bg-surface-container-low flex flex-col">
                <span className="font-caption text-caption text-outline uppercase tracking-wider">Reorder Point</span>
                <span className="font-headline-sm text-headline-sm text-on-surface font-bold mt-1">
                  {(product as any).reorderPoint || 0}
                </span>
                <span className="font-caption text-caption text-outline font-medium">Safety stock</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
