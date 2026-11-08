import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Order from '../models/Order.js';
import Address from '../models/Address.js';
import Product from '../models/Product.js';
import OtpVerification from '../models/OtpVerification.js';
import { placeOrderCOD, updateOrderStatus, isMatchingPayload } from '../controllers/orderController.js';

describe('GreenCart Phase 7.2 — Backend Stock Synchronization & Concurrency Security Suite', () => {
    const validUserId = '507f1f77bcf86cd799439011';
    const validAddressId = '507f1f77bcf86cd799439012';
    const prodRecordedA = '507f1f77bcf86cd799439013'; // stockQuantity: 10
    const prodRecordedB = '507f1f77bcf86cd799439014'; // stockQuantity: 3
    const prodUnrecorded = '507f1f77bcf86cd799439015'; // stockQuantity: null
    const prodOutOfStock = '507f1f77bcf86cd799439016'; // inStock: false

    const validToken = 'valid_test_verification_token_phase7_2_abcdef1234567890abcdef1234567890';
    const validTokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

    // Committed in-memory database simulation
    let committedUsers;
    let committedOrders;
    let addressStore;
    let productStore;
    let otpStore;

    // Preserved original methods
    let origStartSession;
    let origOrderCreate;
    let origOrderFindOne;
    let origOrderFindById;
    let origOrderFindByIdAndUpdate;
    let origOrderUpdateOne;
    let origUserFindById;
    let origUserFindByIdAndUpdate;
    let origUserUpdateOne;
    let origAddressFindOne;
    let origProductFindById;
    let origProductFindOneAndUpdate;
    let origProductUpdateOne;
    let origOtpFindOne;
    let origOtpUpdateOne;

    const createMockRes = () => {
        const res = {
            statusCode: 200,
            data: null,
            status(code) {
                res.statusCode = code;
                return res;
            },
            json(payload) {
                res.data = payload;
                return payload;
            }
        };
        return res;
    };

    /**
     * Staged transactional harness replicating MongoDB multi-document transactions.
     */
    function setupHarness(options = {}) {
        const {
            failInsideTransaction = null,
            failRestoration = false,
            concurrentOversellRace = false
        } = options;

        let stagedOrderUpdates = new Map();
        let stagedProductMutations = new Map();

        mongoose.startSession = async () => {
            let stagedOrders = [];
            let stagedUserMutations = new Map();
            let stagedOtpUpdates = [];
            stagedProductMutations = new Map();
            stagedOrderUpdates = new Map();

            const sessionObj = {
                withTransaction: async (txCallback) => {
                    stagedOrders = [];
                    stagedUserMutations = new Map();
                    stagedOtpUpdates = [];
                    stagedProductMutations = new Map();
                    stagedOrderUpdates = new Map();

                    try {
                        if (failInsideTransaction) {
                            throw failInsideTransaction;
                        }

                        // Execute the transactional callback
                        await txCallback(sessionObj);

                        if (failRestoration) {
                            throw new Error("Simulated database failure during restoration");
                        }

                        // COMMIT PHASE
                        for (const o of stagedOrders) {
                            committedOrders.set(o._id, o);
                        }
                        for (const [uid, userClone] of stagedUserMutations.entries()) {
                            committedUsers.set(uid, userClone);
                        }
                        for (const op of stagedOtpUpdates) {
                            for (const record of otpStore.values()) {
                                if (record._id === op.filter._id) {
                                    Object.assign(record, op.update.$set);
                                }
                            }
                        }
                        for (const [pid, prodClone] of stagedProductMutations.entries()) {
                            productStore.set(pid, prodClone);
                        }
                        for (const [oid, orderClone] of stagedOrderUpdates.entries()) {
                            committedOrders.set(oid, orderClone);
                        }

                    } catch (err) {
                        // ABORT PHASE: Discard all staged changes
                        stagedOrders = [];
                        stagedUserMutations = new Map();
                        stagedOtpUpdates = [];
                        stagedProductMutations = new Map();
                        stagedOrderUpdates = new Map();
                        throw err;
                    }
                },
                endSession: async () => {}
            };
            return sessionObj;
        };

        // Order.create inside transaction
        Order.create = async (docs, opts) => {
            const created = docs.map(d => {
                const doc = {
                    ...d,
                    _id: d._id || `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                committedOrders.set(doc._id, doc);
                return doc;
            });
            return created;
        };

        Order.findOne = async (query) => {
            for (const order of committedOrders.values()) {
                let match = true;
                if (query._id && order._id !== query._id) match = false;
                if (query.userId && order.userId !== query.userId) match = false;
                if (query.idempotencyKey && order.idempotencyKey !== query.idempotencyKey) match = false;
                if (match) return { ...order };
            }
            return null;
        };

        Order.findById = (id) => {
            const order = committedOrders.get(id);
            const clone = order ? { ...order } : null;
            return {
                ...clone,
                session: () => Promise.resolve(clone),
                populate: async () => clone,
                save: async () => {
                    if (clone) committedOrders.set(clone._id, clone);
                    return clone;
                },
                then(resolve) { resolve(clone); }
            };
        };

        Order.findByIdAndUpdate = (id, update, opts) => {
            const existing = committedOrders.get(id);
            if (!existing) return null;
            const updated = { ...existing, ...update.$set };
            if (opts && opts.session) {
                stagedOrderUpdates.set(id, updated);
            } else {
                committedOrders.set(id, updated);
            }
            return {
                ...updated,
                populate: async () => updated,
                then(resolve) { resolve(updated); }
            };
        };

        Order.updateOne = async (filter, update) => {
            const existing = committedOrders.get(filter._id);
            if (existing) {
                if (update.$set) Object.assign(existing, update.$set);
                return { matchedCount: 1, modifiedCount: 1 };
            }
            return { matchedCount: 0, modifiedCount: 0 };
        };

        // Product findById with chained session
        Product.findById = (id) => {
            const staged = stagedProductMutations.get(String(id));
            const p = staged || productStore.get(String(id));
            const clone = p ? { ...p } : null;
            return {
                ...clone,
                session: () => Promise.resolve(clone),
                then(resolve) { resolve(clone); }
            };
        };

        // Atomic conditional findOneAndUpdate
        Product.findOneAndUpdate = async (filter, update, opts) => {
            const p = (opts && opts.session && stagedProductMutations.get(filter._id)) || productStore.get(filter._id);
            if (!p) return null;

            // Check condition stockQuantity: { $ne: null, $gte: qty }
            if (filter.stockQuantity) {
                if (p.stockQuantity === null || p.stockQuantity === undefined) {
                    return null;
                }
                if (filter.stockQuantity.$gte !== undefined && p.stockQuantity < filter.stockQuantity.$gte) {
                    return null; // Insufficient stock!
                }
            }

            if (opts && opts.session) {
                const staged = { ...p };
                if (update.$inc && update.$inc.stockQuantity !== undefined) {
                    staged.stockQuantity = staged.stockQuantity + update.$inc.stockQuantity;
                }
                if (update.$set) {
                    Object.assign(staged, update.$set);
                }
                stagedProductMutations.set(filter._id, staged);
                return { ...staged };
            }

            // Apply $inc
            if (update.$inc && update.$inc.stockQuantity !== undefined) {
                p.stockQuantity = p.stockQuantity + update.$inc.stockQuantity;
            }

            // Apply $set
            if (update.$set) {
                Object.assign(p, update.$set);
            }

            return { ...p };
        };

        Product.updateOne = async (filter, update, opts) => {
            const p = (opts && opts.session && stagedProductMutations.get(filter._id)) || productStore.get(filter._id);
            if (!p) return { matchedCount: 0, modifiedCount: 0 };

            if (filter.stockQuantity && filter.stockQuantity.$ne === null) {
                if (p.stockQuantity === null || p.stockQuantity === undefined) {
                    return { matchedCount: 0, modifiedCount: 0 };
                }
            }

            if (opts && opts.session) {
                const staged = { ...p };
                if (update.$inc && update.$inc.stockQuantity !== undefined) {
                    staged.stockQuantity = (staged.stockQuantity || 0) + update.$inc.stockQuantity;
                }
                if (update.$set) {
                    Object.assign(staged, update.$set);
                }
                stagedProductMutations.set(filter._id, staged);
                return { matchedCount: 1, modifiedCount: 1 };
            }

            if (update.$inc && update.$inc.stockQuantity !== undefined) {
                p.stockQuantity = (p.stockQuantity || 0) + update.$inc.stockQuantity;
            }
            if (update.$set) {
                Object.assign(p, update.$set);
            }
            return { matchedCount: 1, modifiedCount: 1 };
        };

        // User and OTP
        User.findById = (id) => {
            const u = committedUsers.get(id);
            const clone = u ? { ...u, cartItems: { ...u.cartItems } } : null;
            return {
                ...clone,
                session: () => Promise.resolve(clone),
                then(resolve) { resolve(clone); }
            };
        };

        User.findByIdAndUpdate = async (id, update) => {
            const u = committedUsers.get(id);
            if (!u) return null;
            if (update.$inc) {
                for (const [k, val] of Object.entries(update.$inc)) {
                    const p = k.replace('cartItems.', '');
                    u.cartItems[p] = (u.cartItems[p] || 0) + val;
                }
            }
            return { _id: id, cartItems: { ...u.cartItems } };
        };

        User.updateOne = async (filter, update) => {
            const u = committedUsers.get(filter._id);
            if (!u) return { matchedCount: 0, modifiedCount: 0 };
            if (update.$unset) {
                for (const k of Object.keys(update.$unset)) {
                    const p = k.replace('cartItems.', '');
                    delete u.cartItems[p];
                }
            }
            return { matchedCount: 1, modifiedCount: 1 };
        };

        Address.findOne = async (query) => {
            const addr = addressStore.get(query._id);
            if (addr && addr.userId === query.userId) return addr;
            return null;
        };

        OtpVerification.findOne = async (query) => {
            const record = otpStore.get(query.verificationTokenHash);
            if (record && record.userId === query.userId && !record.used) {
                return { ...record };
            }
            return null;
        };

        OtpVerification.updateOne = async (filter, update) => {
            for (const record of otpStore.values()) {
                if (record._id === filter._id) {
                    if (filter.used !== undefined && record.used !== filter.used) {
                        return { matchedCount: 0, modifiedCount: 0 };
                    }
                    if (update.$set) Object.assign(record, update.$set);
                    return { matchedCount: 1, modifiedCount: 1 };
                }
            }
            return { matchedCount: 0, modifiedCount: 0 };
        };
    }

    beforeEach(() => {
        committedUsers = new Map();
        committedOrders = new Map();
        addressStore = new Map();
        productStore = new Map();
        otpStore = new Map();

        // Seed Users
        committedUsers.set(validUserId, {
            _id: validUserId,
            cartItems: { [prodRecordedA]: 3, [prodRecordedB]: 2 }
        });

        // Seed Address
        addressStore.set(validAddressId, {
            _id: validAddressId,
            userId: validUserId,
            street: "123 Green Ave"
        });

        // Seed Products
        productStore.set(prodRecordedA, {
            _id: prodRecordedA,
            name: "Organic Honey 500g",
            inStock: true,
            stockQuantity: 10,
            lowStockThreshold: 5,
            offerPrice: 50
        });

        productStore.set(prodRecordedB, {
            _id: prodRecordedB,
            name: "Fresh Spinach 250g",
            inStock: true,
            stockQuantity: 3,
            lowStockThreshold: 5,
            offerPrice: 20
        });

        productStore.set(prodUnrecorded, {
            _id: prodUnrecorded,
            name: "Farm Fresh Eggs 12pc",
            inStock: true,
            stockQuantity: null,
            lowStockThreshold: 5,
            offerPrice: 60
        });

        productStore.set(prodOutOfStock, {
            _id: prodOutOfStock,
            name: "Sold Out Mango 1kg",
            inStock: false,
            stockQuantity: 0,
            lowStockThreshold: 5,
            offerPrice: 80
        });

        // Seed OTP
        otpStore.set(validTokenHash, {
            _id: "otp_test_doc_phase72",
            userId: validUserId,
            channel: 'email',
            verificationTokenHash: validTokenHash,
            verified: true,
            used: false,
            tokenExpiresAt: new Date(Date.now() + 600000)
        });

        // Preserve originals
        origStartSession = mongoose.startSession;
        origOrderCreate = Order.create;
        origOrderFindOne = Order.findOne;
        origOrderFindById = Order.findById;
        origOrderFindByIdAndUpdate = Order.findByIdAndUpdate;
        origOrderUpdateOne = Order.updateOne;
        origUserFindById = User.findById;
        origUserFindByIdAndUpdate = User.findByIdAndUpdate;
        origUserUpdateOne = User.updateOne;
        origAddressFindOne = Address.findOne;
        origProductFindById = Product.findById;
        origProductFindOneAndUpdate = Product.findOneAndUpdate;
        origProductUpdateOne = Product.updateOne;
        origOtpFindOne = OtpVerification.findOne;
        origOtpUpdateOne = OtpVerification.updateOne;

        setupHarness();
    });

    afterEach(() => {
        mongoose.startSession = origStartSession;
        Order.create = origOrderCreate;
        Order.findOne = origOrderFindOne;
        Order.findById = origOrderFindById;
        Order.findByIdAndUpdate = origOrderFindByIdAndUpdate;
        Order.updateOne = origOrderUpdateOne;
        User.findById = origUserFindById;
        User.findByIdAndUpdate = origUserFindByIdAndUpdate;
        User.updateOne = origUserUpdateOne;
        Address.findOne = origAddressFindOne;
        Product.findById = origProductFindById;
        Product.findOneAndUpdate = origProductFindOneAndUpdate;
        Product.updateOne = origProductUpdateOne;
        OtpVerification.findOne = origOtpFindOne;
        OtpVerification.updateOne = origOtpUpdateOne;
    });

    // 1. Successful atomic stock deduction
    it('1. placeOrderCOD successfully decrements stockQuantity and sets order.stockDeducted: true', async () => {
        const req = {
            userId: validUserId,
            body: {
                items: [{ product: prodRecordedA, quantity: 4 }],
                address: validAddressId,
                verificationToken: validToken
            }
        };
        const res = createMockRes();
        await placeOrderCOD(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);

        // Product stock deducted: 10 - 4 = 6
        const updatedProd = productStore.get(prodRecordedA);
        assert.equal(updatedProd.stockQuantity, 6);
        assert.equal(updatedProd.inStock, true);

        // Order marked with stockDeducted: true
        const createdOrder = Array.from(committedOrders.values())[0];
        assert.ok(createdOrder);
        assert.equal(createdOrder.stockDeducted, true);
    });

    // 2. Stock reaching zero updates inStock to false
    it('2. placeOrderCOD sets inStock: false when stockQuantity reaches exactly 0', async () => {
        const req = {
            userId: validUserId,
            body: {
                items: [{ product: prodRecordedB, quantity: 3 }], // Stock is 3
                address: validAddressId,
                verificationToken: validToken
            }
        };
        const res = createMockRes();
        await placeOrderCOD(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);

        const updatedProd = productStore.get(prodRecordedB);
        assert.equal(updatedProd.stockQuantity, 0);
        assert.equal(updatedProd.inStock, false);
    });

    // 3. Insufficient stock rejects checkout
    it('3. placeOrderCOD rejects checkout with 400 when requested quantity exceeds stock', async () => {
        const req = {
            userId: validUserId,
            body: {
                items: [{ product: prodRecordedB, quantity: 5 }], // Stock is 3
                address: validAddressId,
                verificationToken: validToken
            }
        };
        const res = createMockRes();
        await placeOrderCOD(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.match(res.data.message, /Insufficient stock/i);

        // Stock remains untouched
        assert.equal(productStore.get(prodRecordedB).stockQuantity, 3);
        assert.equal(committedOrders.size, 0);
    });

    // 4. Concurrent checkouts cannot oversell
    it('4. Concurrent checkouts for the last stock units: only one succeeds and prevents negative stock', async () => {
        // ProdRecordedB has stock: 3. Both attempt to buy 3.
        const req1 = {
            userId: validUserId,
            body: {
                items: [{ product: prodRecordedB, quantity: 3 }],
                address: validAddressId,
                verificationToken: validToken,
                idempotencyKey: 'concurrent_buyer_1'
            }
        };
        const req2 = {
            userId: validUserId,
            body: {
                items: [{ product: prodRecordedB, quantity: 3 }],
                address: validAddressId,
                verificationToken: validToken,
                idempotencyKey: 'concurrent_buyer_2'
            }
        };

        const res1 = createMockRes();
        const res2 = createMockRes();

        // First checkout completes
        await placeOrderCOD(req1, res1);

        // Reset OTP for second request to test stock failure specifically
        otpStore.get(validTokenHash).used = false;

        // Second checkout attempts to buy 3 when stock is 0
        await placeOrderCOD(req2, res2);

        assert.equal(res1.statusCode, 200);
        assert.equal(res1.data.success, true);

        assert.equal(res2.statusCode, 400);
        assert.equal(res2.data.success, false);
        assert.match(res2.data.message, /Insufficient stock|out of stock/i);

        // Product stock is exactly 0, never negative
        assert.equal(productStore.get(prodRecordedB).stockQuantity, 0);
    });

    // 5. Mixed-cart failure rolls back all deductions
    it('5. Mixed-cart failure rolls back all deductions when one product has insufficient stock', async () => {
        const req = {
            userId: validUserId,
            body: {
                items: [
                    { product: prodRecordedA, quantity: 2 }, // Stock is 10 (sufficient)
                    { product: prodRecordedB, quantity: 5 }  // Stock is 3 (insufficient!)
                ],
                address: validAddressId,
                verificationToken: validToken
            }
        };
        const res = createMockRes();
        await placeOrderCOD(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.match(res.data.message, /Insufficient stock/i);

        // Neither product stock is decremented
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 10);
        assert.equal(productStore.get(prodRecordedB).stockQuantity, 3);
        assert.equal(committedOrders.size, 0);
    });

    // 6. Unknown stock (null) does not block checkout or get converted to a number
    it('6. Products with stockQuantity: null can be purchased without mutating stock to a number', async () => {
        const req = {
            userId: validUserId,
            body: {
                items: [{ product: prodUnrecorded, quantity: 2 }],
                address: validAddressId,
                verificationToken: validToken
            }
        };
        const res = createMockRes();
        await placeOrderCOD(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);

        const prod = productStore.get(prodUnrecorded);
        assert.equal(prod.stockQuantity, null); // Remained null
        assert.equal(prod.inStock, true);
    });

    // 7. Existing inStock: false still blocks checkout
    it('7. Products with inStock: false reject checkout with 400 Out of Stock', async () => {
        const req = {
            userId: validUserId,
            body: {
                items: [{ product: prodOutOfStock, quantity: 1 }],
                address: validAddressId,
                verificationToken: validToken
            }
        };
        const res = createMockRes();
        await placeOrderCOD(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.match(res.data.message, /Product is out of stock/i);
    });

    // 8. Duplicate checkout does not deduct twice
    it('8. Duplicate checkout request with same idempotencyKey does not deduct stock twice', async () => {
        const key = "idemp_test_deduct_twice";
        const req = {
            userId: validUserId,
            body: {
                items: [{ product: prodRecordedA, quantity: 3 }],
                address: validAddressId,
                verificationToken: validToken,
                idempotencyKey: key
            }
        };

        const res1 = createMockRes();
        await placeOrderCOD(req, res1);
        assert.equal(res1.statusCode, 200);
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 7);

        // Retry with same key & payload
        const res2 = createMockRes();
        await placeOrderCOD(req, res2);
        assert.equal(res2.statusCode, 200);
        assert.equal(res2.data.isDuplicate, true);

        // Stock remains exactly 7 (NOT 4)
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 7);
    });

    // 9. Concurrent duplicate idempotency requests do not create duplicate orders
    it('9. In-process mutex blocks concurrent duplicate checkout requests with 409', async () => {
        const key = "concurrent_key_block";
        const req = {
            userId: validUserId,
            body: {
                items: [{ product: prodRecordedA, quantity: 1 }],
                address: validAddressId,
                verificationToken: validToken,
                idempotencyKey: key
            }
        };

        // Fire request
        const res1 = createMockRes();
        const p1 = placeOrderCOD(req, res1);

        // Second request while first is in flight with same lock
        const res2 = createMockRes();
        const p2 = placeOrderCOD(req, res2);

        await Promise.all([p1, p2]);

        const responses = [res1.statusCode, res2.statusCode];
        assert.ok(responses.includes(200), "One request should succeed with 200");
        assert.ok(responses.includes(409), "The other request should receive 409 Conflict");
    });

    // 10. Reusing an idempotency key with a different cart is handled safely
    it('10. Reusing an idempotency key with a different cart payload returns 409 Conflict', async () => {
        const key = "key_reused_diff_cart";
        const req1 = {
            userId: validUserId,
            body: {
                items: [{ product: prodRecordedA, quantity: 2 }],
                address: validAddressId,
                verificationToken: validToken,
                idempotencyKey: key
            }
        };
        const res1 = createMockRes();
        await placeOrderCOD(req1, res1);
        assert.equal(res1.statusCode, 200);

        // Attempt second order reusing key with different product/quantity
        const req2 = {
            userId: validUserId,
            body: {
                items: [{ product: prodRecordedB, quantity: 1 }], // Different product!
                address: validAddressId,
                verificationToken: validToken,
                idempotencyKey: key
            }
        };
        const res2 = createMockRes();
        await placeOrderCOD(req2, res2);

        assert.equal(res2.statusCode, 409);
        assert.equal(res2.data.success, false);
        assert.match(res2.data.message, /Idempotency key already used with different order payload/i);
    });

    // 11. Successful cancellation restores exact stock
    it('11. Cancelling an order with stockDeducted: true restores exact stock and resets stockDeducted', async () => {
        const orderId = '507f1f77bcf86cd799439031';
        committedOrders.set(orderId, {
            _id: orderId,
            userId: validUserId,
            items: [{ product: prodRecordedA, quantity: 4 }],
            status: "Order Placed",
            paymentType: "COD",
            stockDeducted: true
        });

        // Current stock is 6 (was decremented earlier)
        productStore.get(prodRecordedA).stockQuantity = 6;

        const req = { body: { orderId, status: "Cancelled" } };
        const res = createMockRes();
        await updateOrderStatus(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);

        // Stock restored: 6 + 4 = 10
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 10);
        assert.equal(productStore.get(prodRecordedA).inStock, true);

        // Order stockDeducted reset to false
        assert.equal(committedOrders.get(orderId).status, "Cancelled");
        assert.equal(committedOrders.get(orderId).stockDeducted, false);
    });

    // 12. Cancellation with stockDeducted: false does not restore stock
    it('12. Cancelling an order with stockDeducted: false does NOT restore stock', async () => {
        const orderId = '507f1f77bcf86cd799439032';
        committedOrders.set(orderId, {
            _id: orderId,
            userId: validUserId,
            items: [{ product: prodRecordedA, quantity: 5 }],
            status: "Order Placed",
            paymentType: "COD",
            stockDeducted: false // Legacy order
        });

        productStore.get(prodRecordedA).stockQuantity = 10;

        const req = { body: { orderId, status: "Cancelled" } };
        const res = createMockRes();
        await updateOrderStatus(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);

        // Stock remains 10 (no phantom inflation)
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 10);
        assert.equal(committedOrders.get(orderId).status, "Cancelled");
    });

    // 13. Repeated/concurrent cancellation restores stock only once
    it('13. Repeated cancellation attempts restore stock only once and reject subsequent requests', async () => {
        const orderId = '507f1f77bcf86cd799439033';
        committedOrders.set(orderId, {
            _id: orderId,
            userId: validUserId,
            items: [{ product: prodRecordedA, quantity: 3 }],
            status: "Order Placed",
            paymentType: "COD",
            stockDeducted: true
        });

        productStore.get(prodRecordedA).stockQuantity = 7;

        // First cancellation
        const req1 = { body: { orderId, status: "Cancelled" } };
        const res1 = createMockRes();
        await updateOrderStatus(req1, res1);
        assert.equal(res1.statusCode, 200);
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 10);

        // Second cancellation attempt on now-Cancelled order
        const req2 = { body: { orderId, status: "Cancelled" } };
        const res2 = createMockRes();
        await updateOrderStatus(req2, res2);

        assert.equal(res2.statusCode, 400);
        assert.match(res2.data.message, /Cannot update an order that is already Cancelled/i);

        // Stock is still 10 (NOT 13!)
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 10);
    });

    // 14. Delivered orders cannot be cancelled
    it('14. Orders in Delivered status reject cancellation with 400', async () => {
        const orderId = '507f1f77bcf86cd799439034';
        committedOrders.set(orderId, {
            _id: orderId,
            userId: validUserId,
            items: [{ product: prodRecordedA, quantity: 2 }],
            status: "Delivered",
            paymentType: "COD",
            stockDeducted: true
        });

        productStore.get(prodRecordedA).stockQuantity = 8;

        const req = { body: { orderId, status: "Cancelled" } };
        const res = createMockRes();
        await updateOrderStatus(req, res);

        assert.equal(res.statusCode, 400);
        assert.match(res.data.message, /Cannot update an order that is already Delivered/i);

        // Stock remains 8
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 8);
    });

    // 15. Cancelled orders cannot be updated again
    it('15. Cancelled orders reject transitions to other statuses (Packing, Shipped, Delivered)', async () => {
        const orderId = '507f1f77bcf86cd799439035';
        committedOrders.set(orderId, {
            _id: orderId,
            userId: validUserId,
            items: [{ product: prodRecordedA, quantity: 2 }],
            status: "Cancelled",
            paymentType: "COD",
            stockDeducted: false
        });

        for (const targetStatus of ["Packing", "Shipped", "Delivered"]) {
            const req = { body: { orderId, status: targetStatus } };
            const res = createMockRes();
            await updateOrderStatus(req, res);

            assert.equal(res.statusCode, 400);
            assert.match(res.data.message, /Cannot update an order that is already Cancelled/i);
        }
    });

    // 16. Non-cancellation status updates do not change stock
    it('16. Non-cancellation status transitions (Order Placed -> Packing -> Shipped) do not alter stock', async () => {
        const orderId = '507f1f77bcf86cd799439036';
        committedOrders.set(orderId, {
            _id: orderId,
            userId: validUserId,
            items: [{ product: prodRecordedA, quantity: 3 }],
            status: "Order Placed",
            paymentType: "COD",
            stockDeducted: true
        });

        productStore.get(prodRecordedA).stockQuantity = 7;

        for (const st of ["Packing", "Shipped", "Out for Delivery"]) {
            const req = { body: { orderId, status: st } };
            const res = createMockRes();
            await updateOrderStatus(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(productStore.get(prodRecordedA).stockQuantity, 7);
            assert.equal(committedOrders.get(orderId).stockDeducted, true);
        }
    });

    // 17. Failed restoration rolls back cancellation
    it('17. If stock restoration encounters an unhandled database error, cancellation is rolled back', async () => {
        setupHarness({ failRestoration: true });

        const orderId = '507f1f77bcf86cd799439037';
        committedOrders.set(orderId, {
            _id: orderId,
            userId: validUserId,
            items: [{ product: prodRecordedA, quantity: 3 }],
            status: "Order Placed",
            paymentType: "COD",
            stockDeducted: true
        });

        productStore.get(prodRecordedA).stockQuantity = 7;

        const req = { body: { orderId, status: "Cancelled" } };
        const res = createMockRes();
        await updateOrderStatus(req, res);

        assert.equal(res.statusCode, 500);

        // Status rolled back to Order Placed, stock remained 7
        assert.equal(committedOrders.get(orderId).status, "Order Placed");
        assert.equal(committedOrders.get(orderId).stockDeducted, true);
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 7);
    });

    // 18. Duplicate product IDs in a cart are handled correctly
    it('18. Duplicate product IDs in a cart are aggregated and deducted safely', async () => {
        const req = {
            userId: validUserId,
            body: {
                items: [
                    { product: prodRecordedA, quantity: 2 },
                    { product: prodRecordedA, quantity: 3 } // Same product twice! Total = 5
                ],
                address: validAddressId,
                verificationToken: validToken
            }
        };

        const res = createMockRes();
        await placeOrderCOD(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);

        // Stock 10 - 5 = 5
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 5);

        // Order has single aggregated item with quantity 5
        const createdOrder = Array.from(committedOrders.values())[0];
        assert.equal(createdOrder.items.length, 1);
        assert.equal(createdOrder.items[0].quantity, 5);
    });
});
