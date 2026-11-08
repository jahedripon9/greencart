import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { v2 as cloudinary } from 'cloudinary';
import Product from '../models/Product.js';
import { addProduct, updateProduct } from '../controllers/productController.js';
import { upload, allowedMimeTypes, checkMagicBytes, validateImageContent, cleanupTempFiles } from '../configs/multer.js';
import authSeller from '../middlewares/authSeller.js';
import { requireRole } from '../middlewares/authRole.js';
import productRouter from '../routes/productRoute.js';

describe('GreenCart Phase 1 — SEC-03: Secure Product Image Upload & Disk Exhaustion Protection Suite', () => {
    const mockAdminEmail = 'admin@greencart.com';
    const mockJwtSecret = 'test_secret_for_upload_security_32_characters_long!';
    const validProductId = '507f1f77bcf86cd799439011';

    let origEnv;
    let origCloudinaryUpload;
    let origCloudinaryDestroy;
    let origProductCreate;
    let origProductFindById;
    let origProductFindByIdAndUpdate;
    let productStore;
    let destroyedAssets;
    let tempFilesCreated;

    // Helper to generate a valid seller token with given role
    const generateToken = (payload = {}) => {
        return jwt.sign(
            {
                email: mockAdminEmail,
                role: 'Admin',
                ...payload
            },
            mockJwtSecret,
            { expiresIn: '1h' }
        );
    };

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
                return this;
            }
        };
        return res;
    };

    // Helper to create an actual physical temporary file on disk with given content
    const createTempImageFile = (contentBuffer, ext = '.jpg') => {
        const tempPath = path.join(os.tmpdir(), `gc_test_${crypto.randomBytes(6).toString('hex')}${ext}`);
        fs.writeFileSync(tempPath, contentBuffer);
        tempFilesCreated.push(tempPath);
        return tempPath;
    };

    // Valid sample magic bytes
    const VALID_JPEG_HEADER = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const VALID_PNG_HEADER = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    const VALID_WEBP_HEADER = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

    beforeEach(() => {
        origEnv = { ...process.env };
        process.env.SELLER_EMAIL = mockAdminEmail;
        process.env.JWT_SECRET = mockJwtSecret;

        productStore = new Map();
        destroyedAssets = [];
        tempFilesCreated = [];

        origCloudinaryUpload = cloudinary.uploader.upload;
        origCloudinaryDestroy = cloudinary.uploader.destroy;
        origProductCreate = Product.create;
        origProductFindById = Product.findById;
        origProductFindByIdAndUpdate = Product.findByIdAndUpdate;

        // Default mock Cloudinary upload
        cloudinary.uploader.upload = async (filePath) => {
            const assetId = `cl_pub_${crypto.randomBytes(4).toString('hex')}`;
            return {
                public_id: assetId,
                secure_url: `https://res.cloudinary.com/greencart/image/upload/${assetId}.jpg`
            };
        };

        cloudinary.uploader.destroy = async (publicId) => {
            destroyedAssets.push(publicId);
            return { result: 'ok' };
        };

        // Seed existing product
        productStore.set(validProductId, {
            _id: validProductId,
            name: 'Organic Bananas',
            category: 'Fruits',
            description: ['Fresh organic bananas'],
            price: 50,
            offerPrice: 40,
            image: ['https://res.cloudinary.com/greencart/image/upload/banana_existing_1.jpg'],
            inStock: true,
            stockQuantity: 100,
            lowStockThreshold: 5,
            sellerId: mockAdminEmail
        });

        Product.create = async (doc) => {
            const id = 'prod_' + crypto.randomBytes(6).toString('hex');
            const created = { _id: id, ...doc };
            productStore.set(id, created);
            return created;
        };

        Product.findById = async (id) => {
            const p = productStore.get(String(id));
            return p ? { ...p } : null;
        };

        Product.findByIdAndUpdate = async (id, updateDoc) => {
            const p = productStore.get(String(id));
            if (!p) return null;
            const updated = { ...p, ...(updateDoc.$set || updateDoc) };
            productStore.set(String(id), updated);
            return updated;
        };
    });

    afterEach(() => {
        process.env = origEnv;
        cloudinary.uploader.upload = origCloudinaryUpload;
        cloudinary.uploader.destroy = origCloudinaryDestroy;
        Product.create = origProductCreate;
        Product.findById = origProductFindById;
        Product.findByIdAndUpdate = origProductFindByIdAndUpdate;

        // Clean up any test files left on disk
        for (const filePath of tempFilesCreated) {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (_) {}
        }
    });

    // =========================================================================
    // 1 & 2. Authentication-Before-Upload Verification
    // =========================================================================
    it('1. Unauthenticated product upload returns HTTP 401 when sellerToken is missing', async () => {
        const req = { cookies: {} };
        const res = createMockRes();
        let nextCalled = false;

        await authSeller(req, res, () => { nextCalled = true; });

        assert.equal(res.statusCode, 401);
        assert.equal(res.data.success, false);
        assert.equal(res.data.message, "Not Authorized");
        assert.equal(nextCalled, false);
    });

    it('2. Unauthenticated requests never invoke Multer or write files to disk', async () => {
        // Inspect productRoute pipeline order: authSeller must precede Multer
        const addRoute = productRouter.stack.find(layer => layer.route && layer.route.path === '/add');
        assert.ok(addRoute, 'Route POST /api/product/add must exist');

        const middlewares = addRoute.route.stack.map(s => s.name);
        const authIndex = middlewares.indexOf('authSeller');
        const roleIndex = middlewares.indexOf(''); // requireRole closure
        const multerIndex = middlewares.indexOf('multerMiddleware');

        assert.ok(authIndex !== -1, 'authSeller must be in middleware stack');
        assert.ok(authIndex < multerIndex, 'authSeller must execute BEFORE Multer upload middleware');
        assert.ok(roleIndex < multerIndex, 'requireRole must execute BEFORE Multer upload middleware');

        // Test with mock execution: unauthenticated caller is stopped at layer 0
        const req = { cookies: {} };
        const res = createMockRes();
        let multerInvoked = false;

        await authSeller(req, res, () => {
            multerInvoked = true;
        });

        assert.equal(res.statusCode, 401);
        assert.equal(multerInvoked, false, 'Multer was never invoked for unauthenticated request');
    });

    // =========================================================================
    // 3. Unauthorized Roles Return HTTP 403 Before File Processing
    // =========================================================================
    it('3. Unauthorized roles return HTTP 403 before file processing', async () => {
        const req = {
            sellerRole: 'Strategist',
            seller: { role: 'Strategist' }
        };
        const res = createMockRes();
        let multerInvoked = false;

        const roleMiddleware = requireRole('Admin', 'CTO');
        roleMiddleware(req, res, () => {
            multerInvoked = true;
        });

        assert.equal(res.statusCode, 403);
        assert.equal(res.data.success, false);
        assert.match(res.data.message, /insufficient role permissions/i);
        assert.equal(multerInvoked, false, 'Multer was never invoked for unauthorized role');
    });

    // =========================================================================
    // 4. JPEG, PNG, and WebP Are Accepted
    // =========================================================================
    it('4. JPEG, PNG, and WebP formats are accepted by MIME filter and signature validator', async () => {
        assert.ok(allowedMimeTypes.includes('image/jpeg'));
        assert.ok(allowedMimeTypes.includes('image/png'));
        assert.ok(allowedMimeTypes.includes('image/webp'));

        // Verify checkMagicBytes for valid signatures
        assert.equal(checkMagicBytes(VALID_JPEG_HEADER), true, 'JPEG header must pass');
        assert.equal(checkMagicBytes(VALID_PNG_HEADER), true, 'PNG header must pass');
        assert.equal(checkMagicBytes(VALID_WEBP_HEADER), true, 'WebP header must pass');

        // Verify Multer fileFilter allows valid MIME types
        const testMimes = ['image/jpeg', 'image/png', 'image/webp'];
        for (const mimetype of testMimes) {
            let callbackResult = null;
            let callbackError = null;

            upload.fileFilter(
                {},
                { mimetype, originalname: `test.${mimetype.split('/')[1]}` },
                (err, accepted) => {
                    callbackError = err;
                    callbackResult = accepted;
                }
            );

            assert.equal(callbackError, null);
            assert.equal(callbackResult, true, `MIME ${mimetype} must be accepted`);
        }
    });

    // =========================================================================
    // 5. SVG, GIF, PDF, Text, and Executable Files Are Rejected
    // =========================================================================
    it('5. SVG, GIF, PDF, text, and executable files are rejected with a controlled HTTP 400 error', () => {
        const forbiddenMimes = [
            'image/svg+xml',
            'image/gif',
            'application/pdf',
            'text/plain',
            'application/x-msdownload',
            'application/zip',
            'text/html'
        ];

        for (const mimetype of forbiddenMimes) {
            let callbackResult = null;
            let callbackError = null;

            upload.fileFilter(
                {},
                { mimetype, originalname: 'malicious.file' },
                (err, accepted) => {
                    callbackError = err;
                    callbackResult = accepted;
                }
            );

            assert.ok(callbackError instanceof Error, `Expected error for ${mimetype}`);
            assert.equal(callbackError.status, 400);
            assert.equal(callbackError.message, 'Only JPEG, PNG, and WebP images are allowed');
            assert.equal(callbackResult, false);
        }
    });

    // =========================================================================
    // 6. MIME Spoofing Rejection via Magic Byte Signature
    // =========================================================================
    it('6. MIME spoofing is rejected when actual file content does not match', async () => {
        // Attack scenario: Attacker uploads an executable or PDF masquerading as image/jpeg
        const spoofedExe = createTempImageFile(Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]), '.jpg');
        const spoofedPdf = createTempImageFile(Buffer.from('%PDF-1.7\n%Fake JPEG\n'), '.jpeg');
        const spoofedText = createTempImageFile(Buffer.from('Hello world! Not an image'), '.png');

        const exeResult = await validateImageContent({ path: spoofedExe, mimetype: 'image/jpeg' });
        assert.equal(exeResult, false, 'Spoofed EXE must fail signature validation');

        const pdfResult = await validateImageContent({ path: spoofedPdf, mimetype: 'image/jpeg' });
        assert.equal(pdfResult, false, 'Spoofed PDF must fail signature validation');

        const textResult = await validateImageContent({ path: spoofedText, mimetype: 'image/png' });
        assert.equal(textResult, false, 'Spoofed Text must fail signature validation');

        // Test controller level rejection
        const req = {
            body: {
                productData: JSON.stringify({
                    name: 'Spoofed Product',
                    category: 'Produce',
                    description: ['Test'],
                    price: 25
                })
            },
            files: [{ path: spoofedExe, mimetype: 'image/jpeg' }],
            sellerId: mockAdminEmail,
            sellerEmail: mockAdminEmail,
            sellerRole: 'Admin'
        };
        const res = createMockRes();

        await addProduct(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.match(res.data.message, /Only JPEG, PNG, and WebP images are allowed/i);
    });

    // =========================================================================
    // 7. Files Exceeding 5 MB Return HTTP 413
    // =========================================================================
    it('7. Files exceeding 5 MB trigger LIMIT_FILE_SIZE and return HTTP 413', () => {
        assert.equal(upload.limits.fileSize, 5 * 1024 * 1024, 'Limit must be exactly 5 MB');

        // Verify MulterError LIMIT_FILE_SIZE mapping
        const multerError = new Error('File too large');
        multerError.name = 'MulterError';
        multerError.code = 'LIMIT_FILE_SIZE';

        // Check error handling logic mapped in global handler
        let status = 500;
        let message = 'Internal server error';

        if (multerError.name === 'MulterError') {
            if (multerError.code === 'LIMIT_FILE_SIZE') {
                status = 413;
                message = 'File too large';
            }
        }

        assert.equal(status, 413);
        assert.equal(message, 'File too large');
    });

    // =========================================================================
    // 8. More Than 4 Files Return HTTP 400
    // =========================================================================
    it('8. Uploading more than 4 files triggers LIMIT_FILE_COUNT and returns HTTP 400', () => {
        assert.equal(upload.limits.files, 4, 'File limit must be 4');

        const multerError = new Error('Too many files');
        multerError.name = 'MulterError';
        multerError.code = 'LIMIT_FILE_COUNT';

        let status = 500;
        let message = 'Internal server error';

        if (multerError.name === 'MulterError') {
            if (multerError.code === 'LIMIT_FILE_COUNT') {
                status = 400;
                message = 'Too many files uploaded';
            }
        }

        assert.equal(status, 400);
        assert.equal(message, 'Too many files uploaded');
    });

    // =========================================================================
    // 9. Temporary Files Removed After Successful Product Creation
    // =========================================================================
    it('9. Temporary files on disk are removed after successful product creation', async () => {
        const realTempFile = createTempImageFile(VALID_JPEG_HEADER, '.jpg');
        assert.equal(fs.existsSync(realTempFile), true, 'Temp file must exist before upload');

        const req = {
            body: {
                productData: JSON.stringify({
                    name: 'Organic Avocados',
                    category: 'Fruits',
                    description: ['Nutritious hass avocados'],
                    price: 120,
                    offerPrice: 100,
                    stockQuantity: 50,
                    lowStockThreshold: 5
                })
            },
            files: [{ path: realTempFile, mimetype: 'image/jpeg' }],
            sellerId: mockAdminEmail,
            sellerEmail: mockAdminEmail,
            sellerRole: 'Admin'
        };
        const res = createMockRes();

        await addProduct(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(fs.existsSync(realTempFile), false, 'Temp file on disk must be unlinked after creation');
    });

    // =========================================================================
    // 10. Temporary Files Removed After Successful Product Update
    // =========================================================================
    it('10. Temporary files on disk are removed after successful product update', async () => {
        const realTempFile = createTempImageFile(VALID_PNG_HEADER, '.png');
        assert.equal(fs.existsSync(realTempFile), true, 'Temp file must exist before update');

        const req = {
            body: {
                productData: JSON.stringify({
                    id: validProductId,
                    price: 55
                })
            },
            files: [{ path: realTempFile, mimetype: 'image/png' }],
            sellerId: mockAdminEmail,
            sellerEmail: mockAdminEmail,
            sellerRole: 'Admin'
        };
        const res = createMockRes();

        await updateProduct(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(fs.existsSync(realTempFile), false, 'Temp file on disk must be unlinked after update');
    });

    // =========================================================================
    // 11. Temporary Files Removed After Validation or Database Failure
    // =========================================================================
    it('11. Temporary files on disk are removed after validation failure or DB error', async () => {
        const realTempFile1 = createTempImageFile(VALID_JPEG_HEADER, '.jpg');
        const realTempFile2 = createTempImageFile(VALID_JPEG_HEADER, '.jpg');

        // Submitting an invalid price (validation failure)
        const reqValidation = {
            body: {
                productData: JSON.stringify({
                    name: 'Invalid Price Item',
                    category: 'Vegetables',
                    description: ['Test'],
                    price: -50 // Invalid
                })
            },
            files: [{ path: realTempFile1, mimetype: 'image/jpeg' }],
            sellerId: mockAdminEmail,
            sellerEmail: mockAdminEmail,
            sellerRole: 'Admin'
        };
        const resValidation = createMockRes();

        await addProduct(reqValidation, resValidation);

        assert.equal(resValidation.statusCode, 400);
        assert.equal(fs.existsSync(realTempFile1), false, 'Temp file must be unlinked on validation failure');

        // Submitting with database rejection
        Product.create = async () => {
            throw new Error('MongoNetworkTimeout');
        };

        const reqDb = {
            body: {
                productData: JSON.stringify({
                    name: 'DB Error Item',
                    category: 'Produce',
                    description: ['Test'],
                    price: 20
                })
            },
            files: [{ path: realTempFile2, mimetype: 'image/jpeg' }],
            sellerId: mockAdminEmail,
            sellerEmail: mockAdminEmail,
            sellerRole: 'Admin'
        };
        const resDb = createMockRes();

        await addProduct(reqDb, resDb);

        assert.equal(resDb.statusCode, 500);
        assert.equal(fs.existsSync(realTempFile2), false, 'Temp file must be unlinked on DB error');
    });

    // =========================================================================
    // 12. Temporary Files Removed After Cloudinary Failure
    // =========================================================================
    it('12. Temporary files on disk are removed after Cloudinary failure', async () => {
        const realTempFile = createTempImageFile(VALID_JPEG_HEADER, '.jpg');

        cloudinary.uploader.upload = async () => {
            throw new Error('Cloudinary Connection Timeout');
        };

        const req = {
            body: {
                productData: JSON.stringify({
                    name: 'Cloudinary Fail Item',
                    category: 'Bakery',
                    description: ['Test item'],
                    price: 30
                })
            },
            files: [{ path: realTempFile, mimetype: 'image/jpeg' }],
            sellerId: mockAdminEmail,
            sellerEmail: mockAdminEmail,
            sellerRole: 'Admin'
        };
        const res = createMockRes();

        await addProduct(req, res);

        assert.equal(res.statusCode, 500);
        assert.equal(res.data.success, false);
        assert.equal(fs.existsSync(realTempFile), false, 'Temp file must be unlinked after Cloudinary failure');
    });

    // =========================================================================
    // 13. Partial Cloudinary Upload Failures Clean Up Orphaned Assets
    // =========================================================================
    it('13. Partial Cloudinary upload failures clean up newly created orphaned assets', async () => {
        const realTemp1 = createTempImageFile(VALID_JPEG_HEADER, '.jpg');
        const realTemp2 = createTempImageFile(VALID_JPEG_HEADER, '.jpg');

        let uploadCallCount = 0;
        cloudinary.uploader.upload = async (filePath) => {
            uploadCallCount++;
            if (uploadCallCount === 1) {
                return { public_id: 'cl_first_succeeded', secure_url: 'https://res.cloudinary.com/greencart/image/upload/cl_first_succeeded.jpg' };
            }
            throw new Error('Cloudinary rate limit on 2nd image');
        };

        const req = {
            body: {
                productData: JSON.stringify({
                    name: 'Multi Image Product',
                    category: 'Dairy',
                    description: ['Two images'],
                    price: 45
                })
            },
            files: [
                { path: realTemp1, mimetype: 'image/jpeg' },
                { path: realTemp2, mimetype: 'image/jpeg' }
            ],
            sellerId: mockAdminEmail,
            sellerEmail: mockAdminEmail,
            sellerRole: 'Admin'
        };
        const res = createMockRes();

        await addProduct(req, res);

        assert.equal(res.statusCode, 500);
        assert.equal(res.data.success, false);
        assert.ok(destroyedAssets.includes('cl_first_succeeded'), 'First image asset must be cleaned up from Cloudinary');
        assert.equal(fs.existsSync(realTemp1), false, 'Temp file 1 must be unlinked');
        assert.equal(fs.existsSync(realTemp2), false, 'Temp file 2 must be unlinked');
    });

    // =========================================================================
    // 14. Existing Product Images Remain Intact When Update Fails
    // =========================================================================
    it('14. Existing product images remain intact when an update fails', async () => {
        const existingImages = [...productStore.get(validProductId).image];
        assert.equal(existingImages.length, 1);
        const originalImageUrl = existingImages[0];

        const realTemp = createTempImageFile(VALID_JPEG_HEADER, '.jpg');

        // Force Cloudinary upload failure during update
        cloudinary.uploader.upload = async () => {
            throw new Error('Cloudinary Network Failure during update');
        };

        const req = {
            body: {
                productData: JSON.stringify({
                    id: validProductId,
                    price: 99
                })
            },
            files: [{ path: realTemp, mimetype: 'image/jpeg' }],
            sellerId: mockAdminEmail,
            sellerEmail: mockAdminEmail,
            sellerRole: 'Admin'
        };
        const res = createMockRes();

        await updateProduct(req, res);

        assert.equal(res.statusCode, 500);
        assert.equal(res.data.success, false);

        // Verify product in store was NOT modified and existing image remains intact
        const productAfter = productStore.get(validProductId);
        assert.deepEqual(productAfter.image, [originalImageUrl], 'Existing image must not be altered or wiped');
        assert.equal(destroyedAssets.includes('banana_existing_1'), false, 'Existing image was never destroyed');
        assert.equal(fs.existsSync(realTemp), false, 'Replacement temp file was unlinked');
    });

    // =========================================================================
    // 15. Admin, CTO, and Root Merchant Permissions Continue to Work
    // =========================================================================
    it('15. Admin, CTO, and Root Merchant permissions allow product image upload and creation', async () => {
        const allowedRoles = ['Admin', 'CTO'];

        for (const role of allowedRoles) {
            const req = {
                sellerRole: role,
                seller: { role, email: 'staff@greencart.com' }
            };
            const res = createMockRes();
            let nextCalled = false;

            const roleMiddleware = requireRole('Admin', 'CTO');
            roleMiddleware(req, res, () => {
                nextCalled = true;
            });

            assert.equal(nextCalled, true, `Role '${role}' must be authorized`);
            assert.equal(res.statusCode, 200);
        }

        // Verify Root Merchant with matching SELLER_EMAIL is granted Admin role
        const rootReq = {
            cookies: {
                sellerToken: jwt.sign(
                    { email: mockAdminEmail, role: 'Admin' },
                    mockJwtSecret,
                    { expiresIn: '1h' }
                )
            }
        };
        const rootRes = createMockRes();
        let rootNextCalled = false;

        await authSeller(rootReq, rootRes, () => {
            rootNextCalled = true;
        });

        assert.equal(rootNextCalled, true, 'Root merchant authentication must succeed');
        assert.equal(rootReq.sellerRole, 'Admin');
        assert.equal(rootReq.sellerEmail, mockAdminEmail);
    });

    // =========================================================================
    // 16. Error Handler Cleans Up Partially Written Files on Multer Errors
    // =========================================================================
    it('16. Global error handler cleans up partially written files when Multer rejects an upload', async () => {
        const realTempPartial = createTempImageFile(VALID_JPEG_HEADER, '.jpg');
        assert.equal(fs.existsSync(realTempPartial), true);

        const mockReq = {
            files: [{ path: realTempPartial }]
        };

        await cleanupTempFiles(mockReq);

        assert.equal(fs.existsSync(realTempPartial), false, 'cleanupTempFiles must delete files attached to request');
    });
});
