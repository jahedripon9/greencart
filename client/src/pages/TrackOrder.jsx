import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { assets } from '../assets/assets';
import toast from 'react-hot-toast';

const ORDER_STAGES = [
    "Order Placed",
    "Packing",
    "Shipped",
    "Out for Delivery",
    "Delivered"
];

const TrackOrder = () => {
    const [searchParams] = useSearchParams();
    const queryOrderFromUrl = searchParams.get('order') || '';

    const { user, setShowUserLogin, currency, axios, navigate } = useAppContext();

    const [searchInput, setSearchInput] = useState(queryOrderFromUrl);
    const [userOrders, setUserOrders] = useState([]);
    const [userReturns, setUserReturns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [matchedOrder, setMatchedOrder] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);

    // Fetch user orders upon authentication
    useEffect(() => {
        const fetchUserData = async () => {
            if (!user) {
                setUserOrders([]);
                setUserReturns([]);
                return;
            }

            try {
                const [ordersRes, returnsRes] = await Promise.allSettled([
                    axios.get('/api/order/user'),
                    axios.get('/api/returns/my-returns')
                ]);

                let loadedOrders = [];
                if (ordersRes.status === 'fulfilled' && ordersRes.value.data.success) {
                    loadedOrders = ordersRes.value.data.orders || [];
                    setUserOrders(loadedOrders);
                }

                if (returnsRes.status === 'fulfilled' && returnsRes.value.data.success) {
                    setUserReturns(returnsRes.value.data.returns || []);
                }

                // If URL has order parameter, automatically search
                if (queryOrderFromUrl && loadedOrders.length > 0) {
                    executeSearch(queryOrderFromUrl, loadedOrders);
                }
            } catch (err) {
                console.error("Error loading orders for tracking:", err.message);
            }
        };

        fetchUserData();
    }, [user, axios, queryOrderFromUrl]);

    const executeSearch = (query, ordersList = userOrders) => {
        setSearched(true);
        setErrorMessage(null);
        setMatchedOrder(null);

        const cleanQuery = query.trim().toUpperCase();
        if (!cleanQuery) {
            setErrorMessage("Please enter an Order Number (e.g. GC-XXXXXX) or Order ID");
            return;
        }

        // Match against customer's authorized orders
        const found = ordersList.find(o => {
            const num = (o.orderNumber || '').toUpperCase();
            const id = (o._id || '').toUpperCase();
            return num === cleanQuery || id === cleanQuery;
        });

        if (found) {
            setMatchedOrder(found);
        } else {
            setErrorMessage(`No matching order found for "${query}". Please check the order number and ensure you are logged into the account used during checkout.`);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        executeSearch(searchInput);
    };

    // Find if a return request exists for this matched order
    const relatedReturn = matchedOrder
        ? userReturns.find(r => String(r.orderId) === String(matchedOrder._id))
        : null;

    const renderTimeline = (status) => {
        if (status === "Cancelled") {
            return (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 my-4 flex items-center justify-between text-red-700 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block animate-pulse" />
                        <span className="font-bold">Order Cancelled</span>
                    </div>
                    <span className="text-xs text-red-600 font-medium">This order was cancelled and will not be delivered.</span>
                </div>
            );
        }

        const currentStageIndex = ORDER_STAGES.indexOf(status);

        if (currentStageIndex === -1) {
            return (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 my-4 text-xs text-gray-700 font-medium flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                    <span>Status: <strong className="text-gray-900">{status || "Order Placed"}</strong></span>
                </div>
            );
        }

        return (
            <div className="my-6 px-2 sm:px-6">
                <div className="relative flex items-center justify-between">
                    {ORDER_STAGES.map((stage, idx) => {
                        const isCompleted = idx < currentStageIndex;
                        const isCurrent = idx === currentStageIndex;

                        return (
                            <React.Fragment key={stage}>
                                <div className="flex flex-col items-center relative z-10">
                                    <div
                                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                            isCompleted
                                                ? "bg-primary text-white shadow-xs"
                                                : isCurrent
                                                ? "bg-white border-2 border-primary text-primary shadow-sm"
                                                : "bg-gray-100 border border-gray-300 text-gray-400"
                                        }`}
                                    >
                                        {isCompleted ? (
                                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <span>{idx + 1}</span>
                                        )}
                                    </div>
                                    <span
                                        className={`mt-2 text-[10px] sm:text-xs text-center max-w-[70px] sm:max-w-[80px] leading-tight ${
                                            isCurrent
                                                ? "font-bold text-primary"
                                                : isCompleted
                                                ? "font-semibold text-gray-800"
                                                : "text-gray-400"
                                        }`}
                                    >
                                        {stage}
                                    </span>
                                </div>

                                {idx < ORDER_STAGES.length - 1 && (
                                    <div
                                        className={`flex-1 h-1 mx-1 sm:mx-2 -mt-6 transition-all ${
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

    return (
        <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6 lg:px-8 text-gray-700">
            {/* Header */}
            <div className="mb-8 text-center md:text-left">
                <nav className="text-xs text-gray-500 mb-2 flex items-center justify-center md:justify-start gap-2">
                    <Link to="/" className="hover:text-primary transition">Home</Link>
                    <span>/</span>
                    <span className="text-gray-900 font-medium">Track Order</span>
                </nav>
                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
                    Track Your Order
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Enter your GreenCart Order Number to view real-time fulfillment and delivery progress
                </p>
            </div>

            {/* Unauthenticated Security Banner */}
            {!user ? (
                <div className="bg-white border border-gray-200 rounded-3xl p-8 text-center shadow-xs mb-10 max-w-xl mx-auto">
                    <div className="w-16 h-16 rounded-full bg-emerald-50 text-primary flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">Customer Verification Required</h2>
                    <p className="text-xs sm:text-sm text-gray-600 mb-6 leading-relaxed">
                        To protect your privacy and personal delivery address, order details can only be viewed by the verified account owner.
                    </p>
                    <button
                        type="button"
                        onClick={() => setShowUserLogin(true)}
                        className="px-8 py-3 bg-primary hover:bg-primary-dull text-white text-sm font-bold rounded-full shadow-md transition transform active:scale-98 cursor-pointer"
                    >
                        Sign In to Track Order
                    </button>
                </div>
            ) : (
                /* Authenticated Order Search Interface */
                <div className="space-y-8">
                    {/* Search Form Card */}
                    <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-xs">
                        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
                            <div className="relative flex-1 w-full">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    placeholder="Enter Order Number (e.g. GC-K7M2Q9) or Order ID"
                                    className="w-full pl-11 pr-4 py-3 text-sm md:text-base border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full sm:w-auto px-8 py-3 bg-primary hover:bg-primary-dull text-white text-sm font-bold rounded-2xl shadow-xs transition cursor-pointer"
                            >
                                Track Order
                            </button>
                        </form>

                        {/* Recent Order Quick Chips */}
                        {userOrders.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
                                <span className="text-xs text-gray-400 font-medium">Recent Orders:</span>
                                {userOrders.slice(0, 4).map((ord) => (
                                    <button
                                        key={ord._id}
                                        type="button"
                                        onClick={() => {
                                            const code = ord.orderNumber || ord._id;
                                            setSearchInput(code);
                                            executeSearch(code);
                                        }}
                                        className="px-3 py-1 bg-gray-50 hover:bg-emerald-50 text-gray-700 hover:text-emerald-800 border border-gray-200 hover:border-emerald-300 rounded-lg text-xs font-mono font-semibold transition cursor-pointer"
                                    >
                                        #{ord.orderNumber || ord._id}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Error Notice */}
                    {errorMessage && (
                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-xs sm:text-sm text-rose-800 flex items-start gap-3">
                            <svg className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <p className="font-semibold">{errorMessage}</p>
                                <p className="mt-1 text-rose-600">
                                    Need assistance? Visit <Link to="/my-orders" className="underline font-bold">My Orders</Link> to view all completed purchases.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Matched Order Details Card */}
                    {matchedOrder && (
                        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xs">
                            {/* Card Header */}
                            <div className="bg-slate-50 p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-lg font-bold text-gray-900">
                                            #{matchedOrder.orderNumber || matchedOrder._id}
                                        </span>
                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                            matchedOrder.status === 'Delivered'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : matchedOrder.status === 'Cancelled'
                                                ? 'bg-rose-100 text-rose-800'
                                                : 'bg-primary/20 text-primary'
                                        }`}>
                                            {matchedOrder.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Placed on {new Date(matchedOrder.createdAt).toLocaleDateString('en-GB', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="text-right">
                                        <span className="text-xs text-gray-500 block">Total Amount</span>
                                        <span className="text-lg font-bold text-primary">
                                            {currency}{matchedOrder.amount?.toLocaleString()}
                                        </span>
                                    </div>

                                    {matchedOrder._id && (
                                        <Link
                                            to={`/order/invoice/${matchedOrder._id}`}
                                            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold shadow-2xs transition"
                                        >
                                            View Invoice
                                        </Link>
                                    )}
                                </div>
                            </div>

                            {/* Status Timeline */}
                            <div className="p-6 border-b border-gray-100">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Live Delivery Progress</h3>
                                {renderTimeline(matchedOrder.status)}
                            </div>

                            {/* Related Return & Refund Status (if filed) */}
                            {relatedReturn && (
                                <div className="mx-6 my-4 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold">Active Return: #{relatedReturn.returnNumber}</span>
                                            <span className="px-2 py-0.5 rounded-full bg-emerald-200/60 font-semibold text-[10px]">
                                                {relatedReturn.status}
                                            </span>
                                        </div>
                                        <p className="text-emerald-800 text-[11px] mt-0.5">
                                            Refund Amount: {currency}{relatedReturn.totalRefundAmount?.toLocaleString()}
                                        </p>
                                    </div>
                                    <Link
                                        to="/my-orders?tab=returns"
                                        className="px-3 py-1.5 bg-white hover:bg-emerald-100 text-emerald-800 font-semibold rounded-lg shadow-2xs transition shrink-0"
                                    >
                                        View Return Details
                                    </Link>
                                </div>
                            )}

                            {/* Items Preview */}
                            <div className="p-6 space-y-3">
                                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Package Contents</h3>
                                <div className="divide-y divide-gray-100">
                                    {(matchedOrder.items || []).map((it, idx) => (
                                        <div key={idx} className="py-3 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                                                    <img
                                                        src={it.product?.image?.[0] || assets.box_icon}
                                                        alt={it.name || "Product"}
                                                        className="w-10 h-10 object-cover rounded-lg"
                                                    />
                                                </div>
                                                <div>
                                                    <h4 className="font-semibold text-gray-900 text-sm">{it.name || it.product?.name || "Grocery Item"}</h4>
                                                    <p className="text-xs text-gray-500">Qty: {it.quantity}</p>
                                                </div>
                                            </div>
                                            <span className="font-semibold text-gray-800 text-sm">
                                                {currency}{((it.unitPrice || it.product?.price || 0) * (it.quantity || 1)).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Destination Address Footer */}
                            {matchedOrder.address && (
                                <div className="bg-gray-50 p-4 px-6 border-t border-gray-100 text-xs text-gray-600 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                    <div>
                                        <span className="font-bold text-gray-800">Destination: </span>
                                        <span>
                                            {matchedOrder.address.street}, {matchedOrder.address.city}, {matchedOrder.address.country}
                                        </span>
                                    </div>
                                    <Link to="/contact" className="text-primary hover:underline font-semibold">
                                        Need Help with this Delivery?
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TrackOrder;
