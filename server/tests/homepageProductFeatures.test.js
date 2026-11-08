import test, { describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getBestSellers, getTrendingProducts } from '../controllers/productController.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

describe('GreenCart Homepage Product Discovery & Aggregation Suite', () => {
    let originalProductFind;
    let originalOrderAggregate;

    beforeEach(() => {
        originalProductFind = Product.find;
        originalOrderAggregate = Order.aggregate;
    });

    afterEach(() => {
        Product.find = originalProductFind;
        Order.aggregate = originalOrderAggregate;
    });

    describe('1. Best Sellers Aggregation Endpoint (GET /api/product/bestsellers)', () => {
        test('aggregates non-cancelled order items by unitsSold and returns ranked products', async () => {
            const mockSales = [
                { _id: '68ca3fe2ed59a83084b7efb5', unitsSold: 42 },
                { _id: '68ca3f8ced59a83084b7efb3', unitsSold: 30 }
            ];

            let aggregatePipelineCalled = null;
            Order.aggregate = async (pipeline) => {
                aggregatePipelineCalled = pipeline;
                return mockSales;
            };

            const mockDbProducts = [
                {
                    _id: '68ca3f8ced59a83084b7efb3',
                    name: 'আলু ৫০০ গ্রাম',
                    price: 25,
                    offerPrice: 20,
                    inStock: true
                },
                {
                    _id: '68ca3fe2ed59a83084b7efb5',
                    name: 'Tomato 1 kg',
                    price: 50,
                    offerPrice: 40,
                    inStock: true
                }
            ];

            Product.find = () => ({
                sort: () => ({
                    limit: async () => []
                }),
                then: (resolve) => resolve(mockDbProducts)
            });

            // If Product.find is called directly with query:
            Product.find = (query) => {
                if (query?._id?.$in) {
                    return Promise.resolve(mockDbProducts);
                }
                return {
                    sort: () => ({
                        limit: () => Promise.resolve([])
                    })
                };
            };

            let jsonResponse = null;
            let statusCode = 200;
            const req = { query: { limit: '4' } };
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (data) => { jsonResponse = data; return res; }
            };

            await getBestSellers(req, res);

            assert.equal(statusCode, 200);
            assert.equal(jsonResponse.success, true);
            assert.ok(Array.isArray(jsonResponse.products));
            assert.equal(jsonResponse.products.length, 2);

            // Verified ranking: highest unitsSold first
            assert.equal(String(jsonResponse.products[0]._id), '68ca3fe2ed59a83084b7efb5');
            assert.equal(String(jsonResponse.products[1]._id), '68ca3f8ced59a83084b7efb3');

            // Verify pipeline excludes Cancelled orders
            assert.ok(aggregatePipelineCalled);
            const matchStage = aggregatePipelineCalled.find(s => s.$match);
            assert.deepEqual(matchStage.$match, { status: { $ne: "Cancelled" } });
        });

        test('safely falls back to top-rated in-stock products when no order sales exist without inventing data', async () => {
            Order.aggregate = async () => [];

            const mockFallbackProducts = [
                { _id: '6ae2e8dfb533a976e74f9651', name: 'Lemon', inStock: true, averageRating: 5, reviewCount: 4 }
            ];

            Product.find = (query) => {
                return {
                    sort: (sortCriteria) => {
                        assert.equal(sortCriteria.reviewCount, -1);
                        assert.equal(sortCriteria.averageRating, -1);
                        return {
                            limit: (lim) => {
                                assert.equal(lim, 5);
                                return Promise.resolve(mockFallbackProducts);
                            }
                        };
                    }
                };
            };

            let jsonResponse = null;
            const req = { query: { limit: '5' } };
            const res = {
                json: (data) => { jsonResponse = data; return res; }
            };

            await getBestSellers(req, res);

            assert.equal(jsonResponse.success, true);
            assert.equal(jsonResponse.products.length, 1);
            assert.equal(jsonResponse.products[0].name, 'Lemon');
        });

        test('handles aggregation failure safely without crashing the endpoint', async () => {
            Order.aggregate = async () => {
                throw new Error("Aggregation pipeline failure");
            };

            Product.find = () => ({
                sort: () => ({
                    limit: () => Promise.resolve([{ _id: 'fallback1', inStock: true }])
                })
            });

            let jsonResponse = null;
            const req = { query: {} };
            const res = {
                json: (data) => { jsonResponse = data; return res; }
            };

            await getBestSellers(req, res);

            assert.equal(jsonResponse.success, true);
            assert.ok(Array.isArray(jsonResponse.products));
        });
    });

    describe('2. Trending Products Endpoint (GET /api/product/trending)', () => {
        test('retrieves products sorted by verified rating, review count, and active availability', async () => {
            const mockTrending = [
                { _id: 'p1', name: 'Premium Eggs', averageRating: 5, reviewCount: 12, inStock: true },
                { _id: 'p2', name: 'Organic Lemon', averageRating: 4.8, reviewCount: 8, inStock: true }
            ];

            let queryFilter = null;
            let sortCriteria = null;
            let limitArg = null;

            Product.find = (filter) => {
                queryFilter = filter;
                return {
                    sort: (sort) => {
                        sortCriteria = sort;
                        return {
                            limit: async (lim) => {
                                limitArg = lim;
                                return mockTrending;
                            }
                        };
                    }
                };
            };

            let jsonResponse = null;
            let statusCode = 200;
            const req = { query: { limit: '6' } };
            const res = {
                status: (code) => { statusCode = code; return res; },
                json: (data) => { jsonResponse = data; return res; }
            };

            await getTrendingProducts(req, res);

            assert.equal(statusCode, 200);
            assert.equal(jsonResponse.success, true);
            assert.deepEqual(queryFilter, { inStock: true });
            assert.equal(sortCriteria.averageRating, -1);
            assert.equal(sortCriteria.reviewCount, -1);
            assert.equal(limitArg, 6);
            assert.equal(jsonResponse.products.length, 2);
        });

        test('bounds limit parameter safely between 1 and 24', async () => {
            let capturedLimit = null;

            Product.find = () => ({
                sort: () => ({
                    limit: async (lim) => {
                        capturedLimit = lim;
                        return [];
                    }
                })
            });

            const res = { json: () => res };

            // When requested limit is 9999, should be capped at 24
            await getTrendingProducts({ query: { limit: '9999' } }, res);
            assert.equal(capturedLimit, 24);

            // When requested limit is -5, should be clamped to 1
            await getTrendingProducts({ query: { limit: '-5' } }, res);
            assert.equal(capturedLimit, 1);
        });
    });
});
