import mongoose from "mongoose";
import Review from "../models/Review.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";

const DEFAULT_REVIEW_PAGE_LIMIT = 10;
const MAX_REVIEW_PAGE_LIMIT = 20;
const DEFAULT_SELLER_PAGE_LIMIT = 20;
const MAX_SELLER_PAGE_LIMIT = 50;
const MAX_TITLE_LENGTH = 100;
const MIN_COMMENT_LENGTH = 5;
const MAX_COMMENT_LENGTH = 1000;
const MAX_NOTE_LENGTH = 500;

/**
 * Internal helper to execute aggregation and product rating update
 */
const executeRatingCalculation = async (prodId, rawProductId, session = null) => {
    const agg = Review.aggregate([
        {
            $match: {
                productId: prodId,
                moderationStatus: "approved"
            }
        },
        {
            $group: {
                _id: "$productId",
                avgRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 }
            }
        }
    ]);

    let stats;
    if (session && agg && typeof agg.session === 'function') {
        stats = await agg.session(session);
    } else {
        stats = await agg;
    }

    const averageRating = (stats && stats.length > 0) ? Math.round(stats[0].avgRating * 10) / 10 : 0;
    const reviewCount = (stats && stats.length > 0) ? stats[0].totalReviews : 0;

    const updateOptions = { new: true };
    if (session) {
        updateOptions.session = session;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
        rawProductId,
        { $set: { averageRating, reviewCount } },
        updateOptions
    );

    if (!updatedProduct) {
        throw new Error(`Product not found during rating recalculation: ${rawProductId}`);
    }

    return { averageRating, reviewCount };
};

/**
 * Reusable helper to recalculate average rating and review count from approved reviews only.
 * Supports running within an existing MongoDB transaction session or managing its own.
 */
export const recalculateProductRating = async (productId, session = null) => {
    try {
        if (!productId || (typeof productId === 'string' && !mongoose.Types.ObjectId.isValid(productId))) {
            return null;
        }

        const prodId = typeof productId === 'string' ? new mongoose.Types.ObjectId(productId) : productId;

        // If caller passed an active transaction session, execute within it
        if (session) {
            return await executeRatingCalculation(prodId, productId, session);
        }

        const canAttemptTransaction = mongoose.connection?.readyState === 1 ||
            (typeof mongoose.startSession === 'function' && mongoose.startSession !== mongoose.Mongoose?.prototype?.startSession);

        if (canAttemptTransaction) {
            let internalSession = null;
            try {
                internalSession = await mongoose.startSession();
                let result = null;
                await internalSession.withTransaction(async () => {
                    result = await executeRatingCalculation(prodId, productId, internalSession);
                });
                return result;
            } catch (txError) {
                const isNoTxSupport = txError?.message && (
                    txError.message.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
                    txError.message.includes("Transactions are not supported")
                );

                if (!isNoTxSupport) {
                    console.error("Recalculate product rating transaction error:", txError.message);
                    throw txError;
                }
                // Fall through to non-transactional execution
            } finally {
                if (internalSession) {
                    await internalSession.endSession();
                }
            }
        }

        return await executeRatingCalculation(prodId, productId, null);
    } catch (error) {
        console.error("Recalculate product rating error:", error.message);
        throw error;
    }
};

/**
 * Customer: Submit review for a delivered product
 * POST /api/review/product/:productId
 */
export const submitReview = async (req, res) => {
    try {
        const customerId = req.userId;
        const { productId } = req.params;
        const { rating, title, comment } = req.body || {};

        if (!customerId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        if (!productId || typeof productId !== 'string' || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: "Invalid product ID" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Validate rating (integer between 1 and 5)
        if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be an integer between 1 and 5"
            });
        }

        // Validate comment length (5 to 1000 characters)
        if (typeof comment !== 'string' || comment.trim().length < MIN_COMMENT_LENGTH || comment.trim().length > MAX_COMMENT_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Review comment must be between ${MIN_COMMENT_LENGTH} and ${MAX_COMMENT_LENGTH} characters`
            });
        }

        // Validate title if provided (max 100 characters)
        if (title !== undefined && title !== null && typeof title === 'string' && title.trim().length > MAX_TITLE_LENGTH) {
            return res.status(400).json({
                success: false,
                message: `Review title cannot exceed ${MAX_TITLE_LENGTH} characters`
            });
        }

        // Verified Purchase Check: Must have a Delivered order containing this exact product
        const qualifyingOrder = await Order.findOne({
            userId: customerId,
            status: "Delivered",
            "items.product": productId
        });

        if (!qualifyingOrder) {
            return res.status(403).json({
                success: false,
                message: "Only customers with a delivered order containing this product can submit a review"
            });
        }

        // Check if customer already submitted a review for this product
        const existingReview = await Review.findOne({ productId, customerId });
        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: "You have already reviewed this product. You can edit your existing review."
            });
        }

        let review;
        try {
            review = await Review.create({
                productId,
                customerId,
                orderId: qualifyingOrder._id,
                rating,
                title: typeof title === 'string' ? title.trim() : "",
                comment: comment.trim(),
                isVerifiedPurchase: true,
                moderationStatus: "pending"
            });
        } catch (createErr) {
            if (createErr && createErr.code === 11000) {
                return res.status(400).json({
                    success: false,
                    message: "You have already reviewed this product. You can edit your existing review."
                });
            }
            throw createErr;
        }

        return res.status(201).json({
            success: true,
            message: "Review submitted successfully and is pending approval",
            review
        });

    } catch (error) {
        console.error("Submit review error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Customer: Check review eligibility and existing review status
 * GET /api/review/eligibility/:productId
 */
export const checkReviewEligibility = async (req, res) => {
    try {
        const customerId = req.userId;
        const { productId } = req.params;

        if (!customerId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        if (!productId || typeof productId !== 'string' || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: "Invalid product ID" });
        }

        const [qualifyingOrder, existingReview] = await Promise.all([
            Order.findOne({
                userId: customerId,
                status: "Delivered",
                "items.product": productId
            }),
            Review.findOne({ productId, customerId })
        ]);

        return res.json({
            success: true,
            canReview: Boolean(qualifyingOrder && !existingReview),
            hasDeliveredOrder: Boolean(qualifyingOrder),
            alreadyReviewed: Boolean(existingReview),
            review: existingReview || null
        });

    } catch (error) {
        console.error("Check review eligibility error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Customer: Edit own review
 * PUT /api/review/:reviewId
 */
export const updateReview = async (req, res) => {
    try {
        const customerId = req.userId;
        const { reviewId } = req.params;
        const { rating, title, comment } = req.body || {};

        if (!customerId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        if (!reviewId || typeof reviewId !== 'string' || !mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ success: false, message: "Invalid review ID" });
        }

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({ success: false, message: "Review not found" });
        }

        // Strict customer ownership check
        if (review.customerId.toString() !== customerId.toString()) {
            return res.status(403).json({ success: false, message: "Forbidden: You can only edit your own review" });
        }

        // Validate rating if supplied
        if (rating !== undefined) {
            if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
                return res.status(400).json({
                    success: false,
                    message: "Rating must be an integer between 1 and 5"
                });
            }
        }

        // Validate comment if supplied
        if (comment !== undefined) {
            if (typeof comment !== 'string' || comment.trim().length < MIN_COMMENT_LENGTH || comment.trim().length > MAX_COMMENT_LENGTH) {
                return res.status(400).json({
                    success: false,
                    message: `Review comment must be between ${MIN_COMMENT_LENGTH} and ${MAX_COMMENT_LENGTH} characters`
                });
            }
        }

        // Validate title if supplied
        if (title !== undefined && title !== null) {
            if (typeof title === 'string') {
                if (title.trim().length > MAX_TITLE_LENGTH) {
                    return res.status(400).json({
                        success: false,
                        message: `Review title cannot exceed ${MAX_TITLE_LENGTH} characters`
                    });
                }
            }
        }

        const wasApproved = review.moderationStatus === "approved";
        const originalReviewData = {
            rating: review.rating,
            title: review.title,
            comment: review.comment,
            moderationStatus: review.moderationStatus,
            moderatedAt: review.moderatedAt,
            moderatedBy: review.moderatedBy,
            moderationNote: review.moderationNote
        };

        // Mutate fields on review instance
        if (rating !== undefined) {
            review.rating = rating;
        }
        if (comment !== undefined) {
            review.comment = comment.trim();
        }
        if (title !== undefined && title !== null && typeof title === 'string') {
            review.title = title.trim();
        }

        // Editing resets moderation status to pending so edited content is reviewed
        review.moderationStatus = "pending";
        review.moderatedAt = null;
        review.moderatedBy = null;
        review.moderationNote = "";

        const canAttemptTransaction = mongoose.connection?.readyState === 1 ||
            (typeof mongoose.startSession === 'function' && mongoose.startSession !== mongoose.Mongoose?.prototype?.startSession);

        let transactionExecuted = false;

        if (canAttemptTransaction) {
            let session = null;
            try {
                session = await mongoose.startSession();
                await session.withTransaction(async () => {
                    await Review.findByIdAndUpdate(
                        reviewId,
                        {
                            $set: {
                                rating: review.rating,
                                title: review.title,
                                comment: review.comment,
                                moderationStatus: "pending",
                                moderatedAt: null,
                                moderatedBy: null,
                                moderationNote: ""
                            }
                        },
                        { session, new: true }
                    );

                    if (wasApproved) {
                        await recalculateProductRating(review.productId, session);
                    }
                });
                transactionExecuted = true;
            } catch (txError) {
                const isNoTxSupport = txError?.message && (
                    txError.message.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
                    txError.message.includes("Transactions are not supported")
                );

                if (isNoTxSupport) {
                    transactionExecuted = false;
                } else {
                    console.error("Update review transaction error:", txError.message);
                    return res.status(500).json({ success: false, message: "Failed to update review" });
                }
            } finally {
                if (session) {
                    await session.endSession();
                }
            }
        }

        if (!transactionExecuted) {
            if (typeof review.save === 'function') {
                await review.save();
            } else {
                await Review.findByIdAndUpdate(reviewId, {
                    $set: {
                        rating: review.rating,
                        title: review.title,
                        comment: review.comment,
                        moderationStatus: "pending",
                        moderatedAt: null,
                        moderatedBy: null,
                        moderationNote: ""
                    }
                });
            }

            // If previously approved, recalculate rating summary because it is now pending
            if (wasApproved) {
                try {
                    await recalculateProductRating(review.productId);
                } catch (recalcError) {
                    console.error("Recalculation failed during review update; attempting compensating rollback:", recalcError.message);
                    try {
                        await Review.findByIdAndUpdate(reviewId, {
                            $set: originalReviewData
                        });
                    } catch (rbErr) {
                        console.error("Compensating rollback failed:", rbErr.message);
                    }
                    return res.status(500).json({ success: false, message: "Failed to update product rating summary" });
                }
            }
        }

        return res.json({
            success: true,
            message: "Review updated successfully and returned to pending moderation",
            review
        });

    } catch (error) {
        console.error("Update review error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Customer: Delete own review
 * DELETE /api/review/:reviewId
 */
export const deleteReview = async (req, res) => {
    try {
        const customerId = req.userId;
        const { reviewId } = req.params;

        if (!customerId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        if (!reviewId || typeof reviewId !== 'string' || !mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ success: false, message: "Invalid review ID" });
        }

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({ success: false, message: "Review not found" });
        }

        if (review.customerId.toString() !== customerId.toString()) {
            return res.status(403).json({ success: false, message: "Forbidden: You can only delete your own review" });
        }

        const wasApproved = review.moderationStatus === "approved";

        const canAttemptTransaction = mongoose.connection?.readyState === 1 ||
            (typeof mongoose.startSession === 'function' && mongoose.startSession !== mongoose.Mongoose?.prototype?.startSession);

        let transactionExecuted = false;

        if (canAttemptTransaction) {
            let session = null;
            try {
                session = await mongoose.startSession();
                await session.withTransaction(async () => {
                    const deleted = await Review.findByIdAndDelete(reviewId, { session });
                    if (!deleted) {
                        throw new Error("ReviewNotFound");
                    }

                    if (wasApproved) {
                        await recalculateProductRating(review.productId, session);
                    }
                });
                transactionExecuted = true;
            } catch (txError) {
                const isNoTxSupport = txError?.message && (
                    txError.message.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
                    txError.message.includes("Transactions are not supported")
                );

                if (isNoTxSupport) {
                    transactionExecuted = false;
                } else {
                    console.error("Delete review transaction error:", txError.message);
                    return res.status(500).json({ success: false, message: "Failed to delete review" });
                }
            } finally {
                if (session) {
                    await session.endSession();
                }
            }
        }

        if (!transactionExecuted) {
            await Review.findByIdAndDelete(reviewId);

            // Recalculate summary if the deleted review was approved
            if (wasApproved) {
                try {
                    await recalculateProductRating(review.productId);
                } catch (recalcError) {
                    console.error("Recalculation failed after review deletion:", recalcError.message);
                    return res.status(500).json({ success: false, message: "Review was deleted but product rating summary recalculation failed" });
                }
            }
        }

        return res.json({
            success: true,
            message: "Review deleted successfully"
        });

    } catch (error) {
        console.error("Delete review error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Public: Get approved reviews for a product with bounded pagination and sorting
 * GET /api/review/product/:productId
 */
export const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;

        if (!productId || typeof productId !== 'string' || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: "Invalid product ID" });
        }

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const requestedLimit = parseInt(req.query.limit, 10);
        const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
            ? Math.min(requestedLimit, MAX_REVIEW_PAGE_LIMIT)
            : DEFAULT_REVIEW_PAGE_LIMIT;
        const skip = (page - 1) * limit;

        const sortOption = req.query.sort;
        let sortCriteria = { createdAt: -1 };
        if (sortOption === 'highest') {
            sortCriteria = { rating: -1, createdAt: -1 };
        } else if (sortOption === 'lowest') {
            sortCriteria = { rating: 1, createdAt: -1 };
        }

        const filter = {
            productId,
            moderationStatus: "approved"
        };

        const [reviews, total] = await Promise.all([
            Review.find(filter)
                .populate("customerId", "name")
                .sort(sortCriteria)
                .skip(skip)
                .limit(limit),
            Review.countDocuments(filter)
        ]);

        return res.json({
            success: true,
            reviews,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Get product reviews error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Seller: Get reviews for moderation inbox with optional status filter and pagination
 * GET /api/review/seller
 */
export const getSellerReviews = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const requestedLimit = parseInt(req.query.limit, 10);
        const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
            ? Math.min(requestedLimit, MAX_SELLER_PAGE_LIMIT)
            : DEFAULT_SELLER_PAGE_LIMIT;
        const skip = (page - 1) * limit;

        const { status } = req.query;
        const filter = {};
        if (status && ["pending", "approved", "rejected"].includes(status)) {
            filter.moderationStatus = status;
        }

        const [reviews, total] = await Promise.all([
            Review.find(filter)
                .populate("productId", "name image price")
                .populate("customerId", "name email")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Review.countDocuments(filter)
        ]);

        return res.json({
            success: true,
            reviews,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error("Get seller reviews error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Seller: Moderate a review (approve or reject)
 * PATCH /api/review/seller/:reviewId/moderation
 */
export const moderateReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { status, moderationNote } = req.body || {};

        if (!reviewId || typeof reviewId !== 'string' || !mongoose.Types.ObjectId.isValid(reviewId)) {
            return res.status(400).json({ success: false, message: "Invalid review ID" });
        }

        if (!status || (status !== "approved" && status !== "rejected")) {
            return res.status(400).json({
                success: false,
                message: "Invalid moderation status; must be 'approved' or 'rejected'"
            });
        }

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({ success: false, message: "Review not found" });
        }

        const noteText = typeof moderationNote === 'string'
            ? moderationNote.trim().slice(0, MAX_NOTE_LENGTH)
            : "";

        const originalStatus = review.moderationStatus;
        const originalNote = review.moderationNote;
        const originalModeratedAt = review.moderatedAt;
        const originalModeratedBy = review.moderatedBy;
        const moderatedAt = new Date();

        const canAttemptTransaction = mongoose.connection?.readyState === 1 ||
            (typeof mongoose.startSession === 'function' && mongoose.startSession !== mongoose.Mongoose?.prototype?.startSession);

        let transactionExecuted = false;

        if (canAttemptTransaction) {
            let session = null;
            try {
                session = await mongoose.startSession();
                await session.withTransaction(async () => {
                    await Review.findByIdAndUpdate(
                        reviewId,
                        {
                            $set: {
                                moderationStatus: status,
                                moderatedAt,
                                moderatedBy: "seller",
                                moderationNote: noteText
                            }
                        },
                        { session, new: true }
                    );

                    // Recalculate product rating summary to reflect approved / rejected changes inside the same transaction
                    await recalculateProductRating(review.productId, session);
                });
                transactionExecuted = true;
                review.moderationStatus = status;
                review.moderatedAt = moderatedAt;
                review.moderatedBy = "seller";
                review.moderationNote = noteText;
            } catch (txError) {
                const isNoTxSupport = txError?.message && (
                    txError.message.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
                    txError.message.includes("Transactions are not supported")
                );

                if (isNoTxSupport) {
                    transactionExecuted = false;
                } else {
                    console.error("Moderate review transaction error:", txError.message);
                    return res.status(500).json({ success: false, message: "Failed to moderate review" });
                }
            } finally {
                if (session) {
                    await session.endSession();
                }
            }
        }

        if (!transactionExecuted) {
            review.moderationStatus = status;
            review.moderatedAt = moderatedAt;
            review.moderatedBy = "seller";
            review.moderationNote = noteText;

            if (typeof review.save === 'function') {
                await review.save();
            } else {
                await Review.findByIdAndUpdate(reviewId, {
                    $set: {
                        moderationStatus: status,
                        moderatedAt,
                        moderatedBy: "seller",
                        moderationNote: noteText
                    }
                });
            }

            // Recalculate product rating summary to reflect approved / rejected changes
            try {
                await recalculateProductRating(review.productId);
            } catch (recalcError) {
                console.error("Recalculation failed during moderation; attempting compensating rollback:", recalcError.message);
                try {
                    await Review.findByIdAndUpdate(reviewId, {
                        $set: {
                            moderationStatus: originalStatus,
                            moderatedAt: originalModeratedAt,
                            moderatedBy: originalModeratedBy,
                            moderationNote: originalNote
                        }
                    });
                } catch (rbErr) {
                    console.error("Compensating rollback failed:", rbErr.message);
                }
                return res.status(500).json({ success: false, message: "Failed to update product rating summary" });
            }
        }

        return res.json({
            success: true,
            message: `Review ${status} successfully`,
            review
        });

    } catch (error) {
        console.error("Moderate review error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
