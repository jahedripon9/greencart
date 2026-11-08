import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Product, { getStockStatus } from '../models/Product.js';
import Order from '../models/Order.js';
import {
    checkMigrationStatus,
    runProductStockMigration,
    runOrderStockMigration,
    runFullMigration
} from '../scripts/migratePhase7Stock.js';

describe('GreenCart Phase 7.1 — Schema Extension & Stock Status Suite', () => {

    describe('Product Schema Validation', () => {
        it('1. stockQuantity defaults to null when not provided', () => {
            const product = new Product({
                name: 'Organic Bananas',
                description: ['Fresh organic bananas'],
                price: 50,
                offerPrice: 40,
                category: 'Fresh Fruits',
                image: ['https://example.com/banana.jpg']
            });

            assert.equal(product.stockQuantity, null);
            const validationError = product.validateSync();
            assert.equal(validationError, undefined, 'Validation should pass with default null stockQuantity');
        });

        it('2. stockQuantity accepts explicit null for unrecorded stock', () => {
            const product = new Product({
                name: 'Organic Apples',
                description: ['Fresh apples'],
                price: 60,
                offerPrice: 50,
                category: 'Fresh Fruits',
                image: ['https://example.com/apple.jpg'],
                stockQuantity: null
            });

            assert.equal(product.stockQuantity, null);
            const validationError = product.validateSync();
            assert.equal(validationError, undefined);
        });

        it('3. stockQuantity accepts non-negative integers (0, 1, 5, 50)', () => {
            for (const qty of [0, 1, 5, 50, 1000]) {
                const product = new Product({
                    name: 'Test Product',
                    description: ['Description'],
                    price: 10,
                    offerPrice: 8,
                    category: 'Test',
                    image: ['https://example.com/img.jpg'],
                    stockQuantity: qty
                });

                assert.equal(product.stockQuantity, qty);
                const validationError = product.validateSync();
                assert.equal(validationError, undefined, `Valid qty ${qty} should pass`);
            }
        });

        it('4. stockQuantity rejects negative integers (-1, -10)', () => {
            for (const qty of [-1, -10]) {
                const product = new Product({
                    name: 'Test Product',
                    description: ['Description'],
                    price: 10,
                    offerPrice: 8,
                    category: 'Test',
                    image: ['https://example.com/img.jpg'],
                    stockQuantity: qty
                });

                const validationError = product.validateSync();
                assert.ok(validationError, `Negative qty ${qty} must produce validation error`);
                assert.ok(validationError.errors.stockQuantity, 'Error must be on stockQuantity');
            }
        });

        it('5. stockQuantity rejects floating-point numbers (0.5, 3.14, 5.5)', () => {
            for (const qty of [0.5, 3.14, 5.5, -2.5]) {
                const product = new Product({
                    name: 'Test Product',
                    description: ['Description'],
                    price: 10,
                    offerPrice: 8,
                    category: 'Test',
                    image: ['https://example.com/img.jpg'],
                    stockQuantity: qty
                });

                const validationError = product.validateSync();
                assert.ok(validationError, `Float qty ${qty} must produce validation error`);
                assert.ok(validationError.errors.stockQuantity, 'Error must be on stockQuantity');
            }
        });

        it('6. lowStockThreshold defaults to 5 with min: 1', () => {
            const product = new Product({
                name: 'Default Threshold Product',
                description: ['Desc'],
                price: 20,
                offerPrice: 15,
                category: 'Pantry',
                image: ['https://example.com/img.jpg']
            });

            assert.equal(product.lowStockThreshold, 5);
            assert.equal(product.validateSync(), undefined);
        });

        it('7. lowStockThreshold accepts valid positive integers (1, 3, 10)', () => {
            for (const threshold of [1, 3, 10, 25]) {
                const product = new Product({
                    name: 'Threshold Product',
                    description: ['Desc'],
                    price: 20,
                    offerPrice: 15,
                    category: 'Pantry',
                    image: ['https://example.com/img.jpg'],
                    lowStockThreshold: threshold
                });

                assert.equal(product.lowStockThreshold, threshold);
                assert.equal(product.validateSync(), undefined);
            }
        });

        it('8. lowStockThreshold rejects values less than 1 (0, -1, -5)', () => {
            for (const threshold of [0, -1, -5]) {
                const product = new Product({
                    name: 'Threshold Product',
                    description: ['Desc'],
                    price: 20,
                    offerPrice: 15,
                    category: 'Pantry',
                    image: ['https://example.com/img.jpg'],
                    lowStockThreshold: threshold
                });

                const validationError = product.validateSync();
                assert.ok(validationError, `Threshold ${threshold} must be rejected`);
                assert.ok(validationError.errors.lowStockThreshold);
            }
        });

        it('9. lowStockThreshold rejects non-integer floats (2.5, 3.7)', () => {
            for (const threshold of [2.5, 3.7]) {
                const product = new Product({
                    name: 'Threshold Product',
                    description: ['Desc'],
                    price: 20,
                    offerPrice: 15,
                    category: 'Pantry',
                    image: ['https://example.com/img.jpg'],
                    lowStockThreshold: threshold
                });

                const validationError = product.validateSync();
                assert.ok(validationError, `Float threshold ${threshold} must be rejected`);
                assert.ok(validationError.errors.lowStockThreshold);
            }
        });

        it('10. availableColors defaults to empty array []', () => {
            const product = new Product({
                name: 'Color Product',
                description: ['Desc'],
                price: 20,
                offerPrice: 15,
                category: 'Pantry',
                image: ['https://example.com/img.jpg']
            });

            assert.deepEqual(product.availableColors, []);
            assert.equal(product.validateSync(), undefined);
        });

        it('11. availableColors trims strings and stores color options', () => {
            const product = new Product({
                name: 'Color Product',
                description: ['Desc'],
                price: 20,
                offerPrice: 15,
                category: 'Pantry',
                image: ['https://example.com/img.jpg'],
                availableColors: [' Red ', 'Green', ' Blue ']
            });

            assert.deepEqual(product.availableColors, ['Red', 'Green', 'Blue']);
            assert.equal(product.validateSync(), undefined);
        });

        it('12. preserves existing inStock boolean (defaults true, allows false)', () => {
            const productInStock = new Product({
                name: 'In Stock Product',
                description: ['Desc'],
                price: 10,
                offerPrice: 9,
                category: 'Dairy',
                image: ['https://example.com/img.jpg']
            });
            assert.equal(productInStock.inStock, true);

            const productOutOfStock = new Product({
                name: 'Out of Stock Product',
                description: ['Desc'],
                price: 10,
                offerPrice: 9,
                category: 'Dairy',
                image: ['https://example.com/img.jpg'],
                inStock: false
            });
            assert.equal(productOutOfStock.inStock, false);
            assert.equal(productOutOfStock.validateSync(), undefined);
        });
    });

    describe('Stock Status Business Rules & Helpers', () => {
        it('13. null or undefined stockQuantity returns "Stock Not Recorded"', () => {
            assert.equal(getStockStatus(null), 'Stock Not Recorded');
            assert.equal(getStockStatus(undefined), 'Stock Not Recorded');

            const docNull = new Product({
                name: 'Unknown Stock Product',
                description: ['Desc'],
                price: 10,
                offerPrice: 8,
                category: 'Snacks',
                image: ['https://example.com/img.jpg'],
                stockQuantity: null
            });
            assert.equal(docNull.stockStatus, 'Stock Not Recorded');
            assert.equal(docNull.computeStockStatus(), 'Stock Not Recorded');
        });

        it('14. stockQuantity: 0 strictly returns "Out of Stock"', () => {
            assert.equal(getStockStatus(0), 'Out of Stock');

            const docZero = new Product({
                name: 'Zero Stock Product',
                description: ['Desc'],
                price: 10,
                offerPrice: 8,
                category: 'Snacks',
                image: ['https://example.com/img.jpg'],
                stockQuantity: 0
            });
            assert.equal(docZero.stockStatus, 'Out of Stock');
        });

        it('15. stockQuantity between 1 and threshold (default 5) returns "Low Stock"', () => {
            for (let q = 1; q <= 5; q++) {
                assert.equal(getStockStatus(q, 5), 'Low Stock', `Quantity ${q} should be Low Stock`);

                const doc = new Product({
                    name: 'Low Stock Product',
                    description: ['Desc'],
                    price: 10,
                    offerPrice: 8,
                    category: 'Snacks',
                    image: ['https://example.com/img.jpg'],
                    stockQuantity: q,
                    lowStockThreshold: 5
                });
                assert.equal(doc.stockStatus, 'Low Stock');
            }
        });

        it('16. stockQuantity greater than threshold returns "In Stock"', () => {
            for (const q of [6, 7, 20, 100]) {
                assert.equal(getStockStatus(q, 5), 'In Stock', `Quantity ${q} should be In Stock`);

                const doc = new Product({
                    name: 'In Stock Product',
                    description: ['Desc'],
                    price: 10,
                    offerPrice: 8,
                    category: 'Snacks',
                    image: ['https://example.com/img.jpg'],
                    stockQuantity: q,
                    lowStockThreshold: 5
                });
                assert.equal(doc.stockStatus, 'In Stock');
            }
        });

        it('17. custom lowStockThreshold dynamically recalculates boundaries', () => {
            // Custom threshold = 2
            assert.equal(getStockStatus(1, 2), 'Low Stock');
            assert.equal(getStockStatus(2, 2), 'Low Stock');
            assert.equal(getStockStatus(3, 2), 'In Stock');

            // Custom threshold = 10
            assert.equal(getStockStatus(5, 10), 'Low Stock');
            assert.equal(getStockStatus(10, 10), 'Low Stock');
            assert.equal(getStockStatus(11, 10), 'In Stock');
        });

        it('18. Never classifies unknown stock as zero (protection against false out-of-stock)', () => {
            const unknownStatus = getStockStatus(null);
            const zeroStatus = getStockStatus(0);

            assert.notEqual(unknownStatus, zeroStatus, 'null stock must never equal zero stock');
            assert.equal(unknownStatus, 'Stock Not Recorded');
            assert.equal(zeroStatus, 'Out of Stock');
        });
    });

    describe('Order Schema Extension', () => {
        it('19. stockDeducted defaults to false in Order schema', () => {
            const order = new Order({
                userId: 'user_123',
                items: [{
                    product: 'prod_123',
                    quantity: 2,
                    name: 'Test Item',
                    unitPrice: 25
                }],
                amount: 50,
                address: 'addr_123',
                paymentType: 'COD'
            });

            assert.equal(order.stockDeducted, false);
            assert.equal(order.validateSync(), undefined);
        });

        it('20. stockDeducted accepts boolean true and false', () => {
            const orderTrue = new Order({
                userId: 'user_123',
                items: [{
                    product: 'prod_123',
                    quantity: 2,
                    name: 'Test Item',
                    unitPrice: 25
                }],
                amount: 50,
                address: 'addr_123',
                paymentType: 'Online',
                stockDeducted: true
            });
            assert.equal(orderTrue.stockDeducted, true);
            assert.equal(orderTrue.validateSync(), undefined);

            const orderFalse = new Order({
                userId: 'user_123',
                items: [{
                    product: 'prod_123',
                    quantity: 2,
                    name: 'Test Item',
                    unitPrice: 25
                }],
                amount: 50,
                address: 'addr_123',
                paymentType: 'Online',
                stockDeducted: false
            });
            assert.equal(orderFalse.stockDeducted, false);
            assert.equal(orderFalse.validateSync(), undefined);
        });
    });

    describe('Migration Script Safety & Idempotency Harness', () => {
        const createMockModel = (initialDocs) => {
            const docs = JSON.parse(JSON.stringify(initialDocs));

            const matchesQuery = (doc, query) => {
                if (query.$or) {
                    return query.$or.some(subQuery => matchesQuery(doc, subQuery));
                }
                for (const [key, condition] of Object.entries(query)) {
                    if (condition && typeof condition === 'object' && '$exists' in condition) {
                        const exists = doc[key] !== undefined;
                        if (exists !== condition.$exists) return false;
                    } else if (condition === null) {
                        if (doc[key] !== null) return false;
                    } else {
                        if (doc[key] !== condition) return false;
                    }
                }
                return true;
            };

            return {
                _docs: docs,
                async countDocuments(query = {}) {
                    return docs.filter(doc => matchesQuery(doc, query)).length;
                },
                async updateMany(query, update) {
                    const matched = docs.filter(doc => matchesQuery(doc, query));
                    let modifiedCount = 0;
                    for (const doc of matched) {
                        if (update.$set) {
                            for (const [k, v] of Object.entries(update.$set)) {
                                if (doc[k] !== v) {
                                    doc[k] = v;
                                    modifiedCount++;
                                }
                            }
                        }
                    }
                    return {
                        matchedCount: matched.length,
                        modifiedCount
                    };
                }
            };
        };

        it('21. checkMigrationStatus accurately identifies unmigrated products and orders', async () => {
            const mockProducts = createMockModel([
                { _id: '1', name: 'Legacy Product 1', inStock: true }, // lacks stockQuantity, threshold, availableColors
                { _id: '2', name: 'Legacy Product 2', inStock: false }, // lacks stockQuantity, threshold, availableColors
                { _id: '3', name: 'Partially Migrated', inStock: true, stockQuantity: 10, lowStockThreshold: 5, availableColors: ['Red'] }
            ]);

            const mockOrders = createMockModel([
                { _id: 'o1', amount: 100, cartDeducted: true }, // lacks stockDeducted
                { _id: 'o2', amount: 50, cartDeducted: false, stockDeducted: false },
                { _id: 'o3', amount: 80, cartDeducted: true, stockDeducted: true }
            ]);

            const status = await checkMigrationStatus({
                ProductModel: mockProducts,
                OrderModel: mockOrders,
                logger: { log: () => {} }
            });

            assert.equal(status.productsWithoutStockQuantity, 2);
            assert.equal(status.productsWithoutThreshold, 2);
            assert.equal(status.productsWithoutColors, 2);
            assert.equal(status.ordersWithoutStockDeducted, 1);
            assert.equal(status.isMigrationNeeded, true);
        });

        it('22. dryRun performs preview only and modifies zero documents', async () => {
            const mockProducts = createMockModel([
                { _id: '1', name: 'Legacy Product', inStock: true }
            ]);
            const mockOrders = createMockModel([
                { _id: 'o1', amount: 100 }
            ]);

            const dryRunResult = await runFullMigration({
                ProductModel: mockProducts,
                OrderModel: mockOrders,
                dryRun: true,
                logger: { log: () => {} }
            });

            assert.equal(dryRunResult.dryRun, true);
            assert.equal(dryRunResult.productResults.productsUpdatedStockQty, 0);
            assert.equal(dryRunResult.orderResults.ordersUpdatedStockDeducted, 0);

            // Verify docs remained completely untouched
            assert.equal(mockProducts._docs[0].stockQuantity, undefined);
            assert.equal(mockProducts._docs[0].lowStockThreshold, undefined);
            assert.equal(mockProducts._docs[0].availableColors, undefined);
            assert.equal(mockOrders._docs[0].stockDeducted, undefined);
        });

        it('23. runFullMigration with dryRun:false safely initializes missing fields and preserves existing data', async () => {
            const mockProducts = createMockModel([
                { _id: '1', name: 'Old Product 1', inStock: true }, // lacks all 3
                { _id: '2', name: 'Old Product 2', inStock: false }, // lacks all 3, inStock is false!
                { _id: '3', name: 'Already Configured', inStock: true, stockQuantity: 25, lowStockThreshold: 10, availableColors: ['Green', 'Blue'] }
            ]);

            const mockOrders = createMockModel([
                { _id: 'o1', amount: 100 }, // legacy order
                { _id: 'o2', amount: 50, stockDeducted: true } // existing order with true
            ]);

            const executeResult = await runFullMigration({
                ProductModel: mockProducts,
                OrderModel: mockOrders,
                dryRun: false,
                logger: { log: () => {} }
            });

            assert.equal(executeResult.dryRun, false);
            assert.equal(executeResult.productResults.productsUpdatedStockQty, 2);
            assert.equal(executeResult.productResults.productsUpdatedThreshold, 2);
            assert.equal(executeResult.productResults.productsUpdatedColors, 2);
            assert.equal(executeResult.orderResults.ordersUpdatedStockDeducted, 1);

            // Document 1 check
            assert.equal(mockProducts._docs[0].stockQuantity, null, 'Old product stockQuantity must be null, never invented');
            assert.equal(mockProducts._docs[0].lowStockThreshold, 5);
            assert.deepEqual(mockProducts._docs[0].availableColors, []);
            assert.equal(mockProducts._docs[0].inStock, true, 'inStock true preserved');

            // Document 2 check
            assert.equal(mockProducts._docs[1].stockQuantity, null);
            assert.equal(mockProducts._docs[1].inStock, false, 'inStock false strictly preserved');

            // Document 3 check: already configured product must be completely unchanged
            assert.equal(mockProducts._docs[2].stockQuantity, 25, 'Existing stockQuantity must remain untouched');
            assert.equal(mockProducts._docs[2].lowStockThreshold, 10, 'Existing threshold must remain untouched');
            assert.deepEqual(mockProducts._docs[2].availableColors, ['Green', 'Blue'], 'Existing colors untouched');

            // Orders check
            assert.equal(mockOrders._docs[0].stockDeducted, false, 'Legacy order stockDeducted initialized to false');
            assert.equal(mockOrders._docs[1].stockDeducted, true, 'Order with stockDeducted: true preserved');

            // Verify final status has 0 pending items
            assert.equal(executeResult.finalStatus.isMigrationNeeded, false);
            assert.equal(executeResult.finalStatus.productsWithoutStockQuantity, 0);
            assert.equal(executeResult.finalStatus.ordersWithoutStockDeducted, 0);
        });

        it('24. Migration is strictly idempotent: executing multiple times causes zero modifications', async () => {
            const mockProducts = createMockModel([
                { _id: '1', name: 'Legacy Product', inStock: true }
            ]);
            const mockOrders = createMockModel([
                { _id: 'o1', amount: 100 }
            ]);

            // First run
            const firstRun = await runFullMigration({
                ProductModel: mockProducts,
                OrderModel: mockOrders,
                dryRun: false,
                logger: { log: () => {} }
            });
            assert.equal(firstRun.productResults.productsUpdatedStockQty, 1);
            assert.equal(firstRun.orderResults.ordersUpdatedStockDeducted, 1);

            // Second run
            const secondRun = await runFullMigration({
                ProductModel: mockProducts,
                OrderModel: mockOrders,
                dryRun: false,
                logger: { log: () => {} }
            });
            assert.equal(secondRun.productResults.productsUpdatedStockQty, 0);
            assert.equal(secondRun.productResults.productsUpdatedThreshold, 0);
            assert.equal(secondRun.productResults.productsUpdatedColors, 0);
            assert.equal(secondRun.orderResults.ordersUpdatedStockDeducted, 0);
            assert.equal(secondRun.finalStatus.isMigrationNeeded, false);
        });
    });
});
