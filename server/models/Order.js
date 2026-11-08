import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    userId: { type: String, required: true, ref: "user" },
    items: [{
        product: { type: String, required: true, ref: "product" },
        quantity: { type: Number, required: true },
        name: { type: String, trim: true },
        unitPrice: { type: Number, min: 0 }
    }],
    amount: { type: Number, required: true },
    address: { type: String, required: true, ref: "address" },
    status: { type: String, default: "Order Placed" },
    paymentType: { type: String, required: true },
    isPaid: { type: Boolean, default: false },
    idempotencyKey: { type: String },
    orderNumber: {
        type: String,
        trim: true,
        uppercase: true,
        match: /^GC-[0-9A-Z]{6}$/
    },
    cartDeducted: { type: Boolean, default: false },
    stockDeducted: { type: Boolean, default: false },
    coupon: {
        code: { type: String, trim: true, uppercase: true },
        discountType: { type: String, enum: ['percentage', 'fixed'] },
        discountValue: { type: Number, min: 0 },
        discountAmount: { type: Number, min: 0 }
    },
    couponReleased: { type: Boolean, default: false },
    verification: {
        channel: { type: String, enum: ['email'] },
        verifiedAt: { type: Date }
    }
}, { timestamps: true });

orderSchema.index(
    { userId: 1, idempotencyKey: 1 },
    {
        unique: true,
        partialFilterExpression: {
            idempotencyKey: { $type: "string", $gt: "" }
        }
    }
);

orderSchema.index(
    { orderNumber: 1 },
    {
        unique: true,
        sparse: true
    }
);

const Order = mongoose.models.order || mongoose.model("order", orderSchema);

export default Order;
