import React, { useState, useEffect } from 'react';
import StarRating from './StarRating';
import { assets } from '../assets/assets';

/**
 * Modal component for submitting a new review or editing/deleting an existing review.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {Function} props.onClose - Modal close handler
 * @param {Function} props.onSubmit - Submission handler accepting { rating, title, comment }
 * @param {Function} [props.onDelete] - Deletion handler accepting reviewId
 * @param {Object|null} [props.initialReview] - Existing review data if in edit mode
 * @param {string} [props.productName] - Product display name
 * @param {string} [props.productImage] - Product thumbnail URL
 */
const ReviewModal = ({
    isOpen,
    onClose,
    onSubmit,
    onDelete,
    initialReview = null,
    productName = '',
    productImage = ''
}) => {
    const isEditMode = Boolean(initialReview && initialReview._id);

    const [rating, setRating] = useState(0);
    const [title, setTitle] = useState('');
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [clientError, setClientError] = useState(null);

    useEffect(() => {
        if (isOpen) {
            if (initialReview) {
                setRating(initialReview.rating || 0);
                setTitle(initialReview.title || '');
                setComment(initialReview.comment || '');
            } else {
                setRating(0);
                setTitle('');
                setComment('');
            }
            setShowDeleteConfirm(false);
            setClientError(null);
            setSubmitting(false);
            setDeleting(false);
        }
    }, [isOpen, initialReview]);

    if (!isOpen) return null;

    const trimmedComment = comment.trim();
    const trimmedTitle = title.trim();

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        setClientError(null);

        if (!rating || rating < 1 || rating > 5) {
            setClientError("Please select a star rating between 1 and 5");
            return;
        }

        if (trimmedComment.length < 5) {
            setClientError("Review comment must be at least 5 characters");
            return;
        }

        if (trimmedComment.length > 1000) {
            setClientError("Review comment cannot exceed 1000 characters");
            return;
        }

        if (trimmedTitle.length > 100) {
            setClientError("Review title cannot exceed 100 characters");
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit({
                rating,
                title: trimmedTitle,
                comment: trimmedComment
            });
            onClose();
        } catch (err) {
            setClientError(err?.response?.data?.message || err?.message || "Failed to submit review");
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!initialReview?._id || !onDelete) return;
        setDeleting(true);
        setClientError(null);
        try {
            await onDelete(initialReview._id);
            onClose();
        } catch (err) {
            setClientError(err?.response?.data?.message || err?.message || "Failed to delete review");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-modal-title"
        >
            <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                    <h3 id="review-modal-title" className="text-lg font-semibold text-gray-800">
                        {isEditMode ? "Edit Your Review" : "Write a Product Review"}
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting || deleting}
                        aria-label="Close review modal"
                        className="text-gray-400 hover:text-gray-600 cursor-pointer text-2xl leading-none disabled:opacity-50"
                    >
                        &times;
                    </button>
                </div>

                {/* Product Context Card */}
                {productName && (
                    <div className="flex items-center gap-3 my-4 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <img
                            src={productImage || assets.box_icon}
                            alt=""
                            className="w-12 h-12 object-cover rounded border border-gray-200 bg-white"
                        />
                        <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-semibold text-gray-800 truncate">{productName}</h4>
                            <p className="text-[11px] text-gray-500 mt-0.5">Verified Purchase</p>
                        </div>
                    </div>
                )}

                {/* Moderation Policy Notice */}
                <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-lg p-3 my-3 text-xs text-emerald-800 leading-relaxed">
                    <p className="font-medium flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Seller Moderation Notice</span>
                    </p>
                    <p className="mt-1 text-emerald-700">
                        {isEditMode
                            ? "Editing your review will return it to Pending moderation until reviewed by the seller."
                            : "Your review will be verified and approved by our team before appearing publicly on the product page."}
                    </p>
                </div>

                {/* Inline Error */}
                {clientError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg mb-4 flex items-center gap-2">
                        <span className="font-bold">!</span>
                        <span>{clientError}</span>
                    </div>
                )}

                {/* Delete Confirmation Card (Edit mode only) */}
                {showDeleteConfirm ? (
                    <div className="border border-red-200 bg-red-50/50 rounded-lg p-4 my-4">
                        <h4 className="text-sm font-semibold text-red-800 mb-1">Delete this review?</h4>
                        <p className="text-xs text-gray-600 mb-4">
                            Are you sure you want to permanently delete your review? This action cannot be undone.
                        </p>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-3.5 py-1.5 border border-gray-300 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-100 transition cursor-pointer"
                            >
                                Keep Review
                            </button>
                            <button
                                type="button"
                                disabled={deleting}
                                onClick={handleDelete}
                                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full text-xs font-medium transition cursor-pointer disabled:opacity-50"
                            >
                                {deleting ? "Deleting..." : "Confirm Delete"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleFormSubmit} className="space-y-4">
                        {/* 1. Star Rating Selection */}
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                Overall Rating <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-3">
                                <StarRating
                                    rating={rating}
                                    interactive={true}
                                    onRatingChange={(newVal) => {
                                        setRating(newVal);
                                        if (clientError) setClientError(null);
                                    }}
                                    size="lg"
                                    disabled={submitting || deleting}
                                />
                                <span className="text-xs font-semibold text-gray-600">
                                    {rating === 1 && "Poor (1/5)"}
                                    {rating === 2 && "Fair (2/5)"}
                                    {rating === 3 && "Average (3/5)"}
                                    {rating === 4 && "Good (4/5)"}
                                    {rating === 5 && "Excellent (5/5)"}
                                    {!rating && <span className="text-gray-400 font-normal">Select 1 to 5 stars</span>}
                                </span>
                            </div>
                        </div>

                        {/* 2. Review Title (Optional) */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-gray-700">
                                    Review Headline <span className="text-gray-400 font-normal">(Optional)</span>
                                </label>
                                <span className="text-[11px] text-gray-400">{title.length}/100</span>
                            </div>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                                placeholder="e.g. Delicious and super fresh mangoes!"
                                maxLength={100}
                                disabled={submitting || deleting}
                                className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:bg-gray-100"
                            />
                        </div>

                        {/* 3. Review Comment (Required) */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-medium text-gray-700">
                                    Written Review <span className="text-red-500">*</span>
                                </label>
                                <span className="text-[11px] text-gray-400">{comment.length}/1000</span>
                            </div>
                            <textarea
                                value={comment}
                                onChange={(e) => {
                                    setComment(e.target.value.slice(0, 1000));
                                    if (clientError) setClientError(null);
                                }}
                                placeholder="Share details about product quality, taste, freshness, or packaging (minimum 5 characters)..."
                                rows={4}
                                maxLength={1000}
                                disabled={submitting || deleting}
                                className="w-full text-sm p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none disabled:bg-gray-100"
                            />
                            <p className="text-[11px] text-gray-400 mt-0.5">
                                Minimum 5 characters required
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                            {isEditMode ? (
                                <button
                                    type="button"
                                    onClick={() => setShowDeleteConfirm(true)}
                                    disabled={submitting || deleting}
                                    className="text-xs font-medium text-red-600 hover:text-red-700 underline cursor-pointer disabled:opacity-50"
                                >
                                    Delete Review
                                </button>
                            ) : (
                                <div />
                            )}

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    disabled={submitting || deleting}
                                    className="px-4 py-2 border border-gray-300 text-gray-600 rounded-full text-sm font-medium hover:bg-gray-100 transition cursor-pointer disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || deleting}
                                    className="px-6 py-2 bg-primary hover:bg-primary-dull text-white rounded-full text-sm font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {submitting && (
                                        <svg className="animate-spin w-4 h-4 text-white" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                    )}
                                    <span>
                                        {submitting
                                            ? isEditMode ? "Saving..." : "Submitting..."
                                            : isEditMode ? "Save Changes" : "Submit Review"}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default ReviewModal;
