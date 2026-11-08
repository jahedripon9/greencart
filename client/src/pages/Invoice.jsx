import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { assets } from '../assets/assets';
import toast from 'react-hot-toast';

const Invoice = ({ orderId: propOrderId, initialOrder = null, onClose = null }) => {
    const { orderId: paramOrderId } = useParams();
    const orderId = propOrderId || paramOrderId;
    const { axios, currency, navigate, setShowUserLogin, isSeller } = useAppContext();

    const [order, setOrder] = useState(initialOrder);
    const [loading, setLoading] = useState(!initialOrder);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [error, setError] = useState(null); // { status, message }

    useEffect(() => {
        if (initialOrder) {
            setOrder(initialOrder);
        }
    }, [initialOrder]);

    useEffect(() => {
        let isMounted = true;

        const fetchOrderInvoice = async () => {
            if (!orderId) {
                if (isMounted) {
                    setError({ status: 400, message: "Invalid or missing order identifier." });
                    setLoading(false);
                }
                return;
            }

            if (!initialOrder) {
                setLoading(true);
            }
            setError(null);

            try {
                const { data } = await axios.get(`/api/order/${orderId}`);
                if (isMounted) {
                    if (data.success && data.order) {
                        setOrder(data.order);
                    } else {
                        setError({
                            status: 404,
                            message: data.message || "Invoice details could not be found."
                        });
                    }
                }
            } catch (err) {
                if (isMounted) {
                    const status = err.response?.status || 500;
                    let message = "A network or server error occurred. Please try again.";

                    if (status === 401) {
                        message = isSeller
                            ? "Seller session expired or you do not have permission to view this order."
                            : "You must be logged in to view this order invoice.";
                    } else if (status === 404) {
                        message = "Invoice not found or you do not have permission to view it.";
                    } else if (status === 400) {
                        message = "The provided order identifier is invalid.";
                    } else if (err.response?.data?.message) {
                        message = err.response.data.message;
                    }

                    setError({ status, message });
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchOrderInvoice();

        return () => {
            isMounted = false;
        };
    }, [orderId, axios, isSeller]);

    useEffect(() => {
        const handleBeforePrint = () => {
            document.body.classList.add('greencart-printing-invoice');
        };
        const handleAfterPrint = () => {
            document.body.classList.remove('greencart-printing-invoice');
        };

        window.addEventListener('beforeprint', handleBeforePrint);
        window.addEventListener('afterprint', handleAfterPrint);

        return () => {
            window.removeEventListener('beforeprint', handleBeforePrint);
            window.removeEventListener('afterprint', handleAfterPrint);
            document.body.classList.remove('greencart-printing-invoice');
        };
    }, []);

    const handlePrint = () => {
        document.body.classList.add('greencart-printing-invoice');
        window.print();
    };

    const handleDownloadPdf = async () => {
        if (!orderId) return;
        setDownloadingPdf(true);
        try {
            const response = await axios.get(`/api/order/${orderId}/pdf`, {
                responseType: 'blob'
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            const orderNum = order?.orderNumber || orderId;
            a.download = `GreenCart-Invoice-${orderNum}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
            toast.success("Invoice PDF downloaded successfully");
        } catch (err) {
            console.error("PDF download error:", err);
            toast.error("Failed to download PDF invoice. You can also use Print Invoice.");
        } finally {
            setDownloadingPdf(false);
        }
    };

    const handleBackOrClose = () => {
        if (typeof onClose === 'function') {
            onClose();
        } else {
            navigate('/my-orders');
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch {
            return dateString;
        }
    };

    // --- Loading State ---
    if (loading) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-gray-500 space-y-3">
                <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-base font-medium text-gray-700">Loading invoice...</p>
                <p className="text-xs text-gray-400">Retrieving official purchase record</p>
            </div>
        );
    }

    // --- Error State ---
    if (error || !order) {
        const status = error?.status;
        const message = error?.message || "Unable to display invoice.";

        return (
            <div className="max-w-xl mx-auto my-16 p-8 bg-white border border-gray-200 rounded-xl shadow-xs text-center space-y-4">
                <div className="w-12 h-12 mx-auto rounded-full bg-red-50 flex items-center justify-center text-red-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>

                <h2 className="text-lg font-semibold text-gray-900">
                    {status === 401
                        ? "Authentication Required"
                        : status === 404
                        ? "Invoice Not Found"
                        : status === 400
                        ? "Invalid Order Identifier"
                        : "Error Loading Invoice"}
                </h2>

                <p className="text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
                    {message}
                </p>

                <div className="pt-2 flex items-center justify-center gap-3 flex-wrap">
                    {status === 401 && !isSeller && (
                        <button
                            type="button"
                            onClick={() => setShowUserLogin?.(true)}
                            className="px-5 py-2 bg-primary hover:bg-primary-dull text-white text-sm font-medium rounded-lg transition cursor-pointer"
                        >
                            Log In to Account
                        </button>
                    )}
                    {typeof onClose === 'function' ? (
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition cursor-pointer"
                        >
                            Close
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => navigate('/my-orders')}
                            className="px-5 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition cursor-pointer"
                        >
                            Go to My Orders
                        </button>
                    )}
                    {status !== 401 && status !== 404 && status !== 400 && (
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="px-5 py-2 bg-primary hover:bg-primary-dull text-white text-sm font-medium rounded-lg transition cursor-pointer"
                        >
                            Retry
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // --- Order Data & Financial Calculations ---
    const items = Array.isArray(order.items) ? order.items : [];
    const address = order.address || {};

    // Customer Name and Address Formatting
    const customerFullName = [address.firstName, address.lastName].filter(Boolean).join(' ').trim() || 'Valued Customer';
    const addressLines = [
        address.street,
        [address.city, address.state, address.zipcode].filter(Boolean).join(', '),
        address.country
    ].filter(Boolean);

    // Snapshot integrity verification across all items
    const allItemsHaveSnapshot = items.length > 0 && items.every((item) => {
        return typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice) && item.unitPrice >= 0;
    });

    let calculatedSubtotal = 0;
    let derivedTax = null;

    if (allItemsHaveSnapshot) {
        calculatedSubtotal = items.reduce((sum, item) => sum + (item.unitPrice * (item.quantity || 1)), 0);
        const couponDiscount = (order.coupon && typeof order.coupon.discountAmount === 'number')
            ? order.coupon.discountAmount
            : 0;
        const discountedSub = Math.max(0, calculatedSubtotal - couponDiscount);
        const expectedTax = Math.floor(discountedSub * 0.02);
        // Verify against the authoritative order amount
        if (discountedSub + expectedTax === order.amount || calculatedSubtotal + Math.floor(calculatedSubtotal * 0.02) === order.amount) {
            derivedTax = expectedTax;
        }
    }

    const orderNumberDisplay = order.orderNumber || order._id;

    return (
        <div className="invoice-container py-8 max-w-4xl mx-auto px-4 sm:px-6">
            {/* Scoped Page-Local Print Styles for A4 Single-Page Output */}
            <style>{`
                @page {
                    size: A4 portrait;
                    margin: 10mm;
                }

                @media print {
                    /* Universal print resets */
                    *, *::before, *::after {
                        box-sizing: border-box !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    /* 1. Isolation: Hide EVERYTHING that does not contain .invoice-card */
                    body :not(:has(.invoice-card)):not(.invoice-card):not(.invoice-card *),
                    body.greencart-printing-invoice :not(:has(.invoice-card)):not(.invoice-card):not(.invoice-card *),
                    .customer-profile-modal,
                    .customer-profile-modal *,
                    .no-print,
                    .no-print *,
                    aside,
                    nav,
                    footer,
                    header,
                    button,
                    [role="status"],
                    [aria-live="polite"],
                    [role="dialog"]:not(:has(.invoice-card)) {
                        display: none !important;
                    }

                    /* 2. Reset all ancestor containers in the chain so they don't clip, scroll, or show backdrops/borders */
                    html, body, #root, #root > div, #root > div > div, main,
                    :has(> .invoice-container),
                    :has(> * > .invoice-container),
                    :has(> * > * > .invoice-container),
                    :has(> * > * > * > .invoice-container),
                    .invoice-container,
                    .invoice-modal-backdrop,
                    .invoice-modal-content {
                        display: block !important;
                        position: static !important;
                        background: #ffffff !important;
                        color: #111827 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        min-height: 0 !important;
                        height: auto !important;
                        max-height: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                        backdrop-filter: none !important;
                        -webkit-backdrop-filter: none !important;
                    }

                    .invoice-item-img {
                        width: 22px !important;
                        height: 22px !important;
                        object-fit: cover !important;
                        border-radius: 2px !important;
                    }

                    /* Page container reset */
                    .invoice-container {
                        padding: 0 !important;
                        margin: 0 !important;
                        max-width: 100% !important;
                        width: 100% !important;
                        background: transparent !important;
                        overflow: visible !important;
                    }

                    /* Printable invoice document sheet */
                    .invoice-card {
                        display: block !important;
                        background: #ffffff !important;
                        box-shadow: none !important;
                        border: 1px solid #d1d5db !important;
                        border-radius: 6px !important;
                        padding: 12px 16px !important;
                        margin: 0 auto !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }

                    /* Neutralize all Tailwind v4 space-y logical and physical margins inside invoice-card */
                    .invoice-card :where([class*="space-y-"] > :not(:last-child)),
                    :where(.invoice-card > :not(:last-child)) {
                        margin-block-start: 0 !important;
                        margin-block-end: 0 !important;
                        margin-top: 0 !important;
                        margin-bottom: 0 !important;
                    }

                    /* Header section */
                    .invoice-header {
                        display: flex !important;
                        flex-direction: row !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        padding-bottom: 6px !important;
                        margin-bottom: 8px !important;
                        border-bottom: 1px solid #e5e7eb !important;
                        gap: 8px !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    .invoice-logo {
                        height: 26px !important;
                        max-height: 26px !important;
                        width: auto !important;
                        object-fit: contain !important;
                    }
                    .invoice-header p {
                        font-size: 10px !important;
                        line-height: 1.25 !important;
                        color: #4b5563 !important;
                        margin: 1px 0 !important;
                    }
                    .invoice-header h1 {
                        font-size: 17px !important;
                        line-height: 1.2 !important;
                        color: #111827 !important;
                        margin: 0 0 1px 0 !important;
                        font-weight: 700 !important;
                    }

                    /* Metadata Grid (Billed To & Order Details) */
                    .invoice-grid {
                        display: grid !important;
                        grid-template-columns: 1fr 1fr !important;
                        gap: 8px !important;
                        margin-bottom: 8px !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    .invoice-customer-card,
                    .invoice-order-card {
                        padding: 6px 10px !important;
                        border: 1px solid #e5e7eb !important;
                        border-radius: 4px !important;
                        background-color: #f9fafb !important;
                    }
                    .invoice-customer-card h3,
                    .invoice-order-card h3 {
                        font-size: 9.5px !important;
                        font-weight: 600 !important;
                        text-transform: uppercase !important;
                        letter-spacing: 0.05em !important;
                        color: #4b5563 !important;
                        margin: 0 0 2px 0 !important;
                    }
                    .invoice-customer-name {
                        font-size: 12px !important;
                        font-weight: 600 !important;
                        color: #111827 !important;
                        margin: 0 0 2px 0 !important;
                    }
                    .invoice-customer-card p,
                    .invoice-customer-card div {
                        font-size: 10px !important;
                        line-height: 1.3 !important;
                        color: #374151 !important;
                        margin: 1px 0 !important;
                    }
                    .invoice-order-card > div.flex {
                        padding-top: 1.5px !important;
                        padding-bottom: 1.5px !important;
                        font-size: 10px !important;
                        line-height: 1.3 !important;
                        color: #374151 !important;
                    }

                    /* Itemized Table */
                    .invoice-table-wrapper {
                        overflow: visible !important;
                        margin-top: 0 !important;
                        margin-bottom: 8px !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    .invoice-table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                        border: 1px solid #e5e7eb !important;
                        font-size: 10px !important;
                    }
                    .invoice-table th {
                        padding: 3.5px 6px !important;
                        font-size: 9.5px !important;
                        background-color: #f3f4f6 !important;
                        color: #374151 !important;
                        font-weight: 600 !important;
                        border-bottom: 1px solid #d1d5db !important;
                        line-height: 1.25 !important;
                    }
                    .invoice-table td {
                        padding: 3.5px 6px !important;
                        font-size: 10px !important;
                        color: #1f2937 !important;
                        border-bottom: 1px solid #e5e7eb !important;
                        line-height: 1.25 !important;
                    }
                    .invoice-table-row {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }

                    /* Historical Price Disclaimer Footnote */
                    .invoice-footnote {
                        padding: 4px 6px !important;
                        font-size: 9px !important;
                        line-height: 1.2 !important;
                        border-radius: 4px !important;
                        margin-top: 4px !important;
                        margin-bottom: 6px !important;
                        background-color: #fef3c7 !important;
                        border: 1px solid #fde68a !important;
                        color: #92400e !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }

                    /* Financial Totals Breakdown */
                    .invoice-totals {
                        display: flex !important;
                        flex-direction: row !important;
                        justify-content: space-between !important;
                        align-items: flex-start !important;
                        padding-top: 6px !important;
                        margin-top: 0 !important;
                        margin-bottom: 6px !important;
                        border-top: 1px solid #e5e7eb !important;
                        gap: 12px !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    .invoice-notes {
                        max-width: 55% !important;
                        font-size: 9.5px !important;
                        line-height: 1.25 !important;
                        color: #4b5563 !important;
                    }
                    .invoice-notes p {
                        margin: 1px 0 !important;
                    }
                    .invoice-breakdown {
                        width: 210px !important;
                        font-size: 10px !important;
                    }
                    .invoice-breakdown > div {
                        margin-top: 1.5px !important;
                    }
                    .invoice-breakdown .total-row,
                    .invoice-total-row {
                        margin-top: 3px !important;
                        padding-top: 3px !important;
                        border-top: 1px solid #d1d5db !important;
                        font-size: 12.5px !important;
                        font-weight: 700 !important;
                        color: #111827 !important;
                    }

                    /* Document Footer */
                    .invoice-footer {
                        padding-top: 6px !important;
                        margin-top: 6px !important;
                        border-top: 1px solid #e5e7eb !important;
                        text-align: center !important;
                        font-size: 9px !important;
                        line-height: 1.25 !important;
                        color: #6b7280 !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                    .invoice-footer p {
                        margin: 0 !important;
                    }
                }
            `}</style>

            {/* Screen-Only Action Bar */}
            <div className="no-print mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <button
                    type="button"
                    onClick={handleBackOrClose}
                    className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition cursor-pointer"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>{typeof onClose === 'function' ? 'Close Invoice' : 'Back to My Orders'}</span>
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button
                        type="button"
                        onClick={handleDownloadPdf}
                        disabled={downloadingPdf}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 text-sm font-medium rounded-lg border border-gray-300 shadow-2xs transition cursor-pointer disabled:opacity-50"
                        title="Download official PDF copy"
                    >
                        <svg className={`w-4 h-4 text-gray-600 ${downloadingPdf ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span>{downloadingPdf ? 'Downloading PDF...' : 'Download PDF'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dull text-white text-sm font-medium rounded-lg shadow-xs transition cursor-pointer"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        <span>Print Invoice</span>
                    </button>
                </div>
            </div>

            {/* Invoice Printable Document Sheet */}
            <div className="invoice-card bg-white border border-gray-200 rounded-xl p-6 sm:p-10 shadow-sm space-y-8">
                {/* Header: Branding & Invoice Title */}
                <div className="invoice-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-gray-200">
                    <div className="space-y-1">
                        <img src={assets.logo} alt="GreenCart" className="invoice-logo h-9 object-contain" />
                        <p className="text-xs text-gray-500 font-medium">Fresh groceries & daily essentials</p>
                    </div>
                    <div className="sm:text-right space-y-1">
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">TAX INVOICE</h1>
                        <p className="text-xs text-gray-500 font-mono">Invoice #: <span className="font-semibold text-gray-800">{orderNumberDisplay}</span></p>
                        <p className="text-xs text-gray-500">Date: <span className="text-gray-700">{formatDate(order.createdAt)}</span></p>
                    </div>
                </div>

                {/* Metadata: Billed To & Order Details */}
                <div className="invoice-grid grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                    {/* Customer Information */}
                    <div className="invoice-customer-card bg-gray-50/60 p-4 rounded-lg border border-gray-150 space-y-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Billed & Delivered To</h3>
                        <p className="invoice-customer-name font-medium text-gray-900 text-base">{customerFullName}</p>
                        <div className="text-xs text-gray-600 leading-relaxed space-y-0.5">
                            {addressLines.map((line, idx) => (
                                <p key={idx}>{line}</p>
                            ))}
                        </div>
                        {address.phone && (
                            <p className="text-xs text-gray-600 pt-1">
                                <span className="font-medium text-gray-700">Phone: </span>{address.phone}
                            </p>
                        )}
                        {address.email && (
                            <p className="text-xs text-gray-600">
                                <span className="font-medium text-gray-700">Email: </span>{address.email}
                            </p>
                        )}
                    </div>

                    {/* Order & Payment Summary */}
                    <div className="invoice-order-card bg-gray-50/60 p-4 rounded-lg border border-gray-150 space-y-2.5">
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Order Information</h3>
                        <div className="flex justify-between text-xs py-0.5 border-b border-gray-200/60">
                            <span className="text-gray-500">Payment Method:</span>
                            <span className="font-medium text-gray-800">{order.paymentType || 'COD'}</span>
                        </div>
                        <div className="flex justify-between text-xs py-0.5 border-b border-gray-200/60">
                            <span className="text-gray-500">Payment Status:</span>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                                order.isPaid
                                    ? "bg-green-100 text-green-800"
                                    : "bg-amber-100 text-amber-800"
                            }`}>
                                {order.isPaid ? "Paid" : "Pending (Cash On Delivery)"}
                            </span>
                        </div>
                        <div className="flex justify-between text-xs py-0.5">
                            <span className="text-gray-500">Delivery Status:</span>
                            <span className="font-medium text-gray-800">{order.status || 'Order Placed'}</span>
                        </div>
                    </div>
                </div>

                {/* Itemized Table */}
                <div className="invoice-table-wrapper overflow-x-auto">
                    <table className="invoice-table w-full text-left text-sm border border-gray-200 rounded-lg overflow-hidden">
                        <thead className="bg-gray-100/80 text-gray-700 text-xs uppercase tracking-wider font-semibold border-b border-gray-200">
                            <tr>
                                <th className="py-3 px-4 w-12 text-center">#</th>
                                <th className="py-3 px-4">Item Description</th>
                                <th className="py-3 px-4 text-center w-20">Qty</th>
                                <th className="py-3 px-4 text-right w-28">Unit Price</th>
                                <th className="py-3 px-4 text-right w-28">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {items.map((item, index) => {
                                const hasPriceSnapshot = typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice) && item.unitPrice >= 0;
                                const hasNameSnapshot = Boolean(item.name && typeof item.name === 'string');
                                const itemName = hasNameSnapshot
                                    ? item.name
                                    : (item.product?.name ? item.product.name : 'Ordered Item');

                                const lineTotal = hasPriceSnapshot ? item.unitPrice * (item.quantity || 1) : null;

                                return (
                                    <tr key={item._id || index} className="invoice-table-row hover:bg-gray-50/50">
                                        <td className="py-3.5 px-4 text-center text-xs text-gray-400">
                                            {index + 1}
                                        </td>
                                        <td className="py-3 px-4 font-medium text-gray-900">
                                            <div className="flex items-center gap-3">
                                                <img
                                                    src={item.product?.image?.[0] || assets.box_icon}
                                                    alt={itemName}
                                                    className="invoice-item-img w-9 h-9 object-cover rounded-md border border-gray-200 shrink-0 bg-gray-50"
                                                />
                                                <div className="min-w-0">
                                                    <span>{itemName}</span>
                                                    {!hasNameSnapshot && item.product?.name && (
                                                        <span className="block text-[11px] text-gray-400 font-normal italic">
                                                            (Current catalog name fallback)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-center text-gray-700 font-medium">
                                            {item.quantity || 1}
                                        </td>
                                        <td className="py-3 px-4 text-right text-gray-700">
                                            {hasPriceSnapshot ? (
                                                <div>
                                                    <span>{currency}{item.unitPrice}</span>
                                                    {typeof item.product?.price === 'number' && item.product.price > item.unitPrice && (
                                                        <span className="block text-[10px] text-gray-400 line-through">
                                                            {currency}{item.product.price}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-xs italic" title="Historical price was not recorded">N/A*</span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right font-medium text-gray-900">
                                            {lineTotal !== null ? (
                                                `${currency}${lineTotal}`
                                            ) : (
                                                <span className="text-gray-400 text-xs italic">N/A*</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footnote for Legacy Orders lacking snapshot unit prices */}
                {!allItemsHaveSnapshot && (
                    <div className="invoice-footnote p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                        <p className="font-semibold">* Notice Regarding Historical Item Prices:</p>
                        <p>
                            Historical item unit prices were not captured for this order record. Current store catalog prices are never substituted as historical purchase prices. The authoritative final total charged is displayed below.
                        </p>
                    </div>
                )}

                {/* Financial Totals Breakdown */}
                <div className="invoice-totals flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t border-gray-200">
                    <div className="invoice-notes text-xs text-gray-500 space-y-1 max-w-sm">
                        <p className="font-semibold text-gray-700">Payment & Tax Notes:</p>
                        <p>All prices are in {currency}. This invoice reflects the authoritative order record stored in the GreenCart database.</p>
                    </div>

                    <div className="invoice-breakdown w-full sm:w-72 space-y-2 text-sm">
                        {allItemsHaveSnapshot && (
                            <div className="flex justify-between text-gray-600 text-xs">
                                <span>Items Subtotal:</span>
                                <span className="font-medium text-gray-800">{currency}{calculatedSubtotal}</span>
                            </div>
                        )}

                        {order.coupon && typeof order.coupon.discountAmount === 'number' && order.coupon.discountAmount > 0 && (
                            <div className="flex justify-between text-emerald-700 text-xs font-medium">
                                <span>Coupon Discount{order.coupon.code ? ` (${order.coupon.code})` : ''}:</span>
                                <span>-{currency}{order.coupon.discountAmount}</span>
                            </div>
                        )}

                        <div className="flex justify-between text-gray-600 text-xs">
                            <span>Delivery Charge:</span>
                            <span className="font-medium text-emerald-700">Free</span>
                        </div>

                        {derivedTax !== null && (
                            <div className="flex justify-between text-gray-600 text-xs">
                                <span>Tax (2%):</span>
                                <span className="font-medium text-gray-800">{currency}{derivedTax}</span>
                            </div>
                        )}

                        <div className="invoice-total-row total-row flex justify-between items-center pt-2 border-t border-gray-200 text-base font-bold text-gray-900">
                            <span>Total Amount:</span>
                            <span className="text-primary text-lg">{currency}{order.amount}</span>
                        </div>
                    </div>
                </div>

                {/* Document Footer */}
                <div className="invoice-footer pt-6 border-t border-gray-200 text-center text-xs text-gray-400 space-y-1">
                    <p className="font-medium text-gray-600">Thank you for shopping with GreenCart!</p>
                    <p>This is a computer-generated tax invoice and requires no physical signature.</p>
                </div>
            </div>
        </div>
    );
};

export default Invoice;
