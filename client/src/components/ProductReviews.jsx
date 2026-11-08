import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import StarRating from './StarRating';
import ReviewModal from './ReviewModal';
import { assets } from '../assets/assets';
import toast from 'react-hot-toast';

/**
 * ProductReviews Component
 * Handles public review listing, pagination, sorting, customer eligibility checks,
 * and authenticated review submission/editing/deletion.
 *
 * @param {Object} props
 * @param {string} props.productId - Product MongoDB ObjectId
 * @param {string} [props.productName] - Product name for modal display
 * @param {string} [props.productImage] - Product image URL
 * @param {number} [props.averageRating=0] - Current average product rating
 * @param {number} [props.reviewCount=0] - Total approved reviews count
 */
const ProductReviews = ({
    productId,
    productName = '',
    productImage = '',
    averageRating = 0,
    reviewCount = 0
}) => {
    const { axios, user, setShowUserLogin, fetchProducts } = useAppContext();

    // Public Reviews State
    const [reviews, setReviews] = useState([]);
    const [reviewsLoading, setReviewsLoading] = useState(true);
    const [reviewsError, setReviewsError] = useState(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalApproved, setTotalApproved] = useState(reviewCount);
    const [sortOption, setSortOption] = useState('newest'); // 'newest' | 'highest' | 'lowest'

    // Customer Eligibility State
    const [eligibilityLoading, setEligibilityLoading] = useState(false);
    const [canReview, setCanReview] = useState(false);
    const [hasDeliveredOrder, setHasDeliveredOrder] = useState(false);
    const [ownReview, setOwnReview] = useState(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);

    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // 1. Fetch Public Reviews
    const fetchPublicReviews = useCallback(async (targetPage = 1, currentSort = 'newest') => {
        if (!productId) return;
        setReviewsLoading(true);
        setReviewsError(null);

        try {
            const sortParam = currentSort === 'newest' ? '' : `&sort=${currentSort}`;
            const { data } = await axios.get(`/api/review/product/${productId}?page=${targetPage}&limit=10${sortParam}`);

            if (isMountedRef.current) {
                if (data.success) {
                    setReviews(data.reviews || []);
                    setPage(data.pagination?.page || 1);
                    setTotalPages(data.pagination?.totalPages || 1);
                    setTotalApproved(data.pagination?.total || 0);
                } else {
                    setReviewsError(data.message || "Failed to load reviews");
                }
            }
        } catch (err) {
            if (isMountedRef.current) {
                setReviewsError(err.response?.data?.message || err.message || "Failed to load reviews");
            }
        } finally {
            if (isMountedRef.current) {
                setReviewsLoading(false);
            }
        }
    }, [productId, axios]);

    // 2. Fetch Customer Eligibility and Own Review
    const fetchEligibility = useCallback(async () => {
        if (!user || !productId) {
            setCanReview(false);
            setHasDeliveredOrder(false);
            setOwnReview(null);
            return;
        }

        setEligibilityLoading(true);
        try {
            const { data } = await axios.get(`/api/review/eligibility/${productId}`);
            if (isMountedRef.current && data.success) {
                setCanReview(Boolean(data.canReview));
                setHasDeliveredOrder(Boolean(data.hasDeliveredOrder));
                setOwnReview(data.review || null);
            }
        } catch {
            // Unauthenticated or network error; keep state safely closed
            if (isMountedRef.current) {
                setCanReview(false);
                setHasDeliveredOrder(false);
                setOwnReview(null);
            }
        } finally {
            if (isMountedRef.current) {
                setEligibilityLoading(false);
            }
        }
    }, [user, productId, axios]);

    useEffect(() => {
        fetchPublicReviews(page, sortOption);
    }, [fetchPublicReviews, page, sortOption]);

    useEffect(() => {
        fetchEligibility();
    }, [fetchEligibility]);

    // Format date string safely
    const formatDate = (dateString) => {
        if (!dateString) return '';
        try {
            const d = new Date(dateString);
            return d.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return '';
        }
    };

    // Review Modal Submit Handler (handles both Create and Edit)
    const handleModalSubmit = async (formData) => {
        if (ownReview && ownReview._id) {
            // Edit existing review
            const { data } = await axios.put(`/api/review/${ownReview._id}`, formData);
            if (data.success) {
                toast.success(data.message || "Review updated and returned to pending moderation");
            } else {
                throw new Error(data.message || "Failed to update review");
            }
        } else {
            // Create new review
            const { data } = await axios.post(`/api/review/product/${productId}`, formData);
            if (data.success) {
                toast.success(data.message || "Review submitted! It will appear once approved by the seller.");
            } else {
                throw new Error(data.message || "Failed to submit review");
            }
        }

        // Refresh eligibility, public reviews, and global product rating
        await Promise.allSettled([
            fetchEligibility(),
            fetchPublicReviews(1, sortOption),
            typeof fetchProducts === 'function' ? fetchProducts() : Promise.resolve()
        ]);
    };

    // Review Modal Delete Handler
    const handleModalDelete = async (reviewId) => {
        const { data } = await axios.delete(`/api/review/${reviewId}`);
        if (data.success) {
            toast.success(data.message || "Review deleted successfully");
        } else {
            throw new Error(data.message || "Failed to delete review");
        }

        await Promise.allSettled([
            fetchEligibility(),
            fetchPublicReviews(1, sortOption),
            typeof fetchProducts === 'function' ? fetchProducts() : Promise.resolve()
        ]);
    };

    const handleSortChange = (e) => {
        const newSort = e.target.value;
        setSortOption(newSort);
        setPage(1);
    };

    const handleOpenCreateModal = () => {
        if (!user) {
            setShowUserLogin(true);
            toast("Please log in to review this product");
            return;
        }
        setIsModalOpen(true);
    };

    return (
        <section id="reviews-section" className="mt-16 pt-10 border-t border-gray-200">
            {/* Header: Title and Overall Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 className="text-2xl font-semibold text-gray-800">Customer Reviews & Ratings</h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Verified ratings and feedback from verified purchasers
                    </p>
                </div>

                {/* Rating Summary Badge */}
                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 px-4 py-2.5 rounded-xl w-max">
                    <div className="text-center pr-3 border-r border-gray-200">
                        <span className="text-2xl font-bold text-gray-900 leading-none">
                            {averageRating > 0 ? averageRating.toFixed(1) : "0.0"}
                        </span>
                        <span className="text-xs text-gray-500 block mt-0.5">out of 5</span>
                    </div>
                    <div>
                        <StarRating rating={averageRating} size="md" />
                        <span className="text-xs text-gray-600 block mt-1">
                            Based on {totalApproved} approved {totalApproved === 1 ? 'review' : 'reviews'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Customer Review Eligibility & Own Review Cards */}
            <div className="mb-8">
                {ownReview ? (
                    // 1. Author's Own Existing Review Card
                    <div className="border-2 border-emerald-500/30 bg-emerald-50/20 rounded-xl p-5 shadow-xs relative">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-gray-200">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-primary">Your Review</span>
                                {ownReview.moderationStatus === "approved" && (
                                    <span className="bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block"></span>
                                        Published & Approved
                                    </span>
                                )}
                                {ownReview.moderationStatus === "pending" && (
                                    <span className="bg-amber-100 text-amber-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 inline-block"></span>
                                        Pending Seller Approval
                                    </span>
                                )}
                                {ownReview.moderationStatus === "rejected" && (
                                    <span className="bg-rose-100 text-rose-800 text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 inline-block"></span>
                                        Needs Changes / Rejected
                                    </span>
                                )}
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsModalOpen(true)}
                                className="text-xs font-medium text-primary hover:text-primary-dull underline cursor-pointer w-max"
                            >
                                Edit or Delete Review
                            </button>
                        </div>

                        {ownReview.moderationStatus === "pending" && (
                            <p className="text-xs text-amber-700 bg-amber-50/80 border border-amber-200 rounded p-2 my-3">
                                Your review is currently under review by our moderation team. It is visible only to you until approved.
                            </p>
                        )}
                        {ownReview.moderationStatus === "rejected" && (
                            <p className="text-xs text-rose-700 bg-rose-50/80 border border-rose-200 rounded p-2 my-3">
                                Your review did not meet public guidelines. You can edit your review to submit it for reconsideration.
                            </p>
                        )}

                        <div className="mt-3">
                            <div className="flex items-center gap-2 mb-1">
                                <StarRating rating={ownReview.rating} size="sm" />
                                <span className="text-xs text-gray-400">• {formatDate(ownReview.updatedAt || ownReview.createdAt)}</span>
                            </div>
                            {ownReview.title && (
                                <h4 className="text-sm font-semibold text-gray-800 mb-1">{ownReview.title}</h4>
                            )}
                            <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{ownReview.comment}</p>
                        </div>
                    </div>
                ) : (
                    // 2. Eligibility Banners (When Customer has not reviewed yet)
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        {!user ? (
                            <>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-800">Have you purchased this item?</h4>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Log in to leave a verified review once your order has been delivered.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowUserLogin(true)}
                                    className="px-5 py-2 bg-primary hover:bg-primary-dull text-white text-xs font-medium rounded-full transition cursor-pointer shrink-0"
                                >
                                    Log In to Review
                                </button>
                            </>
                        ) : eligibilityLoading ? (
                            <div className="text-xs text-gray-400 animate-pulse">
                                Checking purchase verification...
                            </div>
                        ) : canReview ? (
                            <>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                                        <span className="text-emerald-600 font-bold">✓</span>
                                        <span>Verified Buyer — You can review this product</span>
                                    </h4>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Share your honest feedback with other shoppers on GreenCart.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleOpenCreateModal}
                                    className="px-5 py-2 bg-primary hover:bg-primary-dull text-white text-xs font-medium rounded-full transition cursor-pointer shrink-0"
                                >
                                    Write a Review
                                </button>
                            </>
                        ) : !hasDeliveredOrder ? (
                            <div>
                                <h4 className="text-sm font-medium text-gray-700">Verified Purchases Only</h4>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Only customers with a successfully delivered order containing this product can submit a review.
                                </p>
                            </div>
                        ) : null}
                    </div>
                )}
            </div>

            {/* Sorting & Filter Controls */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 text-xs text-gray-600">
                <span className="font-medium text-gray-700">
                    Showing {reviews.length} of {totalApproved} {totalApproved === 1 ? 'review' : 'reviews'}
                </span>

                <div className="flex items-center gap-2">
                    <label htmlFor="review-sort" className="text-gray-500">Sort by:</label>
                    <select
                        id="review-sort"
                        value={sortOption}
                        onChange={handleSortChange}
                        disabled={reviewsLoading}
                        className="bg-white border border-gray-300 rounded px-2.5 py-1 text-xs text-gray-700 focus:outline-none focus:border-primary cursor-pointer disabled:bg-gray-100"
                    >
                        <option value="newest">Newest First</option>
                        <option value="highest">Highest Rating</option>
                        <option value="lowest">Lowest Rating</option>
                    </select>
                </div>
            </div>

            {/* Public Approved Reviews List */}
            <div className="mt-6 space-y-6">
                {reviewsLoading ? (
                    // Loading Skeleton
                    Array(3).fill('').map((_, i) => (
                        <div key={i} className="border-b border-gray-100 pb-6 animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/6 mb-4"></div>
                            <div className="h-4 bg-gray-100 rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                        </div>
                    ))
                ) : reviewsError ? (
                    // Error View
                    <div className="border border-red-200 bg-red-50 p-6 rounded-xl text-center my-6">
                        <p className="text-sm text-red-700 font-medium mb-2">Unable to load reviews</p>
                        <p className="text-xs text-red-600 mb-4">{reviewsError}</p>
                        <button
                            type="button"
                            onClick={() => fetchPublicReviews(page, sortOption)}
                            className="px-4 py-1.5 bg-red-600 text-white rounded-full text-xs font-medium hover:bg-red-700 transition cursor-pointer"
                        >
                            Try Again
                        </button>
                    </div>
                ) : reviews.length === 0 ? (
                    // Empty State
                    <div className="text-center py-12 px-4 border border-dashed border-gray-300 rounded-xl my-6 bg-gray-50/50">
                        <img src={assets.box_icon} alt="" className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <h3 className="text-base font-medium text-gray-800 mb-1">No reviews yet</h3>
                        <p className="text-xs text-gray-500 max-w-sm mx-auto">
                            Be the first verified customer to share your thoughts about this product!
                        </p>
                    </div>
                ) : (
                    // Rendered Reviews List
                    reviews.map((rev) => (
                        <article key={rev._id} className="border-b border-gray-200 pb-6 last:border-b-0">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm text-gray-800">
                                        {rev.customerId?.name || "Verified Customer"}
                                    </span>
                                    {rev.isVerifiedPurchase && (
                                        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            ✓ Verified Purchase
                                        </span>
                                    )}
                                </div>
                                <time className="text-xs text-gray-400" dateTime={rev.createdAt}>
                                    {formatDate(rev.createdAt)}
                                </time>
                            </div>

                            <div className="flex items-center gap-2 my-1.5">
                                <StarRating rating={rev.rating} size="sm" />
                                {rev.title && (
                                    <h4 className="text-sm font-semibold text-gray-800">{rev.title}</h4>
                                )}
                            </div>

                            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line mt-1.5">
                                {rev.comment}
                            </p>
                        </article>
                    ))
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8 pt-4 border-t border-gray-200">
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1 || reviewsLoading}
                        className="px-3.5 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                        Previous
                    </button>

                    <span className="text-xs text-gray-600 px-3">
                        Page {page} of {totalPages}
                    </span>

                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages || reviewsLoading}
                        className="px-3.5 py-1.5 border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Review Modal (Create / Edit) */}
            <ReviewModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
                onDelete={handleModalDelete}
                initialReview={ownReview}
                productName={productName}
                productImage={productImage}
            />
        </section>
    );
};

export default ProductReviews;
