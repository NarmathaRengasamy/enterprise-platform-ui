import React, { useRef, useState } from 'react';
import { INITIAL_PRODUCTS, INITIAL_CATEGORIES } from '../data/mockData';
import VisualAssetsUploader, {
  createEmptyMedia,
  flattenMedia,
  countMedia,
  releasePreviews
} from '../components/VisualAssetsUploader';

// Industry-agnostic presets to accelerate setup for any business vertical
const INDUSTRY_PRESETS = [
  {
    label: "SaaS & Subscriptions",
    icon: "cloud",
    dimensions: [
      { name: "Plan Tier", values: ["Starter", "Pro", "Enterprise"] },
      { name: "Billing Cycle", values: ["Monthly", "Annual (Save 20%)"] }
    ],
    defaultUnit: "licenses"
  },
  {
    label: "Hospitality & Stay",
    icon: "hotel",
    dimensions: [
      { name: "Room Category", values: ["Deluxe King Room", "Executive Suite"] },
      { name: "Meal Package", values: ["Room Only", "Breakfast Included"] }
    ],
    defaultUnit: "rooms"
  },
  {
    label: "Consulting & Services",
    icon: "work",
    dimensions: [
      { name: "Deliverable Scope", values: ["Standard Audit", "Full Implementation"] },
      { name: "Turnaround SLA", values: ["Standard (7 Days)", "Rush Priority (48h)"] }
    ],
    defaultUnit: "slots"
  },
  {
    label: "Healthcare & Clinic",
    icon: "medical_services",
    dimensions: [
      { name: "Consultation Mode", values: ["Tele-Health Video", "In-Clinic Visit"] },
      { name: "Practitioner", values: ["General Specialist", "Senior Consultant"] }
    ],
    defaultUnit: "appointments"
  },
  {
    label: "Physical Goods & Gear",
    icon: "inventory_2",
    dimensions: [
      { name: "Size / Capacity", values: ["Medium (20L)", "Large (28L)"] },
      { name: "Colorway", values: ["Stealth Slate", "Obsidian Black"] }
    ],
    defaultUnit: "units"
  }
];

export default function AddEditProductPage({ setActiveModule, selectedProduct, isEditing: isEditingProp, categories: categoriesProp }) {
  const isEditing = isEditingProp !== undefined ? isEditingProp : Boolean(selectedProduct && selectedProduct.id);
  const categoriesList = categoriesProp && categoriesProp.length > 0 ? categoriesProp : INITIAL_CATEGORIES;

  const [productName, setProductName] = useState(isEditing ? (selectedProduct?.name || '') : '');
  const [sku, setSku] = useState(isEditing ? (selectedProduct?.sku || '') : '');
  const [category, setCategory] = useState(
    isEditing
      ? (selectedProduct?.category || selectedProduct?.categoryCode || (categoriesList[0]?.name || ''))
      : (categoriesList[0]?.name || '')
  );
  const [description, setDescription] = useState(
    isEditing ? (selectedProduct?.description || '') : ''
  );

  // Business-Agnostic Variants & Combinations State
  const [variants, setVariants] = useState(
    (isEditing && selectedProduct?.variants)
      ? selectedProduct.variants.map((v, i) => ({
          id: `var-${i}-${Date.now()}`,
          title: v.value ? `${v.option || 'Option'}: ${v.value}` : 'Standard Package',
          attributes: [{ name: v.option || 'Option', value: v.value || 'Standard' }],
          sku: `${sku}-${(v.value || 'STD').substring(0, 3).toUpperCase()}`,
          price: Number(v.price) || 0,
          capacity: typeof v.stock === 'string' ? Number(v.stock.replace(/[^0-9]/g, '')) || 0 : Number(v.stock) || 0,
          capacityUnit: 'units',
          media: createEmptyMedia(),
          status: String(v.stock || '').toLowerCase().includes('low') ? 'Limited' : 'Available'
        }))
      : []
  );

  // Single Product vs Variants Switch State
  const [hasVariants, setHasVariants] = useState(
    isEditing ? Boolean(selectedProduct?.variants && selectedProduct.variants.length > 1) : false
  );
  const [basePrice, setBasePrice] = useState(
    isEditing ? (selectedProduct?.price !== undefined ? selectedProduct.price : '') : ''
  );
  const [originalPrice, setOriginalPrice] = useState(
    isEditing ? (selectedProduct?.originalPrice !== undefined ? selectedProduct.originalPrice : '') : ''
  );
  const [stock, setStock] = useState(
    isEditing ? (selectedProduct?.stock !== undefined ? selectedProduct.stock : '') : ''
  );
  const [stockUnit, setStockUnit] = useState('units');
  const [stockStatus, setStockStatus] = useState('In Stock');

  // Visual assets for the offering as a whole, shown in the side rail in both modes
  const [offeringMedia, setOfferingMedia] = useState(createEmptyMedia());

  // Single Item Modal State (Add / Edit Single Item)
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [editingVariantIndex, setEditingVariantIndex] = useState(null);
  const [singleTitle, setSingleTitle] = useState('');
  const [singleSku, setSingleSku] = useState('');
  const [singlePrice, setSinglePrice] = useState('');
  const [singleCapacity, setSingleCapacity] = useState('');
  const [singleCapacityUnit, setSingleCapacityUnit] = useState('units');
  const [singleStatus, setSingleStatus] = useState('Available');

  // Visual assets for the option being edited in the dialog
  const [singleMedia, setSingleMedia] = useState(createEmptyMedia());
  // Flat list of the assets the option already owned when the dialog opened
  const mediaOnOpenRef = useRef([]);

  // Matrix Generator Modal State (Multi-Dimension Builder)
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [builderDimensions, setBuilderDimensions] = useState([
    { id: 'dim-1', name: 'Option Dimension 1', values: [], tagInput: '' }
  ]);
  const [matrixCapacityUnit, setMatrixCapacityUnit] = useState('units');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Open Single Option Modal in Create Mode
  const handleOpenAddSingle = () => {
    setEditingVariantIndex(null);
    setSingleTitle('');
    setSingleSku(sku ? `${sku}-OPT-${variants.length + 1}` : '');
    setSinglePrice('');
    setSingleCapacity('');
    setSingleCapacityUnit('units');
    setSingleStatus('Available');
    setSingleMedia(createEmptyMedia());
    mediaOnOpenRef.current = [];
    setIsSingleModalOpen(true);
  };

  // Open Single Option Modal in Edit Mode
  const handleEditSingle = (index) => {
    const v = variants[index];
    setEditingVariantIndex(index);
    setSingleTitle(v.title || '');
    setSingleSku(v.sku || `${sku}-${index + 1}`);
    setSinglePrice(v.price !== undefined ? v.price : '');
    setSingleCapacity(v.capacity !== undefined ? v.capacity : '10');
    setSingleCapacityUnit(v.capacityUnit || 'units');
    setSingleStatus(v.status || 'Available');
    const media = v.media || createEmptyMedia();
    setSingleMedia(media);
    mediaOnOpenRef.current = flattenMedia(media);
    setIsSingleModalOpen(true);
  };

  // Rail edits apply immediately, so a removed preview can be released at once
  const handleOfferingMediaChange = (next) => {
    const before = flattenMedia(offeringMedia);
    const after = flattenMedia(next);
    releasePreviews(before.filter((m) => !after.some((a) => a.id === m.id)));
    setOfferingMedia(next);
  };

  const handleCloseSingleModal = () => {
    // Discarding the dialog must not leak previews for files that were never saved
    const kept = mediaOnOpenRef.current || [];
    releasePreviews(flattenMedia(singleMedia).filter((m) => !kept.some((k) => k.id === m.id)));

    setSingleMedia(createEmptyMedia());
    setIsSingleModalOpen(false);
    setEditingVariantIndex(null);
  };

  const handleSaveSingleModal = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!singleTitle) return;

    const updatedItem = {
      id: editingVariantIndex !== null ? variants[editingVariantIndex].id : `var-${Date.now()}`,
      title: singleTitle,
      attributes: editingVariantIndex !== null && variants[editingVariantIndex].attributes?.length
        ? variants[editingVariantIndex].attributes
        : [{ name: 'Configuration', value: singleTitle }],
      sku: singleSku || `${sku}-${variants.length + 1}`,
      price: singlePrice === '' ? '' : Number(singlePrice) || 0,
      capacity: singleCapacity === '' ? '' : Number(singleCapacity) || 0,
      capacityUnit: singleCapacityUnit || 'units',
      media: singleMedia,
      status:
        singlePrice === '' || singleCapacity === ''
          ? 'Pending'
          : Number(singleCapacity) <= 0
          ? 'Sold Out'
          : singleStatus
    };

    if (editingVariantIndex !== null) {
      setVariants(variants.map((v, idx) => (idx === editingVariantIndex ? updatedItem : v)));
    } else {
      setVariants([...variants, updatedItem]);
    }

    // Assets dropped during this edit are now orphaned and safe to release
    const nextItems = flattenMedia(updatedItem.media);
    releasePreviews(
      (mediaOnOpenRef.current || []).filter((m) => !nextItems.some((n) => n.id === m.id))
    );
    mediaOnOpenRef.current = nextItems;
    handleCloseSingleModal();
  };

  // Matrix Generator Operations
  const handleOpenMatrixModal = () => {
    setIsMatrixModalOpen(true);
  };

  const handleApplyPreset = (preset) => {
    setBuilderDimensions(
      preset.dimensions.map((d, i) => ({
        id: `dim-${Date.now()}-${i}`,
        name: d.name,
        values: [...d.values],
        tagInput: ''
      }))
    );
    setMatrixCapacityUnit(preset.defaultUnit);
  };

  const handleAddDimension = () => {
    setBuilderDimensions([
      ...builderDimensions,
      {
        id: `dim-${Date.now()}`,
        name: `Dimension ${builderDimensions.length + 1}`,
        values: [],
        tagInput: ''
      }
    ]);
  };

  const handleRemoveDimension = (dimId) => {
    if (builderDimensions.length <= 1) return;
    setBuilderDimensions(builderDimensions.filter((d) => d.id !== dimId));
  };

  const handleAddTag = (dimIndex) => {
    const dim = builderDimensions[dimIndex];
    const val = (dim.tagInput || '').trim();
    if (!val || dim.values.includes(val)) return;

    const updated = [...builderDimensions];
    updated[dimIndex] = {
      ...dim,
      values: [...dim.values, val],
      tagInput: ''
    };
    setBuilderDimensions(updated);
  };

  const handleRemoveTag = (dimIndex, tagToRemove) => {
    const dim = builderDimensions[dimIndex];
    const updated = [...builderDimensions];
    updated[dimIndex] = {
      ...dim,
      values: dim.values.filter((v) => v !== tagToRemove)
    };
    setBuilderDimensions(updated);
  };

  // Cartesian Product Calculation for Combinations
  const totalCombinationsCount = builderDimensions.reduce(
    (acc, dim) => acc * Math.max(dim.values.length, 1),
    builderDimensions.every((d) => d.values.length > 0) ? 1 : 0
  );

  const handleGenerateMatrix = () => {
    const validDims = builderDimensions.filter((d) => d.values.length > 0);
    if (validDims.length === 0) return;

    // Helper: Cartesian product of arrays
    const cartesian = (arrays) => {
      return arrays.reduce(
        (acc, curr) => acc.flatMap((c) => curr.map((n) => [...c, n])),
        [[]]
      );
    };

    const valueArrays = validDims.map((d) => d.values);
    const combinations = cartesian(valueArrays);

    const generatedVariants = combinations.map((combo, idx) => {
      const attributes = combo.map((val, dimIdx) => ({
        name: validDims[dimIdx].name,
        value: val
      }));

      const title = combo.join(' · ');
      const skuSuffix = combo
        .map((c) => c.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase())
        .join('-');

      return {
        id: `gen-${Date.now()}-${idx}`,
        title,
        attributes,
        sku: `${sku}-${skuSuffix}`,
        price: '',
        capacity: '',
        capacityUnit: matrixCapacityUnit,
        media: createEmptyMedia(),
        status: 'Pending'
      };
    });

    setVariants(generatedVariants);
    setIsMatrixModalOpen(false);
  };

  // A generated row stays incomplete until both price and stock are filled in
  const isVariantIncomplete = (v) =>
    v.price === '' || v.price === null || v.price === undefined ||
    v.capacity === '' || v.capacity === null || v.capacity === undefined;

  const pendingVariantsCount = variants.filter(isVariantIncomplete).length;

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setActiveModule('products');
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-y-space-md w-full max-w-[1400px] mx-auto pt-space-xs pb-space-xl">
      {/* Top Action & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-y-space-xs py-space-xs">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setActiveModule('products')}
            className="inline-flex items-center gap-1.5 font-label-md text-label-md text-primary hover:text-primary-fixed-variant transition-colors group cursor-pointer text-left"
          >
            <span className="material-symbols-outlined text-base group-hover:-translate-x-0.5 transition-transform">
              arrow_back
            </span>
            <span>Back to Catalog</span>
          </button>
          <div className="flex items-center gap-space-sm mt-0.5">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              {isEditing ? 'Edit Offering / Product' : 'Create New Offering'}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm bg-surface-container-high text-on-surface-variant shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              Auto-saved
            </span>
          </div>
        </div>
        <div className="flex items-center gap-space-xs">
          <button
            type="button"
            onClick={() => setActiveModule('products')}
            className="px-space-md h-[38px] rounded-xl font-label-md text-label-md text-on-surface-variant bg-surface-container-lowest shadow-sm hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            Discard Draft
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-space-md h-[38px] rounded-xl font-label-md text-label-md text-on-primary bg-primary-container hover:bg-primary shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">save</span>
            <span>{savedSuccess ? 'Saved!' : 'Save Offering'}</span>
          </button>
        </div>
      </div>

      {/* Main Form — details and pricing on the left, visual assets pinned on the right */}
      <form
        className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg w-full items-start"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        <div className="lg:col-span-8 flex flex-col gap-space-lg w-full min-w-0">
        {/* Offering Details */}
        <div className="w-full bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container flex flex-col gap-space-md justify-between">
            <div className="flex flex-col gap-space-md">
              <div className="flex items-center justify-between pb-space-2xs border-b border-surface-container-low">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">inventory_2</span>
                  <h2 className="font-title-md text-title-md text-on-surface font-semibold">General Information</h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full font-label-sm text-label-sm bg-surface-container text-on-surface-variant">
                  Core Details
                </span>
              </div>

              {/* Title / Name */}
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="offering-name">
                  Title / Service Name <span className="text-error">*</span>
                </label>
                <input
                  id="offering-name"
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Executive Suite / SaaS Enterprise Plan / Consulting Package"
                  className="w-full h-[42px] px-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-low/40 border border-surface-container-high placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                />
              </div>

              {/* SKU / Code & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="offering-code">
                    Base Identifier / SKU <span className="text-error">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="offering-code"
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder="e.g. SRV-001 or PRD-009"
                      className="w-full h-[42px] px-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-low/40 border border-surface-container-high placeholder:text-outline uppercase focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      required
                    />
                    <span className="material-symbols-outlined absolute right-3 text-outline text-lg pointer-events-none">qr_code_2</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="offering-category">
                      Category <span className="text-error">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setActiveModule('categories')}
                      className="font-caption text-caption text-primary hover:underline cursor-pointer"
                    >
                      + Manage Categories
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <select
                      id="offering-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full h-[42px] pl-space-sm pr-10 rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-low/40 border border-surface-container-high focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer transition-all"
                    >
                      {categoriesList.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 text-outline text-lg pointer-events-none">unfold_more</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="offering-description">
                    Scope &amp; Description <span className="text-error">*</span>
                  </label>
                  <span className="font-caption text-caption text-on-surface-variant">Markdown supported</span>
                </div>
                <textarea
                  id="offering-description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the inclusions, deliverables, conditions, and core value proposition..."
                  className="w-full p-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-low/40 border border-surface-container-high placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-y transition-all"
                />
              </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Pricing & Variant Configuration */}
        <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container flex flex-col gap-space-md w-full">
          {/* Card Header & Switch Toggle */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-space-xs border-b border-surface-container-low">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-2xl">sell</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
                    Pricing &amp; Variant Configuration
                  </h2>
                  <span className={`px-2.5 py-0.5 rounded-full font-label-sm text-label-sm font-semibold ${
                    hasVariants ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'
                  }`}>
                    {hasVariants ? `${variants.length} packages / combinations` : 'Single Product'}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Set base pricing and inventory stock, or enable multi-dimensional variants for options like sizes, plans, or tiers.
                </p>
              </div>
            </div>

            {/* Allow Variants Switch Toggle */}
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high shrink-0">
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Allow Variants
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={hasVariants}
                onClick={() => {
                  const nextState = !hasVariants;
                  setHasVariants(nextState);
                  if (nextState && variants.length === 0) {
                    setVariants([
                      {
                        id: `var-std-${Date.now()}`,
                        title: 'Standard Package',
                        attributes: [{ name: 'Option', value: 'Standard' }],
                        sku: sku ? `${sku}-STD` : 'STD-001',
                        price: basePrice === '' ? '' : Number(basePrice) || 0,
                        capacity: stock === '' ? '' : Number(stock) || 0,
                        capacityUnit: stockUnit || 'units',
                        media: createEmptyMedia(),
                        status:
                          basePrice === '' || stock === ''
                            ? 'Pending'
                            : stockStatus || 'Available'
                      }
                    ]);
                  }
                }}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  hasVariants ? 'bg-primary' : 'bg-outline-variant/60'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    hasVariants ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* IF ALLOW VARIANTS IS FALSE: Single Product View */}
          {!hasVariants ? (
            <div className="flex flex-col gap-space-md py-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md pt-1">
                {/* Price */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-on-surface flex items-center gap-1">
                    Price (₹) <span className="text-error">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-outline text-sm font-semibold">₹</span>
                    <input
                      type="number"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full h-[42px] pl-8 pr-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-low/40 border border-surface-container-high placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                      required={!hasVariants}
                    />
                  </div>
                </div>

                {/* Original Price */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-on-surface flex items-center gap-1">
                    Original Price (₹)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3.5 text-outline text-sm font-semibold">₹</span>
                    <input
                      type="number"
                      value={originalPrice}
                      onChange={(e) => setOriginalPrice(e.target.value)}
                      placeholder="e.g. 1999"
                      className="w-full h-[42px] pl-8 pr-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-low/40 border border-surface-container-high placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                {/* Stock Quantity */}
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-on-surface flex items-center gap-1">
                    Stock Quantity <span className="text-error">*</span>
                  </label>
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full h-[42px] px-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-low/40 border border-surface-container-high placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    required={!hasVariants}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* IF ALLOW VARIANTS IS TRUE: Multi-Dimension Matrix Builder UI */
            <div className="flex flex-col gap-space-md w-full">
              {/* Matrix Controls Header */}
              <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={handleOpenMatrixModal}
                    className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-xl font-label-md text-label-md text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all cursor-pointer"
                    title="Open Multi-Dimension Matrix Generator"
                  >
                    <span className="material-symbols-outlined text-base">auto_fix_high</span>
                    <span>Matrix Generator</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenAddSingle}
                    className="inline-flex items-center gap-1.5 px-4 h-9 rounded-xl font-label-md text-label-md text-on-primary bg-primary hover:bg-primary-fixed-variant transition-all shadow-sm cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    <span>Add Single Option</span>
                  </button>
                </div>

              {/* Quick Presets Ribbon if variants is empty */}
              {variants.length === 0 && (
                <div className="p-space-md rounded-xl bg-surface-container-low/60 border border-surface-container flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 text-on-surface font-title-sm text-title-sm font-semibold">
                    <span className="material-symbols-outlined text-primary text-base">magic_button</span>
                    <span>Get started with an industry preset template:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                    {INDUSTRY_PRESETS.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          handleApplyPreset(preset);
                          setIsMatrixModalOpen(true);
                        }}
                        className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container hover:border-primary hover:shadow-xs transition-all flex flex-col items-start gap-1.5 text-left cursor-pointer group"
                      >
                        <div className="flex items-center gap-1.5 text-primary">
                          <span className="material-symbols-outlined text-base group-hover:scale-110 transition-transform">
                            {preset.icon}
                          </span>
                          <span className="font-label-md text-label-md font-bold text-on-surface">
                            {preset.label}
                          </span>
                        </div>
                        <span className="font-caption text-caption text-on-surface-variant line-clamp-1">
                          {preset.dimensions.map((d) => d.name).join(' × ')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reminder to fill in the commercials the generator deliberately left blank */}
              {pendingVariantsCount > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  <span className="material-symbols-outlined text-amber-600 text-lg mt-0.5">edit_note</span>
                  <p className="font-body-sm text-body-sm text-on-surface">
                    <strong className="font-semibold">
                      {pendingVariantsCount} of {variants.length} option{variants.length === 1 ? '' : 's'} still need pricing.
                    </strong>{' '}
                    <span className="text-on-surface-variant">
                      Combinations are generated without price or stock — use the
                      <span className="material-symbols-outlined text-sm align-middle mx-0.5">edit</span>
                      edit action on each row to set them.
                    </span>
                  </p>
                </div>
              )}

              {/* Universal Combinations Table */}
              <div className="w-full overflow-x-auto rounded-xl border border-surface-container-high shadow-xs">
                <table className="w-full text-left text-on-surface min-w-[700px]">
                  <thead className="bg-surface-container font-caption text-caption text-on-surface-variant uppercase tracking-wider border-b border-surface-container-high">
                    <tr>
                      <th className="py-3 px-space-lg font-semibold" scope="col">Option Descriptor / Dimensions</th>
                      <th className="py-3 px-space-lg font-semibold" scope="col">Identifier / SKU</th>
                      <th className="py-3 px-space-lg font-semibold" scope="col">Price / Rate (₹)</th>
                      <th className="py-3 px-space-lg font-semibold" scope="col">Capacity &amp; Availability</th>
                      <th className="py-3 px-space-lg font-semibold" scope="col">Status</th>
                      <th className="py-3 px-space-lg font-semibold text-right" scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm bg-surface-container-lowest">
                    {variants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-on-surface-variant">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-outline">
                              <span className="material-symbols-outlined text-2xl">category</span>
                            </div>
                            <p className="font-title-sm text-title-sm text-on-surface font-semibold">No options or combinations defined yet</p>
                            <p className="text-body-sm text-on-surface-variant max-w-md">
                              Use the <strong>Matrix Generator</strong> to build multiple combinations in 1-click, or add single packages manually.
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <button
                                type="button"
                                onClick={handleOpenMatrixModal}
                                className="px-4 py-2 rounded-xl bg-primary text-on-primary font-semibold text-label-md cursor-pointer hover:bg-primary-fixed-variant"
                              >
                                Launch Matrix Generator
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      variants.map((v, i) => (
                        <tr key={v.id || i} className="hover:bg-surface-container-low/40 transition-colors">
                          {/* Title & Dimension Chips */}
                          <td className="py-3.5 px-space-lg">
                            <div className="flex flex-col gap-1">
                              <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                                {v.title}
                              </span>
                              {v.attributes && v.attributes.length > 0 && (
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {v.attributes.map((attr, attrIdx) => (
                                    <span
                                      key={attrIdx}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container-low text-on-surface-variant font-caption text-caption border border-surface-container"
                                    >
                                      <span className="text-outline font-medium">{attr.name}:</span>
                                      <span className="font-semibold text-on-surface">{attr.value}</span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Visual assets attached to this option */}
                              {countMedia(v.media) > 0 && (
                                <div className="flex items-center gap-1.5 pt-0.5">
                                  <div className="flex items-center -space-x-1.5">
                                    {flattenMedia(v.media).slice(0, 3).map((m) => (
                                      <span
                                        key={m.id}
                                        className="relative w-6 h-6 rounded-md overflow-hidden border border-surface-container-high bg-surface-container-low shadow-xs"
                                        title={m.name}
                                      >
                                        {m.kind === 'video' ? (
                                          <>
                                            <video src={m.src} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                                            <span className="absolute inset-0 flex items-center justify-center text-white">
                                              <span className="material-symbols-outlined text-[11px]">play_arrow</span>
                                            </span>
                                          </>
                                        ) : (
                                          <img src={m.src} alt={m.name} className="w-full h-full object-cover" />
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                  <span className="font-caption text-caption text-on-surface-variant">
                                    {(v.media.primary ? 1 : 0) + (v.media.gallery?.length || 0)} image
                                    {(v.media.primary ? 1 : 0) + (v.media.gallery?.length || 0) === 1 ? '' : 's'}
                                    {v.media.videos?.length > 0 && (
                                      <> · {v.media.videos.length} video{v.media.videos.length === 1 ? '' : 's'}</>
                                    )}
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* SKU / Code */}
                          <td className="py-3.5 px-space-lg font-mono text-body-sm text-on-surface-variant">
                            <span className="px-2 py-1 rounded bg-surface-container font-semibold text-on-surface text-xs tracking-wide">
                              {v.sku}
                            </span>
                          </td>

                          {/* Price / Commercial Rate — set via the row's edit action */}
                          <td className="py-3.5 px-space-lg">
                            {v.price === '' || v.price === null || v.price === undefined ? (
                              <span className="font-body-sm text-body-sm text-outline italic">Not set</span>
                            ) : (
                              <span className="font-bold text-on-surface text-base">
                                ₹ {Number(v.price).toLocaleString()}.00
                              </span>
                            )}
                          </td>

                          {/* Capacity & Allocation — set via the row's edit action */}
                          <td className="py-3.5 px-space-lg">
                            {v.capacity === '' || v.capacity === null || v.capacity === undefined ? (
                              <span className="font-body-sm text-body-sm text-outline italic">Not set</span>
                            ) : (
                              <span className="font-semibold text-on-surface">
                                {v.capacity}{' '}
                                <span className="font-normal text-on-surface-variant text-xs">
                                  {v.capacityUnit || 'units'}
                                </span>
                              </span>
                            )}
                          </td>

                          {/* Status Badge — derived from what has been entered so far */}
                          <td className="py-3.5 px-space-lg">
                            {isVariantIncomplete(v) ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-label-sm text-label-sm font-semibold bg-surface-container-high text-on-surface-variant">
                                <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                                Awaiting details
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-label-sm text-label-sm font-semibold ${
                                  v.status === 'Sold Out' || Number(v.capacity) <= 0
                                    ? 'bg-rose-500/15 text-rose-600'
                                    : v.status === 'Limited' || Number(v.capacity) <= 5
                                    ? 'bg-amber-500/15 text-amber-600'
                                    : 'bg-emerald-500/15 text-emerald-600'
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    v.status === 'Sold Out' || Number(v.capacity) <= 0
                                      ? 'bg-rose-500'
                                      : v.status === 'Limited' || Number(v.capacity) <= 5
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                  }`}
                                ></span>
                                {v.status === 'Sold Out' || Number(v.capacity) <= 0
                                  ? 'Unavailable'
                                  : v.status === 'Limited' || Number(v.capacity) <= 5
                                  ? 'Limited'
                                  : 'Available'}
                              </span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="py-3.5 px-space-lg text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleEditSingle(i)}
                                className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors cursor-pointer"
                                title="Edit option details"
                              >
                                <span className="material-symbols-outlined text-lg">edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setVariants(variants.filter((_, idx) => idx !== i))}
                                className="p-1.5 rounded-lg text-error hover:bg-error-container/40 transition-colors cursor-pointer"
                                title="Delete option"
                              >
                                <span className="material-symbols-outlined text-lg">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Visual assets rail — stays in view while the form is filled in */}
        <aside className="lg:col-span-4 w-full lg:sticky lg:top-20">
          <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container flex flex-col gap-space-md w-full lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <VisualAssetsUploader
              media={offeringMedia}
              onChange={handleOfferingMediaChange}
              largePrimary
            />

            {hasVariants && (
              <p className="flex items-start gap-2 p-2.5 rounded-xl bg-surface-container-low/60 border border-surface-container font-caption text-caption text-on-surface-variant">
                <span className="material-symbols-outlined text-primary text-base shrink-0">info</span>
                <span>
                  These apply to the whole offering. An individual option can carry its own
                  assets via its edit action.
                </span>
              </p>
            )}
          </div>
        </aside>
      </form>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 1: Universal Multi-Dimension Matrix Generator Popup
         ───────────────────────────────────────────────────────────── */}
      {isMatrixModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsMatrixModalOpen(false);
          }}
        >
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-surface-container-high p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-2xl">auto_fix_high</span>
                </div>
                <div>
                  <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                    Multi-Dimension Matrix Generator
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant">
                    Define custom dimensions &amp; tags to auto-generate all permutations
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMatrixModalOpen(false)}
                className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                title="Close modal"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Presets Quick-Select */}
            <div className="flex flex-col gap-1.5">
              <label className="font-label-sm text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                Load Preset Template
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {INDUSTRY_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleApplyPreset(p)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high font-label-sm text-label-sm text-on-surface transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm text-primary">{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Dimensions Builder */}
            <div className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                  Custom Dimensions
                </span>
                <button
                  type="button"
                  onClick={handleAddDimension}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-primary hover:bg-primary/10 font-label-sm text-label-sm font-semibold transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  <span>Add Dimension</span>
                </button>
              </div>

              {builderDimensions.map((dim, dimIdx) => (
                <div
                  key={dim.id}
                  className="p-4 rounded-xl bg-surface-container-low/70 border border-surface-container flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={dim.name}
                      onChange={(e) => {
                        const updated = [...builderDimensions];
                        updated[dimIdx].name = e.target.value;
                        setBuilderDimensions(updated);
                      }}
                      placeholder="e.g. Plan Tier / Room Type / Deliverable"
                      className="font-title-sm text-title-sm font-semibold text-on-surface bg-transparent border-b border-dashed border-outline-variant focus:border-primary focus:outline-none pb-0.5 w-2/3"
                    />
                    {builderDimensions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDimension(dim.id)}
                        className="p-1 text-error hover:bg-error-container/40 rounded-lg transition-colors"
                        title="Remove dimension"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    )}
                  </div>

                  {/* Chips Tag List */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {dim.values.map((val, valIdx) => (
                      <span
                        key={valIdx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-lowest font-label-md text-label-md text-on-surface font-semibold border border-surface-container shadow-2xs"
                      >
                        <span>{val}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(dimIdx, val)}
                          className="hover:text-error text-outline transition-colors ml-0.5"
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      </span>
                    ))}

                    {/* Tag input */}
                    <div className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="Type value & press Enter"
                        value={dim.tagInput || ''}
                        onChange={(e) => {
                          const updated = [...builderDimensions];
                          updated[dimIdx].tagInput = e.target.value;
                          setBuilderDimensions(updated);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ',') {
                            e.preventDefault();
                            handleAddTag(dimIdx);
                          }
                        }}
                        className="h-8 px-2.5 rounded-lg bg-surface-container-lowest text-on-surface border border-surface-container text-xs focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddTag(dimIdx)}
                        className="h-8 px-2 rounded-lg bg-surface-container text-on-surface hover:bg-surface-container-high text-xs font-semibold"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pricing is intentionally not collected here — it is entered per combination afterwards */}
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-surface-container-low border border-surface-container">
              <span className="material-symbols-outlined text-primary text-lg mt-0.5">info</span>
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                <strong className="font-semibold text-on-surface">No pricing needed here.</strong>{' '}
                The generator only builds the combinations — you set the price and stock for each
                one individually in the table once they are created.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-surface-container-low">
              <span className="font-label-md text-label-md text-primary font-semibold">
                ✨ Ready to generate {totalCombinationsCount} combinations
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsMatrixModalOpen(false)}
                  className="px-4 py-2 text-body-sm rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateMatrix}
                  disabled={totalCombinationsCount === 0}
                  className="px-6 py-2 text-body-sm rounded-xl bg-primary text-on-primary font-semibold shadow-sm hover:bg-primary-fixed-variant disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Generate {totalCombinationsCount} Combinations
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL 2: Universal Single Option Add / Edit Dialog
         ───────────────────────────────────────────────────────────── */}
      {isSingleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseSingleModal();
          }}
        >
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-surface-container-high p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-low">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-2xl">
                    {editingVariantIndex !== null ? 'edit_note' : 'add_circle'}
                  </span>
                </div>
                <div>
                  <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                    {editingVariantIndex !== null ? 'Edit Package / Option' : 'Add Single Option'}
                  </h3>
                  <p className="font-caption text-caption text-on-surface-variant">
                    Configure descriptor, code, rate, capacity and visuals
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseSingleModal}
                className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                title="Close modal"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveSingleModal} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface font-medium">
                  Option Descriptor / Title <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pro Tier · Annual or Deluxe King · Breakfast Included"
                  value={singleTitle}
                  onChange={(e) => setSingleTitle(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-body-md"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-on-surface font-medium">
                    Code / SKU <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PRO-ANN-01"
                    value={singleSku}
                    onChange={(e) => setSingleSku(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary uppercase text-body-md"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-on-surface font-medium">
                    Commercial Rate / Price (₹) <span className="text-error">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="e.g. 4999"
                    value={singlePrice}
                    onChange={(e) => setSinglePrice(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-body-md"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface font-medium">
                  Stock / Capacity <span className="text-error">*</span>
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 25"
                  value={singleCapacity}
                  onChange={(e) => setSingleCapacity(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-body-md"
                />
              </div>

              {/* Visual assets specific to this option */}
              <div className="pt-1 border-t border-surface-container-low">
                <VisualAssetsUploader
                  media={singleMedia}
                  onChange={setSingleMedia}
                  heading="Option Visual Assets"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-low">
                <button
                  type="button"
                  onClick={handleCloseSingleModal}
                  className="px-4 py-2 text-body-sm rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-body-sm rounded-xl bg-primary text-on-primary font-semibold shadow-sm hover:bg-primary-fixed-variant transition-colors cursor-pointer"
                >
                  {editingVariantIndex !== null ? 'Save Changes' : 'Add Option'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
