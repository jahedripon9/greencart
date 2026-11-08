import express from "express";
import authSeller from "../middlewares/authSeller.js";
import { requireRole } from "../middlewares/authRole.js";
import {
    createCoupon,
    getAllCoupons,
    getCouponById,
    updateCoupon,
    toggleCouponStatus,
    deleteCoupon,
    getCouponStats
} from "../controllers/couponController.js";

const sellerCouponRouter = express.Router();

// Strict Admin-only middleware chain for all coupon management routes
sellerCouponRouter.use(authSeller, requireRole('Admin'));

// Analytics & Statistics
sellerCouponRouter.get('/stats', getCouponStats);

// Coupon CRUD operations
sellerCouponRouter.get('/', getAllCoupons);
sellerCouponRouter.post('/', createCoupon);
sellerCouponRouter.get('/:id', getCouponById);
sellerCouponRouter.put('/:id', updateCoupon);
sellerCouponRouter.patch('/:id/status', toggleCouponStatus);
sellerCouponRouter.delete('/:id', deleteCoupon);

export default sellerCouponRouter;
