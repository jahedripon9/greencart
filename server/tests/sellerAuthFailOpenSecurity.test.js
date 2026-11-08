import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { sellerLogin } from '../controllers/sellerController.js';
import authSeller from '../middlewares/authSeller.js';

describe('GreenCart Phase 1: Seller Authentication Fail-Open & Input Validation Suite [SEC-01]', () => {
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
                this.headers['set-cookie'] = { name, val, options };
                return this;
            },
            clearCookie(name, options) {
                this.headers['cleared-cookie'] = { name, options };
                return this;
            }
        };
        return res;
    };

    beforeEach(() => {
        originalEnv = { ...process.env };
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = 'test_secret_key_1234567890_secure';
        process.env.SELLER_EMAIL = 'admin@greencart.com';
        process.env.SELLER_PASSWORD = 'SuperSecureRootAdminPassword123!';
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('1. Fail-Closed Server Environment Configuration Protection', () => {
        it('rejects login with HTTP 500 when SELLER_EMAIL is missing from environment', async () => {
            delete process.env.SELLER_EMAIL;
            const req = { body: { email: 'admin@greencart.com', password: 'SuperSecureRootAdminPassword123!' } };
            const res = createMockRes();

            await sellerLogin(req, res);

            assert.equal(res.statusCode, 500);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /configuration missing/i);
            assert.equal(res.headers['set-cookie'], undefined, 'Must NEVER set cookie when env is missing');
        });

        it('rejects login with HTTP 500 when SELLER_EMAIL is empty or whitespace', async () => {
            process.env.SELLER_EMAIL = '   ';
            const req = { body: { email: 'admin@greencart.com', password: 'SuperSecureRootAdminPassword123!' } };
            const res = createMockRes();

            await sellerLogin(req, res);

            assert.equal(res.statusCode, 500);
            assert.equal(res.body.success, false);
            assert.equal(res.headers['set-cookie'], undefined);
        });

        it('rejects login with HTTP 500 when SELLER_PASSWORD is missing from environment', async () => {
            delete process.env.SELLER_PASSWORD;
            const req = { body: { email: 'admin@greencart.com', password: 'SuperSecureRootAdminPassword123!' } };
            const res = createMockRes();

            await sellerLogin(req, res);

            assert.equal(res.statusCode, 500);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /configuration missing/i);
            assert.equal(res.headers['set-cookie'], undefined);
        });

        it('rejects login with HTTP 500 when SELLER_PASSWORD is empty or whitespace', async () => {
            process.env.SELLER_PASSWORD = '';
            const req = { body: { email: 'admin@greencart.com', password: 'SuperSecureRootAdminPassword123!' } };
            const res = createMockRes();

            await sellerLogin(req, res);

            assert.equal(res.statusCode, 500);
            assert.equal(res.body.success, false);
            assert.equal(res.headers['set-cookie'], undefined);
        });

        it('rejects login with HTTP 500 when JWT_SECRET is missing from environment', async () => {
            delete process.env.JWT_SECRET;
            const req = { body: { email: 'admin@greencart.com', password: 'SuperSecureRootAdminPassword123!' } };
            const res = createMockRes();

            await sellerLogin(req, res);

            assert.equal(res.statusCode, 500);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /configuration missing/i);
            assert.equal(res.headers['set-cookie'], undefined);
        });

        it('CRITICAL: Empty body {} with unset env vars evaluates to HTTP 500, never authenticates (undefined === undefined check prevented)', async () => {
            delete process.env.SELLER_EMAIL;
            delete process.env.SELLER_PASSWORD;
            delete process.env.JWT_SECRET;

            const req = { body: {} };
            const res = createMockRes();

            await sellerLogin(req, res);

            assert.equal(res.statusCode, 500);
            assert.equal(res.body.success, false);
            assert.equal(res.headers['set-cookie'], undefined, 'Bypass must be strictly impossible');
        });
    });

    describe('2. Strict Input Validation & Missing Payload Handling', () => {
        it('rejects empty payload {} with HTTP 400 when env vars are properly configured', async () => {
            const req = { body: {} };
            const res = createMockRes();

            await sellerLogin(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Email and password are required/i);
            assert.equal(res.headers['set-cookie'], undefined);
        });

        it('gracefully handles null or undefined req.body without unhandled TypeError', async () => {
            const req = { body: null };
            const res = createMockRes();

            await sellerLogin(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /Email and password are required/i);
        });

        it('rejects non-string email (e.g. boolean, number, object) with HTTP 400', async () => {
            const req = { body: { email: 12345, password: 'SuperSecureRootAdminPassword123!' } };
            const res = createMockRes();

            await sellerLogin(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
        });

        it('rejects whitespace-only email with HTTP 400', async () => {
            const req = { body: { email: '   ', password: 'SuperSecureRootAdminPassword123!' } };
            const res = createMockRes();

            await sellerLogin(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
        });

        it('rejects empty password with HTTP 400', async () => {
            const req = { body: { email: 'admin@greencart.com', password: '' } };
            const res = createMockRes();

            await sellerLogin(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
        });

        it('rejects mismatched seller credentials with HTTP 401', async () => {
            const req = { body: { email: 'admin@greencart.com', password: 'WrongPassword999!' } };
            const res = createMockRes();

            await sellerLogin(req, res);

            assert.equal(res.statusCode, 401);
            assert.equal(res.body.success, false);
            assert.equal(res.headers['set-cookie'], undefined);
        });
    });

    describe('3. authSeller Middleware Fail-Closed Protection', () => {
        it('rejects unauthenticated request when sellerToken cookie is missing (HTTP 401)', async () => {
            const req = { cookies: {} };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 401);
            assert.equal(res.body.success, false);
        });

        it('rejects with HTTP 500 when SELLER_EMAIL is missing from environment during verification', async () => {
            const token = jwt.sign({ email: 'admin@greencart.com', role: 'Admin' }, process.env.JWT_SECRET);
            delete process.env.SELLER_EMAIL;

            const req = { cookies: { sellerToken: token } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 500);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /configuration missing/i);
        });

        it('rejects with HTTP 500 when JWT_SECRET is missing from environment during verification', async () => {
            const token = jwt.sign({ email: 'admin@greencart.com', role: 'Admin' }, process.env.JWT_SECRET);
            delete process.env.JWT_SECRET;

            const req = { cookies: { sellerToken: token } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 500);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /configuration missing/i);
        });

        it('rejects forged / invalid sellerToken with HTTP 401', async () => {
            const req = { cookies: { sellerToken: 'invalid.forged.jwt.token' } };
            const res = createMockRes();
            let nextCalled = false;

            await authSeller(req, res, () => { nextCalled = true; });

            assert.equal(nextCalled, false);
            assert.equal(res.statusCode, 401);
            assert.equal(res.body.success, false);
        });
    });
});
