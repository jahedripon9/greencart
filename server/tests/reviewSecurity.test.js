import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import authUser from '../middlewares/authUser.js';
import authSeller from '../middlewares/authSeller.js';
import { deleteProduct } from '../controllers/productController.js';
import {
    submitReview,
    checkReviewEligibility,
    updateReview,
    deleteReview,
    getProductReviews,
    getSellerReviews,
    moderateReview,
    recalculateProductRating
} from '../controllers/reviewController.js';
import {
    createReviewLimiter,
    reviewSubmissionKeyGenerator,
    reviewSubmissionLimiter
} from '../routes/reviewRoute.js';

// Helper to create mock response object
const createMockRes = () => {
    let statusCode = 200;
    let jsonResult = null;
    return {
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            statusCode = code;
            return this;
        },
        json(data) {
            jsonResult = data;
            return this;
        },
        getStatusCode: () => statusCode,
        getJson: () => jsonResult
    };
};

// Fluent query builder for Mongoose mocks
class MockQuery {
    constructor(dataPromise) {
        this._promise = Promise.resolve(dataPromise);
    }
    populate(field, select) {
        this._promise = this._promise.then(items => {
            if (!items) return items;
            const isArray = Array.isArray(items);
            const list = isArray ? items : [items];
            const populated = list.map(item => {
                const copy = { ...item };
                if (field === 'customerId' && copy.customerId) {
                    copy.customerId = {
                        _id: copy.customerId,
                        name: copy.customerName || 'Customer Test',
                        ...(select?.includes('email') ? { email: 'customer@test.com' } : {})
                    };
                }
                if (field === 'productId' && copy.productId) {
                    copy.productId = {
                        _id: copy.productId,
                        name: 'Product Test',
                        image: ['img1.jpg'],
                        price: 100
                    };
                }
                return copy;
            });
            return isArray ? populated : populated[0];
        });
        return this;
    }
    sort(sortSpec) {
        this._promise = this._promise.then(items => {
            if (!Array.isArray(items)) return items;
            const copy = [...items];
            if (sortSpec?.rating === -1) {
                copy.sort((a, b) => b.rating - a.rating);
            } else if (sortSpec?.rating === 1) {
                copy.sort((a, b) => a.rating - b.rating);
            } else if (sortSpec?.createdAt === -1) {
                copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            }
            return copy;
        });
        return this;
    }
    skip(n) {
        if (typeof n === 'number' && n > 0) {
            this._promise = this._promise.then(items => Array.isArray(items) ? items.slice(n) : items);
        }
        return this;
    }
    limit(n) {
        if (typeof n === 'number' && n > 0) {
            this._promise = this._promise.then(items => Array.isArray(items) ? items.slice(0, n) : items);
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

describe('GreenCart Review & Rating Security Suite (Phase 6, Batch 6A)', () => {
    const JWT_SECRET_TEST = 'review_test_secret_key_32_bytes_long_123';
    const SELLER_EMAIL_TEST = 'admin@greencart.com';

    const customerAId = '507f1f77bcf86cd799439011';
    const customerBId = '507f1f77bcf86cd799439022';
    const productAId = '507f1f77bcf86cd799439033';
    const productBId = '507f1f77bcf86cd799439044';
    const orderDeliveredId = '507f1f77bcf86cd799439055';

    let originalEnv;
    let reviewStore;
    let productStore;
    let orderStore;
    let origReviewMethods;
    let origProductMethods;
    let origOrderMethods;
    let origStartSession;

    beforeEach(() => {
        origStartSession = mongoose.startSession;
        originalEnv = {
            JWT_SECRET: process.env.JWT_SECRET,
            SELLER_EMAIL: process.env.SELLER_EMAIL
        };
        process.env.JWT_SECRET = JWT_SECRET_TEST;
        process.env.SELLER_EMAIL = SELLER_EMAIL_TEST;

        reviewStore = new Map();
        productStore = new Map();
        orderStore = new Map();

        // Seed product
        productStore.set(productAId, {
            _id: productAId,
            name: 'Fresh Organic Mangoes',
            price: 500,
            offerPrice: 450,
            inStock: true,
            averageRating: 0,
            reviewCount: 0
        });

        // Seed product B
        productStore.set(productBId, {
            _id: productBId,
            name: 'Farm Fresh Milk',
            price: 90,
            offerPrice: 85,
            inStock: true,
            averageRating: 0,
            reviewCount: 0
        });

        // Seed delivered order containing Product A for Customer A
        orderStore.set(orderDeliveredId, {
            _id: orderDeliveredId,
            userId: customerAId,
            status: 'Delivered',
            items: [
                { product: productAId, quantity: 2 }
            ]
        });

        // Backup methods
        origReviewMethods = {
            create: Review.create,
            find: Review.find,
            findOne: Review.findOne,
            findById: Review.findById,
            findByIdAndUpdate: Review.findByIdAndUpdate,
            findByIdAndDelete: Review.findByIdAndDelete,
            deleteMany: Review.deleteMany,
            countDocuments: Review.countDocuments,
            aggregate: Review.aggregate
        };

        origProductMethods = {
            findById: Product.findById,
            findByIdAndUpdate: Product.findByIdAndUpdate,
            findByIdAndDelete: Product.findByIdAndDelete
        };

        origOrderMethods = {
            findOne: Order.findOne
        };

        // Wire Mock Product
        Product.findById = async (id) => {
            const p = productStore.get(String(id));
            return p ? { ...p } : null;
        };

        Product.findByIdAndUpdate = async (id, update) => {
            const p = productStore.get(String(id));
            if (!p) return null;
            const updated = { ...p };
            if (update.$set) Object.assign(updated, update.$set);
            productStore.set(String(id), updated);
            return { ...updated };
        };

        Product.findByIdAndDelete = async (id) => {
            const p = productStore.get(String(id));
            if (!p) return null;
            productStore.delete(String(id));
            return { ...p };
        };

        // Wire Mock Order
        Order.findOne = async (query) => {
            for (const order of orderStore.values()) {
                const matchUser = !query.userId || order.userId.toString() === query.userId.toString();
                const matchStatus = !query.status || order.status === query.status;
                let matchItem = true;
                if (query['items.product']) {
                    matchItem = order.items && order.items.some(
                        it => it.product?.toString() === query['items.product']?.toString()
                    );
                }
                if (matchUser && matchStatus && matchItem) {
                    return { ...order };
                }
            }
            return null;
        };

        // Wire Mock Review
        Review.create = async (doc) => {
            const id = doc._id || new mongoose.Types.ObjectId().toString();
            // Check uniqueness { productId, customerId }
            for (const r of reviewStore.values()) {
                if (r.productId.toString() === doc.productId.toString() && r.customerId.toString() === doc.customerId.toString()) {
                    const err = new Error('E11000 duplicate key error');
                    err.code = 11000;
                    throw err;
                }
            }
            const record = {
                _id: id,
                ...doc,
                moderationStatus: doc.moderationStatus || 'pending',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            reviewStore.set(id.toString(), record);
            return { ...record };
        };

        Review.findOne = async (query) => {
            for (const r of reviewStore.values()) {
                const matchProd = !query.productId || r.productId.toString() === query.productId.toString();
                const matchCust = !query.customerId || r.customerId.toString() === query.customerId.toString();
                if (matchProd && matchCust) {
                    return { ...r };
                }
            }
            return null;
        };

        Review.findById = async (id) => {
            const r = reviewStore.get(String(id));
            if (!r) return null;
            return {
                ...r,
                save: async function() {
                    reviewStore.set(this._id.toString(), { ...this, updatedAt: new Date() });
                    return this;
                }
            };
        };

        Review.find = (filter = {}) => {
            let list = Array.from(reviewStore.values());
            if (filter.productId) {
                list = list.filter(r => r.productId.toString() === filter.productId.toString());
            }
            if (filter.moderationStatus) {
                list = list.filter(r => r.moderationStatus === filter.moderationStatus);
            }
            return new MockQuery(list.map(r => ({ ...r })));
        };

        Review.countDocuments = async (filter = {}) => {
            let list = Array.from(reviewStore.values());
            if (filter.productId) {
                list = list.filter(r => r.productId.toString() === filter.productId.toString());
            }
            if (filter.moderationStatus) {
                list = list.filter(r => r.moderationStatus === filter.moderationStatus);
            }
            return list.length;
        };

        Review.findByIdAndUpdate = async (id, update) => {
            const r = reviewStore.get(String(id));
            if (!r) return null;
            const updated = { ...r };
            if (update.$set) Object.assign(updated, update.$set);
            updated.updatedAt = new Date();
            reviewStore.set(String(id), updated);
            return { ...updated };
        };

        Review.findByIdAndDelete = async (id) => {
            const r = reviewStore.get(String(id));
            if (!r) return null;
            reviewStore.delete(String(id));
            return { ...r };
        };

        Review.deleteMany = async (filter = {}) => {
            let count = 0;
            for (const [id, r] of reviewStore.entries()) {
                if (!filter.productId || r.productId.toString() === filter.productId.toString()) {
                    reviewStore.delete(id);
                    count++;
                }
            }
            return { deletedCount: count };
        };

        Review.aggregate = async (pipeline) => {
            const matchStage = pipeline.find(s => s.$match)?.$match || {};
            let matched = Array.from(reviewStore.values());
            if (matchStage.productId) {
                matched = matched.filter(r => r.productId.toString() === matchStage.productId.toString());
            }
            if (matchStage.moderationStatus) {
                matched = matched.filter(r => r.moderationStatus === matchStage.moderationStatus);
            }
            if (matched.length === 0) return [];

            const total = matched.length;
            const sum = matched.reduce((acc, r) => acc + r.rating, 0);
            const avg = sum / total;
            return [{ _id: matchStage.productId, avgRating: avg, totalReviews: total }];
        };
    });

    afterEach(() => {
        process.env.JWT_SECRET = originalEnv.JWT_SECRET;
        process.env.SELLER_EMAIL = originalEnv.SELLER_EMAIL;
        mongoose.startSession = origStartSession;
        Object.assign(Review, origReviewMethods);
        Object.assign(Product, origProductMethods);
        Object.assign(Order, origOrderMethods);
    });

    // =========================================================================
    // 1. Authentication & Order Delivery Validation
    // =========================================================================
    describe('1. Verified Purchase & Delivery Validation', () => {
        it('1. Unauthenticated customer cannot submit a review (401)', async () => {
            const req = { params: { productId: productAId }, body: { rating: 5, comment: 'Great product' } };
            const res = createMockRes();
            await submitReview(req, res);
            assert.equal(res.getStatusCode(), 401);
            assert.equal(res.getJson().success, false);
        });

        it('2. Customer without a Delivered order is rejected (403)', async () => {
            const req = {
                userId: customerBId, // Customer B has placed no orders
                params: { productId: productAId },
                body: { rating: 5, comment: 'I did not buy this' }
            };
            const res = createMockRes();
            await submitReview(req, res);
            assert.equal(res.getStatusCode(), 403);
            assert.match(res.getJson().message, /delivered order/i);
        });

        it('3. Customer with Order Placed status is rejected (403)', async () => {
            orderStore.set('ord_placed', {
                _id: 'ord_placed',
                userId: customerBId,
                status: 'Order Placed',
                items: [{ product: productAId, quantity: 1 }]
            });
            const req = { userId: customerBId, params: { productId: productAId }, body: { rating: 5, comment: 'Testing order placed' } };
            const res = createMockRes();
            await submitReview(req, res);
            assert.equal(res.getStatusCode(), 403);
        });

        it('4. Customer with Packing status is rejected (403)', async () => {
            orderStore.set('ord_packing', {
                _id: 'ord_packing',
                userId: customerBId,
                status: 'Packing',
                items: [{ product: productAId, quantity: 1 }]
            });
            const req = { userId: customerBId, params: { productId: productAId }, body: { rating: 5, comment: 'Testing packing' } };
            const res = createMockRes();
            await submitReview(req, res);
            assert.equal(res.getStatusCode(), 403);
        });

        it('5. Customer with Shipped status is rejected (403)', async () => {
            orderStore.set('ord_shipped', {
                _id: 'ord_shipped',
                userId: customerBId,
                status: 'Shipped',
                items: [{ product: productAId, quantity: 1 }]
            });
            const req = { userId: customerBId, params: { productId: productAId }, body: { rating: 5, comment: 'Testing shipped' } };
            const res = createMockRes();
            await submitReview(req, res);
            assert.equal(res.getStatusCode(), 403);
        });

        it('6. Customer with Out for Delivery status is rejected (403)', async () => {
            orderStore.set('ord_ofd', {
                _id: 'ord_ofd',
                userId: customerBId,
                status: 'Out for Delivery',
                items: [{ product: productAId, quantity: 1 }]
            });
            const req = { userId: customerBId, params: { productId: productAId }, body: { rating: 5, comment: 'Testing OFD' } };
            const res = createMockRes();
            await submitReview(req, res);
            assert.equal(res.getStatusCode(), 403);
        });

        it('7. Customer with Cancelled order is rejected (403)', async () => {
            orderStore.set('ord_cancelled', {
                _id: 'ord_cancelled',
                userId: customerBId,
                status: 'Cancelled',
                items: [{ product: productAId, quantity: 1 }]
            });
            const req = { userId: customerBId, params: { productId: productAId }, body: { rating: 5, comment: 'Testing cancelled' } };
            const res = createMockRes();
            await submitReview(req, res);
            assert.equal(res.getStatusCode(), 403);
        });

        it('8. Customer with Delivered order containing the product can submit (201)', async () => {
            const req = {
                userId: customerAId,
                params: { productId: productAId },
                body: { rating: 5, title: 'Amazing Mangoes', comment: 'Sweet and fresh organic mangoes!' }
            };
            const res = createMockRes();
            await submitReview(req, res);
            assert.equal(res.getStatusCode(), 201);
            assert.equal(res.getJson().success, true);
            assert.equal(res.getJson().review.moderationStatus, 'pending');
            assert.equal(res.getJson().review.isVerifiedPurchase, true);
            assert.equal(res.getJson().review.orderId, orderDeliveredId);
        });

        it('9. Delivered order containing a different product is rejected (403)', async () => {
            // Customer A has delivered order for Product A, but attempts to review Product B
            const req = {
                userId: customerAId,
                params: { productId: productBId },
                body: { rating: 4, comment: 'Did not buy this product' }
            };
            const res = createMockRes();
            await submitReview(req, res);
            assert.equal(res.getStatusCode(), 403);
            assert.match(res.getJson().message, /delivered order/i);
        });
    });

    // =========================================================================
    // 2. Input Validation & Duplicate Protection
    // =========================================================================
    describe('2. Input Validation & Duplicate Constraints', () => {
        it('10. Rating outside 1–5 is rejected (400)', async () => {
            const resLow = createMockRes();
            await submitReview({ userId: customerAId, params: { productId: productAId }, body: { rating: 0, comment: 'Valid comment text' } }, resLow);
            assert.equal(resLow.getStatusCode(), 400);

            const resHigh = createMockRes();
            await submitReview({ userId: customerAId, params: { productId: productAId }, body: { rating: 6, comment: 'Valid comment text' } }, resHigh);
            assert.equal(resHigh.getStatusCode(), 400);
        });

        it('11. Non-integer rating is rejected (400)', async () => {
            const res = createMockRes();
            await submitReview({ userId: customerAId, params: { productId: productAId }, body: { rating: 4.5, comment: 'Valid comment text' } }, res);
            assert.equal(res.getStatusCode(), 400);
            assert.match(res.getJson().message, /integer/i);
        });

        it('12. Invalid comment length is rejected (<5 or >1000) (400)', async () => {
            const resShort = createMockRes();
            await submitReview({ userId: customerAId, params: { productId: productAId }, body: { rating: 5, comment: 'Hey' } }, resShort);
            assert.equal(resShort.getStatusCode(), 400);

            const resLong = createMockRes();
            await submitReview({ userId: customerAId, params: { productId: productAId }, body: { rating: 5, comment: 'x'.repeat(1001) } }, resLong);
            assert.equal(resLong.getStatusCode(), 400);
        });

        it('13. Duplicate customer/product review is rejected (400)', async () => {
            // First submission
            const res1 = createMockRes();
            await submitReview({ userId: customerAId, params: { productId: productAId }, body: { rating: 5, comment: 'First review submission' } }, res1);
            assert.equal(res1.getStatusCode(), 201);

            // Second submission for same product by same customer
            const res2 = createMockRes();
            await submitReview({ userId: customerAId, params: { productId: productAId }, body: { rating: 4, comment: 'Duplicate review submission' } }, res2);
            assert.equal(res2.getStatusCode(), 400);
            assert.match(res2.getJson().message, /already reviewed/i);
        });

        it('14. Concurrent duplicate submissions cannot create multiple reviews', async () => {
            const req1 = { userId: customerAId, params: { productId: productAId }, body: { rating: 5, comment: 'Concurrent A' } };
            const req2 = { userId: customerAId, params: { productId: productAId }, body: { rating: 5, comment: 'Concurrent B' } };
            const res1 = createMockRes();
            const res2 = createMockRes();

            await Promise.all([
                submitReview(req1, res1),
                submitReview(req2, res2)
            ]);

            // Exactly one succeeds with 201, the other is blocked with 400
            const statuses = [res1.getStatusCode(), res2.getStatusCode()].sort();
            assert.deepEqual(statuses, [201, 400]);

            const count = Array.from(reviewStore.values()).filter(r => r.productId === productAId && r.customerId === customerAId).length;
            assert.equal(count, 1);
        });
    });

    // =========================================================================
    // 3. Customer Review Management (Edit / Delete / Eligibility)
    // =========================================================================
    describe('3. Customer Review Management & IDOR Protection', () => {
        let reviewAId;

        beforeEach(async () => {
            const res = createMockRes();
            await submitReview({
                userId: customerAId,
                params: { productId: productAId },
                body: { rating: 4, title: 'Good', comment: 'Initial comment here' }
            }, res);
            reviewAId = res.getJson().review._id;
        });

        it('15. Customer can edit their own review (200)', async () => {
            const req = {
                userId: customerAId,
                params: { reviewId: reviewAId },
                body: { rating: 5, title: 'Updated Title', comment: 'Updated excellent review' }
            };
            const res = createMockRes();
            await updateReview(req, res);
            assert.equal(res.getStatusCode(), 200);
            assert.equal(res.getJson().success, true);
            assert.equal(res.getJson().review.rating, 5);
            assert.equal(res.getJson().review.title, 'Updated Title');
            assert.equal(res.getJson().review.comment, 'Updated excellent review');
            assert.equal(res.getJson().review.moderationStatus, 'pending');
        });

        it('16. Customer cannot edit another customer\'s review (403)', async () => {
            const req = {
                userId: customerBId, // Cross-customer tampering
                params: { reviewId: reviewAId },
                body: { rating: 1, comment: 'Malicious modification' }
            };
            const res = createMockRes();
            await updateReview(req, res);
            assert.equal(res.getStatusCode(), 403);
            assert.match(res.getJson().message, /Forbidden/i);
        });

        it('17. Customer can delete their own review (200)', async () => {
            const req = { userId: customerAId, params: { reviewId: reviewAId } };
            const res = createMockRes();
            await deleteReview(req, res);
            assert.equal(res.getStatusCode(), 200);
            assert.equal(res.getJson().success, true);
            assert.equal(reviewStore.has(reviewAId), false);
        });

        it('18. Customer cannot delete another customer\'s review (403)', async () => {
            const req = { userId: customerBId, params: { reviewId: reviewAId } };
            const res = createMockRes();
            await deleteReview(req, res);
            assert.equal(res.getStatusCode(), 403);
            assert.equal(reviewStore.has(reviewAId), true);
        });

        it('Customer eligibility endpoint returns accurate eligibility flags', async () => {
            const resA = createMockRes();
            await checkReviewEligibility({ userId: customerAId, params: { productId: productAId } }, resA);
            assert.equal(resA.getStatusCode(), 200);
            assert.equal(resA.getJson().canReview, false); // Already reviewed
            assert.equal(resA.getJson().hasDeliveredOrder, true);
            assert.equal(resA.getJson().alreadyReviewed, true);

            const resB = createMockRes();
            await checkReviewEligibility({ userId: customerBId, params: { productId: productAId } }, resB);
            assert.equal(resB.getStatusCode(), 200);
            assert.equal(resB.getJson().canReview, false);
            assert.equal(resB.getJson().hasDeliveredOrder, false);
        });
    });

    // =========================================================================
    // 4. Public API & Rating Summary Calculation
    // =========================================================================
    describe('4. Public API & Rating Aggregation', () => {
        let rev1Id, rev2Id;

        beforeEach(async () => {
            // Seed review 1 (Customer A)
            const r1 = await Review.create({
                productId: productAId,
                customerId: customerAId,
                orderId: orderDeliveredId,
                rating: 5,
                title: 'Top Mango',
                comment: 'The sweetest mangoes',
                moderationStatus: 'approved'
            });
            rev1Id = r1._id;

            // Seed review 2 (Customer B)
            const r2 = await Review.create({
                productId: productAId,
                customerId: customerBId,
                orderId: orderDeliveredId,
                rating: 4,
                title: 'Nice',
                comment: 'Really fresh and ripe',
                moderationStatus: 'pending' // Pending approval!
            });
            rev2Id = r2._id;

            await recalculateProductRating(productAId);
        });

        it('19. Public API exposes approved reviews only', async () => {
            const req = { params: { productId: productAId }, query: {} };
            const res = createMockRes();
            await getProductReviews(req, res);

            assert.equal(res.getStatusCode(), 200);
            const reviews = res.getJson().reviews;
            assert.equal(reviews.length, 1);
            assert.equal(reviews[0]._id.toString(), rev1Id.toString());
            assert.equal(reviews[0].moderationStatus, 'approved');
        });

        it('20. Public API does not expose customer email or private fields', async () => {
            const req = { params: { productId: productAId }, query: {} };
            const res = createMockRes();
            await getProductReviews(req, res);

            const jsonStr = JSON.stringify(res.getJson());
            assert.equal(jsonStr.includes('customer@test.com'), false);
            assert.equal(jsonStr.includes('password'), false);
        });

        it('21. Unapproved reviews do not affect average rating or count', async () => {
            const prod = productStore.get(productAId);
            // Only Rev 1 (rating 5) is approved
            assert.equal(prod.averageRating, 5);
            assert.equal(prod.reviewCount, 1);
        });

        it('22. Approving a review updates product summary', async () => {
            // Approve Rev 2 (rating 4)
            await moderateReview(
                { params: { reviewId: rev2Id }, body: { status: 'approved' } },
                createMockRes()
            );

            const prod = productStore.get(productAId);
            // (5 + 4) / 2 = 4.5 average
            assert.equal(prod.averageRating, 4.5);
            assert.equal(prod.reviewCount, 2);
        });

        it('23. Rejecting an approved review removes it from product summary', async () => {
            // Rev 1 was approved. Reject it.
            await moderateReview(
                { params: { reviewId: rev1Id }, body: { status: 'rejected' } },
                createMockRes()
            );

            const prod = productStore.get(productAId);
            // No approved reviews left -> resets to 0
            assert.equal(prod.averageRating, 0);
            assert.equal(prod.reviewCount, 0);
        });

        it('24. Editing an approved review returns it to pending and updates summary', async () => {
            // Customer A edits approved review
            await updateReview(
                { userId: customerAId, params: { reviewId: rev1Id }, body: { rating: 3, comment: 'Changed my mind' } },
                createMockRes()
            );

            const r = reviewStore.get(rev1Id.toString());
            assert.equal(r.moderationStatus, 'pending');

            const prod = productStore.get(productAId);
            assert.equal(prod.averageRating, 0);
            assert.equal(prod.reviewCount, 0);
        });

        it('25. Deleting an approved review updates summary', async () => {
            await deleteReview(
                { userId: customerAId, params: { reviewId: rev1Id } },
                createMockRes()
            );

            const prod = productStore.get(productAId);
            assert.equal(prod.averageRating, 0);
            assert.equal(prod.reviewCount, 0);
        });
    });

    // =========================================================================
    // 5. Seller Moderation & Pagination Limits
    // =========================================================================
    describe('5. Seller Moderation & Pagination Control', () => {
        let testRevId;

        beforeEach(async () => {
            const r = await Review.create({
                productId: productAId,
                customerId: customerAId,
                orderId: orderDeliveredId,
                rating: 3,
                title: 'Review for mod',
                comment: 'Moderation test text',
                moderationStatus: 'pending'
            });
            testRevId = r._id;
        });

        it('26. Unauthenticated seller cannot moderate reviews (401)', async () => {
            const req = { cookies: {} };
            const res = createMockRes();
            let nextCalled = false;
            await authSeller(req, res, () => { nextCalled = true; });
            assert.equal(nextCalled, false);
            assert.equal(res.getStatusCode(), 401);
        });

        it('27. Seller can approve and reject reviews', async () => {
            const req = {
                params: { reviewId: testRevId },
                body: { status: 'approved', moderationNote: 'Valid feedback' }
            };
            const res = createMockRes();
            await moderateReview(req, res);

            assert.equal(res.getStatusCode(), 200);
            assert.equal(res.getJson().success, true);
            assert.equal(res.getJson().review.moderationStatus, 'approved');
            assert.equal(res.getJson().review.moderatedBy, 'seller');
            assert.equal(res.getJson().review.moderationNote, 'Valid feedback');
        });

        it('28. Invalid moderation status is rejected with 400', async () => {
            const req = {
                params: { reviewId: testRevId },
                body: { status: 'invalid_status' }
            };
            const res = createMockRes();
            await moderateReview(req, res);
            assert.equal(res.getStatusCode(), 400);
            assert.match(res.getJson().message, /Invalid moderation status/i);
        });

        it('29. Customer cannot access seller moderation endpoints', async () => {
            // Customer token is not seller token
            const custToken = jwt.sign({ id: customerAId }, JWT_SECRET_TEST);
            const req = { cookies: { token: custToken } }; // missing sellerToken
            const res = createMockRes();
            let nextCalled = false;
            await authSeller(req, res, () => { nextCalled = true; });
            assert.equal(nextCalled, false);
            assert.equal(res.getStatusCode(), 401);
        });

        it('30. Pagination and sorting limits are enforced', async () => {
            const req = {
                params: { productId: productAId },
                query: { page: '1', limit: '100', sort: 'highest' }
            };
            const res = createMockRes();
            await getProductReviews(req, res);

            assert.equal(res.getStatusCode(), 200);
            // Limit must be clamped to MAX_REVIEW_PAGE_LIMIT (20)
            assert.equal(res.getJson().pagination.limit, 20);
        });

        it('31. Review deletion during product deletion is handled safely', async () => {
            const initialReviewCount = reviewStore.size;
            assert.ok(initialReviewCount > 0);

            // Execute product deletion
            const req = {
                body: { id: productAId },
                sellerId: process.env.SELLER_EMAIL || SELLER_EMAIL_TEST,
                sellerEmail: process.env.SELLER_EMAIL || SELLER_EMAIL_TEST
            };
            const res = createMockRes();
            await deleteProduct(req, res);

            assert.equal(res.statusCode, 200);
            // Reviews associated with productAId must be cleaned up
            const remainingForProductA = Array.from(reviewStore.values()).filter(r => r.productId === productAId);
            assert.equal(remainingForProductA.length, 0);
        });

        it('32. Review rate limiter correctly blocks threshold breaches', async () => {
            const limiter = createReviewLimiter({ limit: 2, windowMs: 60000 });
            const req = { userId: customerAId, ip: '127.0.0.1', app: { get: () => false }, headers: {}, method: 'POST', url: '/test' };

            const run = async () => {
                const res = {
                    statusCode: 200,
                    headers: {},
                    setHeader(k, v) { this.headers[k] = v; return this; },
                    getHeader(k) { return this.headers[k]; },
                    status(c) { this.statusCode = c; return this; },
                    json(b) { this.body = b; return this; }
                };
                let nextCalled = false;
                await limiter(req, res, () => { nextCalled = true; });
                return { res, nextCalled };
            };

            const r1 = await run();
            assert.equal(r1.nextCalled, true);
            const r2 = await run();
            assert.equal(r2.nextCalled, true);
            const r3 = await run();
            assert.equal(r3.nextCalled, false);
            assert.equal(r3.res.statusCode, 429);
        });
    });

    // =========================================================================
    // 6. Batch 6A.1 Reliability Fixes (Rating Consistency & Deletion Safety)
    // =========================================================================
    describe('6. Batch 6A.1 Reliability Fixes (Rating Consistency & Deletion Safety)', () => {
        let reviewAId;

        beforeEach(async () => {
            const res = createMockRes();
            await submitReview({
                userId: customerAId,
                params: { productId: productAId },
                body: { rating: 4, title: 'Tasty', comment: 'Loved these mangoes' }
            }, res);
            reviewAId = res.getJson().review._id;
        });

        it('33. recalculateProductRating explicitly throws error if product does not exist in database', async () => {
            const nonExistentProductId = new mongoose.Types.ObjectId().toString();
            await assert.rejects(
                async () => {
                    await recalculateProductRating(nonExistentProductId);
                },
                /Product not found during rating recalculation/i
            );
        });

        it('34. Compensating rollback restores review status when recalculation fails during moderation', async () => {
            // Review starts as pending
            const reviewBefore = reviewStore.get(String(reviewAId));
            assert.equal(reviewBefore.moderationStatus, 'pending');

            // Force recalculation to fail by simulating database error during Product.findByIdAndUpdate
            const origUpdate = Product.findByIdAndUpdate;
            Product.findByIdAndUpdate = async () => {
                throw new Error('Database write failure during rating update');
            };

            try {
                const req = {
                    params: { reviewId: reviewAId },
                    body: { status: 'approved' }
                };
                const res = createMockRes();
                await moderateReview(req, res);

                assert.equal(res.getStatusCode(), 500);
                assert.equal(res.getJson().success, false);
                assert.match(res.getJson().message, /Failed to update product rating summary/i);

                // Review must have been rolled back to pending, NOT left approved
                const reviewAfter = reviewStore.get(String(reviewAId));
                assert.equal(reviewAfter.moderationStatus, 'pending');
            } finally {
                Product.findByIdAndUpdate = origUpdate;
            }
        });

        it('35. Compensating rollback restores review when recalculation fails during customer review update', async () => {
            // Approve the review first
            const modReq = {
                params: { reviewId: reviewAId },
                body: { status: 'approved' }
            };
            const modRes = createMockRes();
            await moderateReview(modReq, modRes);
            assert.equal(modRes.getStatusCode(), 200);

            // Now customer edits their approved review, but DB fails during rating recalculation
            const origUpdate = Product.findByIdAndUpdate;
            Product.findByIdAndUpdate = async () => {
                throw new Error('Database write failure during rating update');
            };

            try {
                const req = {
                    userId: customerAId,
                    params: { reviewId: reviewAId },
                    body: { rating: 5, comment: 'Updated to 5 stars now' }
                };
                const res = createMockRes();
                await updateReview(req, res);

                assert.equal(res.getStatusCode(), 500);
                assert.equal(res.getJson().success, false);

                // Review data must have been restored
                const reviewAfter = reviewStore.get(String(reviewAId));
                assert.equal(reviewAfter.rating, 4);
                assert.equal(reviewAfter.moderationStatus, 'approved');
            } finally {
                Product.findByIdAndUpdate = origUpdate;
            }
        });

        it('36. deleteProduct aborts deletion and returns 500 if Review.deleteMany fails (prevents orphaned reviews)', async () => {
            assert.ok(productStore.has(productAId));
            const reviewCountBefore = Array.from(reviewStore.values()).filter(r => r.productId === productAId).length;
            assert.ok(reviewCountBefore > 0);

            // Simulate Review.deleteMany failure
            const origDeleteMany = Review.deleteMany;
            Review.deleteMany = async () => {
                throw new Error('Database connection drop during review cleanup');
            };

            try {
                const req = {
                    body: { id: productAId },
                    sellerId: process.env.SELLER_EMAIL || SELLER_EMAIL_TEST,
                    sellerEmail: process.env.SELLER_EMAIL || SELLER_EMAIL_TEST
                };
                const res = createMockRes();
                await deleteProduct(req, res);

                assert.equal(res.getStatusCode(), 500);
                assert.equal(res.getJson().success, false);
                assert.match(res.getJson().message, /Failed to clean up reviews/i);

                // Product MUST NOT have been deleted
                assert.ok(productStore.has(productAId));
                // Reviews MUST NOT have been orphaned
                const reviewCountAfter = Array.from(reviewStore.values()).filter(r => r.productId === productAId).length;
                assert.equal(reviewCountAfter, reviewCountBefore);
            } finally {
                Review.deleteMany = origDeleteMany;
            }
        });

        it('37. deleteProduct executes atomically inside a transaction and rolls back when review deletion fails', async () => {
            let transactionAborted = false;
            let sessionClosed = false;

            mongoose.startSession = async () => ({
                withTransaction: async (txFn) => {
                    try {
                        await txFn();
                    } catch (txErr) {
                        transactionAborted = true;
                        throw txErr;
                    }
                },
                endSession: async () => {
                    sessionClosed = true;
                }
            });

            // Simulate review deletion error inside transaction
            const origDeleteMany = Review.deleteMany;
            Review.deleteMany = async () => {
                throw new Error('Transaction write conflict during review deleteMany');
            };

            try {
                const req = {
                    body: { id: productAId },
                    sellerId: process.env.SELLER_EMAIL || SELLER_EMAIL_TEST,
                    sellerEmail: process.env.SELLER_EMAIL || SELLER_EMAIL_TEST
                };
                const res = createMockRes();
                await deleteProduct(req, res);

                assert.equal(res.getStatusCode(), 500);
                assert.equal(res.getJson().success, false);
                assert.equal(transactionAborted, true);
                assert.equal(sessionClosed, true);
                // Product remains intact
                assert.ok(productStore.has(productAId));
            } finally {
                Review.deleteMany = origDeleteMany;
            }
        });

        it('38. moderateReview executes atomically with session when MongoDB transactions are active', async () => {
            let sessionUsedInAggregation = false;
            let sessionUsedInProductUpdate = false;
            let transactionCommitted = false;

            mongoose.startSession = async () => ({
                withTransaction: async (txFn) => {
                    await txFn();
                    transactionCommitted = true;
                },
                endSession: async () => {}
            });

            const origAggregate = Review.aggregate;
            Review.aggregate = (pipeline) => {
                const queryPromise = origAggregate(pipeline);
                return {
                    session: (sess) => {
                        sessionUsedInAggregation = true;
                        return queryPromise;
                    },
                    then: (resolve, reject) => queryPromise.then(resolve, reject)
                };
            };

            const origProductUpdate = Product.findByIdAndUpdate;
            Product.findByIdAndUpdate = async (id, update, options) => {
                if (options?.session) {
                    sessionUsedInProductUpdate = true;
                }
                return origProductUpdate(id, update, options);
            };

            try {
                const req = {
                    params: { reviewId: reviewAId },
                    body: { status: 'approved' }
                };
                const res = createMockRes();
                await moderateReview(req, res);

                assert.equal(res.getStatusCode(), 200);
                assert.equal(transactionCommitted, true);
                assert.equal(sessionUsedInProductUpdate, true);

                const prod = productStore.get(productAId);
                assert.equal(prod.averageRating, 4);
                assert.equal(prod.reviewCount, 1);
            } finally {
                Review.aggregate = origAggregate;
                Product.findByIdAndUpdate = origProductUpdate;
            }
        });
    });
});
