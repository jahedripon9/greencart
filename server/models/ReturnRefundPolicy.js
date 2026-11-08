import mongoose from "mongoose";

const returnRefundPolicySchema = new mongoose.Schema({
    returnWindowDays: {
        type: Number,
        default: 7,
        min: 1,
        max: 90,
        required: true
    },
    eligibleReasons: {
        type: [String],
        default: [
            "Damaged or defective item received",
            "Wrong product delivered",
            "Expired product received",
            "Missing items from package",
            "Quality not as described",
            "Package tampered or broken seal"
        ]
    },
    nonReturnableCategories: {
        type: [String],
        default: [
            "Fresh Vegetables",
            "Fresh Fruits",
            "Dairy & Chilled Items",
            "Bakery & Bread",
            "Opened Hygiene & Personal Care"
        ]
    },
    conditionRequirements: {
        type: [String],
        default: [
            "Item must be unused and in original retail packaging",
            "All product tags, seals, barcodes, and accessories must remain intact",
            "Original GreenCart purchase invoice or order confirmation must be presented",
            "Photos of damaged or incorrect items must be provided with the request"
        ]
    },
    shippingRules: {
        type: String,
        default: "Free return pickup is arranged by GreenCart delivery agents within 24–48 hours of return approval across Dhaka and major delivery zones."
    },
    refundProcessingEstimate: {
        type: String,
        default: "Refunds are processed within 3–5 business days following physical inspection and approval at our fulfillment center."
    },
    policyContent: {
        type: String,
        default: "GreenCart is committed to ensuring customer satisfaction with fresh and authentic groceries. If you receive an item that is damaged, defective, or incorrect, you may request a return within our return window. Our delivery team will verify the condition and process your refund promptly to your original payment method or as store credit."
    },
    cancellationRules: {
        type: String,
        default: "Orders can be cancelled before packing or dispatch without penalty. Once an order is 'Out for Delivery', items must be accepted and follow standard return inspection procedures."
    },
    contactInfo: {
        email: { type: String, default: "support@greencart.com" },
        phone: { type: String, default: "+880 1700-000000" },
        hours: { type: String, default: "8:00 AM - 10:00 PM (Everyday)" },
        address: { type: String, default: "GreenCart Central Logistics Hub, Tejgaon, Dhaka, Bangladesh" }
    },
    effectiveDate: {
        type: Date,
        default: Date.now
    },
    isPublished: {
        type: Boolean,
        default: true
    },
    updatedBy: {
        type: String,
        default: "System Admin"
    },
    lastReviewedBy: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

/**
 * Singleton pattern helper to retrieve active policy or create editable initial default.
 */
returnRefundPolicySchema.statics.getOrInitializePolicy = async function () {
    let policy = await this.findOne();
    if (!policy) {
        policy = await this.create({
            updatedBy: "System Default Initializer"
        });
    }
    return policy;
};

const ReturnRefundPolicy = mongoose.models.ReturnRefundPolicy || mongoose.model("ReturnRefundPolicy", returnRefundPolicySchema);

export default ReturnRefundPolicy;
