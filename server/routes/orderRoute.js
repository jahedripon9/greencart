import express from 'express';
import authUser from '../middlewares/authUser.js';
import authOrderAccess from '../middlewares/authOrderAccess.js';
import { getAllOrders, getOrderById, getOrderInvoicePdf, getUserOrders, placeOrderCOD, updateOrderStatus } from '../controllers/orderController.js';
import { sendCheckoutOtp, verifyCheckoutOtp } from '../controllers/otpController.js';
import authSeller from '../middlewares/authSeller.js';
import { requireRole } from '../middlewares/authRole.js';
import { checkoutLimiter, otpSendLimiter, otpVerifyLimiter } from '../middlewares/rateLimiter.js';

const orderRouter = express.Router();
orderRouter.post('/otp/send', authUser, otpSendLimiter, sendCheckoutOtp);
orderRouter.post('/otp/verify', authUser, otpVerifyLimiter, verifyCheckoutOtp);
orderRouter.post('/cod', authUser, checkoutLimiter, placeOrderCOD);
orderRouter.get('/user', authUser, getUserOrders);
orderRouter.get('/seller', authSeller, requireRole('Admin', 'CEO', 'CTO'), getAllOrders);
orderRouter.post('/status', authSeller, requireRole('Admin', 'CTO'), updateOrderStatus);
orderRouter.get('/:orderId/pdf', authOrderAccess, getOrderInvoicePdf);
orderRouter.get('/:orderId', authOrderAccess, getOrderById);

export default orderRouter;
