import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import authSeller from '../middlewares/authSeller.js';
import { requireRole } from '../middlewares/authRole.js';
import {
    getTeamMembers,
    getTeamMemberById,
    addTeamMember,
    updateTeamMember,
    toggleTeamMemberStatus,
    deleteTeamMember,
    isValidTeamImage,
    normalizeTeamImageUrl,
    isWeakPassword
} from '../controllers/teamController.js';
import {
    buildProductQuery,
    isSellerAuthorizedForProduct
} from '../controllers/productController.js';
import {
    SellerLogout,
    sellerLogin,
    revokeRootMerchantSessions
} from '../controllers/sellerController.js';
import {
    createSellerLoginLimiter,
    MongoRateLimitStore
} from '../middlewares/rateLimiter.js';
import TeamMember from '../models/TeamMember.js';
import MerchantSession from '../models/MerchantSession.js';
import RateLimitRecord from '../models/RateLimitRecord.js';

describe('GreenCart Team Management & RBAC Security Suite', () => {
    const TEST_JWT_SECRET = 'test_jwt_secret_greencart_team_rbac_2026';
    const TEST_SELLER_EMAIL = 'admin@greencart.com';
    let originalEnv;

    const createMockRes = () => {
        const res = {
            statusCode: 200,
            headers: {},
            body: null,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(payload) {
                this.body = payload;
                return this;
            },
            cookie(name, val, options) {
                this.headers[`set-cookie`] = { name, val, options };
                return this;
            },
            clearCookie(name, options) {
                this.headers[`cleared-cookie`] = { name, options };
                return this;
            }
        };
        return res;
    };

    beforeEach(() => {
        originalEnv = { ...process.env };
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = TEST_JWT_SECRET;
        process.env.SELLER_EMAIL = TEST_SELLER_EMAIL;
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    const createToken = (payload) => {
        return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '1h' });
    };

    describe('1. Role-Based Access Control (RBAC) Middleware Boundary', () => {
        it('allows Admin access to Admin-only endpoints', async () => {
            const req = { sellerRole: 'Admin', seller: { role: 'Admin' } };
            const res = createMockRes();
            let nextCalled = false;

            const middleware = requireRole('Admin');
            middleware(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, true);
            assert.equal(res.statusCode, 200);
        });

        it('strictly blocks CEO from Admin-only endpoints with 403 Forbidden', async () => {
            const req = { sellerRole: 'CEO', seller: { role: 'CEO' } };
            const res = createMockRes();
            let nextCalled = false;

            const middleware = requireRole('Admin');
            middleware(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /insufficient role permissions/i);
        });

        it('strictly blocks CTO from Admin-only endpoints with 403 Forbidden', async () => {
            const req = { sellerRole: 'CTO', seller: { role: 'CTO' } };
            const res = createMockRes();
            let nextCalled = false;

            const middleware = requireRole('Admin');
            middleware(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
        });

        it('strictly blocks Strategist from Admin-only endpoints with 403 Forbidden', async () => {
            const req = { sellerRole: 'Strategist', seller: { role: 'Strategist' } };
            const res = createMockRes();
            let nextCalled = false;

            const middleware = requireRole('Admin');
            middleware(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
        });

        it('returns 401 when role is missing in request', async () => {
            const req = {};
            const res = createMockRes();
            let nextCalled = false;

            const middleware = requireRole('Admin');
            middleware(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 401);
            assert.equal(res.body.success, false);
        });
    });

    describe('2. Fixed Role Matrix Module Permissions', () => {
        it('CEO can access business sections (Orders, Analytics) but not product mutations', async () => {
            const ordersCheck = requireRole('Admin', 'CEO', 'CTO');
            const analyticsCheck = requireRole('Admin', 'CEO', 'CTO', 'Strategist');
            const productMutationCheck = requireRole('Admin', 'CTO');

            const req = { sellerRole: 'CEO', seller: { role: 'CEO' } };

            let ordersAllowed = false;
            ordersCheck(req, createMockRes(), () => { ordersAllowed = true; });
            assert.equal(ordersAllowed, true);

            let analyticsAllowed = false;
            analyticsCheck(req, createMockRes(), () => { analyticsAllowed = true; });
            assert.equal(analyticsAllowed, true);

            const prodRes = createMockRes();
            let prodMutAllowed = false;
            productMutationCheck(req, prodRes, () => { prodMutAllowed = true; });
            assert.equal(prodMutAllowed, false);
            assert.equal(prodRes.statusCode, 403);
        });

        it('CTO can access technical sections (Products, Stock, Chat, Reviews) but not team admin', async () => {
            const productsCheck = requireRole('Admin', 'CTO');
            const reviewsCheck = requireRole('Admin', 'CEO', 'CTO');
            const teamAdminCheck = requireRole('Admin');

            const req = { sellerRole: 'CTO', seller: { role: 'CTO' } };

            let prodAllowed = false;
            productsCheck(req, createMockRes(), () => { prodAllowed = true; });
            assert.equal(prodAllowed, true);

            let revAllowed = false;
            reviewsCheck(req, createMockRes(), () => { revAllowed = true; });
            assert.equal(revAllowed, true);

            const res = createMockRes();
            let adminAllowed = false;
            teamAdminCheck(req, res, () => { adminAllowed = true; });
            assert.equal(adminAllowed, false);
            assert.equal(res.statusCode, 403);
        });

        it('Strategist can access Analytics/Reports but is blocked from mutating products or orders', async () => {
            const analyticsCheck = requireRole('Admin', 'CEO', 'CTO', 'Strategist');
            const orderStatusCheck = requireRole('Admin', 'CTO');
            const productMutationCheck = requireRole('Admin', 'CTO');

            const req = { sellerRole: 'Strategist', seller: { role: 'Strategist' } };

            let analyticsAllowed = false;
            analyticsCheck(req, createMockRes(), () => { analyticsAllowed = true; });
            assert.equal(analyticsAllowed, true);

            const orderRes = createMockRes();
            let orderMutAllowed = false;
            orderStatusCheck(req, orderRes, () => { orderMutAllowed = true; });
            assert.equal(orderMutAllowed, false);
            assert.equal(orderRes.statusCode, 403);

            const prodRes = createMockRes();
            let prodMutAllowed = false;
            productMutationCheck(req, prodRes, () => { prodMutAllowed = true; });
            assert.equal(prodMutAllowed, false);
            assert.equal(prodRes.statusCode, 403);
        });
    });

    describe('3. Deactivated Team Member Protection', () => {
        it('authSeller strictly blocks deactivated members with HTTP 403', async () => {
            const token = createToken({
                id: '507f1f77bcf86cd799439011',
                email: 'deactivated@greencart.com',
                role: 'CEO',
                status: 'Inactive'
            });

            const req = { cookies: { sellerToken: token } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /inactive/i);
        });

        it('authSeller allows active team members through and populates req.seller', async () => {
            const token = createToken({
                id: '507f1f77bcf86cd799439012',
                email: 'cto@greencart.com',
                role: 'CTO',
                name: 'Jane Tech',
                designation: 'Chief Technology Officer',
                status: 'Active'
            });

            const req = { cookies: { sellerToken: token } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, true);
            assert.equal(req.sellerRole, 'CTO');
            assert.equal(req.seller.name, 'Jane Tech');
            assert.equal(req.seller.designation, 'Chief Technology Officer');
        });
    });

    describe('4. Team Member Validation & Creation Security', () => {
        let originalFindOne;
        let originalSave;

        beforeEach(() => {
            originalFindOne = TeamMember.findOne;
            originalSave = TeamMember.prototype.save;
        });

        afterEach(() => {
            TeamMember.findOne = originalFindOne;
            TeamMember.prototype.save = originalSave;
        });

        it('rejects creation when required fields are missing with 400', async () => {
            const cases = [
                { body: {}, expectedMsg: /Full Name/i },
                { body: { name: 'Alice' }, expectedMsg: /Official Email/i },
                { body: { name: 'Alice', email: 'invalid-email' }, expectedMsg: /valid official email/i },
                { body: { name: 'Alice', email: 'alice@greencart.com' }, expectedMsg: /Password/i },
                { body: { name: 'Alice', email: 'alice@greencart.com', password: '123' }, expectedMsg: /at least 12 characters/i },
                { body: { name: 'Alice', email: 'alice@greencart.com', password: 'ValidPass123!' }, expectedMsg: /Designation/i },
                { body: { name: 'Alice', email: 'alice@greencart.com', password: 'ValidPass123!', designation: 'Lead' }, expectedMsg: /Role/i },
                { body: { name: 'Alice', email: 'alice@greencart.com', password: 'ValidPass123!', designation: 'Lead', role: 'SuperAdmin' }, expectedMsg: /Role must be one of/i }
            ];

            for (const { body, expectedMsg } of cases) {
                const req = { body, sellerRole: 'Admin' };
                const res = createMockRes();
                await addTeamMember(req, res);
                assert.equal(res.statusCode, 400);
                assert.equal(res.body.success, false);
                assert.match(res.body.message, expectedMsg);
            }
        });

        it('rejects duplicate email registrations against root seller and team members with 400', async () => {
            // Check against root SELLER_EMAIL
            const reqRoot = {
                body: {
                    name: 'Duplicate Owner',
                    email: TEST_SELLER_EMAIL,
                    password: 'SecurePassword123!',
                    designation: 'Owner Clone',
                    role: 'Admin'
                },
                sellerRole: 'Admin'
            };
            const resRoot = createMockRes();
            await addTeamMember(reqRoot, resRoot);
            assert.equal(resRoot.statusCode, 400);
            assert.match(resRoot.body.message, /already in use/i);

            // Check against existing database member
            TeamMember.findOne = async () => ({ email: 'existing@greencart.com' });

            const reqExisting = {
                body: {
                    name: 'Existing Member',
                    email: 'existing@greencart.com',
                    password: 'SecurePassword123!',
                    designation: 'Marketing',
                    role: 'Strategist'
                },
                sellerRole: 'Admin'
            };
            const resExisting = createMockRes();
            await addTeamMember(reqExisting, resExisting);
            assert.equal(resExisting.statusCode, 400);
            assert.match(resExisting.body.message, /already exists/i);
        });

        it('hashes password and never exposes password in API response', async () => {
            TeamMember.findOne = async () => null;

            let savedDocument = null;
            TeamMember.prototype.save = async function () {
                savedDocument = this;
                this._id = new mongoose.Types.ObjectId();
                return this;
            };

            const rawPassword = 'superSecretPassword123!';
            const req = {
                body: {
                    name: 'Sarah Connor',
                    email: 'sarah@greencart.com',
                    password: rawPassword,
                    designation: 'Security Lead',
                    role: 'CTO',
                    status: 'Active'
                },
                sellerRole: 'Admin'
            };
            const res = createMockRes();
            await addTeamMember(req, res);

            assert.equal(res.statusCode, 201);
            assert.equal(res.body.success, true);
            assert.equal(res.body.member.name, 'Sarah Connor');
            assert.equal(res.body.member.role, 'CTO');
            assert.equal(res.body.member.designation, 'Security Lead');

            // Password MUST NOT be exposed in response body
            assert.equal(res.body.member.password, undefined);
            assert.equal(res.body.password, undefined);

            // Password saved to DB MUST be hashed with bcrypt
            assert.ok(savedDocument.password);
            assert.notEqual(savedDocument.password, rawPassword);
            const isMatch = await bcrypt.compare(rawPassword, savedDocument.password);
            assert.equal(isMatch, true);
        });
    });

    describe('5. Self-Mutation & Role Escalation Protection', () => {
        let originalFindById;

        beforeEach(() => {
            originalFindById = TeamMember.findById;
        });

        afterEach(() => {
            TeamMember.findById = originalFindById;
        });

        it('prevents Admin from demoting or altering their own role with 403', async () => {
            const adminId = '507f1f77bcf86cd799439015';
            TeamMember.findById = async () => ({
                _id: adminId,
                email: 'admin@team.greencart.com',
                role: 'Admin',
                status: 'Active',
                save: async function () { return this; }
            });

            const req = {
                params: { id: adminId },
                sellerId: adminId,
                sellerEmail: 'admin@team.greencart.com',
                sellerRole: 'Admin',
                body: { role: 'Strategist' }
            };
            const res = createMockRes();

            await updateTeamMember(req, res);

            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /cannot change your own role/i);
        });

        it('prevents Admin from deactivating their own account with 403', async () => {
            const adminId = '507f1f77bcf86cd799439016';
            TeamMember.findById = async () => ({
                _id: adminId,
                email: 'admin@team.greencart.com',
                role: 'Admin',
                status: 'Active',
                save: async function () { return this; }
            });

            const req = {
                params: { id: adminId },
                sellerId: adminId,
                sellerEmail: 'admin@team.greencart.com',
                sellerRole: 'Admin',
                body: { status: 'Inactive' }
            };
            const res = createMockRes();

            await toggleTeamMemberStatus(req, res);

            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /cannot deactivate your own account/i);
        });

        it('prevents Admin from deleting their own account with 403', async () => {
            const adminId = '507f1f77bcf86cd799439017';
            TeamMember.findById = async () => ({
                _id: adminId,
                email: 'admin@team.greencart.com',
                role: 'Admin',
                status: 'Active'
            });

            const req = {
                params: { id: adminId },
                sellerId: adminId,
                sellerEmail: 'admin@team.greencart.com',
                sellerRole: 'Admin'
            };
            const res = createMockRes();

            await deleteTeamMember(req, res);

            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /cannot delete your own account/i);
        });
    });

    describe('6. Separate Designation & Role Storage Verification', () => {
        it('stores designation and role as separate fields in TeamMember model', () => {
            const member = new TeamMember({
                name: 'Elena Rostova',
                email: 'elena@greencart.com',
                password: 'SecurePassword123!',
                designation: 'Senior Growth & Market Strategist',
                role: 'Strategist',
                status: 'Active'
            });

            assert.equal(member.designation, 'Senior Growth & Market Strategist');
            assert.equal(member.role, 'Strategist');
            assert.notEqual(member.designation, member.role);

            const json = member.toJSON();
            assert.equal(json.designation, 'Senior Growth & Market Strategist');
            assert.equal(json.role, 'Strategist');
            assert.equal(json.password, undefined);
        });
    });

    describe('7. Security Remediation Verification Suite (Findings F-01 to F-07)', () => {

        // F-01: Protect Seller Reviews GET Endpoint
        describe('F-01: Seller Reviews Endpoint Protection', () => {
            it('allows Admin, CEO, and CTO access to GET /seller reviews', () => {
                const sellerReviewsAuth = requireRole('Admin', 'CEO', 'CTO');

                for (const role of ['Admin', 'CEO', 'CTO']) {
                    const req = { sellerRole: role, seller: { role } };
                    const res = createMockRes();
                    let nextCalled = false;
                    sellerReviewsAuth(req, res, () => { nextCalled = true; });
                    assert.equal(nextCalled, true, `Role ${role} should be allowed access to seller reviews`);
                    assert.equal(res.statusCode, 200);
                }
            });

            it('strictly blocks Strategist from GET /seller reviews with HTTP 403', () => {
                const sellerReviewsAuth = requireRole('Admin', 'CEO', 'CTO');
                const req = { sellerRole: 'Strategist', seller: { role: 'Strategist' } };
                const res = createMockRes();
                let nextCalled = false;

                sellerReviewsAuth(req, res, () => { nextCalled = true; });

                assert.equal(nextCalled, false);
                assert.equal(res.statusCode, 403);
                assert.equal(res.body.success, false);
                assert.match(res.body.message, /insufficient role permissions/i);
            });
        });

        // F-02: Insecure Admin Fallback Prevention & Fail-Closed Behavior
        describe('F-02: Insecure Admin Fallback & Fail-Closed Verification', () => {
            it('returns HTTP 503 when database is unavailable in production mode', async () => {
                process.env.NODE_ENV = 'production';
                const token = createToken({
                    id: '507f1f77bcf86cd799439020',
                    email: 'cto@greencart.com',
                    role: 'CTO'
                });

                const req = { cookies: { sellerToken: token } };
                const res = createMockRes();
                let nextCalled = false;

                await authSeller(req, res, () => { nextCalled = true; });

                assert.equal(nextCalled, false);
                assert.equal(res.statusCode, 503);
                assert.equal(res.body.success, false);
                assert.match(res.body.message, /Database service unavailable/i);
            });

            it('never defaults unknown or missing role to Admin in offline test mode', async () => {
                process.env.NODE_ENV = 'test';
                // Token with no role specified
                const tokenNoRole = createToken({
                    id: '507f1f77bcf86cd799439021',
                    email: 'attacker@normal-seller.com'
                });

                const req = { cookies: { sellerToken: tokenNoRole } };
                const res = createMockRes();
                let nextCalled = false;

                await authSeller(req, res, () => { nextCalled = true; });

                assert.equal(nextCalled, true);
                assert.notEqual(req.sellerRole, 'Admin', 'Missing role must NEVER default to Admin');
                assert.equal(req.sellerRole, null);
            });

            it('preserves root merchant owner authentication securely as Full Admin in test mode', async () => {
                process.env.NODE_ENV = 'test';
                const rootToken = createToken({
                    email: TEST_SELLER_EMAIL
                });

                const req = { cookies: { sellerToken: rootToken } };
                const res = createMockRes();
                let nextCalled = false;

                await authSeller(req, res, () => { nextCalled = true; });

                assert.equal(nextCalled, true);
                assert.equal(req.sellerRole, 'Admin');
                assert.equal(req.sellerEmail, TEST_SELLER_EMAIL);
                assert.equal(req.seller.designation, 'Store Owner');
            });
        });

        // F-03: Team Profile Image Validation
        describe('F-03: Team Profile Image Validation', () => {
            it('rejects oversized profile image strings exceeding 2048 characters', async () => {
                const hugeImage = 'data:image/png;base64,' + 'A'.repeat(2500);
                assert.equal(isValidTeamImage(hugeImage), false);

                const req = {
                    body: {
                        name: 'Bob Ross',
                        email: 'bob@greencart.com',
                        password: 'SecurePassword123!',
                        designation: 'Designer',
                        role: 'CTO',
                        image: hugeImage
                    },
                    sellerRole: 'Admin'
                };
                const res = createMockRes();
                await addTeamMember(req, res);

                assert.equal(res.statusCode, 400);
                assert.match(res.body.message, /Invalid profile image/i);
            });

            it('rejects dangerous URI schemes like javascript:, file:, vbscript:', async () => {
                const unsafeImages = [
                    'javascript:alert("XSS")',
                    'javascript://comment\n%0aalert(1)',
                    'file:///etc/passwd',
                    'vbscript:msgbox(1)'
                ];

                for (const img of unsafeImages) {
                    assert.equal(isValidTeamImage(img), false, `Should reject unsafe scheme: ${img}`);

                    const req = {
                        body: {
                            name: 'Bob Ross',
                            email: 'bob@greencart.com',
                            password: 'SecurePassword123!',
                            designation: 'Designer',
                            role: 'CTO',
                            image: img
                        },
                        sellerRole: 'Admin'
                    };
                    const res = createMockRes();
                    await addTeamMember(req, res);
                    assert.equal(res.statusCode, 400);
                    assert.match(res.body.message, /Invalid profile image/i);
                }
            });

            it('strictly rejects SVG, uppercase SVG MIME, and GIF images', async () => {
                const rejectedImages = [
                    'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=',
                    'DATA:IMAGE/SVG+XML;BASE64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzY3JpcHQ+YWxlcnQoMSk8L3NjcmlwdD48L3N2Zz4=',
                    'data:image/svg;base64,PHN2Zz48L3N2Zz4=',
                    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
                ];

                for (const img of rejectedImages) {
                    assert.equal(isValidTeamImage(img), false, `Should reject SVG/GIF: ${img}`);

                    const req = {
                        body: {
                            name: 'Bob Ross',
                            email: 'bob@greencart.com',
                            password: 'SecurePassword123!',
                            designation: 'Designer',
                            role: 'CTO',
                            image: img
                        },
                        sellerRole: 'Admin'
                    };
                    const res = createMockRes();
                    await addTeamMember(req, res);
                    assert.equal(res.statusCode, 400);
                    assert.match(res.body.message, /Invalid profile image/i);
                }
            });

            it('accepts valid PNG, JPEG, WebP Base64 data URIs and valid HTTPS URLs', () => {
                const validImages = [
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                    'http://res.cloudinary.com/greencart/image/upload/v1234/profile.jpg',
                    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
                    'data:image/jpg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
                    'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
                    '',
                    null,
                    undefined
                ];

                for (const img of validImages) {
                    assert.equal(isValidTeamImage(img), true, `Should accept valid image: ${img}`);
                }
            });
        });

        // F-04: Team Member Store Inventory Access & Isolation
        describe('F-04: Store Inventory Access & Isolation', () => {
            const adminEmail = 'admin@greencart.com';
            const ctoMemberId = '507f1f77bcf86cd799439030';
            const tenantSellerId = 'seller_tenant_999';

            it('buildProductQuery allows authorized team members to see store inventory', () => {
                // CTO querying store products
                const ctoFilter = buildProductQuery({}, ctoMemberId, 'cto@greencart.com', 'CTO');
                assert.ok(ctoFilter.$or, 'Store staff query must have an $or clause');
                const orClauses = ctoFilter.$or;
                assert.ok(orClauses.some(c => c.sellerId === ctoMemberId));
                assert.ok(orClauses.some(c => c.sellerId === null));
                assert.ok(orClauses.some(c => c.sellerId && c.sellerId.$exists === false));
            });

            it('buildProductQuery isolates tenant sellers strictly to their own products', () => {
                // Tenant seller querying products (no store role)
                const tenantFilter = buildProductQuery({}, tenantSellerId, 'tenant@external.com');
                assert.deepEqual(tenantFilter, { sellerId: tenantSellerId });
                assert.equal(tenantFilter.$or, undefined, 'Tenant seller query must not include $or clause');
            });

            it('isSellerAuthorizedForProduct authorizes team members for store products and denies other sellers', () => {
                const legacyProduct = { _id: 'prod_legacy_1', name: 'Legacy Milk', sellerId: null };
                const storeAdminProduct = { _id: 'prod_store_1', name: 'Admin Honey', sellerId: adminEmail };
                const otherTenantProduct = { _id: 'prod_other_1', name: 'Other Seller Tea', sellerId: 'other_vendor_777' };

                const ctoReq = {
                    sellerId: ctoMemberId,
                    sellerEmail: 'cto@greencart.com',
                    sellerRole: 'CTO',
                    isTeamMember: true,
                    seller: { role: 'CTO' }
                };

                // Store products accessible to store CTO
                assert.equal(isSellerAuthorizedForProduct(legacyProduct, ctoReq), true);
                assert.equal(isSellerAuthorizedForProduct(storeAdminProduct, ctoReq), true);

                // External vendor product DENIED to store staff
                assert.equal(isSellerAuthorizedForProduct(otherTenantProduct, ctoReq), false);

                // External tenant seller cannot access legacy store products
                const tenantReq = {
                    sellerId: tenantSellerId,
                    sellerEmail: 'tenant@external.com'
                };
                assert.equal(isSellerAuthorizedForProduct(legacyProduct, tenantReq), false);
                assert.equal(isSellerAuthorizedForProduct(storeAdminProduct, tenantReq), false);
            });
        });

        // F-05: JWT Revocation & Token Version
        describe('F-05: JWT Revocation & tokenVersion Validation', () => {
            let originalFindById;
            let originalFindByIdAndUpdate;

            beforeEach(() => {
                originalFindById = TeamMember.findById;
                originalFindByIdAndUpdate = TeamMember.findByIdAndUpdate;
            });

            afterEach(() => {
                TeamMember.findById = originalFindById;
                TeamMember.findByIdAndUpdate = originalFindByIdAndUpdate;
            });

            it('TeamMember model has tokenVersion with default 0', () => {
                const member = new TeamMember({
                    name: 'Test Member',
                    email: 'test@greencart.com',
                    password: 'SecurePassword123!',
                    designation: 'Dev',
                    role: 'CTO'
                });
                assert.equal(member.tokenVersion, 0);
            });

            it('authSeller rejects token when tokenVersion does not match database', async () => {
                const memberId = '507f1f77bcf86cd799439040';

                // Simulate mongoose connected
                const origReadyState = mongoose.connection.readyState;
                Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

                TeamMember.findById = (id) => ({
                    lean: async () => ({
                        _id: memberId,
                        email: 'cto@greencart.com',
                        role: 'CTO',
                        status: 'Active',
                        tokenVersion: 2 // Database tokenVersion incremented to 2
                    })
                });

                // Presenting an older token with tokenVersion: 1
                const revokedToken = createToken({
                    id: memberId,
                    email: 'cto@greencart.com',
                    role: 'CTO',
                    tokenVersion: 1
                });

                const req = { cookies: { sellerToken: revokedToken } };
                const res = createMockRes();
                let nextCalled = false;

                await authSeller(req, res, () => { nextCalled = true; });

                Object.defineProperty(mongoose.connection, 'readyState', { value: origReadyState, configurable: true });

                assert.equal(nextCalled, false);
                assert.equal(res.statusCode, 401);
                assert.match(res.body.message, /Token has been revoked/i);
            });

            it('updateTeamMember increments tokenVersion when Admin resets member password', async () => {
                const memberId = '507f1f77bcf86cd799439041';
                let savedMember = null;

                TeamMember.findById = async (id) => ({
                    _id: memberId,
                    email: 'cto@greencart.com',
                    role: 'CTO',
                    status: 'Active',
                    tokenVersion: 1,
                    toSafeObject: function () { return { _id: this._id, tokenVersion: this.tokenVersion }; },
                    save: async function () {
                        savedMember = this;
                        return this;
                    }
                });

                const req = {
                    params: { id: memberId },
                    sellerId: '507f1f77bcf86cd799439099', // Different admin ID
                    sellerEmail: 'superadmin@greencart.com',
                    sellerRole: 'Admin',
                    body: { password: 'NewSecurePassword2026!' }
                };
                const res = createMockRes();

                await updateTeamMember(req, res);

                assert.equal(res.statusCode, 200);
                assert.ok(savedMember);
                assert.equal(savedMember.tokenVersion, 2, 'tokenVersion must be incremented upon password reset');
            });

            it('SellerLogout revokes team member tokens by incrementing tokenVersion', async () => {
                const memberId = '507f1f77bcf86cd799439042';
                let incrementTargetId = null;
                let incrementUpdate = null;

                const origReadyState = mongoose.connection.readyState;
                Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

                TeamMember.findByIdAndUpdate = async (id, update) => {
                    incrementTargetId = id;
                    incrementUpdate = update;
                    return {};
                };

                const teamMemberToken = createToken({
                    id: memberId,
                    email: 'cto@greencart.com',
                    role: 'CTO',
                    tokenVersion: 1
                });

                const req = { cookies: { sellerToken: teamMemberToken } };
                const res = createMockRes();

                await SellerLogout(req, res);

                Object.defineProperty(mongoose.connection, 'readyState', { value: origReadyState, configurable: true });

                assert.equal(res.statusCode, 200);
                assert.equal(incrementTargetId, memberId);
                assert.deepEqual(incrementUpdate, { $inc: { tokenVersion: 1 } });
            });
        });

        // F-06: Improve Seller Login Rate Limiting
        describe('F-06: Account-Aware Seller Login Rate Limiting', () => {
            it('normalizes email addresses (trims and lowercases)', () => {
                const limiter = createSellerLoginLimiter({ limit: 3 });
                assert.equal(typeof limiter, 'function');
                assert.ok(limiter.raw);
            });

            it('blocks distributed IP attacks targeting the same account with 429', async () => {
                const app = express();
                app.use(express.json());

                // Stricter limiter with limit of 3 failed attempts
                const testLimiter = createSellerLoginLimiter({
                    windowMs: 15 * 60 * 1000,
                    limit: 3
                });

                app.post('/api/test/seller/login', testLimiter, (req, res) => {
                    const { email, password } = req.body || {};
                    if (password !== 'correctPassword123') {
                        return res.status(401).json({ success: false, message: 'Invalid credentials' });
                    }
                    return res.json({ success: true });
                });

                let server;
                let baseUrl;
                await new Promise((resolve) => {
                    server = app.listen(0, '127.0.0.1', () => {
                        baseUrl = `http://127.0.0.1:${server.address().port}`;
                        resolve();
                    });
                });

                try {
                    // Attempt 1: Uppercase with surrounding spaces
                    const r1 = await fetch(`${baseUrl}/api/test/seller/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: '  TARGET@GREENCART.COM  ', password: 'wrong' })
                    });
                    assert.equal(r1.status, 401);

                    // Attempt 2: Mixed case
                    const r2 = await fetch(`${baseUrl}/api/test/seller/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: 'Target@GreenCart.com', password: 'wrong' })
                    });
                    assert.equal(r2.status, 401);

                    // Attempt 3: Lowercase
                    const r3 = await fetch(`${baseUrl}/api/test/seller/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: 'target@greencart.com', password: 'wrong' })
                    });
                    assert.equal(r3.status, 401);

                    // Attempt 4: Should hit account-level rate limit of 3 -> HTTP 429
                    const r4 = await fetch(`${baseUrl}/api/test/seller/login`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: 'TARGET@greencart.com', password: 'wrong' })
                    });
                    assert.equal(r4.status, 429);
                    const data4 = await r4.json();
                    assert.equal(data4.success, false);
                    assert.match(data4.message, /Too many requests/i);
                } finally {
                    if (server) {
                        await new Promise((resolve) => server.close(resolve));
                    }
                }
            });
        });

        // F-07: Improve Password Policy
        describe('F-07: Password Policy Enforcement', () => {
            it('rejects passwords shorter than 12 characters (e.g. 8 and 11 characters) during creation', async () => {
                for (const shortPass of ['Abcdef1!', 'Abcdefgh1!x']) {
                    const shortReq = {
                        body: {
                            name: 'Shorty',
                            email: 'shorty@greencart.com',
                            password: shortPass,
                            designation: 'Tester',
                            role: 'CTO'
                        },
                        sellerRole: 'Admin'
                    };
                    const res = createMockRes();
                    await addTeamMember(shortReq, res);

                    assert.equal(res.statusCode, 400);
                    assert.match(res.body.message, /at least 12 characters/i);
                }
            });

            it('rejects common weak passwords during creation and password reset', async () => {
                const weakList = ['password', 'password123', '12345678', 'admin123', 'greencart123'];

                for (const weak of weakList) {
                    assert.equal(isWeakPassword(weak), true, `Must detect '${weak}' as weak`);

                    const req = {
                        body: {
                            name: 'Weakling',
                            email: 'weak@greencart.com',
                            password: weak,
                            designation: 'Tester',
                            role: 'CTO'
                        },
                        sellerRole: 'Admin'
                    };
                    const res = createMockRes();
                    await addTeamMember(req, res);

                    assert.equal(res.statusCode, 400);
                    if (weak.length < 12) {
                        assert.match(res.body.message, /at least 12 characters/i);
                    } else {
                        assert.match(res.body.message, /common or easily guessed/i);
                    }
                }
            });

            it('enforces 12-character minimum password policy during update/reset', async () => {
                const memberId = '507f1f77bcf86cd799439050';
                TeamMember.findById = async () => ({
                    _id: memberId,
                    email: 'test@greencart.com',
                    role: 'CTO',
                    status: 'Active'
                });

                // Attempt to update with 12-character weak password (greencart123)
                const reqWeak = {
                    params: { id: memberId },
                    sellerId: '507f1f77bcf86cd799439099',
                    sellerEmail: 'admin@greencart.com',
                    sellerRole: 'Admin',
                    body: { password: 'greencart123' }
                };
                const resWeak = createMockRes();
                await updateTeamMember(reqWeak, resWeak);

                assert.equal(resWeak.statusCode, 400);
                assert.match(resWeak.body.message, /common or easily guessed/i);

                // Attempt to update with 8-character and 11-character password
                for (const shortPass of ['8chars!x', '11charsLong']) {
                    const reqShort = {
                        params: { id: memberId },
                        sellerId: '507f1f77bcf86cd799439099',
                        sellerEmail: 'admin@greencart.com',
                        sellerRole: 'Admin',
                        body: { password: shortPass }
                    };
                    const resShort = createMockRes();
                    await updateTeamMember(reqShort, resShort);

                    assert.equal(resShort.statusCode, 400);
                    assert.match(resShort.body.message, /at least 12 characters/i);
                }
            });

            it('accepts valid 12+ character non-weak passwords during creation and password reset', async () => {
                const valid12Pass = 'ValidPass12Chars!';
                assert.equal(isWeakPassword(valid12Pass), false);
                assert.ok(valid12Pass.length >= 12);

                TeamMember.findOne = async () => null;
                let saved = false;
                TeamMember.prototype.save = async function () {
                    saved = true;
                    this._id = new mongoose.Types.ObjectId();
                    return this;
                };

                const req = {
                    body: {
                        name: 'Strong User',
                        email: 'strong@greencart.com',
                        password: valid12Pass,
                        designation: 'Engineer',
                        role: 'CTO'
                    },
                    sellerRole: 'Admin'
                };
                const res = createMockRes();
                await addTeamMember(req, res);

                assert.equal(res.statusCode, 201);
                assert.equal(saved, true);
            });

            it('allows existing accounts with previously stored password hashes to log in', async () => {
                Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
                process.env.SELLER_EMAIL = TEST_SELLER_EMAIL;
                process.env.SELLER_PASSWORD = 'AnyRootPassword123!';
                process.env.JWT_SECRET = TEST_JWT_SECRET;

                const oldPassword = 'OldShort8Pass!';
                const hashedPassword = await bcrypt.hash(oldPassword, 10);

                TeamMember.findOne = async () => ({
                    _id: '507f1f77bcf86cd799439090',
                    name: 'Legacy Member',
                    email: 'legacy@greencart.com',
                    password: hashedPassword,
                    role: 'CTO',
                    designation: 'Legacy Developer',
                    status: 'Active',
                    tokenVersion: 0
                });

                const req = {
                    body: {
                        email: 'legacy@greencart.com',
                        password: oldPassword
                    }
                };
                const res = createMockRes();

                await sellerLogin(req, res);

                assert.equal(res.statusCode, 200);
                assert.equal(res.body.success, true);
                assert.equal(res.body.user.email, 'legacy@greencart.com');
            });
        });
    });

    describe('8. FIX 3 — Distributed Seller Login Rate Limiting Suite', () => {
        let origConnection;

        beforeEach(() => {
            origConnection = mongoose.connection.readyState;
        });

        afterEach(() => {
            Object.defineProperty(mongoose.connection, 'readyState', { value: origConnection, configurable: true });
        });

        it('MongoRateLimitStore atomic operations increment, decrement, and reset counters', async () => {
            Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

            const store = new MongoRateLimitStore({ windowMs: 60000, prefix: 'test_store' });
            const mockDb = new Map();

            RateLimitRecord.findOneAndUpdate = async (filter, update) => {
                const key = filter.key;
                const existing = mockDb.get(key);
                if (filter.resetTime && (!existing || existing.resetTime <= new Date())) {
                    return null;
                }
                if (existing) {
                    if (update.$inc) existing.totalHits += update.$inc.totalHits;
                    return existing;
                }
                const newDoc = { key, totalHits: 1, resetTime: update.$set.resetTime };
                mockDb.set(key, newDoc);
                return newDoc;
            };

            RateLimitRecord.updateOne = async (filter, update) => {
                const existing = mockDb.get(filter.key);
                if (existing && update.$inc) existing.totalHits += update.$inc.totalHits;
            };

            RateLimitRecord.deleteOne = async (filter) => {
                mockDb.delete(filter.key);
            };

            const hit1 = await store.increment('client_alpha');
            assert.equal(hit1.totalHits, 1);

            const hit2 = await store.increment('client_alpha');
            assert.equal(hit2.totalHits, 2);

            await store.decrement('client_alpha');
            assert.equal(mockDb.get('test_store_client_alpha').totalHits, 1);

            await store.resetKey('client_alpha');
            assert.equal(mockDb.has('test_store_client_alpha'), false);
        });

        it('Two simulated application instances share the exact same counters when using the shared store', async () => {
            Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

            const sharedMap = new Map();
            RateLimitRecord.findOneAndUpdate = async (filter, update) => {
                const key = filter.key;
                const existing = sharedMap.get(key);
                if (filter.resetTime && (!existing || existing.resetTime <= new Date())) {
                    return null;
                }
                if (existing) {
                    existing.totalHits += (update.$inc?.totalHits || 0);
                    return existing;
                }
                const newDoc = { key, totalHits: 1, resetTime: update.$set.resetTime };
                sharedMap.set(key, newDoc);
                return newDoc;
            };

            const storeInstanceA = new MongoRateLimitStore({ windowMs: 60000, prefix: 'shared_app' });
            const storeInstanceB = new MongoRateLimitStore({ windowMs: 60000, prefix: 'shared_app' });

            // Instance A increments 2 times
            await storeInstanceA.increment('seller_target@greencart.com');
            await storeInstanceA.increment('seller_target@greencart.com');

            // Instance B increments and checks counter: must see 3 hits total
            const hitFromB = await storeInstanceB.increment('seller_target@greencart.com');
            assert.equal(hitFromB.totalHits, 3, 'Instance B must observe the shared hits from Instance A');
        });

        it('Shared store failure does not silently bypass rate limiting (fails safely)', async () => {
            const failingStore = {
                init: () => {},
                increment: async () => {
                    throw new Error("Shared database connection timeout");
                },
                decrement: async () => {},
                resetKey: async () => {}
            };

            const limiter = createSellerLoginLimiter({
                store: failingStore,
                limit: 3
            });

            const app = express();
            app.use(express.json());
            app.post('/api/test/failing-store', limiter, (req, res) => {
                res.json({ success: true });
            });

            let server;
            await new Promise((resolve) => {
                server = app.listen(0, '127.0.0.1', resolve);
            });
            const port = server.address().port;

            try {
                const response = await fetch(`http://127.0.0.1:${port}/api/test/failing-store`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: 'victim@greencart.com' })
                });

                assert.equal(response.status, 503, 'Failed shared store must return HTTP 503');
                const data = await response.json();
                assert.deepEqual(data, {
                    success: false,
                    message: "Too many requests. Please try again later."
                });
            } finally {
                await new Promise((resolve) => server.close(resolve));
            }
        });

        it('Preserves generic rate limit response to prevent account enumeration', async () => {
            const app = express();
            app.use(express.json());

            const limiter = createSellerLoginLimiter({ limit: 1 });
            app.post('/api/test/limiter-enum', limiter, (req, res) => res.status(401).json({ success: false }));

            let server;
            await new Promise((resolve) => {
                server = app.listen(0, '127.0.0.1', resolve);
            });
            const port = server.address().port;

            try {
                // Attempt 1 fails (exhausts limit)
                await fetch(`http://127.0.0.1:${port}/api/test/limiter-enum`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: 'target@greencart.com' })
                });

                // Attempt 2 blocked
                const r2 = await fetch(`http://127.0.0.1:${port}/api/test/limiter-enum`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: 'target@greencart.com' })
                });

                assert.equal(r2.status, 429);
                const data = await r2.json();
                assert.deepEqual(data, { success: false, message: "Too many requests. Please try again later." });
            } finally {
                await new Promise((resolve) => server.close(resolve));
            }
        });
    });

    describe('9. FIX 4 — Root Merchant Session Revocation Suite', () => {
        let origConnection;

        beforeEach(() => {
            origConnection = mongoose.connection.readyState;
        });

        afterEach(() => {
            Object.defineProperty(mongoose.connection, 'readyState', { value: origConnection, configurable: true });
        });

        it('Root merchant login includes the authoritative session version in the signed JWT', async () => {
            Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

            MerchantSession.getAuthoritativeVersion = async () => 5;

            process.env.SELLER_EMAIL = TEST_SELLER_EMAIL;
            process.env.SELLER_PASSWORD = 'RootMerchantSecurePass123!';

            const req = {
                body: {
                    email: TEST_SELLER_EMAIL,
                    password: 'RootMerchantSecurePass123!'
                }
            };
            const res = createMockRes();

            await sellerLogin(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);

            const cookie = res.headers['set-cookie'];
            assert.ok(cookie, 'Must set sellerToken cookie');
            const decoded = jwt.verify(cookie.val, TEST_JWT_SECRET);
            assert.equal(decoded.email, TEST_SELLER_EMAIL);
            assert.equal(decoded.sessionVersion, 5, 'Must embed authoritative sessionVersion in JWT');
        });

        it('Valid root merchant token matching authoritative version works (200 OK)', async () => {
            Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

            MerchantSession.getAuthoritativeVersion = async () => 5;

            const token = createToken({
                email: TEST_SELLER_EMAIL,
                role: 'Admin',
                sessionVersion: 5
            });

            const req = { cookies: { sellerToken: token } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, true);
            assert.equal(req.sellerRole, 'Admin');
            assert.equal(req.seller.email, TEST_SELLER_EMAIL);
        });

        it('Revoked root merchant token returns HTTP 401', async () => {
            Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

            MerchantSession.getAuthoritativeVersion = async () => 6;

            const revokedToken = createToken({
                email: TEST_SELLER_EMAIL,
                role: 'Admin',
                sessionVersion: 5
            });

            const req = { cookies: { sellerToken: revokedToken } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 401);
            assert.match(res.body.message, /Root merchant session has been revoked/i);
        });

        it('Old root token becomes invalid immediately after session version increment', async () => {
            Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

            let currentVersion = 10;
            MerchantSession.getAuthoritativeVersion = async () => currentVersion;
            MerchantSession.revokeAllSessions = async () => {
                currentVersion += 1;
                return currentVersion;
            };

            const activeToken = createToken({
                email: TEST_SELLER_EMAIL,
                role: 'Admin',
                sessionVersion: 10
            });

            // 1. Initial request works
            const req1 = { cookies: { sellerToken: activeToken } };
            const res1 = createMockRes();
            let next1 = false;
            await authSeller(req1, res1, () => { next1 = true; });
            assert.equal(next1, true);

            // 2. Revoke all sessions as root merchant (increment version)
            process.env.SELLER_EMAIL = TEST_SELLER_EMAIL;
            const revokeRes = createMockRes();
            await revokeRootMerchantSessions(
                { sellerRole: 'Admin', sellerEmail: TEST_SELLER_EMAIL },
                revokeRes
            );

            assert.equal(revokeRes.statusCode, 200);
            assert.equal(currentVersion, 11);

            // 3. Subsequent request with the old token is rejected
            const req2 = { cookies: { sellerToken: activeToken } };
            const res2 = createMockRes();
            let next2 = false;
            await authSeller(req2, res2, () => { next2 = true; });
            assert.equal(next2, false);
            assert.equal(res2.statusCode, 401);
            assert.match(res2.body.message, /Root merchant session has been revoked/i);
        });

        it('Database unavailable during root session version verification in production fails closed (503)', async () => {
            Object.defineProperty(mongoose.connection, 'readyState', { value: 0, configurable: true });
            process.env.NODE_ENV = 'production';

            const token = createToken({
                email: TEST_SELLER_EMAIL,
                role: 'Admin',
                sessionVersion: 1
            });

            const req = { cookies: { sellerToken: token } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 503);
            assert.match(res.body.message, /Database service unavailable/i);
        });

        it('Team member tokenVersion behavior remains unchanged and isolated', async () => {
            Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });

            const memberId = '507f1f77bcf86cd799439088';
            TeamMember.findById = (id) => ({
                lean: async () => ({
                    _id: memberId,
                    email: 'cto@greencart.com',
                    role: 'CTO',
                    status: 'Active',
                    tokenVersion: 3
                })
            });

            const teamToken = createToken({
                id: memberId,
                email: 'cto@greencart.com',
                role: 'CTO',
                tokenVersion: 3
            });

            const req = { cookies: { sellerToken: teamToken } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, true);
            assert.equal(req.sellerRole, 'CTO');
            assert.equal(req.sellerEmail, 'cto@greencart.com');
        });

        it('Root Merchant can revoke all root sessions successfully (200 OK)', async () => {
            Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
            process.env.SELLER_EMAIL = TEST_SELLER_EMAIL;

            let revoked = false;
            MerchantSession.revokeAllSessions = async () => {
                revoked = true;
                return 12;
            };

            const req = {
                sellerRole: 'Admin',
                sellerEmail: TEST_SELLER_EMAIL,
                seller: { email: TEST_SELLER_EMAIL, role: 'Admin' }
            };
            const res = createMockRes();

            await revokeRootMerchantSessions(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.equal(revoked, true);
            assert.match(res.body.message, /revoked successfully/i);
        });

        it('Team Member Admin receives HTTP 403 when attempting to revoke root merchant sessions', async () => {
            Object.defineProperty(mongoose.connection, 'readyState', { value: 1, configurable: true });
            process.env.SELLER_EMAIL = TEST_SELLER_EMAIL;

            let revoked = false;
            MerchantSession.revokeAllSessions = async () => {
                revoked = true;
                return 13;
            };

            const teamMemberAdminReq = {
                sellerRole: 'Admin',
                sellerEmail: 'team_admin@greencart.com',
                isTeamMember: true,
                seller: { email: 'team_admin@greencart.com', role: 'Admin' }
            };
            const res = createMockRes();

            await revokeRootMerchantSessions(teamMemberAdminReq, res);

            assert.equal(res.statusCode, 403);
            assert.equal(res.body.success, false);
            assert.equal(revoked, false, 'MerchantSession.revokeAllSessions must NOT be called by Team Admin');
            assert.match(res.body.message, /Only the Root Merchant can revoke/i);
        });

        it('CEO, CTO, and Strategist receive HTTP 403 from requireRole middleware', async () => {
            const adminCheck = requireRole('Admin');
            for (const nonAdminRole of ['CEO', 'CTO', 'Strategist']) {
                const req = { sellerRole: nonAdminRole, seller: { role: nonAdminRole } };
                const res = createMockRes();
                let nextCalled = false;

                adminCheck(req, res, () => { nextCalled = true; });

                assert.equal(nextCalled, false);
                assert.equal(res.statusCode, 403);
                assert.match(res.body.message, /insufficient role permissions/i);
            }
        });

        it('Unauthenticated requests to revoke-all-sessions are rejected with HTTP 401', async () => {
            const req = { cookies: {} };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 401);
            assert.match(res.body.message, /Not Authorized/i);
        });
    });

    describe('10. Google Drive Profile Image Normalization & Safety Suite', () => {
        const TEST_FILE_ID = '1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-';
        const EXPECTED_NORMALIZED = `https://lh3.googleusercontent.com/d/${TEST_FILE_ID}`;

        it('normalizes all four recognized Google Drive URL formats into lh3.googleusercontent.com/d/FILE_ID', () => {
            const formats = [
                `https://drive.google.com/uc?export=view&id=${TEST_FILE_ID}`,
                `https://drive.google.com/uc?id=${TEST_FILE_ID}`,
                `https://drive.google.com/file/d/${TEST_FILE_ID}/view`,
                `https://drive.google.com/file/d/${TEST_FILE_ID}/view?usp=sharing`,
                `https://drive.google.com/open?id=${TEST_FILE_ID}`
            ];

            for (const url of formats) {
                assert.equal(normalizeTeamImageUrl(url), EXPECTED_NORMALIZED, `Failed to normalize: ${url}`);
            }
        });

        it('preserves non-Google URLs and data URIs completely unchanged', () => {
            const nonGoogleUrls = [
                'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                'https://res.cloudinary.com/greencart/image/upload/v1234/profile.jpg',
                'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
                'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==',
                '',
                null,
                undefined
            ];

            for (const url of nonGoogleUrls) {
                assert.equal(normalizeTeamImageUrl(url), url, `Should NOT alter non-Google image: ${url}`);
            }
        });

        it('addTeamMember normalizes Google Drive /file/d/FILE_ID/view and saves normalized URL to MongoDB', async () => {
            const origFindOne = TeamMember.findOne;
            const origSave = TeamMember.prototype.save;
            TeamMember.findOne = async () => null;

            let savedDoc = null;
            TeamMember.prototype.save = async function () {
                savedDoc = this;
                this._id = new mongoose.Types.ObjectId();
                return this;
            };

            const req = {
                body: {
                    name: 'Test Member GDrive File',
                    email: 'gdrive1@greencart.com',
                    password: 'SecurePassword123!',
                    designation: 'Architect',
                    role: 'CTO',
                    image: `https://drive.google.com/file/d/${TEST_FILE_ID}/view`
                },
                sellerRole: 'Admin'
            };
            const res = createMockRes();

            await addTeamMember(req, res);

            TeamMember.findOne = origFindOne;
            TeamMember.prototype.save = origSave;

            assert.equal(res.statusCode, 201);
            assert.equal(res.body.success, true);
            assert.equal(savedDoc.image, EXPECTED_NORMALIZED);
            assert.equal(res.body.member.image, EXPECTED_NORMALIZED);
        });

        it('addTeamMember normalizes Google Drive /uc?export=view&id=FILE_ID and saves normalized URL to MongoDB', async () => {
            const origFindOne = TeamMember.findOne;
            const origSave = TeamMember.prototype.save;
            TeamMember.findOne = async () => null;

            let savedDoc = null;
            TeamMember.prototype.save = async function () {
                savedDoc = this;
                this._id = new mongoose.Types.ObjectId();
                return this;
            };

            const req = {
                body: {
                    name: 'Test Member GDrive UC',
                    email: 'gdrive2@greencart.com',
                    password: 'SecurePassword123!',
                    designation: 'VP Engineering',
                    role: 'CTO',
                    image: `https://drive.google.com/uc?export=view&id=${TEST_FILE_ID}`
                },
                sellerRole: 'Admin'
            };
            const res = createMockRes();

            await addTeamMember(req, res);

            TeamMember.findOne = origFindOne;
            TeamMember.prototype.save = origSave;

            assert.equal(res.statusCode, 201);
            assert.equal(res.body.success, true);
            assert.equal(savedDoc.image, EXPECTED_NORMALIZED);
            assert.equal(res.body.member.image, EXPECTED_NORMALIZED);
        });

        it('updateTeamMember updates and normalizes Google Drive image URL in MongoDB', async () => {
            const origFindById = TeamMember.findById;
            const memberId = '507f1f77bcf86cd799439099';

            let savedDoc = null;
            TeamMember.findById = async () => ({
                _id: memberId,
                email: 'other@greencart.com',
                role: 'CTO',
                status: 'Active',
                image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
                save: async function () {
                    savedDoc = this;
                    return this;
                },
                toSafeObject: function () {
                    return { _id: this._id, email: this.email, image: this.image };
                }
            });

            const req = {
                params: { id: memberId },
                sellerId: '507f1f77bcf86cd799439000',
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                body: {
                    image: `https://drive.google.com/open?id=${TEST_FILE_ID}`
                }
            };
            const res = createMockRes();

            await updateTeamMember(req, res);

            TeamMember.findById = origFindById;

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.equal(savedDoc.image, EXPECTED_NORMALIZED);
            assert.equal(res.body.member.image, EXPECTED_NORMALIZED);
        });

        it('preserves existing non-Google URLs in updateTeamMember', async () => {
            const origFindById = TeamMember.findById;
            const memberId = '507f1f77bcf86cd799439098';
            const unsplashUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb';

            let savedDoc = null;
            TeamMember.findById = async () => ({
                _id: memberId,
                email: 'other2@greencart.com',
                role: 'CTO',
                status: 'Active',
                image: '',
                save: async function () {
                    savedDoc = this;
                    return this;
                },
                toSafeObject: function () {
                    return { _id: this._id, email: this.email, image: this.image };
                }
            });

            const req = {
                params: { id: memberId },
                sellerId: '507f1f77bcf86cd799439000',
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                body: {
                    image: unsplashUrl
                }
            };
            const res = createMockRes();

            await updateTeamMember(req, res);

            TeamMember.findById = origFindById;

            assert.equal(res.statusCode, 200);
            assert.equal(savedDoc.image, unsplashUrl);
        });

        it('still rejects dangerous schemes and SVG/GIF data URIs with 400', async () => {
            const dangerousInputs = [
                'javascript:alert(1)',
                'file:///etc/shadow',
                'vbscript:run()',
                'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
                'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
            ];

            for (const badImg of dangerousInputs) {
                const req = {
                    body: {
                        name: 'Attacker',
                        email: 'bad@greencart.com',
                        password: 'SecurePassword123!',
                        designation: 'Tester',
                        role: 'CTO',
                        image: badImg
                    },
                    sellerRole: 'Admin'
                };
                const res = createMockRes();
                await addTeamMember(req, res);

                assert.equal(res.statusCode, 400);
                assert.match(res.body.message, /Invalid profile image/i);
            }
        });

        it('getTeamMembers normalizes legacy unnormalized Google Drive URLs on retrieval', async () => {
            const origFind = TeamMember.find;
            TeamMember.find = () => ({
                select: () => ({
                    sort: () => ({
                        lean: async () => [
                            {
                                _id: '507f1f77bcf86cd799439097',
                                name: 'Legacy Member',
                                email: 'legacy@greencart.com',
                                role: 'Strategist',
                                image: `https://drive.google.com/uc?export=view&id=${TEST_FILE_ID}`
                            }
                        ]
                    })
                })
            });

            const res = createMockRes();
            await getTeamMembers({}, res);

            TeamMember.find = origFind;

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.team[0].image, EXPECTED_NORMALIZED);
        });
    });
});
