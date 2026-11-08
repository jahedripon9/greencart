import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import ActivityLog from '../models/ActivityLog.js';
import {
    logActivity,
    extractActorFromRequest,
    sanitizeData,
    calculateChanges,
    formatDhakaTime,
    buildActivityFilter,
    parseActivityPagination,
    queryActivityLogs,
    _testActivityLogs,
    clearTestActivityLogs
} from '../services/activityLogService.js';
import {
    getActivityLogs,
    getActivityLogById,
    rejectActivityLogMutation
} from '../controllers/activityLogController.js';
import { addProduct, updateProduct, deleteProduct, changeStock } from '../controllers/productController.js';
import { updateOrderStatus } from '../controllers/orderController.js';
import { updateContact, addContact, deleteContact } from '../controllers/contactController.js';
import {
    addTeamMember,
    updateTeamMember,
    toggleTeamMemberStatus,
    deleteTeamMember
} from '../controllers/teamController.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Contact from '../models/Contact.js';
import TeamMember from '../models/TeamMember.js';

describe('GreenCart Activity Log & Security Suite', () => {
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
        process.env.SELLER_EMAIL = 'admin@greencart.com';
        process.env.JWT_SECRET = 'test_secret_for_activity_logs_2026';
        clearTestActivityLogs();
    });

    afterEach(() => {
        process.env = originalEnv;
        clearTestActivityLogs();
    });

    // =========================================================================
    // 1. ActivityLog Schema & Constraints
    // =========================================================================
    describe('1. ActivityLog Schema Structure & Constraints', () => {
        it('has all required fields defined in schema', () => {
            const paths = ActivityLog.schema.paths;
            assert.ok(paths.actorId, 'actorId must be defined');
            assert.ok(paths.actorName, 'actorName must be defined');
            assert.ok(paths.actorEmail, 'actorEmail must be defined');
            assert.ok(paths.actorRole, 'actorRole must be defined');
            assert.ok(paths.action, 'action must be defined');
            assert.ok(paths.entityType, 'entityType must be defined');
            assert.ok(paths.entityId, 'entityId must be defined');
            assert.ok(paths.entityName, 'entityName must be defined');
            assert.ok(paths.description, 'description must be defined');
            assert.ok(paths.changes, 'changes must be defined');
            assert.ok(paths.ipAddress, 'ipAddress must be defined');
            assert.ok(paths.userAgent, 'userAgent must be defined');
            assert.ok(paths.createdAt, 'createdAt must be defined');
        });

        it('enforces allowed action enum values', () => {
            const actionPath = ActivityLog.schema.paths.action;
            const allowedActions = actionPath.enumValues;
            assert.deepEqual(allowedActions.sort(), ['CREATE', 'DELETE', 'STATUS_CHANGE', 'UPDATE'].sort());
        });

        it('enforces allowed entityType enum values', () => {
            const entityPath = ActivityLog.schema.paths.entityType;
            const allowedEntities = entityPath.enumValues;
            assert.deepEqual(allowedEntities.sort(), ['CUSTOMER', 'ORDER', 'PRODUCT', 'TEAM_MEMBER'].sort());
        });

        it('marks createdAt as immutable', () => {
            const createdPath = ActivityLog.schema.paths.createdAt;
            assert.equal(createdPath.options.immutable, true);
        });
    });

    // =========================================================================
    // 2. Sensitive Data Exclusion & Sanitization
    // =========================================================================
    describe('2. Sensitive Data Exclusion & Sanitization', () => {
        it('deeply removes passwords, tokens, hashes, and OTPs from changes payload', () => {
            const dirtyData = {
                name: 'Organic Rice',
                password: 'superSecretPassword123!',
                passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz',
                token: 'jwt.token.string',
                sellerToken: 'merchant.cookie.token',
                clerkToken: 'clerk_session_secret',
                otp: '123456',
                verificationTokenHash: 'hash123',
                paymentSecret: 'sk_live_secret123',
                stripe_secret_key: 'stripe_key_456',
                tokenVersion: 5,
                nested: {
                    user: 'John',
                    password: 'nestedPassword',
                    cleanField: 'cleanValue'
                },
                price: 150
            };

            const clean = sanitizeData(dirtyData);

            assert.equal(clean.name, 'Organic Rice');
            assert.equal(clean.price, 150);
            assert.equal(clean.password, undefined);
            assert.equal(clean.passwordHash, undefined);
            assert.equal(clean.token, undefined);
            assert.equal(clean.sellerToken, undefined);
            assert.equal(clean.clerkToken, undefined);
            assert.equal(clean.otp, undefined);
            assert.equal(clean.verificationTokenHash, undefined);
            assert.equal(clean.paymentSecret, undefined);
            assert.equal(clean.stripe_secret_key, undefined);
            assert.equal(clean.tokenVersion, undefined);
            assert.equal(clean.nested.user, 'John');
            assert.equal(clean.nested.cleanField, 'cleanValue');
            assert.equal(clean.nested.password, undefined);
        });
    });

    // =========================================================================
    // 3. Actor Identity Extraction & Tamper Resistance
    // =========================================================================
    describe('3. Actor Identity Extraction & Tamper Resistance', () => {
        it('derives actor identity strictly from verified req.seller and req.sellerRole', () => {
            const req = {
                seller: {
                    id: 'tm_67890',
                    email: 'cto@greencart.com',
                    name: 'Chief Tech Officer',
                    role: 'CTO'
                },
                sellerId: 'tm_67890',
                sellerEmail: 'cto@greencart.com',
                sellerRole: 'CTO',
                headers: {
                    'x-forwarded-for': '203.0.113.195, 10.0.0.1',
                    'user-agent': 'Mozilla/5.0 TestBrowser/1.0'
                },
                body: {
                    actorId: 'spoofed_admin',
                    actorName: 'Fake Admin',
                    actorRole: 'Admin',
                    ipAddress: '1.1.1.1'
                }
            };

            const actor = extractActorFromRequest(req);

            assert.equal(actor.actorId, 'tm_67890');
            assert.equal(actor.actorEmail, 'cto@greencart.com');
            assert.equal(actor.actorName, 'Chief Tech Officer');
            assert.equal(actor.actorRole, 'CTO');
            assert.equal(actor.ipAddress, '203.0.113.195');
            assert.equal(actor.userAgent, 'Mozilla/5.0 TestBrowser/1.0');
        });

        it('derives root merchant admin identity accurately', () => {
            const req = {
                sellerId: 'admin@greencart.com',
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                seller: {
                    id: 'admin@greencart.com',
                    email: 'admin@greencart.com',
                    name: 'Merchant Admin',
                    role: 'Admin'
                },
                ip: '127.0.0.1'
            };

            const actor = extractActorFromRequest(req);

            assert.equal(actor.actorEmail, 'admin@greencart.com');
            assert.equal(actor.actorRole, 'Admin');
            assert.equal(actor.actorName, 'Merchant Admin');
            assert.equal(actor.ipAddress, '127.0.0.1');
        });
    });

    // =========================================================================
    // 4. API Immutability & Unauthorized Access Control
    // =========================================================================
    describe('4. API Immutability & Access Control', () => {
        it('rejectActivityLogMutation rejects POST, PUT, PATCH, DELETE with 405 Method Not Allowed', () => {
            const resPost = createMockRes();
            rejectActivityLogMutation({ method: 'POST' }, resPost);
            assert.equal(resPost.statusCode, 405);
            assert.equal(resPost.body.success, false);
            assert.ok(resPost.body.message.includes('immutable'));

            const resPut = createMockRes();
            rejectActivityLogMutation({ method: 'PUT' }, resPut);
            assert.equal(resPut.statusCode, 405);

            const resDel = createMockRes();
            rejectActivityLogMutation({ method: 'DELETE' }, resDel);
            assert.equal(resDel.statusCode, 405);
        });

        it('strictly blocks CEO, CTO, and Strategist roles from accessing activity logs with HTTP 403', async () => {
            const { requireAdmin } = await import('../middlewares/authRole.js');
            const adminMiddleware = requireAdmin;

            // Test CEO
            const reqCeo = { sellerRole: 'CEO', seller: { role: 'CEO' } };
            const resCeo = createMockRes();
            let nextCalledCeo = false;
            adminMiddleware(reqCeo, resCeo, () => { nextCalledCeo = true; });
            assert.equal(resCeo.statusCode, 403);
            assert.equal(nextCalledCeo, false);

            // Test CTO
            const reqCto = { sellerRole: 'CTO', seller: { role: 'CTO' } };
            const resCto = createMockRes();
            let nextCalledCto = false;
            adminMiddleware(reqCto, resCto, () => { nextCalledCto = true; });
            assert.equal(resCto.statusCode, 403);
            assert.equal(nextCalledCto, false);

            // Test Strategist
            const reqStrat = { sellerRole: 'Strategist', seller: { role: 'Strategist' } };
            const resStrat = createMockRes();
            let nextCalledStrat = false;
            adminMiddleware(reqStrat, resStrat, () => { nextCalledStrat = true; });
            assert.equal(resStrat.statusCode, 403);
            assert.equal(nextCalledStrat, false);

            // Test Admin (Allowed)
            const reqAdmin = { sellerRole: 'Admin', seller: { role: 'Admin' } };
            const resAdmin = createMockRes();
            let nextCalledAdmin = false;
            adminMiddleware(reqAdmin, resAdmin, () => { nextCalledAdmin = true; });
            assert.equal(nextCalledAdmin, true);
        });

        it('getActivityLogs returns formatted logs and pagination for Admin', async () => {
            // Seed a test log
            _testActivityLogs.push({
                _id: 'log_001',
                actorId: 'admin@greencart.com',
                actorName: 'Merchant Admin',
                actorEmail: 'admin@greencart.com',
                actorRole: 'Admin',
                action: 'CREATE',
                entityType: 'PRODUCT',
                entityId: 'prod_123',
                entityName: 'Green Tea',
                description: 'Created product "Green Tea"',
                changes: { before: null, after: { name: 'Green Tea', price: 200 } },
                ipAddress: '127.0.0.1',
                userAgent: 'NodeTest',
                createdAt: new Date('2026-11-05T12:00:00Z')
            });

            const req = {
                query: { page: 1, limit: 10 }
            };
            const res = createMockRes();

            await getActivityLogs(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.ok(Array.isArray(res.body.logs));
            assert.equal(res.body.logs.length, 1);
            assert.equal(res.body.logs[0].entityName, 'Green Tea');
            assert.ok(res.body.logs[0].dhakaTime.includes('(BST)'));
        });
    });

    // =========================================================================
    // 5. Bangladesh Local Time Formatting
    // =========================================================================
    describe('5. Bangladesh Standard Time (Asia/Dhaka) Representation', () => {
        it('accurately formats UTC date into Asia/Dhaka (+06:00)', () => {
            // 2026-11-05 06:00:00 UTC is 2026-11-05 12:00:00 BST (+6 hrs)
            const utcDate = new Date('2026-11-05T06:00:00.000Z');
            const dhakaFormatted = formatDhakaTime(utcDate);

            assert.ok(dhakaFormatted.includes('05 Nov 2026') || dhakaFormatted.includes('05/11/2026') || dhakaFormatted.includes('12:00'));
            assert.ok(dhakaFormatted.includes('(BST)'));
        });

        it('handles null and invalid dates gracefully', () => {
            assert.equal(formatDhakaTime(null), '');
            assert.equal(formatDhakaTime('invalid-date'), '');
        });
    });

    // =========================================================================
    // 6. Before/After Change Accuracy & Computation
    // =========================================================================
    describe('6. Before/After Change Accuracy & Computation', () => {
        it('accurately calculates delta between before and after objects', () => {
            const before = {
                name: 'Fresh Mango',
                price: 100,
                stockQuantity: 50,
                inStock: true
            };
            const after = {
                name: 'Fresh Mango',
                price: 120, // changed
                stockQuantity: 40, // changed
                inStock: true
            };

            const changes = calculateChanges(before, after);

            assert.deepEqual(changes.before, { price: 100, stockQuantity: 50 });
            assert.deepEqual(changes.after, { price: 120, stockQuantity: 40 });
        });
    });

    // =========================================================================
    // 7. Product Activity Tracking (Create, Update, ChangeStock, Delete)
    // =========================================================================
    describe('7. Product Activity Tracking', () => {
        it('tracks direct product create logging', async () => {
            const req = {
                sellerId: 'admin@greencart.com',
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                seller: { id: 'admin@greencart.com', email: 'admin@greencart.com', name: 'Store Owner', role: 'Admin' }
            };

            await logActivity({
                req,
                action: 'CREATE',
                entityType: 'PRODUCT',
                entityId: '507f1f77bcf86cd799439090',
                entityName: 'Fresh Strawberries',
                description: 'Created product "Fresh Strawberries"',
                after: { name: 'Fresh Strawberries', price: 250, inStock: true }
            });

            assert.ok(_testActivityLogs.length >= 1);
            const log = _testActivityLogs[0];
            assert.equal(log.action, 'CREATE');
            assert.equal(log.entityType, 'PRODUCT');
            assert.equal(log.entityName, 'Fresh Strawberries');
            assert.equal(log.changes.after.price, 250);
        });

        it('tracks product update with before/after changes', async () => {
            const origFindById = Product.findById;
            const origFindByIdAndUpdate = Product.findByIdAndUpdate;

            const prodId = '507f1f77bcf86cd799439091';
            const existing = {
                _id: prodId,
                name: 'Organic Milk',
                category: 'Dairy',
                price: 80,
                stockQuantity: 20,
                inStock: true,
                sellerId: 'admin@greencart.com'
            };

            Product.findById = async () => existing;
            Product.findByIdAndUpdate = async (id, update) => ({
                ...existing,
                ...update.$set
            });

            const req = {
                sellerId: 'admin@greencart.com',
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                seller: { id: 'admin@greencart.com', email: 'admin@greencart.com', name: 'Store Owner', role: 'Admin' },
                body: {
                    id: prodId,
                    price: 95
                }
            };
            const res = createMockRes();

            try {
                await updateProduct(req, res);

                assert.equal(res.statusCode, 200);
                assert.equal(res.body.success, true);

                // Verify logged activity
                assert.ok(_testActivityLogs.length >= 1);
                const log = _testActivityLogs[0];
                assert.equal(log.action, 'UPDATE');
                assert.equal(log.entityType, 'PRODUCT');
                assert.equal(log.entityId, prodId);
                assert.equal(log.actorRole, 'Admin');
                assert.deepEqual(log.changes.before.price, 80);
                assert.deepEqual(log.changes.after.price, 95);
            } finally {
                Product.findById = origFindById;
                Product.findByIdAndUpdate = origFindByIdAndUpdate;
            }
        });

        it('tracks product changeStock activity', async () => {
            const origFindById = Product.findById;
            const origFindByIdAndUpdate = Product.findByIdAndUpdate;

            const prodId = '507f1f77bcf86cd799439092';
            const existing = {
                _id: prodId,
                name: 'Brown Bread',
                inStock: true,
                stockQuantity: 10,
                sellerId: 'admin@greencart.com'
            };

            Product.findById = async () => existing;
            Product.findByIdAndUpdate = async (id, update) => ({ ...existing, inStock: update.inStock });

            const req = {
                sellerId: 'admin@greencart.com',
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                seller: { id: 'admin@greencart.com', email: 'admin@greencart.com', name: 'Store Owner', role: 'Admin' },
                body: { id: prodId, inStock: false }
            };
            const res = createMockRes();

            try {
                await changeStock(req, res);

                assert.equal(res.statusCode, 200);
                assert.equal(res.body.success, true);

                const log = _testActivityLogs[0];
                assert.equal(log.action, 'UPDATE');
                assert.equal(log.entityType, 'PRODUCT');
                assert.equal(log.changes.before.inStock, true);
                assert.equal(log.changes.after.inStock, false);
            } finally {
                Product.findById = origFindById;
                Product.findByIdAndUpdate = origFindByIdAndUpdate;
            }
        });

        it('tracks product deletion activity', async () => {
            const origFindById = Product.findById;
            const origFindByIdAndDelete = Product.findByIdAndDelete;

            const prodId = '507f1f77bcf86cd799439093';
            const existing = {
                _id: prodId,
                name: 'Seasonal Apple',
                category: 'Fruits',
                price: 150,
                sellerId: 'admin@greencart.com'
            };

            Product.findById = async () => existing;
            Product.findByIdAndDelete = async () => existing;

            const req = {
                sellerId: 'admin@greencart.com',
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                seller: { id: 'admin@greencart.com', email: 'admin@greencart.com', name: 'Store Owner', role: 'Admin' },
                body: { id: prodId }
            };
            const res = createMockRes();

            try {
                await deleteProduct(req, res);

                assert.equal(res.statusCode, 200);
                assert.equal(res.body.success, true);

                const log = _testActivityLogs[0];
                assert.equal(log.action, 'DELETE');
                assert.equal(log.entityType, 'PRODUCT');
                assert.equal(log.entityName, 'Seasonal Apple');
                assert.equal(log.changes.before.name, 'Seasonal Apple');
            } finally {
                Product.findById = origFindById;
                Product.findByIdAndDelete = origFindByIdAndDelete;
            }
        });
    });

    // =========================================================================
    // 8. Order Status Change Activity Tracking
    // =========================================================================
    describe('8. Order Status Change Tracking', () => {
        it('tracks order status transitions from Placed to Out for Delivery', async () => {
            const origFindOne = Order.findOne;
            const origFindByIdAndUpdate = Order.findByIdAndUpdate;

            const existingOrder = {
                _id: '507f1f77bcf86cd799439011',
                orderNumber: 'GC-998877',
                status: 'Order Placed',
                isPaid: false,
                paymentType: 'COD',
                items: []
            };

            Order.findOne = () => ({
                populate: function () { return this; },
                then: function (resolve) { return resolve(existingOrder); }
            });

            Order.findByIdAndUpdate = (id, update) => ({
                populate: function () { return this; },
                then: function (resolve) {
                    return resolve({
                        ...existingOrder,
                        ...update.$set
                    });
                }
            });

            const req = {
                sellerId: 'admin@greencart.com',
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                seller: { id: 'admin@greencart.com', email: 'admin@greencart.com', name: 'Store Owner', role: 'Admin' },
                body: {
                    orderId: '507f1f77bcf86cd799439011',
                    status: 'Out for Delivery'
                }
            };
            const res = createMockRes();

            try {
                await updateOrderStatus(req, res);

                assert.equal(res.statusCode, 200);
                assert.equal(res.body.success, true);

                const log = _testActivityLogs[0];
                assert.equal(log.action, 'STATUS_CHANGE');
                assert.equal(log.entityType, 'ORDER');
                assert.equal(log.changes.before.status, 'Order Placed');
                assert.equal(log.changes.after.status, 'Out for Delivery');
            } finally {
                Order.findOne = origFindOne;
                Order.findByIdAndUpdate = origFindByIdAndUpdate;
            }
        });

        it('tracks order cancellation activity', async () => {
            const origFindOne = Order.findOne;
            const origFindByIdAndUpdate = Order.findByIdAndUpdate;

            const existingOrder = {
                _id: '507f1f77bcf86cd799439012',
                orderNumber: 'GC-112233',
                status: 'Packing',
                isPaid: false,
                paymentType: 'COD',
                items: []
            };

            Order.findOne = () => ({
                populate: function () { return this; },
                then: function (resolve) { return resolve(existingOrder); }
            });

            Order.findByIdAndUpdate = (id, update) => ({
                populate: function () { return this; },
                then: function (resolve) {
                    return resolve({
                        ...existingOrder,
                        ...update.$set
                    });
                }
            });

            const req = {
                sellerId: 'admin@greencart.com',
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                seller: { id: 'admin@greencart.com', email: 'admin@greencart.com', name: 'Store Owner', role: 'Admin' },
                body: {
                    orderId: '507f1f77bcf86cd799439012',
                    status: 'Cancelled'
                }
            };
            const res = createMockRes();

            try {
                await updateOrderStatus(req, res);

                assert.equal(res.statusCode, 200);
                assert.equal(res.body.success, true);

                const log = _testActivityLogs[0];
                assert.equal(log.action, 'STATUS_CHANGE');
                assert.equal(log.entityType, 'ORDER');
                assert.equal(log.changes.before.status, 'Packing');
                assert.equal(log.changes.after.status, 'Cancelled');
            } finally {
                Order.findOne = origFindOne;
                Order.findByIdAndUpdate = origFindByIdAndUpdate;
            }
        });
    });

    // =========================================================================
    // 9. Customer Update Activity Tracking
    // =========================================================================
    describe('9. Customer Update Activity Tracking', () => {
        it('tracks customer update and notes changes in Contact Directory', async () => {
            const origFindOne = Contact.findOne;

            const existingContact = {
                _id: '507f1f77bcf86cd799439022',
                sellerId: 'admin@greencart.com',
                name: 'Alice Rahman',
                email: 'alice@example.com',
                phone: '01711223344',
                status: 'Customer',
                notes: 'Regular customer',
                save: async function () { return this; }
            };

            Contact.findOne = async () => existingContact;

            const req = {
                sellerId: 'admin@greencart.com',
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                seller: { id: 'admin@greencart.com', email: 'admin@greencart.com', name: 'Store Owner', role: 'Admin' },
                params: { id: '507f1f77bcf86cd799439022' },
                body: {
                    name: 'Alice Rahman Updated',
                    phone: '01799887766'
                }
            };
            const res = createMockRes();

            try {
                await updateContact(req, res);

                assert.equal(res.statusCode, 200);
                assert.equal(res.body.success, true);

                const log = _testActivityLogs[0];
                assert.equal(log.action, 'UPDATE');
                assert.equal(log.entityType, 'CUSTOMER');
                assert.equal(log.entityName, 'Alice Rahman Updated');
                assert.equal(log.changes.before.phone, '01711223344');
                assert.equal(log.changes.after.phone, '01799887766');
            } finally {
                Contact.findOne = origFindOne;
            }
        });
    });

    // =========================================================================
    // 10. Team Member Full Lifecycle Tracking (Create, Update, Role, Status, Delete)
    // =========================================================================
    describe('10. Team Member Full Lifecycle Tracking', () => {
        it('tracks team member creation excluding passwords', async () => {
            const origFindOne = TeamMember.findOne;
            const origSave = TeamMember.prototype.save;

            TeamMember.findOne = async () => null;
            TeamMember.prototype.save = async function () {
                this._id = 'tm_111';
                return this;
            };

            const req = {
                sellerId: 'admin@greencart.com',
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                seller: { id: 'admin@greencart.com', email: 'admin@greencart.com', name: 'Store Owner', role: 'Admin' },
                body: {
                    name: 'Sarah Connor',
                    email: 'sarah@greencart.com',
                    password: 'SecurePassword123!',
                    designation: 'Operations Lead',
                    role: 'Strategist',
                    status: 'Active'
                }
            };
            const res = createMockRes();

            try {
                await addTeamMember(req, res);

                assert.equal(res.statusCode, 201);
                assert.equal(res.body.success, true);

                const log = _testActivityLogs[0];
                assert.equal(log.action, 'CREATE');
                assert.equal(log.entityType, 'TEAM_MEMBER');
                assert.equal(log.entityName, 'Sarah Connor');
                // Password must be strictly excluded!
                assert.equal(log.changes.after.password, undefined);
                assert.equal(log.changes.after.role, 'Strategist');
            } finally {
                TeamMember.findOne = origFindOne;
                TeamMember.prototype.save = origSave;
            }
        });

        it('tracks team member role change', async () => {
            const origFindById = TeamMember.findById;

            const existingMember = {
                _id: 'tm_222',
                name: 'Bob Miller',
                email: 'bob@greencart.com',
                designation: 'Senior Developer',
                role: 'CTO',
                status: 'Active',
                toSafeObject: function () { return { ...this }; },
                save: async function () { return this; }
            };

            TeamMember.findById = async () => existingMember;

            const req = {
                sellerId: 'admin@greencart.com',
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                seller: { id: 'admin@greencart.com', email: 'admin@greencart.com', name: 'Store Owner', role: 'Admin' },
                params: { id: '507f1f77bcf86cd799439033' },
                body: { role: 'Admin' }
            };
            const res = createMockRes();

            try {
                await updateTeamMember(req, res);

                assert.equal(res.statusCode, 200);
                assert.equal(res.body.success, true);

                const log = _testActivityLogs[0];
                assert.equal(log.action, 'UPDATE');
                assert.equal(log.entityType, 'TEAM_MEMBER');
                assert.ok(log.description.includes('Changed role'));
                assert.equal(log.changes.before.role, 'CTO');
                assert.equal(log.changes.after.role, 'Admin');
            } finally {
                TeamMember.findById = origFindById;
            }
        });

        it('tracks team member deactivation', async () => {
            const origFindById = TeamMember.findById;

            const existingMember = {
                _id: 'tm_333',
                name: 'Charlie Davis',
                email: 'charlie@greencart.com',
                designation: 'Strategist',
                role: 'Strategist',
                status: 'Active',
                toSafeObject: function () { return { ...this }; },
                save: async function () { return this; }
            };

            TeamMember.findById = async () => existingMember;

            const req = {
                sellerId: 'admin@greencart.com',
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                seller: { id: 'admin@greencart.com', email: 'admin@greencart.com', name: 'Store Owner', role: 'Admin' },
                params: { id: '507f1f77bcf86cd799439044' },
                body: { status: 'Inactive' }
            };
            const res = createMockRes();

            try {
                await toggleTeamMemberStatus(req, res);

                assert.equal(res.statusCode, 200);
                assert.equal(res.body.success, true);

                const log = _testActivityLogs[0];
                assert.equal(log.action, 'STATUS_CHANGE');
                assert.equal(log.entityType, 'TEAM_MEMBER');
                assert.ok(log.description.includes('Deactivated'));
                assert.equal(log.changes.before.status, 'Active');
                assert.equal(log.changes.after.status, 'Inactive');
            } finally {
                TeamMember.findById = origFindById;
            }
        });

        it('tracks team member deletion', async () => {
            const origFindById = TeamMember.findById;
            const origFindByIdAndDelete = TeamMember.findByIdAndDelete;

            const existingMember = {
                _id: 'tm_444',
                name: 'Dave Wilson',
                email: 'dave@greencart.com',
                designation: 'Intern',
                role: 'Strategist',
                status: 'Inactive',
                toSafeObject: function () {
                    return {
                        id: this._id,
                        name: this.name,
                        email: this.email,
                        role: this.role
                    };
                }
            };

            TeamMember.findById = async () => existingMember;
            TeamMember.findByIdAndDelete = async () => existingMember;

            const req = {
                sellerId: 'admin@greencart.com',
                sellerEmail: 'admin@greencart.com',
                sellerRole: 'Admin',
                seller: { id: 'admin@greencart.com', email: 'admin@greencart.com', name: 'Store Owner', role: 'Admin' },
                params: { id: '507f1f77bcf86cd799439055' }
            };
            const res = createMockRes();

            try {
                await deleteTeamMember(req, res);

                assert.equal(res.statusCode, 200);
                assert.equal(res.body.success, true);

                const log = _testActivityLogs[0];
                assert.equal(log.action, 'DELETE');
                assert.equal(log.entityType, 'TEAM_MEMBER');
                assert.equal(log.entityName, 'Dave Wilson');
                assert.equal(log.changes.before.email, 'dave@greencart.com');
            } finally {
                TeamMember.findById = origFindById;
                TeamMember.findByIdAndDelete = origFindByIdAndDelete;
            }
        });
    });

    // =========================================================================
    // 11. Safe Logging Failure Resilience
    // =========================================================================
    describe('11. Safe Logging Failure Resilience', () => {
        it('logging failure does not crash or fail the business operation', async () => {
            // Simulate logActivity receiving an error or invalid input
            const badReq = null;
            const result = await logActivity({
                req: badReq,
                action: 'UPDATE',
                entityType: 'PRODUCT',
                entityId: '123'
            });

            // Must safely return null without throwing
            assert.equal(result, null);
        });
    });

    // =========================================================================
    // 12. Query Filters & Pagination
    // =========================================================================
    describe('12. Query Filters & Pagination', () => {
        beforeEach(() => {
            clearTestActivityLogs();
            _testActivityLogs.push(
                {
                    _id: '1',
                    action: 'CREATE',
                    entityType: 'PRODUCT',
                    actorEmail: 'admin@greencart.com',
                    actorName: 'Admin',
                    entityName: 'Apple',
                    description: 'Created Apple',
                    createdAt: new Date('2026-11-01T10:00:00Z')
                },
                {
                    _id: '2',
                    action: 'STATUS_CHANGE',
                    entityType: 'ORDER',
                    actorEmail: 'admin@greencart.com',
                    actorName: 'Admin',
                    entityName: 'GC-100',
                    description: 'Order Shipped',
                    createdAt: new Date('2026-11-02T10:00:00Z')
                },
                {
                    _id: '3',
                    action: 'UPDATE',
                    entityType: 'CUSTOMER',
                    actorEmail: 'cto@greencart.com',
                    actorName: 'CTO User',
                    entityName: 'John Customer',
                    description: 'Updated Customer John',
                    createdAt: new Date('2026-11-03T10:00:00Z')
                },
                {
                    _id: '4',
                    action: 'DELETE',
                    entityType: 'TEAM_MEMBER',
                    actorEmail: 'admin@greencart.com',
                    actorName: 'Admin',
                    entityName: 'Mark Staff',
                    description: 'Deleted Mark',
                    createdAt: new Date('2026-11-04T10:00:00Z')
                }
            );
        });

        it('filters activity logs by module / entityType', async () => {
            const res = await queryActivityLogs({ module: 'PRODUCT' });
            assert.equal(res.pagination.totalLogs, 1);
            assert.equal(res.logs[0].entityType, 'PRODUCT');
        });

        it('filters activity logs by action', async () => {
            const res = await queryActivityLogs({ action: 'STATUS_CHANGE' });
            assert.equal(res.pagination.totalLogs, 1);
            assert.equal(res.logs[0].action, 'STATUS_CHANGE');
        });

        it('filters activity logs by actor', async () => {
            const res = await queryActivityLogs({ actor: 'cto@greencart.com' });
            assert.equal(res.pagination.totalLogs, 1);
            assert.equal(res.logs[0].actorEmail, 'cto@greencart.com');
        });

        it('searches by keyword', async () => {
            const res = await queryActivityLogs({ search: 'Shipped' });
            assert.equal(res.pagination.totalLogs, 1);
            assert.equal(res.logs[0].entityName, 'GC-100');
        });

        it('paginates results accurately', async () => {
            const res = await queryActivityLogs({ page: 2, limit: 2 });
            assert.equal(res.pagination.page, 2);
            assert.equal(res.pagination.limit, 2);
            assert.equal(res.pagination.totalLogs, 4);
            assert.equal(res.pagination.totalPages, 2);
            assert.equal(res.logs.length, 2);
        });
    });
});
