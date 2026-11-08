import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import Order from '../models/Order.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import OtpVerification from '../models/OtpVerification.js';
import Contact from '../models/Contact.js';
import {
    getSalesAnalytics,
    parseDateRange,
    generateDailySeries,
    generateWeeklySeries,
    generateMonthlySeries,
    generateYearlySeries,
    generateGrowthSeries
} from '../controllers/sellerController.js';

describe('GreenCart Phase 1: Advanced Analytics Dashboard Suite', () => {
    const mockAdminEmail = 'admin@greencart.com';
    const mockJwtSecret = 'test_jwt_secret_advanced_analytics_32_chars!';
    let origEnv;
    let origOrderAggregate;
    let origUserCountDocuments;
    let origProductFind;
    let origOtpCountDocuments;
    let origContactCountDocuments;

    beforeEach(() => {
        origEnv = { ...process.env };
        process.env.SELLER_EMAIL = mockAdminEmail;
        process.env.JWT_SECRET = mockJwtSecret;
        process.env.NODE_ENV = 'test';

        origOrderAggregate = Order.aggregate;
        origUserCountDocuments = User.countDocuments;
        origProductFind = Product.find;
        origOtpCountDocuments = OtpVerification.countDocuments;
        origContactCountDocuments = Contact.countDocuments;
    });

    afterEach(() => {
        process.env = origEnv;
        Order.aggregate = origOrderAggregate;
        User.countDocuments = origUserCountDocuments;
        Product.find = origProductFind;
        OtpVerification.countDocuments = origOtpCountDocuments;
        Contact.countDocuments = origContactCountDocuments;
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

    // -------------------------------------------------------------------------
    // 1. Sales Overview & KPI Calculation (Revenue, Orders, AOV, Sales Growth)
    // -------------------------------------------------------------------------
    describe('1. Sales Overview & KPI Calculation', () => {
        it('1.1 calculates Total Revenue, Total Orders, and AOV accurately', async () => {
            Order.aggregate = async () => [{
                kpis: [{ totalOrders: 10, totalSales: 2500, totalPendingOrders: 3 }],
                dailySales: [
                    { _id: '2026-10-01', sales: 1000, orderCount: 4 },
                    { _id: '2026-10-02', sales: 1500, orderCount: 6 }
                ],
                productBreakdown: [],
                orderStatuses: [
                    { _id: 'Order Placed', count: 3, amount: 600 },
                    { _id: 'Delivered', count: 7, amount: 1900 }
                ]
            }];
            User.countDocuments = async () => 50;

            const req = {
                query: { month: '2026-10' },
                sellerEmail: mockAdminEmail,
                sellerRole: 'Admin'
            };
            const res = createMockRes();

            await getSalesAnalytics(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.data.success, true);
            const { kpis } = res.data.data;
            assert.equal(kpis.totalOrders, 10);
            assert.equal(kpis.totalSales, 2500);
            assert.equal(kpis.totalRevenue, 2500);
            assert.equal(kpis.averageOrderValue, 250); // 2500 / 10 = 250
            assert.equal(kpis.totalPendingOrders, 3);
            assert.equal(kpis.totalUsers, 50);

            // Verified Decision 1 & 7: Net profit must NOT be displayed
            assert.equal(kpis.netProfit, undefined);
            assert.equal(kpis.profit, undefined);
        });

        it('1.2 handles zero orders gracefully with 0 AOV and 0 growth', async () => {
            Order.aggregate = async () => [{
                kpis: [{ totalOrders: 0, totalSales: 0, totalPendingOrders: 0 }],
                dailySales: [],
                productBreakdown: [],
                orderStatuses: []
            }];
            User.countDocuments = async () => 10;

            const req = { query: { month: '2026-10' } };
            const res = createMockRes();

            await getSalesAnalytics(req, res);

            assert.equal(res.statusCode, 200);
            const { kpis } = res.data.data;
            assert.equal(kpis.totalOrders, 0);
            assert.equal(kpis.totalSales, 0);
            assert.equal(kpis.averageOrderValue, 0);
            assert.equal(kpis.salesGrowth.rate, 0);
        });
    });

    // -------------------------------------------------------------------------
    // 2. Sales Analytics (Daily, Weekly, Monthly, Yearly & Growth Series)
    // -------------------------------------------------------------------------
    describe('2. Sales Analytics Time-Series Generation', () => {
        it('2.1 generates unbroken weekly series grouped into 7-day windows', () => {
            const daily = [
                { date: '2026-10-01', sales: 100, orderCount: 2 },
                { date: '2026-10-02', sales: 200, orderCount: 3 },
                { date: '2026-10-08', sales: 300, orderCount: 4 }
            ];
            const weekly = generateWeeklySeries(daily);

            assert.equal(Array.isArray(weekly), true);
            assert.equal(weekly.length, 1);
            assert.equal(weekly[0].week, 'Week 1');
            assert.equal(weekly[0].sales, 600);
            assert.equal(weekly[0].orderCount, 9);
        });

        it('2.2 generates monthly series grouped by YYYY-MM', () => {
            const daily = [
                { date: '2026-10-01', sales: 100, orderCount: 1 },
                { date: '2026-10-15', sales: 150, orderCount: 2 },
                { date: '2026-11-01', sales: 300, orderCount: 3 }
            ];
            const monthly = generateMonthlySeries(daily);

            assert.equal(monthly.length, 2);
            assert.equal(monthly[0].month, '2026-10');
            assert.equal(monthly[0].sales, 250);
            assert.equal(monthly[0].orderCount, 3);
            assert.equal(monthly[1].month, '2026-11');
            assert.equal(monthly[1].sales, 300);
            assert.equal(monthly[1].orderCount, 3);
        });

        it('2.3 generates yearly series grouped by YYYY', () => {
            const daily = [
                { date: '2025-12-31', sales: 500, orderCount: 5 },
                { date: '2026-01-01', sales: 700, orderCount: 7 }
            ];
            const yearly = generateYearlySeries(daily);

            assert.equal(yearly.length, 2);
            assert.equal(yearly[0].year, '2025');
            assert.equal(yearly[0].sales, 500);
            assert.equal(yearly[1].year, '2026');
            assert.equal(yearly[1].sales, 700);
        });

        it('2.4 generates cumulative sales growth series with daily progression', () => {
            const daily = [
                { date: '2026-10-01', sales: 100, orderCount: 1 },
                { date: '2026-10-02', sales: 150, orderCount: 2 },
                { date: '2026-10-03', sales: 250, orderCount: 3 }
            ];
            const growth = generateGrowthSeries(daily);

            assert.equal(growth.length, 3);
            assert.equal(growth[0].cumulativeSales, 100);
            assert.equal(growth[1].cumulativeSales, 250);
            assert.equal(growth[2].cumulativeSales, 500);
            assert.equal(growth[1].growthRate, 50); // (150 - 100)/100 = +50%
        });
    });

    // -------------------------------------------------------------------------
    // 3. Product Analytics (Best-Selling, Top Revenue, Most Ordered, Low Stock)
    // -------------------------------------------------------------------------
    describe('3. Product Analytics', () => {
        it('3.1 ranks products by units sold, revenue, and order frequency', async () => {
            Order.aggregate = async () => [{
                kpis: [{ totalOrders: 5, totalSales: 2100, totalPendingOrders: 1 }],
                dailySales: [],
                productBreakdown: [
                    { productId: 'p1', name: 'Product A', category: 'Fruits', image: null, unitsSold: 50, revenue: 500, unpricedItemCount: 0, orderCount: 5 },
                    { productId: 'p2', name: 'Product B', category: 'Vegetables', image: null, unitsSold: 10, revenue: 1600, unpricedItemCount: 0, orderCount: 2 }
                ],
                orderStatuses: []
            }];
            User.countDocuments = async () => 20;

            const req = { query: { month: '2026-10' } };
            const res = createMockRes();

            await getSalesAnalytics(req, res);

            assert.equal(res.statusCode, 200);
            const { products } = res.data.data;

            // Best-selling by units: Product A (50 units) before Product B (10 units)
            assert.equal(products.bestSelling[0].productId, 'p1');
            assert.equal(products.bestSelling[0].unitsSold, 50);

            // Top revenue: Product B ($1600) before Product A ($500)
            assert.equal(products.topRevenue[0].productId, 'p2');
            assert.equal(products.topRevenue[0].revenue, 1600);

            // Most ordered: Product A (5 orders) before Product B (2 orders)
            assert.equal(products.mostOrdered[0].productId, 'p1');
            assert.equal(products.mostOrdered[0].orderCount, 5);
        });
    });

    // -------------------------------------------------------------------------
    // 4. Order Analytics (Pending, Processing, Completed, Cancelled)
    // -------------------------------------------------------------------------
    describe('4. Order Analytics & Status Distribution', () => {
        it('4.1 aggregates order status counts and fulfillment pipeline accurately', async () => {
            Order.aggregate = async () => [{
                kpis: [{ totalOrders: 10, totalSales: 3000, totalPendingOrders: 4 }],
                dailySales: [],
                productBreakdown: [],
                orderStatuses: [
                    { _id: 'Order Placed', count: 1, amount: 200 },
                    { _id: 'Packing', count: 1, amount: 300 },
                    { _id: 'Shipped', count: 1, amount: 400 },
                    { _id: 'Out for Delivery', count: 1, amount: 500 },
                    { _id: 'Delivered', count: 5, amount: 1500 },
                    { _id: 'Cancelled', count: 1, amount: 100 }
                ]
            }];
            User.countDocuments = async () => 15;

            const req = { query: { month: '2026-10' } };
            const res = createMockRes();

            await getSalesAnalytics(req, res);

            assert.equal(res.statusCode, 200);
            const { orders } = res.data.data;
            assert.equal(orders.totalOrders, 10);
            assert.equal(orders.pendingOrders, 4); // Order Placed (1) + Packing (1) + Shipped (1) + Out for Delivery (1)
            assert.equal(orders.processingOrders, 3); // Packing (1) + Shipped (1) + Out for Delivery (1)
            assert.equal(orders.completedOrders, 5); // Delivered
            assert.equal(orders.cancelledOrders, 1); // Cancelled
            assert.equal(orders.statusBreakdown.length, 6);
        });
    });

    // -------------------------------------------------------------------------
    // 5. Conversion Analytics (Decision 2, 3, 5: No Fake Data, Honest Unavailable State)
    // -------------------------------------------------------------------------
    describe('5. Conversion Analytics & Tracking Data Integrity', () => {
        it('5.1 returns available: false and not_configured status for Web Visitors', async () => {
            Order.aggregate = async () => [{
                kpis: [{ totalOrders: 4, totalSales: 800, totalPendingOrders: 1 }],
                dailySales: [],
                productBreakdown: [],
                orderStatuses: []
            }];
            User.countDocuments = async () => 25;

            const req = { query: { month: '2026-10' } };
            const res = createMockRes();

            await getSalesAnalytics(req, res);

            assert.equal(res.statusCode, 200);
            const { conversion } = res.data.data;

            // Verified Decision 2, 3, 5: Must NOT fabricate visitor statistics
            assert.equal(conversion.visitors.available, false);
            assert.equal(conversion.visitors.count, null);
            assert.equal(conversion.visitors.status, 'not_configured');
            assert.match(conversion.visitors.message, /not enabled/i);

            // Active carts and orders are populated from authentic data
            assert.equal(conversion.cart.available, true);
            assert.equal(conversion.orders.available, true);
            assert.equal(conversion.orders.completedOrders, 4);
        });
    });

    // -------------------------------------------------------------------------
    // 6. Admin and Seller Data Isolation
    // -------------------------------------------------------------------------
    describe('6. Admin and Seller Data Isolation', () => {
        it('6.1 applies store-wide un-scoped query for Admin role', async () => {
            let capturedPipeline = null;
            Order.aggregate = async (pipeline) => {
                capturedPipeline = pipeline;
                return [{
                    kpis: [{ totalOrders: 5, totalSales: 1000, totalPendingOrders: 1 }],
                    dailySales: []
                }];
            };
            User.countDocuments = async () => 10;

            const req = {
                query: { month: '2026-10' },
                sellerEmail: mockAdminEmail,
                sellerRole: 'Admin',
                isTeamMember: false
            };
            const res = createMockRes();

            await getSalesAnalytics(req, res);

            assert.equal(res.statusCode, 200);
            const matchStage = capturedPipeline[0].$match;
            // Admin query uses root qualifying filter (all store orders)
            assert.deepEqual(matchStage.$or, [{ paymentType: "COD" }, { isPaid: true }]);
            assert.equal(res.data.data.isolation.isStoreAdmin, true);
        });

        it('6.2 applies strict tenant isolation when caller is a tenant seller', async () => {
            let capturedPipeline = null;
            Order.aggregate = async (pipeline) => {
                capturedPipeline = pipeline;
                return [{
                    kpis: [{ totalOrders: 2, totalSales: 400, totalPendingOrders: 0 }],
                    dailySales: []
                }];
            };
            User.countDocuments = async () => 5;

            const req = {
                query: { month: '2026-10' },
                sellerId: 'tenant_seller_99',
                sellerEmail: 'tenant@example.com',
                sellerRole: null,
                isTeamMember: false
            };
            const res = createMockRes();

            await getSalesAnalytics(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(res.data.data.isolation.isStoreAdmin, false);
            assert.equal(res.data.data.isolation.sellerId, 'tenant_seller_99');

            // Verified: Pipeline includes $and scoping condition for tenant seller
            const matchStage = capturedPipeline[0].$match;
            assert.equal(Array.isArray(matchStage.$and), true);
        });

        it('6.3 never trusts client-supplied sellerId in query parameters for privilege spoofing', async () => {
            let capturedPipeline = null;
            Order.aggregate = async (pipeline) => {
                capturedPipeline = pipeline;
                return [{
                    kpis: [{ totalOrders: 1, totalSales: 100, totalPendingOrders: 0 }],
                    dailySales: []
                }];
            };

            // Attacker supplies sellerId='victim_store' in query params, but authenticated token is tenant_attacker
            const req = {
                query: { month: '2026-10', sellerId: 'victim_store_to_spoof' },
                sellerId: 'tenant_attacker_101',
                sellerEmail: 'attacker@example.com',
                sellerRole: null,
                isTeamMember: false
            };
            const res = createMockRes();

            await getSalesAnalytics(req, res);

            assert.equal(res.statusCode, 200);
            // Must strictly use authenticated sellerId, never forged query param
            assert.equal(res.data.data.isolation.sellerId, 'tenant_attacker_101');
        });
    });

    // -------------------------------------------------------------------------
    // 7. Financial Accuracy: Verified Orders, Exclusion of Cancelled Orders
    // -------------------------------------------------------------------------
    describe('7. Financial Accuracy', () => {
        it('7.1 completely excludes Cancelled orders from sales amount in facet pipeline', async () => {
            let capturedPipeline = null;
            Order.aggregate = async (pipeline) => {
                capturedPipeline = pipeline;
                return [{
                    kpis: [{ totalOrders: 3, totalSales: 500, totalPendingOrders: 0 }],
                    dailySales: []
                }];
            };

            const req = { query: { month: '2026-10' } };
            const res = createMockRes();

            await getSalesAnalytics(req, res);

            assert.equal(res.statusCode, 200);
            const kpiFacet = capturedPipeline[1].$facet.kpis[0].$group;

            // Total sales condition: must check status !== 'Cancelled'
            assert.deepEqual(kpiFacet.totalSales.$sum.$cond[0], { $ne: ["$status", "Cancelled"] });
        });
    });

    // -------------------------------------------------------------------------
    // 8. Dashboard Analytics Cards & Timezone Boundaries Suite
    // -------------------------------------------------------------------------
    describe('8. Dashboard Analytics Cards & Timezone Boundaries Suite', () => {
        it('8.1 calculates Today Orders and yesterday comparison accurately in Asia/Dhaka', async () => {
            const dhakaToday = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Dhaka',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(new Date());

            const dhakaTodayDate = new Date(`${dhakaToday}T00:00:00.000+06:00`);
            const dhakaYesterday = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Dhaka',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(new Date(dhakaTodayDate.getTime() - 24 * 60 * 60 * 1000));

            Order.aggregate = async () => [{
                kpis: [{ totalOrders: 15, totalSales: 4500, totalPendingOrders: 2 }],
                dailySales: [
                    { _id: dhakaYesterday, sales: 1200, orderCount: 4 },
                    { _id: dhakaToday, sales: 2100, orderCount: 7 }
                ],
                productBreakdown: [],
                orderStatuses: [
                    { _id: 'Order Placed', count: 2, amount: 600 }
                ]
            }];

            const req = {
                query: { startDate: dhakaYesterday, endDate: dhakaToday },
                sellerEmail: mockAdminEmail,
                sellerRole: 'Admin'
            };
            const res = createMockRes();

            await getSalesAnalytics(req, res);

            assert.equal(res.statusCode, 200);
            const { kpis } = res.data.data;
            assert.ok(kpis.todayOrders, 'todayOrders object must exist');
            assert.equal(kpis.todayOrders.count, 7, 'Today order count in Dhaka');
            assert.equal(kpis.todayOrders.yesterdayCount, 4, 'Yesterday order count in Dhaka');
            assert.equal(kpis.todayOrders.diffCount, 3, 'Diff count = 7 - 4 = +3');
            assert.equal(kpis.todayOrders.isPositive, true);
            assert.equal(kpis.todayOrders.growthRate, 75); // (7-4)/4 * 100 = 75%
            assert.equal(kpis.todayOrders.timezone, 'Asia/Dhaka');
        });

        it('8.2 derives Total Customers and newCustomersToday from Customer Directory', async () => {
            Order.aggregate = async () => [{
                kpis: [{ totalOrders: 5, totalSales: 1500, totalPendingOrders: 1 }],
                dailySales: [],
                productBreakdown: [],
                orderStatuses: []
            }];

            // Mock Contact model
            Contact.countDocuments = async (filter) => {
                if (filter.createdAt) {
                    return 3; // 3 added today
                }
                return 42; // 42 total unique contacts
            };

            const req = {
                query: { month: '2026-10' },
                sellerEmail: mockAdminEmail,
                sellerRole: 'Admin'
            };
            const res = createMockRes();

            await getSalesAnalytics(req, res);

            assert.equal(res.statusCode, 200);
            const { kpis } = res.data.data;
            assert.equal(kpis.totalCustomers, 42, 'Must query Customer Directory for totalCustomers');
            assert.equal(kpis.newCustomersToday, 3, 'Must report new customers added today');
            assert.equal(kpis.customerGrowth.newToday, 3);
            assert.equal(kpis.customerGrowth.rate, 7.14); // 3 / 42 * 100 = 7.14%
        });

        it('8.3 isolates Customer Directory queries to tenant seller identity', async () => {
            Order.aggregate = async () => [{
                kpis: [{ totalOrders: 2, totalSales: 600, totalPendingOrders: 0 }],
                dailySales: [],
                productBreakdown: [],
                orderStatuses: []
            }];

            let capturedSellerId = null;
            Contact.countDocuments = async (filter) => {
                capturedSellerId = filter.sellerId;
                return 8;
            };

            const req = {
                query: { month: '2026-10', sellerId: 'spoofed_admin' },
                sellerId: 'tenant_seller_gamma',
                sellerEmail: 'gamma@store.com',
                sellerRole: null,
                isTeamMember: false
            };
            const res = createMockRes();

            await getSalesAnalytics(req, res);

            assert.equal(res.statusCode, 200);
            assert.equal(capturedSellerId, 'tenant_seller_gamma', 'Must query strictly by authenticated tenant sellerId');
            assert.equal(res.data.data.kpis.totalCustomers, 8);
        });

        it('8.4 handles empty data and zero values safely without NaN', async () => {
            Order.aggregate = async () => [{
                kpis: [{ totalOrders: 0, totalSales: 0, totalPendingOrders: 0 }],
                dailySales: [],
                productBreakdown: [],
                orderStatuses: []
            }];

            Contact.countDocuments = async () => 0;
            User.countDocuments = async () => 0;

            const req = { query: { month: '2026-10' } };
            const res = createMockRes();

            await getSalesAnalytics(req, res);

            assert.equal(res.statusCode, 200);
            const { kpis } = res.data.data;
            assert.equal(kpis.totalSales, 0);
            assert.equal(kpis.totalRevenue, 0);
            assert.equal(kpis.totalOrders, 0);
            assert.equal(kpis.totalCustomers, 0);
            assert.equal(kpis.newCustomersToday, 0);
            assert.equal(kpis.todayOrders.count, 0);
            assert.equal(kpis.todayOrders.yesterdayCount, 0);
            assert.equal(kpis.todayOrders.growthRate, 0);
            assert.equal(kpis.totalPendingOrders, 0);
            assert.ok(Array.isArray(kpis.sparklines.sales));
            assert.ok(Array.isArray(kpis.sparklines.orders));
        });
    });
});
