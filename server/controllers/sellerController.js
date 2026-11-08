import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import User from '../models/User.js';
import TeamMember from '../models/TeamMember.js';
import MerchantSession from '../models/MerchantSession.js';
import Product from '../models/Product.js';
import OtpVerification from '../models/OtpVerification.js';
import Contact from '../models/Contact.js';
import { getSellerOrderQuery, getEffectiveSellerId, isModelRunnable } from './contactController.js';
import { notifySystemEvent } from '../services/notificationService.js';

// Login Seller : /api/seller/login
export const sellerLogin = async (req, res) => {
    try {
        const { email, password } = req.body || {};

        const sellerEmail = process.env.SELLER_EMAIL;
        const sellerPassword = process.env.SELLER_PASSWORD;
        const jwtSecret = process.env.JWT_SECRET;

        // 1. Fail-closed: Never authenticate if server environment configuration is missing, empty, or whitespace
        if (!sellerEmail?.trim() || !sellerPassword?.trim() || !jwtSecret?.trim()) {
            return res.status(500).json({ success: false, message: "Server authentication configuration missing" });
        }

        // 2. Validate request payload: Ensure submitted credentials are non-empty strings
        if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

        const trimmedEmail = email.trim();

        // 3. Credential verification: Root Environment Merchant Owner
        if (password === sellerPassword && trimmedEmail === sellerEmail) {
            // Fail closed if database is unavailable outside offline test mode
            const isOfflineTest = (process.env.NODE_ENV === 'test' || process.execArgv.some(arg => arg.startsWith('--test'))) &&
                process.env.NODE_ENV !== 'production';
            if (mongoose.connection?.readyState !== 1 && !isOfflineTest) {
                return res.status(503).json({ success: false, message: "Database service unavailable" });
            }

            let sessionVersion = 0;
            if (mongoose.connection?.readyState === 1) {
                sessionVersion = await MerchantSession.getAuthoritativeVersion();
            }

            const token = jwt.sign(
                {
                    email: sellerEmail,
                    role: 'Admin',
                    designation: 'Store Owner',
                    name: 'Merchant Admin',
                    sessionVersion
                },
                jwtSecret,
                { expiresIn: '7d' }
            );

            res.cookie("sellerToken", token, {
                httpOnly: true, // Prevents JavaScript access to the cookie
                secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Adjust sameSite policy based on environment
                maxAge: 7 * 24 * 60 * 60 * 1000 // Cookie expiration time (7 days)
            });

            return res.json({
                success: true,
                message: "Login Successful",
                user: {
                    id: sellerEmail,
                    email: sellerEmail,
                    name: 'Merchant Admin',
                    role: 'Admin',
                    designation: 'Store Owner',
                    status: 'Active',
                    image: ''
                }
            });
        }

        // 4. Credential verification: Registered Team Member
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            const member = await TeamMember.findOne({ email: trimmedEmail.toLowerCase() });
            if (member) {
                if (member.status === 'Inactive') {
                    return res.status(403).json({
                        success: false,
                        message: "Your account has been deactivated. Please contact an administrator."
                    });
                }

                const isPasswordValid = await bcrypt.compare(password, member.password);
                if (isPasswordValid) {
                    const token = jwt.sign(
                        {
                            id: String(member._id),
                            email: member.email,
                            role: member.role,
                            tokenVersion: member.tokenVersion || 0,
                            isTeamMember: true
                        },
                        jwtSecret,
                        { expiresIn: '7d' }
                    );

                    res.cookie("sellerToken", token, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                        maxAge: 7 * 24 * 60 * 60 * 1000
                    });

                    return res.json({
                        success: true,
                        message: "Login Successful",
                        user: {
                            id: String(member._id),
                            email: member.email,
                            name: member.name,
                            role: member.role,
                            designation: member.designation,
                            status: member.status,
                            image: member.image || ''
                        }
                    });
                }
            }
        }

        return res.status(401).json({ success: false, message: "Invalid Email or Password" });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Seller isAuth : /api/seller/is-auth
export const isSellerAuth = async (req, res) => {
    try {
        if (!req.seller) {
            return res.status(200).json({ success: false, user: null });
        }
        return res.status(200).json({ success: true, user: req.seller });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Logout Seller: /api/seller/logout
export const SellerLogout = async (req, res) => {
    try {
        const { sellerToken } = req.cookies || {};
        const jwtSecret = process.env.JWT_SECRET;
        const sellerEmail = process.env.SELLER_EMAIL;

        if (sellerToken && jwtSecret) {
            try {
                const tokenDecode = jwt.verify(sellerToken, jwtSecret);
                const isRoot = tokenDecode?.email && sellerEmail &&
                    tokenDecode.email.toLowerCase() === sellerEmail.toLowerCase();
                const memberId = tokenDecode?.id || tokenDecode?._id;

                if (isRoot && mongoose.connection?.readyState === 1) {
                    await MerchantSession.revokeAllSessions();
                } else if (!isRoot && memberId && mongoose.connection?.readyState === 1) {
                    await TeamMember.findByIdAndUpdate(memberId, { $inc: { tokenVersion: 1 } });
                }
            } catch (tokenErr) {
                // Invalid or expired token; proceed with clearing cookie
            }
        }

        res.clearCookie('sellerToken', {
            httpOnly: true, // Prevents JavaScript access to the cookie
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Adjust sameSite policy based on environment
        });
        return res.json({ success: true, message: "Seller logged out successfully" });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Revoke all root merchant sessions (Admin Only)
 * Increases sessionVersion persistently, invalidating all issued root merchant tokens.
 */
export const revokeRootMerchantSessions = async (req, res) => {
    try {
        const rootSellerEmail = process.env.SELLER_EMAIL;
        const callerEmail = req.sellerEmail || req.seller?.email;

        // Strictly verify that the caller is the authoritative Root Merchant account
        if (req.isTeamMember || !rootSellerEmail || !callerEmail || callerEmail.toLowerCase() !== rootSellerEmail.toLowerCase()) {
            return res.status(403).json({
                success: false,
                message: "Access forbidden: Only the Root Merchant can revoke root merchant sessions"
            });
        }

        const isOfflineTest = (process.env.NODE_ENV === 'test' || process.execArgv.some(arg => arg.startsWith('--test'))) &&
            process.env.NODE_ENV !== 'production';

        if (mongoose.connection?.readyState !== 1 && !isOfflineTest) {
            return res.status(503).json({ success: false, message: "Database service unavailable" });
        }

        if (mongoose.connection?.readyState === 1) {
            await MerchantSession.revokeAllSessions();

            // Emit important system notification
            try {
                await notifySystemEvent({
                    title: "Security Notice: Root Merchant Sessions Revoked",
                    message: "All active root merchant sessions were terminated by administrator authorization.",
                    data: { link: "/seller/team" },
                    dedupeKey: `system:root_revocation:${Date.now()}`
                });
            } catch (_) {}
        }

        return res.json({
            success: true,
            message: "All root merchant sessions revoked successfully"
        });
    } catch (error) {
        console.error("Revoke root sessions error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Validates query parameters and derives start/end UTC boundaries in store timezone (Asia/Dhaka).
 * Supported parameters:
 * - month=YYYY-MM
 * - startDate=YYYY-MM-DD & endDate=YYYY-MM-DD
 * - Default: Current calendar month in Asia/Dhaka
 *
 * @param {object} query Express request query object
 * @returns {{ startDate?: string, endDate?: string, startUtc?: Date, endExclusiveUtc?: Date, timezone?: string, error?: string }}
 */
export function parseDateRange(query = {}) {
    const { month, startDate, endDate } = query;

    // Reject conflicting parameters
    if (month && (startDate || endDate)) {
        return { error: "Cannot specify both month and date range parameters" };
    }

    // Incomplete date range
    if ((startDate && !endDate) || (!startDate && endDate)) {
        return { error: "Both startDate and endDate are required for date range filtering" };
    }

    let sDate, eDate;

    if (month) {
        if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month.trim())) {
            return { error: "Invalid month format. Expected YYYY-MM" };
        }
        const trimmedMonth = month.trim();
        const [y, m] = trimmedMonth.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        sDate = `${y}-${String(m).padStart(2, '0')}-01`;
        eDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (startDate && endDate) {
        const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
        if (typeof startDate !== 'string' || typeof endDate !== 'string' ||
            !dateRegex.test(startDate.trim()) || !dateRegex.test(endDate.trim())) {
            return { error: "Invalid date format. Expected YYYY-MM-DD" };
        }
        const sTrimmed = startDate.trim();
        const eTrimmed = endDate.trim();

        // Calendar day validity check
        const [sY, sM, sD] = sTrimmed.split('-').map(Number);
        if (sD > new Date(sY, sM, 0).getDate()) {
            return { error: "Invalid calendar date for startDate" };
        }
        const [eY, eM, eD] = eTrimmed.split('-').map(Number);
        if (eD > new Date(eY, eM, 0).getDate()) {
            return { error: "Invalid calendar date for endDate" };
        }

        // Reversed range check
        if (sTrimmed > eTrimmed) {
            return { error: "startDate cannot be after endDate" };
        }
        sDate = sTrimmed;
        eDate = eTrimmed;
    } else {
        // Default to the current calendar month in Asia/Dhaka
        const nowStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Dhaka',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());
        const [y, m] = nowStr.split('-').slice(0, 2).map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        sDate = `${y}-${String(m).padStart(2, '0')}-01`;
        eDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    }

    // Start boundary in Asia/Dhaka (+06:00)
    const startUtc = new Date(`${sDate}T00:00:00.000+06:00`);

    // Exclusive end boundary: 00:00:00+06:00 of the day after eDate
    const endExclusiveUtc = new Date(`${eDate}T00:00:00.000+06:00`);
    endExclusiveUtc.setUTCDate(endExclusiveUtc.getUTCDate() + 1);

    // Range length verification (maximum 366 days)
    const diffDays = Math.round((endExclusiveUtc - startUtc) / 86400000);
    if (diffDays > 366) {
        return { error: "Date range exceeds maximum limit of 366 days" };
    }

    return {
        startDate: sDate,
        endDate: eDate,
        startUtc,
        endExclusiveUtc,
        timezone: 'Asia/Dhaka'
    };
}

/**
 * Generates an unbroken sorted daily time-series array between startDate and endDate in Asia/Dhaka,
 * populating sales and orderCount as 0 for days without orders.
 *
 * @param {string} startDateStr Start date in format YYYY-MM-DD
 * @param {string} endDateStr End date in format YYYY-MM-DD
 * @param {Array<{ _id: string, sales: number, orderCount: number }>} aggregatedDailyData MongoDB grouped sales records
 * @returns {Array<{ date: string, sales: number, orderCount: number }>}
 */
export function generateDailySeries(startDateStr, endDateStr, aggregatedDailyData = []) {
    const dataMap = new Map();
    if (Array.isArray(aggregatedDailyData)) {
        for (const item of aggregatedDailyData) {
            if (item && item._id) {
                dataMap.set(item._id, {
                    sales: Math.round((item.sales || 0) * 100) / 100,
                    orderCount: item.orderCount || 0
                });
            }
        }
    }

    const series = [];
    const cur = new Date(`${startDateStr}T00:00:00.000+06:00`);
    const end = new Date(`${endDateStr}T00:00:00.000+06:00`);
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    while (cur <= end) {
        const dateStr = formatter.format(cur);
        const existing = dataMap.get(dateStr);
        series.push({
            date: dateStr,
            sales: existing ? existing.sales : 0,
            orderCount: existing ? existing.orderCount : 0
        });
        cur.setUTCDate(cur.getUTCDate() + 1);
    }

    return series;
}

/**
 * Generates weekly aggregation series from daily series.
 */
export function generateWeeklySeries(dailySales = []) {
    if (!Array.isArray(dailySales) || dailySales.length === 0) return [];
    const weeks = [];
    const chunkSize = 7;
    for (let i = 0; i < dailySales.length; i += chunkSize) {
        const chunk = dailySales.slice(i, i + chunkSize);
        const weekNum = Math.floor(i / chunkSize) + 1;
        const startDate = chunk[0].date;
        const endDate = chunk[chunk.length - 1].date;
        const sales = chunk.reduce((sum, d) => sum + (d.sales || 0), 0);
        const orderCount = chunk.reduce((sum, d) => sum + (d.orderCount || 0), 0);
        weeks.push({
            week: `Week ${weekNum}`,
            label: `${startDate.slice(5)} to ${endDate.slice(5)}`,
            startDate,
            endDate,
            sales: Math.round(sales * 100) / 100,
            orderCount
        });
    }
    return weeks;
}

/**
 * Generates monthly aggregation series from daily series.
 */
export function generateMonthlySeries(dailySales = []) {
    if (!Array.isArray(dailySales) || dailySales.length === 0) return [];
    const monthMap = new Map();
    for (const d of dailySales) {
        const monthKey = d.date.slice(0, 7);
        if (!monthMap.has(monthKey)) {
            monthMap.set(monthKey, { month: monthKey, label: monthKey, sales: 0, orderCount: 0 });
        }
        const item = monthMap.get(monthKey);
        item.sales += (d.sales || 0);
        item.orderCount += (d.orderCount || 0);
    }
    return Array.from(monthMap.values()).map(m => ({
        ...m,
        sales: Math.round(m.sales * 100) / 100
    }));
}

/**
 * Generates yearly aggregation series from daily series.
 */
export function generateYearlySeries(dailySales = []) {
    if (!Array.isArray(dailySales) || dailySales.length === 0) return [];
    const yearMap = new Map();
    for (const d of dailySales) {
        const yearKey = d.date.slice(0, 4);
        if (!yearMap.has(yearKey)) {
            yearMap.set(yearKey, { year: yearKey, label: yearKey, sales: 0, orderCount: 0 });
        }
        const item = yearMap.get(yearKey);
        item.sales += (d.sales || 0);
        item.orderCount += (d.orderCount || 0);
    }
    return Array.from(yearMap.values()).map(y => ({
        ...y,
        sales: Math.round(y.sales * 100) / 100
    }));
}

/**
 * Generates daily cumulative growth trend series from daily series.
 */
export function generateGrowthSeries(dailySales = []) {
    if (!Array.isArray(dailySales) || dailySales.length === 0) return [];
    let runningTotal = 0;
    return dailySales.map((d, index) => {
        runningTotal += (d.sales || 0);
        const prevSales = index > 0 ? (dailySales[index - 1].sales || 0) : 0;
        let dayGrowth = 0;
        if (prevSales > 0) {
            dayGrowth = Math.round(((d.sales - prevSales) / prevSales) * 10000) / 100;
        } else if (d.sales > 0) {
            dayGrowth = 100;
        }
        return {
            date: d.date,
            sales: d.sales,
            orderCount: d.orderCount,
            cumulativeSales: Math.round(runningTotal * 100) / 100,
            growthRate: dayGrowth
        };
    });
}

/**
 * Seller Sales Analytics & KPI Aggregation
 * GET /api/seller/analytics
 */
export const getSalesAnalytics = async (req, res) => {
    try {
        const rangeResult = parseDateRange(req.query);
        if (rangeResult.error) {
            return res.status(400).json({ success: false, message: rangeResult.error });
        }

        const { startDate, endDate, startUtc, endExclusiveUtc, timezone } = rangeResult;

        // Determine caller authorization scope
        const rootAdminEmail = process.env.SELLER_EMAIL?.toLowerCase();
        const reqEmail = req?.sellerEmail?.toLowerCase();
        const callerRole = req?.sellerRole || req?.seller?.role;
        const isStore = Boolean(
            !req?.sellerId ||
            req?.isTeamMember ||
            (rootAdminEmail && reqEmail === rootAdminEmail) ||
            callerRole === 'Admin' ||
            callerRole === 'CEO' ||
            callerRole === 'CTO' ||
            callerRole === 'Strategist'
        );

        let sellerOrderQuery = null;
        if (!isStore && req?.sellerId && typeof getSellerOrderQuery === 'function') {
            try {
                sellerOrderQuery = await getSellerOrderQuery(req);
            } catch (_) {
                sellerOrderQuery = null;
            }
        }

        // Shared qualifying-order condition: paymentType === "COD" OR isPaid === true
        let qualifyingMatch;
        if (isStore || !sellerOrderQuery) {
            qualifyingMatch = {
                $or: [{ paymentType: "COD" }, { isPaid: true }],
                createdAt: { $gte: startUtc, $lt: endExclusiveUtc }
            };
        } else {
            qualifyingMatch = {
                $and: [
                    sellerOrderQuery,
                    { createdAt: { $gte: startUtc, $lt: endExclusiveUtc } }
                ]
            };
        }

        const userCountPromise = isModelRunnable(User, 'countDocuments')
            ? User.countDocuments({})
            : Promise.resolve(0);

        const [totalUsers, [analyticsResult]] = await Promise.all([
            userCountPromise,
            Order.aggregate([
                { $match: qualifyingMatch },
                {
                    $facet: {
                        kpis: [
                            {
                                $group: {
                                    _id: null,
                                    totalOrders: { $sum: 1 },
                                    totalSales: {
                                        $sum: {
                                            $cond: [
                                                { $ne: ["$status", "Cancelled"] },
                                                "$amount",
                                                0
                                            ]
                                        }
                                    },
                                    totalPendingOrders: {
                                        $sum: {
                                            $cond: [
                                                {
                                                    $in: [
                                                        "$status",
                                                        ["Order Placed", "Packing", "Shipped", "Out for Delivery"]
                                                    ]
                                                },
                                                1,
                                                0
                                            ]
                                        }
                                    }
                                }
                            }
                        ],
                        dailySales: [
                            {
                                $match: {
                                    status: { $ne: "Cancelled" }
                                }
                            },
                            {
                                $group: {
                                    _id: {
                                        $dateToString: {
                                            format: "%Y-%m-%d",
                                            date: "$createdAt",
                                            timezone: "Asia/Dhaka"
                                        }
                                    },
                                    sales: { $sum: "$amount" },
                                    orderCount: { $sum: 1 }
                                }
                            },
                            { $sort: { _id: 1 } }
                        ],
                        productBreakdown: [
                            {
                                $match: {
                                    status: { $ne: "Cancelled" }
                                }
                            },
                            { $unwind: "$items" },
                            {
                                $group: {
                                    _id: "$items.product",
                                    historicalName: { $first: "$items.name" },
                                    unitsSold: {
                                        $sum: {
                                            $convert: { input: "$items.quantity", to: "int", onError: 0, onNull: 0 }
                                        }
                                    },
                                    rawRevenue: {
                                        $sum: {
                                            $cond: [
                                                {
                                                    $and: [
                                                        { $ne: ["$items.unitPrice", null] },
                                                        { $isNumber: "$items.unitPrice" },
                                                        { $gte: ["$items.unitPrice", 0] }
                                                    ]
                                                },
                                                {
                                                    $multiply: [
                                                        { $convert: { input: "$items.quantity", to: "int", onError: 0, onNull: 0 } },
                                                        "$items.unitPrice"
                                                    ]
                                                },
                                                0
                                            ]
                                        }
                                    },
                                    unpricedItemCount: {
                                        $sum: {
                                            $cond: [
                                                {
                                                    $and: [
                                                        { $ne: ["$items.unitPrice", null] },
                                                        { $isNumber: "$items.unitPrice" },
                                                        { $gte: ["$items.unitPrice", 0] }
                                                    ]
                                                },
                                                0,
                                                1
                                            ]
                                        }
                                    },
                                    orderCount: { $sum: 1 }
                                }
                            },
                            {
                                $lookup: {
                                    from: "products",
                                    let: { prodId: "$_id" },
                                    pipeline: [
                                        {
                                            $match: {
                                                $expr: {
                                                    $eq: [
                                                        "$_id",
                                                        { $convert: { input: "$$prodId", to: "objectId", onError: null, onNull: null } }
                                                    ]
                                                }
                                            }
                                        },
                                        { $project: { name: 1, image: 1, category: 1 } }
                                    ],
                                    as: "productDoc"
                                }
                            },
                            {
                                $addFields: {
                                    productDetails: { $arrayElemAt: ["$productDoc", 0] }
                                }
                            },
                            {
                                $project: {
                                    productId: { $ifNull: ["$_id", "unknown"] },
                                    name: { $ifNull: ["$productDetails.name", "$historicalName", "Unknown Product"] },
                                    category: { $ifNull: ["$productDetails.category", "Uncategorized"] },
                                    image: {
                                        $cond: [
                                            { $gt: [{ $size: { $ifNull: ["$productDetails.image", []] } }, 0] },
                                            { $arrayElemAt: ["$productDetails.image", 0] },
                                            null
                                        ]
                                    },
                                    unitsSold: 1,
                                    orderCount: 1,
                                    unpricedItemCount: 1,
                                    revenueComplete: { $eq: ["$unpricedItemCount", 0] },
                                    revenue: {
                                        $cond: [
                                            { $eq: ["$unpricedItemCount", 0] },
                                            { $round: ["$rawRevenue", 2] },
                                            null
                                        ]
                                    }
                                }
                            },
                            { $sort: { revenue: -1, unitsSold: -1 } },
                            { $limit: 10 }
                        ],
                        orderStatuses: [
                            {
                                $group: {
                                    _id: "$status",
                                    count: { $sum: 1 },
                                    amount: { $sum: "$amount" }
                                }
                            }
                        ]
                    }
                }
            ])
        ]);

        const kpiDoc = analyticsResult?.kpis?.[0] || {};
        const rawDailySales = analyticsResult?.dailySales || [];
        const rawProductBreakdown = analyticsResult?.productBreakdown || [];
        const rawOrderStatuses = analyticsResult?.orderStatuses || [];

        // Prior period calculation for sales growth (only execute when DB is live)
        let priorSales = 0;
        let priorOrders = 0;
        if (mongoose.connection && mongoose.connection.readyState === 1 && isModelRunnable(Order, 'aggregate')) {
            try {
                const durationMs = endExclusiveUtc.getTime() - startUtc.getTime();
                const priorStartUtc = new Date(startUtc.getTime() - durationMs);
                const priorEndUtc = startUtc;

                const priorMatch = isStore || !sellerOrderQuery
                    ? {
                        $or: [{ paymentType: "COD" }, { isPaid: true }],
                        status: { $ne: "Cancelled" },
                        createdAt: { $gte: priorStartUtc, $lt: priorEndUtc }
                      }
                    : {
                        $and: [
                            sellerOrderQuery,
                            { status: { $ne: "Cancelled" } },
                            { createdAt: { $gte: priorStartUtc, $lt: priorEndUtc } }
                        ]
                      };
                const priorResult = await Order.aggregate([
                    { $match: priorMatch },
                    {
                        $group: {
                            _id: null,
                            totalSales: { $sum: "$amount" },
                            totalOrders: { $sum: 1 }
                        }
                    }
                ]);
                if (Array.isArray(priorResult) && priorResult[0]) {
                    priorSales = Math.round((priorResult[0].totalSales || 0) * 100) / 100;
                    priorOrders = priorResult[0].totalOrders || 0;
                }
            } catch (_) {
                priorSales = 0;
                priorOrders = 0;
            }
        }

        const totalOrdersCount = kpiDoc.totalOrders || 0;
        const totalSalesAmount = Math.round((kpiDoc.totalSales || 0) * 100) / 100;
        const averageOrderValue = totalOrdersCount > 0 ? Math.round((totalSalesAmount / totalOrdersCount) * 100) / 100 : 0;

        let growthRate = 0;
        if (priorSales > 0) {
            growthRate = Math.round(((totalSalesAmount - priorSales) / priorSales) * 10000) / 100;
        } else if (totalSalesAmount > 0) {
            growthRate = 100;
        }

        const zeroFilledDailySales = generateDailySeries(startDate, endDate, rawDailySales);
        const weeklySales = generateWeeklySeries(zeroFilledDailySales);
        const monthlySales = generateMonthlySeries(zeroFilledDailySales);
        const yearlySales = generateYearlySeries(zeroFilledDailySales);
        const growthSeries = generateGrowthSeries(zeroFilledDailySales);

        // Asia/Dhaka Date Calculations for Today & Yesterday
        const dhakaNowStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Dhaka',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date());

        const dhakaTodayStartUtc = new Date(`${dhakaNowStr}T00:00:00.000+06:00`);
        const dhakaTodayEndUtc = new Date(dhakaTodayStartUtc.getTime() + 24 * 60 * 60 * 1000);
        const dhakaYesterdayStartUtc = new Date(dhakaTodayStartUtc.getTime() - 24 * 60 * 60 * 1000);

        const dhakaYesterdayStr = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Dhaka',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(new Date(dhakaYesterdayStartUtc));

        let todayOrdersCount = 0;
        let yesterdayOrdersCount = 0;

        const todayInSeries = zeroFilledDailySales.find(d => d.date === dhakaNowStr);
        const yesterdayInSeries = zeroFilledDailySales.find(d => d.date === dhakaYesterdayStr);

        if (todayInSeries) {
            todayOrdersCount = todayInSeries.orderCount || 0;
        }
        if (yesterdayInSeries) {
            yesterdayOrdersCount = yesterdayInSeries.orderCount || 0;
        }

        if (!todayInSeries && isModelRunnable(Order, 'countDocuments')) {
            try {
                const todayMatch = isStore || !sellerOrderQuery
                    ? {
                        $or: [{ paymentType: "COD" }, { isPaid: true }],
                        createdAt: { $gte: dhakaTodayStartUtc, $lt: dhakaTodayEndUtc }
                      }
                    : {
                        $and: [
                            sellerOrderQuery,
                            { createdAt: { $gte: dhakaTodayStartUtc, $lt: dhakaTodayEndUtc } }
                        ]
                      };
                todayOrdersCount = await Order.countDocuments(todayMatch);
            } catch (_) {}
        }

        if (!yesterdayInSeries && isModelRunnable(Order, 'countDocuments')) {
            try {
                const yMatch = isStore || !sellerOrderQuery
                    ? {
                        $or: [{ paymentType: "COD" }, { isPaid: true }],
                        createdAt: { $gte: dhakaYesterdayStartUtc, $lt: dhakaTodayStartUtc }
                      }
                    : {
                        $and: [
                            sellerOrderQuery,
                            { createdAt: { $gte: dhakaYesterdayStartUtc, $lt: dhakaTodayStartUtc } }
                        ]
                      };
                yesterdayOrdersCount = await Order.countDocuments(yMatch);
            } catch (_) {}
        }

        let todayGrowthRate = 0;
        if (yesterdayOrdersCount > 0) {
            todayGrowthRate = Math.round(((todayOrdersCount - yesterdayOrdersCount) / yesterdayOrdersCount) * 10000) / 100;
        } else if (todayOrdersCount > 0) {
            todayGrowthRate = 100;
        }
        const todayDiff = todayOrdersCount - yesterdayOrdersCount;

        // Customer Directory unique customer count
        let totalCustomers = 0;
        let newCustomersToday = 0;
        const contactSellerId = typeof getEffectiveSellerId === 'function' ? getEffectiveSellerId(req) : (req?.sellerId || 'store_root');

        if (isModelRunnable(Contact, 'countDocuments')) {
            try {
                totalCustomers = await Contact.countDocuments({ sellerId: contactSellerId });
                newCustomersToday = await Contact.countDocuments({
                    sellerId: contactSellerId,
                    createdAt: { $gte: dhakaTodayStartUtc, $lt: dhakaTodayEndUtc }
                });
            } catch (_) {
                totalCustomers = 0;
                newCustomersToday = 0;
            }
        }

        if (totalCustomers === 0 && typeof totalUsers === 'number') {
            totalCustomers = totalUsers;
        }

        const kpis = {
            totalUsers: typeof totalUsers === 'number' ? totalUsers : 0,
            totalCustomers,
            newCustomersToday,
            customerGrowth: {
                newToday: newCustomersToday,
                rate: totalCustomers > 0 ? Math.round((newCustomersToday / totalCustomers) * 10000) / 100 : 0
            },
            todayOrders: {
                count: todayOrdersCount,
                yesterdayCount: yesterdayOrdersCount,
                growthRate: todayGrowthRate,
                diffCount: todayDiff,
                isPositive: todayOrdersCount >= yesterdayOrdersCount,
                date: dhakaNowStr,
                timezone: 'Asia/Dhaka'
            },
            totalOrders: totalOrdersCount,
            totalSales: totalSalesAmount,
            totalRevenue: totalSalesAmount,
            totalPendingOrders: kpiDoc.totalPendingOrders || 0,
            averageOrderValue,
            salesGrowth: {
                rate: growthRate,
                priorPeriodSales: priorSales,
                priorPeriodOrders: priorOrders,
                isPositive: growthRate >= 0
            },
            sparklines: {
                sales: zeroFilledDailySales.map(d => ({ date: d.date, value: d.sales })),
                orders: zeroFilledDailySales.map(d => ({ date: d.date, count: d.orderCount }))
            }
        };

        const productBreakdown = rawProductBreakdown.map((item) => {
            const unitsSold = typeof item.unitsSold === 'number' ? item.unitsSold : 0;
            const orderCount = typeof item.orderCount === 'number' ? item.orderCount : 0;
            const unpricedItemCount = typeof item.unpricedItemCount === 'number' ? item.unpricedItemCount : 0;
            const revenueComplete = unpricedItemCount === 0 && typeof item.revenue === 'number';
            const revenue = revenueComplete ? Math.round(item.revenue * 100) / 100 : null;

            return {
                productId: String(item.productId || ''),
                name: String(item.name || 'Unknown Product'),
                category: String(item.category || 'Uncategorized'),
                image: typeof item.image === 'string' ? item.image : null,
                unitsSold,
                revenue,
                revenueComplete,
                unpricedItemCount,
                orderCount
            };
        });

        // Ensure products are in documented ranking order:
        // Complete revenues sorted descending; unpriced/null revenues sorted by unitsSold descending
        productBreakdown.sort((a, b) => {
            if (a.revenue !== null && b.revenue !== null) {
                return b.revenue - a.revenue || b.unitsSold - a.unitsSold;
            }
            if (a.revenue !== null) return -1;
            if (b.revenue !== null) return 1;
            return b.unitsSold - a.unitsSold;
        });

        // Product ranking views
        const topRevenueProducts = [...productBreakdown].sort((a, b) => {
            if (a.revenue !== null && b.revenue !== null) return b.revenue - a.revenue;
            if (a.revenue !== null) return -1;
            if (b.revenue !== null) return 1;
            return b.unitsSold - a.unitsSold;
        }).slice(0, 10);

        const bestSellingProducts = [...productBreakdown].sort((a, b) => {
            return b.unitsSold - a.unitsSold;
        }).slice(0, 10);

        const mostOrderedProducts = [...productBreakdown].sort((a, b) => {
            return b.orderCount - a.orderCount || b.unitsSold - a.unitsSold;
        }).slice(0, 10);

        // Low stock products query
        let lowStockProducts = [];
        if (isModelRunnable(Product, 'find')) {
            try {
                const prodScope = isStore || !req?.sellerId ? {} : { sellerId: req.sellerId };
                const found = await Product.find({
                    ...prodScope,
                    $or: [
                        { stockQuantity: { $lte: 5 } },
                        { stockQuantity: 0 },
                        { inStock: false }
                    ]
                }).select('name category price offerPrice image stockQuantity lowStockThreshold inStock').limit(10).lean();

                lowStockProducts = (found || []).map(p => ({
                    productId: String(p._id),
                    name: p.name || 'Unnamed Product',
                    category: p.category || 'Uncategorized',
                    image: Array.isArray(p.image) && p.image.length > 0 ? p.image[0] : (typeof p.image === 'string' ? p.image : null),
                    price: typeof p.offerPrice === 'number' && p.offerPrice > 0 ? p.offerPrice : (p.price || 0),
                    stockQuantity: typeof p.stockQuantity === 'number' ? p.stockQuantity : 0,
                    lowStockThreshold: typeof p.lowStockThreshold === 'number' ? p.lowStockThreshold : 5,
                    inStock: Boolean(p.inStock && (p.stockQuantity === undefined || p.stockQuantity > 0)),
                    status: (!p.inStock || p.stockQuantity === 0) ? 'Out of Stock' : 'Low Stock'
                }));
            } catch (_) {
                lowStockProducts = [];
            }
        }

        // Order Analytics
        const statusMap = new Map();
        for (const s of rawOrderStatuses) {
            if (s._id) statusMap.set(s._id, { count: s.count || 0, amount: Math.round((s.amount || 0) * 100) / 100 });
        }
        const getStatusCount = (name) => statusMap.get(name)?.count || 0;
        const getStatusAmount = (name) => statusMap.get(name)?.amount || 0;

        const placedCount = getStatusCount("Order Placed");
        const packingCount = getStatusCount("Packing");
        const shippedCount = getStatusCount("Shipped");
        const outForDeliveryCount = getStatusCount("Out for Delivery");
        const deliveredCount = getStatusCount("Delivered");
        const cancelledCount = getStatusCount("Cancelled");

        const pendingOrdersTotal = rawOrderStatuses.length > 0
            ? (placedCount + packingCount + shippedCount + outForDeliveryCount)
            : (kpis.totalPendingOrders || 0);

        const processingOrdersTotal = rawOrderStatuses.length > 0
            ? (packingCount + shippedCount + outForDeliveryCount)
            : (kpis.totalPendingOrders || 0);

        const ordersData = {
            totalOrders: totalOrdersCount,
            pendingOrders: pendingOrdersTotal,
            processingOrders: processingOrdersTotal,
            completedOrders: deliveredCount,
            cancelledOrders: cancelledCount,
            statusBreakdown: [
                { status: "Order Placed", count: placedCount, amount: getStatusAmount("Order Placed") },
                { status: "Packing", count: packingCount, amount: getStatusAmount("Packing") },
                { status: "Shipped", count: shippedCount, amount: getStatusAmount("Shipped") },
                { status: "Out for Delivery", count: outForDeliveryCount, amount: getStatusAmount("Out for Delivery") },
                { status: "Delivered", count: deliveredCount, amount: getStatusAmount("Delivered") },
                { status: "Cancelled", count: cancelledCount, amount: getStatusAmount("Cancelled") }
            ]
        };

        // Conversion Analytics using existing tracking data only
        let activeUsersWithCart = 0;
        let checkoutInitiationCount = 0;

        if (isModelRunnable(User, 'countDocuments')) {
            try {
                activeUsersWithCart = await User.countDocuments({
                    cartItems: { $exists: true, $ne: {} }
                });
            } catch (_) {
                activeUsersWithCart = 0;
            }
        }

        if (isModelRunnable(OtpVerification, 'countDocuments')) {
            try {
                checkoutInitiationCount = await OtpVerification.countDocuments({
                    createdAt: { $gte: startUtc, $lt: endExclusiveUtc }
                });
            } catch (_) {
                checkoutInitiationCount = 0;
            }
        }

        const checkoutConversionRate = checkoutInitiationCount > 0
            ? Math.round((totalOrdersCount / checkoutInitiationCount) * 10000) / 100
            : (totalOrdersCount > 0 ? 100 : 0);

        const cartAbandonmentRate = activeUsersWithCart > 0
            ? Math.round((Math.max(0, activeUsersWithCart - totalOrdersCount) / activeUsersWithCart) * 10000) / 100
            : 0;

        const conversion = {
            visitors: {
                available: false,
                count: null,
                status: "not_configured",
                message: "Web visitor tracking is not enabled. Requires external web analytics or pageview tracking integration."
            },
            cart: {
                available: true,
                usersWithCart: activeUsersWithCart,
                label: "Users with Active Cart"
            },
            checkout: {
                available: true,
                checkoutInitiations: checkoutInitiationCount,
                checkoutInitiationRate: checkoutConversionRate,
                label: "Checkout OTP Initiations"
            },
            orders: {
                available: true,
                completedOrders: totalOrdersCount,
                orderConversionRate: checkoutConversionRate,
                label: "Confirmed Orders"
            },
            cartAbandonment: {
                available: true,
                abandonedCarts: Math.max(0, activeUsersWithCart - totalOrdersCount),
                cartAbandonmentRate,
                label: "Cart Abandonment Rate"
            }
        };

        return res.json({
            success: true,
            data: {
                range: {
                    startDate,
                    endDate,
                    timezone
                },
                kpis,
                dailySales: zeroFilledDailySales,
                sales: {
                    daily: zeroFilledDailySales,
                    weekly: weeklySales,
                    monthly: monthlySales,
                    yearly: yearlySales,
                    growth: growthSeries
                },
                orders: ordersData,
                products: {
                    bestSelling: bestSellingProducts,
                    topRevenue: topRevenueProducts,
                    mostOrdered: mostOrderedProducts,
                    lowStock: lowStockProducts
                },
                productBreakdown,
                conversion,
                isolation: {
                    isStoreAdmin: isStore,
                    sellerId: req?.sellerId || null
                }
            }
        });
    } catch (error) {
        console.error("Seller analytics error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
