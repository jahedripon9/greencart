import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';
import { useAppContext } from '../context/AppContext';

const FlashSale = () => {
    const { products, promotions, currency } = useAppContext();

    // 1. Identify valid products with real discounts (offerPrice < price and inStock)
    const discountedProducts = useMemo(() => {
        if (!Array.isArray(products)) return [];
        return products.filter(product => {
            const regular = typeof product?.price === 'number' && product.price > 0 ? product.price : 0;
            const offer = typeof product?.offerPrice === 'number' && product.offerPrice > 0 ? product.offerPrice : 0;
            return offer > 0 && regular > 0 && offer < regular && product.inStock;
        });
    }, [products]);

    // 2. Identify active promotion with a valid future expiry date
    const activePromotion = useMemo(() => {
        if (!Array.isArray(promotions) || promotions.length === 0) return null;

        const now = Date.now();
        const unexpired = promotions.filter(promo => {
            if (!promo?.expiryDate) return false;
            const expiryTime = new Date(promo.expiryDate).getTime();
            return !isNaN(expiryTime) && expiryTime > now;
        });

        if (unexpired.length === 0) return null;

        // Pick earliest expiring promotion
        unexpired.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
        return unexpired[0];
    }, [promotions]);

    // Real target expiry timestamp
    const targetExpiryMs = activePromotion ? new Date(activePromotion.expiryDate).getTime() : 0;

    // Countdown State
    const [timeLeft, setTimeLeft] = useState(() => {
        if (!targetExpiryMs) return null;
        const diff = targetExpiryMs - Date.now();
        if (diff <= 0) return null;
        return {
            days: Math.floor(diff / (1000 * 60 * 60 * 24)),
            hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((diff / 1000 / 60) % 60),
            seconds: Math.floor((diff / 1000) % 60)
        };
    });

    useEffect(() => {
        if (!targetExpiryMs) return;

        const timer = setInterval(() => {
            const diff = targetExpiryMs - Date.now();
            if (diff <= 0) {
                setTimeLeft(null);
                clearInterval(timer);
            } else {
                setTimeLeft({
                    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
                    minutes: Math.floor((diff / 1000 / 60) % 60),
                    seconds: Math.floor((diff / 1000) % 60)
                });
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [targetExpiryMs]);

    // Strict Rule: Never display fake countdown or fake discount.
    // Hide the section completely when no valid flash sale / active promo or discounted products exist.
    if (!activePromotion || !timeLeft || discountedProducts.length === 0) {
        return null;
    }

    // Calculate maximum discount percentage among available sale products
    const maxDiscountPercent = discountedProducts.reduce((max, prod) => {
        const discount = Math.round(((prod.price - prod.offerPrice) / prod.price) * 100);
        return discount > max ? discount : max;
    }, 0);

    return (
        <section className="mt-14 sm:mt-16 bg-gradient-to-br from-rose-50 via-amber-50/40 to-white border-2 border-rose-200/80 rounded-3xl p-5 sm:p-8 shadow-xs" aria-labelledby="flash-sale-heading">
            {/* Header & Countdown Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-rose-100">
                <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-bold uppercase tracking-wider shadow-xs">
                            <span className="animate-pulse">⚡</span>
                            Flash Sale
                        </span>
                        {maxDiscountPercent > 0 && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold">
                                Up to {maxDiscountPercent}% OFF
                            </span>
                        )}
                        <span className="text-xs text-rose-800 font-mono font-bold bg-white/80 border border-rose-200 px-2 py-0.5 rounded">
                            Code: {activePromotion.code}
                        </span>
                    </div>

                    <h2 id="flash-sale-heading" className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                        Limited Time Super Grocery Deals
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-600 max-w-xl">
                        Handpicked grocery essentials at reduced prices with limited stock. Complete checkout before the sale timer ends!
                    </p>
                </div>

                {/* Real Countdown Timer Boxes */}
                <div className="flex items-center gap-2 sm:gap-3 bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-rose-200/70 shadow-xs self-start lg:self-center">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1 hidden sm:inline">
                        Ends in:
                    </span>

                    <div className="text-center">
                        <span className="w-11 h-11 bg-rose-600 text-white rounded-xl flex items-center justify-center font-mono font-bold text-base sm:text-lg shadow-2xs">
                            {String(timeLeft.days).padStart(2, '0')}
                        </span>
                        <span className="text-[10px] text-gray-500 font-semibold uppercase mt-0.5 block">Days</span>
                    </div>

                    <span className="font-bold text-rose-600 text-base -mt-4">:</span>

                    <div className="text-center">
                        <span className="w-11 h-11 bg-rose-600 text-white rounded-xl flex items-center justify-center font-mono font-bold text-base sm:text-lg shadow-2xs">
                            {String(timeLeft.hours).padStart(2, '0')}
                        </span>
                        <span className="text-[10px] text-gray-500 font-semibold uppercase mt-0.5 block">Hours</span>
                    </div>

                    <span className="font-bold text-rose-600 text-base -mt-4">:</span>

                    <div className="text-center">
                        <span className="w-11 h-11 bg-rose-600 text-white rounded-xl flex items-center justify-center font-mono font-bold text-base sm:text-lg shadow-2xs">
                            {String(timeLeft.minutes).padStart(2, '0')}
                        </span>
                        <span className="text-[10px] text-gray-500 font-semibold uppercase mt-0.5 block">Mins</span>
                    </div>

                    <span className="font-bold text-rose-600 text-base -mt-4">:</span>

                    <div className="text-center">
                        <span className="w-11 h-11 bg-rose-700 text-white rounded-xl flex items-center justify-center font-mono font-bold text-base sm:text-lg shadow-2xs animate-pulse">
                            {String(timeLeft.seconds).padStart(2, '0')}
                        </span>
                        <span className="text-[10px] text-gray-500 font-semibold uppercase mt-0.5 block">Secs</span>
                    </div>
                </div>
            </div>

            {/* Discounted Product Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 mt-6">
                {discountedProducts.slice(0, 8).map(product => (
                    <ProductCard key={product._id} product={product} />
                ))}
            </div>

            {/* Bottom Action Footer */}
            <div className="mt-6 pt-4 border-t border-rose-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-rose-900">
                <span className="font-medium">
                    ⚡ Verified discounted grocery items while stocks last across Dhaka fulfillment centers.
                </span>
                <Link
                    to="/products"
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition shadow-xs cursor-pointer shrink-0"
                >
                    <span>Shop All Offers</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                </Link>
            </div>
        </section>
    );
};

export default FlashSale;
