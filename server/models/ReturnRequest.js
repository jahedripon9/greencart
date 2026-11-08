import mongoose from "mongoose";

const returnItemSchema = new mongoose.Schema({
    productId: {
        type: String,
        required: true,
        trim: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        default: ""
    },
    image: {
        type: String,
        default: ""
    }
}, { _id: false });

const returnRequestSchema = new mongoose.Schema({
    returnNumber: {
        type: String,
        unique: true,
        trim: true,
        uppercase: true,
        match: /^RET-[0-9A-Z]{6,10}$/
    },
    userId: {
        type: String,
        ref: "user",
        required: true,
        index: true
    },
    orderId: {
        type: String,
        ref: "order",
        required: true,
        index: true
    },
    orderNumber: {
        type: String,
        trim: true
    },
    orderDate: {
        type: Date
    },
    items: {
        type: [returnItemSchema],
        required: true,
        validate: {
            validator: function (val) {
                return Array.isArray(val) && val.length > 0;
            },
            message: "At least one item must be selected for return"
        }
    },
    customerNotes: {
        type: String,
        default: ""
    },
    images: {
        type: [String],
        default: []
    },
    returnMethod: {
        type: String,
        enum: ["Pickup", "Drop-off"],
        default: "Pickup"
    },
    pickupAddress: {
        firstName: { type: String, default: "" },
        lastName: { type: String, default: "" },
        street: { type: String, default: "" },
        city: { type: String, default: "" },
        state: { type: String, default: "" },
        zipCode: { type: String, default: "" },
        country: { type: String, default: "" },
        phone: { type: String, default: "" }
    },
    status: {
        type: String,
        enum: [
            "Pending",
            "Approved",
            "Rejected",
            "Item Received",
            "Refund Processing",
            "Completed",
            "Cancelled"
        ],
        default: "Pending",
        index: true
    },
    rejectionReason: {
        type: String,
        default: null
    },
    adminRemarks: {
        type: String,
        default: ""
    },
    statusHistory: [{
        status: { type: String, required: true },
        changedBy: { type: String, required: true },
        changedByRole: { type: String, default: "Customer" },
        note: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now }
    }],
    refundId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Refund",
        default: null
    },
    stockRestored: {
        type: Boolean,
        default: false
    },
    totalRefundAmount: {
        type: Number,
        required: true,
        min: 0
    }
}, {
    timestamps: true
});

returnRequestSchema.index({ userId: 1, createdAt: -1 });
returnRequestSchema.index({ orderId: 1, "items.productId": 1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });

const ReturnRequest = mongoose.models.ReturnRequest || mongoose.model("ReturnRequest", returnRequestSchema);

export default ReturnRequest;
