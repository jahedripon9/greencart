import express from "express";
import authUser from "../middlewares/authUser.js";
import { validateCoupon, getPublicPromotions } from "../controllers/couponController.js";

const couponRouter = express.Router();

// Public promotional coupons for popup and ticker announcements
couponRouter.get("/promotions", getPublicPromotions);
couponRouter.get("/public", getPublicPromotions);

// Customer coupon validation
couponRouter.post("/validate", authUser, validateCoupon);

export default couponRouter;
