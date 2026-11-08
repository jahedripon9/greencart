import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true,
        index: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "product",
        required: false
    },
    lastMessage: {
        type: String,
        default: ""
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    unreadCountCustomer: {
        type: Number,
        default: 0,
        min: 0
    },
    unreadCountSeller: {
        type: Number,
        default: 0,
        min: 0
    },
    autoReplySent: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

conversationSchema.index({ customerId: 1, updatedAt: -1 });
conversationSchema.index({ updatedAt: -1 });
conversationSchema.index(
    { customerId: 1, productId: 1 },
    {
        unique: true,
        partialFilterExpression: { productId: { $exists: true, $type: "objectId" } }
    }
);

const Conversation = mongoose.models.conversation || mongoose.model("conversation", conversationSchema);

export default Conversation;
