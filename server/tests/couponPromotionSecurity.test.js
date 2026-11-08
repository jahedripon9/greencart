import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Coupon from '../models/Coupon.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Address from '../models/Address.js';
import User from '../models/User.js';
import OtpVerification from '../models/OtpVerification.js';
import {
    validateCoupon,
    createCoupon,
    getAllCoupons,
    getCouponById,
    updateCoupon,
    toggleCouponStatus,
    deleteCoupon,
    getCouponStats
} from '../controllers/couponController.js';
import { placeOrderCOD, updateOrderStatus } from '../controllers/orderController.js';
import { generateInvoicePdf } from '../services/invoicePdfService.js';
import { requireRole } from '../middlewares/authRole.js';

function extractPdfText(pdfBuffer) {
    const raw = pdfBuffer.toString('binary');
    const cmap = new Map();

    for (const rangeMatch of raw.matchAll(/<([0-9a-fA-F]{4})>\s+<([0-9a-fA-F]{4})>\s+\[([\s\S]*?)\]/g)) {
        const startGid = parseInt(rangeMatch[1], 16);
        const elements = rangeMatch[3].match(/<([0-9a-fA-F\s]+)>/g) || [];
        elements.forEach((el, idx) => {
            const hexParts = el.replace(/[<>]/g, '').trim().split(/\s+/);
            let unicodeStr = '';
            for (const part of hexParts) {
                if (part.length === 4) {
                    const code = parseInt(part, 16);
                    if (code > 0) unicodeStr += String.fromCodePoint(code);
                }
            }
            if (unicodeStr) cmap.set((startGid + idx).toString(16).padStart(4, '0').toLowerCase(), unicodeStr);
        });
    }

    const textRuns = [];
    for (const match of raw.matchAll(/\[(.*?)\]\s*TJ/gs)) {
        const tjContent = match[1];
        let runStr = '';
        for (const hexMatch of tjContent.matchAll(/<([0-9a-fA-F]+)>/g)) {
            const hexStr = hexMatch[1];
            if (hexStr.length % 4 === 0 && cmap.size > 0) {
                for (let i = 0; i < hexStr.length; i += 4) {
                    const gid = hexStr.slice(i, i + 4).toLowerCase();
                    if (cmap.has(gid)) {
                        runStr += cmap.get(gid);
                    } else {
                        try { runStr += Buffer.from(hexStr.slice(i, i + 4), 'hex').toString('utf8'); } catch {}
                    }
                }
            } else {
                try { runStr += Buffer.from(hexStr, 'hex').toString('utf8'); } catch {}
            }
        }
        if (runStr) textRuns.push(runStr);
    }

    for (const match of raw.matchAll(/\((.*?)\)\s*Tj/g)) {
        textRuns.push(match[1]);
    }

    return textRuns.join(' ');
}

describe('GreenCart Coupon & Promotion Manager Security & Integration Suite', () => {
    let originalEnv;
    let couponStore;
    let orderStore;
    let productStore;
    let userStore;
    let addressStore;
    let otpStore;

    // Original Mongoose model methods
    let origCouponFind;
    let origCouponFindOne;
    let origCouponFindById;
    let origCouponFindByIdAndUpdate;
    let origCouponFindOneAndUpdate;
    let origCouponFindByIdAndDelete;
    let origCouponCreate;
    let origCouponCountDocuments;
    let origCouponAggregate;
    let origCouponUpdateOne;

    let origOrderFind;
    let origOrderFindOne;
    let origOrderFindById;
    let origOrderFindByIdAndUpdate;
    let origOrderCreate;
    let origOrderUpdateOne;
    let origOrderAggregate;

    let origProductFindById;
    let origProductFindOneAndUpdate;
    let origProductUpdateOne;

    let origAddressFindOne;
    let origUserFindById;
    let origUserFindByIdAndUpdate;
    let origUserUpdateOne;
    let origOtpFindOne;
    let origOtpUpdateOne;
    let origStartSession;

    const createMockRes = () => {
        const res = {
            statusCode: 200,
            data: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.data = payload;
                return payload;
            }
        };
        return res;
    };

    beforeEach(() => {
        originalEnv = { ...process.env };
        process.env.NODE_ENV = 'test';
        process.env.SELLER_EMAIL = 'admin@greencart.com';
        process.env.JWT_SECRET = 'test_jwt_secret_coupon_suite_1234567890';

        couponStore = new Map();
        orderStore = new Map();
        productStore = new Map();
        userStore = new Map();
        addressStore = new Map();
        otpStore = new Map();

        // ------------------ Coupon Mocks ------------------
        origCouponFind = Coupon.find;
        origCouponFindOne = Coupon.findOne;
        origCouponFindById = Coupon.findById;
        origCouponFindByIdAndUpdate = Coupon.findByIdAndUpdate;
        origCouponFindOneAndUpdate = Coupon.findOneAndUpdate;
        origCouponFindByIdAndDelete = Coupon.findByIdAndDelete;
        origCouponCreate = Coupon.create;
        origCouponCountDocuments = Coupon.countDocuments;
        origCouponAggregate = Coupon.aggregate;
        origCouponUpdateOne = Coupon.updateOne;

        Coupon.find = (filter = {}) => {
            let list = Array.from(couponStore.values());
            if (filter.active !== undefined) {
                list = list.filter(c => c.active === filter.active);
            }
            if (filter.discountType) {
                list = list.filter(c => c.discountType === filter.discountType);
            }
            if (filter.$or) {
                list = list.filter(c => {
                    return filter.$or.some(clause => {
                        if (clause.code) return clause.code.test(c.code);
                        if (clause.description) return clause.description.test(c.description);
                        return false;
                    });
                });
            }
            return {
                sort: () => ({
                    skip: () => ({
                        limit: () => Promise.resolve(list)
                    })
                }),
                then: (resolve) => resolve(list)
            };
        };

        Coupon.findOne = async (query = {}) => {
            for (const c of couponStore.values()) {
                if (query.code && c.code !== query.code) continue;
                if (query._id && query._id.$ne && String(c._id) === String(query._id.$ne)) continue;
                return { ...c };
            }
            return null;
        };

        Coupon.findById = async (id) => {
            const found = couponStore.get(String(id));
            if (!found) return null;
            return {
                ...found,
                save: async function () {
                    couponStore.set(String(this._id), { ...this });
                    return this;
                }
            };
        };

        Coupon.create = async (doc) => {
            const id = doc._id ? String(doc._id) : `coup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const created = {
                _id: id,
                usedCount: 0,
                ...doc,
                save: async function () {
                    couponStore.set(String(this._id), { ...this });
                    return this;
                }
            };
            couponStore.set(id, created);
            return created;
        };

        Coupon.findByIdAndUpdate = async (id, update, opts) => {
            const existing = couponStore.get(String(id));
            if (!existing) return null;
            const updated = { ...existing, ...(update.$set || update) };
            couponStore.set(String(id), updated);
            return updated;
        };

        Coupon.findOneAndUpdate = async (filter, update, opts) => {
            const id = String(filter._id);
            const existing = couponStore.get(id);
            if (!existing) return null;

            if (filter.active !== undefined && existing.active !== filter.active) return null;
            if (filter.usedCount && filter.usedCount.$lt !== undefined && existing.usedCount >= filter.usedCount.$lt) return null;
            if (filter.expiryDate && filter.expiryDate.$gt && new Date(existing.expiryDate) <= filter.expiryDate.$gt) return null;

            let updated = { ...existing };
            if (update.$inc) {
                if (update.$inc.usedCount) {
                    updated.usedCount = (updated.usedCount || 0) + update.$inc.usedCount;
                }
            }
            couponStore.set(id, updated);
            return updated;
        };

        Coupon.updateOne = async (filter, update) => {
            let matched = 0;
            for (const c of couponStore.values()) {
                if (filter.code && c.code === filter.code) {
                    if (filter.usedCount && filter.usedCount.$gt !== undefined && c.usedCount <= filter.usedCount.$gt) continue;
                    matched++;
                    if (update.$inc && update.$inc.usedCount) {
                        c.usedCount = Math.max(0, (c.usedCount || 0) + update.$inc.usedCount);
                    }
                    couponStore.set(String(c._id), c);
                    break;
                }
            }
            return { matchedCount: matched, modifiedCount: matched };
        };

        Coupon.findByIdAndDelete = async (id) => {
            const existing = couponStore.get(String(id));
            if (!existing) return null;
            couponStore.delete(String(id));
            return existing;
        };

        Coupon.countDocuments = async (filter = {}) => {
            let count = 0;
            const now = new Date();
            for (const c of couponStore.values()) {
                if (filter.active === true && !c.active) continue;
                if (filter.active === false && c.active) continue;
                if (filter.expiryDate && filter.expiryDate.$gt && new Date(c.expiryDate) <= now) continue;
                if (filter.expiryDate && filter.expiryDate.$lte && new Date(c.expiryDate) > now) continue;
                count++;
            }
            return count;
        };

        Coupon.aggregate = async () => {
            let totalRedemptions = 0;
            for (const c of couponStore.values()) {
                totalRedemptions += (c.usedCount || 0);
            }
            return [{ totalRedemptions }];
        };

        // ------------------ Order Mocks ------------------
        origOrderFind = Order.find;
        origOrderFindOne = Order.findOne;
        origOrderFindById = Order.findById;
        origOrderFindByIdAndUpdate = Order.findByIdAndUpdate;
        origOrderCreate = Order.create;
        origOrderUpdateOne = Order.updateOne;
        origOrderAggregate = Order.aggregate;

        Order.findOne = (query) => {
            for (const o of orderStore.values()) {
                if (query._id && String(o._id) !== String(query._id)) continue;
                if (query.userId && o.userId !== query.userId) continue;
                if (query.idempotencyKey && o.idempotencyKey !== query.idempotencyKey) continue;
                return {
                    ...o,
                    session: () => Promise.resolve(o),
                    then: (resolve) => resolve(o)
                };
            }
            return {
                session: () => Promise.resolve(null),
                then: (resolve) => resolve(null)
            };
        };

        Order.findById = (id) => {
            const o = orderStore.get(String(id));
            if (!o) return { session: () => Promise.resolve(null), then: (res) => res(null) };
            return {
                ...o,
                session: () => Promise.resolve(o),
                then: (res) => res(o)
            };
        };

        Order.create = async (docArray) => {
            const doc = Array.isArray(docArray) ? docArray[0] : docArray;
            const id = `order_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const created = { _id: id, ...doc };
            orderStore.set(id, created);
            return [created];
        };

        Order.findByIdAndUpdate = (id, update) => {
            const existing = orderStore.get(String(id));
            if (!existing) return null;
            const updated = { ...existing, ...update.$set };
            orderStore.set(String(id), updated);
            return {
                ...updated,
                populate: async () => updated,
                then: (res) => res(updated)
            };
        };

        Order.aggregate = async () => {
            let totalDiscountGranted = 0;
            let ordersCount = 0;
            for (const o of orderStore.values()) {
                if (o.coupon && o.coupon.discountAmount > 0 && o.status !== "Cancelled") {
                    totalDiscountGranted += o.coupon.discountAmount;
                    ordersCount++;
                }
            }
            return [{ totalDiscountGranted, ordersCount }];
        };

        // ------------------ Product Mocks ------------------
        origProductFindById = Product.findById;
        origProductFindOneAndUpdate = Product.findOneAndUpdate;
        origProductUpdateOne = Product.updateOne;

        Product.findById = (id) => {
            const p = productStore.get(String(id));
            if (!p) return { session: () => Promise.resolve(null), then: (res) => res(null) };
            return {
                ...p,
                session: () => Promise.resolve(p),
                then: (res) => res(p)
            };
        };

        Product.findOneAndUpdate = async (filter, update) => {
            const p = productStore.get(String(filter._id));
            if (!p) return null;
            if (filter.stockQuantity && filter.stockQuantity.$gte && (p.stockQuantity || 0) < filter.stockQuantity.$gte) return null;
            if (update.$inc && update.$inc.stockQuantity) {
                p.stockQuantity = (p.stockQuantity || 0) + update.$inc.stockQuantity;
            }
            return { ...p };
        };

        Product.updateOne = async (filter, update) => {
            const p = productStore.get(String(filter._id));
            if (!p) return { matchedCount: 0 };
            if (update.$inc && update.$inc.stockQuantity) {
                p.stockQuantity = (p.stockQuantity || 0) + update.$inc.stockQuantity;
            }
            return { matchedCount: 1 };
        };

        // ------------------ Address, User, OTP Mocks ------------------
        origAddressFindOne = Address.findOne;
        Address.findOne = async (query) => {
            const a = addressStore.get(String(query._id));
            if (a && a.userId === query.userId) return { ...a };
            return null;
        };

        origUserFindById = User.findById;
        origUserFindByIdAndUpdate = User.findByIdAndUpdate;
        origUserUpdateOne = User.updateOne;

        User.findById = (id) => {
            const u = userStore.get(String(id));
            return {
                session: () => Promise.resolve(u ? { ...u } : null),
                then: (res) => res(u ? { ...u } : null)
            };
        };

        User.findByIdAndUpdate = async (id, update) => {
            const u = userStore.get(String(id));
            return u ? { ...u } : null;
        };

        User.updateOne = async () => ({ matchedCount: 1 });

        origOtpFindOne = OtpVerification.findOne;
        OtpVerification.findOne = async () => ({
            _id: 'otp_123',
            verified: true,
            used: false,
            verifiedAt: new Date()
        });

        origOtpUpdateOne = OtpVerification.updateOne;
        OtpVerification.updateOne = async () => ({ modifiedCount: 1 });

        origStartSession = mongoose.startSession;
        mongoose.startSession = async () => ({
            withTransaction: async (cb) => { await cb(); },
            endSession: async () => {}
        });
    });

    afterEach(() => {
        process.env = originalEnv;

        Coupon.find = origCouponFind;
        Coupon.findOne = origCouponFindOne;
        Coupon.findById = origCouponFindById;
        Coupon.findByIdAndUpdate = origCouponFindByIdAndUpdate;
        Coupon.findOneAndUpdate = origCouponFindOneAndUpdate;
        Coupon.findByIdAndDelete = origCouponFindByIdAndDelete;
        Coupon.create = origCouponCreate;
        Coupon.countDocuments = origCouponCountDocuments;
        Coupon.aggregate = origCouponAggregate;
        Coupon.updateOne = origCouponUpdateOne;

        Order.find = origOrderFind;
        Order.findOne = origOrderFindOne;
        Order.findById = origOrderFindById;
        Order.findByIdAndUpdate = origOrderFindByIdAndUpdate;
        Order.create = origOrderCreate;
        Order.updateOne = origOrderUpdateOne;
        Order.aggregate = origOrderAggregate;

        Product.findById = origProductFindById;
        Product.findOneAndUpdate = origProductFindOneAndUpdate;
        Product.updateOne = origProductUpdateOne;

        Address.findOne = origAddressFindOne;
        User.findById = origUserFindById;
        User.findByIdAndUpdate = origUserFindByIdAndUpdate;
        User.updateOne = origUserUpdateOne;
        OtpVerification.findOne = origOtpFindOne;
        OtpVerification.updateOne = origOtpUpdateOne;
        mongoose.startSession = origStartSession;
    });

    describe('1. Coupon Configuration & Validation', () => {
        it('creates a valid percentage coupon and stores code in uppercase', async () => {
            const req = {
                body: {
                    code: 'save20',
                    discountType: 'percentage',
                    discountValue: 20,
                    minOrderAmount: 100,
                    expiryDate: new Date(Date.now() + 86400000).toISOString(),
                    usageLimit: 50,
                    active: true,
                    description: '20% off promotion'
                }
            };
            const res = createMockRes();
            await createCoupon(req, res);

            assert.equal(res.statusCode, 201);
            assert.equal(res.data.success, true);
            assert.equal(res.data.coupon.code, 'SAVE20');
            assert.equal(res.data.coupon.discountValue, 20);
            assert.equal(res.data.coupon.usedCount, 0);
        });

        it('rejects percentage discount value outside 1% - 100%', async () => {
            const reqZero = {
                body: {
                    code: 'ZERO',
                    discountType: 'percentage',
                    discountValue: 0,
                    expiryDate: new Date(Date.now() + 86400000).toISOString(),
                    usageLimit: 10
                }
            };
            const resZero = createMockRes();
            await createCoupon(reqZero, resZero);
            assert.equal(resZero.statusCode, 400);

            const reqOver = {
                body: {
                    code: 'OVER100',
                    discountType: 'percentage',
                    discountValue: 101,
                    expiryDate: new Date(Date.now() + 86400000).toISOString(),
                    usageLimit: 10
                }
            };
            const resOver = createMockRes();
            await createCoupon(reqOver, resOver);
            assert.equal(resOver.statusCode, 400);
        });

        it('rejects duplicate coupon code case-insensitively', async () => {
            couponStore.set('c1', {
                _id: 'c1',
                code: 'WELCOME10',
                discountType: 'fixed',
                discountValue: 10,
                expiryDate: new Date(Date.now() + 86400000)
            });

            const req = {
                body: {
                    code: 'welcome10',
                    discountType: 'fixed',
                    discountValue: 10,
                    expiryDate: new Date(Date.now() + 86400000).toISOString(),
                    usageLimit: 10
                }
            };
            const res = createMockRes();
            await createCoupon(req, res);
            assert.equal(res.statusCode, 400);
            assert.match(res.data.message, /already exists/i);
        });

        it('rejects past expiry date and negative minOrderAmount', async () => {
            const reqPast = {
                body: {
                    code: 'PASTEXP',
                    discountType: 'fixed',
                    discountValue: 10,
                    expiryDate: new Date(Date.now() - 1000).toISOString(),
                    usageLimit: 10
                }
            };
            const resPast = createMockRes();
            await createCoupon(reqPast, resPast);
            assert.equal(resPast.statusCode, 400);
            assert.match(resPast.data.message, /future/i);

            const reqNegMin = {
                body: {
                    code: 'NEGMIN',
                    discountType: 'fixed',
                    discountValue: 10,
                    minOrderAmount: -5,
                    expiryDate: new Date(Date.now() + 86400000).toISOString(),
                    usageLimit: 10
                }
            };
            const resNegMin = createMockRes();
            await createCoupon(reqNegMin, resNegMin);
            assert.equal(resNegMin.statusCode, 400);
        });
    });

    describe('2. Customer Coupon Validation Endpoint (POST /api/coupon/validate)', () => {
        beforeEach(() => {
            couponStore.set('c_pct', {
                _id: 'c_pct',
                code: 'PROMO15',
                discountType: 'percentage',
                discountValue: 15,
                minOrderAmount: 200,
                expiryDate: new Date(Date.now() + 86400000),
                usageLimit: 10,
                usedCount: 2,
                active: true
            });

            couponStore.set('c_fixed', {
                _id: 'c_fixed',
                code: 'FLAT50',
                discountType: 'fixed',
                discountValue: 50,
                minOrderAmount: 100,
                expiryDate: new Date(Date.now() + 86400000),
                usageLimit: 5,
                usedCount: 1,
                active: true
            });

            couponStore.set('c_inactive', {
                _id: 'c_inactive',
                code: 'INACTIVE',
                discountType: 'percentage',
                discountValue: 10,
                minOrderAmount: 0,
                expiryDate: new Date(Date.now() + 86400000),
                usageLimit: 5,
                usedCount: 0,
                active: false
            });

            couponStore.set('c_expired', {
                _id: 'c_expired',
                code: 'EXPIRED',
                discountType: 'percentage',
                discountValue: 10,
                minOrderAmount: 0,
                expiryDate: new Date(Date.now() - 86400000),
                usageLimit: 5,
                usedCount: 0,
                active: true
            });

            couponStore.set('c_maxed', {
                _id: 'c_maxed',
                code: 'MAXEDOUT',
                discountType: 'fixed',
                discountValue: 20,
                minOrderAmount: 0,
                expiryDate: new Date(Date.now() + 86400000),
                usageLimit: 3,
                usedCount: 3,
                active: true
            });
        });

        it('successfully validates percentage discount when subtotal meets minimum order', async () => {
            const req = {
                body: { code: 'promo15', subtotal: 300 }
            };
            const res = createMockRes();
            await validateCoupon(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.data.success, true);
            assert.equal(res.data.coupon.code, 'PROMO15');
            // 15% of 300 = 45
            assert.equal(res.data.coupon.discountAmount, 45);
        });

        it('successfully validates fixed discount and caps at subtotal if subtotal < discount', async () => {
            const req = {
                body: { code: 'FLAT50', subtotal: 200 }
            };
            const res = createMockRes();
            await validateCoupon(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.data.success, true);
            assert.equal(res.data.coupon.discountAmount, 50);
        });

        it('rejects coupon when subtotal does not meet minOrderAmount', async () => {
            const req = {
                body: { code: 'PROMO15', subtotal: 150 } // requires 200
            };
            const res = createMockRes();
            await validateCoupon(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.data.success, false);
            assert.match(res.data.message, /minimum order amount/i);
        });

        it('rejects inactive coupon', async () => {
            const req = {
                body: { code: 'INACTIVE', subtotal: 100 }
            };
            const res = createMockRes();
            await validateCoupon(req, res);

            assert.equal(res.statusCode, 400);
            assert.match(res.data.message, /inactive/i);
        });

        it('rejects expired coupon', async () => {
            const req = {
                body: { code: 'EXPIRED', subtotal: 100 }
            };
            const res = createMockRes();
            await validateCoupon(req, res);

            assert.equal(res.statusCode, 400);
            assert.match(res.data.message, /expired/i);
        });

        it('rejects coupon when usage limit is reached', async () => {
            const req = {
                body: { code: 'MAXEDOUT', subtotal: 100 }
            };
            const res = createMockRes();
            await validateCoupon(req, res);

            assert.equal(res.statusCode, 400);
            assert.match(res.data.message, /maximum redemption limit/i);
        });
    });

    describe('3. Admin Role Authorization & Coupon Operations', () => {
        it('requireRole("Admin") allows Admin and denies non-Admin roles (CEO, CTO, Strategist)', () => {
            const adminReq = { sellerRole: 'Admin' };
            const ceoReq = { sellerRole: 'CEO' };
            const ctoReq = { sellerRole: 'CTO' };
            const strategistReq = { sellerRole: 'Strategist' };

            const checkRole = (req) => {
                let calledNext = false;
                const res = createMockRes();
                const middleware = requireRole('Admin');
                middleware(req, res, () => { calledNext = true; });
                return { calledNext, statusCode: res.statusCode };
            };

            assert.equal(checkRole(adminReq).calledNext, true);
            assert.equal(checkRole(ceoReq).statusCode, 403);
            assert.equal(checkRole(ctoReq).statusCode, 403);
            assert.equal(checkRole(strategistReq).statusCode, 403);
        });

        it('Admin can toggle status, update coupon, and delete coupon', async () => {
            const testCId = '507f1f77bcf86cd799439077';
            couponStore.set(testCId, {
                _id: testCId,
                code: 'TEST25',
                discountType: 'percentage',
                discountValue: 25,
                minOrderAmount: 0,
                expiryDate: new Date(Date.now() + 86400000),
                usageLimit: 100,
                usedCount: 0,
                active: true
            });

            // Toggle status to inactive
            const toggleReq = { params: { id: testCId } };
            const toggleRes = createMockRes();
            await toggleCouponStatus(toggleReq, toggleRes);
            assert.equal(toggleRes.statusCode, 200);
            assert.equal(toggleRes.data.coupon.active, false);

            // Update discount value
            const updateReq = {
                params: { id: testCId },
                body: { discountValue: 30, active: true }
            };
            const updateRes = createMockRes();
            await updateCoupon(updateReq, updateRes);
            assert.equal(updateRes.statusCode, 200);
            assert.equal(updateRes.data.coupon.discountValue, 30);

            // Delete coupon
            const deleteReq = { params: { id: testCId } };
            const deleteRes = createMockRes();
            await deleteCoupon(deleteReq, deleteRes);
            assert.equal(deleteRes.statusCode, 200);
            assert.equal(couponStore.has(testCId), false);
        });

        it('Admin stats endpoint aggregates active coupons and total redemptions', async () => {
            couponStore.set('c1', { _id: 'c1', code: 'C1', active: true, expiryDate: new Date(Date.now() + 86400000), usedCount: 5 });
            couponStore.set('c2', { _id: 'c2', code: 'C2', active: false, expiryDate: new Date(Date.now() + 86400000), usedCount: 3 });

            const req = {};
            const res = createMockRes();
            await getCouponStats(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.data.success, true);
            assert.equal(res.data.stats.totalCoupons, 2);
            assert.equal(res.data.stats.activeCoupons, 1);
            assert.equal(res.data.stats.totalRedemptions, 8);
        });
    });

    describe('4. Order Placement with Atomic Coupon Reservation & Calculations', () => {
        const testUserId = '507f1f77bcf86cd799439011';
        const testProdId = '507f1f77bcf86cd799439012';
        const testAddrId = '507f1f77bcf86cd799439013';
        const testCoupId = '507f1f77bcf86cd799439014';

        beforeEach(() => {
            // Seed User, Product, Address
            userStore.set(testUserId, { _id: testUserId, cartItems: { [testProdId]: 2 } });
            addressStore.set(testAddrId, { _id: testAddrId, userId: testUserId });
            productStore.set(testProdId, {
                _id: testProdId,
                name: 'Organic Rice 5kg',
                price: 100,
                inStock: true,
                stockQuantity: 10
            });

            couponStore.set(testCoupId, {
                _id: testCoupId,
                code: 'SAVE20',
                discountType: 'percentage',
                discountValue: 20, // 20%
                minOrderAmount: 100,
                expiryDate: new Date(Date.now() + 86400000),
                usageLimit: 2,
                usedCount: 0,
                active: true
            });
        });

        it('places order with coupon, accurately applies discount and 2% tax on discounted amount', async () => {
            // 2 items * 100 = 200 subtotal
            // 20% coupon discount = 40
            // Discounted subtotal = 160
            // 2% tax on 160 = Math.floor(160 * 0.02) = 3
            // Total amount = 163
            const req = {
                userId: testUserId,
                body: {
                    items: [{ product: testProdId, quantity: 2 }],
                    address: testAddrId,
                    verificationToken: 'valid_test_token_123',
                    couponCode: 'save20'
                }
            };
            const res = createMockRes();
            await placeOrderCOD(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.data.success, true);

            // Verify order saved in store
            const createdOrder = orderStore.get(res.data.orderId);
            assert.ok(createdOrder, 'Order must be created in store');
            assert.equal(createdOrder.amount, 163, 'Order amount must reflect discounted subtotal + tax');
            assert.equal(createdOrder.coupon.code, 'SAVE20');
            assert.equal(createdOrder.coupon.discountAmount, 40);

            // Verify coupon usedCount incremented atomically
            const updatedCoupon = couponStore.get(testCoupId);
            assert.equal(updatedCoupon.usedCount, 1, 'Coupon usedCount must be incremented to 1');
        });

        it('atomic usage limit enforcement rejects checkout when usage limit is reached concurrently', async () => {
            // Max out coupon usage
            const coup = couponStore.get(testCoupId);
            coup.usedCount = 2; // usageLimit is 2
            couponStore.set(testCoupId, coup);

            const req = {
                userId: testUserId,
                body: {
                    items: [{ product: testProdId, quantity: 2 }],
                    address: testAddrId,
                    verificationToken: 'valid_test_token_123',
                    couponCode: 'SAVE20'
                }
            };
            const res = createMockRes();
            await placeOrderCOD(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.data.success, false);
            assert.match(res.data.message, /maximum redemption limit/i);
        });
    });

    describe('5. Order Cancellation Coupon Rollback', () => {
        const testCancelOrderId = '507f1f77bcf86cd799439021';
        const testCancelCoupId = '507f1f77bcf86cd799439022';

        beforeEach(() => {
            couponStore.set(testCancelCoupId, {
                _id: testCancelCoupId,
                code: 'ROLLBACK10',
                usedCount: 2,
                usageLimit: 10,
                active: true
            });

            orderStore.set(testCancelOrderId, {
                _id: testCancelOrderId,
                userId: '507f1f77bcf86cd799439011',
                status: 'Order Placed',
                paymentType: 'COD',
                isPaid: false,
                amount: 90,
                items: [{ product: '507f1f77bcf86cd799439012', quantity: 1 }],
                stockDeducted: true,
                coupon: {
                    code: 'ROLLBACK10',
                    discountType: 'fixed',
                    discountValue: 10,
                    discountAmount: 10
                },
                couponReleased: false
            });
        });

        it('cancelling an order decrements coupon usedCount safely', async () => {
            const req = {
                sellerEmail: 'admin@greencart.com',
                body: {
                    orderId: testCancelOrderId,
                    status: 'Cancelled'
                }
            };
            const res = createMockRes();
            await updateOrderStatus(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.data.success, true);

            const coup = couponStore.get(testCancelCoupId);
            assert.equal(coup.usedCount, 1, 'usedCount must be decremented from 2 to 1');

            const order = orderStore.get(testCancelOrderId);
            assert.equal(order.status, 'Cancelled');
            assert.equal(order.couponReleased, true);
        });

        it('duplicate cancellation attempt on already cancelled order is rejected without extra decrement', async () => {
            // First cancellation
            const req1 = {
                sellerEmail: 'admin@greencart.com',
                body: { orderId: testCancelOrderId, status: 'Cancelled' }
            };
            const res1 = createMockRes();
            await updateOrderStatus(req1, res1);
            assert.equal(res1.statusCode, 200);

            // Second cancellation attempt
            const req2 = {
                sellerEmail: 'admin@greencart.com',
                body: { orderId: testCancelOrderId, status: 'Cancelled' }
            };
            const res2 = createMockRes();
            await updateOrderStatus(req2, res2);

            assert.equal(res2.statusCode, 400);
            assert.match(res2.data.message, /already Cancelled/i);

            // usedCount must still be 1 (not 0)
            const coup = couponStore.get(testCancelCoupId);
            assert.equal(coup.usedCount, 1, 'usedCount must NOT be decremented twice');
        });
    });

    describe('6. Official Invoice PDF Service Coupon Integration', () => {
        it('renders coupon discount and calculates totals in PDFKit invoice buffer', async () => {
            const orderData = {
                _id: 'order_pdf_test',
                orderNumber: 'GC-CPN123',
                createdAt: new Date(),
                paymentType: 'COD',
                isPaid: true,
                status: 'Order Placed',
                amount: 163, // 200 - 40 + 3 = 163
                items: [
                    {
                        name: 'Organic Basmati Rice 5kg',
                        quantity: 2,
                        unitPrice: 100
                    }
                ],
                coupon: {
                    code: 'SAVE20',
                    discountType: 'percentage',
                    discountValue: 20,
                    discountAmount: 40
                },
                address: {
                    firstName: 'Alice',
                    lastName: 'Green',
                    street: '123 Forest Ave',
                    city: 'Dhaka',
                    country: 'Bangladesh'
                }
            };

            const pdfBuffer = await generateInvoicePdf(orderData, { compress: false });
            assert.ok(Buffer.isBuffer(pdfBuffer), 'Result must be a Node.js Buffer');
            assert.ok(pdfBuffer.length > 500, 'PDF buffer must contain rendered content');

            const pdfText = extractPdfText(pdfBuffer);
            assert.ok(pdfText.includes('GC-CPN123'), 'PDF must include order number');
            assert.ok(pdfText.includes('SAVE20'), 'PDF must include coupon code');
            assert.ok(pdfText.includes('Coupon Discount'), 'PDF must include Coupon Discount label');
        });
    });
});
