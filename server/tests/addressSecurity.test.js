import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Address from '../models/Address.js';
import { addAddress, getAddress } from '../controllers/addressController.js';

describe('GreenCart Address Security & Authorization Suite', () => {
    const authUserId = 'user_auth_123';
    const victimUserId = 'user_victim_456';

    let origAddressCreate;
    let origAddressFind;
    let createdPayloads;

    beforeEach(() => {
        createdPayloads = [];
        origAddressCreate = Address.create;
        origAddressFind = Address.find;

        Address.create = async (payload) => {
            createdPayloads.push(payload);
            return { _id: 'generated_addr_id', ...payload };
        };

        Address.find = async (query) => {
            return [{ _id: 'addr_1', userId: query.userId, street: '123 Main St' }];
        };
    });

    afterEach(() => {
        Address.create = origAddressCreate;
        Address.find = origAddressFind;
    });

    it('addAddress: strictly enforces req.userId and drops client-supplied userId & _id', async () => {
        const req = {
            userId: authUserId,
            body: {
                userId: victimUserId,
                address: {
                    _id: 'injected_id_999',
                    userId: victimUserId,
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    street: '123 Test St',
                    city: 'Test City',
                    state: 'TS',
                    zipcode: 12345,
                    country: 'US',
                    phone: '555-0100',
                    isAdmin: true,
                    role: 'admin'
                }
            }
        };

        let jsonResult = null;
        const res = {
            status: () => res,
            json: (data) => { jsonResult = data; return data; }
        };

        await addAddress(req, res);

        assert.equal(jsonResult.success, true);
        assert.equal(createdPayloads.length, 1);
        const saved = createdPayloads[0];

        // Must strictly use authenticated userId
        assert.equal(saved.userId, authUserId);
        assert.notEqual(saved.userId, victimUserId);

        // Must not contain injected _id or arbitrary keys
        assert.equal(saved._id, undefined);
        assert.equal(saved.isAdmin, undefined);
        assert.equal(saved.role, undefined);

        // Allowlisted fields must be preserved
        assert.equal(saved.firstName, 'John');
        assert.equal(saved.lastName, 'Doe');
        assert.equal(saved.street, '123 Test St');
        assert.equal(saved.zipcode, 12345);
    });

    it('addAddress: rejects non-object or missing address with 400', async () => {
        const req = {
            userId: authUserId,
            body: { address: 'not an object' }
        };

        let statusCode = 200;
        let jsonResult = null;
        const res = {
            status: (code) => { statusCode = code; return res; },
            json: (data) => { jsonResult = data; return data; }
        };

        await addAddress(req, res);
        assert.equal(statusCode, 400);
        assert.equal(jsonResult.success, false);
    });

    it('addAddress: maps Mongoose ValidationError to HTTP 400', async () => {
        Address.create = async () => {
            const err = new Error('Validation failed');
            err.name = 'ValidationError';
            throw err;
        };

        const req = {
            userId: authUserId,
            body: {
                address: { firstName: 'Jane' }
            }
        };

        let statusCode = 200;
        let jsonResult = null;
        const res = {
            status: (code) => { statusCode = code; return res; },
            json: (data) => { jsonResult = data; return data; }
        };

        await addAddress(req, res);
        assert.equal(statusCode, 400);
        assert.equal(jsonResult.success, false);
        assert.equal(jsonResult.message, 'Validation failed');
    });

    it('getAddress: queries strictly by authenticated req.userId (IDOR prevention)', async () => {
        let queriedUserId = null;
        Address.find = async (query) => {
            queriedUserId = query.userId;
            return [];
        };

        // Attacker attempts to pass a victim userId in request body
        const req = {
            userId: authUserId,
            body: { userId: victimUserId }
        };

        let jsonResult = null;
        const res = {
            status: () => res,
            json: (data) => { jsonResult = data; return data; }
        };

        await getAddress(req, res);

        assert.equal(jsonResult.success, true);
        assert.equal(queriedUserId, authUserId);
        assert.notEqual(queriedUserId, victimUserId);
    });

    it('getAddress: returns 401 when req.userId is missing', async () => {
        const req = {
            userId: null,
            body: {}
        };

        let statusCode = 200;
        let jsonResult = null;
        const res = {
            status: (code) => { statusCode = code; return res; },
            json: (data) => { jsonResult = data; return data; }
        };

        await getAddress(req, res);
        assert.equal(statusCode, 401);
        assert.equal(jsonResult.success, false);
    });
});
