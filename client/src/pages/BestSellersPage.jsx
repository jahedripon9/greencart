import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import ProductCard from '../components/ProductCard';

const BestSellersPage = () => {
    const { axios } = useAppContext();
    const [products, setProducts] = useState([]);
    const [settings, setSettings] = useState({
        title: 'Best Selling Groceries',
        subtitle: 'Our top customer favorites, most ordered pantry staples, and fresh picks',
        isVisible: true,
        productLimit: 12
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        window.scrollTo(0, 0);

        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch public settings and bestsellers in parallel
                const [contentRes, bestsellersRes] = await Promise.allSettled([
                    axios.get(`/api/store-content/public?_t=${Date.now()}`),
                    axios.get('/api/product/bestsellers?limit=16')
                ]);

                if (contentRes.status === 'fulfilled' && contentRes.value?.data?.success) {
                    const storePayload = contentRes.value.data.content || contentRes.value.data.data;
                    const bestSellerConfig = storePayload?.bestSellers;
                    if (bestSellerConfig) {
                        setSettings(bestSellerConfig);
                    }
                }

                if (bestsellersRes.status === 'fulfilled' && bestsellersRes.value?.data?.success) {
                    setProducts(bestsellersRes.value.data.products || []);
                } else {
                    setProducts([]);
                }
            } catch (err) {
                console.error("Error fetching best sellers:", err);
                setError("Unable to load best selling products at this time.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [axios]);

    if (!settings.isVisible && !loading) {
        return (
            <div className="max-w-4xl mx-auto py-20 px-4 text-center">
                <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Best Sellers Temporarily Unavailable</h2>
                <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
                    We are currently updating our best seller selections. Explore our full catalog for fresh deals.
                </p>
                <Link
                    to="/products"
                    className="inline-flex items-center px-6 py-2.5 bg-primary hover:bg-primary-dull text-white text-sm font-semibold rounded-full shadow-sm transition"
                >
                    Browse All Products
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
                <span className="text-gray-900 font-medium">Best Sellers</span>
            </nav>

            {/* Header Banner */}
            <div className="relative overflow-hidden bg-linear-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-3xl p-8 sm:p-10 text-white mb-10 shadow-sm">
                <div className="relative z-10 max-w-2xl">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 mb-3 backdrop-blur-sm">
                        <svg className="w-3.5 h-3.5 text-amber-300 fill-current" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Customer Favorites
                    </span>
                    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
                        {settings.title || 'Best Selling Groceries'}
                    </h1>
                    <p className="text-emerald-100 text-sm sm:text-base leading-relaxed">
                        {settings.subtitle || 'Our top customer favorites, most ordered pantry staples, and fresh picks.'}
                    </p>
                </div>

                {/* Subtle Decorative Background Badges */}
                <div className="absolute -right-8 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute right-12 top-6 hidden md:flex items-center gap-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 text-white">
                    <div className="text-right">
                        <div className="text-xs text-emerald-200">Verified Orders</div>
                        <div className="text-lg font-bold">100% Quality Assured</div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/30 flex items-center justify-center font-bold text-amber-300">
                        ★
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-2xl">
                    {error}
                </div>
            )}

            {/* Loading Skeleton */}
            {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 animate-pulse">
                            <div className="h-40 bg-gray-200 rounded-xl mb-4" />
                            <div className="h-3 bg-gray-200 rounded w-1/3 mb-2" />
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                            <div className="flex justify-between items-center pt-2">
                                <div className="h-5 bg-gray-200 rounded w-1/4" />
                                <div className="h-8 bg-gray-200 rounded w-16" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : products.length > 0 ? (
                <div>
                    <div className="flex items-center justify-between mb-6 pb-2 border-b border-gray-100">
                        <span className="text-xs text-gray-500 font-medium">
                            Showing <strong className="text-gray-900">{products.length}</strong> top trending items
                        </span>
                        <Link to="/products" className="text-xs font-semibold text-primary hover:underline">
                            View All Catalog &rarr;
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4 sm:gap-6 justify-items-center">
                        {products.map((product) => (
                            <ProductCard key={product._id} product={product} />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="text-center py-16 bg-gray-50 rounded-3xl border border-gray-200/60 p-8">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                    </div>
                    <h3 className="text-base font-bold text-gray-800 mb-1">No Best Sellers Recorded Yet</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
                        As shoppers place orders, our real-time sales algorithm automatically populates this page with the most popular items.
                    </p>
                    <Link
                        to="/products"
                        className="inline-flex items-center px-5 py-2 bg-primary hover:bg-primary-dull text-white text-xs font-bold rounded-xl transition"
                    >
                        Explore Groceries
                    </Link>
                </div>
            )}
        </div>
    );
};

export default BestSellersPage;
