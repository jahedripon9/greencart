import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import mongoose from 'mongoose';
import RateLimitRecord from '../models/RateLimitRecord.js';

export const RATE_LIMIT_MESSAGE = {
    success: false,
    message: "Too many requests. Please try again later."
};

export const defaultRateLimitHandler = (req, res, _next, options) => {
    res.status(options.statusCode).json(options.message);
};

export const authRequestWasSuccessful = (req, res) => {
    if (res.statusCode >= 400 || res.locals?.authFailed) {
        return false;
    }
    return true;
};

export const trackAuthOutcome = (req, res, next) => {
    if (!res._authTrackerAttached) {
        res._authTrackerAttached = true;
        const origJson = res.json.bind(res);
        res.json = (body) => {
            if (body && typeof body === 'object' && body.success === false) {
                if (!res.locals) res.locals = {};
                res.locals.authFailed = true;
            }
            return origJson(body);
        };
    }
    if (typeof next === 'function') {
        next();
    }
};

export const wrapWithAuthTracker = (limiter) => {
    const middleware = (req, res, next) => {
        trackAuthOutcome(req, res);
        return limiter(req, res, next);
    };

    if (limiter.resetKey) {
        middleware.resetKey = limiter.resetKey.bind(limiter);
    }
    if (limiter.getKey) {
        middleware.getKey = limiter.getKey.bind(limiter);
    }
    middleware.raw = limiter;
    return middleware;
};

/**
 * Shared distributed rate-limit store backed by MongoDB RateLimitRecord collection.
 * Conforms to express-rate-limit Store interface without external dependencies.
 */
export class MongoRateLimitStore {
    constructor(options = {}) {
        this.windowMs = options.windowMs || 15 * 60 * 1000;
        this.prefix = options.prefix || '';
    }

    init(options) {
        if (options?.windowMs) {
            this.windowMs = options.windowMs;
        }
    }

    _getKey(key) {
        return this.prefix ? `${this.prefix}_${key}` : key;
    }

    async increment(key) {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) {
            throw new Error("Distributed rate limit store unavailable");
        }

        const fullKey = this._getKey(key);
        const now = new Date();
        const resetTime = new Date(now.getTime() + this.windowMs);

        // Atomic update if existing active window
        const query1 = RateLimitRecord.findOneAndUpdate(
            { key: fullKey, resetTime: { $gt: now } },
            { $inc: { totalHits: 1 } },
            { new: true }
        );
        let record = typeof query1?.lean === 'function' ? await query1.lean() : await query1;

        if (!record) {
            // Expired or new window: reset hits to 1 and update resetTime
            const query2 = RateLimitRecord.findOneAndUpdate(
                { key: fullKey },
                { $set: { totalHits: 1, resetTime } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            record = typeof query2?.lean === 'function' ? await query2.lean() : await query2;
        }

        return {
            totalHits: record.totalHits,
            resetTime: record.resetTime
        };
    }

    async decrement(key) {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) return;
        const fullKey = this._getKey(key);
        await RateLimitRecord.updateOne(
            { key: fullKey, totalHits: { $gt: 0 } },
            { $inc: { totalHits: -1 } }
        );
    }

    async resetKey(key) {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) return;
        const fullKey = this._getKey(key);
        await RateLimitRecord.deleteOne({ key: fullKey });
    }

    async resetAll() {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) return;
        if (this.prefix) {
            await RateLimitRecord.deleteMany({ key: new RegExp(`^${this.prefix}_`) });
        } else {
            await RateLimitRecord.deleteMany({});
        }
    }

    async getKey(key) {
        if (!mongoose.connection || mongoose.connection.readyState !== 1) return undefined;
        const fullKey = this._getKey(key);
        const now = new Date();
        const record = await RateLimitRecord.findOne({ key: fullKey, resetTime: { $gt: now } }).lean();
        if (!record) return undefined;
        return {
            totalHits: record.totalHits,
            resetTime: record.resetTime
        };
    }
}

// Factory functions for flexible configuration/testing
export const createUserLoginLimiter = (options = {}) => {
    const raw = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 10, // 10 failed attempts per IP
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        requestWasSuccessful: authRequestWasSuccessful,
        message: RATE_LIMIT_MESSAGE,
        handler: defaultRateLimitHandler,
        validate: { xForwardedForHeader: false },
        ...options
    });
    return wrapWithAuthTracker(raw);
};

export const createUserRegisterLimiter = (options = {}) => {
    return rateLimit({
        windowMs: 60 * 60 * 1000, // 60 minutes
        limit: 5, // 5 registration attempts per IP
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        skipSuccessfulRequests: false, // Counts all attempts (success & failure)
        message: RATE_LIMIT_MESSAGE,
        handler: defaultRateLimitHandler,
        validate: { xForwardedForHeader: false },
        ...options
    });
};

export const createSellerLoginLimiter = (options = {}) => {
    const windowMs = options.windowMs || 15 * 60 * 1000;

    // Use shared store if provided or if MongoDB connection is active
    let accountStore = options.store || options.accountStore;
    let ipStore = options.store || options.ipStore;

    if (!accountStore && mongoose.connection?.readyState === 1) {
        accountStore = new MongoRateLimitStore({ windowMs, prefix: 'seller_acc' });
    }
    if (!ipStore && mongoose.connection?.readyState === 1) {
        ipStore = new MongoRateLimitStore({ windowMs, prefix: 'seller_ip' });
    }

    // 1. IP-level limiter: protects against IP-based flooding and credential spraying across accounts
    const rawIp = rateLimit({
        windowMs,
        limit: options.ipLimit || (options.limit ? options.limit * 3 : 15),
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        requestWasSuccessful: authRequestWasSuccessful,
        message: RATE_LIMIT_MESSAGE,
        handler: defaultRateLimitHandler,
        passOnStoreError: false,
        validate: { xForwardedForHeader: false, unsharedStore: false },
        keyGenerator: (req) => `seller_login_ip_${ipKeyGenerator(req.ip)}`,
        ...(ipStore ? { store: ipStore } : {})
    });

    // 2. Account-aware limiter: protects against distributed IP attacks on a single account
    const rawAccount = rateLimit({
        windowMs,
        limit: 5, // 5 failed attempts per account
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        requestWasSuccessful: authRequestWasSuccessful,
        message: RATE_LIMIT_MESSAGE,
        handler: defaultRateLimitHandler,
        passOnStoreError: false,
        validate: { xForwardedForHeader: false, unsharedStore: false },
        keyGenerator: (req) => {
            const rawEmail = req.body?.email;
            const normalizedEmail = (typeof rawEmail === 'string' && rawEmail.trim())
                ? rawEmail.trim().toLowerCase()
                : null;
            if (normalizedEmail) {
                return `seller_login_account_${normalizedEmail}`;
            }
            return `seller_login_ip_${ipKeyGenerator(req.ip)}`;
        },
        ...(accountStore ? { store: accountStore } : {}),
        ...options
    });

    const wrappedIp = wrapWithAuthTracker(rawIp);
    const wrappedAccount = wrapWithAuthTracker(rawAccount);

    const composite = (req, res, next) => {
        trackAuthOutcome(req, res);
        wrappedIp(req, res, (err) => {
            if (err) {
                return res.status(503).json(RATE_LIMIT_MESSAGE);
            }
            wrappedAccount(req, res, (err2) => {
                if (err2) {
                    return res.status(503).json(RATE_LIMIT_MESSAGE);
                }
                next();
            });
        });
    };

    composite.resetKey = (key) => {
        if (rawIp.resetKey) rawIp.resetKey(key);
        if (rawAccount.resetKey) rawAccount.resetKey(key);
    };
    composite.raw = rawAccount;
    composite.getKey = rawAccount.getKey;
    return composite;
};

export const createCheckoutLimiter = (options = {}) => {
    return rateLimit({
        windowMs: 10 * 60 * 1000, // 10 minutes
        limit: 10, // 10 checkout attempts per authenticated user
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        keyGenerator: (req) => {
            // Strictly enforce authenticated server-side req.userId; never trust req.body.userId
            if (req.userId) {
                return `checkout_user_${req.userId}`;
            }
            return `checkout_ip_${ipKeyGenerator(req.ip)}`;
        },
        message: RATE_LIMIT_MESSAGE,
        handler: defaultRateLimitHandler,
        validate: { xForwardedForHeader: false },
        ...options
    });
};

export const createOtpSendLimiter = (options = {}) => {
    return rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 5, // 5 OTP send requests per user per 15 minutes
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        skipSuccessfulRequests: false,
        keyGenerator: (req) => {
            if (req.userId) {
                return `otp_send_user_${req.userId}`;
            }
            return `otp_send_ip_${ipKeyGenerator(req.ip)}`;
        },
        message: RATE_LIMIT_MESSAGE,
        handler: defaultRateLimitHandler,
        validate: { xForwardedForHeader: false },
        ...options
    });
};

export const createOtpVerifyLimiter = (options = {}) => {
    return rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 10, // 10 OTP verification requests per user per 15 minutes
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        skipSuccessfulRequests: false,
        keyGenerator: (req) => {
            if (req.userId) {
                return `otp_verify_user_${req.userId}`;
            }
            return `otp_verify_ip_${ipKeyGenerator(req.ip)}`;
        },
        message: RATE_LIMIT_MESSAGE,
        handler: defaultRateLimitHandler,
        validate: { xForwardedForHeader: false },
        ...options
    });
};

export const createClerkAuthLimiter = (options = {}) => {
    const raw = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        limit: 15, // 15 attempts per IP
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        requestWasSuccessful: authRequestWasSuccessful,
        message: RATE_LIMIT_MESSAGE,
        handler: defaultRateLimitHandler,
        validate: { xForwardedForHeader: false },
        ...options
    });
    return wrapWithAuthTracker(raw);
};

// Singleton middleware instances attached to routes
export const userLoginLimiter = createUserLoginLimiter();
export const userRegisterLimiter = createUserRegisterLimiter();
export const sellerLoginLimiter = createSellerLoginLimiter();
export const checkoutLimiter = createCheckoutLimiter();
export const otpSendLimiter = createOtpSendLimiter();
export const otpVerifyLimiter = createOtpVerifyLimiter();
export const clerkAuthLimiter = createClerkAuthLimiter();
