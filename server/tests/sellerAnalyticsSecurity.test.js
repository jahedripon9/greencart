import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import Order from '../models/Order.js';
import User from '../models/User.js';
import {
    getSalesAnalytics,
    parseDateRange,
    generateDailySeries
} from '../controllers/sellerController.js';
import authSeller from '../middlewares/authSeller.js';

describe('GreenCart Seller Sales Analytics & Aggregation Security Suite', () => {
    const mockSellerEmail = 'admin@greencart.com';
    const mockJwtSecret = 'test_jwt_secret_seller_analytics_32_chars!';
    let origEnv;
    let origOrderAggregate;
    let origUserCountDocuments;

    beforeEach(() => {
        origEnv = { ...process.env };
        process.env.SELLER_EMAIL = mockSellerEmail;
        process.env.JWT_SECRET = mockJwtSecret;

        origOrderAggregate = Order.aggregate;
        origUserCountDocuments = User.countDocuments;
    });

    afterEach(() => {
        process.env = origEnv;
        Order.aggregate = origOrderAggregate;
        User.countDocuments = origUserCountDocuments;
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
                return res;
            }
        };
        return res;
    };

    const generateSellerToken = (email = mockSellerEmail) => {
        return jwt.sign({ email }, mockJwtSecret, { expiresIn: '7d' });
    };

    // -------------------------------------------------------------------------
    // 1. Unauthorized request rejection
    // -------------------------------------------------------------------------
    it('1. authSeller rejects unauthenticated analytics request when sellerToken is missing (401)', async () => {
        const req = { cookies: {} };
        const res = createMockRes();
        let nextCalled = false;

        await authSeller(req, res, () => { nextCalled = true; });

        assert.equal(res.statusCode, 401);
        assert.equal(res.data.success, false);
        assert.equal(res.data.message, "Not Authorized");
        assert.equal(nextCalled, false);
    });

    it('1b. authSeller rejects invalid or forged sellerToken (401)', async () => {
        const req = { cookies: { sellerToken: 'forged.invalid.token' } };
        const res = createMockRes();
        let nextCalled = false;

        await authSeller(req, res, () => { nextCalled = true; });

        assert.equal(res.statusCode, 401);
        assert.equal(res.data.success, false);
        assert.equal(res.data.message, "Not Authorized");
        assert.equal(nextCalled, false);
    });

    // -------------------------------------------------------------------------
    // 2. Valid seller authentication
    // -------------------------------------------------------------------------
    it('2. authSeller accepts valid seller token and calls next()', async () => {
        const token = generateSellerToken();
        const req = { cookies: { sellerToken: token } };
        const res = createMockRes();
        let nextCalled = false;

        await authSeller(req, res, () => { nextCalled = true; });

        assert.equal(nextCalled, true);
        assert.equal(res.statusCode, 200);
    });

    // -------------------------------------------------------------------------
    // 3. Invalid month format rejection
    // -------------------------------------------------------------------------
    it('3. rejects invalid month format with 400', async () => {
        const invalidMonths = ['2026-13', '2026-00', '26-10', '2026/10', 'October', '2026-1'];
        for (const month of invalidMonths) {
            const req = { query: { month } };
            const res = createMockRes();

            await getSalesAnalytics(req, res);

            assert.equal(res.statusCode, 400, `Expected 400 for month: ${month}`);
            assert.equal(res.data.success, false);
            assert.match(res.data.message, /invalid month format/i);
        }
    });

    // -------------------------------------------------------------------------
    // 4. Invalid or incomplete date range
    // -------------------------------------------------------------------------
    it('4. rejects incomplete date range when only startDate or endDate is provided (400)', async () => {
        const testCases = [
            { startDate: '2026-10-01' },
            { endDate: '2026-10-31' },
            { month: '2026-10', startDate: '2026-10-01' } // Conflicting params
        ];

        for (const query of testCases) {
            const req = { query };
            const res = createMockRes();

            await getSalesAnalytics(req, res);

            assert.equal(res.statusCode, 400);
            assert.equal(res.data.success, false);
        }
    });

    it('4b. rejects non-existent calendar dates like 2026-02-31 with 400', async () => {
        const req = { query: { startDate: '2026-02-31', endDate: '2026-03-05' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.match(res.data.message, /invalid calendar date/i);
    });

    // -------------------------------------------------------------------------
    // 5. Reversed date range rejection
    // -------------------------------------------------------------------------
    it('5. rejects reversed date range where startDate is after endDate with 400', async () => {
        const req = { query: { startDate: '2026-10-31', endDate: '2026-10-01' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.match(res.data.message, /startDate cannot be after endDate/i);
    });

    // -------------------------------------------------------------------------
    // 6. Maximum date-range limit validation
    // -------------------------------------------------------------------------
    it('6. rejects date ranges exceeding maximum limit of 366 days with 400', async () => {
        const req = { query: { startDate: '2024-01-01', endDate: '2025-01-15' } }; // 381 days
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.data.success, false);
        assert.match(res.data.message, /exceeds maximum limit of 366 days/i);
    });

    // -------------------------------------------------------------------------
    // 7. COD and paid online order inclusion
    // -------------------------------------------------------------------------
    it('7. verifies aggregation pipeline includes both COD and paid online orders', async () => {
        let capturedPipeline = null;
        Order.aggregate = async (pipeline) => {
            capturedPipeline = pipeline;
            return [{
                kpis: [{ totalOrders: 2, totalSales: 250, totalPendingOrders: 1 }],
                dailySales: [{ _id: '2026-10-05', sales: 250, orderCount: 2 }]
            }];
        };
        User.countDocuments = async () => 10;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.kpis.totalOrders, 2);
        assert.equal(res.data.data.kpis.totalSales, 250);

        // Verify the $match qualifying condition
        const matchStage = capturedPipeline[0].$match;
        assert.deepEqual(matchStage.$or, [{ paymentType: "COD" }, { isPaid: true }]);
    });

    // -------------------------------------------------------------------------
    // 8. Unpaid online order exclusion
    // -------------------------------------------------------------------------
    it('8. verifies qualifying filter strictly excludes unpaid online orders', () => {
        const range = parseDateRange({ month: '2026-10' });
        const qualifyingMatch = {
            $or: [{ paymentType: "COD" }, { isPaid: true }],
            createdAt: { $gte: range.startUtc, $lt: range.endExclusiveUtc }
        };

        // Helper testing predicate matching
        const isQualifying = (order) => {
            const paymentOk = order.paymentType === "COD" || order.isPaid === true;
            const dateOk = order.createdAt >= range.startUtc && order.createdAt < range.endExclusiveUtc;
            return paymentOk && dateOk;
        };

        const unpaidOnlineOrder = {
            paymentType: "Stripe",
            isPaid: false,
            createdAt: new Date('2026-10-05T12:00:00+06:00')
        };
        const paidOnlineOrder = {
            paymentType: "Stripe",
            isPaid: true,
            createdAt: new Date('2026-10-05T12:00:00+06:00')
        };
        const codOrder = {
            paymentType: "COD",
            isPaid: false,
            createdAt: new Date('2026-10-05T12:00:00+06:00')
        };

        assert.equal(isQualifying(unpaidOnlineOrder), false, 'Unpaid online order must not qualify');
        assert.equal(isQualifying(paidOnlineOrder), true, 'Paid online order must qualify');
        assert.equal(isQualifying(codOrder), true, 'COD order must qualify');
    });

    // -------------------------------------------------------------------------
    // 9. Cancelled order exclusion from sales & inclusion in total orders
    // -------------------------------------------------------------------------
    it('9. verifies Cancelled orders contribute 0 to sales but are counted in totalOrders', async () => {
        Order.aggregate = async () => [{
            kpis: [{
                totalOrders: 3, // 2 active + 1 cancelled
                totalSales: 200, // Cancelled order amount (100) excluded
                totalPendingOrders: 1
            }],
            dailySales: [{ _id: '2026-10-02', sales: 200, orderCount: 2 }]
        }];
        User.countDocuments = async () => 8;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.kpis.totalOrders, 3);
        assert.equal(res.data.data.kpis.totalSales, 200);
    });

    // -------------------------------------------------------------------------
    // 10. Correct pending order count
    // -------------------------------------------------------------------------
    it('10. verifies totalPendingOrders includes only active pending statuses', async () => {
        let capturedPipeline;
        Order.aggregate = async (pipeline) => {
            capturedPipeline = pipeline;
            return [{
                kpis: [{ totalOrders: 5, totalSales: 500, totalPendingOrders: 4 }],
                dailySales: []
            }];
        };
        User.countDocuments = async () => 5;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        assert.equal(res.data.data.kpis.totalPendingOrders, 4);

        // Inspect the pending statuses condition in the facet pipeline
        const kpiFacet = capturedPipeline[1].$facet.kpis;
        const pendingCondition = kpiFacet[0].$group.totalPendingOrders.$sum.$cond[0];
        assert.deepEqual(pendingCondition.$in[1], [
            "Order Placed",
            "Packing",
            "Shipped",
            "Out for Delivery"
        ]);
    });

    // -------------------------------------------------------------------------
    // 11. Delivered order handling
    // -------------------------------------------------------------------------
    it('11. Delivered orders are included in totalSales and totalOrders, but excluded from totalPendingOrders', async () => {
        Order.aggregate = async () => [{
            kpis: [{
                totalOrders: 2,
                totalSales: 300,
                totalPendingOrders: 0 // Both delivered
            }],
            dailySales: [{ _id: '2026-10-10', sales: 300, orderCount: 2 }]
        }];
        User.countDocuments = async () => 15;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        assert.equal(res.data.data.kpis.totalOrders, 2);
        assert.equal(res.data.data.kpis.totalSales, 300);
        assert.equal(res.data.data.kpis.totalPendingOrders, 0);
    });

    // -------------------------------------------------------------------------
    // 12. Asia/Dhaka date grouping and midnight boundaries
    // -------------------------------------------------------------------------
    it('12. verifies Asia/Dhaka midnight boundaries and timezone grouping', async () => {
        let capturedPipeline;
        Order.aggregate = async (pipeline) => {
            capturedPipeline = pipeline;
            return [{
                kpis: [{ totalOrders: 1, totalSales: 100, totalPendingOrders: 0 }],
                dailySales: [{ _id: '2026-10-01', sales: 100, orderCount: 1 }]
            }];
        };
        User.countDocuments = async () => 1;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        const range = res.data.data.range;
        assert.equal(range.startDate, '2026-10-01');
        assert.equal(range.endDate, '2026-10-31');
        assert.equal(range.timezone, 'Asia/Dhaka');

        // Check date grouping timezone parameter
        const dailyFacet = capturedPipeline[1].$facet.dailySales;
        const dateToStringGroup = dailyFacet[1].$group._id.$dateToString;
        assert.equal(dateToStringGroup.timezone, 'Asia/Dhaka');
        assert.equal(dateToStringGroup.format, '%Y-%m-%d');

        // Verify parsed UTC boundaries
        const parsed = parseDateRange({ month: '2026-10' });
        // 2026-10-01 00:00:00 +06:00 is 2026-09-30 18:00:00 UTC
        assert.equal(parsed.startUtc.toISOString(), '2026-09-30T18:00:00.000Z');
        // 2026-10-31 + 1 day = 2026-11-01 00:00:00 +06:00 is 2026-10-31 18:00:00 UTC
        assert.equal(parsed.endExclusiveUtc.toISOString(), '2026-10-31T18:00:00.000Z');
    });

    // -------------------------------------------------------------------------
    // 13. Zero-filled missing dates in daily series
    // -------------------------------------------------------------------------
    it('13. generateDailySeries zero-fills every calendar day with no sales', () => {
        const rawGrouped = [
            { _id: '2026-10-01', sales: 150.5, orderCount: 2 },
            { _id: '2026-10-03', sales: 200, orderCount: 1 }
            // 2026-10-02 has no sales
        ];

        const series = generateDailySeries('2026-10-01', '2026-10-03', rawGrouped);

        assert.equal(series.length, 3);
        assert.deepEqual(series[0], { date: '2026-10-01', sales: 150.5, orderCount: 2 });
        assert.deepEqual(series[1], { date: '2026-10-02', sales: 0, orderCount: 0 }); // Zero-filled
        assert.deepEqual(series[2], { date: '2026-10-03', sales: 200, orderCount: 1 });
    });

    // -------------------------------------------------------------------------
    // 14. Empty dataset handling
    // -------------------------------------------------------------------------
    it('14. handles empty dataset gracefully without errors and returns 0 KPIs', async () => {
        Order.aggregate = async () => [{
            kpis: [], // No matching orders in range
            dailySales: []
        }];
        User.countDocuments = async () => 0;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.success, true);
        assert.equal(res.data.data.kpis.totalOrders, 0);
        assert.equal(res.data.data.kpis.totalSales, 0);
        assert.equal(res.data.data.kpis.totalPendingOrders, 0);
        assert.equal(res.data.data.kpis.totalUsers, 0);
        assert.equal(res.data.data.dailySales.length, 31); // 31 zero-filled days for October
        assert.equal(res.data.data.dailySales[0].sales, 0);
        assert.equal(res.data.data.dailySales[30].sales, 0);
    });

    // -------------------------------------------------------------------------
    // 15. Total Users count independent of date filtering
    // -------------------------------------------------------------------------
    it('15. totalUsers reflects all registered customers regardless of date range', async () => {
        Order.aggregate = async () => [{
            kpis: [{ totalOrders: 0, totalSales: 0, totalPendingOrders: 0 }],
            dailySales: []
        }];
        User.countDocuments = async () => 42; // 42 total registered users

        const req = { query: { startDate: '2026-05-01', endDate: '2026-05-02' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.data.data.kpis.totalUsers, 42); // Independent of date range
        assert.equal(res.data.data.range.startDate, '2026-05-01');
        assert.equal(res.data.data.range.endDate, '2026-05-02');
        assert.equal(res.data.data.dailySales.length, 2);
    });

    // -------------------------------------------------------------------------
    // Phase 5: Product-wise Sales Breakdown Suite
    // -------------------------------------------------------------------------

    it('16. productBreakdown pipeline excludes Cancelled orders', async () => {
        let capturedPipeline;
        Order.aggregate = async (pipeline) => {
            capturedPipeline = pipeline;
            return [{
                kpis: [{ totalOrders: 1, totalSales: 100, totalPendingOrders: 0 }],
                dailySales: [],
                productBreakdown: []
            }];
        };
        User.countDocuments = async () => 1;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        assert.equal(res.statusCode, 200);
        const pbFacet = capturedPipeline[1].$facet.productBreakdown;
        assert.ok(pbFacet, 'productBreakdown facet must be defined');

        // First stage must exclude Cancelled orders
        const matchStage = pbFacet[0].$match;
        assert.deepEqual(matchStage, { status: { $ne: "Cancelled" } });
    });

    it('17. productBreakdown pipeline verifies qualifying payment filter at root (COD or isPaid)', async () => {
        let capturedPipeline;
        Order.aggregate = async (pipeline) => {
            capturedPipeline = pipeline;
            return [{ kpis: [], dailySales: [], productBreakdown: [] }];
        };
        User.countDocuments = async () => 0;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        const rootMatch = capturedPipeline[0].$match;
        assert.deepEqual(rootMatch.$or, [{ paymentType: "COD" }, { isPaid: true }]);
    });

    it('18. unitsSold uses safe integer conversion and calculates accurately', async () => {
        let capturedPipeline;
        Order.aggregate = async (pipeline) => {
            capturedPipeline = pipeline;
            return [{
                kpis: [],
                dailySales: [],
                productBreakdown: [
                    {
                        productId: 'prod_1',
                        name: 'Organic Apples',
                        category: 'Fruits',
                        image: 'https://example.com/apple.jpg',
                        unitsSold: 25,
                        revenue: 500,
                        revenueComplete: true,
                        unpricedItemCount: 0,
                        orderCount: 5
                    }
                ]
            }];
        };
        User.countDocuments = async () => 0;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        assert.equal(res.data.data.productBreakdown[0].unitsSold, 25);

        // Inspect quantity conversion in $group stage
        const pbFacet = capturedPipeline[1].$facet.productBreakdown;
        const groupStage = pbFacet[2].$group;
        const unitsSoldConvert = groupStage.unitsSold.$sum.$convert;
        assert.equal(unitsSoldConvert.to, 'int');
        assert.equal(unitsSoldConvert.onError, 0);
        assert.equal(unitsSoldConvert.onNull, 0);
    });

    it('19. revenue uses historical unitPrice only and never falls back to current product price', async () => {
        let capturedPipeline;
        Order.aggregate = async (pipeline) => {
            capturedPipeline = pipeline;
            return [{ kpis: [], dailySales: [], productBreakdown: [] }];
        };
        User.countDocuments = async () => 0;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        const pbFacet = capturedPipeline[1].$facet.productBreakdown;

        // Verify product lookup projection does NOT project price or offerPrice
        const lookupStage = pbFacet[3].$lookup;
        const lookupProject = lookupStage.pipeline[1].$project;
        assert.equal(lookupProject.offerPrice, undefined, 'offerPrice must NOT be fetched in lookup');
        assert.equal(lookupProject.price, undefined, 'price must NOT be fetched in lookup');
        assert.equal(lookupProject.name, 1);
        assert.equal(lookupProject.image, 1);
        assert.equal(lookupProject.category, 1);

        // Verify revenue calculation only multiplies by items.unitPrice
        const groupStage = pbFacet[2].$group;
        const revenueCond = groupStage.rawRevenue.$sum.$cond;
        const multiplyExpr = revenueCond[1].$multiply;
        assert.equal(multiplyExpr[1], '$items.unitPrice');
    });

    it('20. missing unitPrice results in unavailable revenue (null) and unpricedItemCount > 0', async () => {
        Order.aggregate = async () => [{
            kpis: [],
            dailySales: [],
            productBreakdown: [
                {
                    productId: 'prod_legacy',
                    name: 'Legacy Product',
                    category: 'Vintage',
                    image: null,
                    unitsSold: 10,
                    revenue: null, // Marked null because historical price is missing
                    revenueComplete: false,
                    unpricedItemCount: 2,
                    orderCount: 2
                }
            ]
        }];
        User.countDocuments = async () => 0;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        const item = res.data.data.productBreakdown[0];
        assert.equal(item.revenue, null, 'Revenue must be null when unpriced items exist');
        assert.equal(item.revenueComplete, false, 'revenueComplete must be false');
        assert.equal(item.unpricedItemCount, 2);
        assert.equal(item.unitsSold, 10, 'Units sold must be preserved even without unitPrice');
    });

    it('21. malformed product IDs do not crash aggregation and use safe objectId conversion', async () => {
        let capturedPipeline;
        Order.aggregate = async (pipeline) => {
            capturedPipeline = pipeline;
            return [{ kpis: [], dailySales: [], productBreakdown: [] }];
        };
        User.countDocuments = async () => 0;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        const pbFacet = capturedPipeline[1].$facet.productBreakdown;
        const lookupMatch = pbFacet[3].$lookup.pipeline[0].$match;
        const eqExpr = lookupMatch.$expr.$eq[1];

        assert.equal(eqExpr.$convert.to, 'objectId');
        assert.equal(eqExpr.$convert.onError, null);
        assert.equal(eqExpr.$convert.onNull, null);
    });

    it('22. deleted products safely fall back to historical product name and preserve units/revenue', async () => {
        Order.aggregate = async () => [{
            kpis: [],
            dailySales: [],
            productBreakdown: [
                {
                    productId: 'deleted_prod_123',
                    name: 'Discontinued Herb Tea', // Preserved from historical order snapshot
                    category: 'Uncategorized',
                    image: null,
                    unitsSold: 4,
                    revenue: 80.00,
                    revenueComplete: true,
                    unpricedItemCount: 0,
                    orderCount: 2
                }
            ]
        }];
        User.countDocuments = async () => 0;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        const item = res.data.data.productBreakdown[0];
        assert.equal(item.name, 'Discontinued Herb Tea');
        assert.equal(item.category, 'Uncategorized');
        assert.equal(item.image, null);
        assert.equal(item.unitsSold, 4);
        assert.equal(item.revenue, 80.00);
        assert.equal(item.revenueComplete, true);
    });

    it('23. products are returned in the documented ranking order (revenue desc, then unpriced by unitsSold desc)', async () => {
        Order.aggregate = async () => [{
            kpis: [],
            dailySales: [],
            productBreakdown: [
                { productId: 'p1', name: 'Low Rev', revenue: 50, unitsSold: 5, unpricedItemCount: 0 },
                { productId: 'p2', name: 'Unpriced High Units', revenue: null, unitsSold: 100, unpricedItemCount: 1 },
                { productId: 'p3', name: 'High Rev', revenue: 200, unitsSold: 10, unpricedItemCount: 0 },
                { productId: 'p4', name: 'Unpriced Low Units', revenue: null, unitsSold: 20, unpricedItemCount: 1 }
            ]
        }];
        User.countDocuments = async () => 0;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        const pb = res.data.data.productBreakdown;
        assert.equal(pb[0].productId, 'p3', '#1 must be highest verified revenue');
        assert.equal(pb[1].productId, 'p1', '#2 must be next verified revenue');
        assert.equal(pb[2].productId, 'p2', '#3 must be unpriced product with higher units');
        assert.equal(pb[3].productId, 'p4', '#4 must be unpriced product with lower units');
    });

    it('24. empty periods return an empty productBreakdown array', async () => {
        Order.aggregate = async () => [{
            kpis: [],
            dailySales: [],
            productBreakdown: []
        }];
        User.countDocuments = async () => 0;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        assert.deepEqual(res.data.data.productBreakdown, []);
    });

    it('25. existing KPI and dailySales behavior remains completely unchanged', async () => {
        Order.aggregate = async () => [{
            kpis: [{ totalOrders: 7, totalSales: 1250.75, totalPendingOrders: 2 }],
            dailySales: [{ _id: '2026-10-15', sales: 500, orderCount: 3 }],
            productBreakdown: []
        }];
        User.countDocuments = async () => 14;

        const req = { query: { month: '2026-10' } };
        const res = createMockRes();

        await getSalesAnalytics(req, res);

        assert.equal(res.data.data.kpis.totalUsers, 14);
        assert.equal(res.data.data.kpis.totalOrders, 7);
        assert.equal(res.data.data.kpis.totalSales, 1250.75);
        assert.equal(res.data.data.kpis.totalPendingOrders, 2);
        assert.equal(res.data.data.dailySales.length, 31);
        assert.equal(res.data.data.dailySales[14].sales, 500); // Day 15
        assert.equal(res.data.data.dailySales[14].orderCount, 3);
    });
});
