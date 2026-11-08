import express from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import authUser from '../middlewares/authUser.js';
import authSeller from '../middlewares/authSeller.js';
import { requireRole } from '../middlewares/authRole.js';
import {
    initiateConversation,
    getCustomerConversations,
    getCustomerMessages,
    sendCustomerMessage,
    markCustomerConversationRead,
    getSellerConversations,
    getSellerMessages,
    sendSellerReply,
    markSellerConversationRead
} from '../controllers/chatController.js';

export const RATE_LIMIT_MESSAGE = {
    success: false,
    message: "Too many requests. Please try again later."
};

export const defaultRateLimitHandler = (req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
};

export const chatInitiateKeyGenerator = (req) => {
    if (req.userId) {
        return `chat_init_user_${req.userId}`;
    }
    return `chat_init_ip_${ipKeyGenerator(req.ip)}`;
};

export const customerMessageKeyGenerator = (req) => {
    if (req.userId) {
        return `chat_msg_user_${req.userId}`;
    }
    return `chat_msg_ip_${ipKeyGenerator(req.ip)}`;
};

export const sellerReplyKeyGenerator = (req) => {
    return `chat_seller_reply_ip_${ipKeyGenerator(req.ip)}`;
};

export const createChatInitiateLimiter = (options = {}) => {
    const keyGen = options.keyGenerator || chatInitiateKeyGenerator;
    const limiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 10, // 10 conversation initiations per 15 min per user/IP
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        keyGenerator: keyGen,
        message: RATE_LIMIT_MESSAGE,
        handler: defaultRateLimitHandler,
        validate: { xForwardedForHeader: false },
        ...options
    });
    limiter.keyGenerator = keyGen;
    return limiter;
};

export const createCustomerMessageLimiter = (options = {}) => {
    const keyGen = options.keyGenerator || customerMessageKeyGenerator;
    const limiter = rateLimit({
        windowMs: 60 * 1000, // 1 minute
        limit: 30, // 30 messages per minute per user/IP
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        keyGenerator: keyGen,
        message: RATE_LIMIT_MESSAGE,
        handler: defaultRateLimitHandler,
        validate: { xForwardedForHeader: false },
        ...options
    });
    limiter.keyGenerator = keyGen;
    return limiter;
};

export const createSellerReplyLimiter = (options = {}) => {
    const keyGen = options.keyGenerator || sellerReplyKeyGenerator;
    const limiter = rateLimit({
        windowMs: 60 * 1000, // 1 minute
        limit: 60, // 60 replies per minute per IP
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        keyGenerator: keyGen,
        message: RATE_LIMIT_MESSAGE,
        handler: defaultRateLimitHandler,
        validate: { xForwardedForHeader: false },
        ...options
    });
    limiter.keyGenerator = keyGen;
    return limiter;
};

export const chatInitiateLimiter = createChatInitiateLimiter();
export const customerMessageLimiter = createCustomerMessageLimiter();
export const sellerReplyLimiter = createSellerReplyLimiter();

const chatRouter = express.Router();

// Customer Endpoints
chatRouter.post('/initiate', authUser, chatInitiateLimiter, initiateConversation);
chatRouter.get('/customer/conversations', authUser, getCustomerConversations);
chatRouter.get('/customer/conversations/:id/messages', authUser, getCustomerMessages);
chatRouter.post('/customer/conversations/:id/messages', authUser, customerMessageLimiter, sendCustomerMessage);
chatRouter.post('/customer/conversations/:id/read', authUser, markCustomerConversationRead);

// Seller Endpoints
chatRouter.get('/seller/conversations', authSeller, requireRole('Admin', 'CTO'), getSellerConversations);
chatRouter.get('/seller/conversations/:id/messages', authSeller, requireRole('Admin', 'CTO'), getSellerMessages);
chatRouter.post('/seller/conversations/:id/messages', authSeller, requireRole('Admin', 'CTO'), sellerReplyLimiter, sendSellerReply);
chatRouter.post('/seller/conversations/:id/read', authSeller, requireRole('Admin', 'CTO'), markSellerConversationRead);

export default chatRouter;
