import React, { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import StarRating from '../../components/StarRating';
import { assets } from '../../assets/assets';
import toast from 'react-hot-toast';
import {
  Star,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  AlertTriangle
} from '../../components/seller/SellerIcons';

const STATUS_TABS = [
  { id: '', label: 'All Reviews' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

const MAX_NOTE_LENGTH = 500;

const Reviews = () => {
  const { currency, axios } = useAppContext();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter & Pagination State
  const [activeStatus, setActiveStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // Moderation Modal State
  const [modalData, setModalData] = useState(null); // { review, targetStatus, note }
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch reviews based on activeStatus and page
  const fetchReviews = useCallback(async (statusFilter = activeStatus, pageNum = page) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pageNum,
        limit: 20,
      };
      if (statusFilter) {
        params.status = statusFilter;
      }

      const { data } = await axios.get('/api/review/seller', { params });

      if (data.success) {
        setReviews(data.reviews || []);
        const newPagination = data.pagination || {
          page: pageNum,
          limit: 20,
          total: (data.reviews || []).length,
          totalPages: 1,
        };
        setPagination(newPagination);

        // Self-heal: If current page > totalPages and totalPages > 0, navigate back
        if (pageNum > newPagination.totalPages && newPagination.totalPages > 0) {
          setPage(newPagination.totalPages);
        }
      } else {
        setError(data.message || 'Failed to load reviews');
        toast.error(data.message || 'Failed to load reviews');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Error loading reviews';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  }, [axios, activeStatus, page]);

  useEffect(() => {
    fetchReviews(activeStatus, page);
  }, [fetchReviews, activeStatus, page]);

  // Tab switch handler: resets to page 1
  const handleTabChange = (status) => {
    if (activeStatus === status) return;
    setActiveStatus(status);
    setPage(1);
  };

  // Open moderation confirmation modal
  const openModerationModal = (review, targetStatus) => {
    setModalData({
      review,
      targetStatus,
      note: review.moderationNote || '',
    });
  };

  // Close modal
  const closeModal = () => {
    if (isSubmitting) return;
    setModalData(null);
  };

  // Confirm moderation action
  const handleConfirmModeration = async () => {
    if (!modalData || !modalData.review || !modalData.targetStatus) return;

    const { review, targetStatus, note } = modalData;
    setIsSubmitting(true);

    try {
      const payload = {
        status: targetStatus,
        moderationNote: note.trim().slice(0, MAX_NOTE_LENGTH),
      };

      const { data } = await axios.patch(
        `/api/review/seller/${review._id}/moderation`,
        payload
      );

      if (data.success) {
        toast.success(data.message || `Review ${targetStatus} successfully`);
        closeModal();

        // Refresh list to update counts, statuses, and product ratings
        fetchReviews(activeStatus, page);
      } else {
        toast.error(data.message || 'Moderation update failed');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to moderate review';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
            Rejected
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Pending Moderation
          </span>
        );
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="no-scrollbar flex-1 h-[95vh] overflow-y-scroll flex flex-col justify-between">
      <div className="flex-1 py-6">
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
                <Star className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Review Moderation</h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Moderate customer feedback, approve ratings for store display, or filter inappropriate content.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => fetchReviews(activeStatus, page)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-300 shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Status Filter Tabs Card */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {STATUS_TABS.map((tab) => {
                const isActive = activeStatus === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="text-xs text-slate-500">
              Total in this view: <span className="font-bold text-slate-900">{pagination.total}</span>
            </div>
          </div>

          {/* Content Area */}
          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-xs">
              <div className="flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-medium text-slate-600">Loading reviews...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
              <p className="text-sm font-medium text-rose-600">{error}</p>
              <button
                type="button"
                onClick={() => fetchReviews(activeStatus, page)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : reviews.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center shadow-xs">
              <div className="flex flex-col items-center justify-center gap-3 max-w-sm mx-auto">
                <div className="p-3 bg-slate-100 text-slate-400 rounded-full">
                  <Star className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {activeStatus === 'pending'
                    ? 'No Pending Reviews'
                    : activeStatus === 'approved'
                    ? 'No Approved Reviews'
                    : activeStatus === 'rejected'
                    ? 'No Rejected Reviews'
                    : 'No Reviews Found'}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {activeStatus === 'pending'
                    ? 'All customer submissions have been moderated.'
                    : 'There are currently no reviews in this view.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => {
                const product = review.productId || {};
                const customerName = review.customerId?.name || 'Customer';
                const productImage = product.image?.[0] || assets.upload_area;

                return (
                  <div
                    key={review._id}
                    className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs transition hover:shadow-sm"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                      {/* Left: Product & Customer & Review Details */}
                      <div className="space-y-3 flex-1">
                        {/* Product Header */}
                        <div className="flex items-center gap-3.5">
                          <img
                            src={productImage}
                            alt={product.name || 'Product'}
                            className="w-12 h-12 object-cover rounded-xl border border-slate-200 shrink-0 bg-slate-50 p-0.5"
                          />
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 line-clamp-1">
                              {product.name || 'Unnamed Product'}
                            </h4>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                              {product.price !== undefined && (
                                <span className="font-semibold text-slate-900">
                                  {currency}{product.price}
                                </span>
                              )}
                              <span>•</span>
                              <span>By <span className="font-medium text-slate-800">{customerName}</span></span>
                              {review.isVerifiedPurchase && (
                                <>
                                  <span>•</span>
                                  <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    Verified Purchase
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Rating & Timestamp */}
                        <div className="flex items-center gap-3 pt-1">
                          <StarRating rating={review.rating} size="sm" />
                          <span className="text-xs text-slate-400">
                            {formatDate(review.createdAt)}
                          </span>
                          {getStatusBadge(review.moderationStatus)}
                        </div>

                        {/* Review Title & Comment */}
                        <div className="text-xs sm:text-sm text-slate-800 space-y-1">
                          {review.title && (
                            <h5 className="font-bold text-slate-900">{review.title}</h5>
                          )}
                          <p className="text-slate-600 whitespace-pre-line leading-relaxed">
                            {review.comment}
                          </p>
                        </div>

                        {/* Moderation Details */}
                        {(review.moderationStatus !== 'pending' || review.moderationNote) && (
                          <div className="mt-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-slate-700">Moderation Record:</span>
                              <span>Status: <strong className="capitalize text-slate-800">{review.moderationStatus}</strong></span>
                              {review.moderatedAt && (
                                <>
                                  <span>•</span>
                                  <span>{formatDate(review.moderatedAt)}</span>
                                </>
                              )}
                              {review.moderatedBy && (
                                <>
                                  <span>•</span>
                                  <span>By {review.moderatedBy}</span>
                                </>
                              )}
                            </div>
                            {review.moderationNote && (
                              <p className="text-slate-600 italic">
                                <span className="font-semibold not-italic text-slate-700">Internal Note: </span>
                                "{review.moderationNote}"
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Moderation Action Buttons */}
                      <div className="flex lg:flex-col items-center gap-2 lg:min-w-[130px] shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                        {review.moderationStatus === 'pending' && (
                          <>
                            <button
                              type="button"
                              onClick={() => openModerationModal(review, 'approved')}
                              className="w-full px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openModerationModal(review, 'rejected')}
                              className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>
                          </>
                        )}

                        {review.moderationStatus === 'approved' && (
                          <button
                            type="button"
                            onClick={() => openModerationModal(review, 'rejected')}
                            className="w-full px-3.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Revoke / Reject</span>
                          </button>
                        )}

                        {review.moderationStatus === 'rejected' && (
                          <button
                            type="button"
                            onClick={() => openModerationModal(review, 'approved')}
                            className="w-full px-3.5 py-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {!loading && reviews.length > 0 && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <span className="text-xs text-slate-600">
                Page <span className="font-bold text-slate-900">{pagination.page}</span> of{' '}
                <span className="font-bold text-slate-900">{pagination.totalPages}</span>
              </span>
              <button
                type="button"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}
                className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Moderation Confirmation Modal */}
      {modalData && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !isSubmitting) {
              closeModal();
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
        >
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${modalData.targetStatus === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  {modalData.targetStatus === 'approved' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {modalData.targetStatus === 'approved' ? 'Approve Customer Review' : 'Reject Customer Review'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Review Snippet Summary */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-600">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">
                  {modalData.review?.productId?.name || 'Product'}
                </span>
                <StarRating rating={modalData.review?.rating || 0} size="sm" />
              </div>
              <p className="text-slate-700 italic line-clamp-2">
                "{modalData.review?.comment}"
              </p>
              <div className="text-slate-500">
                Reviewer: <span className="font-semibold text-slate-800">{modalData.review?.customerId?.name || 'Customer'}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {modalData.targetStatus === 'approved'
                ? 'Approving this review makes it publicly visible to shoppers and recalculates the average star rating immediately.'
                : 'Rejecting this review hides it from the product catalog and excludes its score from customer-facing analytics.'}
            </p>

            {/* Internal Moderation Note Field */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700">
                  Internal Moderation Note (Optional)
                </label>
                <span className="text-[11px] text-slate-400">
                  {modalData.note.length} / {MAX_NOTE_LENGTH}
                </span>
              </div>
              <textarea
                value={modalData.note}
                onChange={(e) =>
                  setModalData((prev) => ({
                    ...prev,
                    note: e.target.value.slice(0, MAX_NOTE_LENGTH),
                  }))
                }
                maxLength={MAX_NOTE_LENGTH}
                rows={3}
                placeholder="Enter internal moderation reason or rationale (visible only to admin)..."
                disabled={isSubmitting}
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 disabled:bg-slate-100 transition text-slate-800"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={isSubmitting}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmModeration}
                disabled={isSubmitting}
                className={`px-5 py-2 text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs ${
                  modalData.targetStatus === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Processing...</span>
                  </>
                ) : modalData.targetStatus === 'approved' ? (
                  <span>Confirm Approval</span>
                ) : (
                  <span>Confirm Rejection</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reviews;
