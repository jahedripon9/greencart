import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { getAllOrders, updateOrderStatus } from '../controllers/orderController.js';

describe('GreenCart SEC-02: Seller Order Ownership & IDOR Protection Suite', () => {
    const STORE_ADMIN_EMAIL = 'admin@greencart.com';
    const SELLER_ALPHA_ID = 'seller_alpha_101';
    const SELLER_BETA_ID = 'seller_beta_202';

    const orderAlphaId = '507f1f77bcf86cd799439001';
    const orderBetaId = '507f1f77bcf86cd799439002';
    const orderStoreId = '507f1f77bcf86cd799439003';

    const prodAlphaId = '507f1f77bcf86cd799439011';
    const prodBetaId = '507f1f77bcf86cd799439012';

    let orderStore;
    let productStore;
    let origEnv;

    let origOrderFind;
    let origOrderFindOne;
    let origOrderFindById;
    let origOrderFindByIdAndUpdate;
    let origProductFind;
    let origProductUpdateOne;

    const createMockRes = () => {
        const res = {
            statusCode: 200,
            body: null,
            status(code) {
                res.statusCode = code;
                return res;
            },
            json(payload) {
                res.body = payload;
                return res;
            }
        };
        return res;
    };

    beforeEach(() => {
        origEnv = { ...process.env };
        process.env.NODE_ENV = 'test';
        process.env.SELLER_EMAIL = STORE_ADMIN_EMAIL;

        orderStore = new Map();
        productStore = new Map();

        productStore.set(prodAlphaId, {
            _id: prodAlphaId,
            sellerId: SELLER_ALPHA_ID,
            name: 'Alpha Organic Honey',
            stockQuantity: 10,
            inStock: true
        });

        productStore.set(prodBetaId, {
            _id: prodBetaId,
            sellerId: SELLER_BETA_ID,
            name: 'Beta Almond Oil',
            stockQuantity: 5,
            inStock: true
        });

        orderStore.set(orderAlphaId, {
            _id: orderAlphaId,
            orderNumber: 'GC-ALPHA-01',
            sellerId: SELLER_ALPHA_ID,
            userId: 'cust_101',
            items: [{ product: prodAlphaId, quantity: 2 }],
            amount: 200,
            address: 'addr_1',
            status: 'Order Placed',
            paymentType: 'COD',
            isPaid: false,
            stockDeducted: true,
            createdAt: new Date('2026-10-20T10:00:00Z')
        });

        orderStore.set(orderBetaId, {
            _id: orderBetaId,
            orderNumber: 'GC-BETA-01',
            sellerId: SELLER_BETA_ID,
            userId: 'cust_202',
            items: [{ product: prodBetaId, quantity: 1 }],
            amount: 150,
            address: 'addr_2',
            status: 'Order Placed',
            paymentType: 'COD',
            isPaid: false,
            stockDeducted: true,
            createdAt: new Date('2026-10-21T10:00:00Z')
        });

        orderStore.set(orderStoreId, {
            _id: orderStoreId,
            orderNumber: 'GC-STORE-01',
            sellerId: STORE_ADMIN_EMAIL,
            userId: 'cust_303',
            items: [{ product: 'prod_root', quantity: 1 }],
            amount: 300,
            address: 'addr_3',
            status: 'Order Placed',
            paymentType: 'COD',
            isPaid: true,
            stockDeducted: true,
            createdAt: new Date('2026-10-22T10:00:00Z')
        });

        // Backup original functions
        origOrderFind = Order.find;
        origOrderFindOne = Order.findOne;
        origOrderFindById = Order.findById;
        origOrderFindByIdAndUpdate = Order.findByIdAndUpdate;
        origProductFind = Product.find;
        origProductUpdateOne = Product.updateOne;

        // Mock Product.find
        Product.find = (filter) => {
            const sid = filter?.sellerId;
            const results = [];
            for (const prod of productStore.values()) {
                if (sid && prod.sellerId === sid) {
                    results.push({ ...prod });
                }
            }
            return {
                select: () => ({
                    lean: async () => results
                }),
                lean: async () => results
            };
        };

        // Mock Product.updateOne
        Product.updateOne = async (filter, update) => {
            const prod = productStore.get(filter._id);
            if (!prod) return { matchedCount: 0, modifiedCount: 0 };
            if (update.$inc?.stockQuantity) {
                prod.stockQuantity = (prod.stockQuantity || 0) + update.$inc.stockQuantity;
            }
            if (update.$set?.inStock !== undefined) {
                prod.inStock = update.$set.inStock;
            }
            return { matchedCount: 1, modifiedCount: 1 };
        };

        // Matcher helper for Order queries
        const matchesQuery = (doc, query) => {
            if (!doc || !query) return false;

            if (query._id && String(doc._id) !== String(query._id)) {
                return false;
            }

            if (query.$and && Array.isArray(query.$and)) {
                for (const clause of query.$and) {
                    if (!matchesQuery(doc, clause)) return false;
                }
                return true;
            }

            if (query.$or && Array.isArray(query.$or)) {
                let orMatched = false;
                for (const sub of query.$or) {
                    if (sub.sellerId && doc.sellerId === sub.sellerId) {
                        orMatched = true;
                        break;
                    }
                    if (sub['items.product']?.$in && Array.isArray(sub['items.product'].$in)) {
                        const inList = sub['items.product'].$in;
                        const hasProd = (doc.items || []).some(it => inList.includes(String(it.product?._id || it.product)));
                        if (hasProd) {
                            orMatched = true;
                            break;
                        }
                    }
                    if (sub.paymentType && doc.paymentType === sub.paymentType) {
                        orMatched = true;
                        break;
                    }
                    if (sub.isPaid !== undefined && doc.isPaid === sub.isPaid) {
                        orMatched = true;
                        break;
                    }
                }
                return orMatched;
            }

            if (query.sellerId && doc.sellerId !== query.sellerId) {
                return false;
            }

            return true;
        };

        // Mock Order.find
        Order.find = (query) => {
            const list = [];
            for (const o of orderStore.values()) {
                if (matchesQuery(o, query)) {
                    list.push({ ...o });
                }
            }
            return {
                populate: () => ({
                    sort: () => Promise.resolve(list)
                }),
                sort: () => ({
                    populate: () => Promise.resolve(list)
                })
            };
        };

        // Mock Order.findOne
        Order.findOne = (query) => {
            let found = null;
            for (const o of orderStore.values()) {
                if (matchesQuery(o, query)) {
                    found = { ...o };
                    break;
                }
            }
            return {
                populate: () => Promise.resolve(found),
                session: () => Promise.resolve(found),
                then: (resolve) => resolve(found)
            };
        };

        // Mock Order.findById
        Order.findById = (id) => {
            const found = orderStore.get(String(id));
            const copy = found ? { ...found } : null;
            return {
                populate: () => Promise.resolve(copy),
                session: () => Promise.resolve(copy),
                then: (resolve) => resolve(copy)
            };
        };

        // Mock Order.findByIdAndUpdate
        Order.findByIdAndUpdate = (id, update) => {
            const existing = orderStore.get(String(id));
            if (!existing) return null;
            const updated = { ...existing, ...(update.$set || {}) };
            orderStore.set(String(id), updated);
            return {
                populate: () => Promise.resolve(updated),
                then: (resolve) => resolve(updated)
            };
        };
    });

    afterEach(() => {
        process.env = origEnv;
        Order.find = origOrderFind;
        Order.findOne = origOrderFindOne;
        Order.findById = origOrderFindById;
        Order.findByIdAndUpdate = origOrderFindByIdAndUpdate;
        Product.find = origProductFind;
        Product.updateOne = origProductUpdateOne;
    });

    // =========================================================================
    // GET /api/order/seller (getAllOrders)
    // =========================================================================
    describe('1. GET /api/order/seller (Seller Order List Isolation)', () => {
        it('Case 1: Seller A receives their own eligible orders', async () => {
            const req = {
                sellerId: SELLER_ALPHA_ID,
                sellerEmail: 'alpha@example.com'
            };
            const res = createMockRes();

            await getAllOrders(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.ok(Array.isArray(res.body.orders));
            assert.equal(res.body.orders.length, 1);
            assert.equal(res.body.orders[0]._id, orderAlphaId);
        });

        it('Case 2: Seller A cannot retrieve Seller B orders', async () => {
            const req = {
                sellerId: SELLER_ALPHA_ID,
                sellerEmail: 'alpha@example.com'
            };
            const res = createMockRes();

            await getAllOrders(req, res);

            assert.equal(res.statusCode, 200);
            const containsBetaOrder = res.body.orders.some(o => o._id === orderBetaId);
            assert.equal(containsBetaOrder, false, "Seller A must NEVER receive Seller B's order");
        });

        it('Case 3: Tenant seller cannot retrieve orders belonging exclusively to another seller', async () => {
            const req = {
                sellerId: SELLER_BETA_ID,
                sellerEmail: 'beta@example.com'
            };
            const res = createMockRes();

            await getAllOrders(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.orders.length, 1);
            assert.equal(res.body.orders[0]._id, orderBetaId);
            const containsAlphaOrder = res.body.orders.some(o => o._id === orderAlphaId);
            assert.equal(containsAlphaOrder, false);
        });

        it('Case 4: Root merchant and authorized store staff retain their intended access', async () => {
            // Root merchant caller
            const reqAdmin = {
                sellerId: STORE_ADMIN_EMAIL,
                sellerEmail: STORE_ADMIN_EMAIL,
                sellerRole: 'Admin'
            };
            const resAdmin = createMockRes();

            await getAllOrders(reqAdmin, resAdmin);

            assert.equal(resAdmin.statusCode, 200);
            assert.ok(resAdmin.body.orders.length >= 3, 'Root merchant sees all store qualifying orders');

            // Store team member staff caller
            const reqStaff = {
                sellerId: 'team_staff_cto',
                sellerEmail: 'cto@greencart.com',
                sellerRole: 'CTO',
                isTeamMember: true
            };
            const resStaff = createMockRes();

            await getAllOrders(reqStaff, resStaff);

            assert.equal(resStaff.statusCode, 200);
            assert.ok(resStaff.body.orders.length >= 3, 'Authorized store team member sees store orders');
        });

        it('Case 5: Ownership query resolution failure never returns global orders (fail-closed)', async () => {
            // Unauthenticated request without seller identifiers
            const reqUnauth = {
                sellerId: null,
                sellerEmail: null
            };
            const resUnauth = createMockRes();

            await getAllOrders(reqUnauth, resUnauth);

            assert.notEqual(resUnauth.statusCode, 200, 'Must not return 200 without seller identity');
            assert.equal(resUnauth.body?.orders, undefined, 'Must NEVER return orders on failed auth');
        });
    });

    // =========================================================================
    // POST /api/order/status (updateOrderStatus)
    // =========================================================================
    describe('2. POST /api/order/status (Cross-Seller Order Mutation IDOR Protection)', () => {
        it("Case 6: Seller B cannot update Seller A's order", async () => {
            const req = {
                sellerId: SELLER_BETA_ID,
                sellerEmail: 'beta@example.com',
                body: {
                    orderId: orderAlphaId,
                    status: 'Shipped'
                }
            };
            const res = createMockRes();

            await updateOrderStatus(req, res);

            assert.equal(res.statusCode, 404);
            assert.equal(res.body.success, false);
            assert.equal(orderStore.get(orderAlphaId).status, 'Order Placed', 'Status must remain unmodified');
        });

        it('Case 7: Unauthorized cancellation leaves order status unchanged', async () => {
            const req = {
                sellerId: SELLER_BETA_ID,
                sellerEmail: 'beta@example.com',
                body: {
                    orderId: orderAlphaId,
                    status: 'Cancelled'
                }
            };
            const res = createMockRes();

            await updateOrderStatus(req, res);

            assert.equal(res.statusCode, 404);
            assert.equal(orderStore.get(orderAlphaId).status, 'Order Placed');
        });

        it('Case 8: Unauthorized requests do not modify stock', async () => {
            const initialStock = productStore.get(prodAlphaId).stockQuantity;

            const req = {
                sellerId: SELLER_BETA_ID,
                sellerEmail: 'beta@example.com',
                body: {
                    orderId: orderAlphaId,
                    status: 'Cancelled'
                }
            };
            const res = createMockRes();

            await updateOrderStatus(req, res);

            assert.equal(res.statusCode, 404);
            const currentStock = productStore.get(prodAlphaId).stockQuantity;
            assert.equal(currentStock, initialStock, 'Stock must NOT be restored on unauthorized cancellation');
        });

        it('Case 9: Unauthorized requests do not modify payment status', async () => {
            const req = {
                sellerId: SELLER_BETA_ID,
                sellerEmail: 'beta@example.com',
                body: {
                    orderId: orderAlphaId,
                    isPaid: true
                }
            };
            const res = createMockRes();

            await updateOrderStatus(req, res);

            assert.equal(res.statusCode, 404);
            assert.equal(orderStore.get(orderAlphaId).isPaid, false, 'isPaid must remain false');
        });

        it('Case 10: An authorized seller can update their own order', async () => {
            const req = {
                sellerId: SELLER_ALPHA_ID,
                sellerEmail: 'alpha@example.com',
                body: {
                    orderId: orderAlphaId,
                    status: 'Packing'
                }
            };
            const res = createMockRes();

            await updateOrderStatus(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.equal(orderStore.get(orderAlphaId).status, 'Packing');
        });

        it('Case 11: Existing stock restoration and cancellation behavior works for authorized owner', async () => {
            const initialStock = productStore.get(prodAlphaId).stockQuantity; // 10

            const req = {
                sellerId: SELLER_ALPHA_ID,
                sellerEmail: 'alpha@example.com',
                body: {
                    orderId: orderAlphaId,
                    status: 'Cancelled'
                }
            };
            const res = createMockRes();

            await updateOrderStatus(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.equal(orderStore.get(orderAlphaId).status, 'Cancelled');
            assert.equal(orderStore.get(orderAlphaId).stockDeducted, false);

            const expectedStock = initialStock + 2; // Quantity 2 was deducted in orderAlpha
            assert.equal(productStore.get(prodAlphaId).stockQuantity, expectedStock, 'Authorized cancellation restores stock');
        });

        it('Case 12: Invalid order IDs and malformed payloads are handled safely', async () => {
            // Malformed orderId
            const reqMalformedId = {
                sellerId: SELLER_ALPHA_ID,
                body: { orderId: 'not-valid-id-123', status: 'Shipped' }
            };
            const resMalformed = createMockRes();
            await updateOrderStatus(reqMalformedId, resMalformed);
            assert.equal(resMalformed.statusCode, 400);

            // Invalid status
            const reqInvalidStatus = {
                sellerId: SELLER_ALPHA_ID,
                body: { orderId: orderAlphaId, status: 'NotAStatus' }
            };
            const resInvalidStatus = createMockRes();
            await updateOrderStatus(reqInvalidStatus, resInvalidStatus);
            assert.equal(resInvalidStatus.statusCode, 400);

            // Missing any update field
            const reqEmptyFields = {
                sellerId: SELLER_ALPHA_ID,
                body: { orderId: orderAlphaId }
            };
            const resEmpty = createMockRes();
            await updateOrderStatus(reqEmptyFields, resEmpty);
            assert.equal(resEmpty.statusCode, 400);
        });
    });
});
