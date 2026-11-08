import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const OffersDealsPage = () => {
    const { axios, currency } = useAppContext();
    const [coupons, setCoupons] = useState([]);
    const [settings, setSettings] = useState({
        title: 'Special Offers & Exclusive Discounts',
        subtitle: 'Save more on your daily grocery shopping with our verified coupon codes and promotional deals',
        isVisible: true,
        bannerText: 'Limited time offers! Apply promo codes at checkout for instant savings.'
    });
    const [copiedCode, setCopiedCode] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        window.scrollTo(0, 0);

        const fetchData = async () => {
            setLoading(true);
            try {
                const [contentRes, couponsRes] = await Promise.allSettled([
                    axios.get(`/api/store-content/public?_t=${Date.now()}`),
                    axios.get(`/api/coupon/promotions?_t=${Date.now()}`)
                ]);

                if (contentRes.status === 'fulfilled' && contentRes.value?.data?.success) {
                    const storePayload = contentRes.value.data.content || contentRes.value.data.data;
                    const dealsConfig = storePayload?.offersDeals;
                    if (dealsConfig) {
                        setSettings(dealsConfig);
                    }
                }

                if (couponsRes.status === 'fulfilled' && couponsRes.value?.data?.success) {
                    setCoupons(couponsRes.value.data.coupons || []);
                } else {
                    setCoupons([]);
                }
            } catch (err) {
                console.error("Error loading offers:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [axios]);

    const handleCopy = async (code) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedCode(code);
            toast.success(`Coupon code "${code}" copied to clipboard!`);
            setTimeout(() => {
                setCopiedCode(null);
            }, 3000);
        } catch {
            toast.error("Could not copy code. Please copy manually.");
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "Limited Time";
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return "Limited Time";
        }
    };

    if (!settings.isVisible && !loading) {
        return (
            <div className="max-w-4xl mx-auto py-20 px-4 text-center">
                <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Promotions Temporarily Inactive</h2>
                <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
                    Our current seasonal campaign has concluded. Please check back soon for exciting new promotional vouchers.
                </p>
                <Link
                    to="/products"
                    className="inline-flex items-center px-6 py-2.5 bg-primary hover:bg-primary-dull text-white text-sm font-semibold rounded-full shadow-sm transition"
                >
                    Shop Fresh Groceries
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-gray-700">
            {/* Breadcrumb Navigation */}
            <nav className="text-xs text-gray-500 mb-4 flex items-center gap-2">
                <Link to="/" className="hover:text-primary transition">Home</Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">Offers & Deals</span>
            </nav>

            {/* Header Hero Banner */}
            <div className="relative overflow-hidden bg-linear-to-r from-teal-800 via-emerald-800 to-green-900 rounded-3xl p-8 sm:p-10 text-white mb-8 shadow-sm">
                <div className="relative z-10 max-w-2xl">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-emerald-200 border border-white/20 mb-3 backdrop-blur-sm">
                        <svg className="w-3.5 h-3.5 text-amber-300 fill-current" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        Exclusive Grocery Savings
                    </span>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
                        {settings.title || 'Special Offers & Exclusive Discounts'}
                    </h1>
                    <p className="text-emerald-100 text-sm sm:text-base leading-relaxed">
                        {settings.subtitle || 'Save more on your daily grocery shopping with our verified coupon codes.'}
                    </p>
                </div>

                {/* Promotional Banner Callout */}
                {settings.bannerText && (
                    <div className="relative z-10 mt-6 inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl text-xs sm:text-sm text-emerald-100 font-medium backdrop-blur-sm">
                        <span className="text-amber-300 font-bold">⚡ Offer Notice:</span>
                        <span>{settings.bannerText}</span>
                    </div>
                )}

                {/* Decorative circles */}
                <div className="absolute -right-12 -top-12 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute right-12 bottom-6 hidden lg:flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-white">
                    <div className="text-right">
                        <div className="text-xs text-emerald-200">Verified Coupons</div>
                        <div className="text-base font-bold">100% Authentic Codes</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/30 flex items-center justify-center font-bold text-amber-300 text-lg">
                        %
                    </div>
                </div>
            </div>

            {/* Coupons Section */}
            <div className="mb-12">
                <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Active Coupons & Vouchers</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Click any code to instantly copy and apply at checkout</p>
                    </div>
                    <span className="text-xs text-gray-500 font-medium">
                        {coupons.length} {coupons.length === 1 ? 'deal available' : 'deals available'}
                    </span>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-white border border-gray-100 rounded-3xl p-6 animate-pulse">
                                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
                                <div className="h-10 bg-gray-200 rounded w-1/2 mb-3" />
                                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4" />
                                <div className="h-10 bg-gray-200 rounded w-full" />
                            </div>
                        ))}
                    </div>
                ) : coupons.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {coupons.map((coupon, idx) => {
                            const isPercent = coupon.discountType === 'percentage';
                            const isCopied = copiedCode === coupon.code;

                            return (
                                <div
                                    key={idx}
                                    className="relative bg-white border border-emerald-100 rounded-3xl p-6 shadow-xs hover:shadow-md transition group overflow-hidden"
                                >
                                    {/* Voucher Edge Decoration */}
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-0 transition group-hover:scale-105" />

                                    <div className="relative z-10 flex flex-col h-full justify-between">
                                        <div>
                                            {/* Discount Tag */}
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                                                    {isPercent ? `${coupon.discountValue}% OFF` : `${currency}${coupon.discountValue} OFF`}
                                                </span>
                                                <span className="text-[11px] text-gray-400 font-medium">
                                                    Expires {formatDate(coupon.expiryDate)}
                                                </span>
                                            </div>

                                            {/* Description & Rules */}
                                            <h3 className="text-base font-bold text-gray-900 mb-1">
                                                {coupon.description || `Enjoy ${isPercent ? `${coupon.discountValue}% off` : `${currency}${coupon.discountValue} discount`} on your order`}
                                            </h3>
                                            <p className="text-xs text-gray-500 mb-4">
                                                {coupon.minOrderAmount > 0
                                                    ? `Valid on minimum order of ${currency}${coupon.minOrderAmount}`
                                                    : 'No minimum order required'}
                                            </p>
                                        </div>

                                        {/* Coupon Code Strip */}
                                        <div className="pt-2">
                                            <div className="flex items-center justify-between p-2.5 bg-gray-50 border border-dashed border-gray-300 rounded-2xl">
                                                <div className="pl-2">
                                                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Coupon Code</span>
                                                    <span className="text-sm font-mono font-extrabold text-gray-900 tracking-wider">
                                                        {coupon.code}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(coupon.code)}
                                                    className={`px-4 py-2 text-xs font-bold rounded-xl transition ${isCopied
                                                        ? 'bg-emerald-600 text-white'
                                                        : 'bg-primary hover:bg-primary-dull text-white'
                                                        }`}
                                                >
                                                    {isCopied ? 'Copied ✓' : 'Copy Code'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-gray-50 rounded-3xl border border-gray-200/60 p-8">
                        <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                        </div>
                        <h3 className="text-base font-bold text-gray-800 mb-1">No Active Coupons at the Moment</h3>
                        <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
                            We update promotional codes regularly. Stay tuned for flash sales, festive discounts, and first-order vouchers.
                        </p>
                        <Link
                            to="/products"
                            className="inline-flex items-center px-5 py-2 bg-primary hover:bg-primary-dull text-white text-xs font-bold rounded-xl transition"
                        >
                            Browse Today's Fresh Deals
                        </Link>
                    </div>
                )}
            </div>

            {/* How to Redeem Guide */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 sm:p-8">
                <h3 className="text-lg font-bold text-gray-900 mb-2">How to Use Your GreenCart Promo Code</h3>
                <p className="text-xs text-gray-500 mb-6">Three easy steps to apply your voucher and save immediately</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs mb-3">
                            1
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 mb-1">Copy Your Voucher</h4>
                        <p className="text-xs text-gray-500">
                            Select an active coupon from the list above and click "Copy Code" to copy it to your clipboard.
                        </p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs mb-3">
                            2
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 mb-1">Fill Your Cart</h4>
                        <p className="text-xs text-gray-500">
                            Add fresh groceries, fruits, vegetables, and household essentials meeting the minimum order amount.
                        </p>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-xs">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs mb-3">
                            3
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 mb-1">Apply at Checkout</h4>
                        <p className="text-xs text-gray-500">
                            Paste the code into the "Promo Code" input at checkout and click "Apply" to see your discount deducted.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OffersDealsPage;
