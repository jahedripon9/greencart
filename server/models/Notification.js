import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    sellerId: {
        type: String,
        default: null,
        index: true
    },
    recipientRoles: {
        type: [String],
        default: ['Admin', 'CEO', 'CTO', 'Strategist']
    },
    type: {
        type: String,
        required: true,
        enum: ['order', 'low_stock', 'new_customer', 'pending_reminder', 'system'],
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    data: {
        orderId: { type: String, default: null },
        orderNumber: { type: String, default: null },
        productId: { type: String, default: null },
        productName: { type: String, default: null },
        customerId: { type: String, default: null },
        customerName: { type: String, default: null },
        customerEmail: { type: String, default: null },
        customerPhone: { type: String, default: null },
        amount: { type: Number, default: null },
        stockQuantity: { type: Number, default: null },
        lowStockThreshold: { type: Number, default: null },
        link: { type: String, default: null }
    },
    isRead: {
        type: Boolean,
        default: false,
        index: true
    },
    readAt: {
        type: Date,
        default: null
    },
    readBy: [{
        type: String
    }],
    dedupeKey: {
        type: String,
        default: null,
        index: true
    }
}, {
    timestamps: true
});

// Compound indexes for optimal querying & deduplication
notificationSchema.index({ sellerId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });

const Notification = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

export default Notification;
