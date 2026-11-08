import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Product from "../models/Product.js";

const MAX_MESSAGE_LENGTH = 2000;
const DEFAULT_CONVERSATION_PAGE_LIMIT = 20;
const MAX_CONVERSATION_PAGE_LIMIT = 50;
const DEFAULT_MESSAGE_PAGE_LIMIT = 50;
const MAX_MESSAGE_PAGE_LIMIT = 50;

export const AUTO_REPLY_MESSAGE = `আসসালামু আলাইকুম! 💚

GreenCart-এ আপনাকে স্বাগতম।

আমাদের সঙ্গে যোগাযোগ করার জন্য ধন্যবাদ। আপনার মেসেজটি আমরা পেয়েছি। আমাদের প্রতিনিধি খুব শীঘ্রই আপনার সঙ্গে যোগাযোগ করবেন।

অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করুন।
GreenCart-এর সঙ্গে থাকার জন্য ধন্যবাদ। 🛍️`;

/**
 * Customer: Initiate or retrieve existing conversation for a product
 * POST /api/chat/initiate
 */
export const initiateConversation = async (req, res) => {
    try {
        const customerId = req.userId;
        const { productId, initialMessage } = req.body || {};

        if (!customerId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        let productDoc = null;
        if (productId) {
            if (typeof productId !== 'string' || !mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({ success: false, message: "Invalid product ID" });
            }
            productDoc = await Product.findById(productId);
            if (!productDoc) {
                return res.status(404).json({ success: false, message: "Product not found" });
            }
        }

        let cleanInitialText = null;
        if (initialMessage !== undefined && initialMessage !== null) {
            if (typeof initialMessage !== 'string' || !initialMessage.trim()) {
                return res.status(400).json({ success: false, message: "Initial message cannot be empty" });
            }
            if (initialMessage.trim().length > MAX_MESSAGE_LENGTH) {
                return res.status(400).json({ success: false, message: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
            }
            cleanInitialText = initialMessage.trim();
        }

        const query = { customerId };
        if (productDoc) {
            query.productId = productDoc._id;
        } else {
            query.productId = { $exists: false };
        }

        let conversation = await Conversation.findOne(query);
        let isNewlyCreated = false;

        if (!conversation) {
            try {
                conversation = await Conversation.create({
                    customerId,
                    ...(productDoc ? { productId: productDoc._id } : {}),
                    lastMessage: "",
                    lastMessageAt: new Date(),
                    unreadCountCustomer: 0,
                    unreadCountSeller: 0
                });
                isNewlyCreated = true;
            } catch (err) {
                if (err.code === 11000) {
                    conversation = await Conversation.findOne(query);
                } else {
                    throw err;
                }
            }
        }

        // Only create an initial message if the thread was newly created and an initial message was supplied
        if (isNewlyCreated && cleanInitialText && conversation) {
            let customerMessage = null;
            let autoReply = null;
            try {
                customerMessage = await Message.create({
                    conversationId: conversation._id,
                    senderRole: "customer",
                    senderId: customerId,
                    text: cleanInitialText
                });

                // First customer message automatic seller reply (generic sender identifier, no email disclosure)
                autoReply = await Message.create({
                    conversationId: conversation._id,
                    senderRole: "seller",
                    senderId: "seller",
                    text: AUTO_REPLY_MESSAGE
                });

                conversation = await Conversation.findByIdAndUpdate(
                    conversation._id,
                    {
                        $set: {
                            lastMessage: AUTO_REPLY_MESSAGE,
                            lastMessageAt: autoReply.createdAt || new Date(),
                            autoReplySent: true
                        },
                        $inc: {
                            unreadCountSeller: 1,
                            unreadCountCustomer: 1
                        }
                    },
                    { new: true }
                );
            } catch (msgErr) {
                console.error("Initial message creation failed:", msgErr.message);
                if (customerMessage) {
                    await Message.findByIdAndDelete(customerMessage._id).catch(() => {});
                }
                if (autoReply) {
                    await Message.findByIdAndDelete(autoReply._id).catch(() => {});
                }
                // Bounded best-effort cleanup of empty conversation
                try {
                    await Conversation.findByIdAndDelete(conversation._id);
                } catch (cleanupErr) {
                    console.error("Failed to delete empty conversation during rollback:", cleanupErr.message);
                }
                return res.status(500).json({ success: false, message: "Failed to send initial message" });
            }
        }

        return res.json({ success: true, conversation, isNew: isNewlyCreated });

    } catch (error) {
        console.error("Initiate conversation error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Customer: Get customer's own conversation list with bounded pagination
 * GET /api/chat/customer/conversations
 */
export const getCustomerConversations = async (req, res) => {
    try {
        const customerId = req.userId;
        if (!customerId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const requestedLimit = parseInt(req.query.limit, 10);
        const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
            ? Math.min(requestedLimit, MAX_CONVERSATION_PAGE_LIMIT)
            : DEFAULT_CONVERSATION_PAGE_LIMIT;
        const skip = (page - 1) * limit;

        const [conversations, total] = await Promise.all([
            Conversation.find({ customerId })
                .populate("productId", "name image price offerPrice inStock")
                .sort({ lastMessageAt: -1, updatedAt: -1 })
                .skip(skip)
                .limit(limit),
            Conversation.countDocuments({ customerId })
        ]);

        return res.json({
            success: true,
            conversations,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Get customer conversations error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Customer: Get messages for a customer conversation with bounded pagination
 * GET /api/chat/customer/conversations/:id/messages
 */
export const getCustomerMessages = async (req, res) => {
    try {
        const customerId = req.userId;
        const { id } = req.params;

        if (!customerId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid conversation ID" });
        }

        const conversation = await Conversation.findById(id).populate("productId", "name image price offerPrice inStock");
        if (!conversation) {
            return res.status(404).json({ success: false, message: "Conversation not found" });
        }

        // Ownership enforcement (IDOR protection)
        if (conversation.customerId.toString() !== customerId.toString()) {
            return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
        }

        const requestedLimit = parseInt(req.query.limit, 10);
        const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
            ? Math.min(requestedLimit, MAX_MESSAGE_PAGE_LIMIT)
            : DEFAULT_MESSAGE_PAGE_LIMIT;

        const messages = await Message.find({ conversationId: id })
            .sort({ createdAt: -1 })
            .limit(limit);

        // Sanitize messages so seller authentication email is never leaked to customer
        const sanitizedMessages = messages.map(msg => {
            const doc = typeof msg?.toObject === 'function' ? msg.toObject() : { ...msg };
            if (doc.senderRole === 'seller') {
                doc.senderId = 'seller';
            }
            return doc;
        });

        return res.json({
            success: true,
            conversation,
            messages: sanitizedMessages.reverse()
        });

    } catch (error) {
        console.error("Get customer messages error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Customer: Send message in conversation
 * POST /api/chat/customer/conversations/:id/messages
 */
export const sendCustomerMessage = async (req, res) => {
    try {
        const customerId = req.userId;
        const { id } = req.params;
        const { text } = req.body || {};

        if (!customerId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid conversation ID" });
        }

        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ success: false, message: "Message text is required" });
        }

        const trimmedText = text.trim();
        if (trimmedText.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({ success: false, message: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
        }

        const conversation = await Conversation.findById(id);
        if (!conversation) {
            return res.status(404).json({ success: false, message: "Conversation not found" });
        }

        if (conversation.customerId.toString() !== customerId.toString()) {
            return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
        }

        const message = await Message.create({
            conversationId: id,
            senderRole: "customer",
            senderId: customerId,
            text: trimmedText
        });

        // Atomically claim the first-message automatic reply slot (preventing concurrent duplicates)
        const autoReplyClaim = await Conversation.findOneAndUpdate(
            { _id: id, autoReplySent: { $ne: true } },
            { $set: { autoReplySent: true } },
            { new: false }
        );

        let autoReply = null;
        if (autoReplyClaim) {
            try {
                autoReply = await Message.create({
                    conversationId: id,
                    senderRole: "seller",
                    senderId: "seller",
                    text: AUTO_REPLY_MESSAGE
                });

                await Conversation.findByIdAndUpdate(id, {
                    $set: {
                        lastMessage: AUTO_REPLY_MESSAGE,
                        lastMessageAt: autoReply.createdAt || new Date(),
                        autoReplySent: true
                    },
                    $inc: {
                        unreadCountSeller: 1,
                        unreadCountCustomer: 1
                    }
                });
            } catch (autoErr) {
                console.error("Auto-reply creation failed:", autoErr.message);
                if (autoReply) {
                    await Message.findByIdAndDelete(autoReply._id).catch(() => {});
                }
                // Fallback: update with customer message only and reset autoReplySent so retry is possible
                await Conversation.findByIdAndUpdate(id, {
                    $set: {
                        lastMessage: trimmedText,
                        lastMessageAt: message.createdAt || new Date(),
                        autoReplySent: false
                    },
                    $inc: { unreadCountSeller: 1 }
                }).catch(async (updateErr) => {
                    await Message.findByIdAndDelete(message._id).catch(() => {});
                    throw updateErr;
                });
            }
        } else {
            // Subsequent customer message in existing conversation (autoReplySent was already true)
            try {
                await Conversation.findByIdAndUpdate(id, {
                    $set: { lastMessage: trimmedText, lastMessageAt: message.createdAt || new Date() },
                    $inc: { unreadCountSeller: 1 }
                });
            } catch (updateErr) {
                console.error("Conversation update failed after customer message, attempting compensating rollback:", updateErr.message);
                await Message.findByIdAndDelete(message._id).catch(() => {});
                throw updateErr;
            }
        }

        return res.json({
            success: true,
            message,
            ...(autoReply ? { autoReply } : {})
        });

    } catch (error) {
        console.error("Send customer message error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Customer: Mark conversation as read with self-healing reconciliation
 * POST /api/chat/customer/conversations/:id/read
 */
export const markCustomerConversationRead = async (req, res) => {
    try {
        const customerId = req.userId;
        const { id } = req.params;

        if (!customerId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid conversation ID" });
        }

        const conversation = await Conversation.findById(id);
        if (!conversation) {
            return res.status(404).json({ success: false, message: "Conversation not found" });
        }

        if (conversation.customerId.toString() !== customerId.toString()) {
            return res.status(403).json({ success: false, message: "Forbidden: Access denied" });
        }

        await Message.updateMany(
            { conversationId: id, senderRole: "seller", read: false },
            { $set: { read: true, readAt: new Date() } }
        );

        const unreadRemaining = await Message.countDocuments({
            conversationId: id,
            senderRole: "seller",
            read: false
        });

        await Conversation.findByIdAndUpdate(id, {
            $set: { unreadCountCustomer: unreadRemaining }
        });

        return res.json({ success: true, message: "Conversation marked as read", unreadRemaining });

    } catch (error) {
        console.error("Mark customer read error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Seller: Get all customer conversations with bounded pagination
 * GET /api/chat/seller/conversations
 */
export const getSellerConversations = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const requestedLimit = parseInt(req.query.limit, 10);
        const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
            ? Math.min(requestedLimit, MAX_CONVERSATION_PAGE_LIMIT)
            : DEFAULT_CONVERSATION_PAGE_LIMIT;
        const skip = (page - 1) * limit;

        const [conversations, total] = await Promise.all([
            Conversation.find({})
                .populate("customerId", "name email")
                .populate("productId", "name image price offerPrice inStock")
                .sort({ lastMessageAt: -1, updatedAt: -1 })
                .skip(skip)
                .limit(limit),
            Conversation.countDocuments({})
        ]);

        return res.json({
            success: true,
            conversations,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Get seller conversations error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Seller: Get messages for any conversation with bounded pagination
 * GET /api/chat/seller/conversations/:id/messages
 */
export const getSellerMessages = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid conversation ID" });
        }

        const conversation = await Conversation.findById(id)
            .populate("customerId", "name email")
            .populate("productId", "name image price offerPrice inStock");

        if (!conversation) {
            return res.status(404).json({ success: false, message: "Conversation not found" });
        }

        const requestedLimit = parseInt(req.query.limit, 10);
        const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
            ? Math.min(requestedLimit, MAX_MESSAGE_PAGE_LIMIT)
            : DEFAULT_MESSAGE_PAGE_LIMIT;

        const messages = await Message.find({ conversationId: id })
            .sort({ createdAt: -1 })
            .limit(limit);

        // Sanitize messages so seller authentication email is never leaked to customer
        const sanitizedMessages = messages.map(msg => {
            const doc = typeof msg?.toObject === 'function' ? msg.toObject() : { ...msg };
            if (doc.senderRole === 'seller') {
                doc.senderId = 'seller';
            }
            return doc;
        });

        return res.json({
            success: true,
            conversation,
            messages: sanitizedMessages.reverse()
        });

    } catch (error) {
        console.error("Get seller messages error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Seller: Send reply in conversation
 * POST /api/chat/seller/conversations/:id/messages
 */
export const sendSellerReply = async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body || {};

        if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid conversation ID" });
        }

        if (!text || typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ success: false, message: "Reply text is required" });
        }

        const trimmedText = text.trim();
        if (trimmedText.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({ success: false, message: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
        }

        const conversation = await Conversation.findById(id);
        if (!conversation) {
            return res.status(404).json({ success: false, message: "Conversation not found" });
        }

        // Generic seller identifier (strictly prevents SELLER_EMAIL exposure)
        const message = await Message.create({
            conversationId: id,
            senderRole: "seller",
            senderId: "seller",
            text: trimmedText
        });

        try {
            await Conversation.findByIdAndUpdate(id, {
                $set: {
                    lastMessage: trimmedText,
                    lastMessageAt: message.createdAt || new Date(),
                    autoReplySent: true
                },
                $inc: { unreadCountCustomer: 1 }
            });
        } catch (updateErr) {
            console.error("Conversation update failed after seller reply, attempting compensating rollback:", updateErr.message);
            await Message.findByIdAndDelete(message._id).catch(() => {});
            throw updateErr;
        }

        return res.json({ success: true, message });

    } catch (error) {
        console.error("Send seller reply error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Seller: Mark conversation as read with self-healing reconciliation
 * POST /api/chat/seller/conversations/:id/read
 */
export const markSellerConversationRead = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid conversation ID" });
        }

        const conversation = await Conversation.findById(id);
        if (!conversation) {
            return res.status(404).json({ success: false, message: "Conversation not found" });
        }

        await Message.updateMany(
            { conversationId: id, senderRole: "customer", read: false },
            { $set: { read: true, readAt: new Date() } }
        );

        const unreadRemaining = await Message.countDocuments({
            conversationId: id,
            senderRole: "customer",
            read: false
        });

        await Conversation.findByIdAndUpdate(id, {
            $set: { unreadCountSeller: unreadRemaining }
        });

        return res.json({ success: true, message: "Conversation marked as read", unreadRemaining });

    } catch (error) {
        console.error("Mark seller read error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
