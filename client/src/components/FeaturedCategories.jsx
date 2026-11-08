import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import CategoryIcon from './CategoryIcon';
import { DEPARTMENT_DEFINITIONS, resolveCategoryMeta } from '../utils/categoryIconMap';

const INITIAL_VISIBLE_COUNT = 6;

const FeaturedCategories = () => {
    const { products, navigate } = useAppContext();
    const [isExpanded, setIsExpanded] = useState(false);

    // Compute live product counts and discover any dynamic categories present in the store
    const enrichedCategories = useMemo(() => {
        const counts = {};
        const discoveredCustomCategories = new Map();

        if (Array.isArray(products)) {
            for (const prod of products) {
                if (prod?.category) {
                    const rawCat = String(prod.category).trim();
                    const norm = rawCat.toLowerCase();
                    counts[norm] = (counts[norm] || 0) + 1;

                    // Discover any database category not matching standard definitions
                    const isStandard = DEPARTMENT_DEFINITIONS.some(
                        d => d.path.toLowerCase() === norm || d.name.toLowerCase() === norm || d.id === norm
                    );
                    if (!isStandard && !discoveredCustomCategories.has(norm)) {
                        const meta = resolveCategoryMeta(rawCat);
                        discoveredCustomCategories.set(norm, {
                            ...meta,
                            name: rawCat,
                            path: rawCat
                        });
                    }
                }
            }
        }

        const combinedList = [
            ...DEPARTMENT_DEFINITIONS,
            ...Array.from(discoveredCustomCategories.values())
        ];

        // Map live product counts and prioritize categories with active stock first
        return combinedList.map(cat => {
            const key = cat.path.toLowerCase().trim();
            const count = counts[key] || 0;
            return {
                ...cat,
                count
            };
        }).sort((a, b) => b.count - a.count);
    }, [products]);

    const visibleCategories = isExpanded
        ? enrichedCategories
        : enrichedCategories.slice(0, INITIAL_VISIBLE_COUNT);

    const handleCategoryClick = (category) => {
        navigate(`/products/${category.path.toLowerCase()}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <section className="mt-14 sm:mt-16" aria-labelledby="featured-categories-heading">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 sm:mb-8">
                <div>
                    <span className="inline-flex items-center gap-2 text-xs font-extrabold text-primary bg-emerald-50 border border-emerald-200/80 px-3.5 py-1.5 rounded-full uppercase tracking-wider mb-2.5 shadow-2xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Curated Departments</span>
                    </span>
                    <h2 id="featured-categories-heading" className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
                        Featured Categories
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1.5 max-w-xl leading-relaxed">
                        Explore hand-crafted grocery departments with fresh organic produce, daily dairy, pantry staples, and chilled drinks.
                    </p>
                </div>

                {/* View All / Toggle Button */}
                <div className="flex items-center gap-3 self-start sm:self-end">
                    <button
                        type="button"
                        onClick={() => setIsExpanded(prev => !prev)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-900 border border-emerald-200/80 text-xs font-extrabold rounded-2xl transition cursor-pointer shadow-2xs hover:shadow-xs active:scale-98"
                    >
                        <span>{isExpanded ? 'Show Fewer Categories' : `View All ${enrichedCategories.length} Departments`}</span>
                        <svg
                            className={`w-3.5 h-3.5 transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Modern Responsive Category Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4 md:gap-5">
                {visibleCategories.map((category) => (
                    <div
                        key={category.path}
                        onClick={() => handleCategoryClick(category)}
                        className={`group relative cursor-pointer rounded-3xl p-4 sm:p-5 lg:p-5 flex flex-col items-center text-center transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 border bg-gradient-to-b ${category.accentBg} ${category.cardBorder} min-h-[255px] sm:min-h-[275px] lg:min-h-[295px] justify-between`}
                    >
                        {/* 1. Icon Container at the Top */}
                        <div className="w-full flex items-center justify-center pt-1 pb-2 sm:pb-3 relative">
                            {/* Soft Ambient Backdrop Aura */}
                            <div className="absolute inset-x-2 top-0 bottom-2 bg-white/60 rounded-full blur-md group-hover:bg-white/90 transition-colors pointer-events-none" />

                            {/* Large Custom Illustrated Vector Icon */}
                            <CategoryIcon
                                category={category.name || category.path}
                                size="md"
                                className="relative z-10"
                            />
                        </div>

                        {/* 2 & 3. Category Name and Product Count Area */}
                        <div className="w-full flex flex-col items-center flex-1 justify-center my-auto">
                            {/* 2. Category Name below icon: Fixed height ensures 1-line and 2-line titles maintain identical alignment */}
                            <div className="h-11 sm:h-12 flex items-center justify-center w-full px-1">
                                <h3 className="text-[15px] sm:text-base lg:text-[17px] font-bold text-gray-900 group-hover:text-primary transition-colors leading-snug line-clamp-2">
                                    {category.name}
                                </h3>
                            </div>

                            {/* 3. Product Count below category name */}
                            <div className="mt-1 sm:mt-1.5">
                                {category.count > 0 ? (
                                    <span className="text-xs sm:text-[13px] md:text-sm font-semibold text-emerald-700 bg-emerald-100/70 border border-emerald-200/80 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shadow-2xs">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        <span>{category.count} in stock</span>
                                    </span>
                                ) : (
                                    <span className="text-xs sm:text-[13px] md:text-sm text-gray-400 font-medium px-2 py-0.5">
                                        Explore Catalog
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* 4. Shop Now Link at the Bottom (mt-auto locks horizontal alignment across all cards in row) */}
                        <div className="mt-auto pt-3 sm:pt-3.5 w-full flex items-center justify-center border-t border-gray-100/80">
                            <span className="inline-flex items-center gap-1.5 text-xs sm:text-[13px] font-bold text-primary group-hover:text-primary-dull transition-all transform group-hover:translate-x-0.5">
                                <span>Shop Now</span>
                                <svg className="w-3.5 h-3.5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                                </svg>
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Bottom Quick Category Pills */}
            <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-gray-400 font-semibold mr-1">Popular Departments:</span>
                {enrichedCategories.slice(0, 6).map(cat => (
                    <button
                        key={cat.path}
                        type="button"
                        onClick={() => handleCategoryClick(cat)}
                        className="px-3 py-1 bg-gray-50 hover:bg-emerald-50 hover:text-emerald-800 text-gray-600 rounded-xl border border-gray-200 transition cursor-pointer font-medium shadow-2xs"
                    >
                        {cat.name} ({cat.count})
                    </button>
                ))}
            </div>
        </section>
    );
};

export default FeaturedCategories;
