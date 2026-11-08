import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import authUser, { optionalAuthUser } from '../middlewares/authUser.js';
import authSeller, { optionalAuthSeller } from '../middlewares/authSeller.js';
import { isAuth } from '../controllers/userController.js';
import { isSellerAuth } from '../controllers/sellerController.js';

describe('Option B: Clean Authentication Status Responses Suite', () => {
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
            }
        };
        return res;
    };

    beforeEach(() => {
        originalEnv = { ...process.env };
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = 'test_jwt_secret_key_32_characters_long!';
        process.env.SELLER_EMAIL = 'admin@greencart.com';
        process.env.SELLER_PASSWORD = 'TestPassword123!';
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('1. Customer Status Check (/api/user/is-auth)', () => {
        it('Guest customer (no token cookie): returns HTTP 200 with { success: false, user: null }', async () => {
            const req = { cookies: {} };
            const res = createMockRes();
            let nextCalled = false;

            await optionalAuthUser(req, res, () => { nextCalled = true; });

            assert.equal(res.statusCode, 200, 'Must respond with HTTP 200 for unauthenticated check');
            assert.equal(res.body.success, false, 'success must be false for guest');
            assert.equal(res.body.user, null, 'user must be null for guest');
            assert.equal(nextCalled, false, 'next() must NOT be called for unauthenticated check');
        });

        it('Guest customer (empty/whitespace token cookie): returns HTTP 200 with { success: false, user: null }', async () => {
            const req = { cookies: { token: '   ' } };
            const res = createMockRes();
            let nextCalled = false;

            await optionalAuthUser(req, res, () => { nextCalled = true; });

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, false);
            assert.equal(res.body.user, null);
            assert.equal(nextCalled, false);
        });

        it('Authenticated customer: optionalAuthUser verifies valid token, attaches userId, and calls next()', async () => {
            const validToken = jwt.sign({ id: '65f1a2b3c4d5e6f7a8b9c0d1' }, process.env.JWT_SECRET, { expiresIn: '1h' });
            const req = { cookies: { token: validToken } };
            const res = createMockRes();
            let nextCalled = false;

            await optionalAuthUser(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, true, 'next() must be called for valid token');
            assert.equal(req.userId, '65f1a2b3c4d5e6f7a8b9c0d1');
        });

        it('Customer with forged/invalid token: returns HTTP 401 Unauthorized', async () => {
            const req = { cookies: { token: 'invalid_malformed_token' } };
            const res = createMockRes();
            let nextCalled = false;

            await optionalAuthUser(req, res, () => { nextCalled = true; });

            assert.equal(res.statusCode, 401, 'Must reject invalid token with HTTP 401');
            assert.equal(res.body.success, false);
            assert.equal(nextCalled, false);
        });

        it('Customer with expired token: returns HTTP 401 Unauthorized', async () => {
            const expiredToken = jwt.sign(
                { id: '65f1a2b3c4d5e6f7a8b9c0d1' },
                process.env.JWT_SECRET,
                { expiresIn: '-1s' }
            );
            const req = { cookies: { token: expiredToken } };
            const res = createMockRes();
            let nextCalled = false;

            await optionalAuthUser(req, res, () => { nextCalled = true; });

            assert.equal(res.statusCode, 401, 'Must reject expired token with HTTP 401');
            assert.equal(res.body.success, false);
            assert.equal(nextCalled, false);
        });
    });

    describe('2. Seller Status Check (/api/seller/is-auth)', () => {
        it('Guest seller (no sellerToken cookie): returns HTTP 200 with { success: false, user: null }', async () => {
            const req = { cookies: {} };
            const res = createMockRes();
            let nextCalled = false;

            await optionalAuthSeller(req, res, () => { nextCalled = true; });

            assert.equal(res.statusCode, 200, 'Must respond with HTTP 200 for unauthenticated seller check');
            assert.equal(res.body.success, false, 'success must be false for guest seller');
            assert.equal(res.body.user, null, 'user must be null for guest seller');
            assert.equal(nextCalled, false, 'next() must NOT be called for unauthenticated check');
        });

        it('Guest seller (whitespace sellerToken cookie): returns HTTP 200 with { success: false, user: null }', async () => {
            const req = { cookies: { sellerToken: '   ' } };
            const res = createMockRes();
            let nextCalled = false;

            await optionalAuthSeller(req, res, () => { nextCalled = true; });

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, false);
            assert.equal(res.body.user, null);
            assert.equal(nextCalled, false);
        });

        it('Authenticated root seller: optionalAuthSeller verifies token, attaches seller, and calls next()', async () => {
            const rootToken = jwt.sign(
                {
                    email: process.env.SELLER_EMAIL,
                    role: 'Admin',
                    sessionVersion: 0
                },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );
            const req = { cookies: { sellerToken: rootToken } };
            const res = createMockRes();
            let nextCalled = false;

            await optionalAuthSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, true, 'next() must be called for valid seller token');
            assert.equal(req.sellerRole, 'Admin');
            assert.equal(req.sellerEmail, process.env.SELLER_EMAIL);

            // Now test isSellerAuth controller with this req
            const controllerRes = createMockRes();
            await isSellerAuth(req, controllerRes);
            assert.equal(controllerRes.statusCode, 200);
            assert.equal(controllerRes.body.success, true);
            assert.equal(controllerRes.body.user.role, 'Admin');
        });

        it('Seller with forged/invalid sellerToken: returns HTTP 401 Unauthorized', async () => {
            const req = { cookies: { sellerToken: 'forged_seller_token_xyz' } };
            const res = createMockRes();
            let nextCalled = false;

            await optionalAuthSeller(req, res, () => { nextCalled = true; });

            assert.equal(res.statusCode, 401, 'Must reject invalid sellerToken with HTTP 401');
            assert.equal(res.body.success, false);
            assert.equal(nextCalled, false);
        });

        it('Seller with expired sellerToken: returns HTTP 401 Unauthorized', async () => {
            const expiredToken = jwt.sign(
                { email: process.env.SELLER_EMAIL, role: 'Admin' },
                process.env.JWT_SECRET,
                { expiresIn: '-1s' }
            );
            const req = { cookies: { sellerToken: expiredToken } };
            const res = createMockRes();
            let nextCalled = false;

            await optionalAuthSeller(req, res, () => { nextCalled = true; });

            assert.equal(res.statusCode, 401, 'Must reject expired sellerToken with HTTP 401');
            assert.equal(res.body.success, false);
            assert.equal(nextCalled, false);
        });

        it('isSellerAuth controller returns HTTP 200 { success: false, user: null } if req.seller is missing', async () => {
            const req = {};
            const res = createMockRes();

            await isSellerAuth(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, false);
            assert.equal(res.body.user, null);
        });
    });

    describe('3. Global authUser & authSeller Security Gatekeeper Integrity', () => {
        it('authUser MUST strictly return HTTP 401 when token cookie is missing on protected routes', async () => {
            const req = { cookies: {} };
            const res = createMockRes();
            let nextCalled = false;

            await authUser(req, res, () => { nextCalled = true; });

            assert.equal(res.statusCode, 401, 'Protected route must reject missing token with 401');
            assert.equal(res.body.success, false);
            assert.equal(res.body.message, 'Not Authorized');
            assert.equal(nextCalled, false);
        });

        it('authSeller MUST strictly return HTTP 401 when sellerToken cookie is missing on protected routes', async () => {
            const req = { cookies: {} };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(res.statusCode, 401, 'Protected seller route must reject missing token with 401');
            assert.equal(res.body.success, false);
            assert.equal(res.body.message, 'Not Authorized');
            assert.equal(nextCalled, false);
        });
    });
});
