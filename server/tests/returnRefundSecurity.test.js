import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import ReturnRequest from '../models/ReturnRequest.js';
import Refund from '../models/Refund.js';
import ReturnRefundPolicy from '../models/ReturnRefundPolicy.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import {
    getPublicPolicy,
    getAdminPolicy,
    updateAdminPolicy,
    createReturnRequest,
    getMyReturns,
    getReturnById,
    cancelReturnRequest,
    getAllReturnRequests,
    getReturnStats,
    updateReturnStatus,
    processRefund
} from '../controllers/returnController.js';
import { clearTestActivityLogs, _testActivityLogs } from '../services/activityLogService.js';

describe('GreenCart Return & Refund Management Security & Integration Suite', () => {
    let originalEnv;
    let mockPolicy;
    let mockOrders = new Map();
    let mockProducts = new Map();
    let mockUsers = new Map();
    let mockReturns = new Map();
    let mockRefunds = new Map();
    let mockNotifications = [];

    // Store original Mongoose methods
    let origPolicyFindOne, origPolicyCreate;
    let origOrderFindById, origOrderFindOne;
    let origProductFindById, origProductUpdateOne;
    let origUserFindById;
    let origReturnFind, origReturnFindOne, origReturnFindById, origReturnCreate, origReturnCount;
    let origRefundFindOne, origRefundCreate, origRefundAggregate;
    let origNotifCreate, origNotifFindOne;

    const createMockRes = () => {
        const res = {
            statusCode: 200,
            data: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(body) {
                this.data = body;
                return this;
            }
        };
        return res;
    };

    beforeEach(() => {
        originalEnv = { ...process.env };
        clearTestActivityLogs();
        mockOrders.clear();
        mockProducts.clear();
        mockUsers.clear();
        mockReturns.clear();
        mockRefunds.clear();
        mockNotifications = [];

        mockPolicy = {
            _id: new mongoose.Types.ObjectId(),
            returnWindowDays: 7,
            eligibleReasons: [
                "Damaged or defective item received",
                "Wrong product delivered",
                "Expired product received",
                "Missing items from package"
            ],
            nonReturnableCategories: [
                "Fresh Vegetables",
                "Fresh Fruits",
                "Dairy & Chilled Items"
            ],
            conditionRequirements: ["Original packaging required"],
            shippingRules: "Free return pickup within 48h.",
            refundProcessingEstimate: "3-5 business days.",
            policyContent: "Official GreenCart policy.",
            cancellationRules: "Can cancel before shipping.",
            contactInfo: { email: "support@greencart.com", phone: "+880 1700-000000" },
            effectiveDate: new Date(),
            isPublished: true,
            toObject() { return { ...this }; },
            save: async function () { return this; }
        };

        // Mock Policy methods
        origPolicyFindOne = ReturnRefundPolicy.findOne;
        ReturnRefundPolicy.findOne = () => ({
            lean: async () => mockPolicy,
            then: (resolve) => Promise.resolve(mockPolicy).then(resolve)
        });

        // Mock Product methods
        origProductFindById = Product.findById;
        Product.findById = (id) => ({
            select: () => ({
                lean: async () => mockProducts.get(String(id))
            }),
            lean: async () => mockProducts.get(String(id)),
            then: (resolve) => Promise.resolve(mockProducts.get(String(id))).then(resolve)
        });

        origProductUpdateOne = Product.updateOne;
        Product.updateOne = async (filter, update) => {
            const prod = mockProducts.get(String(filter._id));
            if (prod) {
                if (update.$inc?.stockQuantity !== undefined && prod.stockQuantity !== null) {
                    prod.stockQuantity += update.$inc.stockQuantity;
                }
                if (update.$set?.inStock !== undefined) {
                    prod.inStock = update.$set.inStock;
                }
            }
            return { acknowledged: true, modifiedCount: prod ? 1 : 0 };
        };

        // Mock Order methods
        origOrderFindById = Order.findById;
        Order.findById = (id) => ({
            populate: () => ({
                then: (resolve) => Promise.resolve(mockOrders.get(String(id))).then(resolve)
            }),
            then: (resolve) => Promise.resolve(mockOrders.get(String(id))).then(resolve)
        });

        origOrderFindOne = Order.findOne;
        Order.findOne = (filter) => ({
            then: (resolve) => Promise.resolve(mockOrders.get(String(filter._id))).then(resolve)
        });

        // Mock User methods
        origUserFindById = User.findById;
        User.findById = (id) => ({
            select: () => ({
                lean: async () => mockUsers.get(String(id))
            }),
            lean: async () => mockUsers.get(String(id)),
            then: (resolve) => Promise.resolve(mockUsers.get(String(id))).then(resolve)
        });

        // Mock ReturnRequest methods
        origReturnCreate = ReturnRequest.create;
        ReturnRequest.create = async (doc) => {
            const created = {
                _id: doc._id || new mongoose.Types.ObjectId(),
                ...doc,
                createdAt: new Date(),
                updatedAt: new Date(),
                save: async function () {
                    mockReturns.set(String(this._id), this);
                    return this;
                }
            };
            mockReturns.set(String(created._id), created);
            return created;
        };

        origReturnFindById = ReturnRequest.findById;
        ReturnRequest.findById = (id) => {
            const ret = mockReturns.get(String(id));
            return {
                populate: () => ({
                    lean: async () => ret,
                    then: (resolve) => Promise.resolve(ret).then(resolve)
                }),
                then: (resolve) => Promise.resolve(ret).then(resolve)
            };
        };

        origReturnFindOne = ReturnRequest.findOne;
        ReturnRequest.findOne = (filter) => {
            let found = null;
            for (const r of mockReturns.values()) {
                if (filter.returnNumber && r.returnNumber === filter.returnNumber) found = r;
                if (filter.orderId && r.orderId === filter.orderId) {
                    if (filter["items.productId"]) {
                        const hasProd = (r.items || []).some(it => it.productId === filter["items.productId"]);
                        if (hasProd) {
                            if (filter.status?.$nin && filter.status.$nin.includes(r.status)) continue;
                            found = r;
                        }
                    }
                }
            }
            return {
                then: (resolve) => Promise.resolve(found).then(resolve)
            };
        };

        origReturnFind = ReturnRequest.find;
        ReturnRequest.find = (filter = {}) => {
            const list = Array.from(mockReturns.values()).filter(r => {
                if (filter.userId && r.userId !== filter.userId) return false;
                if (filter.status && filter.status !== 'ALL' && r.status !== filter.status) return false;
                return true;
            });
            return {
                populate: () => ({
                    sort: () => ({
                        skip: () => ({
                            limit: () => ({
                                lean: async () => list
                            })
                        }),
                        lean: async () => list
                    })
                })
            };
        };

        origReturnCount = ReturnRequest.countDocuments;
        ReturnRequest.countDocuments = async (filter = {}) => {
            return Array.from(mockReturns.values()).filter(r => {
                if (filter.status && r.status !== filter.status) return false;
                return true;
            }).length;
        };

        // Mock Refund methods
        origRefundCreate = Refund.create;
        Refund.create = async (doc) => {
            const created = {
                _id: doc._id || new mongoose.Types.ObjectId(),
                ...doc,
                createdAt: new Date(),
                save: async function () {
                    mockRefunds.set(String(this._id), this);
                    return this;
                }
            };
            mockRefunds.set(String(created._id), created);
            return created;
        };

        origRefundFindOne = Refund.findOne;
        Refund.findOne = (filter) => {
            let found = null;
            for (const ref of mockRefunds.values()) {
                if (filter.returnRequestId && String(ref.returnRequestId) === String(filter.returnRequestId)) {
                    if (filter.status && ref.status !== filter.status) continue;
                    found = ref;
                }
            }
            return {
                then: (resolve) => Promise.resolve(found).then(resolve)
            };
        };

        origRefundAggregate = Refund.aggregate;
        Refund.aggregate = async () => {
            let total = 0;
            for (const r of mockRefunds.values()) {
                if (r.status === 'Completed') total += (r.amount || 0);
            }
            return [{ totalAmount: total }];
        };

        // Mock Notification methods
        origNotifCreate = Notification.create;
        Notification.create = async (doc) => {
            mockNotifications.push(doc);
            return { _id: new mongoose.Types.ObjectId(), ...doc };
        };

        origNotifFindOne = Notification.findOne;
        Notification.findOne = (filter) => ({
            then: (resolve) => {
                const found = mockNotifications.find(n => filter?.dedupeKey && n.dedupeKey === filter.dedupeKey);
                return Promise.resolve(found || null).then(resolve);
            }
        });
    });

    afterEach(() => {
        process.env = originalEnv;
        ReturnRefundPolicy.findOne = origPolicyFindOne;
        Product.findById = origProductFindById;
        Product.updateOne = origProductUpdateOne;
        Order.findById = origOrderFindById;
        Order.findOne = origOrderFindOne;
        User.findById = origUserFindById;
        ReturnRequest.create = origReturnCreate;
        ReturnRequest.findById = origReturnFindById;
        ReturnRequest.findOne = origReturnFindOne;
        ReturnRequest.find = origReturnFind;
        ReturnRequest.countDocuments = origReturnCount;
        Refund.create = origRefundCreate;
        Refund.findOne = origRefundFindOne;
        Refund.aggregate = origRefundAggregate;
        Notification.create = origNotifCreate;
        Notification.findOne = origNotifFindOne;
    });

    // =========================================================================
    // 1. Policy Configuration & Access Control
    // =========================================================================
    describe('1. Return & Refund Policy Management', () => {
        it('allows public access to published return policy with Bangladesh formatted date', async () => {
            const req = {};
            const res = createMockRes();

            await getPublicPolicy(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.data.success, true);
            assert.equal(res.data.policy.returnWindowDays, 7);
            assert.ok(Array.isArray(res.data.policy.eligibleReasons));
            assert.ok(res.data.policy.effectiveDateFormatted.includes('BST'));
        });

        it('allows Admin to update return policy configuration', async () => {
            const req = {
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                body: {
                    returnWindowDays: 14,
                    eligibleReasons: ['Damaged', 'Wrong Item', 'Expired'],
                    shippingRules: 'Express return pickup within 24 hours'
                }
            };
            const res = createMockRes();

            await updateAdminPolicy(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.data.success, true);
            assert.equal(mockPolicy.returnWindowDays, 14);
            assert.equal(mockPolicy.shippingRules, 'Express return pickup within 24 hours');
        });

        it('rejects invalid return window values (e.g. negative or > 90 days)', async () => {
            const req = {
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                body: { returnWindowDays: 120 }
            };
            const res = createMockRes();

            await updateAdminPolicy(req, res);

            assert.equal(res.statusCode, 400);
            assert.match(res.data.message, /between 1 and 90 days/i);
        });
    });

    // =========================================================================
    // 2. Customer Return Request Creation & Validation
    // =========================================================================
    describe('2. Customer Return Request Creation & Validation', () => {
        const testUserId = 'user_alice_123';
        const testOrderId = 'order_valid_123';
        const testProductId = 'prod_rice_5kg';

        beforeEach(() => {
            mockProducts.set(testProductId, {
                _id: testProductId,
                name: 'Organic Basmati Rice 5kg',
                category: 'Grains & Rice',
                price: 500,
                stockQuantity: 20,
                inStock: true
            });

            mockOrders.set(testOrderId, {
                _id: testOrderId,
                userId: testUserId,
                orderNumber: 'GC-DELIV1',
                amount: 1000,
                status: 'Delivered',
                createdAt: new Date(),
                updatedAt: new Date(),
                items: [
                    {
                        product: testProductId,
                        name: 'Organic Basmati Rice 5kg',
                        quantity: 2,
                        unitPrice: 500,
                        category: 'Grains & Rice'
                    }
                ],
                address: {
                    firstName: 'Alice',
                    street: '45 Lake View',
                    city: 'Dhaka',
                    phone: '01700000000'
                }
            });
        });

        it('creates a return request successfully for delivered order within return window', async () => {
            const req = {
                userId: testUserId,
                body: {
                    orderId: testOrderId,
                    items: [
                        {
                            productId: testProductId,
                            quantity: 1,
                            reason: 'Damaged or defective item received'
                        }
                    ],
                    customerNotes: 'Bag was torn on delivery',
                    returnMethod: 'Pickup'
                }
            };
            const res = createMockRes();

            await createReturnRequest(req, res);

            assert.equal(res.statusCode, 201);
            assert.equal(res.data.success, true);
            assert.ok(res.data.returnRequest);
            assert.match(res.data.returnRequest.returnNumber, /^RET-[0-9A-Z]{6}$/);
            assert.equal(res.data.returnRequest.totalRefundAmount, 500);
            assert.equal(res.data.returnRequest.status, 'Pending');

            // Verify notification to Admin
            assert.ok(mockNotifications.some(n => n.title.includes('New Return Request')));
        });

        it('rejects return request if order belongs to a different customer', async () => {
            const req = {
                userId: 'user_eve_imposter',
                body: {
                    orderId: testOrderId,
                    items: [{ productId: testProductId, quantity: 1, reason: 'Damaged' }]
                }
            };
            const res = createMockRes();

            await createReturnRequest(req, res);

            assert.equal(res.statusCode, 403);
            assert.match(res.data.message, /not authorized/i);
        });

        it('rejects return request if order status is not Delivered', async () => {
            const nonDeliveredOrder = mockOrders.get(testOrderId);
            nonDeliveredOrder.status = 'Shipped'; // Still in transit

            const req = {
                userId: testUserId,
                body: {
                    orderId: testOrderId,
                    items: [{ productId: testProductId, quantity: 1, reason: 'Damaged' }]
                }
            };
            const res = createMockRes();

            await createReturnRequest(req, res);

            assert.equal(res.statusCode, 400);
            assert.match(res.data.message, /Only delivered orders can be returned/i);
        });

        it('rejects return request if return window of 7 days has expired', async () => {
            const expiredOrder = mockOrders.get(testOrderId);
            // 10 days ago
            expiredOrder.updatedAt = new Date(Date.now() - (10 * 24 * 60 * 60 * 1000));

            const req = {
                userId: testUserId,
                body: {
                    orderId: testOrderId,
                    items: [{ productId: testProductId, quantity: 1, reason: 'Damaged' }]
                }
            };
            const res = createMockRes();

            await createReturnRequest(req, res);

            assert.equal(res.statusCode, 400);
            assert.match(res.data.message, /return window of 7 days has expired/i);
        });

        it('rejects return request for non-returnable categories (e.g. Fresh Vegetables)', async () => {
            const vegProdId = 'prod_spinach_01';
            mockProducts.set(vegProdId, {
                _id: vegProdId,
                name: 'Fresh Spinach',
                category: 'Fresh Vegetables',
                price: 40,
                stockQuantity: 10
            });

            const vegOrder = mockOrders.get(testOrderId);
            vegOrder.items.push({
                product: vegProdId,
                name: 'Fresh Spinach',
                quantity: 1,
                unitPrice: 40,
                category: 'Fresh Vegetables'
            });

            const req = {
                userId: testUserId,
                body: {
                    orderId: testOrderId,
                    items: [{ productId: vegProdId, quantity: 1, reason: 'Quality not as described' }]
                }
            };
            const res = createMockRes();

            await createReturnRequest(req, res);

            assert.equal(res.statusCode, 400);
            assert.match(res.data.message, /non-returnable according to store policy/i);
        });

        it('rejects return request if requested quantity exceeds purchased quantity', async () => {
            const req = {
                userId: testUserId,
                body: {
                    orderId: testOrderId,
                    items: [{ productId: testProductId, quantity: 5, reason: 'Damaged' }] // Ordered only 2!
                }
            };
            const res = createMockRes();

            await createReturnRequest(req, res);

            assert.equal(res.statusCode, 400);
            assert.match(res.data.message, /ordered quantity was 2/i);
        });

        it('prevents duplicate return requests for the same order item while active request exists', async () => {
            // First return request
            const req1 = {
                userId: testUserId,
                body: {
                    orderId: testOrderId,
                    items: [{ productId: testProductId, quantity: 1, reason: 'Damaged' }]
                }
            };
            const res1 = createMockRes();
            await createReturnRequest(req1, res1);
            assert.equal(res1.statusCode, 201);

            // Attempt duplicate return request
            const req2 = {
                userId: testUserId,
                body: {
                    orderId: testOrderId,
                    items: [{ productId: testProductId, quantity: 1, reason: 'Damaged' }]
                }
            };
            const res2 = createMockRes();
            await createReturnRequest(req2, res2);

            assert.equal(res2.statusCode, 400);
            assert.match(res2.data.message, /An active return request .* already exists/i);
        });
    });

    // =========================================================================
    // 3. Customer Cancellation & Lifecycle
    // =========================================================================
    describe('3. Customer Cancellation & Access Controls', () => {
        it('allows customer to cancel their own pending return request', async () => {
            const returnId = new mongoose.Types.ObjectId();
            const returnDoc = {
                _id: returnId,
                returnNumber: 'RET-CAN001',
                userId: 'user_cust_1',
                orderId: 'order_1',
                orderNumber: 'GC-001',
                status: 'Pending',
                statusHistory: [{ status: 'Pending', changedBy: 'Customer', note: 'Created' }],
                save: async function () { return this; }
            };
            mockReturns.set(String(returnId), returnDoc);

            const req = {
                userId: 'user_cust_1',
                params: { returnId: String(returnId) }
            };
            const res = createMockRes();

            await cancelReturnRequest(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.data.success, true);
            assert.equal(returnDoc.status, 'Cancelled');
        });

        it('rejects cancellation if return request has already been approved', async () => {
            const returnId = new mongoose.Types.ObjectId();
            const returnDoc = {
                _id: returnId,
                returnNumber: 'RET-APP001',
                userId: 'user_cust_1',
                status: 'Approved',
                statusHistory: [],
                save: async function () { return this; }
            };
            mockReturns.set(String(returnId), returnDoc);

            const req = {
                userId: 'user_cust_1',
                params: { returnId: String(returnId) }
            };
            const res = createMockRes();

            await cancelReturnRequest(req, res);

            assert.equal(res.statusCode, 400);
            assert.match(res.data.message, /Cannot cancel a return request that is already Approved/i);
        });
    });

    // =========================================================================
    // 4. Admin Management, Restocking & Exactly-Once Inventory Restoration
    // =========================================================================
    describe('4. Admin Management & Exactly-Once Inventory Restoration', () => {
        const testProdId = 'prod_coffee_1';
        let testReturnDoc;

        beforeEach(() => {
            mockProducts.set(testProdId, {
                _id: testProdId,
                name: 'Artisan Coffee Beans 500g',
                stockQuantity: 10,
                inStock: true
            });

            const retId = new mongoose.Types.ObjectId();
            testReturnDoc = {
                _id: retId,
                returnNumber: 'RET-STK001',
                userId: 'user_test',
                orderId: 'order_test',
                orderNumber: 'GC-STK99',
                status: 'Approved',
                items: [
                    {
                        productId: testProdId,
                        name: 'Artisan Coffee Beans 500g',
                        quantity: 3,
                        unitPrice: 400,
                        totalPrice: 1200
                    }
                ],
                totalRefundAmount: 1200,
                stockRestored: false,
                statusHistory: [],
                save: async function () { return this; }
            };
            mockReturns.set(String(retId), testReturnDoc);
        });

        it('marking status as Item Received with restockInventory restores stock exactly once', async () => {
            const req1 = {
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                params: { returnId: String(testReturnDoc._id) },
                body: { status: 'Item Received', restockInventory: true }
            };
            const res1 = createMockRes();

            await updateReturnStatus(req1, res1);

            assert.equal(res1.statusCode, 200);
            assert.equal(testReturnDoc.status, 'Item Received');
            assert.equal(testReturnDoc.stockRestored, true);

            // Stock should increase from 10 to 13
            const prod = mockProducts.get(testProdId);
            assert.equal(prod.stockQuantity, 13, 'Stock must be restored by returned quantity (10 + 3 = 13)');

            // Secondary status update should NOT restore stock again
            const req2 = {
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                params: { returnId: String(testReturnDoc._id) },
                body: { status: 'Refund Processing', restockInventory: true }
            };
            const res2 = createMockRes();

            await updateReturnStatus(req2, res2);

            assert.equal(res2.statusCode, 200);
            assert.equal(prod.stockQuantity, 13, 'Stock must NOT be restored a second time');
        });

        it('rejecting a return requires an explicit rejection reason', async () => {
            testReturnDoc.status = 'Pending';
            const req = {
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                params: { returnId: String(testReturnDoc._id) },
                body: { status: 'Rejected', rejectionReason: '' }
            };
            const res = createMockRes();

            await updateReturnStatus(req, res);

            assert.equal(res.statusCode, 400);
            assert.match(res.data.message, /rejection reason is required/i);
        });
    });

    // =========================================================================
    // 5. Refund Financial Execution & Duplicate Prevention
    // =========================================================================
    describe('5. Refund Processing & Financial Integrity', () => {
        let returnForRefund;

        beforeEach(() => {
            const retId = new mongoose.Types.ObjectId();
            returnForRefund = {
                _id: retId,
                returnNumber: 'RET-REF001',
                userId: 'user_refund_1',
                orderId: 'order_refund_1',
                orderNumber: 'GC-REF77',
                status: 'Item Received',
                totalRefundAmount: 750,
                statusHistory: [],
                save: async function () { return this; }
            };
            mockReturns.set(String(retId), returnForRefund);
        });

        it('successfully executes and records customer refund with unique refund number', async () => {
            const req = {
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                params: { returnId: String(returnForRefund._id) },
                body: {
                    amount: 750,
                    refundMethod: 'bKash/Nagad MFS',
                    transactionReference: 'TRX-BK9823412',
                    notes: 'Issued via bKash merchant payout'
                }
            };
            const res = createMockRes();

            await processRefund(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.data.success, true);
            assert.ok(res.data.refund);
            assert.match(res.data.refund.refundNumber, /^REF-[0-9A-Z]{6}$/);
            assert.equal(res.data.refund.amount, 750);
            assert.equal(res.data.refund.status, 'Completed');
            assert.equal(returnForRefund.status, 'Completed');
            assert.ok(returnForRefund.refundId);
        });

        it('rejects refund amount that exceeds maximum authorized return item value', async () => {
            const req = {
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                params: { returnId: String(returnForRefund._id) },
                body: {
                    amount: 1500 // Exceeds 750!
                }
            };
            const res = createMockRes();

            await processRefund(req, res);

            assert.equal(res.statusCode, 400);
            assert.match(res.data.message, /cannot exceed return item value/i);
        });

        it('strictly blocks duplicate refund execution on an already completed return', async () => {
            // First refund
            const req1 = {
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                params: { returnId: String(returnForRefund._id) },
                body: { amount: 750 }
            };
            const res1 = createMockRes();
            await processRefund(req1, res1);
            assert.equal(res1.statusCode, 200);

            // Attempt duplicate refund
            const req2 = {
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                params: { returnId: String(returnForRefund._id) },
                body: { amount: 750 }
            };
            const res2 = createMockRes();
            await processRefund(req2, res2);

            assert.equal(res2.statusCode, 400);
            assert.match(res2.data.message, /Refund cannot be processed for return in "Completed" status/i);
        });
    });

    // =========================================================================
    // 6. Regression Protection: Order & Coupon Integrity
    // =========================================================================
    describe('6. Regression Protection: Existing Orders & Coupons', () => {
        it('calculates dashboard stats accurately across return and refund states', async () => {
            const ret1 = { _id: '1', status: 'Pending' };
            const ret2 = { _id: '2', status: 'Approved' };
            const ret3 = { _id: '3', status: 'Completed' };
            mockReturns.set('1', ret1);
            mockReturns.set('2', ret2);
            mockReturns.set('3', ret3);

            mockRefunds.set('ref1', { _id: 'ref1', status: 'Completed', amount: 800 });

            const req = { sellerEmail: 'admin@greencart.com', sellerRole: 'Admin' };
            const res = createMockRes();

            await getReturnStats(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.data.stats.totalRequests, 3);
            assert.equal(res.data.stats.pendingRequests, 1);
            assert.equal(res.data.stats.approvedReturns, 1);
            assert.equal(res.data.stats.completedRefunds, 1);
            assert.equal(res.data.stats.totalRefundedAmount, 800);
        });
    });
});
