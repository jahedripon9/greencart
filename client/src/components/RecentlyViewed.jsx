import React, { useState, useEffect, useMemo } from 'react';
import ProductCard from './ProductCard';
import { useAppContext } from '../context/AppContext';
import { getRecentlyViewedIds, clearRecentlyViewed } from '../utils/recentlyViewed';

const RecentlyViewed = () => {
    const { products } = useAppContext();
    const [viewedIds, setViewedIds] = useState(() => getRecentlyViewedIds());

    // Listen for localStorage updates when products are viewed in ProductDetails
    useEffect(() => {
        const updateIds = () => {
            setViewedIds(getRecentlyViewedIds());
        };

        window.addEventListener('recently_viewed_updated', updateIds);
        window.addEventListener('storage', updateIds);

        return () => {
            window.removeEventListener('recently_viewed_updated', updateIds);
            window.removeEventListener('storage', updateIds);
        };
    }, []);

    // Map viewed IDs to products in memory in exact order (most recent first)
    const recentlyViewedProducts = useMemo(() => {
        if (!Array.isArray(viewedIds) || viewedIds.length === 0) return [];
        if (!Array.isArray(products) || products.length === 0) return [];

        const productMap = new Map(products.map(p => [String(p._id), p]));
        const result = [];

        for (const id of viewedIds) {
            const prod = productMap.get(String(id));
            // Handle deleted or unavailable products gracefully
            if (prod) {
                result.push(prod);
            }
        }

        return result.slice(0, 10);
    }, [viewedIds, products]);

    // Do not show section if customer hasn't viewed any products yet
    if (recentlyViewedProducts.length === 0) {
        return null;
    }

    return (
        <section className="mt-14 sm:mt-16 bg-slate-50/70 border border-slate-200/80 rounded-3xl p-5 sm:p-8" aria-labelledby="recently-viewed-heading">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
                <div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 bg-white border border-slate-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-1.5 shadow-2xs">
                        <span>🕒</span>
                        <span>Your Browsing History</span>
                    </span>
                    <h2 id="recently-viewed-heading" className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                        Recently Viewed Products
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        Pick up right where you left off. Items you inspected during your recent browsing sessions.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={clearRecentlyViewed}
                    className="text-xs font-semibold text-gray-400 hover:text-rose-600 transition underline self-start sm:self-end cursor-pointer"
                >
                    Clear History
                </button>
            </div>

            {/* Product Cards Layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                {recentlyViewedProducts.map((product) => (
                    <ProductCard key={product._id} product={product} />
                ))}
            </div>
        </section>
    );
};

export default RecentlyViewed;
