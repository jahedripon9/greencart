import express from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import authUser from '../middlewares/authUser.js';
import authSeller from '../middlewares/authSeller.js';
import { requireRole } from '../middlewares/authRole.js';
import {
    submitReview,
    checkReviewEligibility,
    updateReview,
    deleteReview,
    getProductReviews,
    getSellerReviews,
    moderateReview
} from '../controllers/reviewController.js';

export const RATE_LIMIT_MESSAGE = {
    success: false,
    message: "Too many review requests. Please try again later."
};

export const defaultRateLimitHandler = (req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
};

export const reviewSubmissionKeyGenerator = (req) => {
    if (req.userId) {
        return `review_user_${req.userId}`;
    }
    return `review_ip_${ipKeyGenerator(req.ip)}`;
};

export const createReviewLimiter = (options = {}) => {
    const keyGen = options.keyGenerator || reviewSubmissionKeyGenerator;
    const limiter = rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        limit: 15, // 15 reviews/updates per hour
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        keyGenerator: keyGen,
        message: RATE_LIMIT_MESSAGE,
        handler: defaultRateLimitHandler,
        validate: { xForwardedForHeader: false },
        ...options
    });
    limiter.keyGenerator = keyGen;
    return limiter;
};

export const reviewSubmissionLimiter = createReviewLimiter();

const reviewRouter = express.Router();

// Seller Moderation Endpoints (must be declared before /:reviewId parameter routes)
reviewRouter.get('/seller', authSeller, requireRole('Admin', 'CEO', 'CTO'), getSellerReviews);
reviewRouter.patch('/seller/:reviewId/moderation', authSeller, requireRole('Admin', 'CTO'), moderateReview);

// Customer Eligibility Endpoint
reviewRouter.get('/eligibility/:productId', authUser, checkReviewEligibility);

// Public Reviews Listing by Product
reviewRouter.get('/product/:productId', getProductReviews);

// Customer Mutation Endpoints
reviewRouter.post('/product/:productId', authUser, reviewSubmissionLimiter, submitReview);
reviewRouter.put('/:reviewId', authUser, reviewSubmissionLimiter, updateReview);
reviewRouter.delete('/:reviewId', authUser, deleteReview);

export default reviewRouter;
