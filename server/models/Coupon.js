import mongoose from "mongoose";

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, "Coupon code is required"],
        trim: true,
        uppercase: true,
        minlength: [3, "Coupon code must be at least 3 characters"],
        maxlength: [25, "Coupon code cannot exceed 25 characters"]
    },
    discountType: {
        type: String,
        required: [true, "Discount type is required"],
        enum: {
            values: ['percentage', 'fixed'],
            message: "Discount type must be either 'percentage' or 'fixed'"
        }
    },
    discountValue: {
        type: Number,
        required: [true, "Discount value is required"],
        min: [0.01, "Discount value must be greater than 0"]
    },
    minOrderAmount: {
        type: Number,
        default: 0,
        min: [0, "Minimum order amount cannot be negative"]
    },
    expiryDate: {
        type: Date,
        required: [true, "Expiry date is required"]
    },
    usageLimit: {
        type: Number,
        required: [true, "Usage limit is required"],
        min: [1, "Usage limit must be at least 1"]
    },
    usedCount: {
        type: Number,
        default: 0,
        min: [0, "Used count cannot be negative"]
    },
    active: {
        type: Boolean,
        default: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: [200, "Description cannot exceed 200 characters"],
        default: ""
    }
}, { timestamps: true });

// Case-insensitive unique index on coupon code
couponSchema.index({ code: 1 }, { unique: true });
couponSchema.index({ active: 1, expiryDate: 1 });

const Coupon = mongoose.models.coupon || mongoose.model("coupon", couponSchema);

export default Coupon;
