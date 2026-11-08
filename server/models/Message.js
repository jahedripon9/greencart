import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "conversation",
        required: true,
        index: true
    },
    senderRole: {
        type: String,
        enum: ["customer", "seller"],
        required: true
    },
    senderId: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    read: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    }
}, { timestamps: true });

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ conversationId: 1, senderRole: 1, read: 1 });

const Message = mongoose.models.message || mongoose.model("message", messageSchema);

export default Message;
