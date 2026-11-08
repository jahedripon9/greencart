import mongoose from "mongoose";
import Coupon from "../models/Coupon.js";
import Order from "../models/Order.js";

/**
 * Validates a coupon code for customer checkout.
 * Route: POST /api/coupon/validate
 * Protected: Customer (authUser)
 */
export const validateCoupon = async (req, res) => {
    try {
        const { code, subtotal } = req.body || {};

        if (!code || typeof code !== 'string' || !code.trim()) {
            return res.status(400).json({ success: false, message: "Please enter a valid coupon code" });
        }

        if (typeof subtotal !== 'number' || !Number.isFinite(subtotal) || subtotal <= 0) {
            return res.status(400).json({ success: false, message: "Order subtotal must be greater than 0 to apply a coupon" });
        }

        const normalizedCode = code.trim().toUpperCase();
        const coupon = await Coupon.findOne({ code: normalizedCode });

        if (!coupon) {
            return res.status(400).json({ success: false, message: `Coupon code "${normalizedCode}" was not found` });
        }

        if (!coupon.active) {
            return res.status(400).json({ success: false, message: `Coupon "${normalizedCode}" is currently inactive` });
        }

        const now = new Date();
        if (new Date(coupon.expiryDate) <= now) {
            return res.status(400).json({
                success: false,
                message: `Coupon "${normalizedCode}" expired on ${new Date(coupon.expiryDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
            });
        }

        if (typeof coupon.usedCount === 'number' && typeof coupon.usageLimit === 'number' && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({
                success: false,
                message: `Coupon "${normalizedCode}" has reached its maximum redemption limit`
            });
        }

        const minOrder = typeof coupon.minOrderAmount === 'number' ? coupon.minOrderAmount : 0;
        if (subtotal < minOrder) {
            return res.status(400).json({
                success: false,
                message: `Minimum order amount of ${minOrder} is required to use coupon "${normalizedCode}"`
            });
        }

        // Calculate discount value
        let discountAmount = 0;
        if (coupon.discountType === 'percentage') {
            discountAmount = Math.round(((subtotal * coupon.discountValue) / 100) * 100) / 100;
            discountAmount = Math.min(discountAmount, subtotal);
        } else if (coupon.discountType === 'fixed') {
            discountAmount = Math.min(coupon.discountValue, subtotal);
        }

        return res.json({
            success: true,
            message: `Coupon "${normalizedCode}" applied successfully`,
            coupon: {
                id: coupon._id,
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                discountAmount,
                minOrderAmount: minOrder,
                expiryDate: coupon.expiryDate,
                description: coupon.description || ""
            }
        });

    } catch (error) {
        console.error("Error in validateCoupon:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error validating coupon" });
    }
};

/**
 * Creates a new coupon.
 * Route: POST /api/seller/coupons
 * Protected: Admin only (authSeller, requireRole('Admin'))
 */
export const createCoupon = async (req, res) => {
    try {
        const {
            code,
            discountType,
            discountValue,
            minOrderAmount = 0,
            expiryDate,
            usageLimit,
            active = true,
            description = ""
        } = req.body || {};

        if (!code || typeof code !== 'string' || !code.trim()) {
            return res.status(400).json({ success: false, message: "Coupon code is required" });
        }

        const normalizedCode = code.trim().toUpperCase();
        if (!/^[A-Z0-9_-]{3,25}$/.test(normalizedCode)) {
            return res.status(400).json({
                success: false,
                message: "Coupon code must be between 3 and 25 characters and contain only letters, numbers, hyphens, and underscores"
            });
        }

        const existing = await Coupon.findOne({ code: normalizedCode });
        if (existing) {
            return res.status(400).json({ success: false, message: `A coupon with code "${normalizedCode}" already exists` });
        }

        if (discountType !== 'percentage' && discountType !== 'fixed') {
            return res.status(400).json({ success: false, message: "Discount type must be either 'percentage' or 'fixed'" });
        }

        const numVal = Number(discountValue);
        if (isNaN(numVal) || !Number.isFinite(numVal) || numVal <= 0) {
            return res.status(400).json({ success: false, message: "Discount value must be a positive number" });
        }

        if (discountType === 'percentage' && (numVal < 1 || numVal > 100)) {
            return res.status(400).json({ success: false, message: "Percentage discount must be between 1% and 100%" });
        }

        const numMinOrder = Number(minOrderAmount);
        if (isNaN(numMinOrder) || !Number.isFinite(numMinOrder) || numMinOrder < 0) {
            return res.status(400).json({ success: false, message: "Minimum order amount cannot be negative" });
        }

        if (!expiryDate) {
            return res.status(400).json({ success: false, message: "Expiry date is required" });
        }

        const parsedExpiry = new Date(expiryDate);
        if (isNaN(parsedExpiry.getTime())) {
            return res.status(400).json({ success: false, message: "Invalid expiry date format" });
        }

        if (parsedExpiry <= new Date()) {
            return res.status(400).json({ success: false, message: "Expiry date must be in the future" });
        }

        const numLimit = Number(usageLimit);
        if (isNaN(numLimit) || !Number.isInteger(numLimit) || numLimit < 1) {
            return res.status(400).json({ success: false, message: "Usage limit must be a positive integer of at least 1" });
        }

        const newCoupon = await Coupon.create({
            code: normalizedCode,
            discountType,
            discountValue: numVal,
            minOrderAmount: numMinOrder,
            expiryDate: parsedExpiry,
            usageLimit: numLimit,
            active: Boolean(active),
            description: typeof description === 'string' ? description.trim() : "",
            usedCount: 0
        });

        return res.status(201).json({
            success: true,
            message: `Coupon "${normalizedCode}" created successfully`,
            coupon: newCoupon
        });

    } catch (error) {
        console.error("Error in createCoupon:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error creating coupon" });
    }
};

/**
 * Lists all coupons with search, filters, and pagination.
 * Route: GET /api/seller/coupons
 * Protected: Admin only
 */
export const getAllCoupons = async (req, res) => {
    try {
        const {
            search = "",
            status = "all",
            discountType = "all",
            page = 1,
            limit = 50
        } = req.query || {};

        const filter = {};

        if (search && typeof search === 'string' && search.trim()) {
            const regex = new RegExp(search.trim(), 'i');
            filter.$or = [{ code: regex }, { description: regex }];
        }

        const now = new Date();
        if (status === 'active') {
            filter.active = true;
            filter.expiryDate = { $gt: now };
        } else if (status === 'inactive') {
            filter.active = false;
        } else if (status === 'expired') {
            filter.expiryDate = { $lte: now };
        }

        if (discountType === 'percentage' || discountType === 'fixed') {
            filter.discountType = discountType;
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
        const skip = (pageNum - 1) * limitNum;

        const totalCoupons = await Coupon.countDocuments(filter);
        const coupons = await Coupon.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        return res.json({
            success: true,
            coupons,
            pagination: {
                totalCoupons,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(totalCoupons / limitNum) || 1
            }
        });

    } catch (error) {
        console.error("Error in getAllCoupons:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error fetching coupons" });
    }
};

/**
 * Gets a single coupon by ID.
 * Route: GET /api/seller/coupons/:id
 * Protected: Admin only
 */
export const getCouponById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid coupon ID" });
        }

        const coupon = await Coupon.findById(id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        return res.json({ success: true, coupon });

    } catch (error) {
        console.error("Error in getCouponById:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error fetching coupon" });
    }
};

/**
 * Updates an existing coupon.
 * Route: PUT /api/seller/coupons/:id
 * Protected: Admin only
 */
export const updateCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid coupon ID" });
        }

        const existingCoupon = await Coupon.findById(id);
        if (!existingCoupon) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        const {
            code,
            discountType,
            discountValue,
            minOrderAmount,
            expiryDate,
            usageLimit,
            active,
            description
        } = req.body || {};

        const updatePayload = {};

        if (code !== undefined) {
            if (typeof code !== 'string' || !code.trim()) {
                return res.status(400).json({ success: false, message: "Coupon code cannot be empty" });
            }
            const normalizedCode = code.trim().toUpperCase();
            if (!/^[A-Z0-9_-]{3,25}$/.test(normalizedCode)) {
                return res.status(400).json({
                    success: false,
                    message: "Coupon code must be between 3 and 25 characters and contain only letters, numbers, hyphens, and underscores"
                });
            }
            if (normalizedCode !== existingCoupon.code) {
                const collision = await Coupon.findOne({ code: normalizedCode, _id: { $ne: id } });
                if (collision) {
                    return res.status(400).json({ success: false, message: `A coupon with code "${normalizedCode}" already exists` });
                }
            }
            updatePayload.code = normalizedCode;
        }

        if (discountType !== undefined) {
            if (discountType !== 'percentage' && discountType !== 'fixed') {
                return res.status(400).json({ success: false, message: "Discount type must be either 'percentage' or 'fixed'" });
            }
            updatePayload.discountType = discountType;
        }

        const effectiveType = updatePayload.discountType || existingCoupon.discountType;

        if (discountValue !== undefined) {
            const numVal = Number(discountValue);
            if (isNaN(numVal) || !Number.isFinite(numVal) || numVal <= 0) {
                return res.status(400).json({ success: false, message: "Discount value must be a positive number" });
            }
            if (effectiveType === 'percentage' && (numVal < 1 || numVal > 100)) {
                return res.status(400).json({ success: false, message: "Percentage discount must be between 1% and 100%" });
            }
            updatePayload.discountValue = numVal;
        }

        if (minOrderAmount !== undefined) {
            const numMin = Number(minOrderAmount);
            if (isNaN(numMin) || !Number.isFinite(numMin) || numMin < 0) {
                return res.status(400).json({ success: false, message: "Minimum order amount cannot be negative" });
            }
            updatePayload.minOrderAmount = numMin;
        }

        if (expiryDate !== undefined) {
            const parsedExpiry = new Date(expiryDate);
            if (isNaN(parsedExpiry.getTime())) {
                return res.status(400).json({ success: false, message: "Invalid expiry date format" });
            }
            updatePayload.expiryDate = parsedExpiry;
        }

        if (usageLimit !== undefined) {
            const numLimit = Number(usageLimit);
            if (isNaN(numLimit) || !Number.isInteger(numLimit) || numLimit < 1) {
                return res.status(400).json({ success: false, message: "Usage limit must be a positive integer of at least 1" });
            }
            if (numLimit < existingCoupon.usedCount) {
                return res.status(400).json({
                    success: false,
                    message: `Usage limit cannot be less than current used count (${existingCoupon.usedCount})`
                });
            }
            updatePayload.usageLimit = numLimit;
        }

        if (active !== undefined) {
            updatePayload.active = Boolean(active);
        }

        if (description !== undefined) {
            updatePayload.description = typeof description === 'string' ? description.trim() : "";
        }

        const updated = await Coupon.findByIdAndUpdate(
            id,
            { $set: updatePayload },
            { new: true, runValidators: true }
        );

        return res.json({
            success: true,
            message: `Coupon "${updated.code}" updated successfully`,
            coupon: updated
        });

    } catch (error) {
        console.error("Error in updateCoupon:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error updating coupon" });
    }
};

/**
 * Toggles a coupon's active status.
 * Route: PATCH /api/seller/coupons/:id/status
 * Protected: Admin only
 */
export const toggleCouponStatus = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid coupon ID" });
        }

        const coupon = await Coupon.findById(id);
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        coupon.active = !coupon.active;
        await coupon.save();

        return res.json({
            success: true,
            message: `Coupon "${coupon.code}" ${coupon.active ? 'activated' : 'deactivated'} successfully`,
            coupon
        });

    } catch (error) {
        console.error("Error in toggleCouponStatus:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error toggling coupon status" });
    }
};

/**
 * Deletes a coupon.
 * Route: DELETE /api/seller/coupons/:id
 * Protected: Admin only
 */
export const deleteCoupon = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid coupon ID" });
        }

        const deleted = await Coupon.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ success: false, message: "Coupon not found" });
        }

        return res.json({
            success: true,
            message: `Coupon "${deleted.code}" deleted successfully`
        });

    } catch (error) {
        console.error("Error in deleteCoupon:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error deleting coupon" });
    }
};

/**
 * Returns coupon and promotion analytics/statistics.
 * Route: GET /api/seller/coupons/stats
 * Protected: Admin only
 */
export const getCouponStats = async (req, res) => {
    try {
        const now = new Date();

        const [
            totalCoupons,
            activeCoupons,
            expiredCoupons,
            inactiveCoupons,
            usageAggregate,
            orderSavingsAggregate
        ] = await Promise.all([
            Coupon.countDocuments(),
            Coupon.countDocuments({ active: true, expiryDate: { $gt: now } }),
            Coupon.countDocuments({ expiryDate: { $lte: now } }),
            Coupon.countDocuments({ active: false }),
            Coupon.aggregate([
                { $group: { _id: null, totalRedemptions: { $sum: "$usedCount" } } }
            ]),
            Order.aggregate([
                {
                    $match: {
                        "coupon.discountAmount": { $gt: 0 },
                        status: { $ne: "Cancelled" }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalDiscountGranted: { $sum: "$coupon.discountAmount" },
                        ordersCount: { $sum: 1 }
                    }
                }
            ])
        ]);

        const totalRedemptions = usageAggregate[0]?.totalRedemptions || 0;
        const totalDiscountGranted = orderSavingsAggregate[0]?.totalDiscountGranted || 0;
        const couponOrdersCount = orderSavingsAggregate[0]?.ordersCount || 0;

        return res.json({
            success: true,
            stats: {
                totalCoupons,
                activeCoupons,
                expiredCoupons,
                inactiveCoupons,
                totalRedemptions,
                totalDiscountGranted,
                couponOrdersCount
            }
        });

    } catch (error) {
        console.error("Error in getCouponStats:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error fetching coupon statistics" });
    }
};

/**
 * Returns active, eligible promotional coupons for public announcements (popup and ticker).
 * Route: GET /api/coupon/promotions
 * Public read-only endpoint.
 * Strictly strips all internal / sensitive fields (usedCount, usageLimit, IDs, etc.).
 */
export const getPublicPromotions = async (req, res) => {
    try {
        const now = new Date();

        // 1. Query candidate active coupons that have not expired
        const filter = {
            active: true,
            expiryDate: { $gt: now }
        };

        const coupons = await Coupon.find(filter)
            .sort({ discountValue: -1, createdAt: -1 })
            .lean();

        // 2. Filter strictly within usage limit and active status
        const eligiblePromotions = (coupons || [])
            .filter(c => {
                if (!c.active) return false;
                if (new Date(c.expiryDate) <= now) return false;
                const used = typeof c.usedCount === 'number' ? c.usedCount : 0;
                const limit = typeof c.usageLimit === 'number' ? c.usageLimit : 1;
                return used < limit;
            })
            .map(c => ({
                code: c.code,
                discountType: c.discountType,
                discountValue: c.discountValue,
                minOrderAmount: typeof c.minOrderAmount === 'number' ? c.minOrderAmount : 0,
                expiryDate: c.expiryDate,
                description: c.description || ""
            }));

        return res.json({
            success: true,
            coupons: eligiblePromotions
        });

    } catch (error) {
        console.error("Error in getPublicPromotions:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error fetching promotions" });
    }
};
