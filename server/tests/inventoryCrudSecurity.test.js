import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { v2 as cloudinary } from 'cloudinary';

import Product, { getStockStatus } from '../models/Product.js';
import Review from '../models/Review.js';
import authSeller from '../middlewares/authSeller.js';
import {
    escapeRegex,
    buildProductQuery,
    parsePaginationAndSort,
    addProduct,
    productList,
    sellerProductList,
    sellerProductById,
    productById,
    changeStock,
    updateProduct,
    deleteProduct
} from '../controllers/productController.js';

describe('GreenCart Phase 7.3 — Inventory CRUD, Search, Filters & Pagination Suite', () => {
    const TEST_JWT_SECRET = 'test_seller_jwt_secret_phase73_12345';
    const ADMIN_SELLER_EMAIL = 'admin_seller@greencart.com';
    const SELLER_1_ID = 'seller_alpha_001';
    const SELLER_2_ID = 'seller_beta_002';

    let originalSellerEmail;
    let originalJwtSecret;

    // In-memory data stores
    let productStore;
    let reviewStore;
    let deletedCloudinaryAssets;
    let uploadedCloudinaryAssets;

    // Original Mongoose / Cloudinary methods to restore
    let origProductFind;
    let origProductFindById;
    let origProductFindOneAndUpdate;
    let origProductFindOneAndDelete;
    let origProductFindByIdAndUpdate;
    let origProductFindByIdAndDelete;
    let origProductCreate;
    let origProductCountDocuments;
    let origReviewDeleteMany;
    let origCloudinaryUpload;
    let origCloudinaryDestroy;

    function createMockRes() {
        const res = {
            statusCode: 200,
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(data) {
                this.body = data;
                return this;
            }
        };
        return res;
    }

    function createValidToken(payload) {
        return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });
    }

    // Helper evaluating MongoDB queries in-memory
    function matchesDoc(doc, query) {
        if (!query || Object.keys(query).length === 0) return true;

        for (const [key, val] of Object.entries(query)) {
            if (key === '$and') {
                if (!val.every(subQuery => matchesDoc(doc, subQuery))) return false;
            } else if (key === '$or') {
                if (!val.some(subQuery => matchesDoc(doc, subQuery))) return false;
            } else if (key === '$expr') {
                if (!evalExpr(doc, val)) return false;
            } else {
                const docVal = doc[key];
                if (val instanceof RegExp) {
                    if (typeof docVal !== 'string' || !val.test(docVal)) return false;
                } else if (val && typeof val === 'object') {
                    if (val.$ne !== undefined) {
                        if (docVal === val.$ne) return false;
                    }
                    if (val.$gt !== undefined) {
                        if (!(typeof docVal === 'number' && docVal > val.$gt)) return false;
                    }
                    if (val.$lte !== undefined) {
                        if (!(typeof docVal === 'number' && docVal <= val.$lte)) return false;
                    }
                    if (val.$exists !== undefined) {
                        const exists = docVal !== undefined;
                        if (exists !== val.$exists) return false;
                    }
                } else {
                    if (docVal !== val) return false;
                }
            }
        }
        return true;
    }

    function evalExpr(doc, expr) {
        if (expr.$lte) {
            const [a, b] = expr.$lte;
            const valA = resolveExprVal(doc, a);
            const valB = resolveExprVal(doc, b);
            return typeof valA === 'number' && typeof valB === 'number' && valA <= valB;
        }
        if (expr.$gt) {
            const [a, b] = expr.$gt;
            const valA = resolveExprVal(doc, a);
            const valB = resolveExprVal(doc, b);
            return typeof valA === 'number' && typeof valB === 'number' && valA > valB;
        }
        return true;
    }

    function resolveExprVal(doc, operand) {
        if (typeof operand === 'string' && operand.startsWith('$')) {
            const field = operand.slice(1);
            return doc[field];
        }
        if (operand && typeof operand === 'object' && operand.$ifNull) {
            const [fieldRef, fallback] = operand.$ifNull;
            const field = fieldRef.startsWith('$') ? fieldRef.slice(1) : fieldRef;
            return doc[field] !== undefined && doc[field] !== null ? doc[field] : fallback;
        }
        return operand;
    }

    function sortDocs(docs, sortObj) {
        if (!sortObj) return [...docs];
        const entries = Object.entries(sortObj);
        return [...docs].sort((a, b) => {
            for (const [field, dir] of entries) {
                const valA = a[field];
                const valB = b[field];
                if (valA === valB) continue;
                if (valA === undefined || valA === null) return 1;
                if (valB === undefined || valB === null) return -1;
                if (valA > valB) return dir === 1 ? 1 : -1;
                if (valA < valB) return dir === 1 ? -1 : 1;
            }
            return 0;
        });
    }

    beforeEach(() => {
        originalSellerEmail = process.env.SELLER_EMAIL;
        originalJwtSecret = process.env.JWT_SECRET;
        process.env.SELLER_EMAIL = ADMIN_SELLER_EMAIL;
        process.env.JWT_SECRET = TEST_JWT_SECRET;

        productStore = new Map();
        reviewStore = new Map();
        deletedCloudinaryAssets = [];
        uploadedCloudinaryAssets = [];

        origProductFind = Product.find;
        origProductFindById = Product.findById;
        origProductFindOneAndUpdate = Product.findOneAndUpdate;
        origProductFindOneAndDelete = Product.findOneAndDelete;
        origProductFindByIdAndUpdate = Product.findByIdAndUpdate;
        origProductFindByIdAndDelete = Product.findByIdAndDelete;
        origProductCreate = Product.create;
        origProductCountDocuments = Product.countDocuments;
        origReviewDeleteMany = Review.deleteMany;
        origCloudinaryUpload = cloudinary.uploader.upload;
        origCloudinaryDestroy = cloudinary.uploader.destroy;

        Product.find = (filter = {}) => {
            let currentFilter = filter;
            let currentSort = null;
            let currentSkip = 0;
            let currentLimit = Infinity;

            const queryObj = {
                sort(s) { currentSort = s; return queryObj; },
                skip(sk) { currentSkip = sk; return queryObj; },
                limit(l) { currentLimit = l; return queryObj; },
                then(resolve, reject) {
                    try {
                        let matched = Array.from(productStore.values()).filter(d => matchesDoc(d, currentFilter));
                        if (currentSort) {
                            matched = sortDocs(matched, currentSort);
                        }
                        const result = matched.slice(currentSkip, currentSkip + currentLimit).map(d => ({ ...d }));
                        resolve(result);
                    } catch (err) {
                        reject(err);
                    }
                }
            };
            return queryObj;
        };

        Product.countDocuments = async (filter = {}) => {
            return Array.from(productStore.values()).filter(d => matchesDoc(d, filter)).length;
        };

        Product.findById = async (id) => {
            const doc = productStore.get(String(id));
            return doc ? { ...doc } : null;
        };

        Product.findOneAndUpdate = async (query, update, options = {}) => {
            let doc = null;
            for (const [id, item] of productStore.entries()) {
                if (matchesDoc(item, query)) {
                    doc = item;
                    break;
                }
            }
            if (!doc) return null;
            const updated = { ...doc };
            if (update.$set) {
                Object.assign(updated, update.$set);
            } else {
                Object.assign(updated, update);
            }
            productStore.set(String(doc._id), updated);
            return { ...updated };
        };

        Product.findByIdAndUpdate = async (id, update, options = {}) => {
            return Product.findOneAndUpdate({ _id: String(id) }, update, options);
        };

        Product.findOneAndDelete = async (query) => {
            let foundKey = null;
            let doc = null;
            for (const [id, item] of productStore.entries()) {
                if (matchesDoc(item, query)) {
                    foundKey = id;
                    doc = item;
                    break;
                }
            }
            if (!foundKey) return null;
            productStore.delete(foundKey);
            return { ...doc };
        };

        Product.findByIdAndDelete = async (id) => {
            return Product.findOneAndDelete({ _id: String(id) });
        };

        Product.create = async (docData) => {
            const id = new mongoose.Types.ObjectId().toString();
            const fullDoc = {
                _id: id,
                name: docData.name,
                description: docData.description,
                category: docData.category,
                price: docData.price,
                offerPrice: docData.offerPrice,
                image: docData.image,
                inStock: docData.inStock !== undefined ? docData.inStock : true,
                stockQuantity: docData.stockQuantity !== undefined ? docData.stockQuantity : null,
                lowStockThreshold: docData.lowStockThreshold !== undefined ? docData.lowStockThreshold : 5,
                availableColors: docData.availableColors || [],
                sellerId: docData.sellerId || null,
                createdAt: new Date().toISOString()
            };
            productStore.set(id, fullDoc);
            return { ...fullDoc };
        };

        Review.deleteMany = async (query) => {
            let deletedCount = 0;
            for (const [revId, rev] of reviewStore.entries()) {
                if (rev.productId === query.productId) {
                    reviewStore.delete(revId);
                    deletedCount++;
                }
            }
            return { deletedCount };
        };

        cloudinary.uploader.upload = async (filePath, options) => {
            const public_id = `product_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const secure_url = `https://res.cloudinary.com/test-cloud/image/upload/v123456789/${public_id}.jpg`;
            uploadedCloudinaryAssets.push({ public_id, secure_url });
            return { public_id, secure_url };
        };

        cloudinary.uploader.destroy = async (public_id) => {
            deletedCloudinaryAssets.push(public_id);
            return { result: 'ok' };
        };
    });

    afterEach(() => {
        process.env.SELLER_EMAIL = originalSellerEmail;
        process.env.JWT_SECRET = originalJwtSecret;

        Product.find = origProductFind;
        Product.findById = origProductFindById;
        Product.findOneAndUpdate = origProductFindOneAndUpdate;
        Product.findOneAndDelete = origProductFindOneAndDelete;
        Product.findByIdAndUpdate = origProductFindByIdAndUpdate;
        Product.findByIdAndDelete = origProductFindByIdAndDelete;
        Product.create = origProductCreate;
        Product.countDocuments = origProductCountDocuments;
        Review.deleteMany = origReviewDeleteMany;
        cloudinary.uploader.upload = origCloudinaryUpload;
        cloudinary.uploader.destroy = origCloudinaryDestroy;
    });

    // 1. authSeller rejects unauthenticated requests (401)
    describe('1. authSeller Middleware Authentication & Verification', () => {
        it('rejects requests with missing sellerToken cookie with 401', async () => {
            const req = { cookies: {} };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 401);
            assert.equal(res.body.success, false);
            assert.equal(res.body.message, "Not Authorized");
        });

        it('rejects requests with invalid or tampered sellerToken with 401', async () => {
            const req = { cookies: { sellerToken: 'invalid.tampered.token' } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 401);
            assert.equal(res.body.success, false);
        });

        it('rejects token signed with wrong secret with 401', async () => {
            const fakeToken = jwt.sign({ id: 'seller_123' }, 'wrong_secret');
            const req = { cookies: { sellerToken: fakeToken } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 401);
        });

        it('authenticates valid seller token and populates req.sellerId and req.seller', async () => {
            const validToken = createValidToken({ id: SELLER_1_ID, email: 'alpha@example.com' });
            const req = { cookies: { sellerToken: validToken } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, true);
            assert.equal(req.sellerId, SELLER_1_ID);
            assert.equal(req.seller.id, SELLER_1_ID);
            assert.equal(req.sellerEmail, 'alpha@example.com');
        });

        it('authenticates admin seller token with matching SELLER_EMAIL', async () => {
            const validToken = createValidToken({ email: ADMIN_SELLER_EMAIL });
            const req = { cookies: { sellerToken: validToken } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, true);
            assert.equal(req.sellerId, ADMIN_SELLER_EMAIL);
            assert.equal(req.sellerEmail, ADMIN_SELLER_EMAIL);
        });
    });

    // 2. Seller ownership isolation & IDOR prevention (403 on another seller's product update/delete/read)
    describe('2. Seller Ownership Isolation & IDOR Protection', () => {
        let seller1ProductId;
        let seller2ProductId;

        beforeEach(async () => {
            const p1 = await Product.create({
                name: 'Seller 1 Organic Milk',
                description: ['Fresh cow milk'],
                category: 'Dairy',
                price: 50,
                offerPrice: 45,
                image: ['https://res.cloudinary.com/test-cloud/image/upload/v12345/p1.jpg'],
                sellerId: SELLER_1_ID
            });
            seller1ProductId = p1._id;

            const p2 = await Product.create({
                name: 'Seller 2 Farm Honey',
                description: ['Pure raw honey'],
                category: 'Pantry',
                price: 120,
                offerPrice: 110,
                image: ['https://res.cloudinary.com/test-cloud/image/upload/v12345/p2.jpg'],
                sellerId: SELLER_2_ID
            });
            seller2ProductId = p2._id;
        });

        it('seller 2 cannot view seller 1 product via sellerProductById (returns 403)', async () => {
            const req = {
                params: { id: seller1ProductId },
                sellerId: SELLER_2_ID
            };
            const res = createMockRes();

            await sellerProductById(req, res);

            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Forbidden/i);
        });

        it('seller 2 cannot update seller 1 product via updateProduct (returns 403)', async () => {
            const req = {
                body: {
                    id: seller1ProductId,
                    price: 99
                },
                sellerId: SELLER_2_ID
            };
            const res = createMockRes();

            await updateProduct(req, res);

            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Forbidden/i);

            // Verify product price was not altered
            const originalProduct = productStore.get(seller1ProductId);
            assert.equal(originalProduct.price, 50);
        });

        it('seller 2 cannot delete seller 1 product via deleteProduct (returns 403)', async () => {
            const req = {
                body: { id: seller1ProductId },
                sellerId: SELLER_2_ID
            };
            const res = createMockRes();

            await deleteProduct(req, res);

            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Forbidden/i);

            // Verify product still exists in store
            assert.ok(productStore.has(seller1ProductId));
        });

        it('seller 2 cannot change stock of seller 1 product via changeStock (returns 403)', async () => {
            const req = {
                body: { id: seller1ProductId, inStock: false },
                sellerId: SELLER_2_ID
            };
            const res = createMockRes();

            await changeStock(req, res);

            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Forbidden/i);
        });

        it('seller 1 listing only returns seller 1 products in sellerProductList', async () => {
            const req = {
                query: {},
                sellerId: SELLER_1_ID
            };
            const res = createMockRes();

            await sellerProductList(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.products.length, 1);
            assert.equal(res.body.products[0]._id, seller1ProductId);
            assert.equal(res.body.pagination.totalProducts, 1);
        });
    });

    // 3. Product creation with validated inventory fields (stockQuantity, lowStockThreshold, availableColors)
    describe('3. Product Creation with Validated Inventory Fields', () => {
        it('creates a product with complete inventory fields bound to authenticated seller', async () => {
            const req = {
                body: {
                    productData: JSON.stringify({
                        name: 'Organic Brown Eggs',
                        category: 'Dairy',
                        description: ['Farm fresh free range brown eggs', 'Pack of 12'],
                        price: 60,
                        offerPrice: 55,
                        stockQuantity: 40,
                        lowStockThreshold: 10,
                        availableColors: ['Natural Brown', 'Cream'],
                        inStock: true
                    })
                },
                files: [{ path: '/tmp/test_egg.jpg' }],
                sellerId: SELLER_1_ID
            };
            const res = createMockRes();

            await addProduct(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.ok(res.body.product._id);
            assert.equal(res.body.product.stockQuantity, 40);
            assert.equal(res.body.product.lowStockThreshold, 10);
            assert.deepEqual(res.body.product.availableColors, ['Natural Brown', 'Cream']);
            assert.equal(res.body.product.sellerId, SELLER_1_ID);
            assert.equal(res.body.product.inStock, true);
        });

        it('automatically sets inStock to false if stockQuantity is created as 0', async () => {
            const req = {
                body: {
                    productData: JSON.stringify({
                        name: 'Sold Out Avocados',
                        category: 'Fruits',
                        description: ['Fresh ripe avocados'],
                        price: 90,
                        offerPrice: 85,
                        stockQuantity: 0,
                        inStock: true // Client claims true, but stock is 0
                    })
                },
                files: [{ path: '/tmp/avocado.jpg' }],
                sellerId: SELLER_1_ID
            };
            const res = createMockRes();

            await addProduct(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.product.stockQuantity, 0);
            assert.equal(res.body.product.inStock, false, 'inStock must be false when stockQuantity is 0');
        });

        it('supports unrecorded stock (null) and default threshold 5', async () => {
            const req = {
                body: {
                    productData: JSON.stringify({
                        name: 'Local Spinach',
                        category: 'Vegetables',
                        description: ['Fresh bunch of spinach'],
                        price: 25,
                        offerPrice: 20
                    })
                },
                files: [{ path: '/tmp/spinach.jpg' }],
                sellerId: SELLER_1_ID
            };
            const res = createMockRes();

            await addProduct(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.product.stockQuantity, null);
            assert.equal(res.body.product.lowStockThreshold, 5);
            assert.deepEqual(res.body.product.availableColors, []);
        });
    });

    // 4. Product creation rejects negative stock, float threshold, or non-array colors
    describe('4. Product Creation Validation Rejections', () => {
        it('rejects negative stockQuantity with 400 and cleans up uploads', async () => {
            const req = {
                body: {
                    productData: JSON.stringify({
                        name: 'Invalid Negative Stock Product',
                        category: 'Snacks',
                        description: ['Test snacks'],
                        price: 30,
                        offerPrice: 25,
                        stockQuantity: -5
                    })
                },
                files: [{ path: '/tmp/test.jpg' }],
                sellerId: SELLER_1_ID
            };
            const res = createMockRes();

            await addProduct(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /non-negative integer/i);
            assert.ok(deletedCloudinaryAssets.length > 0, 'Must clean up uploaded images on failure');
        });

        it('rejects floating point stockQuantity with 400', async () => {
            const req = {
                body: {
                    productData: JSON.stringify({
                        name: 'Float Stock Product',
                        category: 'Snacks',
                        description: ['Test snacks'],
                        price: 30,
                        offerPrice: 25,
                        stockQuantity: 12.5
                    })
                },
                files: [{ path: '/tmp/test.jpg' }],
                sellerId: SELLER_1_ID
            };
            const res = createMockRes();

            await addProduct(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /non-negative integer/i);
        });

        it('rejects non-positive or float lowStockThreshold with 400', async () => {
            for (const badThreshold of [0, -2, 3.7]) {
                const req = {
                    body: {
                        productData: JSON.stringify({
                            name: 'Bad Threshold Product',
                            category: 'Snacks',
                            description: ['Test snacks'],
                            price: 30,
                            offerPrice: 25,
                            lowStockThreshold: badThreshold
                        })
                    },
                    files: [{ path: '/tmp/test.jpg' }],
                    sellerId: SELLER_1_ID
                };
                const res = createMockRes();

                await addProduct(req, res);

                assert.equal(res.statusCode, 400);
                assert.match(res.body.message, /integer of at least 1/i);
            }
        });

        it('rejects invalid availableColors with 400', async () => {
            const req = {
                body: {
                    productData: JSON.stringify({
                        name: 'Bad Colors Product',
                        category: 'Snacks',
                        description: ['Test snacks'],
                        price: 30,
                        offerPrice: 25,
                        availableColors: [123, true]
                    })
                },
                files: [{ path: '/tmp/test.jpg' }],
                sellerId: SELLER_1_ID
            };
            const res = createMockRes();

            await addProduct(req, res);

            assert.equal(res.statusCode, 400);
            assert.match(res.body.message, /array of strings/i);
        });
    });

    // 5. Product update with validated inventory fields and auto inStock toggle
    describe('5. Product Update with Inventory Fields and Auto inStock Toggle', () => {
        let testProduct;

        beforeEach(async () => {
            testProduct = await Product.create({
                name: 'Fresh Strawberries',
                description: ['Organic red strawberries'],
                category: 'Fruits',
                price: 80,
                offerPrice: 70,
                image: ['https://res.cloudinary.com/test/strawberries.jpg'],
                inStock: true,
                stockQuantity: 20,
                lowStockThreshold: 5,
                availableColors: ['Red'],
                sellerId: SELLER_1_ID
            });
        });

        it('auto toggles inStock to false when stockQuantity is updated to 0', async () => {
            const req = {
                body: {
                    id: testProduct._id,
                    stockQuantity: 0
                },
                sellerId: SELLER_1_ID
            };
            const res = createMockRes();

            await updateProduct(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.product.stockQuantity, 0);
            assert.equal(res.body.product.inStock, false);
        });

        it('auto toggles inStock to true when restocked from 0 if inStock was false', async () => {
            // First set to out of stock
            testProduct.inStock = false;
            testProduct.stockQuantity = 0;
            productStore.set(testProduct._id, testProduct);

            const req = {
                body: {
                    id: testProduct._id,
                    stockQuantity: 15
                },
                sellerId: SELLER_1_ID
            };
            const res = createMockRes();

            await updateProduct(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.product.stockQuantity, 15);
            assert.equal(res.body.product.inStock, true, 'Should auto-toggle to true on restock');
        });

        it('preserves caller explicit inStock: false when stockQuantity > 0', async () => {
            const req = {
                body: {
                    id: testProduct._id,
                    stockQuantity: 30,
                    inStock: false // Caller explicitly disables product visibility
                },
                sellerId: SELLER_1_ID
            };
            const res = createMockRes();

            await updateProduct(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.product.stockQuantity, 30);
            assert.equal(res.body.product.inStock, false);
        });

        it('updates lowStockThreshold and availableColors safely', async () => {
            const req = {
                body: {
                    id: testProduct._id,
                    lowStockThreshold: 12,
                    availableColors: ['Bright Red', 'Ruby']
                },
                sellerId: SELLER_1_ID
            };
            const res = createMockRes();

            await updateProduct(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.product.lowStockThreshold, 12);
            assert.deepEqual(res.body.product.availableColors, ['Bright Red', 'Ruby']);
        });

        it('ignores client attempts to alter sellerId during update', async () => {
            const req = {
                body: {
                    id: testProduct._id,
                    price: 95,
                    sellerId: 'attacker_seller_id' // Malicious client attempt
                },
                sellerId: SELLER_1_ID
            };
            const res = createMockRes();

            await updateProduct(req, res);

            assert.equal(res.statusCode, 200);
            const saved = productStore.get(testProduct._id);
            assert.equal(saved.sellerId, SELLER_1_ID, 'sellerId must remain untouched');
        });
    });

    // 6. Product deletion deletes reviews and Cloudinary assets, with ownership protection
    describe('6. Product Deletion, Reviews & Cloudinary Assets Cleanup', () => {
        let productToDelete;

        beforeEach(async () => {
            productToDelete = await Product.create({
                name: 'Product To Delete',
                description: ['To be removed'],
                category: 'Pantry',
                price: 15,
                offerPrice: 12,
                image: [
                    'https://res.cloudinary.com/test-cloud/image/upload/v12345/prod_del_img_1.jpg',
                    'https://res.cloudinary.com/test-cloud/image/upload/v12345/prod_del_img_2.jpg'
                ],
                sellerId: SELLER_1_ID
            });

            // Seed associated reviews
            reviewStore.set('rev_1', { _id: 'rev_1', productId: productToDelete._id, comment: 'Great' });
            reviewStore.set('rev_2', { _id: 'rev_2', productId: productToDelete._id, comment: 'Nice' });
            reviewStore.set('rev_3', { _id: 'rev_3', productId: 'other_product', comment: 'Keep this' });
        });

        it('deletes product, associated reviews, and Cloudinary images when executed by owner', async () => {
            const req = {
                body: { id: productToDelete._id },
                sellerId: SELLER_1_ID
            };
            const res = createMockRes();

            await deleteProduct(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.ok(!productStore.has(productToDelete._id), 'Product should be deleted from DB');

            // Verify associated reviews deleted
            assert.ok(!reviewStore.has('rev_1'));
            assert.ok(!reviewStore.has('rev_2'));
            assert.ok(reviewStore.has('rev_3'), 'Unrelated review should remain');

            // Verify Cloudinary destroy called for images
            assert.ok(deletedCloudinaryAssets.includes('prod_del_img_1'));
            assert.ok(deletedCloudinaryAssets.includes('prod_del_img_2'));
        });
    });

    // 7. Case-insensitive search on product name
    describe('7. Case-Insensitive Search on Product Name', () => {
        beforeEach(async () => {
            await Product.create({ name: 'Crisp Red Apples', category: 'Fruits', price: 40, offerPrice: 35, image: [] });
            await Product.create({ name: 'Fresh Cavendish Bananas', category: 'Fruits', price: 20, offerPrice: 15, image: [] });
            await Product.create({ name: 'Golden Apple Pears', category: 'Fruits', price: 60, offerPrice: 50, image: [] });
        });

        it('matches products regardless of casing (e.g. "apple", "APPLE", "AppLe")', async () => {
            for (const term of ['apple', 'APPLE', 'AppLe']) {
                const req = { query: { search: term } };
                const res = createMockRes();

                await productList(req, res);

                assert.equal(res.statusCode, 200);
                assert.equal(res.body.products.length, 2, `Search "${term}" should match 2 apple products`);
                assert.ok(res.body.products.every(p => /apple/i.test(p.name)));
            }
        });
    });

    // 8. Case-insensitive search on category
    describe('8. Case-Insensitive Search on Category', () => {
        beforeEach(async () => {
            await Product.create({ name: 'Spinach', category: 'Fresh Vegetables', price: 15, offerPrice: 12, image: [] });
            await Product.create({ name: 'Broccoli', category: 'Fresh Vegetables', price: 25, offerPrice: 20, image: [] });
            await Product.create({ name: 'Milk', category: 'Dairy & Eggs', price: 30, offerPrice: 28, image: [] });
        });

        it('finds products when search term matches category name', async () => {
            const req = { query: { search: 'vegetables' } };
            const res = createMockRes();

            await productList(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.products.length, 2);
            assert.ok(res.body.products.every(p => p.category === 'Fresh Vegetables'));
        });
    });

    // 9. Regex input safety (escapes special chars like (, [, *, +)
    describe('9. Regex Input Safety (ReDoS & Injection Prevention)', () => {
        it('safely escapes special characters via escapeRegex', () => {
            const unsafeInput = 'Apple (Pack of 4) [100% Organic] *Special* + Bonus? ^Start $End .';
            const escaped = escapeRegex(unsafeInput);

            assert.doesNotThrow(() => new RegExp(escaped, 'i'));
            assert.ok(escaped.includes('\\('));
            assert.ok(escaped.includes('\\['));
            assert.ok(escaped.includes('\\*'));
            assert.ok(escaped.includes('\\+'));
            assert.ok(escaped.includes('\\?'));
            assert.ok(escaped.includes('\\^'));
            assert.ok(escaped.includes('\\$'));
            assert.ok(escaped.includes('\\.'));
        });

        it('handles search queries containing regex operators without crashing or evaluating syntax', async () => {
            await Product.create({ name: 'Apple (Grade A)', category: 'Fruits', price: 40, offerPrice: 35, image: [] });

            const req = { query: { search: '(Grade A)' } };
            const res = createMockRes();

            await productList(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.products.length, 1);
            assert.equal(res.body.products[0].name, 'Apple (Grade A)');
        });
    });

    // 10. Category filter
    describe('10. Category Filter', () => {
        beforeEach(async () => {
            await Product.create({ name: 'Almonds', category: 'Nuts', price: 90, offerPrice: 80, image: [] });
            await Product.create({ name: 'Cashews', category: 'Nuts', price: 110, offerPrice: 100, image: [] });
            await Product.create({ name: 'Orange Juice', category: 'Beverages', price: 45, offerPrice: 40, image: [] });
        });

        it('filters by category exactly and case-insensitively', async () => {
            const req = { query: { category: 'nuts' } };
            const res = createMockRes();

            await productList(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.products.length, 2);
            assert.ok(res.body.products.every(p => p.category === 'Nuts'));
        });

        it('returns all categories when category=all is specified', async () => {
            const req = { query: { category: 'all' } };
            const res = createMockRes();

            await productList(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.products.length, 3);
        });
    });

    // 11. Stock status filter: inStock
    describe('11. Stock Status Filter: inStock', () => {
        beforeEach(async () => {
            await Product.create({ name: 'High Stock Item', category: 'Test', price: 10, offerPrice: 8, image: [], stockQuantity: 25, lowStockThreshold: 5 });
            await Product.create({ name: 'Low Stock Item', category: 'Test', price: 10, offerPrice: 8, image: [], stockQuantity: 3, lowStockThreshold: 5 });
            await Product.create({ name: 'Out Of Stock Item', category: 'Test', price: 10, offerPrice: 8, image: [], stockQuantity: 0, lowStockThreshold: 5 });
            await Product.create({ name: 'Unknown Stock Item', category: 'Test', price: 10, offerPrice: 8, image: [], stockQuantity: null });
        });

        it('returns only items where stockQuantity > lowStockThreshold', async () => {
            const req = { query: { stockStatus: 'instock' } };
            const res = createMockRes();

            await productList(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.products.length, 1);
            assert.equal(res.body.products[0].name, 'High Stock Item');
        });
    });

    // 12. Stock status filter: lowStock
    describe('12. Stock Status Filter: lowStock', () => {
        beforeEach(async () => {
            await Product.create({ name: 'High Stock Item', category: 'Test', price: 10, offerPrice: 8, image: [], stockQuantity: 25, lowStockThreshold: 5 });
            await Product.create({ name: 'Low Stock Item', category: 'Test', price: 10, offerPrice: 8, image: [], stockQuantity: 4, lowStockThreshold: 5 });
            await Product.create({ name: 'Zero Stock Item', category: 'Test', price: 10, offerPrice: 8, image: [], stockQuantity: 0, lowStockThreshold: 5 });
            await Product.create({ name: 'Null Stock Item', category: 'Test', price: 10, offerPrice: 8, image: [], stockQuantity: null });
        });

        it('returns only items where 1 <= stockQuantity <= lowStockThreshold', async () => {
            const req = { query: { stockStatus: 'lowstock' } };
            const res = createMockRes();

            await productList(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.products.length, 1);
            assert.equal(res.body.products[0].name, 'Low Stock Item');
        });
    });

    // 13. Stock status filter: outOfStock
    describe('13. Stock Status Filter: outOfStock', () => {
        beforeEach(async () => {
            await Product.create({ name: 'Zero Stock Item', category: 'Test', price: 10, offerPrice: 8, image: [], stockQuantity: 0 });
            await Product.create({ name: 'Null Stock Item', category: 'Test', price: 10, offerPrice: 8, image: [], stockQuantity: null });
            await Product.create({ name: 'In Stock Item', category: 'Test', price: 10, offerPrice: 8, image: [], stockQuantity: 15 });
        });

        it('returns items with stockQuantity === 0 and NEVER includes null unknown stock', async () => {
            const req = { query: { stockStatus: 'outofstock' } };
            const res = createMockRes();

            await productList(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.products.length, 1);
            assert.equal(res.body.products[0].name, 'Zero Stock Item');
            assert.ok(!res.body.products.some(p => p.stockQuantity === null), 'Must never classify null as out of stock');
        });
    });

    // 14. Stock status filter: unrecorded (null)
    describe('14. Stock Status Filter: unrecorded (null)', () => {
        beforeEach(async () => {
            await Product.create({ name: 'Unrecorded Item 1', category: 'Test', price: 10, offerPrice: 8, image: [], stockQuantity: null });
            await Product.create({ name: 'Zero Stock Item', category: 'Test', price: 10, offerPrice: 8, image: [], stockQuantity: 0 });
            await Product.create({ name: 'Recorded 10 Item', category: 'Test', price: 10, offerPrice: 8, image: [], stockQuantity: 10 });
        });

        it('returns only items with stockQuantity: null', async () => {
            const req = { query: { stockStatus: 'unrecorded' } };
            const res = createMockRes();

            await productList(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.products.length, 1);
            assert.equal(res.body.products[0].name, 'Unrecorded Item 1');
            assert.equal(res.body.products[0].stockQuantity, null);
        });
    });

    // 15. Pagination boundaries, default values, and maximum page size clamping
    describe('15. Pagination Boundaries & Clamping', () => {
        it('applies defaults page=1, limit=20 when none specified', () => {
            const parsed = parsePaginationAndSort({});
            assert.equal(parsed.page, 1);
            assert.equal(parsed.limit, 20);
            assert.equal(parsed.skip, 0);
        });

        it('clamps limit to maximum 100 if caller requests larger limit', () => {
            const parsed = parsePaginationAndSort({ limit: 500 });
            assert.equal(parsed.limit, 100);
        });

        it('falls back to page 1 and default limit for negative or non-integer inputs', () => {
            const parsed = parsePaginationAndSort({ page: -3, limit: 'invalid' });
            assert.equal(parsed.page, 1);
            assert.equal(parsed.limit, 20);
        });

        it('returns complete pagination metadata structure', async () => {
            for (let i = 1; i <= 25; i++) {
                await Product.create({ name: `Item ${i}`, category: 'Test', price: i, offerPrice: i, image: [] });
            }

            const req = { query: { page: '2', limit: '10' } };
            const res = createMockRes();

            await productList(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.products.length, 10);
            assert.deepEqual(res.body.pagination, {
                page: 2,
                limit: 10,
                totalProducts: 25,
                totalPages: 3,
                hasNextPage: true,
                hasPrevPage: true,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            });
        });
    });

    // 16. Deterministic sorting (including secondary _id tie-breaker)
    describe('16. Deterministic Sorting', () => {
        it('includes secondary _id tie breaker in sort object', () => {
            const parsedAsc = parsePaginationAndSort({ sortBy: 'price', sortOrder: 'asc' });
            assert.deepEqual(parsedAsc.sort, { price: 1, _id: 1 });

            const parsedDesc = parsePaginationAndSort({ sortBy: 'stockQuantity', sortOrder: 'desc' });
            assert.deepEqual(parsedDesc.sort, { stockQuantity: -1, _id: -1 });
        });

        it('falls back to createdAt when unauthorized sort field is requested', () => {
            const parsed = parsePaginationAndSort({ sortBy: 'maliciousField', sortOrder: 'asc' });
            assert.equal(parsed.sortBy, 'createdAt');
            assert.deepEqual(parsed.sort, { createdAt: 1, _id: 1 });
        });

        it('sorts products deterministically by price ascending in productList', async () => {
            await Product.create({ name: 'Mid', category: 'Test', price: 50, offerPrice: 40, image: [] });
            await Product.create({ name: 'Cheap', category: 'Test', price: 10, offerPrice: 8, image: [] });
            await Product.create({ name: 'Expensive', category: 'Test', price: 100, offerPrice: 90, image: [] });

            const req = { query: { sortBy: 'price', sortOrder: 'asc' } };
            const res = createMockRes();

            await productList(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.products[0].name, 'Cheap');
            assert.equal(res.body.products[1].name, 'Mid');
            assert.equal(res.body.products[2].name, 'Expensive');
        });
    });

    // 17. Combined search + filter + pagination query
    describe('17. Combined Search, Filter & Pagination Query', () => {
        beforeEach(async () => {
            await Product.create({ name: 'Green Organic Apple', category: 'Fruits', price: 50, offerPrice: 40, image: [], stockQuantity: 20, lowStockThreshold: 5 });
            await Product.create({ name: 'Red Delicious Apple', category: 'Fruits', price: 45, offerPrice: 35, image: [], stockQuantity: 3, lowStockThreshold: 5 });
            await Product.create({ name: 'Golden Apple Pear', category: 'Fruits', price: 60, offerPrice: 50, image: [], stockQuantity: 0, lowStockThreshold: 5 });
            await Product.create({ name: 'Apple Cinnamon Tea', category: 'Beverages', price: 30, offerPrice: 25, image: [], stockQuantity: 25, lowStockThreshold: 5 });
        });

        it('combines search="apple", category="Fruits", stockStatus="instock", with pagination and sorting', async () => {
            const req = {
                query: {
                    search: 'apple',
                    category: 'Fruits',
                    stockStatus: 'instock',
                    page: 1,
                    limit: 10,
                    sortBy: 'price',
                    sortOrder: 'asc'
                }
            };
            const res = createMockRes();

            await productList(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.products.length, 1);
            assert.equal(res.body.products[0].name, 'Green Organic Apple');
            assert.equal(res.body.pagination.totalProducts, 1);
            assert.equal(res.body.pagination.totalPages, 1);
            assert.equal(res.body.pagination.hasNextPage, false);
            assert.equal(res.body.pagination.hasPrevPage, false);
        });
    });

    // 18. Rejection of invalid MongoDB ObjectIds (400)
    describe('18. Rejection of Invalid MongoDB ObjectIds', () => {
        const invalidIds = ['invalid-id', '12345', 'not-an-objectid', null, ''];

        it('productById rejects invalid IDs with 400', async () => {
            for (const id of ['invalid-id', '123']) {
                const req = { params: { id } };
                const res = createMockRes();
                await productById(req, res);
                assert.equal(res.statusCode, 400);
                assert.equal(res.body.success, false);
                assert.match(res.body.message, /Invalid product ID/i);
            }
        });

        it('sellerProductById rejects invalid IDs with 400', async () => {
            const req = { params: { id: 'bad-id-123' }, sellerId: SELLER_1_ID };
            const res = createMockRes();
            await sellerProductById(req, res);
            assert.equal(res.statusCode, 400);
            assert.match(res.body.message, /Invalid product ID/i);
        });

        it('updateProduct rejects invalid IDs with 400', async () => {
            const req = { body: { id: 'bad-id-123', price: 50 }, sellerId: SELLER_1_ID };
            const res = createMockRes();
            await updateProduct(req, res);
            assert.equal(res.statusCode, 400);
            assert.match(res.body.message, /Invalid product ID/i);
        });

        it('deleteProduct rejects invalid IDs with 400', async () => {
            const req = { body: { id: 'bad-id-123' }, sellerId: SELLER_1_ID };
            const res = createMockRes();
            await deleteProduct(req, res);
            assert.equal(res.statusCode, 400);
            assert.match(res.body.message, /Invalid product ID/i);
        });

        it('changeStock rejects invalid IDs with 400', async () => {
            const req = { body: { id: 'bad-id-123', inStock: false }, sellerId: SELLER_1_ID };
            const res = createMockRes();
            await changeStock(req, res);
            assert.equal(res.statusCode, 400);
            assert.match(res.body.message, /Invalid product ID/i);
        });
    });

    // 19. Review Findings Remediation — Legacy Ownership & Zero-Stock Consistency
    describe('19. Review Findings Remediation — Legacy Ownership & Zero-Stock Consistency', () => {
        let legacyProductId;
        let seller1AssignedProductId;
        let zeroStockProductId;
        let nullStockProductId;

        beforeEach(async () => {
            // Seed a legacy product with sellerId: null
            const pLegacy = await Product.create({
                name: 'Legacy Unassigned Almonds',
                description: ['Raw unassigned almonds'],
                category: 'Pantry',
                price: 150,
                offerPrice: 140,
                image: ['https://res.cloudinary.com/test-cloud/image/upload/v12345/almonds.jpg'],
                stockQuantity: 50,
                inStock: true,
                sellerId: null
            });
            legacyProductId = pLegacy._id;

            // Seed a product assigned to Seller 1
            const pAssigned = await Product.create({
                name: 'Seller 1 Organic Cashews',
                description: ['Premium cashews'],
                category: 'Pantry',
                price: 200,
                offerPrice: 180,
                image: ['https://res.cloudinary.com/test-cloud/image/upload/v12345/cashews.jpg'],
                stockQuantity: 25,
                inStock: true,
                sellerId: SELLER_1_ID
            });
            seller1AssignedProductId = pAssigned._id;

            // Seed a product with stockQuantity === 0
            const pZero = await Product.create({
                name: 'Sold Out Pistachios',
                description: ['Out of stock item'],
                category: 'Pantry',
                price: 180,
                offerPrice: 160,
                image: ['https://res.cloudinary.com/test-cloud/image/upload/v12345/pistachios.jpg'],
                stockQuantity: 0,
                inStock: false,
                sellerId: SELLER_1_ID
            });
            zeroStockProductId = pZero._id;

            // Seed a product with stockQuantity: null (unrecorded stock)
            const pNull = await Product.create({
                name: 'Unrecorded Stock Walnuts',
                description: ['Walnuts with unrecorded stock'],
                category: 'Pantry',
                price: 220,
                offerPrice: 200,
                image: ['https://res.cloudinary.com/test-cloud/image/upload/v12345/walnuts.jpg'],
                stockQuantity: null,
                inStock: true,
                sellerId: SELLER_1_ID
            });
            nullStockProductId = pNull._id;
        });

        // 1. Non-admin seller cannot read a legacy unassigned product (403)
        it('1. Non-admin seller cannot read a legacy unassigned product (returns 403)', async () => {
            const req = {
                params: { id: legacyProductId },
                sellerId: SELLER_2_ID,
                sellerEmail: 'seller2@example.com'
            };
            const res = createMockRes();

            await sellerProductById(req, res);

            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Forbidden/i);
        });

        // 2. Non-admin seller cannot update a legacy unassigned product (403)
        it('2. Non-admin seller cannot update a legacy unassigned product (returns 403)', async () => {
            const req = {
                body: { id: legacyProductId, price: 999 },
                sellerId: SELLER_2_ID,
                sellerEmail: 'seller2@example.com'
            };
            const res = createMockRes();

            await updateProduct(req, res);

            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Forbidden/i);

            // Verify product in database was not mutated
            const doc = productStore.get(legacyProductId);
            assert.equal(doc.price, 150);
        });

        // 3. Non-admin seller cannot delete a legacy unassigned product (403)
        it('3. Non-admin seller cannot delete a legacy unassigned product (returns 403)', async () => {
            const req = {
                body: { id: legacyProductId },
                sellerId: SELLER_2_ID,
                sellerEmail: 'seller2@example.com'
            };
            const res = createMockRes();

            await deleteProduct(req, res);

            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Forbidden/i);

            // Verify product still exists in store
            assert.ok(productStore.has(legacyProductId));
        });

        // 4. Non-admin seller cannot change stock of a legacy unassigned product (403)
        it('4. Non-admin seller cannot change stock of a legacy unassigned product (returns 403)', async () => {
            const req = {
                body: { id: legacyProductId, inStock: false },
                sellerId: SELLER_2_ID,
                sellerEmail: 'seller2@example.com'
            };
            const res = createMockRes();

            await changeStock(req, res);

            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Forbidden/i);
        });

        // 5. Admin seller can manage legacy unassigned products
        it('5. Admin seller can manage legacy unassigned products (read, update, stock, delete)', async () => {
            // Admin seller can view
            const readReq = {
                params: { id: legacyProductId },
                sellerId: ADMIN_SELLER_EMAIL,
                sellerEmail: ADMIN_SELLER_EMAIL
            };
            const readRes = createMockRes();
            await sellerProductById(readReq, readRes);
            assert.equal(readRes.statusCode, 200);
            assert.equal(readRes.body.product._id, legacyProductId);

            // Admin seller can change stock
            const stockReq = {
                body: { id: legacyProductId, inStock: false },
                sellerId: ADMIN_SELLER_EMAIL,
                sellerEmail: ADMIN_SELLER_EMAIL
            };
            const stockRes = createMockRes();
            await changeStock(stockReq, stockRes);
            assert.equal(stockRes.statusCode, 200);

            // Admin seller can update
            const updateReq = {
                body: { id: legacyProductId, name: 'Renamed by Admin' },
                sellerId: ADMIN_SELLER_EMAIL,
                sellerEmail: ADMIN_SELLER_EMAIL
            };
            const updateRes = createMockRes();
            await updateProduct(updateReq, updateRes);
            assert.equal(updateRes.statusCode, 200);
            assert.equal(updateRes.body.product.name, 'Renamed by Admin');

            // Admin seller can delete
            const delReq = {
                body: { id: legacyProductId },
                sellerId: ADMIN_SELLER_EMAIL,
                sellerEmail: ADMIN_SELLER_EMAIL
            };
            const delRes = createMockRes();
            await deleteProduct(delReq, delRes);
            assert.equal(delRes.statusCode, 200);
            assert.ok(!productStore.has(legacyProductId));
        });

        // 6. A seller can manage their own assigned products
        it('6. A seller can manage their own assigned products', async () => {
            const seller1Req = {
                sellerId: SELLER_1_ID,
                sellerEmail: 'seller1@example.com'
            };

            // Can read
            const readRes = createMockRes();
            await sellerProductById({ ...seller1Req, params: { id: seller1AssignedProductId } }, readRes);
            assert.equal(readRes.statusCode, 200);

            // Can update
            const updateRes = createMockRes();
            await updateProduct({ ...seller1Req, body: { id: seller1AssignedProductId, price: 195 } }, updateRes);
            assert.equal(updateRes.statusCode, 200);
            assert.equal(updateRes.body.product.price, 195);

            // Can toggle stock
            const stockRes = createMockRes();
            await changeStock({ ...seller1Req, body: { id: seller1AssignedProductId, inStock: false } }, stockRes);
            assert.equal(stockRes.statusCode, 200);
        });

        // 7. A seller cannot manage another seller's assigned products
        it('7. A seller cannot manage another seller\'s assigned products (returns 403)', async () => {
            const otherSellerReq = {
                sellerId: SELLER_2_ID,
                sellerEmail: 'seller2@example.com'
            };

            // Cannot read
            const readRes = createMockRes();
            await sellerProductById({ ...otherSellerReq, params: { id: seller1AssignedProductId } }, readRes);
            assert.equal(readRes.statusCode, 403);

            // Cannot update
            const updateRes = createMockRes();
            await updateProduct({ ...otherSellerReq, body: { id: seller1AssignedProductId, price: 99 } }, updateRes);
            assert.equal(updateRes.statusCode, 403);

            // Cannot delete
            const delRes = createMockRes();
            await deleteProduct({ ...otherSellerReq, body: { id: seller1AssignedProductId } }, delRes);
            assert.equal(delRes.statusCode, 403);

            // Cannot change stock
            const stockRes = createMockRes();
            await changeStock({ ...otherSellerReq, body: { id: seller1AssignedProductId, inStock: false } }, stockRes);
            assert.equal(stockRes.statusCode, 403);
        });

        // 8. changeStock rejects inStock: true when stockQuantity is zero
        it('8. changeStock rejects inStock: true when stockQuantity is zero (returns 400)', async () => {
            const req = {
                body: { id: zeroStockProductId, inStock: true },
                sellerId: SELLER_1_ID,
                sellerEmail: 'seller1@example.com'
            };
            const res = createMockRes();

            await changeStock(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /stock quantity is 0/i);

            // Verify inStock was not changed to true in database
            const doc = productStore.get(zeroStockProductId);
            assert.equal(doc.inStock, false);
        });

        // 9. changeStock allows inStock: false when stockQuantity is zero
        it('9. changeStock allows inStock: false when stockQuantity is zero (returns 200)', async () => {
            const req = {
                body: { id: zeroStockProductId, inStock: false },
                sellerId: SELLER_1_ID,
                sellerEmail: 'seller1@example.com'
            };
            const res = createMockRes();

            await changeStock(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            const doc = productStore.get(zeroStockProductId);
            assert.equal(doc.inStock, false);
        });

        // 10. stockQuantity: null behavior remains unchanged
        it('10. stockQuantity: null behavior remains unchanged in changeStock', async () => {
            const seller1Req = {
                sellerId: SELLER_1_ID,
                sellerEmail: 'seller1@example.com'
            };

            // Can set inStock: false
            const res1 = createMockRes();
            await changeStock({ ...seller1Req, body: { id: nullStockProductId, inStock: false } }, res1);
            assert.equal(res1.statusCode, 200);
            assert.equal(productStore.get(nullStockProductId).inStock, false);

            // Can set inStock: true
            const res2 = createMockRes();
            await changeStock({ ...seller1Req, body: { id: nullStockProductId, inStock: true } }, res2);
            assert.equal(res2.statusCode, 200);
            assert.equal(productStore.get(nullStockProductId).inStock, true);
        });
    });

    // 20. Final Security Verification Remediation — Hardcoded Admin Bypass Removal & Fail-Closed Suite
    describe('20. Final Security Verification Remediation — Hardcoded Admin Bypass Removal & Fail-Closed Suite', () => {
        let legacyProductId;
        let seller1AssignedProductId;
        let seller2AssignedProductId;

        beforeEach(async () => {
            // Seed a legacy unassigned product (sellerId: null)
            const pLegacy = await Product.create({
                name: 'Legacy Unassigned Almonds Phase 7.3',
                description: ['Raw unassigned almonds'],
                category: 'Pantry',
                price: 150,
                offerPrice: 140,
                image: ['https://res.cloudinary.com/test-cloud/image/upload/v12345/almonds.jpg'],
                stockQuantity: 50,
                inStock: true,
                sellerId: null
            });
            legacyProductId = pLegacy._id;

            // Seed a product assigned to Seller 1
            const pAssigned1 = await Product.create({
                name: 'Seller 1 Organic Cashews Phase 7.3',
                description: ['Premium cashews'],
                category: 'Pantry',
                price: 200,
                offerPrice: 180,
                image: ['https://res.cloudinary.com/test-cloud/image/upload/v12345/cashews.jpg'],
                stockQuantity: 25,
                inStock: true,
                sellerId: SELLER_1_ID
            });
            seller1AssignedProductId = pAssigned1._id;

            // Seed a product assigned to Seller 2
            const pAssigned2 = await Product.create({
                name: 'Seller 2 Organic Walnuts Phase 7.3',
                description: ['Premium walnuts'],
                category: 'Pantry',
                price: 250,
                offerPrice: 220,
                image: ['https://res.cloudinary.com/test-cloud/image/upload/v12345/walnuts.jpg'],
                stockQuantity: 30,
                inStock: true,
                sellerId: SELLER_2_ID
            });
            seller2AssignedProductId = pAssigned2._id;
        });

        // 1. Normal seller whose token or request specifies sellerId: 'admin' CANNOT access or modify a legacy unassigned product (403)
        it('1. Normal seller whose token or request specifies sellerId: \'admin\' CANNOT access or modify a legacy unassigned product (403 Forbidden)', async () => {
            const attackerReq = {
                sellerId: 'admin',
                sellerEmail: 'attacker@normal-seller.com'
            };

            // Attempt read
            const readRes = createMockRes();
            await sellerProductById({ ...attackerReq, params: { id: legacyProductId } }, readRes);
            assert.equal(readRes.statusCode, 403);
            assert.match(readRes.body.message, /Forbidden/i);

            // Attempt update
            const updateRes = createMockRes();
            await updateProduct({ ...attackerReq, body: { id: legacyProductId, price: 999 } }, updateRes);
            assert.equal(updateRes.statusCode, 403);
            assert.match(updateRes.body.message, /Forbidden/i);

            // Attempt stock toggle
            const stockRes = createMockRes();
            await changeStock({ ...attackerReq, body: { id: legacyProductId, inStock: false } }, stockRes);
            assert.equal(stockRes.statusCode, 403);
            assert.match(stockRes.body.message, /Forbidden/i);

            // Attempt delete
            const delRes = createMockRes();
            await deleteProduct({ ...attackerReq, body: { id: legacyProductId } }, delRes);
            assert.equal(delRes.statusCode, 403);
            assert.match(delRes.body.message, /Forbidden/i);
            assert.ok(productStore.has(legacyProductId));
        });

        // 2. Normal seller with id: 'admin' in a tenant token CANNOT access or modify a legacy unassigned product (403)
        it('2. Normal seller with id: \'admin\' in a tenant token CANNOT access or modify a legacy unassigned product (403 Forbidden)', async () => {
            const tenantToken = createValidToken({ id: 'admin', email: 'tenant@custom-domain.com' });
            const req = {
                cookies: { sellerToken: tenantToken },
                params: { id: legacyProductId }
            };
            const res = createMockRes();

            let nextCalled = false;
            await authSeller(req, res, () => { nextCalled = true; });
            assert.equal(nextCalled, true);
            assert.equal(req.sellerId, 'admin');
            assert.equal(req.sellerEmail, 'tenant@custom-domain.com');

            // Pass authenticated request to sellerProductById
            await sellerProductById(req, res);
            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Forbidden/i);
        });

        // 3. Tenant seller cannot gain admin access by supplying admin email in request body or query parameters (403)
        it('3. Tenant seller cannot gain admin access by supplying admin email in request body or query parameters (403 Forbidden)', async () => {
            const tenantReq = {
                sellerId: SELLER_1_ID,
                sellerEmail: 'seller1@example.com',
                body: {
                    id: legacyProductId,
                    price: 999,
                    sellerEmail: ADMIN_SELLER_EMAIL,
                    adminEmail: ADMIN_SELLER_EMAIL
                },
                query: {
                    sellerEmail: ADMIN_SELLER_EMAIL,
                    adminEmail: ADMIN_SELLER_EMAIL
                }
            };

            const updateRes = createMockRes();
            await updateProduct(tenantReq, updateRes);
            assert.equal(updateRes.statusCode, 403);
            assert.match(updateRes.body.message, /Forbidden/i);

            // Check store is untampered
            assert.equal(productStore.get(legacyProductId).price, 150);
        });

        // 4. Valid authenticated admin seller (verified via process.env.SELLER_EMAIL) CAN access and modify legacy unassigned products (200)
        it('4. Valid authenticated admin seller (verified via process.env.SELLER_EMAIL) CAN access and modify legacy unassigned products (200 OK)', async () => {
            const adminReq = {
                sellerId: ADMIN_SELLER_EMAIL,
                sellerEmail: ADMIN_SELLER_EMAIL
            };

            // Can read
            const readRes = createMockRes();
            await sellerProductById({ ...adminReq, params: { id: legacyProductId } }, readRes);
            assert.equal(readRes.statusCode, 200);
            assert.equal(readRes.body.product._id, legacyProductId);

            // Can update
            const updateRes = createMockRes();
            await updateProduct({ ...adminReq, body: { id: legacyProductId, name: 'Admin Renamed Legacy Almonds' } }, updateRes);
            assert.equal(updateRes.statusCode, 200);
            assert.equal(productStore.get(legacyProductId).name, 'Admin Renamed Legacy Almonds');

            // Can toggle stock
            const stockRes = createMockRes();
            await changeStock({ ...adminReq, body: { id: legacyProductId, inStock: false } }, stockRes);
            assert.equal(stockRes.statusCode, 200);
            assert.equal(productStore.get(legacyProductId).inStock, false);
        });

        // 5. Invalid or missing admin identity is denied access to legacy unassigned products (403)
        it('5. Invalid or missing admin identity is denied access to legacy unassigned products (403 Forbidden)', async () => {
            // Wrong admin email
            const wrongEmailReq = {
                sellerId: 'admin',
                sellerEmail: 'wrong_admin@greencart.com',
                params: { id: legacyProductId }
            };
            const wrongRes = createMockRes();
            await sellerProductById(wrongEmailReq, wrongRes);
            assert.equal(wrongRes.statusCode, 403);

            // Missing sellerEmail completely with sellerId: 'admin'
            const missingEmailReq = {
                sellerId: 'admin',
                params: { id: legacyProductId }
            };
            const missingRes = createMockRes();
            await sellerProductById(missingEmailReq, missingRes);
            assert.equal(missingRes.statusCode, 403);
        });

        // 6. A seller can access and modify their own assigned products (200)
        it('6. A seller can access and modify their own assigned products (200 OK)', async () => {
            const ownerReq = {
                sellerId: SELLER_1_ID,
                sellerEmail: 'seller1@example.com'
            };

            const readRes = createMockRes();
            await sellerProductById({ ...ownerReq, params: { id: seller1AssignedProductId } }, readRes);
            assert.equal(readRes.statusCode, 200);
            assert.equal(readRes.body.product.name, 'Seller 1 Organic Cashews Phase 7.3');

            const updateRes = createMockRes();
            await updateProduct({ ...ownerReq, body: { id: seller1AssignedProductId, price: 215 } }, updateRes);
            assert.equal(updateRes.statusCode, 200);
            assert.equal(productStore.get(seller1AssignedProductId).price, 215);
        });

        // 7. A seller cannot access or modify another seller's assigned products (403)
        it('7. A seller cannot access or modify another seller\'s assigned products (403 Forbidden)', async () => {
            const nonOwnerReq = {
                sellerId: SELLER_2_ID,
                sellerEmail: 'seller2@example.com'
            };

            const readRes = createMockRes();
            await sellerProductById({ ...nonOwnerReq, params: { id: seller1AssignedProductId } }, readRes);
            assert.equal(readRes.statusCode, 403);

            const updateRes = createMockRes();
            await updateProduct({ ...nonOwnerReq, body: { id: seller1AssignedProductId, price: 99 } }, updateRes);
            assert.equal(updateRes.statusCode, 403);

            const stockRes = createMockRes();
            await changeStock({ ...nonOwnerReq, body: { id: seller1AssignedProductId, inStock: false } }, stockRes);
            assert.equal(stockRes.statusCode, 403);

            const delRes = createMockRes();
            await deleteProduct({ ...nonOwnerReq, body: { id: seller1AssignedProductId } }, delRes);
            assert.equal(delRes.statusCode, 403);
            assert.ok(productStore.has(seller1AssignedProductId));
        });

        // 8. Normal seller cannot read, update, delete, or change stock of legacy unassigned products (403)
        it('8. Normal seller cannot read, update, delete, or change stock of legacy unassigned products (403 Forbidden)', async () => {
            const normalSellerReq = {
                sellerId: SELLER_1_ID,
                sellerEmail: 'seller1@example.com'
            };

            const readRes = createMockRes();
            await sellerProductById({ ...normalSellerReq, params: { id: legacyProductId } }, readRes);
            assert.equal(readRes.statusCode, 403);

            const updateRes = createMockRes();
            await updateProduct({ ...normalSellerReq, body: { id: legacyProductId, price: 999 } }, updateRes);
            assert.equal(updateRes.statusCode, 403);

            const stockRes = createMockRes();
            await changeStock({ ...normalSellerReq, body: { id: legacyProductId, inStock: false } }, stockRes);
            assert.equal(stockRes.statusCode, 403);

            const delRes = createMockRes();
            await deleteProduct({ ...normalSellerReq, body: { id: legacyProductId } }, delRes);
            assert.equal(delRes.statusCode, 403);
            assert.ok(productStore.has(legacyProductId));
        });

        // 9. Direct controller invocation without authenticated seller identity fails closed (403 Forbidden / default-deny)
        it('9. Direct controller invocation without authenticated seller identity fails closed (403 Forbidden / default-deny)', async () => {
            const noAuthReq = {};

            const readRes = createMockRes();
            await sellerProductById({ ...noAuthReq, params: { id: legacyProductId } }, readRes);
            assert.equal(readRes.statusCode, 403);

            const updateRes = createMockRes();
            await updateProduct({ ...noAuthReq, body: { id: legacyProductId, price: 999 } }, updateRes);
            assert.equal(updateRes.statusCode, 403);

            const stockRes = createMockRes();
            await changeStock({ ...noAuthReq, body: { id: legacyProductId, inStock: false } }, stockRes);
            assert.equal(stockRes.statusCode, 403);

            const delRes = createMockRes();
            await deleteProduct({ ...noAuthReq, body: { id: legacyProductId } }, delRes);
            assert.equal(delRes.statusCode, 403);

            // Also fails closed for assigned products when unauthenticated
            const assignedReadRes = createMockRes();
            await sellerProductById({ ...noAuthReq, params: { id: seller1AssignedProductId } }, assignedReadRes);
            assert.equal(assignedReadRes.statusCode, 403);
        });

        // 10. Legitimate admin and seller cases continue to pass as expected
        it('10. Legitimate admin and seller cases continue to pass as expected', async () => {
            // Admin can delete legacy product
            const adminReq = {
                sellerId: ADMIN_SELLER_EMAIL,
                sellerEmail: ADMIN_SELLER_EMAIL,
                body: { id: legacyProductId }
            };
            const adminDelRes = createMockRes();
            await deleteProduct(adminReq, adminDelRes);
            assert.equal(adminDelRes.statusCode, 200);
            assert.equal(productStore.has(legacyProductId), false);

            // Seller can delete their own product
            const sellerReq = {
                sellerId: SELLER_2_ID,
                sellerEmail: 'seller2@example.com',
                body: { id: seller2AssignedProductId }
            };
            const sellerDelRes = createMockRes();
            await deleteProduct(sellerReq, sellerDelRes);
            assert.equal(sellerDelRes.statusCode, 200);
            assert.equal(productStore.has(seller2AssignedProductId), false);

            // Public productById remains accessible to customers without auth
            const publicRes = createMockRes();
            await productById({ params: { id: seller1AssignedProductId } }, publicRes);
            assert.equal(publicRes.statusCode, 200);
            assert.equal(publicRes.body.product._id, seller1AssignedProductId);
        });

        // 11. buildProductQuery() does NOT grant legacy product visibility to tenant seller with sellerId: 'admin' unless their authenticated email matches process.env.SELLER_EMAIL
        it('11. buildProductQuery() does NOT grant legacy product visibility to tenant seller with sellerId: \'admin\' unless email matches SELLER_EMAIL', () => {
            const legacyDoc = { _id: 'legacy_doc_1', name: 'Legacy Item', sellerId: null };

            // Tenant seller with sellerId: 'admin' and non-admin email
            const queryNonAdmin = buildProductQuery({}, 'admin', 'attacker@custom-domain.com');
            assert.deepEqual(queryNonAdmin, { sellerId: 'admin' });
            assert.equal(matchesDoc(legacyDoc, queryNonAdmin), false);

            // Tenant seller with sellerId: 'admin' and missing email
            const queryNoEmail = buildProductQuery({}, 'admin', null);
            assert.deepEqual(queryNoEmail, { sellerId: 'admin' });
            assert.equal(matchesDoc(legacyDoc, queryNoEmail), false);
        });

        // 12. Admin inventory queries continue to include legacy products
        it('12. Admin inventory queries continue to include legacy products', () => {
            const legacyDoc1 = { _id: 'legacy_doc_1', name: 'Legacy Item 1', sellerId: null };
            const legacyDoc2 = { _id: 'legacy_doc_2', name: 'Legacy Item 2' }; // missing sellerId
            const adminDoc = { _id: 'admin_doc_3', name: 'Admin Item', sellerId: ADMIN_SELLER_EMAIL };
            const otherDoc = { _id: 'other_doc_4', name: 'Other Item', sellerId: SELLER_1_ID };

            // Query with admin sellerId and matching sellerEmail
            const queryAdmin = buildProductQuery({}, ADMIN_SELLER_EMAIL, ADMIN_SELLER_EMAIL);
            assert.ok(queryAdmin.$or);
            assert.equal(matchesDoc(legacyDoc1, queryAdmin), true);
            assert.equal(matchesDoc(legacyDoc2, queryAdmin), true);
            assert.equal(matchesDoc(adminDoc, queryAdmin), true);
            assert.equal(matchesDoc(otherDoc, queryAdmin), false);
        });
    });

    // 21. Final Admin Authorization Tightening — Strict Token Email Verification Suite
    describe('21. Final Admin Authorization Tightening — Strict Token Email Verification Suite', () => {
        let legacyProductId;
        let sellerAssignedProductId;

        beforeEach(async () => {
            // Seed a legacy unassigned product (sellerId: null)
            const pLegacy = await Product.create({
                name: 'Legacy Unassigned Almonds Batch 7.3 Final',
                description: ['Raw unassigned almonds'],
                category: 'Pantry',
                price: 150,
                offerPrice: 140,
                image: ['https://res.cloudinary.com/test-cloud/image/upload/v12345/almonds.jpg'],
                stockQuantity: 50,
                inStock: true,
                sellerId: null
            });
            legacyProductId = pLegacy._id;

            // Seed a product assigned to Seller 1
            const pAssigned = await Product.create({
                name: 'Seller 1 Assigned Pistachios Batch 7.3 Final',
                description: ['Assigned pistachios'],
                category: 'Pantry',
                price: 200,
                offerPrice: 180,
                image: ['https://res.cloudinary.com/test-cloud/image/upload/v12345/pistachios.jpg'],
                stockQuantity: 25,
                inStock: true,
                sellerId: SELLER_1_ID
            });
            sellerAssignedProductId = pAssigned._id;
        });

        // 1. Tenant JWT with id: process.env.SELLER_EMAIL and a different email cannot access legacy products
        it('1. Tenant JWT with id: process.env.SELLER_EMAIL and different email cannot access legacy products (403 Forbidden)', async () => {
            const tenantToken = createValidToken({ id: ADMIN_SELLER_EMAIL, email: 'attacker@normal-seller.com' });
            const req = {
                cookies: { sellerToken: tenantToken },
                params: { id: legacyProductId },
                body: { id: legacyProductId, price: 999, inStock: false }
            };
            const res = createMockRes();

            let nextCalled = false;
            await authSeller(req, res, () => { nextCalled = true; });
            assert.equal(nextCalled, true);
            assert.equal(req.sellerId, ADMIN_SELLER_EMAIL);
            assert.equal(req.sellerEmail, 'attacker@normal-seller.com');

            // Attempt read
            const readRes = createMockRes();
            await sellerProductById(req, readRes);
            assert.equal(readRes.statusCode, 403);
            assert.equal(readRes.body.success, false);
            assert.match(readRes.body.message, /Forbidden/i);

            // Attempt update
            const updateRes = createMockRes();
            await updateProduct(req, updateRes);
            assert.equal(updateRes.statusCode, 403);
            assert.equal(updateRes.body.success, false);

            // Attempt stock toggle
            const stockRes = createMockRes();
            await changeStock(req, stockRes);
            assert.equal(stockRes.statusCode, 403);
            assert.equal(stockRes.body.success, false);

            // Attempt delete
            const delRes = createMockRes();
            await deleteProduct(req, delRes);
            assert.equal(delRes.statusCode, 403);
            assert.equal(delRes.body.success, false);
            assert.ok(productStore.has(legacyProductId));
        });

        // 2. Tenant JWT with sellerId: process.env.SELLER_EMAIL and a different email cannot access legacy products
        it('2. Tenant JWT with sellerId: process.env.SELLER_EMAIL and different email cannot access legacy products (403 Forbidden)', async () => {
            const tenantToken = createValidToken({ sellerId: ADMIN_SELLER_EMAIL, email: 'attacker@normal-seller.com' });
            const req = {
                cookies: { sellerToken: tenantToken },
                params: { id: legacyProductId },
                body: { id: legacyProductId, price: 888, inStock: false }
            };
            const res = createMockRes();

            let nextCalled = false;
            await authSeller(req, res, () => { nextCalled = true; });
            assert.equal(nextCalled, true);
            assert.equal(req.sellerId, ADMIN_SELLER_EMAIL);
            assert.equal(req.sellerEmail, 'attacker@normal-seller.com');

            // Attempt read
            const readRes = createMockRes();
            await sellerProductById(req, readRes);
            assert.equal(readRes.statusCode, 403);
            assert.equal(readRes.body.success, false);
            assert.match(readRes.body.message, /Forbidden/i);

            // Attempt update
            const updateRes = createMockRes();
            await updateProduct(req, updateRes);
            assert.equal(updateRes.statusCode, 403);
            assert.equal(updateRes.body.success, false);

            // Attempt stock toggle
            const stockRes = createMockRes();
            await changeStock(req, stockRes);
            assert.equal(stockRes.statusCode, 403);
            assert.equal(stockRes.body.success, false);

            // Attempt delete
            const delRes = createMockRes();
            await deleteProduct(req, delRes);
            assert.equal(delRes.statusCode, 403);
            assert.equal(delRes.body.success, false);
            assert.ok(productStore.has(legacyProductId));
        });

        // 3. Genuine admin JWT through authSeller middleware continues to access and manage legacy products (200 OK)
        it('3. Genuine admin JWT through authSeller middleware continues to access and manage legacy products (200 OK)', async () => {
            const adminToken = createValidToken({ email: ADMIN_SELLER_EMAIL });
            const req = {
                cookies: { sellerToken: adminToken },
                params: { id: legacyProductId },
                body: { id: legacyProductId, name: 'Renamed by Verified Admin', inStock: false }
            };
            const res = createMockRes();

            let nextCalled = false;
            await authSeller(req, res, () => { nextCalled = true; });
            assert.equal(nextCalled, true);
            assert.equal(req.sellerId, ADMIN_SELLER_EMAIL);
            assert.equal(req.sellerEmail, ADMIN_SELLER_EMAIL);

            // Can read
            const readRes = createMockRes();
            await sellerProductById(req, readRes);
            assert.equal(readRes.statusCode, 200);
            assert.equal(readRes.body.product._id, legacyProductId);

            // Can update
            const updateRes = createMockRes();
            await updateProduct(req, updateRes);
            assert.equal(updateRes.statusCode, 200);
            assert.equal(productStore.get(legacyProductId).name, 'Renamed by Verified Admin');

            // Can toggle stock
            const stockRes = createMockRes();
            await changeStock(req, stockRes);
            assert.equal(stockRes.statusCode, 200);
            assert.equal(productStore.get(legacyProductId).inStock, false);
        });

        // 4. buildProductQuery() does NOT grant legacy product visibility when sellerId equals adminEmail but sellerEmail does not
        it('4. buildProductQuery() does NOT grant legacy visibility when sellerId matches adminEmail but sellerEmail does not', () => {
            const legacyDoc = { _id: 'legacy_doc_1', name: 'Legacy Item', sellerId: null };

            // Tenant seller whose sellerId happens to match ADMIN_SELLER_EMAIL but email does not
            const queryMismatch = buildProductQuery({}, ADMIN_SELLER_EMAIL, 'attacker@custom-domain.com');
            assert.deepEqual(queryMismatch, { sellerId: ADMIN_SELLER_EMAIL });
            assert.equal(matchesDoc(legacyDoc, queryMismatch), false);
        });

        // 5. buildProductQuery() continues to grant legacy product visibility when sellerEmail strictly matches adminEmail
        it('5. buildProductQuery() continues to grant legacy product visibility when sellerEmail strictly matches adminEmail', () => {
            const legacyDoc1 = { _id: 'legacy_doc_1', name: 'Legacy Item 1', sellerId: null };
            const legacyDoc2 = { _id: 'legacy_doc_2', name: 'Legacy Item 2' };
            const adminDoc = { _id: 'admin_doc_3', name: 'Admin Item', sellerId: ADMIN_SELLER_EMAIL };

            const queryAdmin = buildProductQuery({}, ADMIN_SELLER_EMAIL, ADMIN_SELLER_EMAIL);
            assert.ok(queryAdmin.$or);
            assert.equal(matchesDoc(legacyDoc1, queryAdmin), true);
            assert.equal(matchesDoc(legacyDoc2, queryAdmin), true);
            assert.equal(matchesDoc(adminDoc, queryAdmin), true);
        });

        // 6. Normal seller ownership and default-deny behavior remain intact
        it('6. Normal seller ownership and default-deny behavior remain intact', async () => {
            // Owner can manage own product
            const ownerReq = {
                sellerId: SELLER_1_ID,
                sellerEmail: 'seller1@example.com',
                params: { id: sellerAssignedProductId }
            };
            const ownerRes = createMockRes();
            await sellerProductById(ownerReq, ownerRes);
            assert.equal(ownerRes.statusCode, 200);

            // Mismatched seller is denied (403)
            const otherSellerReq = {
                sellerId: SELLER_2_ID,
                sellerEmail: 'seller2@example.com',
                params: { id: sellerAssignedProductId }
            };
            const otherSellerRes = createMockRes();
            await sellerProductById(otherSellerReq, otherSellerRes);
            assert.equal(otherSellerRes.statusCode, 403);

            // Direct invocation with no seller identity is denied (403 / default-deny)
            const noAuthRes = createMockRes();
            await sellerProductById({ params: { id: sellerAssignedProductId } }, noAuthRes);
            assert.equal(noAuthRes.statusCode, 403);
        });
    });
});
