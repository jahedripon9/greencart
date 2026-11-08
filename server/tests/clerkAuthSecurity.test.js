import { describe, it, before, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { clerkGoogleAuth } from '../controllers/userController.js';
import User from '../models/User.js';
import authSeller from '../middlewares/authSeller.js';
import { _setMockUserLookup, _clearMockUserLookup, ClerkConfigurationError } from '../services/clerkService.js';

// Setup test secret for Clerk mock tokens
const TEST_JWT_SECRET = 'greencart_test_jwt_secret_key_32_characters_minimum_12345';
const TEST_CLERK_SECRET = 'test_clerk_secret_mock_32_characters_key';

process.env.JWT_SECRET = TEST_JWT_SECRET;
process.env.TEST_CLERK_SECRET = TEST_CLERK_SECRET;
process.env.NODE_ENV = 'test';
process.env.SELLER_EMAIL = 'seller@greencart.com';
process.env.SELLER_PASSWORD = 'SellerPassword123!';

/**
 * Creates a valid signed mock Clerk JWT token for testing.
 */
function createMockClerkToken(payloadOverrides = {}, signOptions = {}) {
    const defaultPayload = {
        sub: 'user_clerk_google_default_123',
        email: 'customer@gmail.com',
        email_verified: true,
        name: 'Google Customer'
    };
    const payload = { ...defaultPayload, ...payloadOverrides };
    return jwt.sign(payload, TEST_CLERK_SECRET, { expiresIn: '1h', ...signOptions });
}

/**
 * Mock Express response factory
 */
function createMockRes() {
    return {
        statusCode: 200,
        cookies: {},
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        },
        cookie(name, val, options) {
            this.cookies[name] = { val, options };
            return this;
        },
        clearCookie(name, options) {
            delete this.cookies[name];
            this.clearedCookie = { name, options };
            return this;
        }
    };
}

describe('GreenCart Phase 1: Clerk Google Authentication & Token Bridge Security Suite', () => {

    // In-memory mock database store for User
    let mockUsers = [];

    before(() => {
        // Mock User model methods to run in-memory without live MongoDB connection
        User.findOne = async (query) => {
            if (query.clerkId) {
                return mockUsers.find(u => u.clerkId === query.clerkId) || null;
            }
            if (query.email) {
                return mockUsers.find(u => u.email === query.email) || null;
            }
            if (query._id) {
                return mockUsers.find(u => String(u._id) === String(query._id)) || null;
            }
            return null;
        };

        User.findById = async (id) => {
            const user = mockUsers.find(u => String(u._id) === String(id));
            if (!user) return null;
            return {
                ...user,
                select: (fields) => {
                    if (fields === '-password') {
                        const { password, ...safeUser } = user;
                        return safeUser;
                    }
                    return user;
                }
            };
        };

        User.create = async (doc) => {
            const id = '507f1f77bcf86cd799439' + (mockUsers.length + 10).toString(16).padStart(4, '0');
            const created = {
                _id: id,
                ...doc,
                cartItems: doc.cartItems || {},
                authProvider: doc.authProvider || (doc.clerkId ? ['google'] : ['email']),
                save: async function () {
                    const idx = mockUsers.findIndex(u => String(u._id) === String(this._id));
                    if (idx !== -1) mockUsers[idx] = this;
                    return this;
                }
            };
            mockUsers.push(created);
            return created;
        };
    });

    beforeEach(() => {
        mockUsers = [];
    });

    afterEach(() => {
        _clearMockUserLookup();
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = TEST_JWT_SECRET;
        process.env.TEST_CLERK_SECRET = TEST_CLERK_SECRET;
        delete process.env.CLERK_SECRET_KEY;
        delete process.env.CLERK_JWT_KEY;
        delete process.env.CLERK_ISSUER;
        delete process.env.CLERK_AUTHORIZED_PARTIES;
    });

    // -------------------------------------------------------------------------
    // 1. Brand New Customer Google Registration
    // -------------------------------------------------------------------------
    it('creates a new customer account upon first-time Google sign-in and sets standard GreenCart cookie', async () => {
        const token = createMockClerkToken({
            sub: 'user_clerk_new_001',
            email: 'newuser@gmail.com',
            email_verified: true,
            name: 'New Google User'
        });

        const req = { body: { clerkToken: token } };
        const res = createMockRes();

        await clerkGoogleAuth(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.user.email, 'newuser@gmail.com');
        assert.equal(res.body.user.name, 'New Google User');

        // Verify cookie is issued
        assert.ok(res.cookies.token, 'Must set GreenCart token cookie');
        assert.equal(res.cookies.token.options.httpOnly, true);
        assert.equal(res.cookies.token.options.maxAge, 7 * 24 * 60 * 60 * 1000);

        // Verify GreenCart JWT payload contains customer _id
        const decoded = jwt.verify(res.cookies.token.val, TEST_JWT_SECRET);
        assert.ok(decoded.id);

        // Verify database state
        const saved = mockUsers.find(u => u.clerkId === 'user_clerk_new_001');
        assert.ok(saved);
        assert.equal(saved.email, 'newuser@gmail.com');
        assert.deepEqual(saved.authProvider, ['google']);
        assert.equal(saved.password, undefined, 'Google-only user should not have a password required');
    });

    // -------------------------------------------------------------------------
    // 2. Returning Google Customer Login
    // -------------------------------------------------------------------------
    it('logs in returning Google customer without creating duplicate database records', async () => {
        // Pre-create user with clerkId
        const existing = await User.create({
            name: 'Returning User',
            email: 'returning@gmail.com',
            clerkId: 'user_clerk_return_002',
            authProvider: ['google']
        });

        const token = createMockClerkToken({
            sub: 'user_clerk_return_002',
            email: 'returning@gmail.com',
            email_verified: true
        });

        const req = { body: { clerkToken: token } };
        const res = createMockRes();

        await clerkGoogleAuth(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);

        // Verify no duplicate users created
        const matching = mockUsers.filter(u => u.clerkId === 'user_clerk_return_002');
        assert.equal(matching.length, 1);

        // Verify issued token matches original user _id
        const decoded = jwt.verify(res.cookies.token.val, TEST_JWT_SECRET);
        assert.equal(decoded.id, existing._id);
    });

    // -------------------------------------------------------------------------
    // 3. Option B: Existing Email/Password User Attempting Google Login (Password Challenge)
    // -------------------------------------------------------------------------
    it('Option B: prompts for password when an existing Email/Password user attempts Google sign-in without password', async () => {
        // Pre-create user with email and password
        const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
        await User.create({
            name: 'Alice Resident',
            email: 'alice@example.com',
            password: hashedPassword,
            authProvider: ['email']
        });

        // Alice attempts to log in with Google using matching email
        const token = createMockClerkToken({
            sub: 'user_clerk_alice_003',
            email: 'alice@example.com',
            email_verified: true
        });

        const req = { body: { clerkToken: token } }; // No linkPassword provided
        const res = createMockRes();

        await clerkGoogleAuth(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, false);
        assert.equal(res.body.requirePasswordLink, true, 'Must indicate password link challenge required');
        assert.equal(res.body.email, 'alice@example.com');
        assert.equal(res.cookies.token, undefined, 'Must NOT issue session cookie before password challenge');

        // Database user clerkId must still be unlinked
        const user = mockUsers.find(u => u.email === 'alice@example.com');
        assert.equal(user.clerkId, undefined);
    });

    // -------------------------------------------------------------------------
    // 4. Option B: Incorrect Password Rejection
    // -------------------------------------------------------------------------
    it('Option B: rejects account linking if wrong password is provided during password challenge', async () => {
        const hashedPassword = await bcrypt.hash('CorrectPassword123!', 10);
        await User.create({
            name: 'Bob Resident',
            email: 'bob@example.com',
            password: hashedPassword,
            authProvider: ['email']
        });

        const token = createMockClerkToken({
            sub: 'user_clerk_bob_004',
            email: 'bob@example.com',
            email_verified: true
        });

        const req = { body: { clerkToken: token, linkPassword: 'WrongPassword!' } };
        const res = createMockRes();

        await clerkGoogleAuth(req, res);

        assert.equal(res.statusCode, 401);
        assert.equal(res.body.success, false);
        assert.equal(res.body.requirePasswordLink, true);
        assert.match(res.body.message, /Incorrect password/i);
        assert.equal(res.cookies.token, undefined, 'Must NOT issue session cookie on wrong password');

        const user = mockUsers.find(u => u.email === 'bob@example.com');
        assert.equal(user.clerkId, undefined, 'clerkId must remain unlinked on failure');
    });

    // -------------------------------------------------------------------------
    // 5. Option B: Successful Password-Challenge Account Linking
    // -------------------------------------------------------------------------
    it('Option B: links Google account upon correct password verification and preserves original user _id', async () => {
        const hashedPassword = await bcrypt.hash('Secret1234!', 10);
        const originalUser = await User.create({
            name: 'Carol Resident',
            email: 'carol@example.com',
            password: hashedPassword,
            authProvider: ['email'],
            cartItems: { 'prod_123': 2 }
        });

        const token = createMockClerkToken({
            sub: 'user_clerk_carol_005',
            email: 'carol@example.com',
            email_verified: true
        });

        const req = { body: { clerkToken: token, linkPassword: 'Secret1234!' } };
        const res = createMockRes();

        await clerkGoogleAuth(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.match(res.body.message, /linked successfully/i);

        // Verify cookie points to the ORIGINAL user _id
        assert.ok(res.cookies.token);
        const decoded = jwt.verify(res.cookies.token.val, TEST_JWT_SECRET);
        assert.equal(decoded.id, originalUser._id, 'Linked session MUST retain original MongoDB _id for orders/cart');

        // Verify database state: clerkId is now linked, authProvider has both email and google
        const updatedUser = mockUsers.find(u => u.email === 'carol@example.com');
        assert.equal(updatedUser.clerkId, 'user_clerk_carol_005');
        assert.ok(updatedUser.authProvider.includes('email'));
        assert.ok(updatedUser.authProvider.includes('google'));
        assert.deepEqual(updatedUser.cartItems, { 'prod_123': 2 }, 'Preserves existing cart items');
    });

    // -------------------------------------------------------------------------
    // 6. Subsequent Google Login by Linked User
    // -------------------------------------------------------------------------
    it('allows linked customer to sign in with Google without re-prompting for password', async () => {
        const hashedPassword = await bcrypt.hash('Secret1234!', 10);
        await User.create({
            name: 'Carol Resident',
            email: 'carol@example.com',
            password: hashedPassword,
            clerkId: 'user_clerk_carol_005',
            authProvider: ['email', 'google']
        });

        const token = createMockClerkToken({
            sub: 'user_clerk_carol_005',
            email: 'carol@example.com',
            email_verified: true
        });

        const req = { body: { clerkToken: token } }; // No password needed now
        const res = createMockRes();

        await clerkGoogleAuth(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.requirePasswordLink, undefined);
    });

    // -------------------------------------------------------------------------
    // 7. Unverified Google Email Rejection
    // -------------------------------------------------------------------------
    it('rejects Google account if email_verified claim is false', async () => {
        const token = createMockClerkToken({
            sub: 'user_unverified_006',
            email: 'unverified@gmail.com',
            email_verified: false
        });

        const req = { body: { clerkToken: token } };
        const res = createMockRes();

        await clerkGoogleAuth(req, res);

        assert.equal(res.statusCode, 403);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /not verified/i);
    });

    // -------------------------------------------------------------------------
    // 8. Missing / Invalid Token Handling
    // -------------------------------------------------------------------------
    it('rejects missing, empty, or non-string clerkToken with 400 Bad Request', async () => {
        const res1 = createMockRes();
        await clerkGoogleAuth({ body: {} }, res1);
        assert.equal(res1.statusCode, 400);

        const res2 = createMockRes();
        await clerkGoogleAuth({ body: { clerkToken: '' } }, res2);
        assert.equal(res2.statusCode, 400);

        const res3 = createMockRes();
        await clerkGoogleAuth({ body: { clerkToken: 12345 } }, res3);
        assert.equal(res3.statusCode, 400);
    });

    // -------------------------------------------------------------------------
    // 9. Forged / Expired Token Rejection
    // -------------------------------------------------------------------------
    it('rejects forged or expired Clerk token with 401 Unauthorized', async () => {
        const forgedToken = jwt.sign(
            { sub: 'user_forged', email: 'attacker@gmail.com', email_verified: true },
            'wrong_attacker_secret_key_123456789'
        );

        const req = { body: { clerkToken: forgedToken } };
        const res = createMockRes();

        await clerkGoogleAuth(req, res);

        assert.equal(res.statusCode, 401);
        assert.equal(res.body.success, false);
    });

    // -------------------------------------------------------------------------
    // 10. Conflicting Clerk Account Hijacking Protection
    // -------------------------------------------------------------------------
    it('prevents account hijacking when clerkId belongs to a different user', async () => {
        // User A already owns clerkId 'user_shared_123'
        await User.create({
            name: 'User A',
            email: 'usera@example.com',
            clerkId: 'user_clerk_taken_007',
            authProvider: ['google']
        });

        // User B has email 'userb@example.com' but token claims clerkId 'user_clerk_taken_007'
        await User.create({
            name: 'User B',
            email: 'userb@example.com',
            clerkId: 'user_clerk_different_008',
            authProvider: ['google']
        });

        const token = createMockClerkToken({
            sub: 'user_clerk_taken_007', // Already taken by User A
            email: 'userb@example.com',
            email_verified: true
        });

        const req = { body: { clerkToken: token } };
        const res = createMockRes();

        await clerkGoogleAuth(req, res);

        // Case 1 matches User A by clerkId and logs in as User A, or rejects conflict
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.user.email, 'usera@example.com', 'Must strictly bind to owner of clerkId');
    });

    // -------------------------------------------------------------------------
    // 11. Seller Route Immunity (Privilege Escalation Protection)
    // -------------------------------------------------------------------------
    it('customer session token issued via Clerk cannot access protected seller APIs', async () => {
        // Issue customer session token
        const customerToken = jwt.sign({ id: '507f1f77bcf86cd799439001' }, TEST_JWT_SECRET, { expiresIn: '7d' });

        let nextCalled = false;
        const next = () => { nextCalled = true; };

        // Test against authSeller middleware
        const req = {
            cookies: {
                token: customerToken, // Customer cookie present
                // sellerToken is absent!
            }
        };
        const res = createMockRes();

        await authSeller(req, res, next);

        assert.equal(res.statusCode, 401, 'Customer token must be rejected by authSeller');
        assert.equal(res.body.success, false);
        assert.equal(nextCalled, false, 'Must not proceed to seller controller');
    });

    // -------------------------------------------------------------------------
    // 12. Standard Clerk Session Token (Sub Only) & Authoritative Profile Lookup
    // -------------------------------------------------------------------------
    it('authenticates using a realistic Clerk session token (only sub) and resolves profile via authoritative Backend API lookup', async () => {
        // Realistic Clerk session token containing standard session claims without email or name
        const realisticToken = jwt.sign({
            sub: 'user_clerk_realistic_012',
            iss: 'https://magical-marmoset-51.clerk.accounts.dev',
            azp: 'http://localhost:5173',
            sid: 'sess_realistic_session_123',
            exp: Math.floor(Date.now() / 1000) + 3600,
            nbf: Math.floor(Date.now() / 1000),
            iat: Math.floor(Date.now() / 1000)
        }, TEST_CLERK_SECRET);

        // Register mock for authoritative Clerk Backend API user profile
        _setMockUserLookup(async (clerkId) => {
            assert.equal(clerkId, 'user_clerk_realistic_012');
            return {
                id: clerkId,
                primaryEmailAddressId: 'email_primary_real_1',
                emailAddresses: [
                    {
                        id: 'email_primary_real_1',
                        emailAddress: 'authoritative.google@example.com',
                        verification: { status: 'verified' }
                    }
                ],
                firstName: 'Authoritative',
                lastName: 'Customer'
            };
        });

        const req = { body: { clerkToken: realisticToken } };
        const res = createMockRes();

        await clerkGoogleAuth(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.equal(res.body.user.email, 'authoritative.google@example.com');
        assert.equal(res.body.user.name, 'Authoritative Customer');

        // Confirm database record created with authoritative email and clerkId
        const created = mockUsers.find(u => u.clerkId === 'user_clerk_realistic_012');
        assert.ok(created);
        assert.equal(created.email, 'authoritative.google@example.com');
        assert.equal(created.name, 'Authoritative Customer');
    });

    // -------------------------------------------------------------------------
    // 13. Authoritative Profile Primary Email Unverified Rejection (HTTP 403)
    // -------------------------------------------------------------------------
    it('rejects authentication if authoritative Clerk user primary email is unverified (403)', async () => {
        const realisticToken = jwt.sign({
            sub: 'user_clerk_unverified_013',
            iss: 'https://magical-marmoset-51.clerk.accounts.dev',
            sid: 'sess_unverified_456'
        }, TEST_CLERK_SECRET);

        _setMockUserLookup(async (clerkId) => {
            return {
                id: clerkId,
                primaryEmailAddressId: 'email_unverified_1',
                emailAddresses: [
                    {
                        id: 'email_unverified_1',
                        emailAddress: 'unverified.authoritative@example.com',
                        verification: { status: 'unverified' } // Not verified!
                    }
                ],
                firstName: 'Pending',
                lastName: 'Customer'
            };
        });

        const req = { body: { clerkToken: realisticToken } };
        const res = createMockRes();

        await clerkGoogleAuth(req, res);

        assert.equal(res.statusCode, 403);
        assert.equal(res.body.success, false);
        assert.match(res.body.message, /not verified/i);
        assert.equal(res.cookies.token, undefined, 'Must not issue cookie for unverified email');
    });

    // -------------------------------------------------------------------------
    // 14. Production Mock Verification Prohibition (HTTP 500)
    // -------------------------------------------------------------------------
    it('strictly blocks mock verification when NODE_ENV is production and credentials are missing (HTTP 500)', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.CLERK_SECRET_KEY;
        delete process.env.CLERK_JWT_KEY;

        const mockToken = createMockClerkToken({ sub: 'user_prod_attack' });

        const req = { body: { clerkToken: mockToken } };
        const res = createMockRes();

        await clerkGoogleAuth(req, res);

        assert.equal(res.statusCode, 500, 'Must produce HTTP 500 on server configuration error');
        assert.equal(res.body.success, false);
        assert.equal(res.body.message, 'Server authentication configuration missing');
        assert.equal(res.cookies.token, undefined);
    });

    // -------------------------------------------------------------------------
    // 15. Missing Production Credentials Return HTTP 500
    // -------------------------------------------------------------------------
    it('returns HTTP 500 when server Clerk secret key is missing in production mode', async () => {
        process.env.NODE_ENV = 'production';
        delete process.env.CLERK_SECRET_KEY;

        const req = { body: { clerkToken: 'any_token' } };
        const res = createMockRes();

        await clerkGoogleAuth(req, res);

        assert.equal(res.statusCode, 500);
        assert.equal(res.body.success, false);
        assert.equal(res.body.message, 'Server authentication configuration missing');
    });

    // -------------------------------------------------------------------------
    // 16. Disallows Setting Mock User Profile Lookup Outside Test Mode
    // -------------------------------------------------------------------------
    it('disallows setting mock user profile lookup outside test mode', () => {
        process.env.NODE_ENV = 'development';
        assert.throws(
            () => {
                _setMockUserLookup(() => {});
            },
            /only available in test mode/i
        );

        process.env.NODE_ENV = 'production';
        assert.throws(
            () => {
                _setMockUserLookup(() => {});
            },
            /only available in test mode/i
        );
    });

    // -------------------------------------------------------------------------
    // 17. Handles Missing Clerk User Profile with HTTP 401
    // -------------------------------------------------------------------------
    it('handles non-existent or failing Clerk user profile lookup with HTTP 401', async () => {
        const realisticToken = jwt.sign({
            sub: 'user_clerk_nonexistent_017',
            iss: 'https://magical-marmoset-51.clerk.accounts.dev'
        }, TEST_CLERK_SECRET);

        _setMockUserLookup(async () => {
            return null; // Profile not found in Clerk
        });

        const req = { body: { clerkToken: realisticToken } };
        const res = createMockRes();

        await clerkGoogleAuth(req, res);

        assert.equal(res.statusCode, 401);
        assert.equal(res.body.success, false);
        assert.equal(res.body.message, 'Invalid or expired Google authentication token');
    });
});
