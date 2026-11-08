import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Address from '../models/Address.js';
import { getOrderById, getOrderInvoicePdf } from '../controllers/orderController.js';
import authOrderAccess from '../middlewares/authOrderAccess.js';

describe('GreenCart Seller Order Invoice Viewing & PDF Security Suite', () => {
    const STORE_ADMIN_EMAIL = 'admin@greencart.com';
    const JWT_SECRET = 'test_jwt_secret_seller_invoice_suite';

    const customerA = '507f1f77bcf86cd799439001';
    const customerB = '507f1f77bcf86cd799439002';

    const orderA1Id = '507f1f77bcf86cd799439011';
    const orderA2Id = '507f1f77bcf86cd799439012';
    const sellerBOrderId = '507f1f77bcf86cd799439013';

    const addressAId = '507f1f77bcf86cd799439021';
    const prod1Id = '507f1f77bcf86cd799439031';
    const prod2Id = '507f1f77bcf86cd799439032';

    let orderStore;
    let productStore;
    let addressStore;

    beforeEach(() => {
        process.env.SELLER_EMAIL = STORE_ADMIN_EMAIL;
        process.env.JWT_SECRET = JWT_SECRET;

        orderStore = new Map();
        productStore = new Map();
        addressStore = new Map();

        productStore.set(prod1Id, {
            _id: prod1Id,
            name: 'Organic Honey 500g',
            price: 500,
            offerPrice: 420,
            inStock: true
        });

        productStore.set(prod2Id, {
            _id: prod2Id,
            name: 'Green Tea 100 bags',
            price: 350,
            offerPrice: 300,
            inStock: true
        });

        addressStore.set(addressAId, {
            _id: addressAId,
            userId: customerA,
            firstName: 'Alice',
            lastName: 'Rahman',
            email: 'alice@example.com',
            street: '45 Lake View Road',
            city: 'Dhaka',
            state: 'Dhaka',
            zipcode: 1212,
            country: 'Bangladesh',
            phone: '+8801712345678'
        });

        // Customer A Order 1 (Total: 428 including 2% tax on 420)
        orderStore.set(orderA1Id, {
            _id: orderA1Id,
            userId: customerA,
            orderNumber: 'GC-ALICE1',
            amount: 428,
            items: [
                {
                    product: prod1Id,
                    quantity: 1,
                    name: 'Organic Honey 500g',
                    unitPrice: 420
                }
            ],
            address: addressAId,
            paymentType: 'COD',
            status: 'Delivered',
            isPaid: true,
            createdAt: new Date('2026-10-15T08:30:00Z')
        });

        // Customer A Order 2 (Total: 734 including 2% tax on 720)
        orderStore.set(orderA2Id, {
            _id: orderA2Id,
            userId: customerA,
            orderNumber: 'GC-ALICE2',
            amount: 734,
            items: [
                {
                    product: prod1Id,
                    quantity: 1,
                    name: 'Organic Honey 500g',
                    unitPrice: 420
                },
                {
                    product: prod2Id,
                    quantity: 1,
                    name: 'Green Tea 100 bags',
                    unitPrice: 300
                }
            ],
            address: addressAId,
            paymentType: 'COD',
            status: 'Order Placed',
            isPaid: false,
            createdAt: new Date('2026-10-28T14:15:00Z')
        });

        // Tenant Seller B Order (isolated from Tenant Seller A)
        orderStore.set(sellerBOrderId, {
            _id: sellerBOrderId,
            userId: customerB,
            sellerId: 'tenant_seller_beta',
            orderNumber: 'GC-BETA01',
            amount: 500,
            items: [
                {
                    product: 'some_other_prod',
                    quantity: 1,
                    name: 'Beta Store Item',
                    unitPrice: 500
                }
            ],
            address: 'some_address',
            paymentType: 'COD',
            status: 'Order Placed',
            isPaid: false,
            createdAt: new Date('2026-10-29T10:00:00Z')
        });

        // Mock Order.findOne
        Order.findOne = (query) => {
            const queryId = query._id ? String(query._id) : null;
            let found = queryId ? orderStore.get(queryId) : null;

            if (found) {
                // If query specifies userId, verify match
                if (query.userId && String(found.userId) !== String(query.userId)) {
                    found = null;
                }
                // If query specifies tenant sellerId in $or/$and clauses
                if (query.$and) {
                    const sellerClause = query.$and.find(c => c.$or && c.$or.some(sub => sub.sellerId));
                    if (sellerClause) {
                        const targetSellerId = sellerClause.$or.find(sub => sub.sellerId)?.sellerId;
                        if (targetSellerId && found.sellerId && String(found.sellerId) !== String(targetSellerId)) {
                            found = null;
                        }
                    }
                }
            }

            const doc = found ? JSON.parse(JSON.stringify(found)) : null;

            return {
                populate: (paths) => {
                    if (doc) {
                        if (typeof paths === 'string' && paths.includes('address')) {
                            const addr = addressStore.get(String(doc.address));
                            if (addr) doc.address = { ...addr };
                        }
                        if (typeof paths === 'string' && paths.includes('items.product')) {
                            doc.items = (doc.items || []).map(item => {
                                const prod = productStore.get(String(item.product));
                                return {
                                    ...item,
                                    product: prod ? { ...prod } : item.product
                                };
                            });
                        }
                    }
                    return {
                        lean: async () => doc,
                        then: (resolve) => resolve(doc)
                    };
                },
                lean: async () => doc,
                then: (resolve) => resolve(doc)
            };
        };
    });

    describe('1. Individual Invoice Retrieval for Customer Orders', () => {
        it('allows store admin seller to view Order 1 with exact historical snapshot data', async () => {
            const req = {
                sellerId: STORE_ADMIN_EMAIL,
                sellerEmail: STORE_ADMIN_EMAIL,
                sellerRole: 'Admin',
                params: { orderId: orderA1Id }
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
            assert.strictEqual(responseData.order._id, orderA1Id);
            assert.strictEqual(responseData.order.orderNumber, 'GC-ALICE1');
            assert.strictEqual(responseData.order.amount, 428);
            assert.strictEqual(responseData.order.items.length, 1);
            assert.strictEqual(responseData.order.items[0].name, 'Organic Honey 500g');
            assert.strictEqual(responseData.order.items[0].unitPrice, 420);
            assert.strictEqual(responseData.order.address.firstName, 'Alice');
            assert.strictEqual(responseData.order.address.city, 'Dhaka');
        });

        it('allows store admin seller to view Order 2 with distinct order number and amounts', async () => {
            const req = {
                sellerId: STORE_ADMIN_EMAIL,
                sellerEmail: STORE_ADMIN_EMAIL,
                sellerRole: 'Admin',
                params: { orderId: orderA2Id }
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
            assert.strictEqual(responseData.order._id, orderA2Id);
            assert.strictEqual(responseData.order.orderNumber, 'GC-ALICE2');
            assert.strictEqual(responseData.order.amount, 734);
            assert.strictEqual(responseData.order.items.length, 2);
            assert.notStrictEqual(responseData.order.orderNumber, 'GC-ALICE1');
        });

        it('rejects cross-seller access when Tenant Seller A tries to access Tenant Seller B order', async () => {
            const req = {
                sellerId: 'tenant_seller_alpha',
                sellerEmail: 'alpha@merchant.com',
                sellerRole: 'Admin',
                params: { orderId: sellerBOrderId }
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

        it('rejects unauthenticated request to view invoice with 401', async () => {
            const req = {
                userId: null,
                sellerId: null,
                params: { orderId: orderA1Id }
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

        it('rejects invalid order ID format with 400', async () => {
            const req = {
                sellerId: STORE_ADMIN_EMAIL,
                sellerRole: 'Admin',
                params: { orderId: 'invalid-id' }
            };

            let statusCode = null;
            let responseData = null;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (d) => { responseData = d; return res; }
            };

            await getOrderById(req, res);

            assert.strictEqual(statusCode, 400);
            assert.strictEqual(responseData.success, false);
            assert.strictEqual(responseData.message, 'Invalid order ID');
        });
    });

    describe('2. Order Invoice PDF Generation & Download API', () => {
        it('allows store seller to download invoice PDF with correct headers and PDF buffer', async () => {
            const req = {
                sellerId: STORE_ADMIN_EMAIL,
                sellerEmail: STORE_ADMIN_EMAIL,
                sellerRole: 'Admin',
                params: { orderId: orderA1Id }
            };

            const headers = {};
            let sentBuffer = null;
            const res = {
                setHeader: (k, v) => { headers[k] = v; },
                send: (buf) => { sentBuffer = buf; return res; },
                status: () => res,
                json: () => res
            };

            await getOrderInvoicePdf(req, res);

            assert.strictEqual(headers['Content-Type'], 'application/pdf');
            assert.match(headers['Content-Disposition'], /attachment; filename="GreenCart-Invoice-GC-ALICE1\.pdf"/);
            assert.ok(Buffer.isBuffer(sentBuffer));
            assert.strictEqual(sentBuffer.subarray(0, 4).toString(), '%PDF');
        });

        it('allows customer to download their own invoice PDF', async () => {
            const req = {
                userId: customerA,
                params: { orderId: orderA2Id }
            };

            const headers = {};
            let sentBuffer = null;
            const res = {
                setHeader: (k, v) => { headers[k] = v; },
                send: (buf) => { sentBuffer = buf; return res; },
                status: () => res,
                json: () => res
            };

            await getOrderInvoicePdf(req, res);

            assert.strictEqual(headers['Content-Type'], 'application/pdf');
            assert.match(headers['Content-Disposition'], /attachment; filename="GreenCart-Invoice-GC-ALICE2\.pdf"/);
            assert.ok(Buffer.isBuffer(sentBuffer));
            assert.strictEqual(sentBuffer.subarray(0, 4).toString(), '%PDF');
        });

        it('rejects cross-customer PDF download with 404 (IDOR Prevention)', async () => {
            const req = {
                userId: customerB, // Customer B attempts to download Customer A's PDF
                params: { orderId: orderA1Id }
            };

            let statusCode = null;
            let responseData = null;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (d) => { responseData = d; return res; }
            };

            await getOrderInvoicePdf(req, res);

            assert.strictEqual(statusCode, 404);
            assert.strictEqual(responseData.success, false);
            assert.strictEqual(responseData.message, 'Order not found');
        });

        it('rejects unauthenticated PDF download request with 401', async () => {
            const req = {
                userId: null,
                sellerId: null,
                params: { orderId: orderA1Id }
            };

            let statusCode = null;
            let responseData = null;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (d) => { responseData = d; return res; }
            };

            await getOrderInvoicePdf(req, res);

            assert.strictEqual(statusCode, 401);
            assert.strictEqual(responseData.success, false);
            assert.strictEqual(responseData.message, 'Not Authorized');
        });
    });

    describe('3. AuthOrderAccess Middleware Dual-Role Authorization', () => {
        it('authenticates valid sellerToken and populates req.sellerId and role', async () => {
            const sellerToken = jwt.sign(
                { email: STORE_ADMIN_EMAIL, role: 'Admin' },
                JWT_SECRET
            );

            const req = {
                cookies: { sellerToken }
            };
            let nextCalled = false;
            const res = {
                status: () => res,
                json: () => res
            };

            await authOrderAccess(req, res, () => { nextCalled = true; });

            assert.strictEqual(nextCalled, true);
            assert.strictEqual(req.sellerId, STORE_ADMIN_EMAIL);
            assert.strictEqual(req.sellerRole, 'Admin');
        });

        it('authenticates valid customer token and populates req.userId', async () => {
            const token = jwt.sign(
                { id: customerA },
                JWT_SECRET
            );

            const req = {
                cookies: { token }
            };
            let nextCalled = false;
            const res = {
                status: () => res,
                json: () => res
            };

            await authOrderAccess(req, res, () => { nextCalled = true; });

            assert.strictEqual(nextCalled, true);
            assert.strictEqual(req.userId, customerA);
        });

        it('rejects requests with missing cookies with 401', async () => {
            const req = { cookies: {} };
            let statusCode = null;
            let responseData = null;
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (d) => { responseData = d; return res; }
            };

            await authOrderAccess(req, res, () => {});

            assert.strictEqual(statusCode, 401);
            assert.strictEqual(responseData.success, false);
            assert.strictEqual(responseData.message, 'Not Authorized');
        });
    });
});
