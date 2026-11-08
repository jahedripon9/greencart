import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Order from '../models/Order.js';
import Address from '../models/Address.js';
import Product from '../models/Product.js';
import OtpVerification from '../models/OtpVerification.js';
import { placeOrderCOD, updateOrderStatus } from '../controllers/orderController.js';

/**
 * Customer Cart Logic Mirroring AppContext.jsx implementation
 */
export function simulateAddToCart({ products, cartItems, itemId, quantity = 1 }) {
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
        return { success: false, error: "Please specify a valid quantity of at least 1", cartItems };
    }

    const product = products.find((p) => p._id === itemId);
    if (product) {
        if (product.stockQuantity === 0 || product.inStock === false) {
            return { success: false, error: "This product is currently out of stock.", cartItems };
        }

        if (product.stockQuantity !== null && product.stockQuantity !== undefined) {
            const currentQty = cartItems[itemId] || 0;
            if (currentQty + quantity > product.stockQuantity) {
                const msg = product.stockQuantity <= 0
                    ? "This product is currently out of stock."
                    : currentQty >= product.stockQuantity
                        ? `Only ${product.stockQuantity} items are available.`
                        : `Only ${product.stockQuantity} items are available (${product.stockQuantity - currentQty} more can be added).`;
                return { success: false, error: msg, cartItems };
            }
        }
    }

    const cartData = { ...cartItems };
    const currentQty = cartData[itemId] || 0;

    if (currentQty + quantity > 99) {
        return { success: false, error: "Maximum quantity of 99 reached for this item", cartItems };
    }

    cartData[itemId] = currentQty + quantity;
    return { success: true, cartItems: cartData };
}

export function simulateUpdateCartItem({ products, cartItems, itemId, quantity }) {
    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
        return { success: false, error: "Quantity must be at least 1", cartItems };
    }

    const product = products.find((p) => p._id === itemId);
    if (product) {
        if (product.stockQuantity === 0 || product.inStock === false) {
            return { success: false, error: "This product is currently out of stock.", cartItems };
        }

        if (product.stockQuantity !== null && product.stockQuantity !== undefined) {
            if (quantity > product.stockQuantity) {
                return { success: false, error: `Only ${product.stockQuantity} items are available.`, cartItems };
            }
        }
    }

    const validQty = Math.min(quantity, 99);
    const cartData = { ...cartItems };
    cartData[itemId] = validQty;
    return { success: true, cartItems: cartData };
}

describe('GreenCart Phase 7.5 — Customer Catalog & Cart Protection Suite', () => {
    const validUserId = '64a1b2c3d4e5f6a7b8c9d011';
    const validAddressId = '64a1b2c3d4e5f6a7b8c9d012';
    const prodRecordedA = '64a1b2c3d4e5f6a7b8c9d013'; // stock: 10
    const prodRecordedB = '64a1b2c3d4e5f6a7b8c9d014'; // stock: 3
    const prodUnrecorded = '64a1b2c3d4e5f6a7b8c9d015'; // stock: null
    const prodOutOfStockZero = '64a1b2c3d4e5f6a7b8c9d016'; // stockQuantity: 0
    const prodOutOfStockFlag = '64a1b2c3d4e5f6a7b8c9d017'; // inStock: false

    const validToken = 'phase7_5_verification_token_1234567890abcdef1234567890';
    const validTokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

    let committedUsers;
    let committedOrders;
    let addressStore;
    let productStore;
    let otpStore;

    // Preserved mocks
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

    function setupHarness(options = {}) {
        let stagedProductMutations = new Map();

        mongoose.startSession = async () => {
            const stagedOrders = [];
            stagedProductMutations = new Map();

            const sessionObj = {
                withTransaction: async (txCallback) => {
                    try {
                        await txCallback(sessionObj);
                        for (const o of stagedOrders) {
                            committedOrders.set(o._id, o);
                        }
                        for (const [pid, prodClone] of stagedProductMutations.entries()) {
                            productStore.set(pid, prodClone);
                        }
                    } catch (err) {
                        stagedProductMutations = new Map();
                        throw err;
                    }
                },
                endSession: async () => {}
            };
            return sessionObj;
        };

        Order.create = async (docs) => {
            return docs.map(d => {
                const doc = {
                    ...d,
                    _id: d._id || new mongoose.Types.ObjectId().toString(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                committedOrders.set(doc._id, doc);
                return doc;
            });
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

        Order.findByIdAndUpdate = async (id, update) => {
            const o = committedOrders.get(id);
            if (!o) return null;
            if (update.$set) Object.assign(o, update.$set);
            return { ...o };
        };

        Order.updateOne = async (filter, update) => {
            const o = committedOrders.get(filter._id);
            if (!o) return { matchedCount: 0, modifiedCount: 0 };
            if (filter.stockDeducted !== undefined && o.stockDeducted !== filter.stockDeducted) {
                return { matchedCount: 0, modifiedCount: 0 };
            }
            if (update.$set) Object.assign(o, update.$set);
            return { matchedCount: 1, modifiedCount: 1 };
        };

        Product.findById = (id) => {
            const p = productStore.get(id);
            const clone = p ? { ...p } : null;
            return {
                ...clone,
                session: () => Promise.resolve(clone),
                then(resolve) { resolve(clone); }
            };
        };

        Product.findOneAndUpdate = async (filter, update, opts) => {
            const p = productStore.get(filter._id);
            if (!p) return null;

            if (filter.stockQuantity && filter.stockQuantity.$gte !== undefined) {
                if (p.stockQuantity === null || p.stockQuantity === undefined || p.stockQuantity < filter.stockQuantity.$gte) {
                    return null;
                }
            }

            const staged = { ...p };
            if (update.$inc && update.$inc.stockQuantity !== undefined) {
                staged.stockQuantity += update.$inc.stockQuantity;
            }
            if (update.$set) {
                Object.assign(staged, update.$set);
            }

            if (opts && opts.session) {
                stagedProductMutations.set(filter._id, staged);
            } else {
                productStore.set(filter._id, staged);
            }
            return { ...staged };
        };

        Product.updateOne = async (filter, update, opts) => {
            const p = (opts && opts.session && stagedProductMutations.get(filter._id)) || productStore.get(filter._id);
            if (!p) return { matchedCount: 0, modifiedCount: 0 };
            if (update.$inc && update.$inc.stockQuantity !== undefined) {
                p.stockQuantity = (p.stockQuantity || 0) + update.$inc.stockQuantity;
            }
            if (update.$set) {
                Object.assign(p, update.$set);
            }
            return { matchedCount: 1, modifiedCount: 1 };
        };

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

        committedUsers.set(validUserId, {
            _id: validUserId,
            cartItems: { [prodRecordedA]: 2 }
        });

        addressStore.set(validAddressId, {
            _id: validAddressId,
            userId: validUserId,
            street: "456 Organic Blvd"
        });

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

        productStore.set(prodOutOfStockZero, {
            _id: prodOutOfStockZero,
            name: "Sold Out Butter",
            inStock: false,
            stockQuantity: 0,
            lowStockThreshold: 5,
            offerPrice: 40
        });

        productStore.set(prodOutOfStockFlag, {
            _id: prodOutOfStockFlag,
            name: "Deactivated Product",
            inStock: false,
            stockQuantity: 5,
            lowStockThreshold: 5,
            offerPrice: 70
        });

        otpStore.set(validTokenHash, {
            _id: "otp_test_phase7_5",
            userId: validUserId,
            channel: 'email',
            verificationTokenHash: validTokenHash,
            verified: true,
            used: false,
            tokenExpiresAt: new Date(Date.now() + 600000)
        });

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

    // 1. Out-of-stock product cannot be added to cart
    it('1. Out-of-stock product cannot be added to cart', () => {
        const products = Array.from(productStore.values());
        const cartItems = {};

        // stockQuantity === 0
        const resZero = simulateAddToCart({ products, cartItems, itemId: prodOutOfStockZero, quantity: 1 });
        assert.equal(resZero.success, false);
        assert.equal(resZero.error, "This product is currently out of stock.");
        assert.equal(resZero.cartItems[prodOutOfStockZero], undefined);

        // inStock === false
        const resFlag = simulateAddToCart({ products, cartItems, itemId: prodOutOfStockFlag, quantity: 1 });
        assert.equal(resFlag.success, false);
        assert.equal(resFlag.error, "This product is currently out of stock.");
        assert.equal(resFlag.cartItems[prodOutOfStockFlag], undefined);
    });

    // 2. Null stock preserves existing behavior
    it('2. Null stock preserves existing behavior', () => {
        const products = Array.from(productStore.values());
        let cartItems = {};

        // First add
        const res1 = simulateAddToCart({ products, cartItems, itemId: prodUnrecorded, quantity: 2 });
        assert.equal(res1.success, true);
        assert.equal(res1.cartItems[prodUnrecorded], 2);

        // Update item up to 99
        const resUpdate = simulateUpdateCartItem({ products, cartItems: res1.cartItems, itemId: prodUnrecorded, quantity: 25 });
        assert.equal(resUpdate.success, true);
        assert.equal(resUpdate.cartItems[prodUnrecorded], 25);
    });

    // 3. Positive stock permits valid quantities
    it('3. Positive stock permits valid quantities', () => {
        const products = Array.from(productStore.values());
        let cartItems = {};

        // Add 2 of prodRecordedB (stock 3)
        const res = simulateAddToCart({ products, cartItems, itemId: prodRecordedB, quantity: 2 });
        assert.equal(res.success, true);
        assert.equal(res.cartItems[prodRecordedB], 2);

        // Add 1 more (reaches exact stock 3)
        const res2 = simulateAddToCart({ products, cartItems: res.cartItems, itemId: prodRecordedB, quantity: 1 });
        assert.equal(res2.success, true);
        assert.equal(res2.cartItems[prodRecordedB], 3);
    });

    // 4. Cart quantity cannot exceed recorded stock
    it('4. Cart quantity cannot exceed recorded stock', () => {
        const products = Array.from(productStore.values());
        let cartItems = { [prodRecordedB]: 2 }; // available stock: 3

        // Attempt to add 2 more (2 + 2 = 4 > 3)
        const resAdd = simulateAddToCart({ products, cartItems, itemId: prodRecordedB, quantity: 2 });
        assert.equal(resAdd.success, false);
        assert.match(resAdd.error, /Only 3 items are available/i);
        assert.equal(cartItems[prodRecordedB], 2, "Cart must remain unchanged on failure");

        // Attempt to update directly to 5 (> 3)
        const resUpdate = simulateUpdateCartItem({ products, cartItems, itemId: prodRecordedB, quantity: 5 });
        assert.equal(resUpdate.success, false);
        assert.match(resUpdate.error, /Only 3 items are available/i);
        assert.equal(cartItems[prodRecordedB], 2);
    });

    // 5. Stock decrease after adding to cart is handled
    it('5. Stock decrease after adding to cart is handled', () => {
        const products = Array.from(productStore.values());
        // User had added 8 items when stock was 10
        let cartItems = { [prodRecordedA]: 8 };

        // Stock in store drops to 5
        const prodA = products.find(p => p._id === prodRecordedA);
        prodA.stockQuantity = 5;

        // User attempts to increment or add more
        const resAdd = simulateAddToCart({ products, cartItems, itemId: prodRecordedA, quantity: 1 });
        assert.equal(resAdd.success, false);
        assert.match(resAdd.error, /Only 5 items are available/i);
        assert.equal(cartItems[prodRecordedA], 8, "Item not silently deleted");

        // User updates quantity to valid available stock (e.g. 5)
        const resUpdate = simulateUpdateCartItem({ products, cartItems, itemId: prodRecordedA, quantity: 5 });
        assert.equal(resUpdate.success, true);
        assert.equal(resUpdate.cartItems[prodRecordedA], 5);
    });

    // 6. Checkout rejects insufficient stock
    it('6. Checkout rejects insufficient stock', async () => {
        const req = {
            userId: validUserId,
            body: {
                items: [{ product: prodRecordedB, quantity: 5 }], // available: 3
                address: validAddressId,
                verificationToken: validToken
            }
        };
        const res = createMockRes();
        await placeOrderCOD(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.match(res.data.message, /Insufficient stock/i);
        assert.equal(productStore.get(prodRecordedB).stockQuantity, 3, "Stock must not be decremented");
        assert.equal(committedOrders.size, 0, "No order created");
    });

    // 7. Deleted product is rejected at checkout
    it('7. Deleted product is rejected at checkout', async () => {
        const nonExistentProductId = '64a1b2c3d4e5f6a7b8c9d999';
        const req = {
            userId: validUserId,
            body: {
                items: [{ product: nonExistentProductId, quantity: 1 }],
                address: validAddressId,
                verificationToken: validToken
            }
        };
        const res = createMockRes();
        await placeOrderCOD(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.match(res.data.message, /no longer available/i);
        assert.equal(committedOrders.size, 0);
    });

    // 8. Mixed cart failure rolls back all stock deductions and order creation
    it('8. Mixed cart failure rolls back all stock deductions and order creation', async () => {
        // Mixed cart: prodRecordedA has 10 (asking 2), prodRecordedB has 3 (asking 10 -> will fail)
        const req = {
            userId: validUserId,
            body: {
                items: [
                    { product: prodRecordedA, quantity: 2 },
                    { product: prodRecordedB, quantity: 10 }
                ],
                address: validAddressId,
                verificationToken: validToken
            }
        };
        const res = createMockRes();
        await placeOrderCOD(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        // Both stocks must remain untouched
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 10);
        assert.equal(productStore.get(prodRecordedB).stockQuantity, 3);
        assert.equal(committedOrders.size, 0);
    });

    // 9. Duplicate checkout does not deduct stock twice
    it('9. Duplicate checkout does not deduct stock twice', async () => {
        const idempotencyKey = 'phase7_5_idemp_key_123';
        const req1 = {
            userId: validUserId,
            body: {
                items: [{ product: prodRecordedA, quantity: 3 }],
                address: validAddressId,
                verificationToken: validToken,
                idempotencyKey
            }
        };
        const res1 = createMockRes();
        await placeOrderCOD(req1, res1);

        assert.equal(res1.statusCode, 200);
        assert.equal(res1.data.success, true);
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 7); // 10 - 3 = 7

        // Second duplicate request with same idempotencyKey
        const req2 = {
            userId: validUserId,
            body: {
                items: [{ product: prodRecordedA, quantity: 3 }],
                address: validAddressId,
                verificationToken: validToken,
                idempotencyKey
            }
        };
        const res2 = createMockRes();
        await placeOrderCOD(req2, res2);

        assert.equal(res2.statusCode, 200);
        assert.equal(res2.data.isDuplicate, true);
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 7, "Stock must NOT be decremented a second time");
    });

    // 10. Cancellation restores stock exactly once
    it('10. Cancellation restores stock exactly once', async () => {
        // Place order for 4 units of prodRecordedA
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
        const orderId = res.data.orderId;
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 6); // 10 - 4 = 6

        // Cancel order
        const cancelReq1 = {
            sellerId: 'admin_test',
            sellerEmail: process.env.SELLER_EMAIL,
            body: { orderId, status: "Cancelled" }
        };
        const cancelRes1 = createMockRes();
        await updateOrderStatus(cancelReq1, cancelRes1);

        assert.equal(cancelRes1.statusCode, 200);
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 10, "Stock must be restored to 10");

        // Second cancellation attempt
        const cancelReq2 = {
            sellerId: 'admin_test',
            sellerEmail: process.env.SELLER_EMAIL,
            body: { orderId, status: "Cancelled" }
        };
        const cancelRes2 = createMockRes();
        await updateOrderStatus(cancelReq2, cancelRes2);

        // Subsequent cancellation rejects or does not restore stock again
        assert.equal(productStore.get(prodRecordedA).stockQuantity, 10, "Stock must not be restored twice");
    });
});
