import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import Contact from '../models/Contact.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Address from '../models/Address.js';
import Product from '../models/Product.js';
import Conversation from '../models/Conversation.js';
import { requireRole } from '../middlewares/authRole.js';
import {
    getContacts,
    getContactById,
    addContact,
    updateContact,
    deleteContact,
    initiateContactChat,
    getEffectiveSellerId,
    escapeRegex,
    syncCustomerContactFromOrder,
    syncExistingCustomersFromOrders
} from '../controllers/contactController.js';
import { placeOrderCOD } from '../controllers/orderController.js';
import {
    isValidTeamImage,
    normalizeTeamImageUrl
} from '../controllers/teamController.js';

describe('GreenCart Contact Management & Security Suite', () => {
    const TEST_ROOT_EMAIL = 'admin@greencart.com';
    const SELLER_A_ID = 'seller_store_alpha';
    const SELLER_B_ID = 'seller_store_beta';

    let originalEnv;
    let origContactFind;
    let origContactFindOne;
    let origContactFindOneAndDelete;
    let origContactSave;
    let origUserFindOne;
    let origOrderFind;
    let origConvFindOne;
    let origConvSave;

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
        process.env.SELLER_EMAIL = TEST_ROOT_EMAIL;

        origContactFind = Contact.find;
        origContactFindOne = Contact.findOne;
        origContactFindOneAndDelete = Contact.findOneAndDelete;
        origContactSave = Contact.prototype.save;
        origUserFindOne = User.findOne;
        origOrderFind = Order.find;
        origConvFindOne = Conversation.findOne;
        origConvSave = Conversation.prototype.save;
    });

    afterEach(() => {
        process.env = originalEnv;
        Contact.find = origContactFind;
        Contact.findOne = origContactFindOne;
        Contact.findOneAndDelete = origContactFindOneAndDelete;
        Contact.prototype.save = origContactSave;
        User.findOne = origUserFindOne;
        Order.find = origOrderFind;
        Conversation.findOne = origConvFindOne;
        Conversation.prototype.save = origConvSave;
    });

    // =========================================================================
    // 1. Google Drive Image Normalization & Safe URL Validation
    // =========================================================================
    describe('1. Google Drive Image Normalization & Safe URL Validation', () => {
        it('normalizes uc?export=view&id= Google Drive URLs to lh3 usercontent embed URLs', () => {
            const input = 'https://drive.google.com/uc?export=view&id=1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-';
            const expected = 'https://lh3.googleusercontent.com/d/1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-';
            assert.equal(normalizeTeamImageUrl(input), expected);
        });

        it('normalizes uc?id= Google Drive URLs', () => {
            const input = 'https://drive.google.com/uc?id=1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-';
            const expected = 'https://lh3.googleusercontent.com/d/1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-';
            assert.equal(normalizeTeamImageUrl(input), expected);
        });

        it('normalizes /file/d/FILE_ID/view Google Drive URLs', () => {
            const input = 'https://drive.google.com/file/d/1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-/view';
            const expected = 'https://lh3.googleusercontent.com/d/1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-';
            assert.equal(normalizeTeamImageUrl(input), expected);
        });

        it('normalizes open?id=FILE_ID Google Drive URLs', () => {
            const input = 'https://drive.google.com/open?id=1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-';
            const expected = 'https://lh3.googleusercontent.com/d/1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-';
            assert.equal(normalizeTeamImageUrl(input), expected);
        });

        it('leaves standard HTTP/HTTPS non-Google URLs unchanged', () => {
            const standardUrl = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500';
            assert.equal(normalizeTeamImageUrl(standardUrl), standardUrl);
        });

        it('rejects dangerous image schemes (javascript:, vbscript:, file:)', () => {
            assert.equal(isValidTeamImage('javascript:alert(1)'), false);
            assert.equal(isValidTeamImage('vbscript:msgbox(1)'), false);
            assert.equal(isValidTeamImage('file:///etc/passwd'), false);
        });

        it('rejects SVG and GIF data URIs for security', () => {
            assert.equal(isValidTeamImage('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='), false);
            assert.equal(isValidTeamImage('data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), false);
        });

        it('accepts safe PNG, JPEG, and WebP data URIs and valid HTTPS URLs', () => {
            assert.equal(isValidTeamImage('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), true);
            assert.equal(isValidTeamImage('https://lh3.googleusercontent.com/d/1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-'), true);
        });

        it('enforces maximum 2048 character length limit on image URLs', () => {
            const longUrl = 'https://example.com/' + 'a'.repeat(2050);
            assert.equal(isValidTeamImage(longUrl), false);
        });
    });

    // =========================================================================
    // 2. Add Contact & Input Sanitization
    // =========================================================================
    describe('2. Add Contact Validation & Persistence', () => {
        it('successfully adds contact with normalized Google Drive image and trimmed fields', async () => {
            Contact.findOne = async () => null;

            let savedData = null;
            Contact.prototype.save = async function () {
                savedData = this;
                this._id = new mongoose.Types.ObjectId();
                return this;
            };

            const req = {
                sellerId: SELLER_A_ID,
                body: {
                    name: ' Alice Cooper ',
                    email: ' Alice.Cooper@Example.Com ',
                    phone: ' +1-555-0199 ',
                    image: 'https://drive.google.com/uc?export=view&id=1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-',
                    notes: ' Key wholesale contact ',
                    status: 'Customer'
                }
            };
            const res = createMockRes();
            await addContact(req, res);

            assert.equal(res.statusCode, 201);
            assert.equal(res.body.success, true);
            assert.equal(savedData.name, 'Alice Cooper');
            assert.equal(savedData.email, 'alice.cooper@example.com');
            assert.equal(savedData.phone, '+1-555-0199');
            assert.equal(savedData.image, 'https://lh3.googleusercontent.com/d/1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-');
            assert.equal(savedData.status, 'Customer');
            assert.equal(savedData.notes, 'Key wholesale contact');
        });

        it('rejects missing or empty full name with 400', async () => {
            const req = {
                sellerId: SELLER_A_ID,
                body: { name: '   ', email: 'valid@example.com', phone: '123456789' }
            };
            const res = createMockRes();
            await addContact(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /full name is required/i);
        });

        it('rejects name shorter than 2 characters or longer than 100 characters', async () => {
            const reqShort = {
                sellerId: SELLER_A_ID,
                body: { name: 'A', email: 'valid@example.com', phone: '123456789' }
            };
            const resShort = createMockRes();
            await addContact(reqShort, resShort);
            assert.equal(resShort.statusCode, 400);
            assert.match(resShort.body.message, /between 2 and 100/i);

            const reqLong = {
                sellerId: SELLER_A_ID,
                body: { name: 'A'.repeat(101), email: 'valid@example.com', phone: '123456789' }
            };
            const resLong = createMockRes();
            await addContact(reqLong, resLong);
            assert.equal(resLong.statusCode, 400);
            assert.match(resLong.body.message, /between 2 and 100/i);
        });

        it('rejects missing or invalid email format with 400', async () => {
            const testEmails = ['', 'notanemail', 'missing@domain', '@nodomain.com', 'spaces in@email.com'];
            for (const email of testEmails) {
                const req = {
                    sellerId: SELLER_A_ID,
                    body: { name: 'Valid Name', email, phone: '123456789' }
                };
                const res = createMockRes();
                await addContact(req, res);
                assert.equal(res.statusCode, 400);
                assert.equal(res.body.success, false);
            }
        });

        it('rejects missing or invalid phone format with 400', async () => {
            const testPhones = ['', '   ', 'abc-def-ghij', '123', 'invalid!!phone'];
            for (const phone of testPhones) {
                const req = {
                    sellerId: SELLER_A_ID,
                    body: { name: 'Valid Name', email: 'valid@example.com', phone }
                };
                const res = createMockRes();
                await addContact(req, res);
                assert.equal(res.statusCode, 400);
                assert.equal(res.body.success, false);
            }
        });

        it('rejects dangerous or disallowed image URL with 400', async () => {
            const req = {
                sellerId: SELLER_A_ID,
                body: {
                    name: 'Hacker Joe',
                    email: 'joe@example.com',
                    phone: '1234567890',
                    image: 'javascript:alert("XSS")'
                }
            };
            const res = createMockRes();
            await addContact(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /invalid profile image/i);
        });

        it('prevents duplicate contacts based on email within the same seller account', async () => {
            Contact.findOne = async ({ sellerId, email }) => {
                if (sellerId === SELLER_A_ID && email === 'existing@example.com') {
                    return { _id: 'existing_contact_1', email };
                }
                return null;
            };

            const req = {
                sellerId: SELLER_A_ID,
                body: {
                    name: 'Duplicate Contact',
                    email: 'existing@example.com',
                    phone: '1234567890'
                }
            };
            const res = createMockRes();
            await addContact(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /already exists in your contacts list/i);
        });

        it('handles MongoDB duplicate key error code 11000 gracefully', async () => {
            Contact.findOne = async () => null;
            Contact.prototype.save = async function () {
                const err = new Error('E11000 duplicate key error');
                err.code = 11000;
                throw err;
            };

            const req = {
                sellerId: SELLER_A_ID,
                body: {
                    name: 'Race Contact',
                    email: 'race@example.com',
                    phone: '1234567890'
                }
            };
            const res = createMockRes();
            await addContact(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /already exists in your contacts list/i);
        });
    });

    // =========================================================================
    // 3. Seller-Level Data Isolation
    // =========================================================================
    describe('3. Seller Data Isolation & Effective Seller Identification', () => {
        it('isolates contacts between different seller accounts with the same email', async () => {
            let savedContacts = [];
            Contact.prototype.save = async function () {
                savedContacts.push({
                    sellerId: this.sellerId,
                    email: this.email,
                    name: this.name
                });
                return this;
            };

            // Seller A adds contact
            Contact.findOne = async ({ sellerId }) => sellerId === SELLER_A_ID ? null : null;
            const reqA = {
                sellerId: SELLER_A_ID,
                body: { name: 'Shared Customer', email: 'shared@customer.com', phone: '1234567890' }
            };
            const resA = createMockRes();
            await addContact(reqA, resA);
            assert.equal(resA.statusCode, 201);

            // Seller B adds contact with SAME email
            const reqB = {
                sellerId: SELLER_B_ID,
                body: { name: 'Shared Customer', email: 'shared@customer.com', phone: '1234567890' }
            };
            const resB = createMockRes();
            await addContact(reqB, resB);
            assert.equal(resB.statusCode, 201);

            assert.equal(savedContacts.length, 2);
            assert.equal(savedContacts[0].sellerId, SELLER_A_ID);
            assert.equal(savedContacts[1].sellerId, SELLER_B_ID);
            assert.equal(savedContacts[0].email, savedContacts[1].email);
        });

        it('getEffectiveSellerId maps team members and root merchant to store root pool', () => {
            const rootReq = { sellerEmail: TEST_ROOT_EMAIL, isTeamMember: false };
            assert.equal(getEffectiveSellerId(rootReq), TEST_ROOT_EMAIL);

            const teamReq = { sellerEmail: 'strategist@greencart.com', isTeamMember: true };
            assert.equal(getEffectiveSellerId(teamReq), TEST_ROOT_EMAIL);

            const tenantReq = { sellerId: 'tenant_123', sellerEmail: 'tenant@store.com', isTeamMember: false };
            assert.equal(getEffectiveSellerId(tenantReq), 'tenant_123');
        });

        it('Seller A cannot view or list Seller B contacts in getContacts', async () => {
            let capturedQuery = null;
            Contact.find = (query) => {
                capturedQuery = query;
                return {
                    sort: () => ({
                        lean: async () => [
                            { _id: 'c1', sellerId: SELLER_A_ID, name: 'Seller A Contact', email: 'a@example.com' }
                        ]
                    })
                };
            };

            const req = { sellerId: SELLER_A_ID, query: {} };
            const res = createMockRes();
            await getContacts(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(capturedQuery.sellerId, SELLER_A_ID);
            assert.equal(res.body.contacts.length, 1);
            assert.equal(res.body.contacts[0].name, 'Seller A Contact');
        });
    });

    // =========================================================================
    // 4. Live Search & Safe Regex Handling
    // =========================================================================
    describe('4. Search Functionality & Regex Safety', () => {
        it('builds case-insensitive search queries across name, email, and phone', async () => {
            let capturedQuery = null;
            Contact.find = (query) => {
                capturedQuery = query;
                return {
                    sort: () => ({
                        lean: async () => []
                    })
                };
            };

            const req = { sellerId: SELLER_A_ID, query: { search: 'Smith' } };
            const res = createMockRes();
            await getContacts(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(capturedQuery.sellerId, SELLER_A_ID);
            assert.ok(capturedQuery.$or);
            assert.equal(capturedQuery.$or.length, 3);
            assert.deepEqual(capturedQuery.$or[0], { name: { $regex: 'Smith', $options: 'i' } });
            assert.deepEqual(capturedQuery.$or[1], { email: { $regex: 'Smith', $options: 'i' } });
            assert.deepEqual(capturedQuery.$or[2], { phone: { $regex: 'Smith', $options: 'i' } });
        });

        it('escapes special regex characters to prevent ReDoS / injection', async () => {
            let capturedQuery = null;
            Contact.find = (query) => {
                capturedQuery = query;
                return {
                    sort: () => ({
                        lean: async () => []
                    })
                };
            };

            const maliciousQuery = '+1 (555) [test].*^$';
            const escapedExpected = escapeRegex(maliciousQuery);
            assert.equal(escapedExpected, '\\+1 \\(555\\) \\[test\\]\\.\\*\\^\\$');

            const req = { sellerId: SELLER_A_ID, query: { search: maliciousQuery } };
            const res = createMockRes();
            await getContacts(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(capturedQuery.$or[0].name.$regex, escapedExpected);
        });
    });

    // =========================================================================
    // 5. Contact Details & Genuine Order Association
    // =========================================================================
    describe('5. Profile View & Real Order Association', () => {
        const contactId = new mongoose.Types.ObjectId().toString();

        it('rejects invalid ObjectId formats with 400', async () => {
            const req = { params: { id: 'invalid-hex-id' }, sellerId: SELLER_A_ID };
            const res = createMockRes();
            await getContactById(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /invalid contact id/i);
        });

        it('returns 404 if contact belongs to a different seller or does not exist', async () => {
            Contact.findOne = () => ({
                lean: async () => null
            });

            const req = { params: { id: contactId }, sellerId: SELLER_A_ID };
            const res = createMockRes();
            await getContactById(req, res);

            assert.equal(res.statusCode, 404);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /contact not found/i);
        });

        it('fetches matching registered User and genuine populated Orders without fabrication', async () => {
            const customerMongoId = new mongoose.Types.ObjectId();
            const contactDoc = {
                _id: contactId,
                sellerId: SELLER_A_ID,
                name: 'Jane Customer',
                email: 'jane@example.com',
                phone: '+1-555-0144',
                image: 'https://drive.google.com/uc?id=1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-'
            };

            Contact.findOne = () => ({
                lean: async () => ({ ...contactDoc })
            });

            User.findOne = () => ({
                select: () => ({
                    lean: async () => ({
                        _id: customerMongoId,
                        name: 'Jane Customer',
                        email: 'jane@example.com',
                        clerkId: 'user_clerk_123',
                        authProvider: 'clerk_google'
                    })
                })
            });

            Order.find = (query) => {
                assert.equal(query.userId, String(customerMongoId));
                return {
                    populate: () => ({
                        sort: () => ({
                            limit: () => ({
                                lean: async () => [
                                    {
                                        _id: 'order_991',
                                        userId: String(customerMongoId),
                                        amount: 85.50,
                                        status: 'Delivered',
                                        items: [
                                            { product: { name: 'Fresh Organic Milk', price: 4.50 }, quantity: 2 }
                                        ]
                                    }
                                ]
                            })
                        })
                    })
                };
            };

            const req = { params: { id: contactId }, sellerId: SELLER_A_ID };
            const res = createMockRes();
            await getContactById(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.contact.image, 'https://lh3.googleusercontent.com/d/1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-');
            assert.equal(res.body.customer.email, 'jane@example.com');
            assert.equal(res.body.orders.length, 1);
            assert.equal(res.body.orders[0]._id, 'order_991');
        });

        it('returns empty orders and null customer if contact is not a registered user', async () => {
            Contact.findOne = () => ({
                lean: async () => ({
                    _id: contactId,
                    sellerId: SELLER_A_ID,
                    name: 'Guest Contact',
                    email: 'guest@outside.com',
                    phone: '+1-555-0999'
                })
            });

            User.findOne = () => ({
                select: () => ({
                    lean: async () => null
                })
            });

            const req = { params: { id: contactId }, sellerId: SELLER_A_ID };
            const res = createMockRes();
            await getContactById(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.customer, null);
            assert.deepEqual(res.body.orders, []);
        });
    });

    // =========================================================================
    // 6. Update Contact Operations & Guardrails
    // =========================================================================
    describe('6. Update Contact Operations & Guardrails', () => {
        const contactId = new mongoose.Types.ObjectId().toString();

        it('successfully updates contact fields including Google Drive image normalization', async () => {
            const existingContact = {
                _id: contactId,
                sellerId: SELLER_A_ID,
                name: 'Old Name',
                email: 'contact@example.com',
                phone: '+1-555-0100',
                image: '',
                notes: '',
                status: 'Active',
                save: async function () { return this; }
            };

            Contact.findOne = async ({ _id, sellerId }) => {
                if (_id === contactId && sellerId === SELLER_A_ID) return existingContact;
                return null;
            };

            const req = {
                params: { id: contactId },
                sellerId: SELLER_A_ID,
                body: {
                    name: 'Updated Name',
                    phone: '+1-555-9999',
                    image: 'https://drive.google.com/open?id=1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-',
                    notes: 'Upgraded to VIP',
                    status: 'Customer'
                }
            };
            const res = createMockRes();
            await updateContact(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.equal(existingContact.name, 'Updated Name');
            assert.equal(existingContact.phone, '+1-555-9999');
            assert.equal(existingContact.image, 'https://lh3.googleusercontent.com/d/1dwLafGZEsnjhTVfDKc1uOC78O6La_n3-');
            assert.equal(existingContact.status, 'Customer');
            assert.equal(existingContact.notes, 'Upgraded to VIP');
        });

        it('strictly blocks updating a contact owned by a different seller (404 Not Found)', async () => {
            Contact.findOne = async () => null; // Seller B cannot find Seller A's contact

            const req = {
                params: { id: contactId },
                sellerId: SELLER_B_ID,
                body: { name: 'Attempted Hijack' }
            };
            const res = createMockRes();
            await updateContact(req, res);

            assert.equal(res.statusCode, 404);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /contact not found/i);
        });

        it('prevents updating email to an address already taken by another contact of the same seller', async () => {
            const existingContact = {
                _id: contactId,
                sellerId: SELLER_A_ID,
                name: 'Contact One',
                email: 'one@example.com',
                phone: '+1-555-0101',
                save: async function () { return this; }
            };

            Contact.findOne = async (query) => {
                if (query._id === contactId && query.sellerId === SELLER_A_ID) {
                    return existingContact;
                }
                // Check duplicate lookup
                if (query.email === 'taken@example.com') {
                    return { _id: 'other_contact_id', email: 'taken@example.com' };
                }
                return null;
            };

            const req = {
                params: { id: contactId },
                sellerId: SELLER_A_ID,
                body: { email: 'taken@example.com' }
            };
            const res = createMockRes();
            await updateContact(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /already exists in your contacts list/i);
        });

        it('rejects invalid status values with 400', async () => {
            const existingContact = {
                _id: contactId,
                sellerId: SELLER_A_ID,
                name: 'Contact Status Test',
                email: 'status@example.com',
                phone: '+1-555-0101',
                save: async function () { return this; }
            };

            Contact.findOne = async () => existingContact;

            const req = {
                params: { id: contactId },
                sellerId: SELLER_A_ID,
                body: { status: 'INVALID_STATUS' }
            };
            const res = createMockRes();
            await updateContact(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /status must be one of/i);
        });
    });

    // =========================================================================
    // 7. Delete Contact Operations
    // =========================================================================
    describe('7. Delete Contact Operations & Isolation', () => {
        const contactId = new mongoose.Types.ObjectId().toString();

        it('successfully deletes contact owned by authenticated seller', async () => {
            Contact.findOneAndDelete = async (query) => {
                if (query._id === contactId && query.sellerId === SELLER_A_ID) {
                    return { _id: contactId, name: 'Deleted Contact' };
                }
                return null;
            };

            const req = { params: { id: contactId }, sellerId: SELLER_A_ID };
            const res = createMockRes();
            await deleteContact(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.match(res.body.message, /deleted successfully/i);
        });

        it('returns 404 and refuses deletion if contact belongs to another seller', async () => {
            Contact.findOneAndDelete = async () => null;

            const req = { params: { id: contactId }, sellerId: SELLER_B_ID };
            const res = createMockRes();
            await deleteContact(req, res);

            assert.equal(res.statusCode, 404);
            assert.equal(res.body.success, false);
            assert.match(res.body.message, /contact not found/i);
        });
    });

    // =========================================================================
    // 8. Direct Messaging Integration
    // =========================================================================
    describe('8. Direct Messaging & Conversation Integration', () => {
        const contactId = new mongoose.Types.ObjectId().toString();
        const customerId = new mongoose.Types.ObjectId();

        it('returns existing conversationId when contact email matches a registered user', async () => {
            Contact.findOne = async () => ({
                _id: contactId,
                email: 'customer@greencart.com'
            });

            User.findOne = async () => ({
                _id: customerId,
                email: 'customer@greencart.com'
            });

            const existingConvId = new mongoose.Types.ObjectId();
            Conversation.findOne = async () => ({
                _id: existingConvId,
                customerId
            });

            const req = { params: { id: contactId }, sellerId: SELLER_A_ID };
            const res = createMockRes();
            await initiateContactChat(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.isRegisteredCustomer, true);
            assert.equal(res.body.conversationId, existingConvId);
        });

        it('creates a new Conversation if registered user has no prior chat conversation', async () => {
            Contact.findOne = async () => ({
                _id: contactId,
                email: 'newchat@greencart.com'
            });

            User.findOne = async () => ({
                _id: customerId,
                email: 'newchat@greencart.com'
            });

            Conversation.findOne = async () => null;

            let savedConv = null;
            Conversation.prototype.save = async function () {
                this._id = new mongoose.Types.ObjectId();
                savedConv = this;
                return this;
            };

            const req = { params: { id: contactId }, sellerId: SELLER_A_ID };
            const res = createMockRes();
            await initiateContactChat(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.isRegisteredCustomer, true);
            assert.ok(res.body.conversationId);
            assert.equal(savedConv.customerId, customerId);
        });

        it('indicates isRegisteredCustomer: false when contact email has no customer account', async () => {
            Contact.findOne = async () => ({
                _id: contactId,
                email: 'unregistered@outside.com'
            });

            User.findOne = async () => null;

            const req = { params: { id: contactId }, sellerId: SELLER_A_ID };
            const res = createMockRes();
            await initiateContactChat(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, false);
            assert.equal(res.body.isRegisteredCustomer, false);
            assert.match(res.body.message, /does not have a GreenCart customer account yet/i);
        });
    });

    // =========================================================================
    // 9. Role-Based Access Control (RBAC) Enforcement
    // =========================================================================
    describe('9. Role-Based Access Control (RBAC) Enforcement', () => {
        it('allows Admin, CEO, CTO, and Strategist to read contacts and profile details', () => {
            const readMiddleware = requireRole('Admin', 'CEO', 'CTO', 'Strategist');
            const allowedRoles = ['Admin', 'CEO', 'CTO', 'Strategist'];

            for (const role of allowedRoles) {
                const req = { sellerRole: role, seller: { role } };
                const res = createMockRes();
                let nextCalled = false;
                readMiddleware(req, res, () => { nextCalled = true; });

                assert.equal(nextCalled, true, `Role ${role} should be permitted to read contacts`);
                assert.equal(res.statusCode, 200);
            }
        });

        it('allows Admin, CEO, and CTO to create or update contacts, but blocks Strategist with 403', () => {
            const mutateMiddleware = requireRole('Admin', 'CEO', 'CTO');

            // Admin, CEO, CTO allowed
            for (const role of ['Admin', 'CEO', 'CTO']) {
                const req = { sellerRole: role, seller: { role } };
                let nextCalled = false;
                mutateMiddleware(req, createMockRes(), () => { nextCalled = true; });
                assert.equal(nextCalled, true, `Role ${role} should be permitted to create/update contacts`);
            }

            // Strategist blocked
            const reqStrat = { sellerRole: 'Strategist', seller: { role: 'Strategist' } };
            const resStrat = createMockRes();
            let stratNextCalled = false;
            mutateMiddleware(reqStrat, resStrat, () => { stratNextCalled = true; });

            assert.equal(stratNextCalled, false);
            assert.equal(resStrat.statusCode, 403);
            assert.equal(resStrat.body.success, false);
            assert.match(resStrat.body.message, /insufficient role permissions/i);
        });

        it('strictly restricts contact deletion to Admin and CEO; blocks CTO and Strategist with 403', () => {
            const deleteMiddleware = requireRole('Admin', 'CEO');

            // Admin and CEO allowed
            for (const role of ['Admin', 'CEO']) {
                const req = { sellerRole: role, seller: { role } };
                let nextCalled = false;
                deleteMiddleware(req, createMockRes(), () => { nextCalled = true; });
                assert.equal(nextCalled, true, `Role ${role} should be permitted to delete contacts`);
            }

            // CTO blocked
            const reqCto = { sellerRole: 'CTO', seller: { role: 'CTO' } };
            const resCto = createMockRes();
            let ctoNextCalled = false;
            deleteMiddleware(reqCto, resCto, () => { ctoNextCalled = true; });
            assert.equal(ctoNextCalled, false);
            assert.equal(resCto.statusCode, 403);

            // Strategist blocked
            const reqStrat = { sellerRole: 'Strategist', seller: { role: 'Strategist' } };
            const resStrat = createMockRes();
            let stratNextCalled = false;
            deleteMiddleware(reqStrat, resStrat, () => { stratNextCalled = true; });
            assert.equal(stratNextCalled, false);
            assert.equal(resStrat.statusCode, 403);
        });
    });

    // =========================================================================
    // 10. Automatic Customer Contact Directory Suite
    // =========================================================================
    describe('10. Automatic Customer Contact Directory Suite', () => {
        it('1. Existing customers appear automatically without manual contact creation', async () => {
            const customerId1 = 'user_hist_1';
            const customerId2 = 'user_hist_2';

            const historicalOrders = [
                {
                    _id: 'ord_hist_1',
                    userId: customerId1,
                    createdAt: new Date('2026-08-01T10:00:00Z'),
                    paymentType: 'COD',
                    isPaid: true,
                    address: {
                        firstName: 'Alice',
                        lastName: 'Wonder',
                        email: 'alice@example.com',
                        phone: '+1-555-0101'
                    }
                },
                {
                    _id: 'ord_hist_2',
                    userId: customerId2,
                    createdAt: new Date('2026-08-15T14:00:00Z'),
                    paymentType: 'COD',
                    isPaid: true,
                    address: {
                        firstName: 'Bob',
                        lastName: 'Builder',
                        email: 'bob@example.com',
                        phone: '+1-555-0102'
                    }
                }
            ];

            // Mock Order.find for syncExistingCustomersFromOrders
            Order.find = () => ({
                populate: () => ({
                    sort: () => ({
                        lean: async () => [...historicalOrders]
                    })
                })
            });

            User.findById = (id) => ({
                select: () => ({
                    lean: async () => {
                        if (id === customerId1) return { _id: customerId1, name: 'Alice Wonder', email: 'alice@example.com' };
                        if (id === customerId2) return { _id: customerId2, name: 'Bob Builder', email: 'bob@example.com' };
                        return null;
                    }
                })
            });

            const inMemoryContacts = [];
            Contact.findOne = async (query) => {
                const matchUserId = query.userId || query.$or?.find(clause => clause.userId)?.userId;
                const matchEmail = query.email || query.$or?.find(clause => clause.email)?.email;
                return inMemoryContacts.find(c =>
                    c.sellerId === query.sellerId &&
                    ((matchUserId && c.userId === matchUserId) || (matchEmail && c.email === matchEmail))
                ) || null;
            };

            Contact.prototype.save = async function () {
                if (!this._id) this._id = new mongoose.Types.ObjectId().toString();
                const existingIdx = inMemoryContacts.findIndex(c => c.sellerId === this.sellerId && c.email === this.email);
                if (existingIdx >= 0) {
                    inMemoryContacts[existingIdx] = this;
                } else {
                    inMemoryContacts.push(this);
                }
                return this;
            };

            Contact.find = (query) => ({
                sort: () => ({
                    lean: async () => inMemoryContacts.filter(c => c.sellerId === query.sellerId)
                })
            });

            const req = { sellerEmail: TEST_ROOT_EMAIL, isTeamMember: false, query: {} };
            const res = createMockRes();
            await getContacts(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.contacts.length, 2);

            const emails = res.body.contacts.map(c => c.email);
            assert.ok(emails.includes('alice@example.com'));
            assert.ok(emails.includes('bob@example.com'));

            const alice = res.body.contacts.find(c => c.email === 'alice@example.com');
            assert.equal(alice.name, 'Alice Wonder');
            assert.equal(alice.phone, '+1-555-0101');
            assert.equal(alice.totalOrders, 1);
            assert.equal(alice.status, 'Customer');
        });

        it('2. A customer with multiple orders appears only once with aggregated order stats', async () => {
            const multiOrderId = 'user_multi_orders';

            const orders = [
                {
                    _id: 'ord_1',
                    userId: multiOrderId,
                    createdAt: new Date('2026-07-01T10:00:00Z'),
                    paymentType: 'COD',
                    isPaid: true,
                    address: { firstName: 'Diana', lastName: 'Prince', email: 'diana@themyscira.com', phone: '+1-555-0111' }
                },
                {
                    _id: 'ord_2',
                    userId: multiOrderId,
                    createdAt: new Date('2026-08-01T10:00:00Z'),
                    paymentType: 'COD',
                    isPaid: true,
                    address: { firstName: 'Diana', lastName: 'Prince', email: 'diana@themyscira.com', phone: '+1-555-0111' }
                },
                {
                    _id: 'ord_3',
                    userId: multiOrderId,
                    createdAt: new Date('2026-09-01T10:00:00Z'),
                    paymentType: 'COD',
                    isPaid: true,
                    address: { firstName: 'Diana', lastName: 'Prince', email: 'diana@themyscira.com', phone: '+1-555-0199' }
                }
            ];

            Order.find = () => ({
                populate: () => ({
                    sort: () => ({
                        lean: async () => [...orders]
                    })
                })
            });

            User.findById = () => ({
                select: () => ({
                    lean: async () => ({
                        _id: multiOrderId,
                        name: 'Diana Prince',
                        email: 'diana@themyscira.com'
                    })
                })
            });

            const inMemoryContacts = [];
            Contact.findOne = async (query) => {
                const matchEmail = query.email || query.$or?.find(clause => clause.email)?.email;
                return inMemoryContacts.find(c => c.email === matchEmail) || null;
            };

            Contact.prototype.save = async function () {
                if (!this._id) this._id = new mongoose.Types.ObjectId().toString();
                const existingIdx = inMemoryContacts.findIndex(c => c.email === this.email);
                if (existingIdx >= 0) {
                    inMemoryContacts[existingIdx] = this;
                } else {
                    inMemoryContacts.push(this);
                }
                return this;
            };

            Contact.find = (query) => ({
                sort: () => ({
                    lean: async () => inMemoryContacts.filter(c => c.sellerId === query.sellerId)
                })
            });

            const req = { sellerEmail: TEST_ROOT_EMAIL, isTeamMember: false, query: {} };
            const res = createMockRes();
            await getContacts(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            // Exactly ONE customer entry despite 3 orders
            assert.equal(res.body.contacts.length, 1);
            const diana = res.body.contacts[0];
            assert.equal(diana.name, 'Diana Prince');
            assert.equal(diana.email, 'diana@themyscira.com');
            assert.equal(diana.totalOrders, 3);
            assert.equal(new Date(diana.latestOrderDate).toISOString(), new Date('2026-09-01T10:00:00Z').toISOString());
            assert.equal(diana.phone, '+1-555-0199');
        });

        it('3. A newly placed order adds its customer automatically and increments on repeated orders', async () => {
            const customerId = 'user_auto_new';
            let storedContact = null;

            Contact.findOne = async (query) => {
                if (!storedContact) return null;
                const matchUserId = query.userId || query.$or?.find(clause => clause.userId)?.userId;
                const matchEmail = query.email || query.$or?.find(clause => clause.email)?.email;
                if (matchUserId && storedContact.userId === matchUserId) return storedContact;
                if (matchEmail && storedContact.email === matchEmail) return storedContact;
                return null;
            };

            Contact.prototype.save = async function () {
                storedContact = this;
                return this;
            };

            User.findById = () => ({
                select: () => ({
                    lean: async () => ({
                        _id: customerId,
                        name: 'Clark Kent',
                        email: 'clark@dailyplanet.com'
                    })
                })
            });

            // 1. Customer places First Order
            const firstOrder = {
                _id: 'ord_first',
                userId: customerId,
                createdAt: new Date('2026-10-01T12:00:00Z'),
                items: [{ product: 'prod_1', quantity: 1 }],
                paymentType: 'COD'
            };
            const firstAddress = {
                firstName: 'Clark',
                lastName: 'Kent',
                email: 'clark@dailyplanet.com',
                phone: '+1-555-0144'
            };

            await syncCustomerContactFromOrder(firstOrder, firstAddress);

            assert.ok(storedContact);
            assert.equal(storedContact.name, 'Clark Kent');
            assert.equal(storedContact.email, 'clark@dailyplanet.com');
            assert.equal(storedContact.phone, '+1-555-0144');
            assert.equal(storedContact.totalOrders, 1);
            assert.equal(storedContact.status, 'Customer');

            // 2. Customer places Second Order: repeated order increments totalOrders without duplicate
            const secondOrder = {
                _id: 'ord_second',
                userId: customerId,
                createdAt: new Date('2026-10-15T15:00:00Z'),
                items: [{ product: 'prod_1', quantity: 2 }],
                paymentType: 'COD'
            };

            await syncCustomerContactFromOrder(secondOrder, firstAddress);

            assert.equal(storedContact.totalOrders, 2);
            assert.equal(new Date(storedContact.latestOrderDate).toISOString(), new Date('2026-10-15T15:00:00Z').toISOString());
        });

        it('4. The correct seller sees the correct customers (Seller Order Isolation)', async () => {
            const prodAlphaId = new mongoose.Types.ObjectId().toString();
            const prodBetaId = new mongoose.Types.ObjectId().toString();

            // Product belongs to Seller Alpha
            Product.find = (query) => ({
                select: () => ({
                    lean: async () => {
                        if (query.sellerId === SELLER_A_ID) {
                            return [{ _id: prodAlphaId, sellerId: SELLER_A_ID }];
                        }
                        if (query.sellerId === SELLER_B_ID) {
                            return [{ _id: prodBetaId, sellerId: SELLER_B_ID }];
                        }
                        return [];
                    }
                })
            });

            const orderAlpha = {
                _id: 'ord_alpha',
                userId: 'user_alpha_only',
                createdAt: new Date('2026-10-01'),
                paymentType: 'COD',
                items: [{ product: prodAlphaId, quantity: 1 }],
                address: { firstName: 'Arthur', lastName: 'Curry', email: 'arthur@atlantis.com', phone: '111-222-3333' }
            };

            const orderBeta = {
                _id: 'ord_beta',
                userId: 'user_beta_only',
                createdAt: new Date('2026-10-02'),
                paymentType: 'COD',
                items: [{ product: prodBetaId, quantity: 1 }],
                address: { firstName: 'Barry', lastName: 'Allen', email: 'barry@centralcity.com', phone: '444-555-6666' }
            };

            Order.find = (query) => ({
                populate: () => ({
                    sort: () => ({
                        lean: async () => {
                            // Verify seller isolation query filter
                            const productInQuery = query.$and?.[1]?.$or?.find(clause => clause['items.product'])?.['items.product']?.$in;
                            if (productInQuery && productInQuery.includes(prodAlphaId)) {
                                return [orderAlpha];
                            }
                            if (productInQuery && productInQuery.includes(prodBetaId)) {
                                return [orderBeta];
                            }
                            return [];
                        }
                    })
                })
            });

            User.findById = (id) => ({
                select: () => ({
                    lean: async () => {
                        if (id === 'user_alpha_only') return { _id: id, name: 'Arthur Curry', email: 'arthur@atlantis.com' };
                        if (id === 'user_beta_only') return { _id: id, name: 'Barry Allen', email: 'barry@centralcity.com' };
                        return null;
                    }
                })
            });

            const contactsDB = [];
            Contact.findOne = async (query) => {
                const matchUserId = query.userId || query.$or?.find(clause => clause.userId)?.userId;
                const matchEmail = query.email || query.$or?.find(clause => clause.email)?.email;
                return contactsDB.find(c =>
                    c.sellerId === query.sellerId &&
                    ((matchUserId && c.userId === matchUserId) || (matchEmail && c.email === matchEmail))
                ) || null;
            };

            Contact.prototype.save = async function () {
                if (!this._id) this._id = new mongoose.Types.ObjectId().toString();
                contactsDB.push(this);
                return this;
            };

            Contact.find = (query) => ({
                sort: () => ({
                    lean: async () => contactsDB.filter(c => c.sellerId === query.sellerId)
                })
            });

            // Seller Alpha queries
            const reqAlpha = { sellerId: SELLER_A_ID, sellerRole: 'CTO', query: {} };
            const resAlpha = createMockRes();
            await getContacts(reqAlpha, resAlpha);

            assert.equal(resAlpha.body.contacts.length, 1);
            assert.equal(resAlpha.body.contacts[0].email, 'arthur@atlantis.com');

            // Seller Beta queries
            const reqBeta = { sellerId: SELLER_B_ID, sellerRole: 'CEO', query: {} };
            const resBeta = createMockRes();
            await getContacts(reqBeta, resBeta);

            assert.equal(resBeta.body.contacts.length, 1);
            assert.equal(resBeta.body.contacts[0].email, 'barry@centralcity.com');
        });

        it('5. Customer order history is accurate and genuine in profile modal', async () => {
            const customerId = 'user_order_history_test';
            const contactId = new mongoose.Types.ObjectId().toString();

            Contact.findOne = () => ({
                lean: async () => ({
                    _id: contactId,
                    sellerId: TEST_ROOT_EMAIL,
                    userId: customerId,
                    name: 'Bruce Wayne',
                    email: 'bruce@wayne.com',
                    phone: '+1-555-0999',
                    status: 'Customer'
                })
            });

            User.findById = () => ({
                select: () => ({
                    lean: async () => ({
                        _id: customerId,
                        name: 'Bruce Wayne',
                        email: 'bruce@wayne.com'
                    })
                })
            });

            const realOrders = [
                {
                    _id: 'ord_real_1',
                    orderNumber: 'GC-BW0001',
                    userId: customerId,
                    amount: 250.00,
                    status: 'Delivered',
                    paymentType: 'COD',
                    createdAt: new Date('2026-10-20'),
                    items: [
                        { product: { name: 'Tactical Backpack', price: 150.00 }, quantity: 1 },
                        { product: { name: 'Night Vision Goggles', price: 100.00 }, quantity: 1 }
                    ]
                }
            ];

            Order.find = () => ({
                populate: () => ({
                    sort: () => ({
                        limit: () => ({
                            lean: async () => realOrders
                        })
                    })
                })
            });

            const req = { params: { id: contactId }, sellerEmail: TEST_ROOT_EMAIL, isTeamMember: false };
            const res = createMockRes();
            await getContactById(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.body.success, true);
            assert.equal(res.body.contact.name, 'Bruce Wayne');
            assert.equal(res.body.contact.totalOrders, 1);
            assert.equal(res.body.orders.length, 1);
            assert.equal(res.body.orders[0].orderNumber, 'GC-BW0001');
            assert.equal(res.body.orders[0].items.length, 2);
        });

        it('6. Search and Message actions still work on auto-synced customers', async () => {
            const syncedCustomer = {
                _id: new mongoose.Types.ObjectId().toString(),
                sellerId: TEST_ROOT_EMAIL,
                userId: 'user_search_msg',
                name: 'Selina Kyle',
                email: 'selina@gotham.com',
                phone: '+1-555-7777',
                status: 'Customer',
                totalOrders: 2
            };

            // Search query matches Selina
            Contact.find = (query) => ({
                sort: () => ({
                    lean: async () => {
                        if (query.$or && query.$or.some(clause => clause.name?.$regex === 'selina')) {
                            return [syncedCustomer];
                        }
                        return [];
                    }
                })
            });

            const searchReq = { sellerEmail: TEST_ROOT_EMAIL, isTeamMember: false, query: { search: 'selina' } };
            const searchRes = createMockRes();
            await getContacts(searchReq, searchRes);

            assert.equal(searchRes.statusCode, 200);
            assert.equal(searchRes.body.contacts.length, 1);
            assert.equal(searchRes.body.contacts[0].email, 'selina@gotham.com');

            // Messaging Selina
            Contact.findOne = async () => syncedCustomer;
            User.findById = async () => ({ _id: 'user_search_msg', email: 'selina@gotham.com' });
            User.findOne = async () => ({ _id: 'user_search_msg', email: 'selina@gotham.com' });

            const convId = new mongoose.Types.ObjectId();
            Conversation.findOne = async () => ({ _id: convId, customerId: 'user_search_msg' });

            const msgReq = { params: { id: syncedCustomer._id }, sellerEmail: TEST_ROOT_EMAIL, isTeamMember: false };
            const msgRes = createMockRes();
            await initiateContactChat(msgReq, msgRes);

            assert.equal(msgRes.statusCode, 200);
            assert.equal(msgRes.body.success, true);
            assert.equal(msgRes.body.isRegisteredCustomer, true);
            assert.equal(msgRes.body.conversationId, convId);
        });

        it('7. Failed or cancelled order creation does not create an incorrect contact', async () => {
            let contactCreated = false;
            Contact.prototype.save = async function () {
                contactCreated = true;
                return this;
            };

            // Simulate checkout failure: unauthenticated request
            const failReq = {
                userId: null,
                body: { items: [], address: 'addr_1' }
            };
            const failRes = createMockRes();
            await placeOrderCOD(failReq, failRes);

            assert.equal(failRes.statusCode, 401);
            assert.equal(failRes.body.success, false);
            // Assert NO contact was created
            assert.equal(contactCreated, false);
        });
    });
});
