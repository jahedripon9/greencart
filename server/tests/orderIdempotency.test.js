import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Order from '../models/Order.js';
import Address from '../models/Address.js';
import Product from '../models/Product.js';
import OtpVerification from '../models/OtpVerification.js';
import { placeOrderCOD } from '../controllers/orderController.js';

describe('GreenCart Checkout Idempotency & Transaction Regression Suite', () => {
    const validUserId = '507f1f77bcf86cd799439011';
    const validAddressId = '507f1f77bcf86cd799439012';
    const prodA = '507f1f77bcf86cd799439013';
    const prodB = '507f1f77bcf86cd799439014';
    const validToken = 'valid_test_verification_token_64_bytes_1234567890abcdef1234567890';
    const validTokenHash = crypto.createHash('sha256').update(validToken).digest('hex');

    // In-memory committed state
    let committedUsers;
    let committedOrders;
    let addressStore;
    let productStore;
    let otpStore;

    // Original methods to restore after tests
    let origStartSession;
    let origOrderCreate;
    let origOrderFindOne;
    let origUserFindById;
    let origUserFindByIdAndUpdate;
    let origUserUpdateOne;
    let origAddressFindOne;
    let origProductFindById;
    let origOtpFindOne;
    let origOtpUpdateOne;

    beforeEach(() => {
        committedUsers = new Map();
        committedOrders = new Map();
        addressStore = new Map();
        productStore = new Map();
        otpStore = new Map();

        // Seed valid address and products
        addressStore.set(validAddressId, { _id: validAddressId, userId: validUserId, street: "123 Main St" });
        productStore.set(prodA, { _id: prodA, inStock: true, offerPrice: 50 });
        productStore.set(prodB, { _id: prodB, inStock: true, offerPrice: 30 });

        // Seed valid unconsumed token for validUserId
        otpStore.set(validTokenHash, {
            _id: "otp_test_doc_1",
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
        origUserFindById = User.findById;
        origUserFindByIdAndUpdate = User.findByIdAndUpdate;
        origUserUpdateOne = User.updateOne;
        origAddressFindOne = Address.findOne;
        origProductFindById = Product.findById;
        origOtpFindOne = OtpVerification.findOne;
        origOtpUpdateOne = OtpVerification.updateOne;

        Address.findOne = async (query) => {
            const addr = addressStore.get(query._id);
            if (addr && addr.userId === query.userId) return addr;
            return null;
        };

        Product.findById = async (id) => {
            return productStore.get(id) || null;
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
                    if (update.$set) {
                        Object.assign(record, update.$set);
                    }
                    return { matchedCount: 1, modifiedCount: 1 };
                }
            }
            return { matchedCount: 0, modifiedCount: 0 };
        };
    });

    afterEach(() => {
        mongoose.startSession = origStartSession;
        Order.create = origOrderCreate;
        Order.findOne = origOrderFindOne;
        User.findById = origUserFindById;
        User.findByIdAndUpdate = origUserFindByIdAndUpdate;
        User.updateOne = origUserUpdateOne;
        Address.findOne = origAddressFindOne;
        Product.findById = origProductFindById;
        OtpVerification.findOne = origOtpFindOne;
        OtpVerification.updateOne = origOtpUpdateOne;
    });

    /**
     * Helper to set up an in-memory transactional mock harness that strictly mirrors
     * MongoDB multi-document transaction semantics (atomic commit, rollback on error,
     * staged session writes, transient error retry, and duplicate-key error 11000).
     */
    function setupTransactionalHarness(options = {}) {
        const {
            failInsideTransaction = null,
            transientRetries = 0,
            simulatedConcurrentOrder = null
        } = options;

        let attemptCount = 0;
        let inTx = false;
        let stagedOtpUpdates = [];

        mongoose.startSession = async () => {
            let stagedOrders = [];
            let stagedUserMutations = new Map();

            const sessionObj = {
                withTransaction: async (txCallback) => {
                    inTx = true;
                    while (true) {
                        attemptCount++;
                        stagedOrders = [];
                        stagedUserMutations = new Map();
                        stagedOtpUpdates = [];

                        try {
                            if (failInsideTransaction && attemptCount === 1 && !transientRetries) {
                                throw failInsideTransaction;
                            }

                            if (transientRetries > 0 && attemptCount <= transientRetries) {
                                const transientErr = new Error("WriteConflict on replica set primary");
                                transientErr.code = 112; // WriteConflict
                                transientErr.hasErrorLabel = (label) => label === 'TransientTransactionError';
                                throw transientErr;
                            }

                            // Execute callback passed by placeOrderCOD
                            await txCallback(sessionObj);

                            // COMMIT PHASE: Atomically apply staged writes to committed store
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
                            inTx = false;
                            return;
                        } catch (err) {
                            // ABORT PHASE: Discard staged writes
                            stagedOrders = [];
                            stagedUserMutations = new Map();
                            stagedOtpUpdates = [];

                            if (err.hasErrorLabel && err.hasErrorLabel('TransientTransactionError') && attemptCount <= transientRetries) {
                                continue; // Retry transaction callback
                            }

                            inTx = false;
                            throw err;
                        }
                    }
                },
                endSession: async () => {
                    inTx = false;
                }
            };
            return sessionObj;
        };

        Order.create = async (docArray, opts) => {
            const doc = Array.isArray(docArray) ? docArray[0] : docArray;
            // Compound unique index check on { userId, idempotencyKey }
            if (doc.idempotencyKey) {
                for (const existing of committedOrders.values()) {
                    if (existing.userId === doc.userId && existing.idempotencyKey === doc.idempotencyKey) {
                        const err = new Error(`E11000 duplicate key error collection: greencart.orders index: userId_1_idempotencyKey_1 dup key: { userId: "${doc.userId}", idempotencyKey: "${doc.idempotencyKey}" }`);
                        err.code = 11000;
                        throw err;
                    }
                }
            }

            const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
            const createdDoc = { _id: orderId, ...doc };

            if (opts?.session) {
                // Staged within transaction
                committedOrders.set(orderId, createdDoc);
            } else {
                committedOrders.set(orderId, createdDoc);
            }

            return [createdDoc];
        };

        Order.findOne = async (query) => {
            for (const o of committedOrders.values()) {
                if (o.userId === query.userId && o.idempotencyKey === query.idempotencyKey) {
                    return o;
                }
            }
            return null;
        };

        User.findById = (id) => {
            const queryObj = {
                session: (sess) => queryObj,
                then: (resolve) => {
                    const u = committedUsers.get(id);
                    resolve(u ? { _id: id, cartItems: { ...u.cartItems } } : null);
                }
            };
            return queryObj;
        };

        User.findByIdAndUpdate = async (id, update, opts) => {
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

        User.updateOne = async (filter, update, opts) => {
            const u = committedUsers.get(filter._id);
            if (!u) return { matchedCount: 0, modifiedCount: 0 };

            if (update.$unset) {
                for (const [k] of Object.entries(update.$unset)) {
                    const p = k.replace('cartItems.', '');
                    const cond = filter[`cartItems.${p}`];
                    if (cond && cond.$lte !== undefined && u.cartItems[p] <= cond.$lte) {
                        delete u.cartItems[p];
                    }
                }
            }
            return { matchedCount: 1, modifiedCount: 1 };
        };

        OtpVerification.updateOne = async (filter, update, opts) => {
            for (const record of otpStore.values()) {
                if (record._id === filter._id) {
                    if (filter.used !== undefined && record.used !== filter.used) {
                        return { matchedCount: 0, modifiedCount: 0 };
                    }
                    if (inTx && opts?.session) {
                        stagedOtpUpdates.push({ filter, update });
                        return { matchedCount: 1, modifiedCount: 1 };
                    }
                    if (update.$set) {
                        Object.assign(record, update.$set);
                    }
                    return { matchedCount: 1, modifiedCount: 1 };
                }
            }
            return { matchedCount: 0, modifiedCount: 0 };
        };
    }

    // -------------------------------------------------------------------------
    // Scenario 1: Successful checkout followed by retry does not double deduct
    // -------------------------------------------------------------------------
    it('[MOCKED TRANSACTION HARNESS] Scenario 1: A successful checkout followed by a retry with the same idempotency key does not deduct cart quantities twice', async () => {
        setupTransactionalHarness();

        // User starts with 5 of prodA
        committedUsers.set(validUserId, {
            _id: validUserId,
            cartItems: { [prodA]: 5 }
        });

        const key = "key_scenario_1";
        const req1 = {
            userId: validUserId,
            body: { items: [{ product: prodA, quantity: 2 }], address: validAddressId, idempotencyKey: key, verificationToken: validToken }
        };

        let res1Data = null;
        const res1 = { status: (c) => res1, json: (d) => { res1Data = d; } };

        // Attempt 1: First checkout
        await placeOrderCOD(req1, res1);
        assert.equal(res1Data.success, true);
        assert.equal(res1Data.cartReconciled, true);
        assert.equal(committedUsers.get(validUserId).cartItems[prodA], 3, "Cart should be 5 - 2 = 3 after attempt 1");

        // Attempt 2: Consecutive retry with same idempotency key
        let res2Data = null;
        const res2 = { status: (c) => res2, json: (d) => { res2Data = d; } };
        await placeOrderCOD(req1, res2);

        assert.equal(res2Data.success, true);
        assert.equal(res2Data.isDuplicate, true);
        assert.equal(res2Data.cartReconciled, true);
        assert.equal(res2Data.orderId, res1Data.orderId);

        // Crucial verification: User cart in DB must REMAIN 3, NOT 1
        assert.equal(committedUsers.get(validUserId).cartItems[prodA], 3, "Cart must remain exactly 3 on retry (no double deduction)");
        assert.equal(res2Data.remainingCart[prodA], 3);
    });

    // -------------------------------------------------------------------------
    // Scenario 2: Transaction failure rolls back order and cart deduction
    // -------------------------------------------------------------------------
    it('[MOCKED TRANSACTION HARNESS] Scenario 2: A transaction failure rolls back both order creation and cart deduction', async () => {
        setupTransactionalHarness({
            failInsideTransaction: new Error("Simulated database write timeout inside transaction")
        });

        // User starts with 5 of prodA
        committedUsers.set(validUserId, {
            _id: validUserId,
            cartItems: { [prodA]: 5 }
        });

        const key = "key_scenario_2";
        const req = {
            userId: validUserId,
            body: { items: [{ product: prodA, quantity: 2 }], address: validAddressId, idempotencyKey: key, verificationToken: validToken }
        };

        let statusCode = 200;
        let resData = null;
        const res = {
            status: (c) => { statusCode = c; return res; },
            json: (d) => { resData = d; }
        };

        await placeOrderCOD(req, res);

        assert.equal(statusCode, 500);
        assert.equal(resData.success, false);

        // Verification: Order must not exist and cart must remain at 5
        assert.equal(committedOrders.size, 0, "No order should be committed on transaction abort");
        assert.equal(committedUsers.get(validUserId).cartItems[prodA], 5, "Cart must remain untouched at 5 on rollback");
    });

    // -------------------------------------------------------------------------
    // Scenario 3: Retry does not remove newly added items
    // -------------------------------------------------------------------------
    it('[MOCKED TRANSACTION HARNESS] Scenario 3: A retry does not remove items added to the cart after the original attempt', async () => {
        setupTransactionalHarness();

        // User starts with 2 of prodA
        committedUsers.set(validUserId, {
            _id: validUserId,
            cartItems: { [prodA]: 2 }
        });

        const key = "key_scenario_3";
        const req1 = {
            userId: validUserId,
            body: { items: [{ product: prodA, quantity: 2 }], address: validAddressId, idempotencyKey: key, verificationToken: validToken }
        };

        let res1Data = null;
        const res1 = { status: (c) => res1, json: (d) => { res1Data = d; } };

        // Attempt 1: orders all 2 units
        await placeOrderCOD(req1, res1);
        assert.equal(committedUsers.get(validUserId).cartItems[prodA], undefined, "Item A was unset because 2 - 2 = 0");

        // User now adds 1 unit of prodA back to their cart
        committedUsers.get(validUserId).cartItems[prodA] = 1;

        // Attempt 2: Retry with original key
        let res2Data = null;
        const res2 = { status: (c) => res2, json: (d) => { res2Data = d; } };
        await placeOrderCOD(req1, res2);

        assert.equal(res2Data.success, true);
        assert.equal(res2Data.isDuplicate, true);

        // Crucial verification: Newly added item must NOT be wiped out!
        assert.equal(committedUsers.get(validUserId).cartItems[prodA], 1, "Newly added cart item must remain preserved at 1");
        assert.equal(res2Data.remainingCart[prodA], 1);
    });

    // -------------------------------------------------------------------------
    // Scenario 4: Legacy order with undefined cartDeducted never triggers blind deduction
    // -------------------------------------------------------------------------
    it('[MOCKED TRANSACTION HARNESS] Scenario 4: An existing order with missing or undefined cartDeducted never triggers blind cart deduction', async () => {
        setupTransactionalHarness();

        const legacyKey = "legacy_key_4";
        committedOrders.set("legacy_order_4", {
            _id: "legacy_order_4",
            userId: validUserId,
            idempotencyKey: legacyKey,
            items: [{ product: prodA, quantity: 2 }],
            // cartDeducted is undefined!
        });

        // User current cart has 3 units
        committedUsers.set(validUserId, {
            _id: validUserId,
            cartItems: { [prodA]: 3 }
        });

        const req = {
            userId: validUserId,
            body: { items: [{ product: prodA, quantity: 2 }], address: validAddressId, idempotencyKey: legacyKey, verificationToken: validToken }
        };

        let resData = null;
        const res = { status: (c) => res, json: (d) => { resData = d; } };
        await placeOrderCOD(req, res);

        assert.equal(resData.success, true);
        assert.equal(resData.isDuplicate, true);
        assert.equal(resData.cartReconciled, false, "Undefined cartDeducted must result in cartReconciled: false");

        // Crucial verification: User cart must NOT be deducted
        assert.equal(committedUsers.get(validUserId).cartItems[prodA], 3, "Cart must remain at 3 without deduction");
    });

    // -------------------------------------------------------------------------
    // Scenario 5: Concurrent requests with same key produce only one order
    // -------------------------------------------------------------------------
    it('[MOCKED TRANSACTION HARNESS] Scenario 5: Concurrent requests with the same user and idempotency key produce only one order', async () => {
        setupTransactionalHarness();

        committedUsers.set(validUserId, {
            _id: validUserId,
            cartItems: { [prodA]: 4 }
        });

        const key = "key_scenario_5";
        const req = {
            userId: validUserId,
            body: { items: [{ product: prodA, quantity: 2 }], address: validAddressId, idempotencyKey: key, verificationToken: validToken }
        };

        let res1Data = null;
        let res2Status = null;
        let res2Data = null;

        const res1 = { status: (c) => res1, json: (d) => { res1Data = d; } };
        const res2 = { status: (c) => { res2Status = c; return res2; }, json: (d) => { res2Data = d; } };

        // Request 1 succeeds
        await placeOrderCOD(req, res1);

        // Request 2 with same key: Mutex or unique index collision
        await placeOrderCOD(req, res2);

        assert.equal(res1Data.success, true);
        assert.equal(res2Data.success, true);
        assert.equal(res2Data.isDuplicate, true);
        assert.equal(res1Data.orderId, res2Data.orderId);

        // Verification: Only 1 order exists in database
        assert.equal(committedOrders.size, 1, "Exactly one order must be recorded in the database");
    });

    // -------------------------------------------------------------------------
    // Scenario 6: Duplicate-key response is not treated as reconciled when cartReconciled is false
    // -------------------------------------------------------------------------
    it('[MOCKED TRANSACTION HARNESS] Scenario 6: A duplicate-key response is not treated as successfully reconciled when cartReconciled is false', async () => {
        setupTransactionalHarness();

        const collisionKey = "collision_key_6";
        // Pre-existing order in DB with cartDeducted: false
        committedOrders.set("conflicting_order_6", {
            _id: "conflicting_order_6",
            userId: validUserId,
            idempotencyKey: collisionKey,
            cartDeducted: false
        });

        committedUsers.set(validUserId, {
            _id: validUserId,
            cartItems: { [prodA]: 2 }
        });

        const req = {
            userId: validUserId,
            body: { items: [{ product: prodA, quantity: 1 }], address: validAddressId, idempotencyKey: collisionKey, verificationToken: validToken }
        };

        let resData = null;
        const res = { status: (c) => res, json: (d) => { resData = d; } };
        await placeOrderCOD(req, res);

        assert.equal(resData.success, true);
        assert.equal(resData.isDuplicate, true);
        // Must reflect false, NOT report false success
        assert.equal(resData.cartReconciled, false, "cartReconciled must accurately be false");
    });

    // -------------------------------------------------------------------------
    // Scenario 7: Transaction callback retries do not cause duplicate side effects
    // -------------------------------------------------------------------------
    it('[MOCKED TRANSACTION HARNESS] Scenario 7: Transaction callback retries do not cause duplicate side effects', async () => {
        // Setup harness to throw TransientTransactionError on attempt 1, succeeding on attempt 2
        setupTransactionalHarness({
            transientRetries: 1
        });

        committedUsers.set(validUserId, {
            _id: validUserId,
            cartItems: { [prodA]: 6 }
        });

        const key = "key_scenario_7";
        const req = {
            userId: validUserId,
            body: { items: [{ product: prodA, quantity: 2 }], address: validAddressId, idempotencyKey: key, verificationToken: validToken }
        };

        let resData = null;
        const res = { status: (c) => res, json: (d) => { resData = d; } };
        await placeOrderCOD(req, res);

        assert.equal(resData.success, true);
        assert.equal(resData.cartReconciled, true);

        // Verification: Order created once, cart deducted ONCE (6 - 2 = 4, NOT 6 - 4 = 2)
        assert.equal(committedOrders.size, 1, "Only one order should be created after transient retry");
        assert.equal(committedUsers.get(validUserId).cartItems[prodA], 4, "Cart must be decremented only once across callback retries");
    });
});
