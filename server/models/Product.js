import mongoose from "mongoose";

/**
 * Calculates stock status based on stockQuantity and lowStockThreshold.
 *
 * Confirmed Stock Status Rules:
 * - null or missing (undefined): 'Stock Not Recorded' (Never classify unknown stock as zero)
 * - 0: 'Out of Stock'
 * - 1 to lowStockThreshold (default 5): 'Low Stock'
 * - Greater than lowStockThreshold: 'In Stock'
 */
export const getStockStatus = (stockQuantity, lowStockThreshold = 5) => {
    if (stockQuantity === null || stockQuantity === undefined) {
        return 'Stock Not Recorded';
    }
    if (stockQuantity === 0) {
        return 'Out of Stock';
    }
    const threshold = (typeof lowStockThreshold === 'number' && Number.isInteger(lowStockThreshold) && lowStockThreshold >= 1)
        ? lowStockThreshold
        : 5;
    if (stockQuantity <= threshold) {
        return 'Low Stock';
    }
    return 'In Stock';
};

/**
 * Calculates effective selling price based on Regular Price and Offer Price.
 *
 * Rules:
 * - price is Regular Price and is mandatory (price > 0).
 * - offerPrice is optional.
 * - If offerPrice is empty, null, undefined, zero, equal to or greater than price, effective price is price.
 * - If offerPrice is greater than 0 and strictly less than price, effective price is offerPrice.
 */
export const getEffectivePrice = (price, offerPrice) => {
    let regularPrice = typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null;
    if (regularPrice === null && typeof offerPrice === 'number' && Number.isFinite(offerPrice) && offerPrice > 0) {
        regularPrice = offerPrice;
    }
    if (regularPrice === null) return 0;
    const hasValidDiscount = typeof offerPrice === 'number' && Number.isFinite(offerPrice) && offerPrice > 0 && offerPrice < regularPrice;
    return hasValidDiscount ? offerPrice : regularPrice;
};

const productSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: Array, required: true },
    price: { type: Number, required: true },
    offerPrice: { type: Number, default: null },
    image: { type: Array, required: true },
    category: { type: String, required: true },
    inStock: { type: Boolean, default: true },
    stockQuantity: {
        type: Number,
        default: null,
        validate: {
            validator: function (val) {
                return val === null || val === undefined || (Number.isInteger(val) && val >= 0);
            },
            message: '{VALUE} is not a valid non-negative integer stock quantity'
        }
    },
    lowStockThreshold: {
        type: Number,
        default: 5,
        min: [1, 'Low stock threshold must be at least 1'],
        validate: {
            validator: function (val) {
                return val === null || val === undefined || (Number.isInteger(val) && val >= 1);
            },
            message: '{VALUE} is not a valid positive integer threshold'
        }
    },
    availableColors: {
        type: [{
            type: String,
            trim: true
        }],
        default: []
    },
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0, min: 0 },
    sellerId: { type: String, default: null, index: true }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

productSchema.virtual('stockStatus').get(function () {
    return getStockStatus(this.stockQuantity, this.lowStockThreshold);
});

productSchema.virtual('effectivePrice').get(function () {
    return getEffectivePrice(this.price, this.offerPrice);
});

productSchema.methods.computeStockStatus = function () {
    return getStockStatus(this.stockQuantity, this.lowStockThreshold);
};

const Product = mongoose.models.product || mongoose.model("product", productSchema);

export default Product;
