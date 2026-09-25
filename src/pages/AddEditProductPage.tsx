import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DESCRIPTION_ACCEPT, extractTextFromFile } from '../utils/documentText';
import { Button } from '../components/common';
import { productService, CreateProductInput } from '../services/product.service';
import { categoryService, CategoryItem } from '../services/category.service';
import { Product } from '../types';

// Industry-agnostic presets to accelerate setup for any business vertical
const INDUSTRY_PRESETS = [
  {
    label: "SaaS & Subscriptions",
    icon: "cloud",
    dimensions: [
      { name: "Plan Tier", values: ["Starter", "Pro", "Enterprise"] },
      { name: "Billing Cycle", values: ["Monthly", "Annual (Save 20%)"] }
    ]
  },
  {
    label: "Hospitality & Stay",
    icon: "hotel",
    dimensions: [
      { name: "Room Category", values: ["Deluxe King Room", "Executive Suite"] },
      { name: "Meal Package", values: ["Room Only", "Breakfast Included"] }
    ]
  },
  {
    label: "Consulting & Services",
    icon: "work",
    dimensions: [
      { name: "Deliverable Scope", values: ["Standard Audit", "Full Implementation"] },
      { name: "Turnaround SLA", values: ["Standard (7 Days)", "Rush Priority (48h)"] }
    ]
  },
  {
    label: "Healthcare & Clinic",
    icon: "medical_services",
    dimensions: [
      { name: "Consultation Mode", values: ["Tele-Health Video", "In-Clinic Visit"] },
      { name: "Practitioner", values: ["General Specialist", "Senior Consultant"] }
    ]
  },
  {
    label: "Physical Goods & Gear",
    icon: "inventory_2",
    dimensions: [
      { name: "Size / Capacity", values: ["Medium (20L)", "Large (28L)"] },
      { name: "Colorway", values: ["Stealth Slate", "Obsidian Black"] }
    ]
  }
];

export default function AddEditProductPage({
  setActiveModule,
  selectedProduct: selectedProductProp,
  isEditing: isEditingProp,
}: {
  setActiveModule?: (module: string) => void;
  selectedProduct?: Product | null;
  isEditing?: boolean;
}) {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(selectedProductProp || null);
  const isEditing = isEditingProp !== undefined ? isEditingProp : Boolean(id || (selectedProduct && selectedProduct.id));

  // Form Fields
  const [productName, setProductName] = useState(selectedProduct?.name || '');
  const [sku, setSku] = useState(selectedProduct?.sku || '');
  const [category, setCategory] = useState(selectedProduct?.categoryId || selectedProduct?.categoryCode || selectedProduct?.category || '');
  const [description, setDescription] = useState(selectedProduct?.description || '');
  const [basePrice, setBasePrice] = useState<string | number>(selectedProduct?.price !== undefined && selectedProduct?.price !== null ? selectedProduct.price : '');
  const [flatStock, setFlatStock] = useState<number | string>(selectedProduct?.stock !== undefined && selectedProduct?.stock !== null ? selectedProduct.stock : '');
  const [flatStockStatus, setFlatStockStatus] = useState(selectedProduct?.stockStatus || '');
  const [reorderPoint, setReorderPoint] = useState<number | string>(selectedProduct?.reorderPoint ?? 10);
  const [margin, setMargin] = useState(selectedProduct?.margin || '50.0%');
  const [discount, setDiscount] = useState(selectedProduct?.discount || '');

  const [mediaList, setMediaList] = useState<any[]>(
    selectedProduct?.gallery ? selectedProduct.gallery : (selectedProduct?.image ? [{ id: 'img-0', src: selectedProduct.image, label: 'Cover' }] : [])
  );
  const [videoList, setVideoList] = useState<any[]>(selectedProduct?.videos || []);
  
  // Categories from API
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([]);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  /* Description can be typed by hand or imported from a document. Each import is
     kept with its extracted text so dropping the file also drops its content. */
  const [descriptionImports, setDescriptionImports] = useState<{ id: string; name: string; text: string }[]>([]);
  const [descriptionImportError, setDescriptionImportError] = useState('');
  const [isImportingDescription, setIsImportingDescription] = useState(false);

  // Business-Agnostic Variants & Combinations State
  const [variants, setVariants] = useState<any[]>(
    selectedProduct?.variants
      ? selectedProduct.variants.map((v, i) => ({
          id: `var-${i}-${Date.now()}`,
          images: v.images || (v.image ? [v.image] : []),
          videos: v.videos || [],
          title: v.title || (v.value ? `${v.option || 'Option'}: ${v.value}` : 'Standard Package'),
          attributes: v.attributes || [{ name: v.option || 'Option', value: v.value || 'Standard' }],
          sku: v.sku || `${selectedProduct?.sku || sku || 'PROD001'}-${i + 1}`,
          price: v.price !== undefined && v.price !== null && v.price !== '' ? Number(v.price) : '',
          stock: v.stock !== undefined && v.stock !== null && v.stock !== '' ? (typeof v.stock === 'string' ? v.stock.replace(/[^0-9.]/g, '') : String(v.stock)) : '',
          status: v.status || ''
        }))
      : []
  );

  // Variant mode: when off, the offering carries one flat price instead of a matrix
  const [hasVariants, setHasVariants] = useState(
    Boolean(selectedProduct?.variants && selectedProduct.variants.length > 0)
  );

  // Single Item Modal State (Edit Single Item)
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [editingVariantIndex, setEditingVariantIndex] = useState<number | null>(null);
  const [singleTitle, setSingleTitle] = useState('');
  const [singleAttributes, setSingleAttributes] = useState<Array<{ name: string; value: string }>>([
    { name: 'Option Dimension 1', value: '' }
  ]);
  const [singleDescription, setSingleDescription] = useState('');
  const [singleSku, setSingleSku] = useState('');
  const [singlePrice, setSinglePrice] = useState('');
  const [singleStock, setSingleStock] = useState('');
  const [singleStatus, setSingleStatus] = useState('');

  // Matrix Generator Modal State (Multi-Dimension Builder)
  const [isMatrixModalOpen, setIsMatrixModalOpen] = useState(false);
  const [builderDimensions, setBuilderDimensions] = useState([
    { id: 'dim-1', name: 'Option Dimension 1', values: ['Standard', 'Premium'], tagInput: '' },
    { id: 'dim-2', name: 'Option Dimension 2', values: ['Tier A', 'Tier B'], tagInput: '' }
  ]);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isDiscardVariantsOpen, setIsDiscardVariantsOpen] = useState(false);

  // Bulk selection and common pricing
  const [selectedVariantIndices, setSelectedVariantIndices] = useState<number[]>([]);
  const [commonPriceInput, setCommonPriceInput] = useState<string>('');

  // Helper to generate the next sequential SKU starting from PROD001
  const generateNextSku = async (): Promise<string> => {
    try {
      const res = await productService.getProducts({ limit: 1000 });
      const existing = res.data || [];
      let maxNum = 0;
      for (const p of existing) {
        const match = p.sku?.match(/PROD(\d+)/i) || p.sku?.match(/PRD(\d+)/i) || p.sku?.match(/(\d+)/);
        if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
      const nextNum = maxNum + 1;
      return `PROD${String(nextNum).padStart(3, '0')}`;
    } catch {
      return 'PROD001';
    }
  };

  // Auto-generate next SKU (starting from PROD001) for new product
  useEffect(() => {
    if (!id && !selectedProductProp && !sku) {
      generateNextSku().then((nextSku) => {
        setSku((prev) => (prev ? prev : nextSku));
      });
    }
  }, [id, selectedProductProp]);

  // Fetch categories from backend API on mount
  useEffect(() => {
    categoryService
      .getCategories()
      .then((cats) => {
        if (cats && cats.length > 0) {
          setCategoriesList(cats);
        }
      })
      .catch((err) => {
        console.warn('Could not load categories:', err);
      });
  }, []);

  // Fetch product from API if editing by ID
  useEffect(() => {
    if (id) {
      setIsLoadingProduct(true);
      productService
        .getProductById(id)
        .then((prod) => {
          setSelectedProduct(prod);
          setProductName(prod.name || '');
          setSku(prod.sku || '');
          setCategory(prod.categoryId || prod.categoryCode || prod.category || '');
          setDescription(prod.description || '');
          setBasePrice(prod.price !== undefined && prod.price !== null ? prod.price : '');
          setFlatStock(prod.stock !== undefined && prod.stock !== null ? prod.stock : '');
          setFlatStockStatus(prod.stockStatus || '');
          setReorderPoint(prod.reorderPoint ?? 10);
          setMargin(prod.margin || '50.0%');
          setDiscount(prod.discount || '');
          
          if (prod.gallery && prod.gallery.length > 0) {
            setMediaList(prod.gallery);
          } else if (prod.image) {
            setMediaList([{ id: 'img-0', src: prod.image, label: 'Cover' }]);
          }

          if (prod.videos) {
            setVideoList(prod.videos);
          }

          if (prod.variants && prod.variants.length > 0) {
            setHasVariants(true);
            setVariants(
              prod.variants.map((v, i) => ({
                id: v.variantId || v.id || `var-${i}-${Date.now()}`,
                variantId: v.variantId,
                images: v.images || (v.image ? [v.image] : []),
                videos: v.videos || [],
                title: v.title || (v.value ? `${v.option || 'Option'}: ${v.value}` : `Option ${i + 1}`),
                description: v.description || '',
                attributes: v.attributes || [{ name: v.option || 'Option', value: v.value || 'Standard' }],
                sku: v.sku || `${prod.sku}-${i + 1}`,
                price: v.price !== undefined && v.price !== null && v.price !== '' ? Number(v.price) : '',
                stock: v.stock !== undefined && v.stock !== null && v.stock !== '' ? (typeof v.stock === 'string' ? v.stock.replace(/[^0-9.]/g, '') : String(v.stock)) : '',
                status: v.status || '',
              }))
            );
          }
        })
        .catch((err) => {
          setSaveError(`Could not load product details: ${err.message}`);
        })
        .finally(() => {
          setIsLoadingProduct(false);
        });
    }
  }, [id]);

  // Variants checkbox: turning it on hands pricing over to the matrix generator
  const handleToggleVariants = (checked) => {
    if (!checked && variants.length > 0) {
      setIsDiscardVariantsOpen(true);
      return;
    }
    setHasVariants(checked);
    if (checked) setIsMatrixModalOpen(true);
  };

  const handleConfirmDiscardVariants = () => {
    variants.forEach(releaseVariantMedia);
    setVariants([]);
    setSelectedVariantIndices([]);
    setHasVariants(false);
    setSaveError('');
    setIsDiscardVariantsOpen(false);
  };

  // Selection & Bulk Price Logic
  const isAllVariantsSelected = variants.length > 0 && selectedVariantIndices.length === variants.length;
  const isSomeVariantsSelected = selectedVariantIndices.length > 0 && !isAllVariantsSelected;

  const handleToggleSelectAllVariants = () => {
    if (isAllVariantsSelected) {
      setSelectedVariantIndices([]);
    } else {
      setSelectedVariantIndices(variants.map((_, i) => i));
    }
  };

  const handleToggleSelectVariant = (index: number) => {
    setSelectedVariantIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  const handleApplyCommonPrice = (target: 'all' | 'selected' = 'all') => {
    const parsedPrice = parseFloat(commonPriceInput);
    if (isNaN(parsedPrice) || parsedPrice < 0) return;

    if (target === 'all' || selectedVariantIndices.length === 0) {
      setVariants((prev) =>
        prev.map((v) => ({ ...v, price: parsedPrice }))
      );
    } else {
      const selectedSet = new Set(selectedVariantIndices);
      setVariants((prev) =>
        prev.map((v, i) => (selectedSet.has(i) ? { ...v, price: parsedPrice } : v))
      );
    }

    // Clear selections and reset input so banner closes automatically
    setSelectedVariantIndices([]);
    setCommonPriceInput('');
  };

  const handleDeleteSelectedVariants = () => {
    if (selectedVariantIndices.length === 0) return;
    const indicesSet = new Set(selectedVariantIndices);
    variants.forEach((v, i) => {
      if (indicesSet.has(i)) releaseVariantMedia(v);
    });
    setVariants((prev) => prev.filter((_, i) => !indicesSet.has(i)));
    setSelectedVariantIndices([]);
  };

  // Inline row editing straight from the combinations table
  const handleVariantField = (index, field, value) => {
    setSaveError('');
    setVariants(variants.map((v, idx) => (idx === index ? { ...v, [field]: value } : v)));
  };

  const handleVariantImages = (index: number, files: FileList | File[] | null) => {
    const picked: File[] = Array.from(files || []).filter(Boolean) as File[];
    if (picked.length === 0) return;
    const current = variants[index]?.images || [];
    handleVariantField(index, 'images', [
      ...current,
      ...picked.map((file: File) => URL.createObjectURL(file))
    ]);
  };

  const handleRemoveVariantImage = (index: number, imageIndex: number) => {
    const current = variants[index]?.images || [];
    const target = current[imageIndex];
    if (target) URL.revokeObjectURL(target);
    handleVariantField(index, 'images', current.filter((_, idx) => idx !== imageIndex));
  };

  const handleVariantVideos = (index: number, files: FileList | File[] | null) => {
    const picked: File[] = Array.from(files || []).filter(Boolean) as File[];
    if (picked.length === 0) return;
    const current = variants[index]?.videos || [];
    handleVariantField(index, 'videos', [
      ...current,
      ...picked.map((file: File) => ({ src: URL.createObjectURL(file), name: file.name }))
    ]);
  };

  const handleRemoveVariantVideo = (index, videoIndex) => {
    const current = variants[index]?.videos || [];
    const target = current[videoIndex];
    if (target?.src) URL.revokeObjectURL(target.src);
    handleVariantField(index, 'videos', current.filter((_, idx) => idx !== videoIndex));
  };

  // Hands every blob this combination holds back to the browser
  const releaseVariantMedia = (v) => {
    (v?.images || []).forEach((src) => src && URL.revokeObjectURL(src));
    (v?.videos || []).forEach((vid) => vid?.src && URL.revokeObjectURL(vid.src));
  };

  const handleDeleteVariant = (index) => {
    releaseVariantMedia(variants[index]);
    setVariants(variants.filter((_, idx) => idx !== index));
    setSelectedVariantIndices((prev) =>
      prev.filter((idx) => idx !== index).map((idx) => (idx > index ? idx - 1 : idx))
    );
  };

  const getVariantState = (v: any) => {
    const s = String(v.status || '').toLowerCase();

    if (s.includes('unspec') || s.includes('not set') || !s) {
      return { key: 'unspecified', label: 'Not set', tone: 'bg-surface-container text-on-surface-variant', dot: 'bg-outline' };
    }
    if (s.includes('out') || s.includes('unavail') || s.includes('sold')) {
      return { key: 'unavailable', label: 'Unavailable', tone: 'bg-rose-500/15 text-rose-600', dot: 'bg-rose-500' };
    }
    if (s.includes('limit') || s.includes('low')) {
      return { key: 'limited', label: 'Limited', tone: 'bg-amber-500/15 text-amber-600', dot: 'bg-amber-500' };
    }
    return { key: 'available', label: 'Available', tone: 'bg-emerald-500/15 text-emerald-600', dot: 'bg-emerald-500' };
  };

  // Open Single Option Modal in Edit Mode
  const handleEditSingle = (index: number) => {
    const v = variants[index];
    setEditingVariantIndex(index);
    const attrs: Array<{ name: string; value: string }> = Array.isArray(v.attributes) && v.attributes.length > 0
      ? v.attributes.map((a: any) => ({ name: String(a.name || 'Dimension').trim(), value: String(a.value || '').trim() }))
      : [{ name: String(v.option || 'Option').trim(), value: String(v.value || v.title || 'Standard').trim() }];
    setSingleAttributes(attrs.length > 0 ? attrs : [{ name: 'Option Dimension 1', value: '' }]);
    setSingleTitle(v.title || (v.value ? `${v.option || 'Option'}: ${v.value}` : attrs.map((a) => a.value).filter(Boolean).join(' · ')));
    setSingleDescription(v.description || '');
    setSingleSku(v.sku || `${sku || 'PROD001'}-${index + 1}`);
    setSinglePrice(v.price !== undefined && v.price !== null && v.price !== '' ? String(v.price) : '');
    const stockVal = v.stock !== undefined && v.stock !== null && v.stock !== ''
      ? (typeof v.stock === 'string' ? v.stock.replace(/[^0-9.]/g, '') : v.stock)
      : (v.capacity !== undefined ? v.capacity : '');
    setSingleStock(stockVal !== '' && stockVal !== undefined ? String(stockVal) : '');
    setSingleStatus(v.status || '');
    setIsSingleModalOpen(true);
  };

  const handleCloseSingleModal = () => {
    setIsSingleModalOpen(false);
    setEditingVariantIndex(null);
  };

  const handleSingleAttributeChange = (attrIndex: number, field: 'name' | 'value', val: string) => {
    const updated = singleAttributes.map((attr, idx) =>
      idx === attrIndex ? { ...attr, [field]: val } : attr
    );
    setSingleAttributes(updated);
    const computedTitle = updated.map((a) => a.value.trim()).filter(Boolean).join(' · ');
    if (computedTitle) {
      setSingleTitle(computedTitle);
    }
  };

  const handleAddSingleAttribute = () => {
    if (singleAttributes.length >= 6) return;
    setSingleAttributes((prev) => [
      ...prev,
      { name: `Option Dimension ${prev.length + 1}`, value: '' }
    ]);
  };

  const handleRemoveSingleAttribute = (attrIndex: number) => {
    if (singleAttributes.length <= 1) return;
    const updated = singleAttributes.filter((_, idx) => idx !== attrIndex);
    setSingleAttributes(updated);
    const computedTitle = updated.map((a) => a.value.trim()).filter(Boolean).join(' · ');
    if (computedTitle) {
      setSingleTitle(computedTitle);
    }
  };

  const handleSaveSingleModal = (e: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault();

    const cleanedAttrs = singleAttributes
      .map((a) => ({ name: a.name.trim(), value: a.value.trim() }))
      .filter((a) => a.name && a.value);

    const optionName = cleanedAttrs.map((a) => a.name).join(' / ') || 'Option';
    const valName = cleanedAttrs.map((a) => a.value).join(' · ') || 'Standard';
    const title = singleTitle.trim() || valName;

    const variantIndex = editingVariantIndex !== null ? editingVariantIndex : variants.length;
    const numPrice = singlePrice !== '' && !isNaN(Number(singlePrice)) ? Number(singlePrice) : undefined;
    const numStock = singleStock !== '' && !isNaN(Number(singleStock)) ? Number(singleStock) : undefined;
    const existingVariant = editingVariantIndex !== null ? variants[editingVariantIndex] : null;

    const updatedItem: any = {
      id: existingVariant?.id || `var-${Date.now()}`,
      variantId: existingVariant?.variantId,
      images: existingVariant?.images ?? [],
      videos: existingVariant?.videos ?? [],
      title,
      option: optionName,
      value: valName,
      description: singleDescription.trim() || undefined,
      attributes: cleanedAttrs.length > 0 ? cleanedAttrs : [{ name: 'Option', value: title }],
      sku: singleSku.trim() || `${sku || 'PROD001'}-${variantIndex + 1}`,
      status: singleStatus || ''
    };

    if (numPrice !== undefined) updatedItem.price = numPrice;
    if (numStock !== undefined) {
      updatedItem.stock = String(numStock);
    }

    if (editingVariantIndex !== null) {
      setVariants(variants.map((v, idx) => (idx === editingVariantIndex ? updatedItem : v)));
    } else {
      setVariants([...variants, updatedItem]);
    }

    handleCloseSingleModal();
  };

  // Open Single Option Modal in Create Mode
  const handleAddSingleVariant = () => {
    setEditingVariantIndex(null);
    setSingleAttributes([{ name: 'Option Dimension 1', value: '' }]);
    setSingleTitle('');
    setSingleDescription('');
    setSingleSku(`${sku || 'PROD001'}-${variants.length + 1}`);
    setSinglePrice(basePrice !== '' ? String(basePrice) : '');
    setSingleStock(flatStock !== '' ? String(flatStock) : '');
    setSingleStatus('');
    setIsSingleModalOpen(true);
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
      const variantNumber = idx + 1;

      return {
        id: `gen-${Date.now()}-${idx}`,
        title,
        attributes,
        sku: `${sku || 'PROD001'}-${variantNumber}`,
        images: [],
        videos: [],
        price: '',
        stock: '',
        status: ''
      };
    });

    // Merge newly generated combinations with existing variants without removing previously configured variants
    setVariants((prev) => {
      if (prev.length === 0) return generatedVariants;
      const startingIndex = prev.length;
      const adjustedGenerated = generatedVariants.map((v, idx) => ({
        ...v,
        id: `gen-${Date.now()}-${startingIndex + idx}`,
        sku: `${sku || 'PROD001'}-${startingIndex + idx + 1}`,
      }));
      return [...prev, ...adjustedGenerated];
    });

    setSelectedVariantIndices([]);
    setIsMatrixModalOpen(false);
  };

  const handleAddMedia = (files: FileList | File[] | null) => {
    const picked: File[] = Array.from(files || []).filter(Boolean) as File[];
    if (picked.length === 0) return;
    setMediaList([
      ...mediaList,
      ...picked.map((file: File, idx: number) => ({
        id: `media-${Date.now()}-${idx}`,
        src: URL.createObjectURL(file),
        label: file.name
      }))
    ]);
  };

  const handleDeleteMedia = (id: string | number) => {
    const target = mediaList.find((m) => m.id === id);
    if (target?.src?.startsWith('blob:')) URL.revokeObjectURL(target.src);
    setMediaList(mediaList.filter((m) => m.id !== id));
  };

  const handleAddVideos = (files: FileList | File[] | null) => {
    const picked: File[] = Array.from(files || []).filter(Boolean) as File[];
    if (picked.length === 0) return;
    setVideoList([
      ...videoList,
      ...picked.map((file: File, idx: number) => ({
        id: `vid-${Date.now()}-${idx}`,
        src: URL.createObjectURL(file),
        label: file.name,
        size: file.size
      }))
    ]);
  };

  const handleDeleteVideo = (id) => {
    const target = videoList.find((v) => v.id === id);
    if (target?.src?.startsWith('blob:')) URL.revokeObjectURL(target.src);
    setVideoList(videoList.filter((v) => v.id !== id));
  };

  /* Description accepts both routes: type straight into the box, or import a
     TXT / MD / PDF / DOCX file. An import appends, so typed content is never lost. */
  const handleImportDescription = async (file) => {
    if (!file) return;
    setDescriptionImportError('');
    setIsImportingDescription(true);
    try {
      const imported = await extractTextFromFile(file);
      setDescription((prev) => (prev.trim() ? `${prev.trim()}\n\n${imported}` : imported));
      setDescriptionImports((prev) => [
        ...prev,
        { id: `imp-${Date.now()}`, name: file.name, text: imported }
      ]);
    } catch (err) {
      setDescriptionImportError(err?.message || 'Could not read that file.');
    } finally {
      setIsImportingDescription(false);
    }
  };

  /* Removing an import pulls its text back out of the description box. If that
     text was edited after importing it can no longer be matched, so the typed
     version is left alone rather than guessed at. */
  const handleRemoveDescriptionImport = (id) => {
    const entry = descriptionImports.find((d) => d.id === id);
    setDescriptionImports(descriptionImports.filter((d) => d.id !== id));
    if (!entry) return;
    setDescription((prev) =>
      prev.includes(entry.text)
        ? prev.replace(entry.text, '').replace(/\n{3,}/g, '\n\n').trim()
        : prev
    );
  };

  const handleSave = async () => {
    if (!productName.trim()) {
      setSaveError('Title / Service Name is required.');
      return;
    }
    if (!category) {
      setSaveError('Please select a Domain / Category.');
      return;
    }

    if (hasVariants && variants.length === 0) {
      setSaveError('Add at least one combination, or turn off "This offering has variants" to use a single price.');
      return;
    }

    setIsSaving(true);
    setSaveError('');

    try {
      const activeSku = sku.trim() || (await generateNextSku());
      if (!sku.trim()) setSku(activeSku);

      const normalizeVariantStatus = (statusStr?: string) => {
        if (!statusStr || !String(statusStr).trim()) return undefined;
        const s = String(statusStr || '').trim().toLowerCase();
        if (s.includes('unspec') || s.includes('not set') || s.includes('unknown')) {
          return 'Unspecified';
        }
        if (s.includes('out') || s.includes('unavail') || s.includes('sold')) {
          return 'Out of Stock';
        }
        if (s.includes('low') || s.includes('limit')) {
          return 'Low Stock';
        }
        if (s.includes('in') || s.includes('avail')) {
          return 'In Stock';
        }
        return undefined;
      };

      const formattedVariants = hasVariants
        ? variants.map((v, idx) => {
            const variantObj: any = {};

            // 0. Variant ID (send it back on update to preserve identity)
            if (v.variantId || (v.id && !v.id.startsWith('var-') && !v.id.startsWith('gen-'))) {
              variantObj.variantId = v.variantId || v.id;
            }

            // 1. Option name (e.g. "Colour", or combined attribute names "Colour / Size", or fallback "Option")
            let optionName = v.option;
            if (!optionName && v.attributes && v.attributes.length > 0) {
              optionName = v.attributes.length === 1
                ? v.attributes[0].name
                : v.attributes.map((a: any) => a.name).filter(Boolean).join(' / ');
            }
            variantObj.option = optionName || 'Option';

            // 2. Value (e.g. "Navy / M", or combined attribute values, or title)
            let valName = v.value;
            if (!valName && v.attributes && v.attributes.length > 0) {
              valName = v.attributes.map((a: any) => a.value).filter(Boolean).join(' / ');
            }
            variantObj.value = valName || v.title || 'Standard';

            // 3. Title & SKU
            if (v.title) variantObj.title = v.title;
            variantObj.sku = v.sku || `${activeSku}-${idx + 1}`;

            // 4. Description (max 1000 chars)
            if (v.description && String(v.description).trim()) {
              variantObj.description = String(v.description).trim();
            }

            // 5. Price (number, optional if not set - never send 0 if unpriced)
            if (v.price !== undefined && v.price !== null && v.price !== '') {
              const numPrice = Number(v.price);
              if (!isNaN(numPrice) && numPrice >= 0) {
                variantObj.price = numPrice;
              }
            }

            // 6. Stock (string without units as per API specification, e.g. "24")
            const rawStock = v.stock !== undefined && v.stock !== null && v.stock !== ''
              ? v.stock
              : v.capacity;
            if (rawStock !== undefined && rawStock !== null && rawStock !== '') {
              const numStock = typeof rawStock === 'string'
                ? parseFloat(rawStock.replace(/[^0-9.]/g, ''))
                : Number(rawStock);
              if (!isNaN(numStock) && numStock >= 0) {
                variantObj.stock = String(numStock);
              }
            }

            // 7. Status ("In Stock" | "Low Stock" | "Out of Stock") - omit if not set or unspecified
            if (v.status && String(v.status).trim() && String(v.status).trim() !== 'Unspecified' && String(v.status).trim().toLowerCase() !== 'not set') {
              const norm = normalizeVariantStatus(v.status);
              if (norm && norm !== 'Unspecified') {
                variantObj.status = norm;
              }
            }

            // 8. Attributes and media if present
            if (v.attributes && v.attributes.length > 0) {
              variantObj.attributes = v.attributes;
            }
            if (v.images?.[0] || v.image) {
              variantObj.image = v.images?.[0] || v.image;
            }
            if (v.images && v.images.length > 0) variantObj.images = v.images;
            if (v.videos && v.videos.length > 0) variantObj.videos = v.videos;

            return variantObj;
          })
        : [];

      const pricedVariants = formattedVariants
        .map((v) => Number(v.price))
        .filter((n) => !isNaN(n) && n > 0);

      const computedPrice = hasVariants
        ? (pricedVariants.length > 0 ? Math.min(...pricedVariants) : undefined)
        : (basePrice !== '' && basePrice !== null && basePrice !== undefined && isFinite(Number(basePrice)) && Number(basePrice) >= 0 ? Number(basePrice) : undefined);

      const countedStocks = formattedVariants
        .map((v) => Number(v.stock ?? v.capacity))
        .filter((n) => !isNaN(n) && isFinite(n));

      const computedStock = hasVariants
        ? (countedStocks.length > 0 ? countedStocks.reduce((sum, n) => sum + n, 0) : undefined)
        : (flatStock !== '' && flatStock !== null && flatStock !== undefined && isFinite(Number(flatStock)) && Number(flatStock) >= 0 ? Number(flatStock) : undefined);

      const resolvedCategoryId = categoriesList.find((c) => c.id === category || c.name.toLowerCase() === category.toLowerCase())?.id || category;

      const payload: CreateProductInput = {
        name: productName.trim(),
        sku: activeSku,
        categoryId: resolvedCategoryId,
      };

      if (description && description.trim()) {
        payload.description = description.trim();
      }

      if (hasVariants && formattedVariants.length > 0) {
        payload.variants = formattedVariants;
      } else {
        if (computedPrice !== undefined) {
          payload.price = computedPrice;
        }
        if (computedStock !== undefined) {
          payload.stock = computedStock;
        }
        if (flatStockStatus && flatStockStatus.trim() && flatStockStatus !== 'Unspecified' && flatStockStatus.toLowerCase() !== 'not set') {
          const norm = normalizeVariantStatus(flatStockStatus);
          if (norm && norm !== 'Unspecified') {
            payload.stockStatus = norm;
          }
        }
      }

      if (reorderPoint !== '' && reorderPoint !== undefined && reorderPoint !== null && !isNaN(Number(reorderPoint)) && Number(reorderPoint) > 0) {
        payload.reorderPoint = Number(reorderPoint);
      }
      if (margin && String(margin).trim()) {
        payload.margin = String(margin).trim();
      }
      if (discount && String(discount).trim()) {
        payload.discount = String(discount).trim();
      }

      const primaryImg = mediaList[0]?.src || (formattedVariants[0]?.image) || (formattedVariants[0]?.images?.[0]);
      if (primaryImg && String(primaryImg).trim()) {
        payload.image = String(primaryImg).trim();
      }

      const validGallery = mediaList
        .filter((m) => m.src && String(m.src).trim())
        .map((m, idx) => ({ id: idx, label: m.label || `Image ${idx + 1}`, src: m.src }));
      if (validGallery.length > 0) {
        payload.gallery = validGallery;
      }

      const validVideos = videoList.filter((v: any) => v && (typeof v === 'string' ? v.trim() : (v.url && v.url.trim()) || (v.src && v.src.trim())));
      if (validVideos.length > 0) {
        payload.videos = validVideos;
      }

      if (isEditing && (id || selectedProduct?.id)) {
        await productService.updateProduct(id || selectedProduct?.id || sku.trim(), payload);
      } else {
        await productService.createProduct(payload);
      }

      setSavedSuccess(true);
      setTimeout(() => {
        setActiveModule?.('products');
        navigate('/products');
      }, 800);
    } catch (err: any) {
      setSaveError(err?.message || 'Could not save product. Please check required fields.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-y-space-md w-full max-w-[1400px] mx-auto pt-space-xs pb-space-xl">
      {/* Top Action & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-y-space-xs py-space-xs">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveModule?.('products');
              navigate('/products');
            }}
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
          {saveError && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-error-container/50 text-on-error-container font-label-sm text-label-sm font-medium max-w-md">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              {saveError}
            </span>
          )}
          <Button
            variant="hover"
            size="md"
            onClick={() => {
              setActiveModule?.('products');
              navigate('/products');
            }}
          >
            Discard Draft
          </Button>
          <Button
            variant="primary"
            size="md"
            startIcon={isSaving ? 'progress_activity' : 'save'}
            disabled={isSaving}
            onClick={handleSave}
          >
            {isSaving ? 'Saving...' : savedSuccess ? 'Saved!' : 'Save Offering'}
          </Button>
        </div>
      </div>

      {/* Main Form */}
      <form
        className="flex flex-col gap-space-lg w-full"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        {/* TOP ROW: Side-by-Side Split (General Information & Media) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg w-full items-stretch">
          {/* Card 1: Offering Details (Left) — takes the full row once media is hidden */}
          <div className={`${hasVariants ? 'lg:col-span-12' : 'lg:col-span-6'} bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container flex flex-col gap-space-md justify-between`}>
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

              {/* Core fields sit in one 12-column grid so every row stays aligned,
                  whether the card is half-width (media shown) or full-width */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-space-md items-start">
                {/* Title / Name */}
                <div className={`flex flex-col gap-1.5 ${hasVariants ? 'sm:col-span-5' : 'sm:col-span-12'}`}>
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

                {/* Base Identifier / SKU */}
                <div className={`flex flex-col gap-1.5 ${hasVariants ? 'sm:col-span-3' : 'sm:col-span-6'}`}>
                  <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="offering-code">
                    Base Identifier / SKU <span className="text-error">*</span>
                  </label>
                  <input
                    id="offering-code"
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. PROD001"
                    className="w-full h-[42px] px-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-low/40 border border-surface-container-high placeholder:text-outline uppercase focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    required
                  />
                </div>

                {/* Domain / Category */}
                <div className={`flex flex-col gap-1.5 ${hasVariants ? 'sm:col-span-4' : 'sm:col-span-6'}`}>
                  <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="offering-category">
                    Domain / Category <span className="text-error">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <select
                      id="offering-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full h-[42px] pl-space-sm pr-10 rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-low/40 border border-surface-container-high focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer transition-all"
                      required
                    >
                      <option value="" disabled>Select category</option>
                      {categoriesList.length > 0 ? (
                        categoriesList.map((cat) => (
                          <option key={cat.id || cat.name} value={cat.id || cat.name}>
                            {cat.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="CAT-001">Electronics &amp; Gadgets</option>
                          <option value="CAT-002">Software &amp; Digital Plans</option>
                          <option value="CAT-003">Hospitality &amp; Rooms</option>
                          <option value="CAT-004">Professional Services &amp; Consulting</option>
                          <option value="CAT-005">Healthcare &amp; Appointments</option>
                        </>
                      )}
                    </select>
                    <span className="material-symbols-outlined absolute right-3 text-outline text-lg pointer-events-none">unfold_more</span>
                  </div>
                </div>

                {/* Description — type it in, or import a document */}
                <div className="flex flex-col gap-1.5 sm:col-span-12">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="font-label-md text-label-md text-on-surface flex items-center gap-1" htmlFor="offering-description">
                    Scope &amp; Description <span className="text-error">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-caption text-caption text-on-surface-variant">Markdown supported</span>
                    <label
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-label-sm text-label-sm border transition-colors ${
                        isImportingDescription
                          ? 'text-on-surface-variant bg-surface-container border-surface-container-high cursor-wait'
                          : 'text-primary bg-primary/10 hover:bg-primary/20 border-primary/20 cursor-pointer'
                      }`}
                      title="Import description from a TXT, MD, PDF or Word (.docx) file"
                    >
                      <span
                        className={`material-symbols-outlined text-sm ${isImportingDescription ? 'animate-spin' : ''}`}
                      >
                        {isImportingDescription ? 'progress_activity' : 'upload_file'}
                      </span>
                      <span>{isImportingDescription ? 'Reading…' : 'Import file'}</span>
                      <input
                        type="file"
                        accept={DESCRIPTION_ACCEPT}
                        disabled={isImportingDescription}
                        className="hidden"
                        onChange={(e) => {
                          handleImportDescription(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>
                </div>
                <textarea
                  id="offering-description"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the inclusions, deliverables, conditions, and core value proposition... or import a TXT, MD, PDF or Word file"
                  className="w-full p-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-low/40 border border-surface-container-high placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-y transition-all"
                />
                {descriptionImportError && (
                  <span className="inline-flex items-start gap-1.5 self-start px-2 py-1 rounded-md bg-error-container/50 font-caption text-caption text-on-error-container">
                    <span className="material-symbols-outlined text-sm shrink-0">error</span>
                    {descriptionImportError}
                  </span>
                )}

                {descriptionImports.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {descriptionImports.map((imp) => (
                      <span
                        key={imp.id}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-container font-caption text-caption text-on-surface-variant"
                      >
                        <span className="material-symbols-outlined text-sm text-primary">description</span>
                        Imported from <strong className="text-on-surface font-semibold">{imp.name}</strong>
                        <button
                          type="button"
                          onClick={() => handleRemoveDescriptionImport(imp.id)}
                          className="text-outline hover:text-error transition-colors cursor-pointer"
                          title="Remove this file and its imported text"
                        >
                          <span className="material-symbols-outlined text-[13px]">close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Media & Visual Assets — hidden while variants are on, because
              each combination then carries its own image and video in the matrix below */}
          {!hasVariants && (
          <div className="lg:col-span-6 bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container flex flex-col gap-space-md justify-between">
            <div className="flex flex-col gap-space-md">
              <div className="flex items-center justify-between pb-space-2xs border-b border-surface-container-low">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-xl">photo_library</span>
                  <h2 className="font-title-md text-title-md text-on-surface font-semibold">Media &amp; Documents</h2>
                </div>
                <span className="font-caption text-caption text-outline">
                  {mediaList.length + videoList.length} assets attached
                </span>
              </div>

              {/* Product Images */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-primary">image</span>
                    Product Images
                  </span>
                  <span className="font-caption text-caption text-on-surface-variant">PNG, JPG up to 10MB</span>
                </div>

                <label className="border-2 border-dashed border-outline-variant hover:border-primary rounded-xl p-5 flex flex-col items-center justify-center text-center bg-surface-container-low/30 hover:bg-surface-container-low/60 transition-all cursor-pointer group">
                  <div className="w-11 h-11 rounded-full bg-surface-container flex items-center justify-center text-primary mb-2 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-2xl">cloud_upload</span>
                  </div>
                  <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                    <span className="text-primary underline">Click to upload</span> or drag and drop
                  </span>
                  <span className="font-caption text-caption text-on-surface-variant mt-0.5">
                    High-resolution asset (min. 1200 x 1200 px)
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleAddMedia(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>

                {mediaList.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {mediaList.map((m, idx) => (
                      <div
                        key={m.id}
                        className="relative group rounded-xl overflow-hidden aspect-square bg-surface-container-low border border-surface-container-high shadow-xs"
                      >
                        <img
                          src={m.src}
                          alt={m.label}
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {idx === 0 && (
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md font-caption text-caption bg-surface-container-lowest/90 text-primary font-semibold text-[10px] shadow-sm">
                            Cover
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteMedia(m.id)}
                          className="absolute top-1 right-1 w-6 h-6 rounded-md bg-surface-container-lowest/90 text-error opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity hover:bg-error-container"
                          title="Remove image"
                        >
                          <span className="material-symbols-outlined text-xs">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Product Videos — sits directly under the image uploader */}
              <div className="flex flex-col gap-2 pt-space-xs border-t border-surface-container-low">
                <div className="flex items-center justify-between">
                  <span className="font-label-md text-label-md text-on-surface font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-primary">videocam</span>
                    Product Videos
                  </span>
                  <span className="font-caption text-caption text-on-surface-variant">MP4, MOV up to 60MB</span>
                </div>

                <label className="border-2 border-dashed border-outline-variant hover:border-primary rounded-xl p-5 flex flex-col items-center justify-center text-center bg-surface-container-low/30 hover:bg-surface-container-low/60 transition-all cursor-pointer group">
                  <div className="w-11 h-11 rounded-full bg-surface-container flex items-center justify-center text-secondary mb-2 group-hover:scale-110 transition-transform">
                    <span className="material-symbols-outlined text-2xl">movie</span>
                  </div>
                  <span className="font-title-sm text-title-sm text-on-surface font-semibold">
                    <span className="text-primary underline">Click to upload</span> or drag and drop
                  </span>
                  <span className="font-caption text-caption text-on-surface-variant mt-0.5">
                    360&deg; reel, walk-through or feature demo
                  </span>
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleAddVideos(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>

                {videoList.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {videoList.map((vid) => (
                      <li
                        key={vid.id}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-surface-container-low/60 border border-surface-container-high"
                      >
                        <span className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                          <span className="material-symbols-outlined text-lg">play_circle</span>
                        </span>
                        <span className="flex flex-col min-w-0 flex-1">
                          <span className="font-label-md text-label-md text-on-surface font-medium truncate">
                            {vid.label}
                          </span>
                          {vid.size ? (
                            <span className="font-caption text-caption text-on-surface-variant">
                              {(vid.size / (1024 * 1024)).toFixed(1)} MB
                            </span>
                          ) : null}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteVideo(vid.id)}
                          className="p-1.5 rounded-lg text-error hover:bg-error-container/40 transition-colors cursor-pointer shrink-0"
                          title="Remove video"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Commercial row: the single price, stock (when no variants), and variant switch */}
        <div className="bg-surface-container-lowest rounded-2xl px-space-lg py-space-sm shadow-sm border border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm w-full">
          {/* Price / Rate & Stock */}
          <div className="flex items-center gap-6 min-w-0 flex-wrap">
            {/* Price / Rate */}
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <span className="material-symbols-outlined text-xl">payments</span>
              </span>
              {hasVariants ? (
                <span className="flex flex-col min-w-0">
                  <span className="font-title-sm text-title-sm text-on-surface font-semibold">Pricing</span>
                  <span className="font-caption text-caption text-on-surface-variant truncate">
                    Set per combination in the matrix below.
                  </span>
                </span>
              ) : (
                <>
                  <label
                    className="font-title-sm text-title-sm text-on-surface font-semibold flex items-center gap-1.5 whitespace-nowrap"
                    htmlFor="offering-price"
                  >
                    Price / Rate <span className="text-xs font-normal text-on-surface-variant">(Optional)</span>
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-space-sm font-body-md text-body-md text-on-surface-variant pointer-events-none">
                      ₹
                    </span>
                    <input
                      id="offering-price"
                      type="number"
                      min="0"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      placeholder="e.g. 3499"
                      className="w-36 h-[42px] pl-8 pr-space-sm rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-low/40 border border-surface-container-high placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Stock & Status field (when no variants) */}
            {!hasVariants && (
              <>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined text-xl">inventory_2</span>
                  </span>
                  <label
                    className="font-title-sm text-title-sm text-on-surface font-semibold flex items-center gap-1.5 whitespace-nowrap"
                    htmlFor="offering-stock"
                  >
                    Stock <span className="text-xs font-normal text-on-surface-variant">(Optional)</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="offering-stock"
                      type="number"
                      min="0"
                      value={flatStock}
                      onChange={(e) => setFlatStock(e.target.value)}
                      placeholder="e.g. 40"
                      className="w-28 h-[42px] px-3.5 rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-low/40 border border-surface-container-high placeholder:text-outline focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <label
                    className="font-title-sm text-title-sm text-on-surface font-semibold flex items-center gap-1.5 whitespace-nowrap"
                    htmlFor="offering-stock-status"
                  >
                    Status
                  </label>
                  <select
                    id="offering-stock-status"
                    value={
                      String(flatStockStatus || '').toLowerCase().includes('unspec') || String(flatStockStatus || '').toLowerCase().includes('not set')
                        ? 'Unspecified'
                        : String(flatStockStatus || '').toLowerCase().includes('out') || String(flatStockStatus || '').toLowerCase().includes('unavail') || String(flatStockStatus || '').toLowerCase().includes('sold')
                        ? 'Out of Stock'
                        : String(flatStockStatus || '').toLowerCase().includes('low') || String(flatStockStatus || '').toLowerCase().includes('limit')
                        ? 'Low Stock'
                        : String(flatStockStatus || '').toLowerCase().includes('in') || String(flatStockStatus || '').toLowerCase().includes('avail')
                        ? 'In Stock'
                        : ''
                    }
                    onChange={(e) => setFlatStockStatus(e.target.value)}
                    className="h-[42px] px-3 rounded-xl font-body-md text-body-md text-on-surface bg-surface-container-low/40 border border-surface-container-high focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                  >
                    <option value="">Not set (Auto)</option>
                    <option value="In Stock">In Stock</option>
                    <option value="Low Stock">Low Stock</option>
                    <option value="Out of Stock">Out of Stock</option>
                    <option value="Unspecified">Unspecified (Not Set)</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <span className="hidden sm:block w-px h-9 bg-surface-container-high shrink-0" aria-hidden="true"></span>

          {/* Variant mode — one switch, nothing more */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-xl">tune</span>
            </span>
            <span
              id="variants-switch-label"
              className="font-title-sm text-title-sm text-on-surface font-semibold whitespace-nowrap"
            >
              This offering has variants
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={hasVariants}
              aria-labelledby="variants-switch-label"
              onClick={() => handleToggleVariants(!hasVariants)}
              title={hasVariants ? 'Turn variants off' : 'Turn variants on'}
              className={`relative w-12 h-7 rounded-full shrink-0 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                hasVariants ? 'bg-primary' : 'bg-surface-container-high'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-surface-container-lowest shadow-sm transition-transform ${
                  hasVariants ? 'translate-x-5' : 'translate-x-0'
                }`}
              ></span>
            </button>
          </div>
        </div>

        {/* BOTTOM SECTION: Business-Agnostic Multi-Dimension Variants Matrix */}
        {hasVariants && (
        <div className="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm border border-surface-container flex flex-col gap-space-md w-full">
          {/* Card Header & Global Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-space-xs border-b border-surface-container-low">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-2xl">dataset</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-title-lg text-title-lg text-on-surface font-bold">
                    Options &amp; Configuration Matrix
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full font-label-sm text-label-sm bg-primary/10 text-primary font-semibold">
                    {variants.length} combination{variants.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Generate combinations across custom dimensions (e.g. Tiers × Cycles, Rooms × Meal Plans, Services × Turnaround)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
              {/* Common / Bulk Price Setter — only enabled when items are selected */}
              {variants.length > 0 && (
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl border transition-all ${
                    selectedVariantIndices.length > 0
                      ? 'bg-surface-container-low/70 border-surface-container-high shadow-xs'
                      : 'bg-surface-container-low/30 border-surface-container-high/40 opacity-60'
                  }`}
                >
                  <span className="font-caption text-caption text-on-surface-variant font-medium whitespace-nowrap">
                    Common Price:
                  </span>
                  <div className="relative flex items-center">
                    <span className="absolute left-2 text-xs font-semibold text-on-surface-variant pointer-events-none">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 500"
                      disabled={selectedVariantIndices.length === 0}
                      value={commonPriceInput}
                      onChange={(e) => setCommonPriceInput(e.target.value)}
                      className="w-24 h-7 pl-5 pr-2 rounded-lg bg-surface-container-lowest text-on-surface text-xs font-semibold border border-surface-container-high focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyCommonPrice('selected')}
                    disabled={selectedVariantIndices.length === 0 || !commonPriceInput || isNaN(Number(commonPriceInput))}
                    className="px-2.5 py-1 rounded-lg bg-primary text-on-primary font-semibold text-xs hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center gap-1"
                    title={selectedVariantIndices.length > 0 ? `Apply price to ${selectedVariantIndices.length} selected items` : 'Select items to enable common price'}
                  >
                    <span className="material-symbols-outlined text-[14px]">price_check</span>
                    <span>Apply ({selectedVariantIndices.length})</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleAddSingleVariant}
                className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-xl font-label-md text-label-md text-on-primary bg-primary hover:bg-primary/90 shadow-xs transition-all cursor-pointer"
                title="Add a new individual variant combination"
              >
                <span className="material-symbols-outlined text-base">add</span>
                <span>Add Variant</span>
              </button>

              <button
                type="button"
                onClick={handleOpenMatrixModal}
                className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-xl font-label-md text-label-md text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-all cursor-pointer"
                title="Open Multi-Dimension Matrix Generator"
              >
                <span className="material-symbols-outlined text-base">auto_fix_high</span>
                <span>Matrix Generator</span>
              </button>
            </div>
          </div>

          {/* Bulk Selection Action Banner */}
          {selectedVariantIndices.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-primary/10 border border-primary/25 rounded-xl text-on-surface animate-in fade-in duration-150 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-[11px]">
                  {selectedVariantIndices.length}
                </span>
                <span className="font-label-md text-label-md font-semibold text-primary">
                  {selectedVariantIndices.length} of {variants.length} combinations selected
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleToggleSelectAllVariants}
                  className="px-2.5 py-1 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-label-sm text-xs transition-colors cursor-pointer"
                >
                  {isAllVariantsSelected ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSelectedVariants}
                  className="px-2.5 py-1 rounded-lg bg-error-container text-on-error-container hover:bg-error-container/80 font-label-sm text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  Delete ({selectedVariantIndices.length})
                </button>
              </div>
            </div>
          )}

          {/* Universal Combinations Table */}
          <div className="w-full overflow-x-auto rounded-xl border border-surface-container-high shadow-xs">
            <table className="w-full text-left text-on-surface min-w-[980px]">
              <thead className="bg-surface-container font-caption text-caption text-on-surface-variant uppercase tracking-wider border-b border-surface-container-high">
                <tr>
                  <th className="py-3 pl-space-lg pr-space-2xs font-semibold w-20" scope="col">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isAllVariantsSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeVariantsSelected;
                        }}
                        onChange={handleToggleSelectAllVariants}
                        className="w-4 h-4 rounded text-primary border-surface-container-high focus:ring-primary/20 cursor-pointer accent-primary"
                        title="Select All Combinations"
                      />
                      <span>S.No</span>
                    </div>
                  </th>
                  <th className="py-3 px-space-sm font-semibold w-32" scope="col">Images</th>
                  <th className="py-3 px-space-sm font-semibold w-32" scope="col">Videos</th>
                  <th className="py-3 px-space-sm font-semibold" scope="col">Option Descriptor / Dimensions</th>
                  <th className="py-3 px-space-sm font-semibold" scope="col">Identifier / SKU</th>
                  <th className="py-3 px-space-sm font-semibold" scope="col">Price / Rate (₹)</th>
                  <th className="py-3 px-space-sm font-semibold" scope="col">Stock</th>
                  <th className="py-3 px-space-sm font-semibold" scope="col">Status</th>
                  <th className="py-3 pl-space-sm pr-space-lg font-semibold text-right" scope="col">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-low font-body-sm text-body-sm bg-surface-container-lowest">
                {variants.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-on-surface-variant">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center text-outline">
                          <span className="material-symbols-outlined text-2xl">category</span>
                        </div>
                        <p className="font-title-sm text-title-sm text-on-surface font-semibold">No options or combinations defined yet</p>
                        <p className="text-body-sm text-on-surface-variant max-w-md">
                          Use the <strong>Matrix Generator</strong> to build every combination in 1-click, then fine-tune any row.
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
                    <tr
                      key={v.id || i}
                      className={`transition-colors align-top ${
                        selectedVariantIndices.includes(i)
                          ? 'bg-primary/5'
                          : 'hover:bg-surface-container-low/40'
                      }`}
                    >
                      {/* Serial Number & Row Checkbox */}
                      <td className="py-3.5 pl-space-lg pr-space-2xs font-title-sm text-title-sm text-on-surface-variant font-semibold tabular-nums">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedVariantIndices.includes(i)}
                            onChange={() => handleToggleSelectVariant(i)}
                            className="w-4 h-4 rounded text-primary border-surface-container-high focus:ring-primary/20 cursor-pointer accent-primary"
                            title={`Select row ${i + 1}`}
                          />
                          <span>{i + 1}</span>
                        </div>
                      </td>

                      {/* Per-combination images */}
                      <td className="py-3.5 px-space-sm">
                        {(v.images || []).length === 0 ? (
                          <label
                            className="w-11 h-11 rounded-lg border-2 border-dashed border-outline-variant hover:border-primary bg-surface-container-low/40 text-outline hover:text-primary flex items-center justify-center cursor-pointer transition-all"
                            title="Upload the cover image for this combination"
                          >
                            <span className="material-symbols-outlined text-lg">add_photo_alternate</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                handleVariantImages(i, e.target.files);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        ) : (
                          <span
                            className="relative inline-block w-11 h-11"
                            title={
                              v.images.length > 1
                                ? `${v.images.length} images — open Edit to manage`
                                : 'Open Edit to add or remove images'
                            }
                          >
                            <img
                              src={v.images[0]}
                              alt={v.title}
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                              className="w-full h-full rounded-lg object-cover border border-surface-container-high"
                            />
                            {v.images.length > 1 && (
                              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary font-label-sm text-[10px] font-semibold flex items-center justify-center shadow-sm">
                                +{v.images.length - 1}
                              </span>
                            )}
                          </span>
                        )}
                      </td>

                      {/* Per-combination videos */}
                      <td className="py-3.5 px-space-sm">
                        <div className="flex items-center gap-1.5">
                          {(v.videos || []).length > 0 && (
                            <span
                              className="relative inline-flex w-11 h-11"
                              title={
                                v.videos.length > 1
                                  ? `${v.videos.length} videos — open Edit to manage`
                                  : v.videos[0].name
                              }
                            >
                              <span className="w-full h-full rounded-lg border border-primary/30 bg-primary/5 text-primary flex items-center justify-center">
                                <span className="material-symbols-outlined text-lg">play_circle</span>
                              </span>
                              {v.videos.length > 1 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary font-label-sm text-[10px] font-semibold flex items-center justify-center shadow-sm">
                                  +{v.videos.length - 1}
                                </span>
                              )}
                            </span>
                          )}
                          <label
                            className="w-11 h-11 rounded-lg border-2 border-dashed border-outline-variant hover:border-primary bg-surface-container-low/40 text-outline hover:text-primary flex items-center justify-center cursor-pointer transition-all shrink-0"
                            title="Add videos to this combination"
                          >
                            <span className="material-symbols-outlined text-lg">video_call</span>
                            <input
                              type="file"
                              accept="video/*"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                handleVariantVideos(i, e.target.files);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      </td>

                      {/* Title & Dimension Chips */}
                      <td className="py-3.5 px-space-sm">
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
                        </div>
                      </td>

                      {/* SKU / Code */}
                      <td className="py-3.5 px-space-sm font-mono text-body-sm text-on-surface-variant">
                        <span className="px-2 py-1 rounded bg-surface-container font-semibold text-on-surface text-xs tracking-wide">
                          {v.sku}
                        </span>
                      </td>

                      {/* Price / Commercial Rate (Static Display) */}
                      <td className="py-3.5 px-space-sm">
                        {v.price !== undefined && v.price !== null && v.price !== '' && !isNaN(Number(v.price)) && Number(v.price) > 0 ? (
                          <span className="font-bold text-on-surface text-base">
                            ₹ {Number(v.price).toLocaleString()}.00
                          </span>
                        ) : (
                          <span className="font-body-sm text-body-sm text-on-surface-variant italic">
                            Not priced
                          </span>
                        )}
                      </td>

                      {/* Stock */}
                      <td className="py-3.5 px-space-sm">
                        {v.stock !== undefined && v.stock !== null && v.stock !== '' ? (
                          <span className="font-semibold text-on-surface">
                            {v.stock}
                          </span>
                        ) : (
                          <span className="font-body-sm text-body-sm text-on-surface-variant italic">
                            Not set
                          </span>
                        )}
                      </td>

                      {/* Status Selector in Table Row */}
                      <td className="py-3.5 px-space-sm">
                        <select
                          value={
                            String(v.status || '').toLowerCase().includes('unspec') || String(v.status || '').toLowerCase().includes('not set')
                              ? 'Unspecified'
                              : String(v.status || '').toLowerCase().includes('out') || String(v.status || '').toLowerCase().includes('unavail') || String(v.status || '').toLowerCase().includes('sold')
                              ? 'Unavailable'
                              : String(v.status || '').toLowerCase().includes('low') || String(v.status || '').toLowerCase().includes('limit')
                              ? 'Limited'
                              : String(v.status || '').toLowerCase().includes('in') || String(v.status || '').toLowerCase().includes('avail')
                              ? 'Available'
                              : ''
                          }
                          onChange={(e) => handleVariantField(i, 'status', e.target.value)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-sm text-label-sm font-semibold border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${
                            getVariantState(v).tone
                          }`}
                        >
                          <option value="">Not set</option>
                          <option value="Available">Available</option>
                          <option value="Limited">Limited</option>
                          <option value="Unavailable">Unavailable</option>
                          <option value="Unspecified">Unspecified</option>
                        </select>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 pl-space-sm pr-space-lg text-right">
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
                            onClick={() => handleDeleteVariant(i)}
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
      </form>

      {/* ─────────────────────────────────────────────────────────────
          MODAL 0: Confirm discarding the matrix when variants are switched off
         ───────────────────────────────────────────────────────────── */}
      {isDiscardVariantsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-on-surface/40 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsDiscardVariantsOpen(false);
          }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="discard-variants-title"
            className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-md border border-surface-container-high p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200"
          >
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-error-container/60 flex items-center justify-center text-error shrink-0">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div className="flex flex-col gap-1">
                <h3 id="discard-variants-title" className="font-title-lg text-title-lg text-on-surface font-bold">
                  Remove {variants.length} combination{variants.length === 1 ? '' : 's'}?
                </h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Turning variants off deletes every row in the configuration matrix, along with
                  the prices, stock and media attached to them. This cannot be undone, and the
                  offering will fall back to a single price.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-low">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setIsDiscardVariantsOpen(false)}
              >
                Keep variants
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleConfirmDiscardVariants}
              >
                Remove all
              </Button>
            </div>
          </div>
        </div>
      )}

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
              <Button
                variant="ghost"
                size="icon-sm"
                startIcon="close"
                onClick={() => setIsMatrixModalOpen(false)}
                aria-label="Close modal"
              />
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


            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-surface-container-low">
              <span className="font-label-md text-label-md text-primary font-semibold">
                ✨ Ready to generate {totalCombinationsCount} combinations
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setIsMatrixModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleGenerateMatrix}
                  disabled={totalCombinationsCount === 0}
                >
                  Generate {totalCombinationsCount} Combinations
                </Button>
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
          <div className="relative bg-surface-container-lowest rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto border border-surface-container-high p-6 flex flex-col gap-5 animate-in zoom-in-95 duration-200">
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
                    Configure media, descriptor, code, commercial rate and stock
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                startIcon="close"
                onClick={handleCloseSingleModal}
                aria-label="Close modal"
              />
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveSingleModal} className="flex flex-col gap-4">
              {/* Media for this combination — the only place assets can be removed */}
              {editingVariantIndex !== null && (
                <div className="flex flex-col gap-3.5 p-3.5 rounded-xl bg-surface-container-low/60 border border-surface-container-high">
                  {/* Images */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-label-sm text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                        Images
                        <span className="ml-1.5 normal-case tracking-normal text-outline font-normal">
                          ({(variants[editingVariantIndex]?.images || []).length})
                        </span>
                      </span>
                      <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-label-sm text-label-sm text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer">
                        <span className="material-symbols-outlined text-sm">add</span>
                        <span>Add images</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            handleVariantImages(editingVariantIndex, e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>

                    {(variants[editingVariantIndex]?.images || []).length === 0 ? (
                      <span className="font-caption text-caption text-on-surface-variant">
                        No images attached yet.
                      </span>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                        {variants[editingVariantIndex].images.map((src, imgIdx) => (
                          <div
                            key={`edit-img-${imgIdx}`}
                            className="relative aspect-square rounded-lg overflow-hidden border border-surface-container-high bg-surface-container"
                          >
                            <img
                              src={src}
                              alt={`${variants[editingVariantIndex].title} ${imgIdx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            {imgIdx === 0 && (
                              <span className="absolute bottom-0 inset-x-0 py-0.5 text-center font-caption text-caption text-[10px] bg-surface-container-lowest/85 text-primary font-semibold">
                                Cover
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveVariantImage(editingVariantIndex, imgIdx)}
                              className="absolute top-1 right-1 w-5 h-5 rounded-md bg-surface-container-lowest/90 text-error shadow-sm flex items-center justify-center hover:bg-error-container transition-colors cursor-pointer"
                              title="Remove this image"
                            >
                              <span className="material-symbols-outlined text-[13px]">close</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Videos */}
                  <div className="flex flex-col gap-2 pt-3 border-t border-surface-container">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-label-sm text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
                        Videos
                        <span className="ml-1.5 normal-case tracking-normal text-outline font-normal">
                          ({(variants[editingVariantIndex]?.videos || []).length})
                        </span>
                      </span>
                      <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-label-sm text-label-sm text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 transition-colors cursor-pointer">
                        <span className="material-symbols-outlined text-sm">add</span>
                        <span>Add videos</span>
                        <input
                          type="file"
                          accept="video/*"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            handleVariantVideos(editingVariantIndex, e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>

                    {(variants[editingVariantIndex]?.videos || []).length === 0 ? (
                      <span className="font-caption text-caption text-on-surface-variant">
                        No videos attached yet.
                      </span>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {variants[editingVariantIndex].videos.map((vid, vidIdx) => (
                          <li
                            key={`edit-vid-${vidIdx}`}
                            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-surface-container-high"
                          >
                            <span className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary shrink-0">
                              <span className="material-symbols-outlined text-base">play_circle</span>
                            </span>
                            <span className="font-label-md text-label-md text-on-surface truncate flex-1 min-w-0">
                              {vid.name}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveVariantVideo(editingVariantIndex, vidIdx)}
                              className="p-1 rounded-md text-error hover:bg-error-container/40 transition-colors cursor-pointer shrink-0"
                              title="Remove this video"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {/* Dimension Attributes Section */}
              <div className="flex flex-col gap-2.5 p-3.5 rounded-xl bg-surface-container-low/60 border border-surface-container-high">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm font-semibold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">tune</span>
                    Dimension Attributes ({singleAttributes.length}/6)
                  </span>
                  {singleAttributes.length < 6 && (
                    <button
                      type="button"
                      onClick={handleAddSingleAttribute}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-primary hover:bg-primary/10 font-label-sm text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      <span>Add Axis</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {singleAttributes.map((attr, aIdx) => (
                    <div key={`single-attr-${aIdx}`} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <div className="sm:col-span-5">
                        <input
                          type="text"
                          required
                          placeholder="Axis Name (e.g. Colour)"
                          value={attr.name}
                          onChange={(e) => handleSingleAttributeChange(aIdx, 'name', e.target.value)}
                          className="w-full h-9 px-3 rounded-lg bg-surface-container-lowest text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-xs font-medium"
                        />
                      </div>
                      <div className="sm:col-span-6">
                        <input
                          type="text"
                          required
                          placeholder="Axis Value (e.g. Midnight Navy)"
                          value={attr.value}
                          onChange={(e) => handleSingleAttributeChange(aIdx, 'value', e.target.value)}
                          className="w-full h-9 px-3 rounded-lg bg-surface-container-lowest text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-xs font-semibold"
                        />
                      </div>
                      <div className="sm:col-span-1 flex justify-center">
                        {singleAttributes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSingleAttribute(aIdx)}
                            className="p-1 text-error hover:bg-error-container/40 rounded-md transition-colors cursor-pointer"
                            title="Remove this dimension axis"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Option Descriptor / Title */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-label-md text-label-md text-on-surface font-medium">
                    Composite Display Title <span className="text-error">*</span>
                  </label>
                  <span className="font-caption text-caption text-outline">
                    Derived from axes
                  </span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pro Tier · Annual or Deluxe King · Breakfast Included"
                  value={singleTitle}
                  onChange={(e) => setSingleTitle(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 text-body-md"
                />
              </div>

              {/* Combination Description / Copy */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-label-md text-label-md text-on-surface font-medium">
                    Combination Description / Copy <span className="text-xs font-normal text-on-surface-variant">(Optional)</span>
                  </label>
                  <span className="text-xs text-outline font-normal">
                    {singleDescription.length}/1000
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={1000}
                  placeholder="e.g. Best seller. Ships same day."
                  value={singleDescription}
                  onChange={(e) => setSingleDescription(e.target.value)}
                  className="w-full p-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-body-sm resize-none"
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
                    Price (₹) <span className="text-xs font-normal text-on-surface-variant">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 4999 (0 if unpriced)"
                    value={singlePrice}
                    onChange={(e) => setSinglePrice(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-body-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-on-surface font-medium">
                    Stock <span className="text-xs font-normal text-on-surface-variant">(Optional)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 25"
                    value={singleStock}
                    onChange={(e) => setSingleStock(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-body-md"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-label-md text-label-md text-on-surface font-medium">
                    Status <span className="text-xs font-normal text-on-surface-variant">(Optional)</span>
                  </label>
                  <select
                    value={
                      String(singleStatus || '').toLowerCase().includes('unspec') || String(singleStatus || '').toLowerCase().includes('not set')
                        ? 'Unspecified'
                        : String(singleStatus || '').toLowerCase().includes('out') || String(singleStatus || '').toLowerCase().includes('unavail') || String(singleStatus || '').toLowerCase().includes('sold')
                        ? 'Unavailable'
                        : String(singleStatus || '').toLowerCase().includes('low') || String(singleStatus || '').toLowerCase().includes('limit')
                        ? 'Limited'
                        : String(singleStatus || '').toLowerCase().includes('in') || String(singleStatus || '').toLowerCase().includes('avail')
                        ? 'Available'
                        : ''
                    }
                    onChange={(e) => setSingleStatus(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl bg-surface-container-low text-on-surface border border-surface-container-high focus:outline-none focus:border-primary text-body-md cursor-pointer"
                  >
                    <option value="">Not set (Default)</option>
                    <option value="Available">Available (In Stock)</option>
                    <option value="Limited">Limited (Low Stock)</option>
                    <option value="Unavailable">Unavailable (Out of Stock)</option>
                    <option value="Unspecified">Unspecified (Not Set)</option>
                  </select>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-low">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={handleCloseSingleModal}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                >
                  {editingVariantIndex !== null ? 'Save Changes' : 'Add Option'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
