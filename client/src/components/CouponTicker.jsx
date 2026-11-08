import React from 'react';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const CouponTicker = () => {
    const { promotions, currency } = useAppContext();

    if (!promotions || promotions.length === 0) {
        return null;
    }

    const copyCoupon = (code) => {
        if (!code) return;
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            navigator.clipboard.writeText(code)
                .then(() => toast.success(`Coupon code "${code}" copied!`))
                .catch(() => toast.success(`Code: ${code}`));
        } else {
            toast.success(`Code: ${code}`);
        }
    };

    // Ensure enough announcements to span wide viewports smoothly (at least 4 items per track)
    const repeatFactor = Math.max(1, Math.ceil(4 / promotions.length));
    const itemsList = Array(repeatFactor).fill(promotions).flat();

    const renderCouponItem = (coupon, keyPrefix) => {
        const discountText = coupon.discountType === 'percentage'
            ? `${coupon.discountValue}% OFF`
            : `${currency}${coupon.discountValue} OFF`;

        const minSpendText = coupon.minOrderAmount > 0
            ? `on orders over ${currency}${coupon.minOrderAmount}`
            : 'on all orders';

        return (
            <div key={`${keyPrefix}-${coupon.code}`} className="inline-flex items-center gap-2 text-xs md:text-sm px-4">
                <span className="font-semibold text-emerald-100">Use code:</span>
                <button
                    type="button"
                    onClick={() => copyCoupon(coupon.code)}
                    title={`Click to copy coupon code "${coupon.code}"`}
                    className="inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded bg-emerald-800/80 hover:bg-emerald-700 text-amber-300 border border-emerald-600/60 shadow-xs cursor-pointer transition transform active:scale-95"
                >
                    <span>{coupon.code}</span>
                    <svg className="w-3.5 h-3.5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                </button>
                <span className="text-white font-bold">{discountText}</span>
                <span className="text-emerald-200/90">{minSpendText}</span>
                <span className="text-amber-400 select-none ml-3" aria-hidden="true">✦</span>
            </div>
        );
    };

    return (
        <aside
            role="region"
            aria-label="Promotional announcements"
            className="w-full bg-gradient-to-r from-emerald-950 via-emerald-900 to-gray-950 text-white border-b border-emerald-800/50 shadow-xs relative flex items-center overflow-hidden z-20 select-none"
        >
            {/* Screen Reader Announcement */}
            <div className="sr-only">
                Active coupons: {promotions.map(p => `${p.code} for ${p.discountType === 'percentage' ? p.discountValue + '%' : currency + p.discountValue} off`).join(', ')}
            </div>

            {/* Left Breaking News "OFFER" Badge */}
            <div className="flex items-center gap-1.5 px-3.5 py-1.5 md:py-2 bg-primary text-white font-extrabold text-xs tracking-wider uppercase shrink-0 z-10 shadow-md">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                </span>
                <span>OFFER</span>
            </div>

            {/* Continuous Marquee Track */}
            <div className="relative flex-1 overflow-hidden py-1.5 flex items-center">
                <div
                    tabIndex={0}
                    aria-label="Promotional coupon ticker. Hover or focus to pause."
                    className="animate-ticker-rtl flex items-center whitespace-nowrap will-change-transform outline-none focus:ring-1 focus:ring-amber-400"
                >
                    {/* Primary Track */}
                    <div className="flex items-center shrink-0">
                        {itemsList.map((coupon, idx) => renderCouponItem(coupon, `track1-${idx}`))}
                    </div>

                    {/* Duplicate Track for Seamless Infinite RTL Looping */}
                    <div className="flex items-center shrink-0" aria-hidden="true">
                        {itemsList.map((coupon, idx) => renderCouponItem(coupon, `track2-${idx}`))}
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default CouponTicker;
