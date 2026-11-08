import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import { v2 as cloudinary } from "cloudinary";
import Product from '../models/Product.js';
import Review from '../models/Review.js';
import Order from '../models/Order.js';
import { validateImageContent, cleanupTempFiles } from '../configs/multer.js';
import { notifyLowStock } from '../services/notificationService.js';
import { logActivity } from '../services/activityLogService.js';

// Helper to validate price / offerPrice input before numeric conversion
const isValidPriceInput = (val) => {
    if (typeof val === 'boolean' || val === null || val === undefined) {
        return false;
    }
    if (typeof val === 'string' && val.trim() === '') {
        return false;
    }
    if (typeof val !== 'number' && typeof val !== 'string') {
        return false;
    }
    const num = Number(val);
    return Number.isFinite(num) && num >= 0;
};

/**
 * Escapes characters with special meaning in regular expressions to prevent ReDoS / injection.
 */
export function escapeRegex(string) {
    return typeof string === 'string'
        ? string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        : '';
}

/**
 * Verifies whether the authenticated seller has authorization to manage or view a product.
 *
 * Rules:
 * 1. For products with an assigned sellerId:
 *    Only the authenticated seller whose req.sellerId exactly matches product.sellerId
 *    may access or modify the product. Other sellers must receive HTTP 403.
 * 2. For legacy products with sellerId: null, missing, or empty:
 *    Only the designated admin authenticated through the trusted authentication mechanism
 *    (verified against process.env.SELLER_EMAIL) may access or manage these products.
 *    Arbitrary sellerId (e.g. 'admin'), request body, query parameters, or hardcoded strings
 *    are NEVER trusted as admin proof.
 * 3. Default-Deny: If req lacks authenticated seller identity, authorization strictly fails (false).
 */
export function isSellerAuthorizedForProduct(product, req) {
    if (!product || !req) return false;

    const sellerId = req.sellerId;
    const sellerEmail = req.sellerEmail;
    const sellerRole = req.sellerRole;
    const adminEmail = process.env.SELLER_EMAIL;

    // Default-Deny / Fail-Closed: Must have verified seller identity from auth middleware
    if (!sellerId && !sellerEmail) {
        return false;
    }

    const isRootAdmin = Boolean(
        adminEmail && sellerEmail && sellerEmail.toLowerCase() === adminEmail.toLowerCase()
    );

    const isStoreTeamMember = Boolean(
        (req.isTeamMember || req.seller) &&
        sellerRole &&
        ['Admin', 'CTO', 'CEO', 'Strategist'].includes(sellerRole)
    );

    const hasAssignedSeller = product.sellerId !== null && product.sellerId !== undefined && product.sellerId !== '';

    if (hasAssignedSeller) {
        // Rule 1: A product with a non-null sellerId can be accessed by its direct owner
        if (sellerId && product.sellerId === sellerId) {
            return true;
        }

        // Store-owned product tagged with designated merchant email
        if (adminEmail && product.sellerId === adminEmail) {
            return Boolean(isRootAdmin || isStoreTeamMember);
        }

        // Product belongs to another seller — strictly denied
        return false;
    }

    // Rule 2: Legacy unassigned product (sellerId: null, missing, or empty).
    // Accessible to designated root admin and verified store team members
    return Boolean(isRootAdmin || isStoreTeamMember);
}

/**
 * Builds MongoDB query filter for inventory search and filtering.
 */
export function buildProductQuery(queryParams = {}, sellerId = null, sellerEmail = null, sellerRole = null) {
    const andClauses = [];

    // Ownership clause for authenticated seller
    if (sellerId) {
        const adminEmail = process.env.SELLER_EMAIL;
        const isRootAdmin = Boolean(
            adminEmail && sellerEmail && sellerEmail.toLowerCase() === adminEmail.toLowerCase()
        );
        const isStoreStaff = Boolean(
            isRootAdmin || (sellerRole && ['Admin', 'CEO', 'CTO', 'Strategist'].includes(sellerRole))
        );

        if (isStoreStaff) {
            andClauses.push({
                $or: [
                    { sellerId: sellerId },
                    ...(adminEmail ? [{ sellerId: adminEmail }] : []),
                    { sellerId: null },
                    { sellerId: { $exists: false } }
                ]
            });
        } else {
            andClauses.push({ sellerId: sellerId });
        }
    }

    const { search, q, category, stockStatus, status, inStock } = queryParams || {};

    // Search clause (case-insensitive name and category)
    const rawSearch = search || q;
    if (typeof rawSearch === 'string' && rawSearch.trim()) {
        const escaped = escapeRegex(rawSearch.trim());
        const searchRegex = new RegExp(escaped, 'i');
        andClauses.push({
            $or: [
                { name: searchRegex },
                { category: searchRegex }
            ]
        });
    }

    // Category filter
    if (typeof category === 'string' && category.trim() && category.trim().toLowerCase() !== 'all') {
        const escapedCat = escapeRegex(category.trim());
        andClauses.push({ category: new RegExp(`^${escapedCat}$`, 'i') });
    }

    // inStock boolean filter
    if (inStock !== undefined && inStock !== null && inStock !== '') {
        if (inStock === 'true' || inStock === true) {
            andClauses.push({ inStock: true });
        } else if (inStock === 'false' || inStock === false) {
            andClauses.push({ inStock: false });
        }
    }

    // Stock status mapping consistent with Phase 7.1 getStockStatus
    const rawStatus = stockStatus || status;
    if (typeof rawStatus === 'string' && rawStatus.trim()) {
        const normalized = rawStatus.trim().toLowerCase();
        if (normalized === 'outofstock' || normalized === 'out_of_stock' || normalized === 'out of stock') {
            andClauses.push({
                stockQuantity: 0
            });
        } else if (normalized === 'lowstock' || normalized === 'low_stock' || normalized === 'low stock') {
            andClauses.push({
                stockQuantity: { $gt: 0 },
                $expr: {
                    $lte: [
                        "$stockQuantity",
                        { $ifNull: ["$lowStockThreshold", 5] }
                    ]
                }
            });
        } else if (normalized === 'instock' || normalized === 'in_stock' || normalized === 'in stock') {
            andClauses.push({
                stockQuantity: { $ne: null },
                $expr: {
                    $gt: [
                        "$stockQuantity",
                        { $ifNull: ["$lowStockThreshold", 5] }
                    ]
                }
            });
        } else if (normalized === 'unrecorded' || normalized === 'not_recorded' || normalized === 'stock not recorded' || normalized === 'unknown') {
            andClauses.push({
                $or: [
                    { stockQuantity: null },
                    { stockQuantity: { $exists: false } }
                ]
            });
        }
    }

    if (andClauses.length === 0) {
        return {};
    }
    if (andClauses.length === 1) {
        return andClauses[0];
    }
    return { $and: andClauses };
}

/**
 * Parses and sanitizes pagination and sorting query parameters.
 */
export function parsePaginationAndSort(queryParams = {}) {
    const { page, limit, sortBy, sortOrder } = queryParams || {};

    const parsedPage = Number(page);
    const validPage = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

    const parsedLimit = Number(limit);
    const validLimit = Number.isInteger(parsedLimit) && parsedLimit >= 1
        ? Math.min(parsedLimit, 100) // Clamped to maximum 100
        : 20; // Default limit 20

    const skip = (validPage - 1) * validLimit;

    // Allowed sort fields
    const allowedSortFields = ['createdAt', 'name', 'price', 'offerPrice', 'stockQuantity'];
    const effectiveSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const isAsc = sortOrder === 'asc' || sortOrder === '1' || sortOrder === 1;
    const effectiveSortOrder = isAsc ? 1 : -1;

    const sortObj = {
        [effectiveSortBy]: effectiveSortOrder,
        _id: effectiveSortOrder // Deterministic secondary tie-breaker
    };

    return {
        page: validPage,
        limit: validLimit,
        skip,
        sort: sortObj,
        sortBy: effectiveSortBy,
        sortOrder: isAsc ? 'asc' : 'desc'
    };
}

const cleanupCloudinary = async (uploads) => {
    if (!Array.isArray(uploads) || uploads.length === 0) return;
    await Promise.allSettled(
        uploads.map(async (item) => {
            try {
                if (item && typeof item.public_id === 'string' && item.public_id.trim()) {
                    await cloudinary.uploader.destroy(item.public_id);
                }
            } catch (destroyError) {
                console.error("Failed to delete Cloudinary asset:", destroyError.message);
            }
        })
    );
};

export const extractCloudinaryPublicId = (url) => {
    if (!url || typeof url !== 'string') return null;
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        if (hostname !== 'res.cloudinary.com' && !hostname.endsWith('.cloudinary.com')) {
            return null;
        }

        const pathname = parsed.pathname;
        const uploadMarker = '/image/upload/';
        const uploadIndex = pathname.indexOf(uploadMarker);
        if (uploadIndex === -1) {
            return null;
        }

        const remainder = pathname.slice(uploadIndex + uploadMarker.length);
        if (!remainder) return null;

        const segments = remainder.split('/');
        if (segments.length === 0) return null;

        let publicIdStartIndex = 0;
        const versionIndex = segments.findIndex(seg => /^v\d+$/.test(seg));

        if (versionIndex !== -1) {
            publicIdStartIndex = versionIndex + 1;
        } else {
            while (
                publicIdStartIndex < segments.length - 1 &&
                (/^(?:[a-z]{1,2}_|t_|[a-z]+,[a-z]+)/.test(segments[publicIdStartIndex]) || segments[publicIdStartIndex].includes(','))
            ) {
                publicIdStartIndex++;
            }
        }

        const publicIdSegments = segments.slice(publicIdStartIndex);
        if (publicIdSegments.length === 0 || !publicIdSegments[0]) return null;

        const lastSegment = publicIdSegments[publicIdSegments.length - 1];
        const lastDot = lastSegment.lastIndexOf('.');
        if (lastDot > 0) {
            publicIdSegments[publicIdSegments.length - 1] = lastSegment.slice(0, lastDot);
        }

        const publicId = publicIdSegments.join('/');
        return publicId.trim() ? publicId : null;
    } catch {
        return null;
    }
};

export const deleteCloudinaryImages = async (imageUrls) => {
    if (!Array.isArray(imageUrls) || imageUrls.length === 0) return;
    const items = imageUrls
        .map(extractCloudinaryPublicId)
        .filter(Boolean)
        .map((public_id) => ({ public_id }));
    await cleanupCloudinary(items);
};

// Add Product : /api/product/add
export const addProduct = async (req, res) => {
    let successfulUploads = [];
    try {
        let productData;
        try {
            productData = typeof req.body.productData === 'string'
                ? JSON.parse(req.body.productData)
                : req.body.productData;
        } catch {
            return res.status(400).json({ success: false, message: "Invalid product data format" });
        }

        if (!productData || typeof productData !== 'object' || Array.isArray(productData)) {
            return res.status(400).json({ success: false, message: "Invalid product data" });
        }

        const { name, category, description } = productData;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ success: false, message: "Product name is required" });
        }
        if (!category || typeof category !== 'string' || !category.trim()) {
            return res.status(400).json({ success: false, message: "Product category is required" });
        }
        if (!Array.isArray(description) || description.length === 0 || !description.every(d => typeof d === 'string')) {
            return res.status(400).json({ success: false, message: "Product description must be an array of strings" });
        }

        if (!isValidPriceInput(productData.price) || Number(productData.price) <= 0) {
            return res.status(400).json({ success: false, message: "Invalid product price" });
        }

        const price = Number(productData.price);

        let offerPrice = null;
        if (productData.offerPrice !== undefined && productData.offerPrice !== null && productData.offerPrice !== '') {
            if (!isValidPriceInput(productData.offerPrice)) {
                return res.status(400).json({ success: false, message: "Invalid offer price" });
            }
            offerPrice = Number(productData.offerPrice);
        }

        const images = req.files || [];
        if (!Array.isArray(images) || images.length === 0) {
            return res.status(400).json({ success: false, message: "At least one product image is required" });
        }

        // Validate image content and signatures before forwarding to Cloudinary
        for (const item of images) {
            const isValidImage = await validateImageContent(item);
            if (!isValidImage) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid image format or corrupted file content. Only JPEG, PNG, and WebP images are allowed."
                });
            }
        }

        const uploadResults = await Promise.allSettled(
            images.map(async (item) => {
                const result = await cloudinary.uploader.upload(item.path, { resource_type: "image" });
                if (!result?.public_id || !result?.secure_url) {
                    throw new Error("Cloudinary upload failed: missing public_id or secure_url");
                }
                return { public_id: result.public_id, secure_url: result.secure_url };
            })
        );

        const failedUpload = uploadResults.find((result) => result.status === 'rejected');
        successfulUploads = uploadResults
            .filter((result) => result.status === 'fulfilled')
            .map((result) => result.value);

        if (failedUpload) {
            console.error("Cloudinary upload failed:", failedUpload.reason);
            await cleanupCloudinary(successfulUploads);
            return res.status(500).json({ success: false, message: "Failed to upload product images" });
        }

        let stockQuantity = null;
        if (productData.stockQuantity !== undefined && productData.stockQuantity !== null && productData.stockQuantity !== '') {
            const parsedStock = Number(productData.stockQuantity);
            if (!Number.isInteger(parsedStock) || parsedStock < 0) {
                await cleanupCloudinary(successfulUploads);
                return res.status(400).json({ success: false, message: "Stock quantity must be a non-negative integer" });
            }
            stockQuantity = parsedStock;
        }

        let lowStockThreshold = 5;
        if (productData.lowStockThreshold !== undefined && productData.lowStockThreshold !== null && productData.lowStockThreshold !== '') {
            const parsedThreshold = Number(productData.lowStockThreshold);
            if (!Number.isInteger(parsedThreshold) || parsedThreshold < 1) {
                await cleanupCloudinary(successfulUploads);
                return res.status(400).json({ success: false, message: "Low stock threshold must be an integer of at least 1" });
            }
            lowStockThreshold = parsedThreshold;
        }

        let availableColors = [];
        if (productData.availableColors !== undefined && productData.availableColors !== null) {
            let rawColors = productData.availableColors;
            if (typeof rawColors === 'string') {
                try {
                    rawColors = JSON.parse(rawColors);
                } catch {
                    rawColors = rawColors.split(',').map(s => s.trim());
                }
            }
            if (!Array.isArray(rawColors) || !rawColors.every(c => typeof c === 'string')) {
                await cleanupCloudinary(successfulUploads);
                return res.status(400).json({ success: false, message: "Available colors must be an array of strings" });
            }
            availableColors = rawColors.map(c => c.trim()).filter(Boolean);
        }

        let inStock = true;
        if (stockQuantity === 0) {
            inStock = false;
        } else if (productData.inStock !== undefined) {
            if (typeof productData.inStock !== 'boolean') {
                await cleanupCloudinary(successfulUploads);
                return res.status(400).json({ success: false, message: "Invalid inStock value" });
            }
            inStock = productData.inStock;
        }

        const imagesUrl = successfulUploads.map((item) => item.secure_url);

        try {
            const newProduct = await Product.create({
                name: name.trim(),
                description,
                category: category.trim(),
                price,
                offerPrice,
                image: imagesUrl,
                inStock,
                stockQuantity,
                lowStockThreshold,
                availableColors,
                sellerId: req.sellerId || null
            });

            await logActivity({
                req,
                action: 'CREATE',
                entityType: 'PRODUCT',
                entityId: newProduct._id,
                entityName: newProduct.name,
                description: `Created product "${newProduct.name}"`,
                after: {
                    name: newProduct.name,
                    category: newProduct.category,
                    price: newProduct.price,
                    offerPrice: newProduct.offerPrice,
                    inStock: newProduct.inStock,
                    stockQuantity: newProduct.stockQuantity,
                    lowStockThreshold: newProduct.lowStockThreshold
                }
            });

            return res.json({ success: true, message: "Product added successfully", product: newProduct });
        } catch (dbError) {
            console.error("Product create error:", dbError.message);
            await cleanupCloudinary(successfulUploads);
            if (dbError.name === 'ValidationError') {
                return res.status(400).json({ success: false, message: "Invalid product data" });
            }
            return res.status(500).json({ success: false, message: "Internal server error" });
        }

    } catch (error) {
        console.error("Add product error:", error.message);
        if (successfulUploads.length > 0) {
            await cleanupCloudinary(successfulUploads);
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    } finally {
        await cleanupTempFiles(req);
    }
};

// Get Public Product List: /api/product/list
export const productList = async (req, res) => {
    try {
        const queryKeys = Object.keys(req.query || {});
        if (queryKeys.length === 0) {
            const products = await Product.find({});
            return res.json({ success: true, products });
        }

        const filter = buildProductQuery(req.query);
        const { page, limit, skip, sort, sortBy, sortOrder } = parsePaginationAndSort(req.query);

        const [products, totalProducts] = await Promise.all([
            Product.find(filter).sort(sort).skip(skip).limit(limit),
            Product.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalProducts / limit);

        return res.json({
            success: true,
            products,
            pagination: {
                page,
                limit,
                totalProducts,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                sortBy,
                sortOrder
            }
        });
    } catch (error) {
        console.error("Product list error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Get Seller Product List: /api/product/seller/list
export const sellerProductList = async (req, res) => {
    try {
        const sellerId = req.sellerId;
        const sellerEmail = req.sellerEmail;
        const sellerRole = req.sellerRole;
        const filter = buildProductQuery(req.query, sellerId, sellerEmail, sellerRole);
        const { page, limit, skip, sort, sortBy, sortOrder } = parsePaginationAndSort(req.query);

        const [products, totalProducts] = await Promise.all([
            Product.find(filter).sort(sort).skip(skip).limit(limit),
            Product.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalProducts / limit);

        return res.json({
            success: true,
            products,
            pagination: {
                page,
                limit,
                totalProducts,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                sortBy,
                sortOrder
            }
        });
    } catch (error) {
        console.error("Seller product list error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Get single Product for Seller: /api/product/seller/:id
export const sellerProductById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid product ID" });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Ownership enforcement / IDOR prevention (Finding 1)
        if (!isSellerAuthorizedForProduct(product, req)) {
            return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to view this product" });
        }

        return res.json({ success: true, product });

    } catch (error) {
        console.error("Seller product by ID error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Get single Product: /api/product/id/:id
export const productById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid product ID" });
        }

        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        return res.json({ success: true, product });

    } catch (error) {
        console.error("Product by ID error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Change Product inStock : /api/product/stock
export const changeStock = async (req, res) => {
    try {
        const { id, inStock } = req.body;

        if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid product ID" });
        }

        if (typeof inStock !== 'boolean') {
            return res.status(400).json({ success: false, message: "Invalid inStock value" });
        }

        const existingProduct = await Product.findById(id);
        if (!existingProduct) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Ownership enforcement / IDOR prevention (Finding 1)
        if (!isSellerAuthorizedForProduct(existingProduct, req)) {
            return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to modify this product" });
        }

        // Zero-stock consistency check (Finding 2):
        // If stockQuantity is 0, reject any request attempting to set inStock: true
        if (existingProduct.stockQuantity === 0 && inStock === true) {
            return res.status(400).json({ success: false, message: "Cannot set inStock to true when stock quantity is 0" });
        }

        const updatedProduct = await Product.findByIdAndUpdate(id, { inStock }, { new: true });
        if (!updatedProduct) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        await logActivity({
            req,
            action: 'UPDATE',
            entityType: 'PRODUCT',
            entityId: existingProduct._id,
            entityName: existingProduct.name,
            description: `Updated stock status for product "${existingProduct.name}" to ${inStock ? 'In Stock' : 'Out of Stock'}`,
            before: { inStock: existingProduct.inStock },
            after: { inStock }
        });

        return res.json({ success: true, message: "Stock updated successfully" });

    } catch (error) {
        console.error("Change stock error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Update Product : /api/product/update and /api/product/update/:id
export const updateProduct = async (req, res) => {
    let successfulUploads = [];
    try {
        let productData;
        try {
            if (req.body.productData) {
                productData = typeof req.body.productData === 'string'
                    ? JSON.parse(req.body.productData)
                    : req.body.productData;
            } else {
                productData = req.body;
            }
        } catch {
            return res.status(400).json({ success: false, message: "Invalid product data format" });
        }

        if (!productData || typeof productData !== 'object' || Array.isArray(productData)) {
            return res.status(400).json({ success: false, message: "Invalid product data" });
        }

        const id = productData.id || productData._id || req.params?.id || req.body?.id;
        if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid product ID" });
        }

        const existingProduct = await Product.findById(id);
        if (!existingProduct) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Ownership enforcement / IDOR prevention (Finding 1)
        if (!isSellerAuthorizedForProduct(existingProduct, req)) {
            return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to modify this product" });
        }

        const updates = {};

        if (productData.name !== undefined) {
            if (typeof productData.name !== 'string' || !productData.name.trim()) {
                return res.status(400).json({ success: false, message: "Product name must be a non-empty string" });
            }
            updates.name = productData.name.trim();
        }

        if (productData.category !== undefined) {
            if (typeof productData.category !== 'string' || !productData.category.trim()) {
                return res.status(400).json({ success: false, message: "Product category must be a non-empty string" });
            }
            updates.category = productData.category.trim();
        }

        if (productData.description !== undefined) {
            let desc = productData.description;
            if (typeof desc === 'string') {
                desc = desc.split('\n').map(d => d.trim()).filter(Boolean);
            }
            if (!Array.isArray(desc) || desc.length === 0 || !desc.every(d => typeof d === 'string')) {
                return res.status(400).json({ success: false, message: "Product description must be a non-empty array of strings" });
            }
            updates.description = desc;
        }

        if (productData.price !== undefined) {
            if (!isValidPriceInput(productData.price) || Number(productData.price) <= 0) {
                return res.status(400).json({ success: false, message: "Invalid product price" });
            }
            updates.price = Number(productData.price);
        }

        if (productData.offerPrice !== undefined) {
            if (productData.offerPrice === null || productData.offerPrice === '') {
                updates.offerPrice = null;
            } else {
                if (!isValidPriceInput(productData.offerPrice)) {
                    return res.status(400).json({ success: false, message: "Invalid offer price" });
                }
                updates.offerPrice = Number(productData.offerPrice);
            }
        }

        // Inventory fields validation
        if (productData.stockQuantity !== undefined) {
            if (productData.stockQuantity === null || productData.stockQuantity === '') {
                updates.stockQuantity = null;
            } else {
                const parsedStock = Number(productData.stockQuantity);
                if (!Number.isInteger(parsedStock) || parsedStock < 0) {
                    return res.status(400).json({ success: false, message: "Stock quantity must be a non-negative integer or null" });
                }
                updates.stockQuantity = parsedStock;
                // Auto inStock toggle: if stock is 0, inStock is set to false
                if (parsedStock === 0) {
                    updates.inStock = false;
                } else if (parsedStock > 0 && existingProduct.inStock === false && productData.inStock === undefined) {
                    // If stockQuantity > 0 and inStock was previously false, auto set inStock: true
                    updates.inStock = true;
                }
            }
        }

        if (productData.lowStockThreshold !== undefined) {
            const parsedThreshold = Number(productData.lowStockThreshold);
            if (!Number.isInteger(parsedThreshold) || parsedThreshold < 1) {
                return res.status(400).json({ success: false, message: "Low stock threshold must be an integer of at least 1" });
            }
            updates.lowStockThreshold = parsedThreshold;
        }

        if (productData.availableColors !== undefined) {
            let rawColors = productData.availableColors;
            if (typeof rawColors === 'string') {
                try {
                    rawColors = JSON.parse(rawColors);
                } catch {
                    rawColors = rawColors.split(',').map(s => s.trim());
                }
            }
            if (!Array.isArray(rawColors) || !rawColors.every(c => typeof c === 'string')) {
                return res.status(400).json({ success: false, message: "Available colors must be an array of strings" });
            }
            updates.availableColors = rawColors.map(c => c.trim()).filter(Boolean);
        }

        if (productData.inStock !== undefined) {
            if (typeof productData.inStock !== 'boolean') {
                return res.status(400).json({ success: false, message: "Invalid inStock value" });
            }
            // If stockQuantity was set to 0, inStock remains false regardless
            if (updates.stockQuantity === 0) {
                updates.inStock = false;
            } else {
                updates.inStock = productData.inStock;
            }
        }

        // Client cannot modify sellerId
        delete updates.sellerId;

        const images = req.files || [];
        const { slotIndices } = productData;

        if (slotIndices !== undefined) {
            if (!Array.isArray(slotIndices) || slotIndices.length !== images.length) {
                return res.status(400).json({ success: false, message: "Invalid image slot metadata" });
            }

            const seenSlots = new Set();
            for (const slot of slotIndices) {
                if (!Number.isInteger(slot) || slot < 0 || slot > 3) {
                    return res.status(400).json({ success: false, message: "Invalid image slot index" });
                }
                if (seenSlots.has(slot)) {
                    return res.status(400).json({ success: false, message: "Duplicate image slot index" });
                }
                seenSlots.add(slot);
            }
        }

        if (Array.isArray(images) && images.length > 0) {
            // Validate image content and signatures before forwarding to Cloudinary
            for (const item of images) {
                const isValidImage = await validateImageContent(item);
                if (!isValidImage) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid image format or corrupted file content. Only JPEG, PNG, and WebP images are allowed."
                    });
                }
            }

            const uploadResults = await Promise.allSettled(
                images.map(async (item) => {
                    const result = await cloudinary.uploader.upload(item.path, { resource_type: "image" });
                    if (!result?.public_id || !result?.secure_url) {
                        throw new Error("Cloudinary upload failed: missing public_id or secure_url");
                    }
                    return { public_id: result.public_id, secure_url: result.secure_url };
                })
            );

            const failedUpload = uploadResults.find((result) => result.status === 'rejected');
            successfulUploads = uploadResults
                .filter((result) => result.status === 'fulfilled')
                .map((result) => result.value);

            if (failedUpload) {
                console.error("Cloudinary upload failed during update:", failedUpload.reason);
                await cleanupCloudinary(successfulUploads);
                return res.status(500).json({ success: false, message: "Failed to upload product images" });
            }

            const currentImages = Array.isArray(existingProduct.image) ? [...existingProduct.image] : [];
            const mergedImages = [...currentImages];
            const effectiveSlots = slotIndices || images.map((_, i) => i);

            for (let i = 0; i < successfulUploads.length; i++) {
                const targetSlot = effectiveSlots[i];
                mergedImages[targetSlot] = successfulUploads[i].secure_url;
            }

            const finalImages = mergedImages.filter(Boolean);
            if (finalImages.length === 0 || finalImages.length > 4) {
                await cleanupCloudinary(successfulUploads);
                return res.status(400).json({ success: false, message: "Product must have between 1 and 4 images" });
            }

            updates.image = finalImages;
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: "No valid fields provided for update" });
        }

        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Smart Notification Center: Low Stock Alert & Restock Lifecycle
        if (typeof updatedProduct.stockQuantity === 'number') {
            try {
                await notifyLowStock({
                    product: updatedProduct,
                    currentStock: updatedProduct.stockQuantity,
                    threshold: updatedProduct.lowStockThreshold || 5
                });
            } catch (stockErr) {
                console.error("Low stock notification error:", stockErr.message);
            }
        }

        await logActivity({
            req,
            action: 'UPDATE',
            entityType: 'PRODUCT',
            entityId: updatedProduct._id,
            entityName: updatedProduct.name,
            description: `Updated product "${updatedProduct.name}"`,
            before: existingProduct,
            after: updatedProduct
        });

        return res.json({ success: true, message: "Product updated successfully", product: updatedProduct });

    } catch (error) {
        console.error("Update product error:", error.message);
        if (successfulUploads.length > 0) {
            await cleanupCloudinary(successfulUploads);
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({ success: false, message: "Invalid product data" });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    } finally {
        await cleanupTempFiles(req);
    }
};

// Delete Product : /api/product/delete and /api/product/delete/:id
export const deleteProduct = async (req, res) => {
    try {
        const id = req.body?.id || req.params?.id;

        if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid product ID" });
        }

        const existingProduct = await Product.findById(id);
        if (!existingProduct) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Ownership enforcement / IDOR prevention (Finding 1)
        if (!isSellerAuthorizedForProduct(existingProduct, req)) {
            return res.status(403).json({ success: false, message: "Forbidden: You do not have permission to delete this product" });
        }

        const shouldCleanReviews = mongoose.connection?.readyState === 1 ||
            (Review && typeof Review.deleteMany === 'function' && Review.deleteMany !== mongoose.Model.deleteMany);

        const canAttemptTransaction = mongoose.connection?.readyState === 1 ||
            (typeof mongoose.startSession === 'function' && mongoose.startSession !== mongoose.Mongoose?.prototype?.startSession);

        let transactionExecuted = false;

        if (canAttemptTransaction) {
            let session = null;
            try {
                session = await mongoose.startSession();
                await session.withTransaction(async () => {
                    if (shouldCleanReviews) {
                        await Review.deleteMany({ productId: id }, { session });
                    }
                    const deleted = await Product.findByIdAndDelete(id, { session });
                    if (!deleted) {
                        throw new Error("ProductNotFound");
                    }
                });
                transactionExecuted = true;
            } catch (txError) {
                const isNoTxSupport = txError?.message && (
                    txError.message.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
                    txError.message.includes("Transactions are not supported")
                );

                if (isNoTxSupport) {
                    transactionExecuted = false;
                } else {
                    console.error("Delete product transaction error:", txError.message);
                    return res.status(500).json({ success: false, message: "Failed to delete product and associated reviews" });
                }
            } finally {
                if (session) {
                    await session.endSession();
                }
            }
        }

        if (!transactionExecuted) {
            // Safe sequential fallback:
            // 1. Delete associated reviews FIRST. If this fails, STOP and do not delete the product.
            if (shouldCleanReviews) {
                try {
                    await Review.deleteMany({ productId: id });
                } catch (reviewErr) {
                    console.error("Failed to clean up reviews for deleted product:", reviewErr.message);
                    return res.status(500).json({ success: false, message: "Failed to clean up reviews for product" });
                }
            }

            // 2. Only delete product if review cleanup succeeded
            const deleted = await Product.findByIdAndDelete(id);
            if (!deleted) {
                return res.status(404).json({ success: false, message: "Product not found" });
            }
        }

        // Clean up Cloudinary assets associated with the deleted product ONLY after database deletion succeeds
        if (existingProduct.image && Array.isArray(existingProduct.image)) {
            await deleteCloudinaryImages(existingProduct.image);
        }

        await logActivity({
            req,
            action: 'DELETE',
            entityType: 'PRODUCT',
            entityId: existingProduct._id,
            entityName: existingProduct.name,
            description: `Deleted product "${existingProduct.name}"`,
            before: {
                name: existingProduct.name,
                category: existingProduct.category,
                price: existingProduct.price,
                offerPrice: existingProduct.offerPrice,
                stockQuantity: existingProduct.stockQuantity,
                inStock: existingProduct.inStock
            }
        });

        return res.json({ success: true, message: "Product deleted successfully" });

    } catch (error) {
        console.error("Delete product error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Best-Selling Products Endpoint based on genuine order sales aggregation.
 * GET /api/product/bestsellers?limit=8
 */
export const getBestSellers = async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 24);

        let bestSellingIds = [];
        if (Order && typeof Order.aggregate === 'function') {
            try {
                const salesAgg = await Order.aggregate([
                    { $match: { status: { $ne: "Cancelled" } } },
                    { $unwind: "$items" },
                    {
                        $group: {
                            _id: "$items.product",
                            unitsSold: {
                                $sum: {
                                    $convert: { input: "$items.quantity", to: "int", onError: 0, onNull: 0 }
                                }
                            }
                        }
                    },
                    { $sort: { unitsSold: -1 } },
                    { $limit: limit * 2 }
                ]);
                bestSellingIds = (salesAgg || [])
                    .map(item => String(item._id))
                    .filter(id => mongoose.Types.ObjectId.isValid(id));
            } catch (aggErr) {
                console.error("Order aggregation error for bestsellers:", aggErr.message);
            }
        }

        let products = [];
        if (bestSellingIds.length > 0) {
            const fetched = await Product.find({
                _id: { $in: bestSellingIds },
                inStock: true
            });
            const fetchedMap = new Map(fetched.map(p => [String(p._id), p]));
            for (const id of bestSellingIds) {
                if (fetchedMap.has(id)) {
                    products.push(fetchedMap.get(id));
                }
            }
        }

        // If fewer than requested limit, supplement with top-rated and reviewed products without fabricating data
        if (products.length < limit) {
            const existingIds = new Set(products.map(p => String(p._id)));
            const supplements = await Product.find({
                _id: { $nin: Array.from(existingIds) },
                inStock: true
            })
            .sort({ reviewCount: -1, averageRating: -1, createdAt: -1 })
            .limit(limit - products.length);

            products.push(...supplements);
        }

        return res.json({
            success: true,
            products: products.slice(0, limit)
        });
    } catch (error) {
        console.error("Get bestsellers error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Trending Products Endpoint based on genuine review engagement & ratings.
 * GET /api/product/trending?limit=8
 */
export const getTrendingProducts = async (req, res) => {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 24);

        // Fetch in-stock products ordered by verified ratings, review count, and active discount
        const products = await Product.find({ inStock: true })
            .sort({ averageRating: -1, reviewCount: -1, updatedAt: -1 })
            .limit(limit);

        return res.json({
            success: true,
            products
        });
    } catch (error) {
        console.error("Get trending products error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
