import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { assets, categories } from '../../assets/assets';
import toast from 'react-hot-toast';
import {
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Trash2,
  RefreshCw,
  PlusCircle,
  Package,
  AlertTriangle,
  X,
  CheckCircle2,
  AlertCircle
} from '../../components/seller/SellerIcons';

const ProductList = () => {

  const { currency, axios, fetchProducts } = useAppContext();

  // Seller Inventory State
  const [sellerProducts, setSellerProducts] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    totalProducts: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Query States
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [stockStatus, setStockStatus] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // In-flight Toggle Tracking
  const [togglingIds, setTogglingIds] = useState(new Set());

  // Edit Product Modal State
  const [editingProduct, setEditingProduct] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editOfferPrice, setEditOfferPrice] = useState('');
  const [editStockQuantity, setEditStockQuantity] = useState('');
  const [editLowStockThreshold, setEditLowStockThreshold] = useState('5');
  const [editColorInput, setEditColorInput] = useState('');
  const [editColors, setEditColors] = useState([]);
  const [editFiles, setEditFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation State
  const [productToDelete, setProductToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search input by 400ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchInput]);

  const previewUrlsRef = useRef(previewUrls);
  useEffect(() => {
    previewUrlsRef.current = previewUrls;
  }, [previewUrls]);

  // Cleanup all preview object URLs on component unmount
  useEffect(() => {
    return () => {
      Object.values(previewUrlsRef.current).forEach(url => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, []);

  // Fetch Seller Inventory from authenticated endpoint
  const fetchSellerInventory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page,
        limit,
        sortBy,
        sortOrder
      };
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (category.trim()) params.category = category.trim();
      if (stockStatus.trim()) params.stockStatus = stockStatus.trim();

      const { data } = await axios.get('/api/product/seller/list', { params });
      if (data.success) {
        setSellerProducts(data.products || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else {
        const msg = data.message || "Failed to load seller inventory";
        setError(msg);
        toast.error(msg);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        const authMsg = "Seller session expired. Please log in again.";
        setError(authMsg);
        toast.error(authMsg);
      } else {
        const msg = err.response?.data?.message || err.message || "Failed to load inventory";
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [axios, page, limit, sortBy, sortOrder, debouncedSearch, category, stockStatus]);

  useEffect(() => {
    fetchSellerInventory();
  }, [fetchSellerInventory]);

  // Stock Availability Toggle with zero-stock guard
  const toggleStock = async (id, newInStock, stockQty) => {
    if (stockQty === 0 && newInStock) {
      toast.error("Cannot mark product in stock when stock quantity is 0");
      return;
    }
    if (togglingIds.has(id)) return;

    setTogglingIds(prev => new Set(prev).add(id));
    try {
      const { data } = await axios.post('/api/product/stock', { id, inStock: newInStock });
      if (data.success) {
        toast.success(data.message || "Stock updated successfully");
        fetchSellerInventory();
        if (typeof fetchProducts === 'function') {
          fetchProducts();
        }
      } else {
        toast.error(data.message || "Failed to update stock");
      }
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error("Seller session expired. Please log in again.");
      } else {
        toast.error(error.response?.data?.message || error.message || "Failed to update stock");
      }
    } finally {
      setTogglingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Edit Modal Handlers
  const closeEditModal = () => {
    Object.values(previewUrls).forEach(url => {
      if (url) URL.revokeObjectURL(url);
    });
    setPreviewUrls({});
    setEditFiles([]);
    setEditingProduct(null);
  };

  const openEditModal = (product) => {
    Object.values(previewUrls).forEach(url => {
      if (url) URL.revokeObjectURL(url);
    });
    setPreviewUrls({});
    setEditingProduct(product);
    setEditName(product.name || '');
    setEditDescription(
      Array.isArray(product.description)
        ? product.description.join('\n')
        : (product.description || '')
    );
    setEditCategory(product.category || '');
    setEditPrice(product.price !== undefined ? String(product.price) : '');
    setEditOfferPrice(product.offerPrice !== undefined ? String(product.offerPrice) : '');
    setEditStockQuantity(
      product.stockQuantity !== null && product.stockQuantity !== undefined
        ? String(product.stockQuantity)
        : ''
    );
    setEditLowStockThreshold(
      product.lowStockThreshold !== null && product.lowStockThreshold !== undefined
        ? String(product.lowStockThreshold)
        : '5'
    );
    setEditColors(Array.isArray(product.availableColors) ? [...product.availableColors] : []);
    setEditColorInput('');
    setEditFiles([]);
  };

  const handleImageChange = (index, file) => {
    if (!file) return;

    if (previewUrls[index]) {
      URL.revokeObjectURL(previewUrls[index]);
    }

    const newUrl = URL.createObjectURL(file);
    setPreviewUrls(prev => ({ ...prev, [index]: newUrl }));

    const updated = [...editFiles];
    updated[index] = file;
    setEditFiles(updated);
  };

  const handleAddEditColor = () => {
    if (!editColorInput.trim()) return;
    const rawTokens = editColorInput.split(',').map(c => c.trim()).filter(Boolean);
    const uniqueNew = [];
    for (const token of rawTokens) {
      const lower = token.toLowerCase();
      const alreadyExists = editColors.some(c => c.toLowerCase() === lower) ||
                            uniqueNew.some(c => c.toLowerCase() === lower);
      if (!alreadyExists) {
        uniqueNew.push(token);
      }
    }
    if (uniqueNew.length === 0) {
      toast.error("Color already added or invalid");
    } else {
      setEditColors(prev => [...prev, ...uniqueNew]);
      setEditColorInput('');
    }
  };

  const handleRemoveEditColor = (indexToRemove) => {
    setEditColors(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();
    if (!editingProduct?._id || isSaving) return;

    if (!editName.trim()) {
      toast.error("Product name is required");
      return;
    }
    if (!editCategory.trim()) {
      toast.error("Category is required");
      return;
    }
    const descLines = editDescription.split('\n').map(d => d.trim()).filter(Boolean);
    if (descLines.length === 0) {
      toast.error("Product description is required");
      return;
    }
    const priceNum = Number(editPrice);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      toast.error("Please enter a valid price greater than 0");
      return;
    }
    let offerPriceNum = null;
    if (editOfferPrice !== '' && editOfferPrice !== null && editOfferPrice !== undefined) {
      const parsed = Number(editOfferPrice);
      if (!Number.isFinite(parsed) || parsed < 0) {
        toast.error("Please enter a valid offer price");
        return;
      }
      offerPriceNum = parsed;
    }

    // Stock quantity normalization
    let normalizedStockQuantity = null;
    const trimmedStock = typeof editStockQuantity === 'string' ? editStockQuantity.trim() : '';
    if (trimmedStock !== '') {
      const parsedStock = Number(trimmedStock);
      if (!Number.isInteger(parsedStock) || parsedStock < 0) {
        toast.error("Stock quantity must be a non-negative whole number");
        return;
      }
      normalizedStockQuantity = parsedStock;
    }

    // Low stock threshold normalization
    let normalizedThreshold = 5;
    const trimmedThreshold = typeof editLowStockThreshold === 'string' ? editLowStockThreshold.trim() : '';
    if (trimmedThreshold !== '') {
      const parsedThreshold = Number(trimmedThreshold);
      if (!Number.isInteger(parsedThreshold) || parsedThreshold < 1) {
        toast.error("Low stock threshold must be a whole number of at least 1");
        return;
      }
      normalizedThreshold = parsedThreshold;
    }

    // Available colors normalization
    let finalColors = [...editColors];
    if (editColorInput.trim()) {
      const rawTokens = editColorInput.split(',').map(c => c.trim()).filter(Boolean);
      for (const token of rawTokens) {
        if (!finalColors.some(c => c.toLowerCase() === token.toLowerCase())) {
          finalColors.push(token);
        }
      }
    }

    setIsSaving(true);
    try {
      const productData = {
        id: editingProduct._id,
        name: editName.trim(),
        description: descLines,
        category: editCategory.trim(),
        price: priceNum,
        offerPrice: offerPriceNum,
        stockQuantity: normalizedStockQuantity,
        lowStockThreshold: normalizedThreshold,
        availableColors: finalColors
      };

      const slotIndices = [];
      const filesToUpload = [];
      for (let i = 0; i < editFiles.length; i++) {
        if (editFiles[i]) {
          slotIndices.push(i);
          filesToUpload.push(editFiles[i]);
        }
      }

      if (slotIndices.length > 0) {
        productData.slotIndices = slotIndices;
      }

      const formData = new FormData();
      formData.append('productData', JSON.stringify(productData));

      for (let i = 0; i < filesToUpload.length; i++) {
        formData.append('images', filesToUpload[i]);
      }

      const { data } = await axios.post('/api/product/update', formData);
      if (data.success) {
        toast.success(data.message || "Product updated successfully");
        closeEditModal();
        fetchSellerInventory();
        if (typeof fetchProducts === 'function') {
          fetchProducts();
        }
      } else {
        toast.error(data.message || "Failed to update product");
      }
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error("Seller session expired. Please log in again.");
      } else {
        toast.error(error.response?.data?.message || error.message || "Failed to update product");
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Handlers
  const openDeleteConfirm = (product) => {
    setProductToDelete(product);
  };

  const handleConfirmDelete = async () => {
    if (!productToDelete?._id || isDeleting) return;

    setIsDeleting(true);
    try {
      const { data } = await axios.post('/api/product/delete', { id: productToDelete._id });
      if (data.success) {
        toast.success(data.message || "Product deleted successfully");
        setProductToDelete(null);
        if (sellerProducts.length === 1 && page > 1) {
          setPage(prev => prev - 1);
        } else {
          fetchSellerInventory();
        }
        if (typeof fetchProducts === 'function') {
          fetchProducts();
        }
      } else {
        toast.error(data.message || "Failed to delete product");
      }
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error("Seller session expired. Please log in again.");
      } else {
        toast.error(error.response?.data?.message || error.message || "Failed to delete product");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Sorting Handler
  const handleSortChange = (newSortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Reset Filters Handler
  const handleResetFilters = () => {
    setSearchInput('');
    setCategory('');
    setStockStatus('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
  };

  // Helper Badge Renderers
  const renderStockStatusBadge = (status) => {
    switch (status) {
      case 'In Stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            In Stock
          </span>
        );
      case 'Low Stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Low Stock
          </span>
        );
      case 'Out of Stock':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            Out of Stock
          </span>
        );
      case 'Stock Not Recorded':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            Not Recorded
          </span>
        );
    }
  };

  const renderStockQuantity = (qty, threshold) => {
    if (qty === null || qty === undefined) {
      return <span className="text-slate-400 font-normal" title="Stock not tracked">—</span>;
    }
    if (qty === 0) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-700">
          0
        </span>
      );
    }
    const isLow = typeof threshold === 'number' && qty <= threshold;
    return (
      <div className="flex flex-col">
        <span className={`font-semibold text-sm ${isLow ? "text-amber-700 font-bold" : "text-slate-900"}`}>
          {qty}
        </span>
        {threshold && (
          <span className="text-[11px] text-slate-400 font-normal">min {threshold}</span>
        )}
      </div>
    );
  };

  const isFiltered = Boolean(searchInput || category || stockStatus || sortBy !== 'createdAt' || sortOrder !== 'desc');

  return (
    <div className='no-scrollbar flex-1 h-[95vh] overflow-y-scroll flex flex-col justify-between'>
      <div className="flex-1 py-6 flex flex-col justify-between">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

          {/* Top Bar: Title & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Products & Inventory</h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Manage stock levels, pricing, availability, and product details.</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={fetchSellerInventory}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 rounded-lg border border-slate-300 shadow-xs transition cursor-pointer disabled:opacity-60"
                title="Refresh product list"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
                <span>Refresh</span>
              </button>

              <Link
                to="/seller/add-product"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-lg shadow-xs hover:shadow transition cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Product</span>
              </Link>
            </div>
          </div>

          {/* Search & Filter Card */}
          <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200/90 shadow-xs space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search name or category..."
                  className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-lg outline-none transition text-slate-800 placeholder:text-slate-400"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPage(1);
                  }}
                  className="w-full py-2 px-3 text-sm bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-lg outline-none transition text-slate-700 cursor-pointer"
                >
                  <option value="">All Categories</option>
                  {categories.map((item, index) => (
                    <option key={index} value={item.path}>{item.path}</option>
                  ))}
                </select>
              </div>

              {/* Stock Status Filter (Strict Canonical Values) */}
              <div>
                <select
                  value={stockStatus}
                  onChange={(e) => {
                    setStockStatus(e.target.value);
                    setPage(1);
                  }}
                  className="w-full py-2 px-3 text-sm bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-lg outline-none transition text-slate-700 cursor-pointer"
                >
                  <option value="">All Stock Status</option>
                  <option value="instock">In Stock</option>
                  <option value="lowstock">Low Stock</option>
                  <option value="outofstock">Out of Stock</option>
                  <option value="unrecorded">Stock Not Recorded</option>
                </select>
              </div>

              {/* Sort By & Order */}
              <div>
                <select
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field);
                    setSortOrder(order);
                    setPage(1);
                  }}
                  className="w-full py-2 px-3 text-sm bg-slate-50/50 hover:bg-white focus:bg-white border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 rounded-lg outline-none transition text-slate-700 cursor-pointer"
                >
                  <option value="createdAt-desc">Newest First</option>
                  <option value="createdAt-asc">Oldest First</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="price-asc">Price (Low to High)</option>
                  <option value="price-desc">Price (High to Low)</option>
                  <option value="offerPrice-asc">Offer Price (Low to High)</option>
                  <option value="offerPrice-desc">Offer Price (High to Low)</option>
                  <option value="stockQuantity-asc">Stock (Low to High)</option>
                  <option value="stockQuantity-desc">Stock (High to Low)</option>
                </select>
              </div>
            </div>

            {/* Sub-bar: Limit selector & Active filter indicators */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-600">Rows per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="py-1 px-2 border border-slate-300 rounded-md text-xs bg-white text-slate-700 outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-slate-600">
                  Total matches: <span className="font-semibold text-slate-900">{pagination.totalProducts}</span>
                </div>
                {isFiltered && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md border border-slate-200 transition cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    Reset Filters
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Inventory Table Container */}
          <div className="w-full overflow-hidden rounded-xl bg-white border border-slate-200/90 shadow-xs">
            <div className="w-full overflow-x-auto">
              <table className="min-w-full table-auto text-left">
                <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider border-b border-slate-200 select-none">
                  <tr>
                    <th
                      onClick={() => handleSortChange('name')}
                      className="px-5 py-3.5 font-semibold truncate cursor-pointer hover:text-emerald-700 transition"
                      title="Sort by name"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Product</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-5 py-3.5 font-semibold truncate">Category</th>
                    <th
                      onClick={() => handleSortChange('price')}
                      className="px-5 py-3.5 font-semibold truncate cursor-pointer hover:text-emerald-700 transition"
                      title="Sort by price"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Price</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSortChange('stockQuantity')}
                      className="px-5 py-3.5 font-semibold truncate cursor-pointer hover:text-emerald-700 transition"
                      title="Sort by stock quantity"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Stock</span>
                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </th>
                    <th className="px-5 py-3.5 font-semibold truncate">Status</th>
                    <th className="px-5 py-3.5 font-semibold truncate">In Stock</th>
                    <th className="px-5 py-3.5 font-semibold truncate text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-slate-600 divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-sm text-slate-600 font-medium">Loading inventory...</p>
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-rose-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <AlertCircle className="w-8 h-8 text-rose-500" />
                          <p className="text-sm font-medium">{error}</p>
                          <button
                            type="button"
                            onClick={fetchSellerInventory}
                            className="mt-2 px-4 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition cursor-pointer"
                          >
                            Retry
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : sellerProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-16 text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2.5 max-w-sm mx-auto">
                          <div className="p-3 bg-slate-100 text-slate-400 rounded-full">
                            <Package className="w-8 h-8" />
                          </div>
                          <p className="text-base font-semibold text-slate-800">No products found</p>
                          <p className="text-xs text-slate-500 text-center leading-relaxed">
                            {isFiltered
                              ? "No products match your current search or filter criteria. Try clearing them to see all items."
                              : "Your seller catalog is currently empty. Start by adding your first product."}
                          </p>
                          {isFiltered ? (
                            <button
                              type="button"
                              onClick={handleResetFilters}
                              className="mt-2 px-3.5 py-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition font-medium border border-emerald-200 cursor-pointer"
                            >
                              Clear All Filters
                            </button>
                          ) : (
                            <Link
                              to="/seller/add-product"
                              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition"
                            >
                              <PlusCircle className="w-4 h-4" />
                              Add First Product
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sellerProducts.map((product) => {
                      const isZeroStock = product.stockQuantity === 0;
                      const isToggling = togglingIds.has(product._id);
                      return (
                        <tr key={product._id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center space-x-3.5">
                              <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-white shrink-0 p-1 flex items-center justify-center">
                                <img
                                  src={product.image?.[0] || assets.upload_area}
                                  alt={product.name}
                                  className="w-full h-full object-cover rounded-md"
                                />
                              </div>
                              <div className="min-w-0 max-w-xs sm:max-w-sm">
                                <p className="truncate font-semibold text-slate-900 text-sm hover:text-emerald-700 transition" title={product.name}>
                                  {product.name}
                                </p>
                                {Array.isArray(product.availableColors) && product.availableColors.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1 mt-1">
                                    {product.availableColors.slice(0, 3).map((col, idx) => (
                                      <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200">
                                        {col}
                                      </span>
                                    ))}
                                    {product.availableColors.length > 3 && (
                                      <span className="text-[10px] text-slate-400">+{product.availableColors.length - 3}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-xs font-medium text-slate-600">
                            <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200/70">
                              {product.category}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {(() => {
                              let regularPrice = typeof product.price === 'number' && Number.isFinite(product.price) && product.price > 0 ? product.price : null;
                              if (regularPrice === null && typeof product.offerPrice === 'number' && Number.isFinite(product.offerPrice) && product.offerPrice > 0) {
                                regularPrice = product.offerPrice;
                              }
                              const hasValidDiscount = typeof product.offerPrice === 'number' && Number.isFinite(product.offerPrice) && product.offerPrice > 0 && regularPrice !== null && product.offerPrice < regularPrice;
                              const effectivePrice = hasValidDiscount ? product.offerPrice : (regularPrice || 0);

                              return (
                                <div className="flex items-baseline gap-1.5">
                                  <span className="font-bold text-slate-900 text-sm">{currency}{effectivePrice}</span>
                                  {hasValidDiscount && (
                                    <span className="text-xs text-slate-400 line-through">
                                      {currency}{regularPrice}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {renderStockQuantity(product.stockQuantity, product.lowStockThreshold)}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            {renderStockStatusBadge(product.stockStatus)}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <label
                                className={`relative inline-flex items-center cursor-pointer ${
                                  isZeroStock || isToggling ? 'cursor-not-allowed opacity-50' : ''
                                }`}
                                title={
                                  isZeroStock
                                    ? "Cannot mark in stock when stock quantity is 0. Please restock first."
                                    : (isToggling ? "Updating stock..." : (product.inStock ? "Click to mark out of stock" : "Click to mark in stock"))
                                }
                              >
                                <input
                                  onChange={() => toggleStock(product._id, !product.inStock, product.stockQuantity)}
                                  checked={Boolean(product.inStock)}
                                  disabled={isZeroStock || isToggling}
                                  type="checkbox"
                                  className="sr-only peer"
                                />
                                <div className="w-10 h-5.5 bg-slate-200 rounded-full peer peer-checked:bg-emerald-600 transition-colors duration-200"></div>
                                <span className="dot absolute left-0.5 top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-xs transition-transform duration-200 ease-in-out peer-checked:translate-x-4.5"></span>
                              </label>
                              {isZeroStock && (
                                <span className="text-[10px] text-rose-500 font-medium">Restock required</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditModal(product)}
                                disabled={isDeleting || isSaving}
                                className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer disabled:opacity-40"
                                title="Edit product"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => openDeleteConfirm(product)}
                                disabled={isDeleting || isSaving}
                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer disabled:opacity-40"
                                title="Delete product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {!isLoading && !error && pagination.totalProducts > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full px-5 py-3.5 bg-slate-50 border-t border-slate-200 text-xs">
                <div className="text-slate-600">
                  Showing <span className="font-semibold text-slate-900">{(pagination.page - 1) * pagination.limit + 1}</span> to <span className="font-semibold text-slate-900">{Math.min(pagination.page * pagination.limit, pagination.totalProducts)}</span> of <span className="font-semibold text-slate-900">{pagination.totalProducts}</span> products
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                    disabled={!pagination.hasPrevPage || isLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg font-medium text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Previous</span>
                  </button>
                  <span className="text-slate-700 px-2 font-medium">
                    Page <span className="font-semibold text-slate-900">{pagination.page}</span> of {pagination.totalPages || 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage(prev => Math.min(prev + 1, pagination.totalPages || 1))}
                    disabled={!pagination.hasNextPage || isLoading}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-300 rounded-lg font-medium text-slate-700 bg-white hover:bg-slate-50 active:bg-slate-100 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Product Modal */}
      {editingProduct && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSaving) {
              closeEditModal();
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Edit Product</h3>
                  <p className="text-xs text-slate-500">Update product specifications, images, and inventory parameters.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { if (!isSaving) closeEditModal(); }}
                disabled={isSaving}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 mt-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-700">Product Images</p>
                <p className="text-xs text-slate-500 mb-2">Click an image slot to upload a replacement photo.</p>
                <div className="grid grid-cols-4 gap-2.5">
                  {Array(4).fill('').map((_, index) => {
                    const displaySrc = previewUrls[index] || editingProduct.image?.[index] || assets.upload_area;
                    return (
                      <label key={index} htmlFor={`edit-image-${index}`} className="group cursor-pointer block relative rounded-xl overflow-hidden border border-slate-200 hover:border-emerald-500 transition aspect-square bg-slate-50">
                        <input
                          type="file"
                          id={`edit-image-${index}`}
                          hidden
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleImageChange(index, e.target.files[0]);
                            }
                          }}
                        />
                        <img
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          src={displaySrc}
                          alt={`Product slot ${index + 1}`}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700" htmlFor="edit-name">Product Name</label>
                <input
                  id="edit-name"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="outline-none py-2 px-3 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition text-slate-800"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700" htmlFor="edit-description">Product Description</label>
                <textarea
                  id="edit-description"
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="outline-none py-2 px-3 rounded-lg border border-slate-300 text-sm resize-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition text-slate-800"
                  placeholder="One description point per line"
                  required
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700" htmlFor="edit-category">Category</label>
                <select
                  id="edit-category"
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="outline-none py-2 px-3 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition text-slate-800 bg-white"
                  required
                >
                  <option value="">Select Category</option>
                  {categories.map((item, index) => (
                    <option key={index} value={item.path}>{item.path}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700" htmlFor="edit-price">Regular Price ({currency})</label>
                  <input
                    id="edit-price"
                    type="number"
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="outline-none py-2 px-3 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition text-slate-800"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700" htmlFor="edit-offer-price">Offer Price ({currency})</label>
                  <input
                    id="edit-offer-price"
                    type="number"
                    value={editOfferPrice}
                    onChange={(e) => setEditOfferPrice(e.target.value)}
                    placeholder="Optional"
                    className="outline-none py-2 px-3 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition text-slate-800"
                  />
                </div>
              </div>

              {/* Inventory Management in Edit Modal */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700" htmlFor="edit-stock-quantity">
                    Stock Quantity <span className="text-[11px] text-slate-400 font-normal">(Empty = unrecorded)</span>
                  </label>
                  <input
                    id="edit-stock-quantity"
                    type="number"
                    min="0"
                    step="1"
                    value={editStockQuantity}
                    onChange={(e) => setEditStockQuantity(e.target.value)}
                    placeholder="Unrecorded"
                    className="outline-none py-1.5 px-3 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 bg-white"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700" htmlFor="edit-low-stock-threshold">
                    Low Stock Alert <span className="text-[11px] text-slate-400 font-normal">(Min 1)</span>
                  </label>
                  <input
                    id="edit-low-stock-threshold"
                    type="number"
                    min="1"
                    step="1"
                    value={editLowStockThreshold}
                    onChange={(e) => setEditLowStockThreshold(e.target.value)}
                    placeholder="5"
                    className="outline-none py-1.5 px-3 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 bg-white"
                  />
                </div>
              </div>

              {/* Colors in Edit Modal */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700" htmlFor="edit-color-input">
                  Available Colors
                </label>
                <div className="flex gap-2">
                  <input
                    id="edit-color-input"
                    type="text"
                    value={editColorInput}
                    onChange={(e) => setEditColorInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEditColor();
                      }
                    }}
                    placeholder="e.g. Red, Blue, Matte Black"
                    className="flex-1 outline-none py-2 px-3 rounded-lg border border-slate-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition text-slate-800"
                  />
                  <button
                    type="button"
                    onClick={handleAddEditColor}
                    className="px-3.5 py-2 border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 active:bg-slate-200 transition cursor-pointer"
                  >
                    Add
                  </button>
                </div>
                {editColors.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {editColors.map((col, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-full border border-slate-200"
                      >
                        {col}
                        <button
                          type="button"
                          onClick={() => handleRemoveEditColor(idx)}
                          className="text-slate-400 hover:text-rose-600 font-bold leading-none cursor-pointer"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => { if (!isSaving) closeEditModal(); }}
                  disabled={isSaving}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs hover:shadow transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) {
              setProductToDelete(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete Product</h3>
            </div>
            <p className="text-xs text-slate-600 mb-5 leading-relaxed">
              Are you sure you want to permanently delete <span className="font-semibold text-slate-900">{productToDelete.name}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (!isDeleting) setProductToDelete(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs hover:shadow transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductList
