import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom';
import { assets, categories } from '../../assets/assets';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    PlusCircle,
    UploadCloud,
    Package,
    DollarSign,
    AlertCircle,
    CheckCircle2,
    X
} from '../../components/seller/SellerIcons';

const AddProduct = () => {

    const [files, setFiles] = useState([]);
    const [previewUrls, setPreviewUrls] = useState({});
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [price, setPrice] = useState('');
    const [offerPrice, setOfferPrice] = useState('');
    const [stockQuantity, setStockQuantity] = useState('');
    const [lowStockThreshold, setLowStockThreshold] = useState('5');
    const [colorInput, setColorInput] = useState('');
    const [availableColors, setAvailableColors] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

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

    const handleImageChange = (index, file) => {
        if (!file) return;

        if (previewUrls[index]) {
            URL.revokeObjectURL(previewUrls[index]);
        }

        const newUrl = URL.createObjectURL(file);
        setPreviewUrls(prev => ({ ...prev, [index]: newUrl }));

        const uploadFiles = [...files];
        uploadFiles[index] = file;
        setFiles(uploadFiles);
    };

    const handleAddColor = () => {
        if (!colorInput.trim()) return;
        const rawTokens = colorInput.split(',').map(c => c.trim()).filter(Boolean);
        const uniqueNew = [];
        for (const token of rawTokens) {
            const lower = token.toLowerCase();
            const alreadyExists = availableColors.some(c => c.toLowerCase() === lower) ||
                                  uniqueNew.some(c => c.toLowerCase() === lower);
            if (!alreadyExists) {
                uniqueNew.push(token);
            }
        }
        if (uniqueNew.length === 0) {
            toast.error("Color already added or invalid");
        } else {
            setAvailableColors(prev => [...prev, ...uniqueNew]);
            setColorInput('');
        }
    };

    const handleColorKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddColor();
        }
    };

    const handleRemoveColor = (indexToRemove) => {
        setAvailableColors(prev => prev.filter((_, idx) => idx !== indexToRemove));
    };

    const { axios, fetchProducts } = useAppContext();

    const onSubmitHandler = async (event) => {
        event.preventDefault();
        if (isSubmitting) return;

        try {
            const hasImage = files.some(f => Boolean(f));
            if (!hasImage) {
                toast.error("At least one product image is required");
                return;
            }

            if (!name.trim()) {
                toast.error("Product name is required");
                return;
            }

            if (!category.trim()) {
                toast.error("Please select a category");
                return;
            }

            const descLines = description.split('\n').map(d => d.trim()).filter(Boolean);
            if (descLines.length === 0) {
                toast.error("Product description is required");
                return;
            }

            if (price === '' || price === null || price === undefined) {
                toast.error("Please enter a valid product price");
                return;
            }
            const priceNum = Number(price);
            if (!Number.isFinite(priceNum) || priceNum <= 0) {
                toast.error("Please enter a valid regular price greater than 0");
                return;
            }

            let offerPriceNum = null;
            if (offerPrice !== '' && offerPrice !== null && offerPrice !== undefined) {
                const parsed = Number(offerPrice);
                if (!Number.isFinite(parsed) || parsed < 0) {
                    toast.error("Please enter a valid offer price");
                    return;
                }
                offerPriceNum = parsed;
            }

            // Stock quantity validation & normalization
            let normalizedStockQuantity = null;
            const trimmedStock = typeof stockQuantity === 'string' ? stockQuantity.trim() : '';
            if (trimmedStock !== '') {
                const parsedStock = Number(trimmedStock);
                if (!Number.isInteger(parsedStock) || parsedStock < 0) {
                    toast.error("Stock quantity must be a non-negative whole number");
                    return;
                }
                normalizedStockQuantity = parsedStock;
            }

            // Low stock threshold validation & normalization
            let normalizedThreshold = 5;
            const trimmedThreshold = typeof lowStockThreshold === 'string' ? lowStockThreshold.trim() : '';
            if (trimmedThreshold !== '') {
                const parsedThreshold = Number(trimmedThreshold);
                if (!Number.isInteger(parsedThreshold) || parsedThreshold < 1) {
                    toast.error("Low stock threshold must be a whole number of at least 1");
                    return;
                }
                normalizedThreshold = parsedThreshold;
            }

            // Available colors normalization
            let finalColors = [...availableColors];
            if (colorInput.trim()) {
                const rawTokens = colorInput.split(',').map(c => c.trim()).filter(Boolean);
                for (const token of rawTokens) {
                    if (!finalColors.some(c => c.toLowerCase() === token.toLowerCase())) {
                        finalColors.push(token);
                    }
                }
            }

            setIsSubmitting(true);

            const productData = {
                name: name.trim(),
                description: descLines,
                category: category.trim(),
                price: priceNum,
                offerPrice: offerPriceNum,
                stockQuantity: normalizedStockQuantity,
                lowStockThreshold: normalizedThreshold,
                availableColors: finalColors
            };

            const formData = new FormData();
            formData.append('productData', JSON.stringify(productData));
            for (let i = 0; i < files.length; i++) {
                if (files[i]) {
                    formData.append('images', files[i]);
                }
            }

            const { data } = await axios.post('/api/product/add', formData);

            if (data.success) {
                toast.success(data.message || "Product added successfully");
                if (typeof fetchProducts === 'function') {
                    fetchProducts();
                }
                setName('');
                setDescription('');
                setCategory('');
                setPrice('');
                setOfferPrice('');
                setStockQuantity('');
                setLowStockThreshold('5');
                setColorInput('');
                setAvailableColors([]);
                setFiles([]);
                Object.values(previewUrls).forEach(url => {
                    if (url) URL.revokeObjectURL(url);
                });
                setPreviewUrls({});
            } else {
                toast.error(data.message || "Failed to add product");
            }

        } catch (error) {
            toast.error(error.response?.data?.message || error.message || "Failed to add product");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll flex flex-col justify-between">
            <div className="flex-1 py-6">
                <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

                    {/* Top Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                                <PlusCircle className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Add New Product</h1>
                                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Publish a new catalog item with photos, pricing, and inventory rules.</p>
                            </div>
                        </div>

                        <Link
                            to="/seller/product-list"
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 shadow-xs transition self-start sm:self-auto"
                        >
                            <Package className="w-4 h-4 text-slate-500" />
                            <span>View All Products</span>
                        </Link>
                    </div>

                    <form onSubmit={onSubmitHandler} className="space-y-6">

                        {/* 1. Media & Gallery Card */}
                        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <UploadCloud className="w-5 h-5 text-emerald-600" />
                                    <h2 className="text-sm sm:text-base font-bold text-slate-900">Product Images</h2>
                                </div>
                                <span className="text-xs text-slate-500">Up to 4 images (Slot 1 is primary)</span>
                            </div>

                            <p className="text-xs text-slate-500">Upload high quality JPEG, PNG, or WebP images to showcase your item.</p>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {Array(4).fill('').map((_, index) => {
                                    const hasImg = Boolean(previewUrls[index]);
                                    return (
                                        <label
                                            key={index}
                                            htmlFor={`image${index}`}
                                            className={`relative group block aspect-square rounded-xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${
                                                hasImg
                                                    ? 'border-emerald-300 bg-emerald-50/20'
                                                    : 'border-slate-300 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/10'
                                            }`}
                                        >
                                            <input
                                                onChange={(e) => {
                                                    if (e.target.files && e.target.files[0]) {
                                                        handleImageChange(index, e.target.files[0]);
                                                    }
                                                }}
                                                type="file"
                                                id={`image${index}`}
                                                accept="image/*"
                                                hidden
                                            />

                                            {hasImg ? (
                                                <div className="w-full h-full relative">
                                                    <img
                                                        className="w-full h-full object-cover rounded-lg group-hover:scale-105 transition-transform duration-200"
                                                        src={previewUrls[index]}
                                                        alt={`Product preview ${index + 1}`}
                                                    />
                                                    <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                        <span className="text-[11px] font-semibold text-white bg-slate-900/70 px-2 py-1 rounded-md">
                                                            Change Image
                                                        </span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center">
                                                    <div className="w-9 h-9 rounded-full bg-slate-100 group-hover:bg-emerald-100/60 text-slate-400 group-hover:text-emerald-600 flex items-center justify-center mb-1.5 transition-colors">
                                                        <UploadCloud className="w-5 h-5" />
                                                    </div>
                                                    <span className="text-xs font-semibold text-slate-700">Slot {index + 1}</span>
                                                    <span className="text-[10px] text-slate-400 mt-0.5">{index === 0 ? 'Primary' : 'Additional'}</span>
                                                </div>
                                            )}
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 2. General Information Card */}
                        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                            <div className="flex items-center gap-2">
                                <Package className="w-5 h-5 text-emerald-600" />
                                <h2 className="text-sm sm:text-base font-bold text-slate-900">General Information</h2>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="sm:col-span-2 flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-slate-700" htmlFor="product-name">
                                        Product Title <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        onChange={(e) => setName(e.target.value)}
                                        value={name}
                                        id="product-name"
                                        type="text"
                                        placeholder="e.g. Organic Cavendish Bananas (1 Dozen)"
                                        className="outline-none py-2.5 px-3.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition text-sm text-slate-800 placeholder:text-slate-400"
                                        required
                                    />
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-slate-700" htmlFor="category">
                                        Category <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        onChange={(e) => setCategory(e.target.value)}
                                        value={category}
                                        id="category"
                                        className="outline-none py-2.5 px-3 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition text-sm text-slate-800 bg-white cursor-pointer"
                                        required
                                    >
                                        <option value="">Select Category</option>
                                        {categories.map((item, index) => (
                                            <option key={index} value={item.path}>{item.path}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-slate-700" htmlFor="product-description">
                                    Product Description <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    onChange={(e) => setDescription(e.target.value)}
                                    value={description}
                                    id="product-description"
                                    rows={4}
                                    className="outline-none py-2.5 px-3.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition text-sm text-slate-800 placeholder:text-slate-400 resize-none leading-relaxed"
                                    placeholder="Enter detailed points (one per line) describing the product attributes, ingredients, freshness, and pack size."
                                    required
                                />
                                <span className="text-[11px] text-slate-400">Tip: Each line will be displayed as a feature bullet on the customer product details page.</span>
                            </div>
                        </div>

                        {/* 3. Pricing & Inventory Card */}
                        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                            <div className="flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-emerald-600" />
                                <h2 className="text-sm sm:text-base font-bold text-slate-900">Pricing & Inventory</h2>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-slate-700" htmlFor="product-price">
                                        Regular Price <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        onChange={(e) => setPrice(e.target.value)}
                                        value={price}
                                        id="product-price"
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        className="outline-none py-2.5 px-3.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition text-sm text-slate-800"
                                        required
                                    />
                                    <span className="text-[11px] text-slate-400">Standard retail price</span>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-slate-700" htmlFor="offer-price">
                                        Offer Price
                                    </label>
                                    <input
                                        onChange={(e) => setOfferPrice(e.target.value)}
                                        value={offerPrice}
                                        id="offer-price"
                                        type="number"
                                        step="0.01"
                                        placeholder="Optional (0.00)"
                                        className="outline-none py-2.5 px-3.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition text-sm text-slate-800"
                                    />
                                    <span className="text-[11px] text-slate-400">Discounted selling price (optional)</span>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-slate-700" htmlFor="stock-quantity">
                                        Stock Quantity
                                    </label>
                                    <input
                                        onChange={(e) => setStockQuantity(e.target.value)}
                                        value={stockQuantity}
                                        id="stock-quantity"
                                        type="number"
                                        min="0"
                                        step="1"
                                        placeholder="Unrecorded"
                                        className="outline-none py-2.5 px-3.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition text-sm text-slate-800"
                                    />
                                    <span className="text-[11px] text-slate-400">Empty = unrecorded; 0 = out of stock</span>
                                </div>

                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-slate-700" htmlFor="low-stock-threshold">
                                        Low Stock Alert
                                    </label>
                                    <input
                                        onChange={(e) => setLowStockThreshold(e.target.value)}
                                        value={lowStockThreshold}
                                        id="low-stock-threshold"
                                        type="number"
                                        min="1"
                                        step="1"
                                        placeholder="5"
                                        className="outline-none py-2.5 px-3.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition text-sm text-slate-800"
                                    />
                                    <span className="text-[11px] text-slate-400">Warning threshold (Min: 1, Default: 5)</span>
                                </div>
                            </div>
                        </div>

                        {/* 4. Options & Variations (Colors) Card */}
                        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
                            <div>
                                <h2 className="text-sm sm:text-base font-bold text-slate-900">Color Variants (Optional)</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Specify available color choices for customers to select from.</p>
                            </div>

                            <div className="flex gap-2.5 max-w-md">
                                <input
                                    onChange={(e) => setColorInput(e.target.value)}
                                    onKeyDown={handleColorKeyDown}
                                    value={colorInput}
                                    id="product-colors"
                                    type="text"
                                    placeholder="e.g. Emerald, Matte Black, Amber"
                                    className="flex-1 outline-none py-2.5 px-3.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition text-sm text-slate-800 placeholder:text-slate-400"
                                />
                                <button
                                    type="button"
                                    onClick={handleAddColor}
                                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                                >
                                    Add Color
                                </button>
                            </div>

                            {availableColors.length > 0 && (
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {availableColors.map((color, index) => (
                                        <span
                                            key={index}
                                            className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-800 text-xs font-medium rounded-full border border-slate-200"
                                        >
                                            {color}
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveColor(index)}
                                                className="text-slate-400 hover:text-rose-600 font-bold transition cursor-pointer"
                                                title="Remove color"
                                            >
                                                &times;
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Submit Actions */}
                        <div className="flex items-center justify-end gap-3 pt-2">
                            <Link
                                to="/seller/product-list"
                                className="px-5 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                            >
                                Cancel
                            </Link>

                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`inline-flex items-center gap-2 px-7 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold rounded-xl shadow-xs hover:shadow transition-all ${
                                    isSubmitting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                                }`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Publishing Product...</span>
                                    </>
                                ) : (
                                    <>
                                        <PlusCircle className="w-4 h-4" />
                                        <span>Publish Product</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default AddProduct
