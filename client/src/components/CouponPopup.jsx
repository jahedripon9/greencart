import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const DISMISSED_KEY = 'greencart_coupon_popup_dismissed';

const CouponPopup = () => {
    const { promotions, currency } = useAppContext();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        try {
            const dismissed = localStorage.getItem(DISMISSED_KEY);
            if (dismissed === 'true') {
                return;
            }

            if (promotions && promotions.length > 0) {
                // Short entrance delay for smooth homepage transition
                const timer = setTimeout(() => {
                    const checkAgain = localStorage.getItem(DISMISSED_KEY);
                    if (checkAgain !== 'true') {
                        setIsOpen(true);
                    }
                }, 400);

                return () => clearTimeout(timer);
            }
        } catch {
            // LocalStorage restricted or unavailable
        }
    }, [promotions]);

    if (!isOpen || !promotions || promotions.length === 0) {
        return null;
    }

    const featuredCoupon = promotions[0];

    const handleDismiss = () => {
        try {
            localStorage.setItem(DISMISSED_KEY, 'true');
        } catch {
            // Ignore storage errors
        }
        setIsOpen(false);
    };

    const handleShopNow = () => {
        handleDismiss();
        navigate('/products');
    };

    const handleCopy = () => {
        if (!featuredCoupon?.code) return;
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(featuredCoupon.code)
                .then(() => {
                    setCopied(true);
                    toast.success(`Coupon "${featuredCoupon.code}" copied!`);
                    setTimeout(() => setCopied(false), 2500);
                })
                .catch(() => {
                    toast.success(`Code: ${featuredCoupon.code}`);
                });
        } else {
            toast.success(`Code: ${featuredCoupon.code}`);
        }
    };

    const formatExpiryDate = (dateStr) => {
        if (!dateStr) return '';
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    const discountDisplay = featuredCoupon.discountType === 'percentage'
        ? `${featuredCoupon.discountValue}% OFF`
        : `${currency}${featuredCoupon.discountValue} OFF`;

    const minSpendDisplay = featuredCoupon.minOrderAmount > 0
        ? `Valid on orders over ${currency}${featuredCoupon.minOrderAmount}`
        : 'Valid on all orders (no minimum spend)';

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs transition-opacity"
            role="dialog"
            aria-modal="true"
            aria-labelledby="coupon-modal-title"
        >
            {/* Modal Card */}
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-emerald-100 transform transition-all animate-in fade-in zoom-in-95 duration-200">
                {/* Close Button */}
                <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label="Close coupon offer"
                    className="absolute top-3.5 right-3.5 z-20 w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 text-gray-700 flex items-center justify-center transition cursor-pointer"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Top Festive Header Banner */}
                <div className="bg-gradient-to-br from-emerald-600 via-primary to-teal-500 pt-7 pb-8 px-6 text-center text-white relative">
                    {/* Decorative Background Circles */}
                    <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8 pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-10 translate-y-10 pointer-events-none" />

                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-semibold tracking-wide uppercase mb-3">
                        <span className="w-2 h-2 rounded-full bg-amber-300 animate-pulse" />
                        <span>Exclusive Discount</span>
                    </div>

                    <h2 id="coupon-modal-title" className="text-xl md:text-2xl font-extrabold tracking-tight">
                        Enjoy Special Savings!
                    </h2>
                    <p className="text-emerald-100 text-xs md:text-sm mt-1">
                        Here is a special discount voucher just for you
                    </p>
                </div>

                {/* Main Content Body */}
                <div className="p-6 text-center space-y-4">
                    {/* Big Discount Callout */}
                    <div className="py-1">
                        <span className="text-4xl md:text-5xl font-black text-primary tracking-tight">
                            {discountDisplay}
                        </span>
                        <p className="text-gray-500 text-xs mt-1 font-medium">
                            {minSpendDisplay}
                        </p>
                    </div>

                    {/* Interactive Coupon Box */}
                    <div
                        onClick={handleCopy}
                        className="group relative cursor-pointer p-3 rounded-2xl bg-emerald-50/80 hover:bg-emerald-100/80 border-2 border-dashed border-emerald-400 transition flex items-center justify-between"
                        title="Click to copy coupon code"
                    >
                        <div className="text-left">
                            <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block">
                                Coupon Code
                            </span>
                            <span className="font-mono text-lg md:text-xl font-extrabold text-emerald-950 tracking-wide">
                                {featuredCoupon.code}
                            </span>
                        </div>

                        <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 group-hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition">
                            {copied ? (
                                <>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Copied!</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    <span>Copy</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Expiry & Conditions */}
                    <div className="text-xs text-gray-500 space-y-1">
                        {featuredCoupon.description && (
                            <p className="text-gray-600 font-medium">{featuredCoupon.description}</p>
                        )}
                        <p className="flex items-center justify-center gap-1 text-[11px] text-gray-400">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Expires on {formatExpiryDate(featuredCoupon.expiryDate)}</span>
                        </p>
                    </div>

                    {/* Primary Action Button */}
                    <button
                        type="button"
                        onClick={handleShopNow}
                        className="w-full py-3 px-6 bg-primary hover:bg-primary-dull text-white font-bold rounded-xl shadow-md hover:shadow-lg transition transform active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                    >
                        <span>Shop Now</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </button>

                    {/* Sub-action dismissal link */}
                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="text-xs text-gray-400 hover:text-gray-600 transition cursor-pointer pt-1"
                    >
                        No thanks, I will shop regular prices
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CouponPopup;
