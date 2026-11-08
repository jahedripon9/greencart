import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';
import { useAppContext } from '../context/AppContext';

const BestSeller = () => {
    const { products: contextProducts, axios } = useAppContext();
    const [bestsellers, setBestsellers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const fetchBestSellers = async () => {
            try {
                const { data } = await axios.get('/api/product/bestsellers?limit=8');
                if (isMounted && data.success && Array.isArray(data.products) && data.products.length > 0) {
                    setBestsellers(data.products);
                    setLoading(false);
                    return;
                }
            } catch (err) {
                // If endpoint unavailable, fallback gracefully to context
            }

            if (isMounted) {
                if (Array.isArray(contextProducts) && contextProducts.length > 0) {
                    setBestsellers(contextProducts.filter(p => p.inStock).slice(0, 8));
                }
                setLoading(false);
            }
        };

        fetchBestSellers();

        return () => {
            isMounted = false;
        };
    }, [axios, contextProducts]);

    if (!loading && bestsellers.length === 0) {
        return null;
    }

    return (
        <section className="mt-14 sm:mt-16" aria-labelledby="bestsellers-heading">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
                <div>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-primary bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-1.5">
                        <span>🏆</span>
                        <span>Verified Sales Leader</span>
                    </span>
                    <h2 id="bestsellers-heading" className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                        Best Sellers
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        Most frequently purchased items based on verified customer checkout orders.
                    </p>
                </div>

                <Link
                    to="/products"
                    className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-primary hover:text-primary-dull transition self-start sm:self-end"
                >
                    <span>Explore All Products</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                </Link>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="border border-gray-200 rounded-2xl p-4 bg-white animate-pulse space-y-3">
                            <div className="w-full h-36 bg-gray-100 rounded-xl" />
                            <div className="w-2/3 h-4 bg-gray-100 rounded" />
                            <div className="w-1/2 h-3 bg-gray-100 rounded" />
                            <div className="flex justify-between items-center pt-2">
                                <div className="w-16 h-5 bg-gray-100 rounded" />
                                <div className="w-16 h-8 bg-gray-100 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                    {bestsellers.map((product) => (
                        <ProductCard key={product._id} product={product} />
                    ))}
                </div>
            )}
        </section>
    );
};

export default BestSeller;
