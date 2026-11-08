import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { v2 as cloudinary } from 'cloudinary';
import Product from '../models/Product.js';
import { updateProduct, deleteProduct, extractCloudinaryPublicId } from '../controllers/productController.js';
import authSeller from '../middlewares/authSeller.js';

describe('GreenCart Product Security & Mutation Suite', () => {
    const validProductId = '507f1f77bcf86cd799439011';
    const missingProductId = '507f1f77bcf86cd799439099';
    const raceConditionProductId = '507f1f77bcf86cd799439088';

    let productStore;
    let origSellerEmail;
    let origFindById;
    let origFindByIdAndUpdate;
    let origFindByIdAndDelete;
    let origDestroy;
    let destroyedPublicIds;
    let destroyError;

    beforeEach(() => {
        origSellerEmail = process.env.SELLER_EMAIL;
        process.env.SELLER_EMAIL = process.env.SELLER_EMAIL || 'admin_seller@greencart.com';
        productStore = new Map();
        destroyedPublicIds = [];
        destroyError = null;
        origDestroy = cloudinary.uploader.destroy;
        cloudinary.uploader.destroy = async (publicId) => {
            if (destroyError) {
                throw destroyError;
            }
            destroyedPublicIds.push(publicId);
            return { result: 'ok' };
        };

        productStore.set(validProductId, {
            _id: validProductId,
            name: 'Organic Apples',
            description: ['Fresh organic apples', 'Rich in fiber'],
            category: 'Fresh Fruits',
            price: 60,
            offerPrice: 50,
            inStock: true,
            image: ['https://example.com/apple1.jpg', 'https://example.com/apple2.jpg'],
            createdAt: new Date('2025-01-01'),
            updatedAt: new Date('2025-01-01')
        });

        productStore.set(raceConditionProductId, {
            _id: raceConditionProductId,
            name: 'Transient Product',
            description: ['Exists during initial lookup but deleted concurrently'],
            category: 'Bakery',
            price: 20,
            offerPrice: 15,
            inStock: true,
            image: ['https://example.com/transient.jpg']
        });

        origFindById = Product.findById;
        origFindByIdAndUpdate = Product.findByIdAndUpdate;
        origFindByIdAndDelete = Product.findByIdAndDelete;

        Product.findById = async (id) => {
            const doc = productStore.get(String(id));
            return doc ? { ...doc } : null;
        };

        Product.findByIdAndUpdate = async (id, updateOp, options) => {
            // Simulate concurrent deletion race if target is raceConditionProductId
            if (String(id) === raceConditionProductId) {
                return null;
            }
            const doc = productStore.get(String(id));
            if (!doc) return null;
            const updates = updateOp.$set || updateOp;
            const updated = { ...doc, ...updates };
            productStore.set(String(id), updated);
            return updated;
        };

        Product.findByIdAndDelete = async (id) => {
            const doc = productStore.get(String(id));
            if (!doc) return null;
            productStore.delete(String(id));
            return doc;
        };
    });

    afterEach(() => {
        cloudinary.uploader.destroy = origDestroy;
        Product.findById = origFindById;
        Product.findByIdAndUpdate = origFindByIdAndUpdate;
        Product.findByIdAndDelete = origFindByIdAndDelete;
        process.env.SELLER_EMAIL = origSellerEmail;
    });

    const createMockRes = () => {
        const res = {
            statusCode: 200,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.body = payload;
                return this;
            }
        };
        return res;
    };

    // 1. Seller Authentication Enforcement
    it('1. authSeller rejects unauthenticated requests with 401 when sellerToken is missing', async () => {
        const req = { cookies: {} };
        const res = createMockRes();
        let nextCalled = false;
        await authSeller(req, res, () => { nextCalled = true; });

        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 401);
        assert.equal(res.body.success, false);
        assert.equal(res.body.message, 'Not Authorized');
    });

    // 2. ID Validation
    it('2. updateProduct rejects malformed or non-ObjectId product IDs with 400', async () => {
        const req = { body: { id: 'invalid-hex-id', name: 'Valid Name' } };
        const res = createMockRes();
        await updateProduct(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /Invalid product ID/i);
    });

    it('3. updateProduct returns 404 when product does not exist', async () => {
        const req = { body: { id: missingProductId, name: 'Valid Name' } };
        const res = createMockRes();
        await updateProduct(req, res);

        assert.equal(res.statusCode, 404);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /Product not found/i);
    });

    // 3. Race Condition Handling
    it('4. updateProduct returns 404 when product is deleted during findByIdAndUpdate race condition', async () => {
        const req = {
            body: { id: raceConditionProductId, name: 'Concurrent Edit' },
            sellerEmail: process.env.SELLER_EMAIL,
            sellerId: process.env.SELLER_EMAIL
        };
        const res = createMockRes();
        await updateProduct(req, res);

        assert.equal(res.statusCode, 404);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /Product not found/i);
    });

    // 4. Input Validation
    it('5. updateProduct rejects empty or non-string name with 400', async () => {
        const req = {
            body: { id: validProductId, name: '   ' },
            sellerEmail: process.env.SELLER_EMAIL,
            sellerId: process.env.SELLER_EMAIL
        };
        const res = createMockRes();
        await updateProduct(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /Product name/i);
    });

    it('6. updateProduct rejects invalid or negative prices with 400', async () => {
        const req = {
            body: { id: validProductId, price: -5 },
            sellerEmail: process.env.SELLER_EMAIL,
            sellerId: process.env.SELLER_EMAIL
        };
        const res = createMockRes();
        await updateProduct(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /Invalid product price/i);
    });

    it('7. updateProduct rejects invalid inStock values with 400', async () => {
        const req = {
            body: { id: validProductId, inStock: 'yes' },
            sellerEmail: process.env.SELLER_EMAIL,
            sellerId: process.env.SELLER_EMAIL
        };
        const res = createMockRes();
        await updateProduct(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /Invalid inStock/i);
    });

    // 5. Allowlist & Protected Field Protection
    it('8. updateProduct updates only allowlisted fields and strictly protects _id, createdAt, and injected fields', async () => {
        const req = {
            body: {
                id: validProductId,
                name: 'Premium Organic Apples',
                price: 75,
                offerPrice: 65,
                category: 'Organic Fruits',
                description: ['Updated description point 1', 'Point 2'],
                _id: '507f1f77bcf86cd799439099', // must NOT overwrite
                createdAt: new Date('2020-01-01'), // must NOT overwrite
                admin: true // must NOT inject
            },
            sellerEmail: process.env.SELLER_EMAIL,
            sellerId: process.env.SELLER_EMAIL
        };
        const res = createMockRes();
        await updateProduct(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.product.name, 'Premium Organic Apples');
        assert.equal(res.body.product.price, 75);
        assert.equal(res.body.product.offerPrice, 65);
        assert.equal(res.body.product.category, 'Organic Fruits');
        assert.deepEqual(res.body.product.description, ['Updated description point 1', 'Point 2']);
        assert.equal(res.body.product._id, validProductId); // Protected!
        assert.equal(res.body.product.admin, undefined); // Dropped!
        assert.deepEqual(res.body.product.image, ['https://example.com/apple1.jpg', 'https://example.com/apple2.jpg']); // Preserved!
    });

    it('9. updateProduct rejects updates with zero allowlisted fields with 400', async () => {
        const req = {
            body: {
                id: validProductId,
                _id: '507f1f77bcf86cd799439099',
                admin: true,
                arbitraryField: 'value'
            },
            sellerEmail: process.env.SELLER_EMAIL,
            sellerId: process.env.SELLER_EMAIL
        };
        const res = createMockRes();
        await updateProduct(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /No valid fields/i);
    });

    // 6. Slot Metadata Validation
    it('10. updateProduct rejects malformed slotIndices with 400', async () => {
        const req = {
            body: {
                id: validProductId,
                name: 'Apples',
                slotIndices: '0' // Non-array
            },
            files: [{ path: 'temp.jpg' }],
            sellerEmail: process.env.SELLER_EMAIL,
            sellerId: process.env.SELLER_EMAIL
        };
        const res = createMockRes();
        await updateProduct(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /Invalid image slot metadata/i);
    });

    it('11. updateProduct rejects out-of-bounds or duplicate slot indices with 400', async () => {
        const reqDuplicate = {
            body: {
                id: validProductId,
                name: 'Apples',
                slotIndices: [1, 1] // Duplicate slot
            },
            files: [{ path: 'temp1.jpg' }, { path: 'temp2.jpg' }],
            sellerEmail: process.env.SELLER_EMAIL,
            sellerId: process.env.SELLER_EMAIL
        };
        const resDuplicate = createMockRes();
        await updateProduct(reqDuplicate, resDuplicate);

        assert.equal(resDuplicate.statusCode, 400);
        assert.equal(resDuplicate.body.success, false);
        assert.match(resDuplicate.body.message, /Duplicate image slot index/i);

        const reqOutOfBounds = {
            body: {
                id: validProductId,
                name: 'Apples',
                slotIndices: [4] // Slot > 3
            },
            files: [{ path: 'temp1.jpg' }],
            sellerEmail: process.env.SELLER_EMAIL,
            sellerId: process.env.SELLER_EMAIL
        };
        const resOutOfBounds = createMockRes();
        await updateProduct(reqOutOfBounds, resOutOfBounds);

        assert.equal(resOutOfBounds.statusCode, 400);
        assert.equal(resOutOfBounds.body.success, false);
        assert.match(resOutOfBounds.body.message, /Invalid image slot index/i);
    });

    // 7. Deletion Safety
    it('12. deleteProduct rejects malformed product ID with 400', async () => {
        const req = { body: { id: 'not-an-objectid' } };
        const res = createMockRes();
        await deleteProduct(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /Invalid product ID/i);
    });

    it('13. deleteProduct returns 404 when product to delete does not exist', async () => {
        const req = { body: { id: missingProductId } };
        const res = createMockRes();
        await deleteProduct(req, res);

        assert.equal(res.statusCode, 404);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /Product not found/i);
    });

    it('14. deleteProduct deletes exactly one product by ID and leaves other products untouched', async () => {
        const initialCount = productStore.size;
        const req = {
            body: { id: validProductId },
            sellerEmail: process.env.SELLER_EMAIL,
            sellerId: process.env.SELLER_EMAIL
        };
        const res = createMockRes();
        await deleteProduct(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(productStore.has(validProductId), false);
        assert.equal(productStore.has(raceConditionProductId), true);
        assert.equal(productStore.size, initialCount - 1);
    });

    // 8. Cloudinary Image Cleanup on Deletion (Batch 10B.1)
    it('15. deleteProduct cleans up multiple associated Cloudinary image assets on successful deletion', async () => {
        const cloudinaryProductId = '507f1f77bcf86cd799439077';
        productStore.set(cloudinaryProductId, {
            _id: cloudinaryProductId,
            name: 'Cloudinary Product',
            price: 50,
            offerPrice: 45,
            inStock: true,
            image: [
                'https://res.cloudinary.com/greencart/image/upload/v1700000001/products/apple_front.jpg',
                'https://res.cloudinary.com/greencart/image/upload/v1700000002/products/apple_back.png'
            ]
        });

        const req = {
            body: { id: cloudinaryProductId },
            sellerEmail: process.env.SELLER_EMAIL,
            sellerId: process.env.SELLER_EMAIL
        };
        const res = createMockRes();
        await deleteProduct(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(productStore.has(cloudinaryProductId), false);

        // Verify all valid Cloudinary public IDs were submitted to destroy
        assert.equal(destroyedPublicIds.length, 2);
        assert.deepEqual(destroyedPublicIds, ['products/apple_front', 'products/apple_back']);
    });

    it('16. deleteProduct safely ignores non-Cloudinary or malformed image URLs without calling destroy', async () => {
        const mixedUrlsProductId = '507f1f77bcf86cd799439066';
        productStore.set(mixedUrlsProductId, {
            _id: mixedUrlsProductId,
            name: 'Mixed URL Product',
            price: 30,
            offerPrice: 25,
            inStock: true,
            image: [
                'https://example.com/external-image.jpg', // Non-Cloudinary host
                'not-a-valid-url',                        // Malformed URL
                null,                                     // Null entry
                'https://res.cloudinary.com/greencart/raw/upload/v123/doc.pdf', // Non-image upload
                'https://res.cloudinary.com/greencart/image/upload/v1700000005/valid_banner.webp' // Valid Cloudinary
            ]
        });

        const req = {
            body: { id: mixedUrlsProductId },
            sellerEmail: process.env.SELLER_EMAIL,
            sellerId: process.env.SELLER_EMAIL
        };
        const res = createMockRes();
        await deleteProduct(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(productStore.has(mixedUrlsProductId), false);

        // Only the genuine Cloudinary image asset should be passed to destroy
        assert.equal(destroyedPublicIds.length, 1);
        assert.equal(destroyedPublicIds[0], 'valid_banner');
    });

    it('17. deleteProduct succeeds and returns 200 even when Cloudinary cleanup throws', async () => {
        const errorProductId = '507f1f77bcf86cd799439055';
        productStore.set(errorProductId, {
            _id: errorProductId,
            name: 'Error Cleanup Product',
            price: 40,
            offerPrice: 35,
            inStock: true,
            image: ['https://res.cloudinary.com/greencart/image/upload/v1700000010/will_fail.jpg']
        });

        // Simulate Cloudinary API failure
        destroyError = new Error('Cloudinary API connection error');

        const req = {
            body: { id: errorProductId },
            sellerEmail: process.env.SELLER_EMAIL,
            sellerId: process.env.SELLER_EMAIL
        };
        const res = createMockRes();
        await deleteProduct(req, res);

        // Must still succeed and delete from DB without reporting false failure
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.match(res.body.message, /Product deleted successfully/i);
        assert.equal(productStore.has(errorProductId), false);
    });

    it('18. extractCloudinaryPublicId correctly extracts public IDs from diverse Cloudinary URLs and safely rejects non-Cloudinary/malformed inputs', () => {
        // Standard versioned URL
        assert.equal(
            extractCloudinaryPublicId('https://res.cloudinary.com/demo/image/upload/v1570979139/sample.jpg'),
            'sample'
        );

        // URL with subfolders
        assert.equal(
            extractCloudinaryPublicId('https://res.cloudinary.com/demo/image/upload/v1570979139/products/shoes/item_1.png'),
            'products/shoes/item_1'
        );

        // URL with transformations and version
        assert.equal(
            extractCloudinaryPublicId('https://res.cloudinary.com/demo/image/upload/c_scale,w_500/v123/greencart/sample.jpg'),
            'greencart/sample'
        );

        // URL without version prefix
        assert.equal(
            extractCloudinaryPublicId('https://res.cloudinary.com/demo/image/upload/simple_item.webp'),
            'simple_item'
        );

        // URL with query parameters
        assert.equal(
            extractCloudinaryPublicId('https://res.cloudinary.com/demo/image/upload/v123/item.jpg?auto=format'),
            'item'
        );

        // Non-Cloudinary domains must return null
        assert.equal(extractCloudinaryPublicId('https://example.com/image/upload/v123/sample.jpg'), null);
        assert.equal(extractCloudinaryPublicId('https://attacker-cloudinary.com/image/upload/v123/sample.jpg'), null);

        // Non-image upload path must return null
        assert.equal(extractCloudinaryPublicId('https://res.cloudinary.com/demo/raw/upload/v123/sample.pdf'), null);

        // Non-string or malformed inputs must return null
        assert.equal(extractCloudinaryPublicId(''), null);
        assert.equal(extractCloudinaryPublicId('not a url'), null);
        assert.equal(extractCloudinaryPublicId(null), null);
        assert.equal(extractCloudinaryPublicId(undefined), null);
        assert.equal(extractCloudinaryPublicId(12345), null);
    });
});
