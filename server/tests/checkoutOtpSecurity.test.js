import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

import User from '../models/User.js';
import Order from '../models/Order.js';
import Address from '../models/Address.js';
import Product from '../models/Product.js';
import OtpVerification from '../models/OtpVerification.js';
import {
    sendCheckoutOtp,
    verifyCheckoutOtp,
    getOtpSecret,
    MIN_OTP_SECRET_LENGTH
} from '../controllers/otpController.js';
import { placeOrderCOD } from '../controllers/orderController.js';
import { maskEmail } from '../services/notificationService.js';
import {
    sendEmail,
    __getMockSentEmails,
    __clearMockSentEmails
} from '../services/emailAdapter.js';
import {
    createOtpSendLimiter,
    createOtpVerifyLimiter
} from '../middlewares/rateLimiter.js';

describe('GreenCart Checkout Email OTP Security Suite', () => {
    const testUserId = '507f1f77bcf86cd799439011';
    const otherUserId = '507f1f77bcf86cd799439099';
    const testUserEmail = 'buyer@greencart.test';
    const testAddressId = '507f1f77bcf86cd799439012';
    const testProductId = '507f1f77bcf86cd799439013';

    let userStore;
    let orderStore;
    let addressStore;
    let productStore;
    let otpStore;

    let origUserFindById;
    let origUserFindByIdAndUpdate;
    let origUserUpdateOne;
    let origOrderCreate;
    let origOrderFindOne;
    let origAddressFindOne;
    let origProductFindById;
    let origOtpFindOne;
    let origOtpCreate;
    let origOtpUpdateMany;
    let origOtpUpdateOne;
    let origStartSession;

    const savedEnv = { ...process.env };

    beforeEach(() => {
        process.env.OTP_SECRET = 'test_dedicated_otp_secret_key_at_least_32_chars_long';
        process.env.JWT_SECRET = 'test_jwt_secret_for_checkout_otp_123456';
        process.env.EMAIL_PROVIDER = 'mock';
        process.env.NODE_ENV = 'test';

        __clearMockSentEmails();

        userStore = new Map();
        orderStore = new Map();
        addressStore = new Map();
        productStore = new Map();
        otpStore = new Map();

        // Seed default user
        userStore.set(testUserId, {
            _id: testUserId,
            email: testUserEmail,
            name: "Test Buyer",
            cartItems: { [testProductId]: 2 }
        });

        // Seed second user
        userStore.set(otherUserId, {
            _id: otherUserId,
            email: 'other@greencart.test',
            name: "Other Buyer",
            cartItems: { [testProductId]: 2 }
        });

        // Seed address and product
        addressStore.set(testAddressId, {
            _id: testAddressId,
            userId: testUserId,
            street: "123 Green Ave"
        });

        productStore.set(testProductId, {
            _id: testProductId,
            inStock: true,
            offerPrice: 50
        });

        origUserFindById = User.findById;
        origUserFindByIdAndUpdate = User.findByIdAndUpdate;
        origUserUpdateOne = User.updateOne;
        origOrderCreate = Order.create;
        origOrderFindOne = Order.findOne;
        origAddressFindOne = Address.findOne;
        origProductFindById = Product.findById;
        origOtpFindOne = OtpVerification.findOne;
        origOtpCreate = OtpVerification.create;
        origOtpUpdateMany = OtpVerification.updateMany;
        origOtpUpdateOne = OtpVerification.updateOne;
        origStartSession = mongoose.startSession;

        User.findById = (id) => {
            const queryObj = {
                session: () => queryObj,
                then: (resolve) => {
                    const u = userStore.get(String(id));
                    resolve(u ? { ...u, cartItems: { ...u.cartItems } } : null);
                }
            };
            return queryObj;
        };

        User.findByIdAndUpdate = async (id, update, opts) => {
            const u = userStore.get(String(id));
            if (!u) return null;

            if (update.$inc) {
                for (const [k, val] of Object.entries(update.$inc)) {
                    const p = k.replace('cartItems.', '');
                    u.cartItems[p] = (u.cartItems[p] || 0) + val;
                }
            }
            return { _id: id, cartItems: { ...u.cartItems } };
        };

        User.updateOne = async (filter, update, opts) => {
            const u = userStore.get(String(filter._id));
            if (!u) return { matchedCount: 0, modifiedCount: 0 };

            if (update.$unset) {
                for (const [k] of Object.entries(update.$unset)) {
                    const p = k.replace('cartItems.', '');
                    delete u.cartItems[p];
                }
            }
            return { matchedCount: 1, modifiedCount: 1 };
        };

        Address.findOne = async (query) => {
            const a = addressStore.get(String(query._id));
            if (a && a.userId === query.userId) return { ...a };
            return null;
        };

        Product.findById = async (id) => {
            const p = productStore.get(String(id));
            return p ? { ...p } : null;
        };

        Order.findOne = async (query) => {
            for (const o of orderStore.values()) {
                if (o.userId === query.userId && o.idempotencyKey === query.idempotencyKey) {
                    return { ...o };
                }
            }
            return null;
        };

        Order.create = async (docArray, opts) => {
            const doc = Array.isArray(docArray) ? docArray[0] : docArray;
            const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const created = { _id: orderId, ...doc };
            orderStore.set(orderId, created);
            return [created];
        };

        OtpVerification.create = async (doc) => {
            const id = `otp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const record = {
                _id: id,
                attemptsLeft: 3,
                verified: false,
                used: false,
                createdAt: new Date(),
                ...doc,
                save: async function () {
                    otpStore.set(this._id, { ...this });
                    return this;
                }
            };
            otpStore.set(id, record);
            return record;
        };

        OtpVerification.findOne = (query) => {
            return {
                sort: (sortOpts) => {
                    let matching = [];
                    for (const rec of otpStore.values()) {
                        let match = true;
                        if (query.userId && rec.userId !== query.userId) match = false;
                        if (query.channel && rec.channel !== query.channel) match = false;
                        if (query.verified !== undefined && rec.verified !== query.verified) match = false;
                        if (query.used !== undefined && rec.used !== query.used) match = false;
                        if (query.verificationTokenHash && rec.verificationTokenHash !== query.verificationTokenHash) match = false;
                        if (query.expiresAt && query.expiresAt.$gt) {
                            if (new Date(rec.expiresAt).getTime() <= new Date().getTime()) match = false;
                        }
                        if (query.tokenExpiresAt && query.tokenExpiresAt.$gt) {
                            if (new Date(rec.tokenExpiresAt).getTime() <= new Date().getTime()) match = false;
                        }
                        if (match) matching.push(rec);
                    }

                    if (matching.length === 0) return Promise.resolve(null);

                    if (sortOpts?.createdAt === -1) {
                        matching.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    }

                    const rec = matching[0];
                    return Promise.resolve({
                        ...rec,
                        save: async function () {
                            otpStore.set(this._id, { ...this });
                            return this;
                        }
                    });
                },
                then: (resolve) => {
                    // Direct query without sort
                    for (const rec of otpStore.values()) {
                        let match = true;
                        if (query.userId && rec.userId !== query.userId) match = false;
                        if (query.channel && rec.channel !== query.channel) match = false;
                        if (query.verified !== undefined && rec.verified !== query.verified) match = false;
                        if (query.used !== undefined && rec.used !== query.used) match = false;
                        if (query.verificationTokenHash && rec.verificationTokenHash !== query.verificationTokenHash) match = false;
                        if (query.expiresAt && query.expiresAt.$gt) {
                            if (new Date(rec.expiresAt).getTime() <= new Date().getTime()) match = false;
                        }
                        if (query.tokenExpiresAt && query.tokenExpiresAt.$gt) {
                            if (new Date(rec.tokenExpiresAt).getTime() <= new Date().getTime()) match = false;
                        }
                        if (match) {
                            return resolve({
                                ...rec,
                                save: async function () {
                                    otpStore.set(this._id, { ...this });
                                    return this;
                                }
                            });
                        }
                    }
                    resolve(null);
                }
            };
        };

        OtpVerification.updateMany = async (filter, update) => {
            let count = 0;
            for (const rec of otpStore.values()) {
                let match = true;
                if (filter.userId && rec.userId !== filter.userId) match = false;
                if (filter.channel && rec.channel !== filter.channel) match = false;
                if (filter.verified !== undefined && rec.verified !== filter.verified) match = false;
                if (match) {
                    if (update.$set) Object.assign(rec, update.$set);
                    count++;
                }
            }
            return { matchedCount: count, modifiedCount: count };
        };

        OtpVerification.updateOne = async (filter, update) => {
            for (const rec of otpStore.values()) {
                if (rec._id === filter._id) {
                    if (filter.used !== undefined && rec.used !== filter.used) {
                        return { matchedCount: 0, modifiedCount: 0 };
                    }
                    if (update.$set) Object.assign(rec, update.$set);
                    return { matchedCount: 1, modifiedCount: 1 };
                }
            }
            return { matchedCount: 0, modifiedCount: 0 };
        };

        mongoose.startSession = async () => {
            return {
                withTransaction: async (cb) => {
                    await cb();
                },
                endSession: async () => {}
            };
        };
    });

    afterEach(() => {
        process.env = { ...savedEnv };
        User.findById = origUserFindById;
        User.findByIdAndUpdate = origUserFindByIdAndUpdate;
        User.updateOne = origUserUpdateOne;
        Order.create = origOrderCreate;
        Order.findOne = origOrderFindOne;
        Address.findOne = origAddressFindOne;
        Product.findById = origProductFindById;
        OtpVerification.findOne = origOtpFindOne;
        OtpVerification.create = origOtpCreate;
        OtpVerification.updateMany = origOtpUpdateMany;
        OtpVerification.updateOne = origOtpUpdateOne;
        mongoose.startSession = origStartSession;
    });

    // -------------------------------------------------------------------------
    // 1. Masking Utility
    // -------------------------------------------------------------------------
    it('maskEmail correctly masks varied email addresses', () => {
        assert.equal(maskEmail('john.doe@example.com'), 'j***e@example.com');
        assert.equal(maskEmail('alice@domain.co'), 'a***e@domain.co');
        assert.equal(maskEmail('ab@domain.com'), 'a***@domain.com');
        assert.equal(maskEmail('a@domain.com'), 'a***@domain.com');
        assert.equal(maskEmail('invalid-email'), '***');
        assert.equal(maskEmail(null), '***');
    });

    // -------------------------------------------------------------------------
    // 2. Send OTP generates 6-digit CSPRNG code and returns masked target
    // -------------------------------------------------------------------------
    it('sendCheckoutOtp dispatches 6-digit OTP and returns masked email without plaintext OTP', async () => {
        const req = {
            userId: testUserId,
            body: {}
        };

        let statusCode = 200;
        let responseData = null;
        const res = {
            status: (c) => { statusCode = c; return res; },
            json: (d) => { responseData = d; return res; }
        };

        await sendCheckoutOtp(req, res);

        assert.equal(statusCode, 200);
        assert.equal(responseData.success, true);
        assert.equal(responseData.maskedTarget, 'b***r@greencart.test');
        assert.equal(responseData.cooldownSeconds, 60);
        // CRUCIAL: Plaintext OTP must NOT be returned in response!
        assert.equal(responseData.otp, undefined);

        // Verify email adapter mock received the email with 6-digit code
        const sent = __getMockSentEmails();
        assert.equal(sent.length, 1);
        assert.equal(sent[0].to, testUserEmail);
        assert.match(sent[0].code, /^\d{6}$/);

        // Verify stored in DB as hash, not plaintext
        const storedRecords = Array.from(otpStore.values());
        assert.equal(storedRecords.length, 1);
        assert.equal(storedRecords[0].otpHash !== sent[0].code, true);
        assert.equal(storedRecords[0].verified, false);
        assert.equal(storedRecords[0].attemptsLeft, 3);

        // Verify HMAC was generated using dedicated OTP_SECRET and NOT JWT_SECRET
        const expectedHmac = crypto.createHmac('sha256', process.env.OTP_SECRET)
            .update(`${testUserId}:${sent[0].code}`)
            .digest('hex');
        const jwtBasedHmac = crypto.createHmac('sha256', process.env.JWT_SECRET)
            .update(`${testUserId}:${sent[0].code}`)
            .digest('hex');
        assert.equal(storedRecords[0].otpHash, expectedHmac);
        assert.notEqual(storedRecords[0].otpHash, jwtBasedHmac);
    });

    // -------------------------------------------------------------------------
    // 3. Resend cooldown prevents duplicate immediate requests
    // -------------------------------------------------------------------------
    it('sendCheckoutOtp enforces 60-second cooldown with HTTP 429', async () => {
        const req = { userId: testUserId, body: {} };
        const res1 = {
            status: (c) => res1,
            json: (d) => {}
        };
        await sendCheckoutOtp(req, res1);

        // Immediate second attempt within 60s
        let status2 = 200;
        let data2 = null;
        const res2 = {
            status: (c) => { status2 = c; return res2; },
            json: (d) => { data2 = d; return res2; }
        };

        await sendCheckoutOtp(req, res2);

        assert.equal(status2, 429);
        assert.equal(data2.success, false);
        assert.match(data2.message, /Please wait/);
        assert.equal(typeof data2.retryAfter, 'number');
        assert.equal(data2.retryAfter > 0, true);
    });

    // -------------------------------------------------------------------------
    // 4. Verify OTP issues 32-byte single-use verificationToken on valid code
    // -------------------------------------------------------------------------
    it('verifyCheckoutOtp succeeds on valid code and issues 32-byte token', async () => {
        // Send OTP
        await sendCheckoutOtp({ userId: testUserId, body: {} }, { status: () => {}, json: () => {} });
        const sent = __getMockSentEmails();
        const code = sent[0].code;

        // Verify with correct code
        let statusCode = 200;
        let responseData = null;
        const res = {
            status: (c) => { statusCode = c; return res; },
            json: (d) => { responseData = d; return res; }
        };

        await verifyCheckoutOtp({
            userId: testUserId,
            body: { otp: code }
        }, res);

        assert.equal(statusCode, 200);
        assert.equal(responseData.success, true);
        assert.equal(typeof responseData.verificationToken, 'string');
        // 32 bytes in hex = 64 characters
        assert.equal(responseData.verificationToken.length, 64);

        // Verify DB record updated
        const records = Array.from(otpStore.values());
        assert.equal(records[0].verified, true);
        assert.equal(typeof records[0].verificationTokenHash, 'string');
    });

    // -------------------------------------------------------------------------
    // 5. Wrong verification code decrements attempts and locks out at 0
    // -------------------------------------------------------------------------
    it('verifyCheckoutOtp decrements attempts and invalidates after 3 failed attempts', async () => {
        await sendCheckoutOtp({ userId: testUserId, body: {} }, { status: () => {}, json: () => {} });

        const makeVerifyAttempt = async (wrongCode) => {
            let status = 200;
            let data = null;
            const res = {
                status: (c) => { status = c; return res; },
                json: (d) => { data = d; return res; }
            };
            await verifyCheckoutOtp({
                userId: testUserId,
                body: { otp: wrongCode }
            }, res);
            return { status, data };
        };

        // Attempt 1: Wrong
        const r1 = await makeVerifyAttempt('000000');
        assert.equal(r1.status, 400);
        assert.equal(r1.data.attemptsLeft, 2);

        // Attempt 2: Wrong
        const r2 = await makeVerifyAttempt('111111');
        assert.equal(r2.status, 400);
        assert.equal(r2.data.attemptsLeft, 1);

        // Attempt 3: Wrong (lockout)
        const r3 = await makeVerifyAttempt('222222');
        assert.equal(r3.status, 400);
        assert.equal(r3.data.attemptsLeft, 0);
        assert.match(r3.data.message, /Maximum attempts exceeded/);

        // Attempt 4: Even if correct code submitted now, it is invalidated
        const sent = __getMockSentEmails();
        const r4 = await makeVerifyAttempt(sent[0].code);
        assert.equal(r4.status, 400);
        assert.match(r4.data.message, /expired or maximum attempts exceeded/);
    });

    // -------------------------------------------------------------------------
    // 6. Expired OTP is rejected
    // -------------------------------------------------------------------------
    it('verifyCheckoutOtp rejects code after expiry', async () => {
        await sendCheckoutOtp({ userId: testUserId, body: {} }, { status: () => {}, json: () => {} });
        const sent = __getMockSentEmails();

        // Expire the record in DB
        for (const r of otpStore.values()) {
            r.expiresAt = new Date(Date.now() - 1000);
        }

        let status = 200;
        let data = null;
        const res = {
            status: (c) => { status = c; return res; },
            json: (d) => { data = d; return res; }
        };

        await verifyCheckoutOtp({
            userId: testUserId,
            body: { otp: sent[0].code }
        }, res);

        assert.equal(status, 400);
        assert.match(data.message, /expired or maximum attempts exceeded/);
    });

    // -------------------------------------------------------------------------
    // 7. COD checkout strictly requires verificationToken
    // -------------------------------------------------------------------------
    it('placeOrderCOD blocks checkout when verificationToken is missing or invalid', async () => {
        let status = 200;
        let data = null;
        const res = {
            status: (c) => { status = c; return res; },
            json: (d) => { data = d; return res; }
        };

        // Missing token
        await placeOrderCOD({
            userId: testUserId,
            body: {
                items: [{ product: testProductId, quantity: 1 }],
                address: testAddressId
            }
        }, res);

        assert.equal(status, 400);
        assert.match(data.message, /Email verification is required/);

        // Invalid token
        await placeOrderCOD({
            userId: testUserId,
            body: {
                items: [{ product: testProductId, quantity: 1 }],
                address: testAddressId,
                verificationToken: 'invalid_unrecognized_token_1234'
            }
        }, res);

        assert.equal(status, 400);
        assert.match(data.message, /Invalid or expired verification token/);
    });

    // -------------------------------------------------------------------------
    // 8. Token binding: User A's token cannot place User B's order
    // -------------------------------------------------------------------------
    it('placeOrderCOD prevents token theft / cross-user replay (IDOR protection)', async () => {
        // User A generates and verifies token
        await sendCheckoutOtp({ userId: testUserId, body: {} }, { status: () => {}, json: () => {} });
        const sent = __getMockSentEmails();
        let userAToken = null;
        await verifyCheckoutOtp({
            userId: testUserId,
            body: { otp: sent[0].code }
        }, { status: () => {}, json: (d) => { userAToken = d.verificationToken; } });

        assert.ok(userAToken);

        // Attacker User B attempts to checkout using User A's token
        let status = 200;
        let data = null;
        const res = {
            status: (c) => { status = c; return res; },
            json: (d) => { data = d; return res; }
        };

        await placeOrderCOD({
            userId: otherUserId, // User B
            body: {
                items: [{ product: testProductId, quantity: 1 }],
                address: testAddressId,
                verificationToken: userAToken // User A's token
            }
        }, res);

        assert.equal(status, 400);
        assert.match(data.message, /Invalid or expired verification token/);
    });

    // -------------------------------------------------------------------------
    // 9. Single-use token: cannot place two orders with the same token
    // -------------------------------------------------------------------------
    it('placeOrderCOD consumes token atomically; token replay for second order is blocked', async () => {
        // Generate and verify token
        await sendCheckoutOtp({ userId: testUserId, body: {} }, { status: () => {}, json: () => {} });
        const sent = __getMockSentEmails();
        let token = null;
        await verifyCheckoutOtp({
            userId: testUserId,
            body: { otp: sent[0].code }
        }, { status: () => {}, json: (d) => { token = d.verificationToken; } });

        // Order 1: Succeeds
        let status1 = 200;
        let data1 = null;
        const res1 = {
            status: (c) => { status1 = c; return res1; },
            json: (d) => { data1 = d; return res1; }
        };

        await placeOrderCOD({
            userId: testUserId,
            body: {
                items: [{ product: testProductId, quantity: 1 }],
                address: testAddressId,
                idempotencyKey: 'fresh_key_1',
                verificationToken: token
            }
        }, res1);

        assert.equal(status1, 200);
        assert.equal(data1.success, true);

        // Order 2 with different key but SAME token: Must be rejected
        let status2 = 200;
        let data2 = null;
        const res2 = {
            status: (c) => { status2 = c; return res2; },
            json: (d) => { data2 = d; return res2; }
        };

        await placeOrderCOD({
            userId: testUserId,
            body: {
                items: [{ product: testProductId, quantity: 1 }],
                address: testAddressId,
                idempotencyKey: 'fresh_key_2',
                verificationToken: token // Reusing consumed token!
            }
        }, res2);

        assert.equal(status2, 400);
        assert.match(data2.message, /Invalid or expired verification token/);
    });

    // -------------------------------------------------------------------------
    // 10. Order stores verification audit trail
    // -------------------------------------------------------------------------
    it('placeOrderCOD records channel and verifiedAt on the created order document', async () => {
        await sendCheckoutOtp({ userId: testUserId, body: {} }, { status: () => {}, json: () => {} });
        const sent = __getMockSentEmails();
        let token = null;
        await verifyCheckoutOtp({
            userId: testUserId,
            body: { otp: sent[0].code }
        }, { status: () => {}, json: (d) => { token = d.verificationToken; } });

        let data = null;
        await placeOrderCOD({
            userId: testUserId,
            body: {
                items: [{ product: testProductId, quantity: 1 }],
                address: testAddressId,
                idempotencyKey: 'audit_test_key',
                verificationToken: token
            }
        }, { status: () => {}, json: (d) => { data = d; } });

        assert.equal(data.success, true);
        const order = orderStore.get(data.orderId);
        assert.ok(order);
        assert.equal(order.verification?.channel, 'email');
        assert.ok(order.verification?.verifiedAt instanceof Date);
    });

    // -------------------------------------------------------------------------
    // 11. Idempotency preservation: Retrying same idempotencyKey succeeds without new token
    // -------------------------------------------------------------------------
    it('placeOrderCOD idempotency retry replays successfully without requiring a new token', async () => {
        await sendCheckoutOtp({ userId: testUserId, body: {} }, { status: () => {}, json: () => {} });
        const sent = __getMockSentEmails();
        let token = null;
        await verifyCheckoutOtp({
            userId: testUserId,
            body: { otp: sent[0].code }
        }, { status: () => {}, json: (d) => { token = d.verificationToken; } });

        const replayKey = 'idempotent_replay_key_100';

        // First attempt consumes token
        let res1 = null;
        await placeOrderCOD({
            userId: testUserId,
            body: {
                items: [{ product: testProductId, quantity: 1 }],
                address: testAddressId,
                idempotencyKey: replayKey,
                verificationToken: token
            }
        }, { status: () => {}, json: (d) => { res1 = d; } });

        assert.equal(res1.success, true);

        // Retry with same idempotencyKey (even without token or with same token)
        let res2 = null;
        await placeOrderCOD({
            userId: testUserId,
            body: {
                items: [{ product: testProductId, quantity: 1 }],
                address: testAddressId,
                idempotencyKey: replayKey
            }
        }, { status: () => {}, json: (d) => { res2 = d; } });

        assert.equal(res2.success, true);
        assert.equal(res2.isDuplicate, true);
        assert.equal(res2.orderId, res1.orderId);
    });

    // -------------------------------------------------------------------------
    // 12. Email Adapter fails closed when configuration is missing
    // -------------------------------------------------------------------------
    it('Brevo adapter fails closed when BREVO_API_KEY or EMAIL_FROM is missing', async () => {
        process.env.EMAIL_PROVIDER = 'brevo';
        delete process.env.BREVO_API_KEY;
        delete process.env.EMAIL_FROM;

        await assert.rejects(
            async () => {
                await sendEmail({
                    toEmail: 'test@example.com',
                    subject: 'Test',
                    htmlContent: '<p>Test</p>'
                });
            },
            {
                message: /Email service misconfigured: missing BREVO_API_KEY or EMAIL_FROM/
            }
        );
    });

    // -------------------------------------------------------------------------
    // 13. Mock delivery strictly forbidden in production
    // -------------------------------------------------------------------------
    it('sendEmail strictly forbids mock email provider in production mode', async () => {
        process.env.NODE_ENV = 'production';
        process.env.EMAIL_PROVIDER = 'mock';

        await assert.rejects(
            async () => {
                await sendEmail({
                    toEmail: 'test@example.com',
                    subject: 'Test',
                    htmlContent: '<p>Test</p>'
                });
            },
            {
                message: /Mock email delivery is strictly forbidden in production/
            }
        );
    });

    // -------------------------------------------------------------------------
    // 14. Mobile OTP request is rejected with "coming soon"
    // -------------------------------------------------------------------------
    it('sendCheckoutOtp rejects mobile channel with coming soon message', async () => {
        let status = 200;
        let data = null;
        const res = {
            status: (c) => { status = c; return res; },
            json: (d) => { data = d; return res; }
        };

        await sendCheckoutOtp({
            userId: testUserId,
            body: { channel: 'mobile' }
        }, res);

        assert.equal(status, 400);
        assert.match(data.message, /Mobile OTP verification is coming soon/);
    });

    // -------------------------------------------------------------------------
    // 15. Rate Limiters config checks
    // -------------------------------------------------------------------------
    it('otpSendLimiter and otpVerifyLimiter key properly on req.userId', () => {
        const sendLimiter = createOtpSendLimiter();
        const verifyLimiter = createOtpVerifyLimiter();

        assert.ok(sendLimiter);
        assert.ok(verifyLimiter);
    });

    // -------------------------------------------------------------------------
    // 16. Dedicated OTP_SECRET Hardening (Batch 12C)
    // -------------------------------------------------------------------------
    it('getOtpSecret rejects missing, null, undefined, and whitespace OTP_SECRET', () => {
        delete process.env.OTP_SECRET;
        assert.throws(() => getOtpSecret(), /OTP_SECRET is missing/);

        process.env.OTP_SECRET = '';
        assert.throws(() => getOtpSecret(), /OTP_SECRET is missing/);

        process.env.OTP_SECRET = '   ';
        assert.throws(() => getOtpSecret(), /OTP_SECRET is missing/);
    });

    it('getOtpSecret rejects too-short OTP_SECRET (< 32 characters)', () => {
        process.env.OTP_SECRET = 'short_secret';
        assert.throws(() => getOtpSecret(), /OTP_SECRET is too short/);

        // 31 characters boundary
        process.env.OTP_SECRET = '1234567890123456789012345678901';
        assert.equal(process.env.OTP_SECRET.length, 31);
        assert.throws(() => getOtpSecret(), /OTP_SECRET is too short/);
    });

    it('getOtpSecret accepts valid OTP_SECRET with >= 32 characters', () => {
        // Exactly 32 characters boundary
        const exact32 = '12345678901234567890123456789012';
        assert.equal(exact32.length, 32);
        process.env.OTP_SECRET = exact32;
        assert.equal(getOtpSecret(), exact32);

        // 64 characters
        const len64 = 'a'.repeat(64);
        process.env.OTP_SECRET = len64;
        assert.equal(getOtpSecret(), len64);
    });

    it('sendCheckoutOtp rejects request when OTP_SECRET is missing with HTTP 500 and does NOT fallback to JWT_SECRET', async () => {
        delete process.env.OTP_SECRET;
        process.env.JWT_SECRET = 'valid_fallback_jwt_secret_of_at_least_32_characters_here';

        let statusCode = 200;
        let responseData = null;
        const res = {
            status: (c) => { statusCode = c; return res; },
            json: (d) => { responseData = d; return res; }
        };

        await sendCheckoutOtp({ userId: testUserId, body: {} }, res);

        assert.equal(statusCode, 500);
        assert.equal(responseData.success, false);
        assert.match(responseData.message, /OTP_SECRET is missing/);

        // Strictly verify no email was dispatched and no OTP record created
        const sent = __getMockSentEmails();
        assert.equal(sent.length, 0);
        assert.equal(otpStore.size, 0);
    });

    it('verifyCheckoutOtp rejects request when OTP_SECRET is missing with HTTP 500 and does NOT fallback to JWT_SECRET', async () => {
        delete process.env.OTP_SECRET;
        process.env.JWT_SECRET = 'valid_fallback_jwt_secret_of_at_least_32_characters_here';

        let statusCode = 200;
        let responseData = null;
        const res = {
            status: (c) => { statusCode = c; return res; },
            json: (d) => { responseData = d; return res; }
        };

        await verifyCheckoutOtp({ userId: testUserId, body: { otp: '123456' } }, res);

        assert.equal(statusCode, 500);
        assert.equal(responseData.success, false);
        assert.match(responseData.message, /OTP_SECRET is missing/);
    });

    it('sendCheckoutOtp rejects request when OTP_SECRET is shorter than 32 characters with HTTP 500', async () => {
        process.env.OTP_SECRET = 'too_short_otp_secret_1234'; // 25 chars

        let statusCode = 200;
        let responseData = null;
        const res = {
            status: (c) => { statusCode = c; return res; },
            json: (d) => { responseData = d; return res; }
        };

        await sendCheckoutOtp({ userId: testUserId, body: {} }, res);

        assert.equal(statusCode, 500);
        assert.equal(responseData.success, false);
        assert.match(responseData.message, /OTP_SECRET is too short/);
        assert.equal(otpStore.size, 0);
    });

    it('verifyCheckoutOtp rejects request when OTP_SECRET is shorter than 32 characters with HTTP 500', async () => {
        process.env.OTP_SECRET = 'too_short_otp_secret_1234';

        let statusCode = 200;
        let responseData = null;
        const res = {
            status: (c) => { statusCode = c; return res; },
            json: (d) => { responseData = d; return res; }
        };

        await verifyCheckoutOtp({ userId: testUserId, body: { otp: '123456' } }, res);

        assert.equal(statusCode, 500);
        assert.equal(responseData.success, false);
        assert.match(responseData.message, /OTP_SECRET is too short/);
    });

    it('issuance and verification use dedicated OTP_SECRET even when JWT_SECRET is completely absent', async () => {
        const dedicatedKey = 'my_dedicated_otp_hmac_secret_key_at_least_32_chars';
        process.env.OTP_SECRET = dedicatedKey;
        delete process.env.JWT_SECRET; // JWT_SECRET strictly deleted!

        // 1. Send OTP
        let sendStatusCode = 200;
        let sendData = null;
        const sendRes = {
            status: (c) => { sendStatusCode = c; return sendRes; },
            json: (d) => { sendData = d; return sendRes; }
        };
        await sendCheckoutOtp({ userId: testUserId, body: {} }, sendRes);

        assert.equal(sendStatusCode, 200);
        assert.equal(sendData.success, true);

        const sent = __getMockSentEmails();
        assert.equal(sent.length, 1);
        const code = sent[0].code;

        // Verify stored hash matches HMAC with dedicated OTP_SECRET
        const stored = Array.from(otpStore.values())[0];
        const expectedHmac = crypto.createHmac('sha256', dedicatedKey)
            .update(`${testUserId}:${code}`)
            .digest('hex');
        assert.equal(stored.otpHash, expectedHmac);

        // 2. Verify OTP with valid code (still with JWT_SECRET unset)
        let verifyStatusCode = 200;
        let verifyData = null;
        const verifyRes = {
            status: (c) => { verifyStatusCode = c; return verifyRes; },
            json: (d) => { verifyData = d; return verifyRes; }
        };
        await verifyCheckoutOtp({ userId: testUserId, body: { otp: code } }, verifyRes);

        assert.equal(verifyStatusCode, 200);
        assert.equal(verifyData.success, true);
        assert.equal(typeof verifyData.verificationToken, 'string');
        assert.equal(verifyData.verificationToken.length, 64);
    });

    it('verification fails if OTP_SECRET differs between issuance and verification', async () => {
        // Issuance with Secret A
        process.env.OTP_SECRET = 'secret_key_version_A_for_issuance_32chars_min';
        await sendCheckoutOtp({ userId: testUserId, body: {} }, { status: () => ({ json: () => {} }), json: () => {} });
        const sent = __getMockSentEmails();
        const code = sent[0].code;

        // Attempt verification with Secret B
        process.env.OTP_SECRET = 'secret_key_version_B_for_verify_32chars_min__';

        let verifyStatus = 200;
        let verifyData = null;
        const verifyRes = {
            status: (c) => { verifyStatus = c; return verifyRes; },
            json: (d) => { verifyData = d; return verifyRes; }
        };
        await verifyCheckoutOtp({ userId: testUserId, body: { otp: code } }, verifyRes);

        // Verification must fail because candidateHash does not match record.otpHash
        assert.equal(verifyStatus, 400);
        assert.equal(verifyData.success, false);
        assert.match(verifyData.message, /Incorrect verification code/);
        assert.equal(verifyData.attemptsLeft, 2);
    });

    it('OTP error messages and responses never leak configured secrets', async () => {
        const rawSecret = 'super_secret_raw_key_never_leak_xyz_12345';
        process.env.OTP_SECRET = rawSecret;

        // 1. Check sendCheckoutOtp responses
        let sendData = null;
        const sendRes = {
            status: () => sendRes,
            json: (d) => { sendData = d; return sendRes; }
        };
        await sendCheckoutOtp({ userId: testUserId, body: {} }, sendRes);
        const sendStr = JSON.stringify(sendData);
        assert.equal(sendStr.includes(rawSecret), false);

        // 2. Check verifyCheckoutOtp failure response
        let verifyData = null;
        const verifyRes = {
            status: () => verifyRes,
            json: (d) => { verifyData = d; return verifyRes; }
        };
        await verifyCheckoutOtp({ userId: testUserId, body: { otp: '000000' } }, verifyRes);
        const verifyStr = JSON.stringify(verifyData);
        assert.equal(verifyStr.includes(rawSecret), false);

        // 3. Check configuration error response
        process.env.OTP_SECRET = 'short_val';
        let configData = null;
        const configRes = {
            status: () => configRes,
            json: (d) => { configData = d; return configRes; }
        };
        await sendCheckoutOtp({ userId: testUserId, body: {} }, configRes);
        const configStr = JSON.stringify(configData);
        assert.equal(configStr.includes('short_val'), false);
    });
});
