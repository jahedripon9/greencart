import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';

import {
    RATE_LIMIT_MESSAGE,
    defaultRateLimitHandler,
    authRequestWasSuccessful,
    trackAuthOutcome,
    wrapWithAuthTracker,
    createUserLoginLimiter,
    createUserRegisterLimiter,
    createSellerLoginLimiter,
    createCheckoutLimiter,
    userLoginLimiter,
    userRegisterLimiter,
    sellerLoginLimiter,
    checkoutLimiter
} from '../middlewares/rateLimiter.js';

describe('GreenCart Rate Limiting Security Suite (Batch 9B)', () => {
    let app;
    let server;
    let baseUrl;

    before(async () => {
        app = express();
        app.use(express.json());

        // Test route: User Login with dedicated test limiter (limit: 3 failed attempts, 15m window)
        const testUserLoginLimiter = createUserLoginLimiter({
            windowMs: 15 * 60 * 1000,
            limit: 3
        });
        app.post('/api/test/user/login', testUserLoginLimiter, (req, res) => {
            const { email, password } = req.body || {};
            // Emulate userController.login returning HTTP 200 with { success: false } on auth failure
            if (password !== 'correctPassword') {
                return res.json({ success: false, message: 'Invalid email or Password' });
            }
            return res.json({ success: true, message: 'Login Successful', token: 'mock-jwt-token' });
        });

        // Test route: User Register with dedicated test limiter (limit: 3 attempts, 60m window)
        const testUserRegisterLimiter = createUserRegisterLimiter({
            windowMs: 60 * 60 * 1000,
            limit: 3
        });
        app.post('/api/test/user/register', testUserRegisterLimiter, (req, res) => {
            return res.json({ success: true, message: 'Registration Successful' });
        });

        // Test route: Seller Login with dedicated stricter limiter (limit: 2 failed attempts, 15m window)
        const testSellerLoginLimiter = createSellerLoginLimiter({
            windowMs: 15 * 60 * 1000,
            limit: 2
        });
        app.post('/api/test/seller/login', testSellerLoginLimiter, (req, res) => {
            const { email, password } = req.body || {};
            // Emulate sellerController.sellerLogin returning HTTP 401 on auth failure
            if (password !== 'sellerPass123') {
                return res.status(401).json({ success: false, message: 'Invalid Email or Password' });
            }
            return res.json({ success: true, message: 'Login Successful' });
        });

        // Mock auth middleware for checkout
        const mockAuth = (req, res, next) => {
            const authHeader = req.headers['x-mock-auth-user'];
            if (!authHeader) {
                return res.status(401).json({ success: false, message: 'Not Authorized' });
            }
            req.userId = authHeader;
            next();
        };

        // In-memory idempotency tracking for coexistence test
        const processedIdempotencyKeys = new Set();

        // Test route: COD Checkout with dedicated test limiter (limit: 3 attempts, 10m window)
        const testCheckoutLimiter = createCheckoutLimiter({
            windowMs: 10 * 60 * 1000,
            limit: 3
        });
        app.post('/api/test/order/cod', mockAuth, testCheckoutLimiter, (req, res) => {
            const { idempotencyKey } = req.body || {};
            if (idempotencyKey) {
                if (processedIdempotencyKeys.has(`${req.userId}:${idempotencyKey}`)) {
                    return res.json({ success: true, message: 'Order already processed (idempotent replay)' });
                }
                processedIdempotencyKeys.add(`${req.userId}:${idempotencyKey}`);
            }
            return res.json({ success: true, message: 'Order Placed successfully' });
        });

        // Fast-expiring limiter route for deterministic window reset testing (windowMs: 150ms, limit: 1)
        const testFastWindowLimiter = createUserRegisterLimiter({
            windowMs: 150,
            limit: 1
        });
        app.post('/api/test/fast-window', testFastWindowLimiter, (req, res) => {
            return res.json({ success: true, message: 'Allowed' });
        });

        await new Promise((resolve) => {
            server = app.listen(0, '127.0.0.1', () => {
                baseUrl = `http://127.0.0.1:${server.address().port}`;
                resolve();
            });
        });
    });

    after(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    it('requests below the threshold are allowed through', async () => {
        const res = await fetch(`${baseUrl}/api/test/user/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'newuser1@example.com' })
        });

        assert.equal(res.status, 200);
        const data = await res.json();
        assert.equal(data.success, true);
        assert.ok(res.headers.has('ratelimit'));
    });

    it('requests exceeding threshold return HTTP 429 with standard payload and headers', async () => {
        // We already sent 1 request in the previous test; test limit is 3.
        // Send request 2:
        const r2 = await fetch(`${baseUrl}/api/test/user/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'newuser2@example.com' })
        });
        assert.equal(r2.status, 200);

        // Send request 3 (hits limit):
        const r3 = await fetch(`${baseUrl}/api/test/user/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'newuser3@example.com' })
        });
        assert.equal(r3.status, 200);

        // Send request 4 (exceeds limit -> HTTP 429):
        const r4 = await fetch(`${baseUrl}/api/test/user/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'newuser4@example.com' })
        });

        assert.equal(r4.status, 429);
        const data4 = await r4.json();
        assert.deepEqual(data4, {
            success: false,
            message: 'Too many requests. Please try again later.'
        });

        // Verify standard rate-limit headers (draft-7) and Retry-After
        assert.ok(r4.headers.has('ratelimit'), 'Missing draft-7 RateLimit header');
        assert.ok(r4.headers.has('ratelimit-policy'), 'Missing draft-7 RateLimit-Policy header');
        assert.ok(r4.headers.has('retry-after'), 'Missing Retry-After header');
        assert.ok(Number(r4.headers.get('retry-after')) > 0, 'Retry-After should be a positive number');
    });

    it('skipSuccessfulRequests correctly counts HTTP 200 auth failures and preserves budget on success', async () => {
        // Send 10 successful logins: none should consume the failure budget
        for (let i = 0; i < 5; i++) {
            const successRes = await fetch(`${baseUrl}/api/test/user/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'valid@example.com', password: 'correctPassword' })
            });
            assert.equal(successRes.status, 200);
            const successData = await successRes.json();
            assert.equal(successData.success, true);
        }

        // Now send failed logins (controller returns HTTP 200 with { success: false })
        // Limit is 3 failed attempts:
        const fail1 = await fetch(`${baseUrl}/api/test/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'user@example.com', password: 'wrongPassword' })
        });
        assert.equal(fail1.status, 200);
        const data1 = await fail1.json();
        assert.equal(data1.success, false);

        const fail2 = await fetch(`${baseUrl}/api/test/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'user@example.com', password: 'wrongPassword' })
        });
        assert.equal(fail2.status, 200);

        const fail3 = await fetch(`${baseUrl}/api/test/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'user@example.com', password: 'wrongPassword' })
        });
        assert.equal(fail3.status, 200);

        // 4th failed attempt must be blocked with HTTP 429
        const fail4 = await fetch(`${baseUrl}/api/test/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'user@example.com', password: 'wrongPassword' })
        });
        assert.equal(fail4.status, 429);
        const data4 = await fail4.json();
        assert.equal(data4.success, false);
        assert.equal(data4.message, 'Too many requests. Please try again later.');
    });

    it('seller login uses dedicated stricter limiter isolated from user login', async () => {
        // Seller limiter threshold is 2 failed attempts
        const s1 = await fetch(`${baseUrl}/api/test/seller/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'seller@example.com', password: 'wrong' })
        });
        assert.equal(s1.status, 401);

        const s2 = await fetch(`${baseUrl}/api/test/seller/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'seller@example.com', password: 'wrong' })
        });
        assert.equal(s2.status, 401);

        // 3rd attempt exceeds the limit of 2 -> HTTP 429
        const s3 = await fetch(`${baseUrl}/api/test/seller/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'seller@example.com', password: 'wrong' })
        });
        assert.equal(s3.status, 429);
        const s3Data = await s3.json();
        assert.equal(s3Data.message, 'Too many requests. Please try again later.');
    });

    it('checkout limiter keys strictly on req.userId and ignores req.body.userId', async () => {
        const legitimateUserId = 'user_legit_101';
        const victimUserId = 'user_victim_202';

        // Legitimate user makes 3 checkout attempts (limit: 3)
        for (let i = 0; i < 3; i++) {
            const res = await fetch(`${baseUrl}/api/test/order/cod`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-mock-auth-user': legitimateUserId
                },
                body: JSON.stringify({
                    // Attacker attempting to spoof victim's userId in request body:
                    userId: victimUserId,
                    items: [{ productId: 'prod_1', quantity: 1 }]
                })
            });
            assert.equal(res.status, 200);
        }

        // 4th checkout attempt by legitimateUserId is blocked by rate limit
        const blockedRes = await fetch(`${baseUrl}/api/test/order/cod`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-mock-auth-user': legitimateUserId
            },
            body: JSON.stringify({
                userId: victimUserId,
                items: [{ productId: 'prod_1', quantity: 1 }]
            })
        });
        assert.equal(blockedRes.status, 429);

        // Victim user must NOT be rate limited because keying is strictly based on authenticated req.userId!
        const victimRes = await fetch(`${baseUrl}/api/test/order/cod`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-mock-auth-user': victimUserId
            },
            body: JSON.stringify({
                items: [{ productId: 'prod_1', quantity: 1 }]
            })
        });
        assert.equal(victimRes.status, 200, 'Victim user must not be impacted by legitimate user reaching limit');
    });

    it('checkout limiter coexists with idempotency handling', async () => {
        const userId = 'user_idempotent_test';
        const idempotencyKey = 'idem_key_abc_123';

        // First attempt with idempotency key
        const r1 = await fetch(`${baseUrl}/api/test/order/cod`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-mock-auth-user': userId
            },
            body: JSON.stringify({ idempotencyKey, items: [{ productId: 'p1', quantity: 1 }] })
        });
        assert.equal(r1.status, 200);
        const d1 = await r1.json();
        assert.equal(d1.message, 'Order Placed successfully');

        // Retry with same idempotency key (idempotent replay)
        const r2 = await fetch(`${baseUrl}/api/test/order/cod`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-mock-auth-user': userId
            },
            body: JSON.stringify({ idempotencyKey, items: [{ productId: 'p1', quantity: 1 }] })
        });
        assert.equal(r2.status, 200);
        const d2 = await r2.json();
        assert.equal(d2.message, 'Order already processed (idempotent replay)');
    });

    it('window reset behavior deterministically unblocks requests after windowMs expires', async () => {
        // Fast window limiter allows 1 request per 150ms
        const r1 = await fetch(`${baseUrl}/api/test/fast-window`, { method: 'POST' });
        assert.equal(r1.status, 200);

        // Immediate subsequent request is blocked
        const r2 = await fetch(`${baseUrl}/api/test/fast-window`, { method: 'POST' });
        assert.equal(r2.status, 429);

        // Wait 180ms for window to expire
        await new Promise((resolve) => setTimeout(resolve, 180));

        // After window expiration, request is permitted again
        const r3 = await fetch(`${baseUrl}/api/test/fast-window`, { method: 'POST' });
        assert.equal(r3.status, 200);
    });

    it('rate limiter resetKey deterministically clears rate limit hits', async () => {
        const testLimiter = createUserRegisterLimiter({
            windowMs: 60 * 1000,
            limit: 1
        });

        const appReset = express();
        appReset.post('/reset-test', testLimiter, (req, res) => res.json({ success: true }));

        const s = appReset.listen(0, '127.0.0.1');
        await new Promise((resolve) => s.once('listening', resolve));
        const url = `http://127.0.0.1:${s.address().port}/reset-test`;

        try {
            // First request passes
            const res1 = await fetch(url, { method: 'POST' });
            assert.equal(res1.status, 200);

            // Second request blocked
            const res2 = await fetch(url, { method: 'POST' });
            assert.equal(res2.status, 429);

            // Reset key for 127.0.0.1
            await testLimiter.resetKey('127.0.0.1');

            // Request passes immediately after resetKey
            const res3 = await fetch(url, { method: 'POST' });
            assert.equal(res3.status, 200);
        } finally {
            await new Promise((resolve) => s.close(resolve));
        }
    });

    it('different client IPs have completely independent rate limit counters', async () => {
        const testLimiter = createUserRegisterLimiter({
            windowMs: 60 * 1000,
            limit: 1
        });
        const mockReq = (ip) => ({
            ip,
            app: { get: () => false },
            headers: {},
            method: 'POST',
            url: '/test'
        });
        const mockRes = () => {
            const res = {
                statusCode: 200,
                headers: {},
                setHeader(k, v) { this.headers[k.toLowerCase()] = String(v); return this; },
                getHeader(k) { return this.headers[k.toLowerCase()]; },
                status(c) { this.statusCode = c; return this; },
                json(d) { this.body = d; return this; },
                send(d) { this.body = d; return this; }
            };
            return res;
        };

        // IP A first attempt allowed
        const rA1 = mockRes();
        await testLimiter(mockReq('10.0.0.1'), rA1, () => {});
        assert.equal(rA1.statusCode, 200);

        // IP A second attempt blocked
        const rA2 = mockRes();
        await testLimiter(mockReq('10.0.0.1'), rA2, () => {});
        assert.equal(rA2.statusCode, 429);

        // IP B first attempt allowed (independent counter)
        const rB1 = mockRes();
        await testLimiter(mockReq('10.0.0.2'), rB1, () => {});
        assert.equal(rB1.statusCode, 200);
    });

    it('user login and user registration endpoints have isolated rate limits', async () => {
        const isolatedLoginLimiter = createUserLoginLimiter({ windowMs: 60 * 1000, limit: 1 });
        const isolatedRegisterLimiter = createUserRegisterLimiter({ windowMs: 60 * 1000, limit: 1 });

        const testApp = express();
        testApp.use(express.json());
        testApp.post('/login', isolatedLoginLimiter, (req, res) => res.json({ success: false, message: 'Invalid' }));
        testApp.post('/register', isolatedRegisterLimiter, (req, res) => res.json({ success: true }));

        const s = testApp.listen(0, '127.0.0.1');
        await new Promise((resolve) => s.once('listening', resolve));
        const port = s.address().port;

        try {
            // First login attempt fails and consumes budget
            const l1 = await fetch(`http://127.0.0.1:${port}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            assert.equal(l1.status, 200);

            // Second login attempt is blocked
            const l2 = await fetch(`http://127.0.0.1:${port}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            assert.equal(l2.status, 429);

            // Registration endpoint is NOT affected by login limiter exhaustion
            const reg1 = await fetch(`http://127.0.0.1:${port}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            assert.equal(reg1.status, 200);
            const reg1Data = await reg1.json();
            assert.equal(reg1Data.success, true);
        } finally {
            await new Promise((resolve) => s.close(resolve));
        }
    });

    it('production singleton limiters are properly configured and exported', () => {
        assert.equal(typeof userLoginLimiter, 'function');
        assert.equal(typeof userRegisterLimiter, 'function');
        assert.equal(typeof sellerLoginLimiter, 'function');
        assert.equal(typeof checkoutLimiter, 'function');

        // Check helper logic
        assert.equal(authRequestWasSuccessful({}, { statusCode: 200, locals: {} }), true);
        assert.equal(authRequestWasSuccessful({}, { statusCode: 200, locals: { authFailed: true } }), false);
        assert.equal(authRequestWasSuccessful({}, { statusCode: 401, locals: {} }), false);
        assert.equal(authRequestWasSuccessful({}, { statusCode: 500, locals: {} }), false);
    });
});
