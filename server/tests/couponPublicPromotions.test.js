import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Coupon from '../models/Coupon.js';
import { getPublicPromotions } from '../controllers/couponController.js';

describe('Coupon Public Promotions (Popup & Ticker) Security & Eligibility Suite', () => {
    let mockCoupons = [];
    let origFind;

    beforeEach(() => {
        mockCoupons = [];
        origFind = Coupon.find;

        Coupon.find = (filter) => {
            return {
                sort: () => ({
                    lean: async () => {
                        const now = new Date();
                        return mockCoupons.filter(c => {
                            if (filter?.active !== undefined && c.active !== filter.active) return false;
                            if (filter?.expiryDate?.$gt && new Date(c.expiryDate) <= filter.expiryDate.$gt) return false;
                            return true;
                        });
                    }
                })
            };
        };
    });

    afterEach(() => {
        Coupon.find = origFind;
    });

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

    it('returns eligible active coupons that are not expired and within usage limit', async () => {
        const futureDate = new Date(Date.now() + 86400000 * 7); // 7 days in future
        mockCoupons = [
            {
                _id: new mongoose.Types.ObjectId(),
                code: 'SUMMER20',
                discountType: 'percentage',
                discountValue: 20,
                minOrderAmount: 500,
                expiryDate: futureDate,
                usageLimit: 100,
                usedCount: 10,
                active: true,
                description: '20% off summer groceries'
            },
            {
                _id: new mongoose.Types.ObjectId(),
                code: 'FLAT50',
                discountType: 'fixed',
                discountValue: 50,
                minOrderAmount: 300,
                expiryDate: futureDate,
                usageLimit: 50,
                usedCount: 5,
                active: true,
                description: 'Flat ৳50 off'
            }
        ];

        const req = {};
        const res = createMockRes();

        await getPublicPromotions(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.coupons.length, 2);

        // Verify promotional details
        const promo1 = res.data.coupons.find(c => c.code === 'SUMMER20');
        assert.ok(promo1);
        assert.equal(promo1.discountType, 'percentage');
        assert.equal(promo1.discountValue, 20);
        assert.equal(promo1.minOrderAmount, 500);
        assert.equal(promo1.description, '20% off summer groceries');

        const promo2 = res.data.coupons.find(c => c.code === 'FLAT50');
        assert.ok(promo2);
        assert.equal(promo2.discountType, 'fixed');
        assert.equal(promo2.discountValue, 50);
        assert.equal(promo2.minOrderAmount, 300);
    });

    it('excludes inactive coupons even if unexpired and within usage limit', async () => {
        const futureDate = new Date(Date.now() + 86400000 * 7);
        mockCoupons = [
            {
                _id: new mongoose.Types.ObjectId(),
                code: 'INACTIVE10',
                discountType: 'percentage',
                discountValue: 10,
                minOrderAmount: 200,
                expiryDate: futureDate,
                usageLimit: 100,
                usedCount: 0,
                active: false,
                description: 'Inactive coupon'
            }
        ];

        const req = {};
        const res = createMockRes();

        await getPublicPromotions(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.coupons.length, 0, 'Inactive coupon must not be returned');
    });

    it('excludes expired coupons', async () => {
        const pastDate = new Date(Date.now() - 86400000); // 1 day ago
        mockCoupons = [
            {
                _id: new mongoose.Types.ObjectId(),
                code: 'EXPIRED30',
                discountType: 'percentage',
                discountValue: 30,
                minOrderAmount: 100,
                expiryDate: pastDate,
                usageLimit: 100,
                usedCount: 5,
                active: true,
                description: 'Expired coupon'
            }
        ];

        const req = {};
        const res = createMockRes();

        await getPublicPromotions(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.coupons.length, 0, 'Expired coupon must not be returned');
    });

    it('excludes coupons whose usage limit is reached or exceeded', async () => {
        const futureDate = new Date(Date.now() + 86400000 * 7);
        mockCoupons = [
            {
                _id: new mongoose.Types.ObjectId(),
                code: 'EXHAUSTED',
                discountType: 'fixed',
                discountValue: 100,
                minOrderAmount: 500,
                expiryDate: futureDate,
                usageLimit: 10,
                usedCount: 10, // Reached limit!
                active: true,
                description: 'Exhausted coupon'
            },
            {
                _id: new mongoose.Types.ObjectId(),
                code: 'OVERUSED',
                discountType: 'fixed',
                discountValue: 50,
                minOrderAmount: 200,
                expiryDate: futureDate,
                usageLimit: 5,
                usedCount: 6, // Exceeded limit!
                active: true,
                description: 'Overused coupon'
            }
        ];

        const req = {};
        const res = createMockRes();

        await getPublicPromotions(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.coupons.length, 0, 'Coupons at or over usage limit must not be returned');
    });

    it('sanitizes response and strictly removes internal metrics and IDs', async () => {
        const futureDate = new Date(Date.now() + 86400000 * 7);
        mockCoupons = [
            {
                _id: new mongoose.Types.ObjectId('672b1234567890abcdef1234'),
                code: 'SECRETSTATS',
                discountType: 'percentage',
                discountValue: 15,
                minOrderAmount: 250,
                expiryDate: futureDate,
                usageLimit: 500,
                usedCount: 42,
                active: true,
                description: 'Special promo',
                createdAt: new Date(),
                updatedAt: new Date(),
                internalNotes: 'Confidential promo target'
            }
        ];

        const req = {};
        const res = createMockRes();

        await getPublicPromotions(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.coupons.length, 1);
        const item = res.data.coupons[0];

        // Must NOT expose internal properties
        assert.equal(item._id, undefined, '_id must not be exposed');
        assert.equal(item.usageLimit, undefined, 'usageLimit must not be exposed');
        assert.equal(item.usedCount, undefined, 'usedCount must not be exposed');
        assert.equal(item.internalNotes, undefined, 'internal notes must not be exposed');

        // Must only expose safe promotional properties
        assert.equal(item.code, 'SECRETSTATS');
        assert.equal(item.discountType, 'percentage');
        assert.equal(item.discountValue, 15);
        assert.equal(item.minOrderAmount, 250);
        assert.equal(item.description, 'Special promo');
        assert.ok(item.expiryDate);
    });

    it('returns empty array when database contains no eligible coupons', async () => {
        mockCoupons = [];
        const req = {};
        const res = createMockRes();

        await getPublicPromotions(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.deepEqual(res.data.coupons, []);
    });
});
