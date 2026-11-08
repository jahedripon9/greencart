import mongoose from "mongoose";

const refundSchema = new mongoose.Schema({
    refundNumber: {
        type: String,
        unique: true,
        trim: true,
        uppercase: true,
        match: /^REF-[0-9A-Z]{6,10}$/
    },
    returnRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ReturnRequest",
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
    userId: {
        type: String,
        ref: "user",
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    refundMethod: {
        type: String,
        enum: [
            "Original Payment",
            "COD Cash Refund",
            "Store Credit",
            "Bank Transfer",
            "bKash/Nagad MFS"
        ],
        default: "Original Payment"
    },
    status: {
        type: String,
        enum: ["Pending", "Processing", "Completed", "Failed"],
        default: "Pending",
        index: true
    },
    transactionReference: {
        type: String,
        trim: true,
        default: null
    },
    processedBy: {
        type: String,
        default: null
    },
    processedByRole: {
        type: String,
        default: null
    },
    processedAt: {
        type: Date,
        default: null
    },
    notes: {
        type: String,
        default: ""
    },
    history: [{
        status: { type: String, required: true },
        changedBy: { type: String, required: true },
        note: { type: String, default: "" },
        timestamp: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true
});

refundSchema.index({ userId: 1, createdAt: -1 });

const Refund = mongoose.models.Refund || mongoose.model("Refund", refundSchema);

export default Refund;
