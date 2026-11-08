import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { assets } from '../assets/assets';
import toast from 'react-hot-toast';
import ReturnRequestModal from '../components/ReturnRequestModal';

const ORDER_STAGES = [
    "Order Placed",
    "Packing",
    "Shipped",
    "Out for Delivery",
    "Delivered"
];

const MyOrders = ({ defaultTab = "orders" }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState(tabFromUrl || defaultTab || "orders");

    const [myOrders, setMyOrders] = useState([]);
    const [myReturns, setMyReturns] = useState([]);
    const [policy, setPolicy] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Return Modal State
    const [returnModalOpen, setReturnModalOpen] = useState(false);
    const [selectedOrderForReturn, setSelectedOrderForReturn] = useState(null);
    const [selectedProductForReturn, setSelectedProductForReturn] = useState(null);

    const { currency, axios, user, navigate } = useAppContext();

    const fetchOrdersAndReturns = async () => {
        setLoading(true);
        setError(null);
        try {
            const [ordersRes, returnsRes, policyRes] = await Promise.allSettled([
                axios.get('/api/order/user'),
                axios.get('/api/returns/my-returns'),
                axios.get('/api/returns/policy')
            ]);

            if (ordersRes.status === 'fulfilled' && ordersRes.value.data.success) {
                setMyOrders(ordersRes.value.data.orders || []);
            } else if (ordersRes.status === 'fulfilled') {
                setError(ordersRes.value.data.message || "Failed to load orders");
            }

            if (returnsRes.status === 'fulfilled' && returnsRes.value.data.success) {
                setMyReturns(returnsRes.value.data.returns || []);
            }

            if (policyRes.status === 'fulfilled' && policyRes.value.data.success) {
                setPolicy(policyRes.value.data.policy);
            }
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || "Failed to load account data";
            setError(errMsg);
            toast.error(errMsg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            fetchOrdersAndReturns();
        } else {
            setMyOrders([]);
            setMyReturns([]);
            setLoading(false);
        }
    }, [user, axios]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setSearchParams(tab === 'returns' ? { tab: 'returns' } : {});
    };

    const returnWindowDays = policy?.returnWindowDays || 7;

    const isOrderWithinReturnWindow = (order) => {
        if (!order || order.status !== 'Delivered') return false;
        const deliveryTime = new Date(order.updatedAt || order.createdAt).getTime();
        const daysElapsed = (Date.now() - deliveryTime) / (1000 * 60 * 60 * 24);
        return daysElapsed <= returnWindowDays;
    };

    const getExistingReturnForItem = (orderId, productId) => {
        if (!orderId || !productId || !Array.isArray(myReturns)) return null;
        return myReturns.find(r => {
            if (String(r.orderId) !== String(orderId)) return false;
            return (r.items || []).some(it => String(it.productId) === String(productId));
        });
    };

    const handleOpenReturnModal = (order, productObj) => {
        setSelectedOrderForReturn(order);
        setSelectedProductForReturn(productObj);
        setReturnModalOpen(true);
    };

    const handleCancelReturn = async (returnId) => {
        if (!window.confirm("Are you sure you want to cancel this return request?")) return;
        try {
            const { data } = await axios.post(`/api/returns/${returnId}/cancel`);
            if (data.success) {
                toast.success("Return request cancelled");
                fetchOrdersAndReturns();
            } else {
                toast.error(data.message || "Failed to cancel return request");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || "Failed to cancel return");
        }
    };

    const renderTimeline = (status) => {
        if (status === "Cancelled") {
            return (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 my-4 flex items-center justify-between text-red-700 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block animate-pulse"></span>
                        <span className="font-semibold">Order Cancelled</span>
                    </div>
                    <span className="text-xs text-red-600 font-medium">This order has been cancelled</span>
                </div>
            );
        }

        const currentStageIndex = ORDER_STAGES.indexOf(status);

        if (currentStageIndex === -1) {
            return (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 my-4 text-xs text-gray-700 font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary inline-block"></span>
                    <span>Status: <strong className="text-gray-900">{status || "Order Placed"}</strong></span>
                </div>
            );
        }

        return (
            <div className="my-5 px-1 sm:px-4">
                <div className="relative flex items-center justify-between">
                    {ORDER_STAGES.map((stage, idx) => {
                        const isCompleted = idx < currentStageIndex;
                        const isCurrent = idx === currentStageIndex;

                        return (
                            <React.Fragment key={stage}>
                                <div className="flex flex-col items-center relative z-10">
                                    <div
                                        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                                            isCompleted
                                                ? "bg-primary text-white"
                                                : isCurrent
                                                ? "bg-white border-2 border-primary text-primary shadow-xs"
                                                : "bg-gray-100 border border-gray-300 text-gray-400"
                                        }`}
                                    >
                                        {isCompleted ? (
                                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <span>{idx + 1}</span>
                                        )}
                                    </div>
                                    <span
                                        className={`mt-2 text-[10px] sm:text-xs text-center max-w-[64px] sm:max-w-[76px] leading-tight ${
                                            isCurrent
                                                ? "font-semibold text-primary"
                                                : isCompleted
                                                ? "font-medium text-gray-800"
                                                : "text-gray-400"
                                        }`}
                                    >
                                        {stage}
                                    </span>
                                </div>

                                {idx < ORDER_STAGES.length - 1 && (
                                    <div
                                        className={`flex-1 h-0.5 sm:h-1 mx-1 sm:mx-2 -mt-5 transition-all ${
                                            idx < currentStageIndex ? "bg-primary" : "bg-gray-200"
                                        }`}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderReturnStatusBadge = (status) => {
        const config = {
            'Pending': { bg: 'bg-amber-100 text-amber-800 border-amber-300', label: 'Return Pending' },
            'Approved': { bg: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Return Approved' },
            'Item Received': { bg: 'bg-indigo-100 text-indigo-800 border-indigo-300', label: 'Item Received' },
            'Refund Processing': { bg: 'bg-purple-100 text-purple-800 border-purple-300', label: 'Refund Processing' },
            'Completed': { bg: 'bg-emerald-100 text-emerald-800 border-emerald-300', label: 'Refund Completed' },
            'Rejected': { bg: 'bg-rose-100 text-rose-800 border-rose-300', label: 'Return Rejected' },
            'Cancelled': { bg: 'bg-gray-100 text-gray-600 border-gray-300', label: 'Return Cancelled' }
        }[status] || { bg: 'bg-gray-100 text-gray-700 border-gray-200', label: status };

        return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg}`}>
                {config.label}
            </span>
        );
    };

    return (
        <div className="mt-16 pb-16 max-w-5xl">
            {/* Page Header & Navigation Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold uppercase text-gray-900 tracking-tight">Order Center</h1>
                    <div className="w-16 h-0.5 bg-primary rounded-full mt-1" />
                </div>

                {/* Tabs Switcher */}
                <div className="inline-flex p-1 bg-gray-100 rounded-2xl border border-gray-200 self-start sm:self-auto">
                    <button
                        type="button"
                        onClick={() => handleTabChange('orders')}
                        className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                            activeTab === 'orders'
                                ? 'bg-white text-gray-900 shadow-xs'
                                : 'text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        My Orders ({myOrders.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => handleTabChange('returns')}
                        className={`px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                            activeTab === 'returns'
                                ? 'bg-white text-gray-900 shadow-xs'
                                : 'text-gray-500 hover:text-gray-800'
                        }`}
                    >
                        <span>Returns & Refunds</span>
                        {myReturns.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-[10px] font-bold">
                                {myReturns.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* Quick Policy Banner */}
            <div className="mb-6 p-3 px-4 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>
                        Eligible items can be returned within <strong>{returnWindowDays} days</strong> of delivery.
                    </span>
                </div>
                <Link to="/return-policy" className="text-primary hover:underline font-semibold ml-2 shrink-0">
                    Read Policy
                </Link>
            </div>

            {loading ? (
                <div className="space-y-6">
                    {[1, 2].map((n) => (
                        <div key={n} className="border border-gray-200 rounded-2xl p-6 bg-white animate-pulse">
                            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
                            <div className="h-16 bg-gray-100 rounded mb-4" />
                            <div className="h-4 bg-gray-200 rounded w-1/4" />
                        </div>
                    ))}
                </div>
            ) : error ? (
                <div className="border border-red-200 bg-red-50 p-6 rounded-2xl text-red-700">
                    <p className="font-medium mb-1">Unable to load data</p>
                    <p className="text-sm text-red-600 mb-4">{error}</p>
                    <button
                        onClick={() => fetchOrdersAndReturns()}
                        className="px-4 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition cursor-pointer"
                    >
                        Try Again
                    </button>
                </div>
            ) : activeTab === 'returns' ? (
                /* ========================================================================= */
                /* RETURNS & REFUNDS TAB */
                /* ========================================================================= */
                myReturns.length === 0 ? (
                    <div className="text-center py-16 px-4 border border-dashed border-gray-300 rounded-3xl bg-white max-w-xl mx-auto my-8">
                        <div className="w-16 h-16 rounded-full bg-emerald-50 text-primary flex items-center justify-center mx-auto mb-3">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-1">No Return Requests Found</h3>
                        <p className="text-gray-500 text-xs sm:text-sm mb-6 max-w-sm mx-auto">
                            If you ever receive an item that is damaged or incorrect, you can request a return directly from your delivered orders list.
                        </p>
                        <button
                            type="button"
                            onClick={() => handleTabChange('orders')}
                            className="px-6 py-2.5 bg-primary text-white text-xs sm:text-sm font-semibold rounded-full hover:bg-primary-dull transition cursor-pointer"
                        >
                            View Delivered Orders
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {myReturns.map((ret) => {
                            const isPending = ret.status === 'Pending';
                            const isRejected = ret.status === 'Rejected';
                            const isCompleted = ret.status === 'Completed';

                            return (
                                <div key={ret._id} className="border border-gray-200 rounded-3xl overflow-hidden bg-white shadow-xs">
                                    {/* Return Card Header */}
                                    <div className="bg-slate-50 p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-sm font-bold text-gray-900">
                                                    #{ret.returnNumber}
                                                </span>
                                                {renderReturnStatusBadge(ret.status)}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-1">
                                                For Order <strong>#{ret.orderNumber}</strong> • Submitted on {ret.createdAtFormatted || new Date(ret.createdAt).toLocaleDateString()}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-4 text-xs sm:text-sm">
                                            <div>
                                                <span className="text-gray-500">Refund Value: </span>
                                                <span className="font-bold text-primary text-base">
                                                    {currency}{ret.totalRefundAmount?.toLocaleString()}
                                                </span>
                                            </div>

                                            {isPending && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleCancelReturn(ret._id)}
                                                    className="px-3 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold transition cursor-pointer"
                                                >
                                                    Cancel Request
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Items List */}
                                    <div className="p-4 divide-y divide-gray-100">
                                        {(ret.items || []).map((it, idx) => (
                                            <div key={idx} className="py-3 flex items-start gap-4">
                                                <div className="w-14 h-14 bg-gray-100 rounded-xl overflow-hidden shrink-0 border border-gray-200 flex items-center justify-center">
                                                    {it.image ? (
                                                        <img src={it.image} alt={it.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <img src={assets.box_icon} alt="Box" className="w-8 h-8 opacity-40" />
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold text-gray-900 text-sm">{it.name}</h4>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        Quantity: <strong>{it.quantity}</strong> • Reason: <span className="text-gray-700 italic">{it.reason}</span>
                                                    </p>
                                                </div>
                                                <div className="text-right text-sm">
                                                    <p className="font-bold text-gray-800">{currency}{it.totalPrice?.toLocaleString()}</p>
                                                    <p className="text-[11px] text-gray-400">{currency}{it.unitPrice} each</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Rejection Notice */}
                                    {isRejected && (
                                        <div className="mx-4 mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                                            <strong>Rejection Reason:</strong> {ret.rejectionReason || "Item condition did not meet return guidelines."}
                                        </div>
                                    )}

                                    {/* Refund Settlement Details */}
                                    {isCompleted && ret.refundId && (
                                        <div className="mx-4 mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                            <div>
                                                <span className="font-bold">Refund Settled: </span>
                                                <span>Refund #{ret.refundId?.refundNumber || ret.refundId} via {ret.refundId?.refundMethod || 'Original Payment'}</span>
                                            </div>
                                            <span className="font-extrabold text-primary text-sm">
                                                {currency}{ret.refundId?.amount?.toLocaleString() || ret.totalRefundAmount?.toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    {/* Pickup Info Footer */}
                                    <div className="bg-gray-50/70 p-3 px-4 border-t border-gray-100 text-[11px] text-gray-500 flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                                        <span>Collection Method: <strong>{ret.returnMethod || 'Pickup'}</strong></span>
                                        <span>Address: {ret.pickupAddress?.street ? `${ret.pickupAddress.street}, ${ret.pickupAddress.city}` : 'Default Customer Address'}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            ) : (
                /* ========================================================================= */
                /* ORDERS TAB */
                /* ========================================================================= */
                myOrders.length === 0 ? (
                    <div className="text-center py-16 px-4 border border-dashed border-gray-300 rounded-3xl bg-white max-w-xl mx-auto my-8">
                        <img src={assets.box_icon} alt="Empty Orders" className="w-16 h-16 mx-auto mb-4 opacity-40" />
                        <h3 className="text-lg font-bold text-gray-800 mb-1">You have not placed any orders yet</h3>
                        <p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
                            When you place an order, its details, tracking, and return options will appear here.
                        </p>
                        <button
                            onClick={() => navigate('/products')}
                            className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-full hover:bg-primary-dull transition cursor-pointer"
                        >
                            Start Shopping
                        </button>
                    </div>
                ) : (
                    myOrders.map((order, index) => {
                        const canReturnOrder = isOrderWithinReturnWindow(order);

                        return (
                            <div key={order._id || index} className="border border-gray-300 rounded-3xl mb-10 overflow-hidden bg-white shadow-xs">
                                {/* Order Header */}
                                <div className="bg-gray-50 p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-sm text-gray-600">
                                    <div>
                                        <p className="font-semibold text-gray-800">
                                            <span className="text-gray-500 font-normal">Order #</span> {order.orderNumber || order._id}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Placed on {new Date(order.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm">
                                        <div>
                                            <span className="text-gray-500">Payment: </span>
                                            <span className="font-medium text-gray-800">{order.paymentType}</span>
                                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${order.isPaid ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                                                {order.isPaid ? "Paid" : "Pending"}
                                            </span>
                                        </div>
                                        {order.coupon && order.coupon.discountAmount > 0 && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                Coupon: {order.coupon.code} (-{currency}{order.coupon.discountAmount})
                                            </span>
                                        )}
                                        <div className="border-l border-gray-300 pl-4 flex items-center gap-3">
                                            <div>
                                                <span className="text-gray-500">Total: </span>
                                                <span className="font-semibold text-primary text-base">{currency}{order.amount}</span>
                                            </div>
                                            {order._id && (
                                                <button
                                                    type="button"
                                                    onClick={() => navigate(`/order/invoice/${order._id}`)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg text-xs font-medium shadow-2xs transition cursor-pointer"
                                                    title="View and print official order invoice"
                                                >
                                                    <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <span>View Invoice</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Order Status Stepper Timeline */}
                                <div className="p-4 pt-3 pb-2 border-b border-gray-200 bg-white">
                                    {renderTimeline(order.status)}
                                </div>

                                {/* Ordered Items List */}
                                <div className="divide-y divide-gray-200">
                                    {order.items.map((item, itemIndex) => {
                                        const productObj = item.product && typeof item.product === 'object' ? item.product : null;
                                        const productId = productObj?._id || (typeof item.product === 'string' ? item.product : null);
                                        const productCategory = (productObj?.category || 'item').toLowerCase();
                                        const itemPrice = typeof item.unitPrice === 'number' && Number.isFinite(item.unitPrice)
                                            ? item.unitPrice
                                            : (typeof productObj?.offerPrice === 'number' && productObj.offerPrice > 0 && productObj?.price && productObj.offerPrice < productObj.price
                                                ? productObj.offerPrice
                                                : (productObj?.price || productObj?.offerPrice || 0));

                                        const existingReturn = getExistingReturnForItem(order._id, productId);

                                        return (
                                            <div
                                                key={itemIndex}
                                                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-primary/10 p-3 rounded-2xl flex-shrink-0">
                                                        <img
                                                            src={productObj?.image?.[0] || assets.box_icon}
                                                            alt={productObj?.name || "Product"}
                                                            className="w-14 h-14 object-cover rounded-xl"
                                                        />
                                                    </div>
                                                    <div>
                                                        <h2 className="text-base font-semibold text-gray-800">
                                                            {productObj?.name || item.name || "Product"}
                                                        </h2>
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            Category: {productObj?.category || "N/A"} • Unit Price: {currency}{itemPrice}
                                                        </p>

                                                        {/* Actions & Return Badges */}
                                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                                            {order.status === "Delivered" && productId && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        navigate(`/products/${productCategory}/${productId}#write-review`);
                                                                    }}
                                                                    className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary-dull bg-primary/10 hover:bg-primary/15 border border-primary/20 px-3 py-1 rounded-full transition cursor-pointer"
                                                                >
                                                                    <svg className="w-3.5 h-3.5 fill-current text-primary" viewBox="0 0 20 20">
                                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                                    </svg>
                                                                    <span>Review Product</span>
                                                                </button>
                                                            )}

                                                            {/* Return Status or Return Request Action */}
                                                            {existingReturn ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleTabChange('returns')}
                                                                    className="cursor-pointer"
                                                                    title="Click to view return details"
                                                                >
                                                                    {renderReturnStatusBadge(existingReturn.status)}
                                                                </button>
                                                            ) : canReturnOrder ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenReturnModal(order, productObj || { _id: productId, name: item.name })}
                                                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full transition cursor-pointer"
                                                                >
                                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                                                    </svg>
                                                                    <span>Return Item</span>
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between md:justify-end gap-6 text-sm">
                                                    <p className="text-gray-600">
                                                        Qty: <span className="font-medium text-gray-900">{item.quantity || 1}</span>
                                                    </p>
                                                    <p className="text-primary font-medium text-base">
                                                        {currency}{itemPrice * (item.quantity || 1)}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Delivery Address */}
                                {order.address && (
                                    <div className="bg-gray-50/80 p-3 px-4 border-t border-gray-200 text-xs text-gray-600 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                        <p>
                                            <span className="font-medium text-gray-800">Delivery Address: </span>
                                            {order.address.firstName ? `${order.address.firstName} ${order.address.lastName}, ` : ''}
                                            {order.address.street}, {order.address.city}, {order.address.state} {order.address.zipcode}, {order.address.country}
                                        </p>
                                        {order.address.phone && (
                                            <p className="text-gray-500 shrink-0">
                                                <span className="font-medium text-gray-700">Phone: </span>{order.address.phone}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )
            )}

            {/* Return Request Modal */}
            <ReturnRequestModal
                isOpen={returnModalOpen}
                onClose={() => setReturnModalOpen(false)}
                order={selectedOrderForReturn}
                initialProduct={selectedProductForReturn}
                policy={policy}
                onSuccess={() => {
                    fetchOrdersAndReturns();
                    setActiveTab('returns');
                }}
                axios={axios}
                currency={currency}
            />
        </div>
    );
};

export default MyOrders;
