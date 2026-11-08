import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { assets } from '../assets/assets';
import { useAppContext } from '../context/AppContext';

const DynamicHeroBanner = () => {
    const { promotions, currency } = useAppContext();
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [timerResetKey, setTimerResetKey] = useState(0);
    const timerRef = useRef(null);
    const touchStartX = useRef(null);
    const touchEndX = useRef(null);

    // Dynamic active coupon promotion if present in store
    const activePromo = useMemo(() => {
        if (!Array.isArray(promotions) || promotions.length === 0) return null;
        const now = Date.now();
        const unexpired = promotions.filter(p => !p.expiryDate || new Date(p.expiryDate).getTime() > now);
        return unexpired.length > 0 ? unexpired[0] : null;
    }, [promotions]);

    const slides = useMemo(() => [
        {
            id: 'farm-fresh',
            badge: '100% Farm Fresh & Organic',
            badgeIcon: '🌿',
            badgeColor: 'bg-emerald-100/90 text-emerald-800 border-emerald-200',
            headlineStart: 'Freshness Delivered',
            headlineHighlight: 'To Your Door,',
            headlineEnd: 'Daily',
            description: 'Direct from vetted local farms to your kitchen. Hand-picked crisp vegetables, seasonal fruits, and wholesome pantry staples delivered in temperature-safe packaging within 24 hours.',
            primaryCta: { text: 'Shop Fresh Produce', link: '/products/vegetables' },
            secondaryCta: { text: 'Explore All Groceries', link: '/products' },
            heroImage: assets.organic_vegitable_image || assets.main_banner_bg,
            secondaryImage: assets.fresh_fruits_image,
            imageAlt: 'Fresh organic vegetables and farm produce',
            bgGradient: 'from-emerald-50/90 via-teal-50/40 to-white',
            blobColor: 'bg-emerald-300/25',
            floatingCard1: {
                title: 'Up to 38% OFF',
                subtitle: 'Seasonal Vegetable Deals',
                icon: '⚡',
                color: 'text-emerald-700'
            },
            floatingCard2: {
                title: 'Free Delivery',
                subtitle: `On all orders over ${currency}1,000`,
                icon: '🚚',
                color: 'text-primary'
            },
            floatingCard3: {
                title: '4.9 / 5 Rating',
                subtitle: 'Loved by 2,500+ Dhaka homes',
                icon: '⭐',
                color: 'text-amber-500'
            }
        },
        {
            id: 'exclusive-deals',
            badge: activePromo ? `Exclusive Voucher: ${activePromo.code}` : 'Special Pantry Discounts',
            badgeIcon: '🔥',
            badgeColor: 'bg-amber-100/90 text-amber-900 border-amber-200',
            headlineStart: 'Super Savings On',
            headlineHighlight: 'Daily Grocery',
            headlineEnd: 'Bundles',
            description: activePromo
                ? `Save ${activePromo.discountType === 'percentage' ? `${activePromo.discountValue}% OFF` : `${currency}${activePromo.discountValue} Flat Discount`} on your purchase using code ${activePromo.code}. Stock up on cooking oils, spices, rice, and snacks.`
                : 'Enjoy unmatched wholesale discounts on family grocery packages, essential cooking oils, premium rice, lentils, and breakfast essentials.',
            primaryCta: { text: 'Claim Grocery Offer', link: '/products' },
            secondaryCta: { text: 'View Categories', link: '/products' },
            heroImage: assets.bottom_banner_image,
            secondaryImage: assets.maggi_image,
            imageAlt: 'Grocery bundles and pantry food essentials',
            bgGradient: 'from-amber-50/80 via-orange-50/30 to-white',
            blobColor: 'bg-amber-300/20',
            floatingCard1: {
                title: activePromo ? `Code: ${activePromo.code}` : 'Daily Flash Deals',
                subtitle: activePromo ? `Min order ${currency}${activePromo.minOrderAmount || 0}` : 'Save big on bundles',
                icon: '🏷️',
                color: 'text-amber-700'
            },
            floatingCard2: {
                title: 'Doorstep Quality Check',
                subtitle: 'Inspect before you pay (COD)',
                icon: '🛡️',
                color: 'text-emerald-600'
            },
            floatingCard3: {
                title: '100% Genuine',
                subtitle: 'Authentic branded goods',
                icon: '✓',
                color: 'text-teal-600'
            }
        },
        {
            id: 'chilled-dairy',
            badge: 'Express Cold-Chain Delivery',
            badgeIcon: '🥛',
            badgeColor: 'bg-sky-100/90 text-sky-900 border-sky-200',
            headlineStart: 'Pure Dairy, Fresh Eggs &',
            headlineHighlight: 'Chilled Drinks',
            headlineEnd: 'Ready For You',
            description: 'Keep your refrigerator stocked with fresh milk, organic eggs, natural fruit drinks, cheeses, and cold refreshments safely transported in temperature-regulated containers.',
            primaryCta: { text: 'Shop Dairy & Eggs', link: '/products/dairy' },
            secondaryCta: { text: 'Browse Cold Drinks', link: '/products/drinks' },
            heroImage: assets.dairy_product_image || assets.amul_milk_image,
            secondaryImage: assets.bottles_image,
            imageAlt: 'Fresh dairy milk, farm eggs and chilled beverages',
            bgGradient: 'from-sky-50/90 via-cyan-50/30 to-white',
            blobColor: 'bg-sky-300/25',
            floatingCard1: {
                title: 'Farm Fresh Milk & Eggs',
                subtitle: 'Daily morning delivery',
                icon: '🥚',
                color: 'text-sky-700'
            },
            floatingCard2: {
                title: 'Temperature Safe',
                subtitle: 'Chilled transit guaranteed',
                icon: '❄️',
                color: 'text-cyan-600'
            },
            floatingCard3: {
                title: '24–48h Dispatch',
                subtitle: 'Across Dhaka metropolitan',
                icon: '⚡',
                color: 'text-amber-500'
            }
        },
        {
            id: 'healthy-fruits',
            badge: 'Healthy Choices, Better Living',
            badgeIcon: '🍎',
            badgeColor: 'bg-rose-100/90 text-rose-900 border-rose-200',
            headlineStart: 'Wholesome Nutrition For',
            headlineHighlight: 'A Healthier',
            headlineEnd: 'Lifestyle',
            description: 'Crisp apples, tropical bananas, imported citrus, and vitamin-rich greens selected at peak freshness to keep your family active and energized every day.',
            primaryCta: { text: 'Explore Fresh Fruits', link: '/products/fruits' },
            secondaryCta: { text: 'View Organic Greens', link: '/products/vegetables' },
            heroImage: assets.fresh_fruits_image || assets.apple_image,
            secondaryImage: assets.organic_vegitable_image,
            imageAlt: 'Fresh healthy fruits and nutritious greens',
            bgGradient: 'from-rose-50/80 via-emerald-50/30 to-white',
            blobColor: 'bg-rose-300/20',
            floatingCard1: {
                title: 'Vitamin-Rich Fruits',
                subtitle: '100% natural & untreated',
                icon: '🍊',
                color: 'text-rose-700'
            },
            floatingCard2: {
                title: 'Same-Day Picking',
                subtitle: 'Direct from certified orchards',
                icon: '🌿',
                color: 'text-emerald-700'
            },
            floatingCard3: {
                title: 'Best Market Price',
                subtitle: 'Fair value direct to you',
                icon: '💚',
                color: 'text-teal-600'
            }
        }
    ], [activePromo, currency]);

    // Helper to restart autoplay interval smoothly after manual interaction
    const restartAutoplay = useCallback(() => {
        setTimerResetKey(k => k + 1);
    }, []);

    // Manual navigation handlers that reset autoplay timer
    const handlePrev = useCallback(() => {
        setCurrentSlide(prev => (prev === 0 ? slides.length - 1 : prev - 1));
        restartAutoplay();
    }, [slides.length, restartAutoplay]);

    const handleNext = useCallback(() => {
        setCurrentSlide(prev => (prev + 1) % slides.length);
        restartAutoplay();
    }, [slides.length, restartAutoplay]);

    const handleSelectSlide = useCallback((index) => {
        setCurrentSlide(index);
        restartAutoplay();
    }, [restartAutoplay]);

    // Keyboard arrow navigation
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            handlePrev();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            handleNext();
        }
    }, [handlePrev, handleNext]);

    // Touch swipe gesture handlers
    const handleTouchStart = (e) => {
        setIsHovered(true);
        if (e.targetTouches && e.targetTouches.length > 0) {
            touchStartX.current = e.targetTouches[0].clientX;
        }
    };

    const handleTouchMove = (e) => {
        if (e.targetTouches && e.targetTouches.length > 0) {
            touchEndX.current = e.targetTouches[0].clientX;
        }
    };

    const handleTouchEnd = () => {
        setIsHovered(false);
        if (touchStartX.current !== null && touchEndX.current !== null) {
            const distance = touchStartX.current - touchEndX.current;
            const minSwipeDistance = 45; // px threshold
            if (distance > minSwipeDistance) {
                handleNext();
            } else if (distance < -minSwipeDistance) {
                handlePrev();
            }
        }
        touchStartX.current = null;
        touchEndX.current = null;
    };

    // Autoplay logic: 5.5s recurring timer respecting reduced-motion, hover, and keyboard focus
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion || isHovered) return;

        timerRef.current = setInterval(() => {
            setCurrentSlide(prev => (prev + 1) % slides.length);
        }, 5500);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [isHovered, slides.length, timerResetKey]);

    const current = slides[currentSlide];

    return (
        <section
            className={`relative w-full rounded-3xl md:rounded-[2.5rem] overflow-hidden border border-gray-200/70 shadow-sm transition-colors duration-700 bg-gradient-to-br ${current.bgGradient} outline-hidden`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
            onFocusCapture={() => setIsHovered(true)}
            onBlurCapture={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) {
                    setIsHovered(false);
                }
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="region"
            aria-roledescription="carousel"
            aria-label="Promotional Hero Showcase"
            aria-live={isHovered ? 'polite' : 'off'}
        >
            {/* Background Decorative Auras */}
            <div className={`absolute -top-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-70 pointer-events-none transition-colors duration-700 ${current.blobColor}`} />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full blur-3xl opacity-40 bg-emerald-200 pointer-events-none" />

            {/* Main Split Layout Grid */}
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center px-6 sm:px-10 md:px-14 lg:px-16 py-10 sm:py-12 md:py-16 min-h-[460px] sm:min-h-[500px] lg:min-h-[540px]">
                {/* Left Column: Brand Copy & Actions (7 Cols on desktop) */}
                <div className="lg:col-span-7 flex flex-col justify-center text-left space-y-5 md:space-y-6">
                    {/* Promotional Badge Pill */}
                    <div>
                        <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider border shadow-2xs transition-all duration-300 ${current.badgeColor}`}>
                            <span className="text-sm">{current.badgeIcon}</span>
                            <span>{current.badge}</span>
                        </span>
                    </div>

                    {/* Headline with High-Contrast Gradient Word */}
                    <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-black text-gray-900 leading-[1.15] tracking-tight">
                        {current.headlineStart}{' '}
                        <span className="bg-gradient-to-r from-primary via-emerald-600 to-teal-700 bg-clip-text text-transparent">
                            {current.headlineHighlight}
                        </span>{' '}
                        {current.headlineEnd}
                    </h1>

                    {/* Description Subtext */}
                    <p className="text-sm sm:text-base text-gray-600 font-normal leading-relaxed max-w-xl">
                        {current.description}
                    </p>

                    {/* Dual Action CTA Buttons */}
                    <div className="flex flex-wrap items-center gap-3.5 pt-1">
                        <Link
                            to={current.primaryCta.link}
                            className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-primary hover:bg-primary-dull text-white text-sm font-bold rounded-2xl shadow-md hover:shadow-lg transition-all transform active:scale-98 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        >
                            <span>{current.primaryCta.text}</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </Link>

                        {current.secondaryCta && (
                            <Link
                                to={current.secondaryCta.link}
                                className="inline-flex items-center gap-2 px-6 py-3.5 bg-white/80 hover:bg-white text-gray-800 text-sm font-semibold rounded-2xl border border-gray-300/80 shadow-2xs hover:shadow-xs transition backdrop-blur-xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2"
                            >
                                <span>{current.secondaryCta.text}</span>
                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </Link>
                        )}
                    </div>

                    {/* Micro Trust Bar */}
                    <div className="pt-3 border-t border-gray-200/60 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-gray-500 font-medium">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>24–48h Express Delivery</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Cash on Delivery</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Doorstep Inspection</span>
                        </div>
                    </div>
                </div>

                {/* Right Column: Visual Product Showcase & Floating Glass Cards (5 Cols on desktop) */}
                <div className="lg:col-span-5 relative flex items-center justify-center mt-6 lg:mt-0">
                    {/* Glowing Circular Backdrop Aura */}
                    <div className="relative w-72 h-72 sm:w-88 sm:h-88 md:w-96 md:h-96 flex items-center justify-center">
                        <div className="absolute inset-4 rounded-full bg-white/70 backdrop-blur-xs shadow-inner border border-white/90" />
                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-emerald-100/50 to-white opacity-90 blur-xl" />

                        {/* Central High-Resolution Grocery Imagery */}
                        <div className="relative z-10 p-6 flex items-center justify-center max-h-72 sm:max-h-80 md:max-h-96">
                            <img
                                key={current.id}
                                src={current.heroImage || assets.bottom_banner_image}
                                alt={current.imageAlt}
                                className="max-h-60 sm:max-h-72 md:max-h-80 w-auto object-contain drop-shadow-xl transition-all duration-700 transform hover:scale-105"
                                loading="eager"
                                onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = assets.bottom_banner_image;
                                }}
                            />
                        </div>

                        {/* Floating Product Cutout (Top Right) */}
                        {current.secondaryImage && (
                            <div className="absolute -top-4 sm:-top-7 -right-2 sm:-right-6 z-20 animate-float-slow will-change-transform pointer-events-none">
                                <div className="relative bg-white/90 backdrop-blur-md rounded-2xl p-2 sm:p-2.5 shadow-xl border border-white/90 flex items-center justify-center">
                                    <img
                                        key={`sec-${current.id}`}
                                        src={current.secondaryImage}
                                        alt="Featured organic item"
                                        className="w-16 h-16 sm:w-20 sm:h-20 md:w-22 md:h-22 object-contain drop-shadow-md transition-opacity duration-500"
                                        loading="eager"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                        }}
                                    />
                                    <span className="absolute -bottom-2 -left-2 bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs">
                                        Top Pick
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Floating Card 1: Top Discount Pill */}
                        <div className="absolute -top-3 sm:-top-5 -left-2 sm:-left-6 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 shadow-lg border border-white/90 flex items-center gap-2.5 max-w-[190px] sm:max-w-[210px] animate-float-gentle will-change-transform">
                            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center text-lg shrink-0">
                                {current.floatingCard1.icon}
                            </div>
                            <div className="leading-tight">
                                <span className={`text-xs font-extrabold block ${current.floatingCard1.color}`}>
                                    {current.floatingCard1.title}
                                </span>
                                <span className="text-[11px] text-gray-500 font-medium">
                                    {current.floatingCard1.subtitle}
                                </span>
                            </div>
                        </div>

                        {/* Floating Card 2: Bottom Express Shipping */}
                        <div className="absolute -bottom-3 sm:-bottom-5 -right-2 sm:-right-4 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 shadow-lg border border-white/90 flex items-center gap-2.5 max-w-[200px] sm:max-w-[220px] animate-float-medium will-change-transform">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg shrink-0">
                                {current.floatingCard2.icon}
                            </div>
                            <div className="leading-tight">
                                <span className="text-xs font-extrabold text-gray-900 block">
                                    {current.floatingCard2.title}
                                </span>
                                <span className="text-[11px] text-gray-500 font-medium">
                                    {current.floatingCard2.subtitle}
                                </span>
                            </div>
                        </div>

                        {/* Floating Card 3: Satisfaction / Rating Pill */}
                        <div className="hidden sm:flex absolute bottom-8 -left-6 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-2.5 px-3 shadow-md border border-white/90 items-center gap-2 animate-float-gentle will-change-transform">
                            <span className="text-base text-amber-500">{current.floatingCard3.icon}</span>
                            <span className="text-xs font-bold text-gray-800">
                                {current.floatingCard3.title}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Navigation Arrows (Accessible, Touch-Friendly & Elegant) */}
            <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous Slide"
                className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 hover:bg-white text-gray-700 shadow-md hover:shadow-lg border border-gray-200/70 backdrop-blur-md flex items-center justify-center transition-all opacity-85 hover:opacity-100 hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2 z-30 cursor-pointer"
            >
                <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                </svg>
            </button>

            <button
                type="button"
                onClick={handleNext}
                aria-label="Next Slide"
                className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/85 hover:bg-white text-gray-700 shadow-md hover:shadow-lg border border-gray-200/70 backdrop-blur-md flex items-center justify-center transition-all opacity-85 hover:opacity-100 hover:scale-105 active:scale-95 focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2 z-30 cursor-pointer"
            >
                <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                </svg>
            </button>

            {/* Elegant Pagination Indicators with accessible tabs */}
            <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-30 bg-white/50 backdrop-blur-xs px-3.5 py-1.5 rounded-full border border-white/70 shadow-2xs"
                role="tablist"
                aria-label="Hero slides"
            >
                {slides.map((s, idx) => (
                    <button
                        key={s.id}
                        type="button"
                        role="tab"
                        onClick={() => handleSelectSlide(idx)}
                        aria-selected={currentSlide === idx}
                        aria-label={`Slide ${idx + 1} of ${slides.length}: ${s.badge}`}
                        className={`transition-all duration-300 rounded-full cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-primary ${
                            currentSlide === idx
                                ? 'w-8 h-2.5 bg-primary shadow-xs'
                                : 'w-2.5 h-2.5 bg-gray-400/50 hover:bg-gray-600/70'
                        }`}
                    />
                ))}
            </div>
        </section>
    );
};

export default DynamicHeroBanner;
