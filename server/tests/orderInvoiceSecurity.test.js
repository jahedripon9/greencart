import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Order from '../models/Order.js';
import Address from '../models/Address.js';
import Product from '../models/Product.js';
import OtpVerification from '../models/OtpVerification.js';
import { placeOrderCOD, getOrderById } from '../controllers/orderController.js';

describe('GreenCart Order Invoice & Historical Price Snapshot Security Suite (Batch 2A)', () => {
    const userA = '507f1f77bcf86cd799439001';
    const userB = '507f1f77bcf86cd799439002';
    const validOrderId = '507f1f77bcf86cd799439010';
    const otherUserOrderId = '507f1f77bcf86cd799439020';
    const nonExistentOrderId = '507f1f77bcf86cd799439099';
    const validAddressId = '507f1f77bcf86cd799439030';
    const prodId1 = '507f1f77bcf86cd799439040';
    const prodId2 = '507f1f77bcf86cd799439041';

    const validToken = 'valid_test_verification_token_invoice_batch2a';
    const validTokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

    // In-memory stores
    let orderStore;
    let productStore;
    let addressStore;
    let otpStore;
    let userStore;

    // Original methods to restore
    let origOrderCreate;
    let origOrderFindOne;
    let origOrderFindById;
    let origProductFindById;
    let origAddressFindOne;
    let origOtpFindOne;
    let origOtpUpdateOne;
    let origUserFindById;
    let origUserFindByIdAndUpdate;
    let origUserUpdateOne;
    let origStartSession;

    beforeEach(() => {
        orderStore = new Map();
        productStore = new Map();
        addressStore = new Map();
        otpStore = new Map();
        userStore = new Map();

        // Seed products with names and offerPrices
        productStore.set(prodId1, {
            _id: prodId1,
            name: 'Organic Basmati Rice 5kg',
            offerPrice: 450,
            inStock: true
        });
        productStore.set(prodId2, {
            _id: prodId2,
            name: 'Fresh Alphonso Mango 1kg',
            offerPrice: 120,
            inStock: true
        });

        // Seed address for userA
        addressStore.set(validAddressId, {
            _id: validAddressId,
            userId: userA,
            firstName: 'John',
            lastName: 'Doe',
            street: '123 Green Ave',
            city: 'Dhaka',
            phone: '01700000000'
        });

        // Seed userA in userStore
        userStore.set(userA, {
            _id: userA,
            cartItems: { [prodId1]: 2, [prodId2]: 1 }
        });

        // Seed OTP record
        otpStore.set(validTokenHash, {
            _id: 'otp_doc_invoice_test',
            userId: userA,
            channel: 'email',
            verificationTokenHash: validTokenHash,
            verified: true,
            used: false,
            tokenExpiresAt: new Date(Date.now() + 600000)
        });

        // Seed existing order for userA (with historical snapshot)
        orderStore.set(validOrderId, {
            _id: validOrderId,
            userId: userA,
            orderNumber: 'GC-INVO01',
            amount: 1040,
            items: [
                {
                    product: prodId1,
                    quantity: 2,
                    name: 'Organic Basmati Rice 5kg',
                    unitPrice: 450
                },
                {
                    product: prodId2,
                    quantity: 1,
                    name: 'Fresh Alphonso Mango 1kg',
                    unitPrice: 120
                }
            ],
            address: validAddressId,
            paymentType: 'COD',
            status: 'Order Placed',
            isPaid: false,
            createdAt: new Date('2026-10-30T10:00:00.000Z')
        });

        // Seed existing order for userB (other user's order)
        orderStore.set(otherUserOrderId, {
            _id: otherUserOrderId,
            userId: userB,
            orderNumber: 'GC-INVO02',
            amount: 450,
            items: [
                {
                    product: prodId1,
                    quantity: 1,
                    name: 'Organic Basmati Rice 5kg',
                    unitPrice: 450
                }
            ],
            address: 'some_other_addr',
            paymentType: 'COD',
            status: 'Order Placed',
            isPaid: false,
            createdAt: new Date('2026-10-30T11:00:00.000Z')
        });

        // Save original methods
        origOrderCreate = Order.create;
        origOrderFindOne = Order.findOne;
        origOrderFindById = Order.findById;
        origProductFindById = Product.findById;
        origAddressFindOne = Address.findOne;
        origOtpFindOne = OtpVerification.findOne;
        origOtpUpdateOne = OtpVerification.updateOne;
        origUserFindById = User.findById;
        origUserFindByIdAndUpdate = User.findByIdAndUpdate;
        origUserUpdateOne = User.updateOne;
        origStartSession = mongoose.startSession;

        // Mock Product.findById
        Product.findById = async (id) => {
            const p = productStore.get(String(id));
            return p ? { ...p } : null;
        };

        // Mock Address.findOne
        Address.findOne = async (query) => {
            const addr = addressStore.get(String(query._id));
            if (addr && (!query.userId || addr.userId === query.userId)) {
                return { ...addr };
            }
            return null;
        };

        // Mock OtpVerification
        OtpVerification.findOne = async (query) => {
            const doc = otpStore.get(query.verificationTokenHash);
            if (doc && !doc.used && doc.verified && doc.tokenExpiresAt > new Date()) {
                return { ...doc };
            }
            return null;
        };
        OtpVerification.updateOne = async (query, update) => {
            for (const [, doc] of otpStore.entries()) {
                if (String(doc._id) === String(query._id) && (!('used' in query) || doc.used === query.used)) {
                    if (update.$set) Object.assign(doc, update.$set);
                    return { modifiedCount: 1 };
                }
            }
            return { modifiedCount: 0 };
        };

        // Mock User
        User.findById = (id) => {
            const u = userStore.get(String(id));
            return {
                session: () => (u ? { ...u } : null),
                then: (resolve) => resolve(u ? { ...u } : null)
            };
        };
        User.findByIdAndUpdate = async (id, update) => {
            const u = userStore.get(String(id));
            if (!u) return null;
            if (update.$inc) {
                for (const [k, v] of Object.entries(update.$inc)) {
                    const prop = k.replace('cartItems.', '');
                    u.cartItems[prop] = (u.cartItems[prop] || 0) + v;
                }
            }
            return { ...u };
        };
        User.updateOne = async () => ({ modifiedCount: 1 });

        // Mock Order.create
        Order.create = async (docs) => {
            const created = [];
            for (const doc of docs) {
                const id = doc._id || new mongoose.Types.ObjectId().toString();
                const newDoc = { _id: id, ...doc };
                orderStore.set(id, newDoc);
                created.push(newDoc);
            }
            return created;
        };

        // Mock Order.findOne with chained .populate
        Order.findOne = (query) => {
            let found = null;
            for (const [, o] of orderStore.entries()) {
                let match = true;
                if (query._id && String(o._id) !== String(query._id)) match = false;
                if (query.userId && String(o.userId) !== String(query.userId)) match = false;
                if (query.idempotencyKey && o.idempotencyKey !== query.idempotencyKey) match = false;
                if (match) {
                    found = { ...o };
                    break;
                }
            }

            const queryObj = {
                populate: async (popFields) => {
                    if (!found) return null;
                    const populated = { ...found };
                    if (popFields && popFields.includes('items.product')) {
                        populated.items = (populated.items || []).map((it) => ({
                            ...it,
                            product: productStore.get(String(it.product)) || it.product
                        }));
                    }
                    if (popFields && popFields.includes('address')) {
                        populated.address = addressStore.get(String(populated.address)) || populated.address;
                    }
                    return populated;
                },
                then: (resolve) => resolve(found)
            };
            return queryObj;
        };

        // Mock mongoose.startSession
        mongoose.startSession = async () => ({
            withTransaction: async (cb) => {
                await cb();
            },
            endSession: async () => {}
        });
    });

    afterEach(() => {
        Order.create = origOrderCreate;
        Order.findOne = origOrderFindOne;
        Order.findById = origOrderFindById;
        Product.findById = origProductFindById;
        Address.findOne = origAddressFindOne;
        OtpVerification.findOne = origOtpFindOne;
        OtpVerification.updateOne = origOtpUpdateOne;
        User.findById = origUserFindById;
        User.findByIdAndUpdate = origUserFindByIdAndUpdate;
        User.updateOne = origUserUpdateOne;
        mongoose.startSession = origStartSession;
    });

    // ==========================================
    // 1. Historical Product Snapshot Tests
    // ==========================================
    describe('1. Historical Product Snapshot Persistence', () => {
        it('saves product name and exact unit price snapshots upon checkout', async () => {
            const req = {
                userId: userA,
                body: {
                    items: [
                        { product: prodId1, quantity: 2 },
                        { product: prodId2, quantity: 1 }
                    ],
                    address: validAddressId,
                    verificationToken: validToken
                }
            };

            let responseData = null;
            const res = {
                status: () => res,
                json: (d) => { responseData = d; return res; }
            };

            await placeOrderCOD(req, res);

            assert.strictEqual(responseData.success, true);
            assert.ok(responseData.orderId);

            // Fetch created order from orderStore
            const savedOrder = orderStore.get(responseData.orderId);
            assert.ok(savedOrder);
            assert.strictEqual(savedOrder.items.length, 2);

            // Item 1 verification
            const item1 = savedOrder.items[0];
            assert.strictEqual(item1.product, prodId1);
            assert.strictEqual(item1.quantity, 2);
            assert.strictEqual(item1.name, 'Organic Basmati Rice 5kg');
            assert.strictEqual(item1.unitPrice, 450);

            // Item 2 verification
            const item2 = savedOrder.items[1];
            assert.strictEqual(item2.product, prodId2);
            assert.strictEqual(item2.quantity, 1);
            assert.strictEqual(item2.name, 'Fresh Alphonso Mango 1kg');
            assert.strictEqual(item2.unitPrice, 120);

            // Subtotal: (450 * 2) + (120 * 1) = 1020. Tax: Math.floor(1020 * 0.02) = 20. Total: 1040.
            assert.strictEqual(savedOrder.amount, 1040);
        });

        it('preserves existing orders created without snapshot fields', async () => {
            const legacyOrderId = '507f1f77bcf86cd799439055';
            orderStore.set(legacyOrderId, {
                _id: legacyOrderId,
                userId: userA,
                amount: 300,
                items: [
                    {
                        product: prodId1,
                        quantity: 1
                        // Legacy: no name, no unitPrice
                    }
                ],
                address: validAddressId,
                paymentType: 'COD',
                status: 'Delivered',
                isPaid: true
            });

            const req = {
                userId: userA,
                params: { orderId: legacyOrderId }
            };

            let responseData = null;
            const res = {
                status: () => res,
                json: (d) => { responseData = d; return res; }
            };

            await getOrderById(req, res);

            assert.strictEqual(responseData.success, true);
            assert.strictEqual(responseData.order._id, legacyOrderId);
            assert.strictEqual(responseData.order.items[0].quantity, 1);
            assert.strictEqual(responseData.order.items[0].unitPrice, undefined);
            assert.strictEqual(responseData.order.items[0].name, undefined);
            assert.ok(responseData.order.items[0].product);
            assert.strictEqual(responseData.order.items[0].product.name, 'Organic Basmati Rice 5kg');
        });

        it('ensures unitPrice reflects checkout offerPrice even if product regular price differs', async () => {
            const prodWithDiscount = '507f1f77bcf86cd799439090';
            productStore.set(prodWithDiscount, {
                _id: prodWithDiscount,
                name: 'Discounted Olive Oil',
                price: 900,       // regular price
                offerPrice: 650,  // checkout price
                inStock: true
            });

            const req = {
                userId: userA,
                body: {
                    items: [{ product: prodWithDiscount, quantity: 1 }],
                    address: validAddressId,
                    verificationToken: validToken
                }
            };

            let responseData = null;
            const res = {
                status: () => res,
                json: (d) => { responseData = d; return res; }
            };

            await placeOrderCOD(req, res);

            assert.strictEqual(responseData.success, true);
            const savedOrder = orderStore.get(responseData.orderId);
            assert.strictEqual(savedOrder.items[0].unitPrice, 650);
            assert.strictEqual(savedOrder.items[0].name, 'Discounted Olive Oil');
        });
    });

    // ==========================================
    // 2. Single-Order Retrieval API Authorization & IDOR Tests
    // ==========================================
    describe('2. Single-Order Retrieval API & IDOR Protection', () => {
        it('rejects unauthenticated request with 401', async () => {
            const req = {
                userId: null,
                params: { orderId: validOrderId }
            };

            let statusCode = null;
            let responseData = null;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (d) => { responseData = d; return res; }
            };

            await getOrderById(req, res);

            assert.strictEqual(statusCode, 401);
            assert.strictEqual(responseData.success, false);
            assert.strictEqual(responseData.message, 'Not Authorized');
        });

        it('returns 400 for malformed MongoDB ObjectId', async () => {
            const invalidIds = ['not-an-objectid', '12345', '$$invalid$$', '507f1f77bcf86cd79943902Z'];

            for (const orderId of invalidIds) {
                const req = {
                    userId: userA,
                    params: { orderId }
                };

                let statusCode = null;
                let responseData = null;
                const res = {
                    status: (code) => { statusCode = code; return res; },
                    json: (d) => { responseData = d; return res; }
                };

                await getOrderById(req, res);

                assert.strictEqual(statusCode, 400, `Expected 400 for id: ${orderId}`);
                assert.strictEqual(responseData.success, false);
                assert.strictEqual(responseData.message, 'Invalid order ID');
            }
        });

        it('returns valid order owned by authenticated customer (200)', async () => {
            const req = {
                userId: userA,
                params: { orderId: validOrderId }
            };

            let statusCode = 200;
            let responseData = null;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (d) => { responseData = d; return res; }
            };

            await getOrderById(req, res);

            assert.strictEqual(statusCode, 200);
            assert.strictEqual(responseData.success, true);
            assert.ok(responseData.order);
            assert.strictEqual(responseData.order._id, validOrderId);
            assert.strictEqual(responseData.order.userId, userA);
            assert.strictEqual(responseData.order.orderNumber, 'GC-INVO01');
            assert.strictEqual(responseData.order.amount, 1040);

            // Populated items & address verification
            assert.strictEqual(responseData.order.items.length, 2);
            assert.strictEqual(responseData.order.items[0].name, 'Organic Basmati Rice 5kg');
            assert.strictEqual(responseData.order.items[0].unitPrice, 450);
            assert.strictEqual(responseData.order.address.firstName, 'John');
            assert.strictEqual(responseData.order.address.city, 'Dhaka');
        });

        it('rejects cross-customer order access with 404 (IDOR Prevention)', async () => {
            // userA attempts to access userB's order
            const req = {
                userId: userA,
                params: { orderId: otherUserOrderId }
            };

            let statusCode = null;
            let responseData = null;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (d) => { responseData = d; return res; }
            };

            await getOrderById(req, res);

            // Must return 404 to avoid leaking existence of another customer's order
            assert.strictEqual(statusCode, 404);
            assert.strictEqual(responseData.success, false);
            assert.strictEqual(responseData.message, 'Order not found');
        });

        it('returns 404 for non-existent order ID', async () => {
            const req = {
                userId: userA,
                params: { orderId: nonExistentOrderId }
            };

            let statusCode = null;
            let responseData = null;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (d) => { responseData = d; return res; }
            };

            await getOrderById(req, res);

            assert.strictEqual(statusCode, 404);
            assert.strictEqual(responseData.success, false);
            assert.strictEqual(responseData.message, 'Order not found');
        });

        it('handles unexpected database errors with safe 500 without leaking stack trace', async () => {
            // Force Order.findOne to throw unexpected error
            Order.findOne = () => {
                throw new Error('Database cluster connection timed out');
            };

            const req = {
                userId: userA,
                params: { orderId: validOrderId }
            };

            let statusCode = null;
            let responseData = null;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (d) => { responseData = d; return res; }
            };

            await getOrderById(req, res);

            assert.strictEqual(statusCode, 500);
            assert.strictEqual(responseData.success, false);
            assert.strictEqual(responseData.message, 'Internal server error');
            assert.strictEqual(responseData.stack, undefined);
        });
    });
});
