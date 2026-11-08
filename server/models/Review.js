import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "product",
        required: true,
        index: true
    },
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "order",
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        validate: {
            validator: Number.isInteger,
            message: "Rating must be an integer between 1 and 5"
        }
    },
    title: {
        type: String,
        trim: true,
        maxlength: 100,
        default: ""
    },
    comment: {
        type: String,
        required: true,
        trim: true,
        minlength: 5,
        maxlength: 1000
    },
    isVerifiedPurchase: {
        type: Boolean,
        default: true
    },
    moderationStatus: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "pending",
        index: true
    },
    moderatedBy: {
        type: String,
        default: null
    },
    moderatedAt: {
        type: Date,
        default: null
    },
    moderationNote: {
        type: String,
        trim: true,
        maxlength: 500,
        default: ""
    }
}, { timestamps: true });

// Enforce single review per customer per product
reviewSchema.index({ productId: 1, customerId: 1 }, { unique: true });

// Optimize public review queries by product and moderation status
reviewSchema.index({ productId: 1, moderationStatus: 1, createdAt: -1 });

// Optimize seller moderation inbox queries
reviewSchema.index({ moderationStatus: 1, createdAt: -1 });

const Review = mongoose.models.review || mongoose.model("review", reviewSchema);

export default Review;
