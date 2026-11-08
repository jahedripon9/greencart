import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Order from '../models/Order.js';
import { updateOrderStatus, ALLOWED_ORDER_STATUSES } from '../controllers/orderController.js';
import authSeller from '../middlewares/authSeller.js';

describe('GreenCart Seller Order Status Security & Validation Suite', () => {
    const validOrderId = '507f1f77bcf86cd799439021';
    const missingOrderId = '507f1f77bcf86cd799439099';
    const terminalDeliveredId = '507f1f77bcf86cd799439022';
    const terminalCancelledId = '507f1f77bcf86cd799439023';
    const onlineOrderId = '507f1f77bcf86cd799439024';

    let origOrderFindById;
    let origOrderFindByIdAndUpdate;
    let orderStore;

    beforeEach(() => {
        orderStore = new Map();

        // Seed orders
        orderStore.set(validOrderId, {
            _id: validOrderId,
            userId: 'user_123',
            items: [{ product: 'prod_1', quantity: 2 }],
            amount: 100,
            address: 'addr_1',
            status: 'Order Placed',
            paymentType: 'COD',
            isPaid: false,
            idempotencyKey: 'idemp_key_1',
            cartDeducted: true
        });

        orderStore.set(terminalDeliveredId, {
            _id: terminalDeliveredId,
            userId: 'user_123',
            items: [{ product: 'prod_1', quantity: 1 }],
            amount: 50,
            address: 'addr_1',
            status: 'Delivered',
            paymentType: 'COD',
            isPaid: true
        });

        orderStore.set(terminalCancelledId, {
            _id: terminalCancelledId,
            userId: 'user_123',
            items: [{ product: 'prod_1', quantity: 1 }],
            amount: 50,
            address: 'addr_1',
            status: 'Cancelled',
            paymentType: 'COD',
            isPaid: false
        });

        orderStore.set(onlineOrderId, {
            _id: onlineOrderId,
            userId: 'user_123',
            items: [{ product: 'prod_1', quantity: 1 }],
            amount: 50,
            address: 'addr_1',
            status: 'Order Placed',
            paymentType: 'Stripe',
            isPaid: false
        });

        origOrderFindById = Order.findById;
        origOrderFindByIdAndUpdate = Order.findByIdAndUpdate;

        Order.findById = async (id) => {
            const doc = orderStore.get(id);
            return doc ? { ...doc } : null;
        };

        Order.findByIdAndUpdate = (id, update, options) => {
            const existing = orderStore.get(id);
            if (!existing) return null;
            const updated = { ...existing, ...update.$set };
            orderStore.set(id, updated);

            // Return mock with chained populate
            return {
                ...updated,
                populate: async () => updated
            };
        };
    });

    afterEach(() => {
        Order.findById = origOrderFindById;
        Order.findByIdAndUpdate = origOrderFindByIdAndUpdate;
    });

    const createMockRes = () => {
        const res = {
            statusCode: 200,
            data: null,
            status(code) {
                res.statusCode = code;
                return res;
            },
            json(payload) {
                res.data = payload;
                return payload;
            }
        };
        return res;
    };

    // 1. Unauthenticated requests are rejected
    it('1. authSeller rejects unauthenticated requests with 401', async () => {
        const req = { cookies: {} };
        const res = createMockRes();
        let nextCalled = false;
        await authSeller(req, res, () => { nextCalled = true; });

        assert.equal(nextCalled, false);
        assert.equal(res.statusCode, 401);
        assert.equal(res.data.success, false);
    });

    // 2. Malformed order IDs are rejected
    it('2. updateOrderStatus rejects malformed order IDs with 400', async () => {
        const req = { body: { orderId: 'not-a-valid-object-id', status: 'Packing' } };
        const res = createMockRes();

        await updateOrderStatus(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.match(res.data.message, /Invalid order ID/i);
    });

    // 3. Invalid status values are rejected
    it('3. updateOrderStatus rejects unallowed status values with 400', async () => {
        const req = { body: { orderId: validOrderId, status: 'InvalidStatusXYZ' } };
        const res = createMockRes();

        await updateOrderStatus(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.match(res.data.message, /Invalid status/i);
    });

    // 4. Missing orders return 404
    it('4. updateOrderStatus returns 404 when order does not exist', async () => {
        const req = { body: { orderId: missingOrderId, status: 'Packing' } };
        const res = createMockRes();

        await updateOrderStatus(req, res);

        assert.equal(res.statusCode, 404);
        assert.equal(res.data.success, false);
        assert.match(res.data.message, /Order not found/i);
    });

    // 5. Valid status updates work
    it('5. updateOrderStatus successfully updates order to permitted status', async () => {
        const req = { body: { orderId: validOrderId, status: 'Shipped' } };
        const res = createMockRes();

        await updateOrderStatus(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(orderStore.get(validOrderId).status, 'Shipped');
    });

    // 6. Terminal orders cannot be changed
    it('6. updateOrderStatus rejects changes to terminal orders (Delivered or Cancelled)', async () => {
        // Delivered
        const reqDelivered = { body: { orderId: terminalDeliveredId, status: 'Packing' } };
        const resDelivered = createMockRes();
        await updateOrderStatus(reqDelivered, resDelivered);

        assert.equal(resDelivered.statusCode, 400);
        assert.match(resDelivered.data.message, /Cannot update an order that is already Delivered/i);

        // Cancelled
        const reqCancelled = { body: { orderId: terminalCancelledId, status: 'Packing' } };
        const resCancelled = createMockRes();
        await updateOrderStatus(reqCancelled, resCancelled);

        assert.equal(resCancelled.statusCode, 400);
        assert.match(resCancelled.data.message, /Cannot update an order that is already Cancelled/i);
    });

    // 7. amount, userId, items, idempotencyKey, cartDeducted cannot be modified
    it('7. updateOrderStatus strictly prevents modifying amount, userId, items, and checkout fields', async () => {
        const req = {
            body: {
                orderId: validOrderId,
                status: 'Packing',
                amount: 1, // Attacker trying to change amount to 1
                userId: 'attacker_id',
                items: [{ product: 'free_product', quantity: 99 }],
                idempotencyKey: 'hacked_key',
                cartDeducted: false
            }
        };
        const res = createMockRes();

        await updateOrderStatus(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);

        const updated = orderStore.get(validOrderId);
        assert.equal(updated.status, 'Packing');
        assert.equal(updated.amount, 100); // Unchanged
        assert.equal(updated.userId, 'user_123'); // Unchanged
        assert.equal(updated.items[0].product, 'prod_1'); // Unchanged
        assert.equal(updated.idempotencyKey, 'idemp_key_1'); // Unchanged
        assert.equal(updated.cartDeducted, true); // Unchanged
    });

    // 8. COD payment updates require valid boolean input
    it('8. updateOrderStatus rejects non-boolean isPaid values with 400', async () => {
        const req = { body: { orderId: validOrderId, isPaid: 'true' } }; // String instead of boolean
        const res = createMockRes();

        await updateOrderStatus(req, res);

        assert.equal(res.statusCode, 400);
        assert.match(res.data.message, /must be a boolean/i);
    });

    // 9. Delivered COD orders are not automatically marked paid
    it('9. Delivered status update does NOT automatically mark COD order as paid', async () => {
        const req = { body: { orderId: validOrderId, status: 'Delivered' } };
        const res = createMockRes();

        await updateOrderStatus(req, res);

        assert.equal(res.statusCode, 200);
        const updated = orderStore.get(validOrderId);
        assert.equal(updated.status, 'Delivered');
        assert.equal(updated.isPaid, false); // Crucial: must remain false unless explicitly paid
    });

    // 10. Online orders cannot be marked paid through this endpoint
    it('10. updateOrderStatus rejects manual isPaid updates for non-COD/online orders with 400', async () => {
        const req = { body: { orderId: onlineOrderId, isPaid: true } };
        const res = createMockRes();

        await updateOrderStatus(req, res);

        assert.equal(res.statusCode, 400);
        assert.match(res.data.message, /Online payment status cannot be manually updated/i);
        assert.equal(orderStore.get(onlineOrderId).isPaid, false); // Remained unpaid
    });
});
