import React, { useState } from 'react';
import { INITIAL_PRODUCTS } from '../data/mockData';

export default function AddEditProductPage({ setActiveModule, selectedProduct, isEditing: isEditingProp }) {
  const isEditing = isEditingProp !== undefined ? isEditingProp : Boolean(selectedProduct && selectedProduct.id);
  const [productName, setProductName] = useState(isEditing ? (selectedProduct?.name || '') : 'Urban Tech Minimalist Backpack');
  const [sku, setSku] = useState(isEditing ? (selectedProduct?.sku || '') : 'UT-BP-009-BLK');
  const [category, setCategory] = useState(isEditing ? (selectedProduct?.categoryCode || 'accessories') : 'accessories');
  const [price, setPrice] = useState(isEditing ? (selectedProduct?.price || 1299) : 1299);
  const [comparePrice, setComparePrice] = useState(isEditing ? (selectedProduct?.originalPrice || 1899) : 1899);
  const [stock, setStock] = useState(isEditing ? (selectedProduct?.stock || 142) : 142);
  const [description, setDescription] = useState(
    isEditing
      ? (selectedProduct?.description || '')
      : 'Engineered with waterproof ballistic nylon and ergonomic memory-foam straps. Features an internal padded 16-inch laptop compartment, hidden passport pocket, and quick-access magnetic modular pockets for effortless daily transit.'
  );
  const [variants, setVariants] = useState(
    (isEditing && selectedProduct?.variants) ? selectedProduct.variants : [
      { option: "Size", value: "M (Medium 20L)", price: 3499, stock: "18 units" },
      { option: "Size", value: "L (Large 28L)", price: 4199, stock: "12 units" },
      { option: "Colorway", value: "Stealth Slate", price: 3799, stock: "4 units (Low)" }
    ]
  );
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [newVariantOption, setNewVariantOption] = useState('Size');
  const [newVariantValue, setNewVariantValue] = useState('');
  const [newVariantPrice, setNewVariantPrice] = useState('');
  const [newVariantStock, setNewVariantStock] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleAddVariantSubmit = (e) => {
    e.preventDefault();
    if (!newVariantValue) return;
    setVariants([
      ...variants,
      {
        option: newVariantOption,
        value: newVariantValue,
        price: Number(newVariantPrice) || 999,
        stock: `${newVariantStock || 10} units`
      }
    ]);
    setNewVariantValue('');
    setNewVariantPrice('');
    setNewVariantStock('');
    setShowAddVariant(false);
  };

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setActiveModule('products');
    }, 1200);
  };

  return (
    <div className="flex flex-col gap-y-space-md w-full max-w-[1360px] mx-auto pt-space-xs">
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
            <span>Back to Products</span>
          </button>
          <div className="flex items-center gap-space-sm mt-0.5">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-bold">
              {isEditing ? 'Edit Product' : 'Add Product'}
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-sm text-label-sm bg-surface-container-high text-on-surface-variant shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
              Draft auto-saved 2m ago
            </span>
          </div>
        </div>
        <div className="flex items-center gap-space-xs">
          <button
            type="button"
            onClick={() => setActiveModule('products')}
            className="px-space-md h-[38px] rounded-xl font-label-md text-label-md text-on-surface-variant bg-surface-container-lowest shadow-sm hover:bg-surface-container-high transition-colors"
          >
            Discard Draft
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-space-md h-[38px] rounded-xl font-label-md text-label-md text-on-primary bg-primary-container hover:bg-primary shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">save</span>
            <span>{savedSuccess ? 'Saved!' : 'Save Product'}</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Grid Form */}
      <form className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg w-full items-start" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        {/* Left Column (General Information & Variants) */}
        <div className="lg:col-span-7 flex flex-col gap-space-md min-w-0">
          {/* General Product Details Card */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between pb-space-2xs">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">inventory_2</span>
                <h2 className="font-title-md text-title-md text-on-surface">Product Details</h2>
              </div>
              <span className="font-caption text-caption text-on-surface-variant uppercase tracking-wider">Step 1 of 3</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="product-name">
                Product Name <span className="text-error">*</span>
              </label>
              <input
                id="product-name"
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Enter product name (e.g. Classic Oxford Silk Blouse)"
                className="w-full h-[40px] px-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-lowest border border-surface-container-high placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="product-sku">
                  SKU <span className="text-error">*</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    id="product-sku"
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="Enter SKU"
                    className="w-full h-[40px] px-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-lowest border border-surface-container-high placeholder:text-outline uppercase focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                  <span className="material-symbols-outlined absolute right-3 text-outline text-lg pointer-events-none">barcode</span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="product-category">
                  Category <span className="text-error">*</span>
                </label>
                <div className="relative flex items-center">
                  <select
                    id="product-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full h-[40px] pl-space-sm pr-10 rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-lowest border border-surface-container-high focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer transition-all"
                  >
                    <option value="apparel">Apparel &amp; Fashion</option>
                    <option value="accessories">Bags &amp; Travel Gear</option>
                    <option value="footwear">Footwear &amp; Shoes</option>
                    <option value="electronics">Consumer Electronics</option>
                    <option value="lifestyle">Lifestyle &amp; Home</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 text-outline text-lg pointer-events-none">unfold_more</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="product-description">
                  Description <span className="text-error">*</span>
                </label>
                <span className="font-caption text-caption text-on-surface-variant">Markdown supported</span>
              </div>
              <textarea
                id="product-description"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter product description, fabric specifications, care instructions..."
                className="w-full p-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-lowest border border-surface-container-high placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-y transition-all"
              />
            </div>
          </div>

          {/* Variants Section */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">tune</span>
                <div>
                  <h2 className="font-title-md text-title-md text-on-surface">Variants</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Configure product sizes, colors, and specific inventory rates</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddVariant(!showAddVariant)}
                className="inline-flex items-center gap-1.5 px-space-sm h-8 rounded-xl font-label-sm text-label-sm text-primary bg-surface-container-high hover:bg-surface-container transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span>Add Variant</span>
              </button>
            </div>

            {/* Add Variant Form Inline */}
            {showAddVariant && (
              <div className="p-4 bg-surface-container-low rounded-xl flex flex-col gap-3 border border-surface-container-high">
                <span className="font-title-sm text-title-sm text-on-surface">New Variant Configuration</span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <select
                    value={newVariantOption}
                    onChange={(e) => setNewVariantOption(e.target.value)}
                    className="h-9 px-2 rounded-lg bg-surface-container-lowest text-on-surface border border-surface-container-high text-xs"
                  >
                    <option value="Size">Size</option>
                    <option value="Colorway">Colorway</option>
                    <option value="Material">Material</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Value (e.g. XL 32L)"
                    value={newVariantValue}
                    onChange={(e) => setNewVariantValue(e.target.value)}
                    className="h-9 px-2 rounded-lg bg-surface-container-lowest text-on-surface border border-surface-container-high text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Price ₹"
                    value={newVariantPrice}
                    onChange={(e) => setNewVariantPrice(e.target.value)}
                    className="h-9 px-2 rounded-lg bg-surface-container-lowest text-on-surface border border-surface-container-high text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Stock Qty"
                    value={newVariantStock}
                    onChange={(e) => setNewVariantStock(e.target.value)}
                    className="h-9 px-2 rounded-lg bg-surface-container-lowest text-on-surface border border-surface-container-high text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddVariant(false)}
                    className="px-3 py-1 text-xs rounded-lg text-on-surface-variant hover:bg-surface-container"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddVariantSubmit}
                    className="px-3 py-1 text-xs rounded-lg bg-primary text-on-primary font-semibold shadow-sm"
                  >
                    Add Variant
                  </button>
                </div>
              </div>
            )}

            {/* Variants Data Table */}
            <div className="w-full overflow-x-auto rounded-xl bg-surface-container-low/60 shadow-inner">
              <table className="w-full text-left text-on-surface min-w-[540px]">
                <thead className="bg-surface-container font-caption text-caption text-on-surface-variant uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-space-md font-semibold" scope="col">Variant Option</th>
                    <th className="py-2.5 px-space-md font-semibold" scope="col">Value</th>
                    <th className="py-2.5 px-space-md font-semibold" scope="col">Price (₹)</th>
                    <th className="py-2.5 px-space-md font-semibold" scope="col">Stock</th>
                    <th className="py-2.5 px-space-md font-semibold text-right" scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm">
                  {variants.map((v, i) => (
                    <tr key={i} className="hover:bg-surface-container-lowest transition-colors">
                      <td className="py-3 px-space-md font-medium text-on-surface">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-primary"></span>
                          {v.option}
                        </span>
                      </td>
                      <td className="py-3 px-space-md">
                        <span className="px-2 py-0.5 rounded-lg bg-surface-container-high font-label-sm text-label-sm font-semibold text-on-surface">
                          {v.value}
                        </span>
                      </td>
                      <td className="py-3 px-space-md font-semibold text-on-surface">
                        ₹ {Number(v.price).toLocaleString()}.00
                      </td>
                      <td className="py-3 px-space-md">
                        <span className="px-2.5 py-0.5 rounded-full font-label-sm text-label-sm bg-secondary-container/40 text-on-secondary-container font-semibold">
                          {v.stock}
                        </span>
                      </td>
                      <td className="py-3 px-space-md text-right">
                        <button
                          type="button"
                          onClick={() => setVariants(variants.filter((_, idx) => idx !== i))}
                          className="p-1 rounded-lg text-error hover:bg-error-container/30 transition-colors"
                          title="Remove variant"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column (Media Uploads, Pricing, Inventory) */}
        <div className="lg:col-span-5 flex flex-col gap-space-md min-w-0">
          {/* Media Uploads */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">photo_library</span>
                <h2 className="font-title-md text-title-md text-on-surface">Product Media</h2>
              </div>
              <span className="font-caption text-caption text-outline">Up to 10 photos</span>
            </div>

            {/* Droppable Upload Zone */}
            <div className="border-2 border-dashed border-outline-variant rounded-xl p-6 flex flex-col items-center justify-center text-center bg-surface-container-low/40 hover:bg-surface-container-low transition-colors cursor-pointer group">
              <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-primary mb-2 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl">cloud_upload</span>
              </div>
              <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                Click or drag images to upload
              </span>
              <span className="font-caption text-caption text-on-surface-variant mt-1">
                PNG, JPG, WebP up to 10MB per file
              </span>
            </div>
          </div>

          {/* Pricing & Inventory */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">payments</span>
              <h2 className="font-title-md text-title-md text-on-surface">Pricing &amp; Inventory</h2>
            </div>

            <div className="grid grid-cols-2 gap-space-md">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface">Price (₹)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full h-[40px] px-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-lowest border border-surface-container-high focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface">Compare-at Price (₹)</label>
                <input
                  type="number"
                  value={comparePrice}
                  onChange={(e) => setComparePrice(Number(e.target.value))}
                  className="w-full h-[40px] px-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-lowest border border-surface-container-high focus:outline-none focus:border-primary transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-space-md">
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface">Quantity In Stock</label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(Number(e.target.value))}
                  className="w-full h-[40px] px-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-lowest border border-surface-container-high focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-label-md text-label-md text-on-surface">Reorder Point</label>
                <input
                  type="number"
                  defaultValue={20}
                  className="w-full h-[40px] px-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-lowest border border-surface-container-high focus:outline-none focus:border-primary transition-all"
                />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
