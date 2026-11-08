import express from 'express';
import { isSellerAuth, sellerLogin, SellerLogout, getSalesAnalytics, revokeRootMerchantSessions } from '../controllers/sellerController.js';
import authSeller, { optionalAuthSeller } from '../middlewares/authSeller.js';
import { requireRole } from '../middlewares/authRole.js';
import { sellerLoginLimiter } from '../middlewares/rateLimiter.js';
import teamRouter from './teamRoute.js';
import contactRouter from './contactRoute.js';
import notificationRouter from './notificationRoute.js';
import sellerCouponRouter from './sellerCouponRoute.js';
import activityLogRouter from './activityLogRoute.js';
import sellerReturnRouter from './sellerReturnRoute.js';

const sellerRouter = express.Router();

sellerRouter.post('/login', sellerLoginLimiter, sellerLogin);
sellerRouter.get('/is-auth', optionalAuthSeller, isSellerAuth);
sellerRouter.get('/logout', SellerLogout);
sellerRouter.post('/revoke-all-sessions', authSeller, requireRole('Admin'), revokeRootMerchantSessions);
sellerRouter.get('/analytics', authSeller, getSalesAnalytics);
sellerRouter.use('/team', teamRouter);
sellerRouter.use('/contacts', contactRouter);
sellerRouter.use('/notifications', notificationRouter);
sellerRouter.use('/coupons', sellerCouponRouter);
sellerRouter.use('/activity-logs', activityLogRouter);
sellerRouter.use('/returns', sellerReturnRouter);

export default sellerRouter;
