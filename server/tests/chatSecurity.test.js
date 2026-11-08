import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Product from '../models/Product.js';
import authUser from '../middlewares/authUser.js';
import authSeller from '../middlewares/authSeller.js';
import {
    initiateConversation,
    getCustomerConversations,
    getCustomerMessages,
    sendCustomerMessage,
    markCustomerConversationRead,
    getSellerConversations,
    getSellerMessages,
    sendSellerReply,
    markSellerConversationRead,
    AUTO_REPLY_MESSAGE
} from '../controllers/chatController.js';
import {
    createChatInitiateLimiter,
    createCustomerMessageLimiter,
    createSellerReplyLimiter,
    chatInitiateKeyGenerator,
    customerMessageKeyGenerator,
    sellerReplyKeyGenerator,
    chatInitiateLimiter,
    customerMessageLimiter,
    sellerReplyLimiter
} from '../routes/chatRoute.js';

// Helper to create mock response object for controller tests
const createMockRes = () => {
    let statusCode = 200;
    let jsonResult = null;
    let headersSent = false;
    const res = {
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            statusCode = code;
            return this;
        },
        json(data) {
            headersSent = true;
            jsonResult = data;
            return this;
        },
        send(data) {
            headersSent = true;
            jsonResult = data;
            return this;
        },
        getStatusCode: () => statusCode,
        getJson: () => jsonResult,
        isHeadersSent: () => headersSent
    };
    return res;
};

// Helpers for rate-limit middleware tests
const createLimiterMockReq = (userId, ip = '127.0.0.1') => ({
    userId,
    ip,
    app: { get: () => false },
    headers: {},
    method: 'POST',
    url: '/test'
});

const createLimiterMockRes = () => {
    let statusCode = 200;
    let body = null;
    return {
        statusCode: 200,
        headers: {},
        setHeader(k, v) { this.headers[k.toLowerCase()] = String(v); return this; },
        getHeader(k) { return this.headers[k.toLowerCase()]; },
        status(c) { this.statusCode = c; statusCode = c; return this; },
        json(d) { this.body = d; body = d; return this; },
        send(d) { this.body = d; body = d; return this; },
        getStatusCode: () => statusCode,
        getJson: () => body
    };
};

// Fluent mock query builder for chaining .populate().sort().skip().limit()
class MockQuery {
    constructor(dataPromise) {
        this._promise = Promise.resolve(dataPromise);
    }
    populate() { return this; }
    sort(sortSpec) {
        if (sortSpec?.createdAt === -1) {
            this._promise = this._promise.then(items =>
                [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            );
        }
        return this;
    }
    skip() { return this; }
    limit(n) {
        if (typeof n === 'number' && n > 0) {
            this._promise = this._promise.then(items => items.slice(0, n));
        }
        return this;
    }
    then(onFulfilled, onRejected) {
        return this._promise.then(onFulfilled, onRejected);
    }
    catch(onRejected) {
        return this._promise.catch(onRejected);
    }
}

describe('GreenCart Customer-Seller Chat Security & API Suite', () => {
    const JWT_SECRET_TEST = 'chat_test_secret_32_bytes_long_key_abc123';
    const SELLER_EMAIL_TEST = 'seller@greencart.com';

    const customerAId = '507f1f77bcf86cd799439011';
    const customerBId = '507f1f77bcf86cd799439022';
    const productAId = '507f1f77bcf86cd799439033';
    const convAId = '507f1f77bcf86cd799439044';
    const convBId = '507f1f77bcf86cd799439055';

    let originalEnv;
    let originalConversationMethods;
    let originalMessageMethods;
    let originalProductMethods;

    let conversationStore;
    let messageStore;
    let productStore;

    beforeEach(() => {
        // Backup environment variables
        originalEnv = {
            JWT_SECRET: process.env.JWT_SECRET,
            SELLER_EMAIL: process.env.SELLER_EMAIL
        };
        process.env.JWT_SECRET = JWT_SECRET_TEST;
        process.env.SELLER_EMAIL = SELLER_EMAIL_TEST;

        // Initialize stores
        conversationStore = new Map();
        messageStore = new Map();
        productStore = new Map();

        // Seed product
        productStore.set(productAId, {
            _id: productAId,
            name: 'Fresh Organic Mangoes',
            price: 500,
            offerPrice: 450,
            inStock: true
        });

        // Seed Conversation A (owned by Customer A)
        conversationStore.set(convAId, {
            _id: convAId,
            customerId: customerAId,
            productId: productAId,
            lastMessage: 'Hello seller',
            lastMessageAt: new Date(Date.now() - 60000),
            unreadCountCustomer: 0,
            unreadCountSeller: 1,
            autoReplySent: true,
            createdAt: new Date(Date.now() - 120000),
            updatedAt: new Date(Date.now() - 60000)
        });

        // Seed Conversation B (owned by Customer B)
        conversationStore.set(convBId, {
            _id: convBId,
            customerId: customerBId,
            productId: productAId,
            lastMessage: 'Is this available?',
            lastMessageAt: new Date(),
            unreadCountCustomer: 1,
            unreadCountSeller: 0,
            autoReplySent: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Backup model methods
        originalConversationMethods = {
            findOne: Conversation.findOne,
            findById: Conversation.findById,
            find: Conversation.find,
            create: Conversation.create,
            findByIdAndUpdate: Conversation.findByIdAndUpdate,
            findByIdAndDelete: Conversation.findByIdAndDelete,
            findOneAndUpdate: Conversation.findOneAndUpdate,
            countDocuments: Conversation.countDocuments
        };

        originalMessageMethods = {
            find: Message.find,
            create: Message.create,
            findByIdAndDelete: Message.findByIdAndDelete,
            updateMany: Message.updateMany,
            countDocuments: Message.countDocuments
        };

        originalProductMethods = {
            findById: Product.findById
        };

        // Wire Mock Product
        Product.findById = async (id) => {
            const prod = productStore.get(id?.toString());
            return prod ? { ...prod } : null;
        };

        // Wire Mock Conversation
        Conversation.findOne = async (query) => {
            for (const conv of conversationStore.values()) {
                const matchCust = !query.customerId || conv.customerId.toString() === query.customerId.toString();
                let matchProd = true;
                if (query.productId) {
                    if (query.productId.$exists === false) {
                        matchProd = !conv.productId;
                    } else {
                        matchProd = conv.productId && conv.productId.toString() === query.productId.toString();
                    }
                }
                if (matchCust && matchProd) {
                    return { ...conv };
                }
            }
            return null;
        };

        Conversation.findById = (id) => {
            const conv = conversationStore.get(id?.toString());
            return new MockQuery(conv ? { ...conv } : null);
        };

        Conversation.find = (query = {}) => {
            let results = Array.from(conversationStore.values());
            if (query.customerId) {
                results = results.filter(c => c.customerId.toString() === query.customerId.toString());
            }
            return new MockQuery(results.map(c => ({ ...c })));
        };

        Conversation.countDocuments = async (query = {}) => {
            let results = Array.from(conversationStore.values());
            if (query.customerId) {
                results = results.filter(c => c.customerId.toString() === query.customerId.toString());
            }
            return results.length;
        };

        Conversation.create = async (doc) => {
            const id = doc._id || new mongoose.Types.ObjectId().toString();
            const record = {
                _id: id,
                ...doc,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            conversationStore.set(id.toString(), record);
            return { ...record };
        };

        Conversation.findByIdAndUpdate = async (id, update) => {
            const existing = conversationStore.get(id?.toString());
            if (!existing) return null;

            const updated = { ...existing };
            if (update.$set) {
                Object.assign(updated, update.$set);
            }
            if (update.$inc) {
                for (const [k, v] of Object.entries(update.$inc)) {
                    updated[k] = (updated[k] || 0) + v;
                }
            }
            updated.updatedAt = new Date();
            conversationStore.set(id.toString(), updated);
            return { ...updated };
        };

        Conversation.findByIdAndDelete = async (id) => {
            const existing = conversationStore.get(id?.toString());
            if (existing) {
                conversationStore.delete(id.toString());
                return { ...existing };
            }
            return null;
        };

        Conversation.findOneAndUpdate = async (filter, update, options = {}) => {
            let target = null;
            if (filter._id) {
                target = conversationStore.get(filter._id.toString());
            }
            if (!target) return null;

            if (filter.autoReplySent && typeof filter.autoReplySent === 'object' && filter.autoReplySent.$ne !== undefined) {
                if (target.autoReplySent === filter.autoReplySent.$ne) {
                    return null;
                }
            } else if (filter.autoReplySent !== undefined && target.autoReplySent !== filter.autoReplySent) {
                return null;
            }

            const originalDoc = { ...target };
            const updated = { ...target };
            if (update.$set) {
                Object.assign(updated, update.$set);
            }
            if (update.$inc) {
                for (const [k, v] of Object.entries(update.$inc)) {
                    updated[k] = (updated[k] || 0) + v;
                }
            }
            updated.updatedAt = new Date();
            conversationStore.set(updated._id.toString(), updated);
            return options.new ? { ...updated } : { ...originalDoc };
        };

        // Wire Mock Message
        Message.find = (query = {}) => {
            let results = Array.from(messageStore.values());
            if (query.conversationId) {
                results = results.filter(m => m.conversationId.toString() === query.conversationId.toString());
            }
            return new MockQuery(results.map(m => ({ ...m })));
        };

        Message.create = async (doc) => {
            const id = doc._id || new mongoose.Types.ObjectId().toString();
            const record = {
                _id: id,
                ...doc,
                read: doc.read || false,
                createdAt: doc.createdAt || new Date(),
                updatedAt: new Date()
            };
            messageStore.set(id.toString(), record);
            return { ...record };
        };

        Message.findByIdAndDelete = async (id) => {
            const existing = messageStore.get(id?.toString());
            if (existing) {
                messageStore.delete(id.toString());
                return { ...existing };
            }
            return null;
        };

        Message.updateMany = async (filter, update) => {
            let count = 0;
            for (const [id, msg] of messageStore.entries()) {
                const matchConv = !filter.conversationId || msg.conversationId.toString() === filter.conversationId.toString();
                const matchRole = !filter.senderRole || msg.senderRole === filter.senderRole;
                const matchRead = filter.read === undefined || msg.read === filter.read;

                if (matchConv && matchRole && matchRead) {
                    if (update.$set) {
                        Object.assign(msg, update.$set);
                    }
                    messageStore.set(id, msg);
                    count++;
                }
            }
            return { modifiedCount: count };
        };

        Message.countDocuments = async (filter) => {
            let count = 0;
            for (const msg of messageStore.values()) {
                const matchConv = !filter.conversationId || msg.conversationId.toString() === filter.conversationId.toString();
                const matchRole = !filter.senderRole || msg.senderRole === filter.senderRole;
                const matchRead = filter.read === undefined || msg.read === filter.read;

                if (matchConv && matchRole && matchRead) {
                    count++;
                }
            }
            return count;
        };
    });

    afterEach(() => {
        // Restore environment
        process.env.JWT_SECRET = originalEnv.JWT_SECRET;
        process.env.SELLER_EMAIL = originalEnv.SELLER_EMAIL;

        // Restore model methods
        Object.assign(Conversation, originalConversationMethods);
        Object.assign(Message, originalMessageMethods);
        Object.assign(Product, originalProductMethods);
    });

    // =========================================================================
    // 1. Authentication & Authorization Middleware Boundaries
    // =========================================================================
    describe('1. Authentication & Authorization Middleware Boundaries', () => {
        it('authUser rejects unauthenticated request when token cookie is missing (401)', async () => {
            const req = { cookies: {} };
            const res = createMockRes();
            let nextCalled = false;

            await authUser(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.getStatusCode(), 401);
            assert.equal(res.getJson().success, false);
        });

        it('authUser rejects request with invalid / forged JWT (401)', async () => {
            const forgedToken = jwt.sign({ id: customerAId }, 'wrong_secret');
            const req = { cookies: { token: forgedToken } };
            const res = createMockRes();
            let nextCalled = false;

            await authUser(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.getStatusCode(), 401);
            assert.equal(res.getJson().success, false);
        });

        it('authUser returns 500 when JWT_SECRET is unset in environment', async () => {
            delete process.env.JWT_SECRET;
            const req = { cookies: { token: 'any-token' } };
            const res = createMockRes();
            let nextCalled = false;

            await authUser(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.getStatusCode(), 500);
            assert.equal(res.getJson().success, false);
        });

        it('authUser populates req.userId and calls next() on valid token', async () => {
            const validToken = jwt.sign({ id: customerAId }, JWT_SECRET_TEST);
            const req = { cookies: { token: validToken } };
            const res = createMockRes();
            let nextCalled = false;

            await authUser(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, true);
            assert.equal(req.userId, customerAId);
        });

        it('authSeller rejects unauthenticated request when sellerToken cookie is missing (401)', async () => {
            const req = { cookies: {} };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.getStatusCode(), 401);
            assert.equal(res.getJson().success, false);
        });

        it('authSeller rejects token signed for mismatched email (401)', async () => {
            const wrongEmailToken = jwt.sign({ email: 'attacker@evil.com' }, JWT_SECRET_TEST);
            const req = { cookies: { sellerToken: wrongEmailToken } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.getStatusCode(), 401);
        });

        it('authSeller returns 500 when SELLER_EMAIL is missing', async () => {
            delete process.env.SELLER_EMAIL;
            const req = { cookies: { sellerToken: 'any-token' } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.getStatusCode(), 500);
        });

        it('authSeller calls next() when valid seller token is provided', async () => {
            const validSellerToken = jwt.sign({ email: SELLER_EMAIL_TEST }, JWT_SECRET_TEST);
            const req = { cookies: { sellerToken: validSellerToken } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, true);
        });
    });

    // =========================================================================
    // 2. Cross-Customer IDOR & Authorization Protection
    // =========================================================================
    describe('2. Cross-Customer IDOR & Authorization Protection', () => {
        it('getCustomerConversations strictly queries by authenticated req.userId', async () => {
            const req = { userId: customerAId, query: {} };
            const res = createMockRes();

            await getCustomerConversations(req, res);

            assert.equal(res.getStatusCode(), 200);
            const data = res.getJson();
            assert.equal(data.success, true);
            assert.equal(data.conversations.length, 1);
            assert.equal(data.conversations[0]._id, convAId);
            assert.equal(data.conversations[0].customerId, customerAId);
        });

        it('getCustomerMessages rejects access to another customer\'s conversation with 403', async () => {
            // Customer B attempts to view Customer A's conversation
            const req = { userId: customerBId, params: { id: convAId }, query: {} };
            const res = createMockRes();

            await getCustomerMessages(req, res);

            assert.equal(res.getStatusCode(), 403);
            assert.equal(res.getJson().success, false);
            assert.match(res.getJson().message, /Forbidden/i);
        });

        it('sendCustomerMessage rejects sending message to another customer\'s conversation with 403', async () => {
            const req = {
                userId: customerBId,
                params: { id: convAId },
                body: { text: 'Injected message from Customer B' }
            };
            const res = createMockRes();

            await sendCustomerMessage(req, res);

            assert.equal(res.getStatusCode(), 403);
            assert.equal(res.getJson().success, false);
        });

        it('markCustomerConversationRead rejects marking another customer\'s conversation as read with 403', async () => {
            const req = { userId: customerBId, params: { id: convAId } };
            const res = createMockRes();

            await markCustomerConversationRead(req, res);

            assert.equal(res.getStatusCode(), 403);
            assert.equal(res.getJson().success, false);
        });

        it('Seller endpoints can access and reply to any conversation', async () => {
            // Seller reads Customer A's conversation
            const getReq = { params: { id: convAId }, query: {} };
            const getRes = createMockRes();
            await getSellerMessages(getReq, getRes);

            assert.equal(getRes.getStatusCode(), 200);
            assert.equal(getRes.getJson().conversation._id, convAId);

            // Seller replies to Customer A's conversation
            const replyReq = {
                params: { id: convAId },
                body: { text: 'Yes, this mango is organically grown in Rajshahi.' }
            };
            const replyRes = createMockRes();
            await sendSellerReply(replyReq, replyRes);

            assert.equal(replyRes.getStatusCode(), 200);
            assert.equal(replyRes.getJson().success, true);
            assert.equal(replyRes.getJson().message.senderRole, 'seller');
            assert.equal(replyRes.getJson().message.senderId, 'seller');
            assert.notEqual(replyRes.getJson().message.senderId, SELLER_EMAIL_TEST);
        });
    });

    // =========================================================================
    // 3. Input Validation & Defensive Checks
    // =========================================================================
    describe('3. Input Validation & Defensive Checks', () => {
        it('initiateConversation rejects malformed productId with 400', async () => {
            const req = { userId: customerAId, body: { productId: 'invalid-id-format' } };
            const res = createMockRes();

            await initiateConversation(req, res);

            assert.equal(res.getStatusCode(), 400);
            assert.match(res.getJson().message, /Invalid product ID/i);
        });

        it('initiateConversation returns 404 when product does not exist', async () => {
            const nonExistentProductId = '507f1f77bcf86cd799439099';
            const req = { userId: customerAId, body: { productId: nonExistentProductId } };
            const res = createMockRes();

            await initiateConversation(req, res);

            assert.equal(res.getStatusCode(), 404);
            assert.match(res.getJson().message, /Product not found/i);
        });

        it('initiateConversation rejects empty/whitespace initialMessage with 400', async () => {
            const req = {
                userId: customerAId,
                body: { productId: productAId, initialMessage: '   \n  \t  ' }
            };
            const res = createMockRes();

            await initiateConversation(req, res);

            assert.equal(res.getStatusCode(), 400);
            assert.match(res.getJson().message, /cannot be empty/i);
        });

        it('initiateConversation rejects initialMessage exceeding 2000 characters with 400', async () => {
            const longText = 'A'.repeat(2001);
            const req = {
                userId: customerAId,
                body: { productId: productAId, initialMessage: longText }
            };
            const res = createMockRes();

            await initiateConversation(req, res);

            assert.equal(res.getStatusCode(), 400);
            assert.match(res.getJson().message, /cannot exceed 2000/i);
        });

        it('sendCustomerMessage rejects malformed conversation ID with 400', async () => {
            const req = { userId: customerAId, params: { id: 'bad-id' }, body: { text: 'Hi' } };
            const res = createMockRes();

            await sendCustomerMessage(req, res);

            assert.equal(res.getStatusCode(), 400);
            assert.match(res.getJson().message, /Invalid conversation ID/i);
        });

        it('sendCustomerMessage rejects empty or whitespace-only text with 400', async () => {
            const req = { userId: customerAId, params: { id: convAId }, body: { text: '   ' } };
            const res = createMockRes();

            await sendCustomerMessage(req, res);

            assert.equal(res.getStatusCode(), 400);
            assert.match(res.getJson().message, /Message text is required/i);
        });

        it('sendCustomerMessage rejects message exceeding 2000 characters with 400', async () => {
            const longText = 'B'.repeat(2001);
            const req = { userId: customerAId, params: { id: convAId }, body: { text: longText } };
            const res = createMockRes();

            await sendCustomerMessage(req, res);

            assert.equal(res.getStatusCode(), 400);
            assert.match(res.getJson().message, /cannot exceed 2000/i);
        });

        it('sendCustomerMessage returns 404 when conversation does not exist', async () => {
            const nonExistentConvId = '507f1f77bcf86cd799439099';
            const req = { userId: customerAId, params: { id: nonExistentConvId }, body: { text: 'Hello' } };
            const res = createMockRes();

            await sendCustomerMessage(req, res);

            assert.equal(res.getStatusCode(), 404);
        });

        it('sendSellerReply rejects malformed conversation ID with 400', async () => {
            const req = { params: { id: 'bad-id' }, body: { text: 'Reply' } };
            const res = createMockRes();

            await sendSellerReply(req, res);

            assert.equal(res.getStatusCode(), 400);
        });

        it('sendSellerReply rejects empty or missing text with 400', async () => {
            const req = { params: { id: convAId }, body: { text: '' } };
            const res = createMockRes();

            await sendSellerReply(req, res);

            assert.equal(res.getStatusCode(), 400);
        });

        it('sendSellerReply rejects reply exceeding 2000 characters with 400', async () => {
            const req = { params: { id: convAId }, body: { text: 'C'.repeat(2001) } };
            const res = createMockRes();

            await sendSellerReply(req, res);

            assert.equal(res.getStatusCode(), 400);
        });
    });

    // =========================================================================
    // 4. Conversation Lifecycle, Idempotency & Initial Message Handling
    // =========================================================================
    describe('4. Conversation Lifecycle, Idempotency & Initial Message Handling', () => {
        it('initiateConversation creates a new conversation and initial message when none exists (isNew: true)', async () => {
            const newCustId = '507f1f77bcf86cd799439088';
            const req = {
                userId: newCustId,
                body: { productId: productAId, initialMessage: 'Is this fresh?' }
            };
            const res = createMockRes();

            await initiateConversation(req, res);

            assert.equal(res.getStatusCode(), 200);
            const data = res.getJson();
            assert.equal(data.success, true);
            assert.equal(data.isNew, true);
            assert.equal(data.conversation.customerId, newCustId);
            assert.equal(data.conversation.lastMessage, AUTO_REPLY_MESSAGE);
            assert.equal(data.conversation.unreadCountSeller, 1);
            assert.equal(data.conversation.unreadCountCustomer, 1);
            assert.equal(data.conversation.autoReplySent, true);

            // Verify both customer initial message and automatic seller reply were created
            const messages = Array.from(messageStore.values()).filter(
                m => m.conversationId.toString() === data.conversation._id.toString()
            );
            assert.equal(messages.length, 2);
            assert.equal(messages[0].text, 'Is this fresh?');
            assert.equal(messages[0].senderRole, 'customer');
            assert.equal(messages[0].senderId, newCustId);

            assert.equal(messages[1].text, AUTO_REPLY_MESSAGE);
            assert.equal(messages[1].senderRole, 'seller');
            assert.equal(messages[1].senderId, 'seller');
        });

        it('initiateConversation returns existing conversation without creating duplicate initial message (isNew: false)', async () => {
            const messagesBefore = messageStore.size;

            // Customer A already has convAId for productAId
            const req = {
                userId: customerAId,
                body: { productId: productAId, initialMessage: 'Duplicate message attempt' }
            };
            const res = createMockRes();

            await initiateConversation(req, res);

            assert.equal(res.getStatusCode(), 200);
            const data = res.getJson();
            assert.equal(data.success, true);
            assert.equal(data.isNew, false);
            assert.equal(data.conversation._id, convAId);

            // Message count must NOT increase
            assert.equal(messageStore.size, messagesBefore);
        });

        it('initiateConversation gracefully recovers from E11000 duplicate race condition', async () => {
            const newCustId = '507f1f77bcf86cd799439077';
            let createAttempts = 0;
            let findAttempts = 0;

            const racedConv = {
                _id: 'conv_race_id',
                customerId: newCustId,
                productId: productAId,
                lastMessage: '',
                unreadCountSeller: 0
            };

            // First findOne returns null (simulating concurrent race), second findOne (in catch block) returns existing
            Conversation.findOne = async () => {
                findAttempts++;
                if (findAttempts === 1) {
                    return null;
                }
                return { ...racedConv };
            };

            Conversation.create = async () => {
                createAttempts++;
                const err = new Error('E11000 duplicate key error collection');
                err.code = 11000;
                throw err;
            };

            const req = {
                userId: newCustId,
                body: { productId: productAId }
            };
            const res = createMockRes();

            await initiateConversation(req, res);

            assert.equal(res.getStatusCode(), 200);
            const data = res.getJson();
            assert.equal(data.success, true);
            assert.equal(data.isNew, false);
            assert.equal(data.conversation._id, 'conv_race_id');
            assert.equal(createAttempts, 1);
            assert.equal(findAttempts, 2);
        });
    });

    // =========================================================================
    // 5. Bounded Pagination Clamping
    // =========================================================================
    describe('5. Bounded Pagination Clamping', () => {
        it('getCustomerConversations clamps excessive pagination limits to MAX 50', async () => {
            const req = { userId: customerAId, query: { limit: '999', page: '1' } };
            const res = createMockRes();

            await getCustomerConversations(req, res);

            assert.equal(res.getStatusCode(), 200);
            const data = res.getJson();
            assert.equal(data.pagination.limit, 50);
        });

        it('getCustomerConversations applies default limit of 20 when unspecified', async () => {
            const req = { userId: customerAId, query: {} };
            const res = createMockRes();

            await getCustomerConversations(req, res);

            assert.equal(res.getStatusCode(), 200);
            const data = res.getJson();
            assert.equal(data.pagination.limit, 20);
        });

        it('getSellerConversations clamps excessive pagination limits to MAX 50', async () => {
            const req = { query: { limit: '500', page: '1' } };
            const res = createMockRes();

            await getSellerConversations(req, res);

            assert.equal(res.getStatusCode(), 200);
            const data = res.getJson();
            assert.equal(data.pagination.limit, 50);
        });

        it('getCustomerMessages clamps message limit to MAX 50 and reverses chronologically', async () => {
            // Seed 3 messages in convAId with distinct creation dates
            const msg1 = { _id: 'm1', conversationId: convAId, senderRole: 'customer', senderId: customerAId, text: 'First', createdAt: new Date(10000) };
            const msg2 = { _id: 'm2', conversationId: convAId, senderRole: 'seller', senderId: SELLER_EMAIL_TEST, text: 'Second', createdAt: new Date(20000) };
            const msg3 = { _id: 'm3', conversationId: convAId, senderRole: 'customer', senderId: customerAId, text: 'Third', createdAt: new Date(30000) };
            messageStore.set('m1', msg1);
            messageStore.set('m2', msg2);
            messageStore.set('m3', msg3);

            const req = { userId: customerAId, params: { id: convAId }, query: { limit: '200' } };
            const res = createMockRes();

            await getCustomerMessages(req, res);

            assert.equal(res.getStatusCode(), 200);
            const data = res.getJson();
            assert.equal(data.messages.length, 3);
            // Reverse of descending [m3, m2, m1] is chronological [m1, m2, m3]
            assert.equal(data.messages[0]._id, 'm1');
            assert.equal(data.messages[1]._id, 'm2');
            assert.equal(data.messages[2]._id, 'm3');
        });
    });

    // =========================================================================
    // 6. Unread Counters & Self-Healing Reconciliation
    // =========================================================================
    describe('6. Unread Counters & Self-Healing Reconciliation', () => {
        it('sendCustomerMessage increments unreadCountSeller and sets lastMessage', async () => {
            const req = {
                userId: customerAId,
                params: { id: convAId },
                body: { text: 'Can you deliver tomorrow morning?' }
            };
            const res = createMockRes();

            const initialSellerUnread = conversationStore.get(convAId).unreadCountSeller;
            await sendCustomerMessage(req, res);

            assert.equal(res.getStatusCode(), 200);
            const updatedConv = conversationStore.get(convAId);
            assert.equal(updatedConv.lastMessage, 'Can you deliver tomorrow morning?');
            assert.equal(updatedConv.unreadCountSeller, initialSellerUnread + 1);
        });

        it('sendSellerReply increments unreadCountCustomer and sets generic "seller" as senderId', async () => {
            const req = {
                params: { id: convAId },
                body: { text: 'Yes, delivery is scheduled for 10am.' }
            };
            const res = createMockRes();

            const initialCustUnread = conversationStore.get(convAId).unreadCountCustomer;
            await sendSellerReply(req, res);

            assert.equal(res.getStatusCode(), 200);
            assert.equal(res.getJson().message.senderRole, 'seller');
            assert.equal(res.getJson().message.senderId, 'seller');
            assert.notEqual(res.getJson().message.senderId, SELLER_EMAIL_TEST);
            const updatedConv = conversationStore.get(convAId);
            assert.equal(updatedConv.lastMessage, 'Yes, delivery is scheduled for 10am.');
            assert.equal(updatedConv.unreadCountCustomer, initialCustUnread + 1);
        });

        it('markCustomerConversationRead marks seller messages as read and reconciles unreadCountCustomer', async () => {
            // Seed unread seller messages
            messageStore.set('m_s1', {
                _id: 'm_s1',
                conversationId: convAId,
                senderRole: 'seller',
                senderId: SELLER_EMAIL_TEST,
                text: 'Seller msg 1',
                read: false
            });
            messageStore.set('m_s2', {
                _id: 'm_s2',
                conversationId: convAId,
                senderRole: 'seller',
                senderId: SELLER_EMAIL_TEST,
                text: 'Seller msg 2',
                read: false
            });

            // Set unreadCountCustomer to out-of-sync number 9 to verify reconciliation
            conversationStore.get(convAId).unreadCountCustomer = 9;

            const req = { userId: customerAId, params: { id: convAId } };
            const res = createMockRes();

            await markCustomerConversationRead(req, res);

            assert.equal(res.getStatusCode(), 200);
            assert.equal(res.getJson().unreadRemaining, 0);

            // Messages should be marked read
            assert.equal(messageStore.get('m_s1').read, true);
            assert.equal(messageStore.get('m_s2').read, true);

            // Conversation counter should be reconciled to 0
            const updatedConv = conversationStore.get(convAId);
            assert.equal(updatedConv.unreadCountCustomer, 0);
        });

        it('markSellerConversationRead marks customer messages as read and reconciles unreadCountSeller', async () => {
            // Seed unread customer message
            messageStore.set('m_c1', {
                _id: 'm_c1',
                conversationId: convAId,
                senderRole: 'customer',
                senderId: customerAId,
                text: 'Customer inquiry',
                read: false
            });

            conversationStore.get(convAId).unreadCountSeller = 5;

            const req = { params: { id: convAId } };
            const res = createMockRes();

            await markSellerConversationRead(req, res);

            assert.equal(res.getStatusCode(), 200);
            assert.equal(res.getJson().unreadRemaining, 0);
            assert.equal(messageStore.get('m_c1').read, true);

            const updatedConv = conversationStore.get(convAId);
            assert.equal(updatedConv.unreadCountSeller, 0);
        });
    });

    // =========================================================================
    // 7. Fault Tolerance & Compensating Rollback
    // =========================================================================
    describe('7. Fault Tolerance & Compensating Rollback', () => {
        it('sendCustomerMessage performs compensating delete on message if conversation update fails', async () => {
            Conversation.findByIdAndUpdate = async () => {
                throw new Error('Database connection timeout during conversation update');
            };

            const req = {
                userId: customerAId,
                params: { id: convAId },
                body: { text: 'Test message for rollback' }
            };
            const res = createMockRes();

            await sendCustomerMessage(req, res);

            assert.equal(res.getStatusCode(), 500);
            assert.equal(res.getJson().success, false);

            // Verify no orphaned message was persisted in messageStore
            const orphaned = Array.from(messageStore.values()).find(m => m.text === 'Test message for rollback');
            assert.equal(orphaned, undefined);
        });

        it('sendSellerReply performs compensating delete on message if conversation update fails', async () => {
            Conversation.findByIdAndUpdate = async () => {
                throw new Error('Database connection timeout during conversation update');
            };

            const req = {
                params: { id: convAId },
                body: { text: 'Test seller reply for rollback' }
            };
            const res = createMockRes();

            await sendSellerReply(req, res);

            assert.equal(res.getStatusCode(), 500);
            assert.equal(res.getJson().success, false);

            const orphaned = Array.from(messageStore.values()).find(m => m.text === 'Test seller reply for rollback');
            assert.equal(orphaned, undefined);
        });

        it('initiateConversation performs compensating delete on conversation if initial message creation fails', async () => {
            const freshCustId = '507f1f77bcf86cd799439001';

            Message.create = async () => {
                throw new Error('Disk full during message write');
            };

            const req = {
                userId: freshCustId,
                body: { productId: productAId, initialMessage: 'Initial message will fail' }
            };
            const res = createMockRes();

            await initiateConversation(req, res);

            assert.equal(res.getStatusCode(), 500);
            assert.equal(res.getJson().success, false);

            // Verify empty conversation was rolled back and deleted
            const conv = Array.from(conversationStore.values()).find(c => c.customerId === freshCustId);
            assert.equal(conv, undefined);
        });
    });

    // =========================================================================
    // 8. Rate Limiting Strategy
    // =========================================================================
    describe('8. Rate Limiting Strategy', () => {
        it('chatInitiateKeyGenerator keys on authenticated req.userId when present', () => {
            const req = { userId: customerAId, ip: '127.0.0.1' };
            const key = chatInitiateKeyGenerator(req);
            assert.equal(key, `chat_init_user_${customerAId}`);
        });

        it('chatInitiateKeyGenerator falls back to IP when req.userId is absent', () => {
            const req = { ip: '192.168.1.100' };
            const key = chatInitiateKeyGenerator(req);
            assert.match(key, /chat_init_ip_/);
        });

        it('customerMessageKeyGenerator keys on req.userId when present', () => {
            const req = { userId: customerAId, ip: '127.0.0.1' };
            const key = customerMessageKeyGenerator(req);
            assert.equal(key, `chat_msg_user_${customerAId}`);
        });

        it('sellerReplyKeyGenerator keys strictly on IP address', () => {
            const req = { ip: '10.0.0.1' };
            const key = sellerReplyKeyGenerator(req);
            assert.match(key, /chat_seller_reply_ip_/);
        });

        it('rate limiter returns HTTP 429 when threshold exceeded', async () => {
            const strictLimiter = createCustomerMessageLimiter({ limit: 2, windowMs: 60000 });
            const req = createLimiterMockReq(customerAId, '127.0.0.1');

            const run = async () => {
                const res = createLimiterMockRes();
                let nextCalled = false;
                await strictLimiter(req, res, () => { nextCalled = true; });
                return { res, nextCalled };
            };

            const r1 = await run();
            assert.equal(r1.nextCalled, true);
            assert.equal(r1.res.getStatusCode(), 200);

            const r2 = await run();
            assert.equal(r2.nextCalled, true);
            assert.equal(r2.res.getStatusCode(), 200);

            // 3rd hit should trigger 429
            const r3 = await run();
            assert.equal(r3.nextCalled, false);
            assert.equal(r3.res.getStatusCode(), 429);
            assert.equal(r3.res.getJson().success, false);
        });

        it('production singleton limiters are properly configured and exported', () => {
            assert.equal(typeof chatInitiateLimiter, 'function');
            assert.equal(typeof customerMessageLimiter, 'function');
            assert.equal(typeof sellerReplyLimiter, 'function');
        });
    });

    // =========================================================================
    // 9. Automatic Reply & Seller Privacy Suite (Objective 1 & Objective 2)
    // =========================================================================
    describe('9. Automatic Reply & Seller Privacy Suite', () => {
        const freshCustomer = '507f1f77bcf86cd799439099';
        let freshConvId;

        beforeEach(() => {
            freshConvId = '507f1f77bcf86cd7994390aa';
            conversationStore.set(freshConvId, {
                _id: freshConvId,
                customerId: freshCustomer,
                lastMessage: '',
                lastMessageAt: new Date(),
                unreadCountCustomer: 0,
                unreadCountSeller: 0,
                autoReplySent: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        });

        // 1. First customer message creates exactly one automatic seller reply
        it('1. First customer message creates exactly one automatic seller reply with exact Bengali text', async () => {
            const req = {
                userId: freshCustomer,
                params: { id: freshConvId },
                body: { text: 'Hello, what are your delivery times?' }
            };
            const res = createMockRes();

            await sendCustomerMessage(req, res);

            assert.equal(res.getStatusCode(), 200);
            assert.equal(res.getJson().success, true);
            assert.equal(res.getJson().message.text, 'Hello, what are your delivery times?');
            assert.equal(res.getJson().message.senderRole, 'customer');

            // Verify messages created in conversation
            const convMessages = Array.from(messageStore.values())
                .filter(m => m.conversationId.toString() === freshConvId);
            assert.equal(convMessages.length, 2);

            const autoReply = convMessages.find(m => m.senderRole === 'seller');
            assert.ok(autoReply, 'Automatic seller reply must exist');
            assert.equal(autoReply.text, AUTO_REPLY_MESSAGE);
            assert.equal(autoReply.senderRole, 'seller');
            assert.equal(autoReply.senderId, 'seller');

            // Verify conversation state
            const conv = conversationStore.get(freshConvId);
            assert.equal(conv.autoReplySent, true);
            assert.equal(conv.lastMessage, AUTO_REPLY_MESSAGE);
            assert.equal(conv.unreadCountSeller, 1);
            assert.equal(conv.unreadCountCustomer, 1);
        });

        // 2. Second customer message does not create another automatic reply
        it('2. Second customer message in same conversation does not create another automatic reply', async () => {
            // First message
            const req1 = {
                userId: freshCustomer,
                params: { id: freshConvId },
                body: { text: 'First inquiry' }
            };
            const res1 = createMockRes();
            await sendCustomerMessage(req1, res1);

            const countAfterFirst = Array.from(messageStore.values())
                .filter(m => m.conversationId.toString() === freshConvId).length;
            assert.equal(countAfterFirst, 2); // 1 customer + 1 auto-reply

            // Second message
            const req2 = {
                userId: freshCustomer,
                params: { id: freshConvId },
                body: { text: 'Second follow-up message' }
            };
            const res2 = createMockRes();
            await sendCustomerMessage(req2, res2);

            assert.equal(res2.getStatusCode(), 200);
            const convMessagesAfterSecond = Array.from(messageStore.values())
                .filter(m => m.conversationId.toString() === freshConvId);
            assert.equal(convMessagesAfterSecond.length, 3); // 2 customer + 1 auto-reply

            const autoReplies = convMessagesAfterSecond.filter(m => m.text === AUTO_REPLY_MESSAGE);
            assert.equal(autoReplies.length, 1, 'Only one auto-reply must exist in the conversation');

            const conv = conversationStore.get(freshConvId);
            assert.equal(conv.lastMessage, 'Second follow-up message');
            assert.equal(conv.unreadCountSeller, 2);
            assert.equal(conv.unreadCountCustomer, 1);
        });

        // 3. A new conversation receives its own automatic reply
        it('3. A new conversation receives its own automatic reply', async () => {
            const secondConvId = '507f1f77bcf86cd7994390bb';
            conversationStore.set(secondConvId, {
                _id: secondConvId,
                customerId: freshCustomer,
                lastMessage: '',
                lastMessageAt: new Date(),
                unreadCountCustomer: 0,
                unreadCountSeller: 0,
                autoReplySent: false,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Message to conversation 1
            await sendCustomerMessage(
                { userId: freshCustomer, params: { id: freshConvId }, body: { text: 'Question for thread 1' } },
                createMockRes()
            );

            // Message to conversation 2
            await sendCustomerMessage(
                { userId: freshCustomer, params: { id: secondConvId }, body: { text: 'Question for thread 2' } },
                createMockRes()
            );

            const conv1Replies = Array.from(messageStore.values())
                .filter(m => m.conversationId.toString() === freshConvId && m.senderRole === 'seller');
            const conv2Replies = Array.from(messageStore.values())
                .filter(m => m.conversationId.toString() === secondConvId && m.senderRole === 'seller');

            assert.equal(conv1Replies.length, 1);
            assert.equal(conv2Replies.length, 1);
            assert.equal(conv1Replies[0].text, AUTO_REPLY_MESSAGE);
            assert.equal(conv2Replies[0].text, AUTO_REPLY_MESSAGE);
        });

        // 4. Seller messages do not trigger automatic replies
        it('4. Seller messages do not trigger automatic replies', async () => {
            const messagesBefore = messageStore.size;

            const req = {
                params: { id: freshConvId },
                body: { text: 'Hello, I am seller replying first.' }
            };
            const res = createMockRes();

            await sendSellerReply(req, res);

            assert.equal(res.getStatusCode(), 200);
            assert.equal(res.getJson().success, true);
            assert.equal(res.getJson().message.senderRole, 'seller');
            assert.equal(res.getJson().message.senderId, 'seller');
            assert.notEqual(res.getJson().message.senderId, SELLER_EMAIL_TEST);

            // Messages should have increased by exactly 1 (seller message only)
            const convMessages = Array.from(messageStore.values())
                .filter(m => m.conversationId.toString() === freshConvId);
            assert.equal(convMessages.length, 1);
            assert.equal(convMessages[0].text, 'Hello, I am seller replying first.');

            // Verify no Bengali auto-reply was generated
            const autoReplies = convMessages.filter(m => m.text === AUTO_REPLY_MESSAGE);
            assert.equal(autoReplies.length, 0);
        });

        // 5. Concurrent first-message requests cannot create duplicate replies
        it('5. Concurrent first-message requests cannot create duplicate replies', async () => {
            const req1 = {
                userId: freshCustomer,
                params: { id: freshConvId },
                body: { text: 'Concurrent message A' }
            };
            const req2 = {
                userId: freshCustomer,
                params: { id: freshConvId },
                body: { text: 'Concurrent message B' }
            };

            const res1 = createMockRes();
            const res2 = createMockRes();

            // Run concurrently
            await Promise.all([
                sendCustomerMessage(req1, res1),
                sendCustomerMessage(req2, res2)
            ]);

            assert.equal(res1.getStatusCode(), 200);
            assert.equal(res2.getStatusCode(), 200);

            const convMessages = Array.from(messageStore.values())
                .filter(m => m.conversationId.toString() === freshConvId);

            // Expect 2 customer messages + exactly 1 auto-reply = 3 messages total
            assert.equal(convMessages.length, 3);
            const autoReplies = convMessages.filter(m => m.text === AUTO_REPLY_MESSAGE);
            assert.equal(autoReplies.length, 1, 'Concurrent requests must produce exactly ONE automatic reply');
        });

        // 6. Automatic reply is visible in customer and seller message history
        it('6. Automatic reply is visible in customer and seller message history', async () => {
            // Send first message
            await sendCustomerMessage(
                { userId: freshCustomer, params: { id: freshConvId }, body: { text: 'Checking visibility' } },
                createMockRes()
            );

            // Customer views history
            const custReq = { userId: freshCustomer, params: { id: freshConvId }, query: {} };
            const custRes = createMockRes();
            await getCustomerMessages(custReq, custRes);

            assert.equal(custRes.getStatusCode(), 200);
            const custHistory = custRes.getJson().messages;
            const custAutoReply = custHistory.find(m => m.text === AUTO_REPLY_MESSAGE);
            assert.ok(custAutoReply, 'Auto-reply must be in customer message history');
            assert.equal(custAutoReply.senderRole, 'seller');
            assert.equal(custAutoReply.senderId, 'seller');

            // Seller views history
            const sellerReq = { params: { id: freshConvId }, query: {} };
            const sellerRes = createMockRes();
            await getSellerMessages(sellerReq, sellerRes);

            assert.equal(sellerRes.getStatusCode(), 200);
            const sellerHistory = sellerRes.getJson().messages;
            const sellerAutoReply = sellerHistory.find(m => m.text === AUTO_REPLY_MESSAGE);
            assert.ok(sellerAutoReply, 'Auto-reply must be in seller message history');
            assert.equal(sellerAutoReply.senderRole, 'seller');
            assert.equal(sellerAutoReply.senderId, 'seller');
        });

        // 7. Customer API responses never expose the seller login email
        it('7. Customer API responses never expose the seller login email (even with legacy records)', async () => {
            // Seed a legacy seller message with raw seller email
            messageStore.set('legacy_seller_msg', {
                _id: 'legacy_seller_msg',
                conversationId: freshConvId,
                senderRole: 'seller',
                senderId: SELLER_EMAIL_TEST,
                text: 'Legacy reply from seller with email',
                read: false,
                createdAt: new Date()
            });

            // Customer fetches message history
            const req = { userId: freshCustomer, params: { id: freshConvId }, query: {} };
            const res = createMockRes();
            await getCustomerMessages(req, res);

            assert.equal(res.getStatusCode(), 200);
            const jsonStr = JSON.stringify(res.getJson());
            assert.equal(
                jsonStr.includes(SELLER_EMAIL_TEST),
                false,
                'Customer message-history response must never contain seller email'
            );

            const legacyMsg = res.getJson().messages.find(m => m._id === 'legacy_seller_msg');
            assert.ok(legacyMsg);
            assert.equal(legacyMsg.senderId, 'seller');
            assert.equal(legacyMsg.senderRole, 'seller');
        });

        // 8. Seller API responses preserve correct sender information
        it('8. Seller API responses preserve correct customer and seller identity without exposing secrets', async () => {
            messageStore.set('test_cust_m', {
                _id: 'test_cust_m',
                conversationId: freshConvId,
                senderRole: 'customer',
                senderId: freshCustomer,
                text: 'Customer text',
                read: false,
                createdAt: new Date(1000)
            });
            messageStore.set('test_seller_m', {
                _id: 'test_seller_m',
                conversationId: freshConvId,
                senderRole: 'seller',
                senderId: 'seller',
                text: 'Seller text',
                read: true,
                createdAt: new Date(2000)
            });

            const req = { params: { id: freshConvId }, query: {} };
            const res = createMockRes();
            await getSellerMessages(req, res);

            assert.equal(res.getStatusCode(), 200);
            const messages = res.getJson().messages;
            assert.equal(messages.length, 2);

            const custMsg = messages.find(m => m.senderRole === 'customer');
            assert.equal(custMsg.senderId, freshCustomer);

            const sellerMsg = messages.find(m => m.senderRole === 'seller');
            assert.equal(sellerMsg.senderId, 'seller');

            const payloadStr = JSON.stringify(res.getJson());
            assert.equal(payloadStr.includes(JWT_SECRET_TEST), false);
            assert.equal(payloadStr.includes('password'), false);
        });

        // 9. Unread counts and lastMessage metadata remain consistent
        it('9. Unread counts and lastMessage metadata remain consistent through full read lifecycle', async () => {
            // Step 1: Customer sends first message
            await sendCustomerMessage(
                { userId: freshCustomer, params: { id: freshConvId }, body: { text: 'First inquiry' } },
                createMockRes()
            );

            let conv = conversationStore.get(freshConvId);
            assert.equal(conv.lastMessage, AUTO_REPLY_MESSAGE);
            assert.equal(conv.unreadCountCustomer, 1);
            assert.equal(conv.unreadCountSeller, 1);

            // Step 2: Customer marks conversation read
            await markCustomerConversationRead(
                { userId: freshCustomer, params: { id: freshConvId } },
                createMockRes()
            );

            conv = conversationStore.get(freshConvId);
            assert.equal(conv.unreadCountCustomer, 0);
            assert.equal(conv.unreadCountSeller, 1); // Seller still hasn't read customer message

            // Step 3: Seller marks conversation read
            await markSellerConversationRead(
                { params: { id: freshConvId } },
                createMockRes()
            );

            conv = conversationStore.get(freshConvId);
            assert.equal(conv.unreadCountCustomer, 0);
            assert.equal(conv.unreadCountSeller, 0);
        });
    });
});
