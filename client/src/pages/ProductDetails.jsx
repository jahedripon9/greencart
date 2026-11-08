import { useEffect, useState, useCallback, useRef } from "react";
import { useAppContext } from "../context/AppContext";
import { Link, useParams } from "react-router-dom";
import { assets } from "../assets/assets";
import ProductCard from "../components/ProductCard";
import ProductReviews from "../components/ProductReviews";
import StarRating from "../components/StarRating";
import toast from "react-hot-toast";
import { trackRecentlyViewed } from "../utils/recentlyViewed";

const ProductDetails = () => {

    const { products, navigate, currency, addToCart, fetchProducts, user, setShowUserLogin, axios } = useAppContext();
    const { id } = useParams();

    const isValidId = Boolean(id && typeof id === 'string' && id.trim().length > 0);

    const [loading, setLoading] = useState(() => products.length === 0 && isValidId);
    const [fetchError, setFetchError] = useState(null);
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [thumbnail, setThumbnail] = useState(null);

    const [showMessageModal, setShowMessageModal] = useState(false);
    const [initialMessageText, setInitialMessageText] = useState('');
    const [initiatingChat, setInitiatingChat] = useState(false);

    const isMountedRef = useRef(true);
    const hasFetchedRef = useRef(false);

    const product = isValidId ? products.find((item) => item._id === id) : null;

    const isOutOfStock = product?.stockQuantity === 0 || product?.inStock === false;
    const isRecordedStock = product?.stockQuantity !== null && product?.stockQuantity !== undefined;
    const threshold = (typeof product?.lowStockThreshold === 'number' && product.lowStockThreshold >= 1)
        ? product.lowStockThreshold
        : 5;
    const isLowStock = isRecordedStock && product.stockQuantity > 0 && product.stockQuantity <= threshold;

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        hasFetchedRef.current = false;
    }, [id]);

    // Track recently viewed products in localStorage
    useEffect(() => {
        if (product?._id) {
            trackRecentlyViewed(product._id);
        }
    }, [product?._id]);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('review')) {
            const timer = setTimeout(() => {
                const el = document.getElementById('reviews-section');
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                }
            }, 350);
            return () => clearTimeout(timer);
        }
    }, [id]);

    const executeFetch = useCallback(async () => {
        if (typeof fetchProducts !== 'function') {
            if (isMountedRef.current) setLoading(false);
            return;
        }

        if (isMountedRef.current) {
            setLoading(true);
            setFetchError(null);
        }

        try {
            const res = await fetchProducts();
            if (isMountedRef.current) {
                if (res && res.success === false) {
                    setFetchError(res.message || "Failed to load products");
                } else {
                    setFetchError(null);
                }
            }
        } catch (err) {
            if (isMountedRef.current) {
                setFetchError(err?.message || "Failed to load products");
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [fetchProducts]);

    useEffect(() => {
        if (products.length === 0 && isValidId && !hasFetchedRef.current) {
            hasFetchedRef.current = true;
            executeFetch();
        } else if (products.length > 0 || !isValidId) {
            setLoading(false);
        }
    }, [products.length, isValidId, executeFetch]);

    const handleRetry = () => {
        if (loading) return;
        executeFetch();
    };

    useEffect(() => {
        if (products.length > 0 && product) {
            const productsCopy = products.filter((item) => item.category === product.category && item._id !== id);
            setRelatedProducts(productsCopy.slice(0, 5));
        } else {
            setRelatedProducts([]);
        }
    }, [products, product, id]);

    useEffect(() => {
        setThumbnail(product?.image?.[0] ? product.image[0] : null);
    }, [product]);

    const handleOpenMessageModal = () => {
        if (!user) {
            setShowUserLogin(true);
            toast("Please log in to message the seller");
            return;
        }
        setShowMessageModal(true);
    };

    const handleInitiateChat = async (e) => {
        e?.preventDefault();
        if (initiatingChat || !product?._id) return;
        setInitiatingChat(true);
        try {
            const payload = { productId: product._id };
            const trimmed = initialMessageText.trim();
            if (trimmed) {
                payload.initialMessage = trimmed;
            }
            const { data } = await axios.post('/api/chat/initiate', payload);
            if (data.success && data.conversation) {
                setShowMessageModal(false);
                setInitialMessageText('');
                toast.success(data.isNew ? "Inquiry sent to seller" : "Conversation opened");
                navigate(`/messages?id=${data.conversation._id}`);
            } else {
                toast.error(data.message || "Failed to start conversation");
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Failed to start conversation";
            toast.error(msg);
        } finally {
            if (isMountedRef.current) {
                setInitiatingChat(false);
            }
        }
    };

    // 1. Loading Skeleton View
    if (loading) {
        return (
            <div className="mt-12 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-6"></div>
                <div className="flex flex-col md:flex-row gap-16 mt-4">
                    <div className="flex gap-3">
                        <div className="flex flex-col gap-3">
                            {Array(4).fill('').map((_, index) => (
                                <div key={index} className="w-24 h-24 bg-gray-200 rounded border border-gray-300"></div>
                            ))}
                        </div>
                        <div className="w-72 h-72 sm:w-80 sm:h-80 md:w-96 md:h-96 bg-gray-200 rounded border border-gray-300"></div>
                    </div>
                    <div className="flex-1 space-y-4">
                        <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-5 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-8 bg-gray-200 rounded w-1/3 mt-6"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        <div className="space-y-2 mt-6">
                            <div className="h-4 bg-gray-200 rounded w-full"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                        </div>
                        <div className="flex gap-4 mt-8 pt-4">
                            <div className="h-12 bg-gray-200 rounded w-1/2"></div>
                            <div className="h-12 bg-gray-200 rounded w-1/2"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 2. Fetch Error View
    if (fetchError && !product) {
        return (
            <div className="mt-16 text-center max-w-lg mx-auto py-12 px-6 border border-gray-200 rounded-xl bg-gray-50/50">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                    !
                </div>
                <h2 className="text-2xl font-medium text-gray-800 mb-2">Unable to Load Product</h2>
                <p className="text-gray-500 text-sm mb-6">{fetchError}</p>
                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={handleRetry}
                        disabled={loading}
                        className="px-6 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary-dull transition cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Retrying..." : "Try Again"}
                    </button>
                    <Link
                        to="/products"
                        className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-full font-medium hover:bg-gray-100 transition text-sm"
                    >
                        Browse All Products
                    </Link>
                </div>
            </div>
        );
    }

    // 3. Product Not Found View
    if (!product) {
        return (
            <div className="mt-16 text-center max-w-lg mx-auto py-12 px-6 border border-gray-200 rounded-xl bg-gray-50/50">
                <img src={assets.box_icon} alt="Product not found" className="w-16 h-16 mx-auto mb-4 opacity-40" />
                <h2 className="text-2xl font-medium text-gray-800 mb-2">Product Not Found</h2>
                <p className="text-gray-500 text-sm mb-6">
                    The product you are looking for may have been removed, or the link may be invalid.
                </p>
                <div className="flex items-center justify-center gap-4">
                    <Link
                        to="/products"
                        className="px-6 py-2.5 bg-primary text-white rounded-full font-medium hover:bg-primary-dull transition text-sm"
                    >
                        Browse All Products
                    </Link>
                    <Link
                        to="/"
                        className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-full font-medium hover:bg-gray-100 transition text-sm"
                    >
                        Return Home
                    </Link>
                </div>
            </div>
        );
    }

    // 4. Product Found View
    let regularPrice = typeof product?.price === 'number' && Number.isFinite(product.price) && product.price > 0 ? product.price : null;
    if (regularPrice === null && typeof product?.offerPrice === 'number' && Number.isFinite(product.offerPrice) && product.offerPrice > 0) {
        regularPrice = product.offerPrice;
    }
    const hasValidDiscount = typeof product?.offerPrice === 'number' && Number.isFinite(product.offerPrice) && product.offerPrice > 0 && regularPrice !== null && product.offerPrice < regularPrice;
    const effectivePrice = hasValidDiscount ? product.offerPrice : (regularPrice || 0);

    return (
        <div className="mt-12">
            <p>
                <Link to={"/"}>Home</Link> /
                <Link to={"/products"}> Products</Link> /
                <Link to={`/products/${(product.category || '').toLowerCase()}`}> {product.category}</Link> /
                <span className="text-primary"> {product.name}</span>
            </p>

            <div className="flex flex-col md:flex-row gap-16 mt-4">
                <div className="flex gap-3">
                    <div className="flex flex-col gap-3">
                        {(product.image || []).map((image, index) => (
                            <div key={index} onClick={() => setThumbnail(image)} className="border max-w-24 border-gray-500/30 rounded overflow-hidden cursor-pointer" >
                                <img src={image} alt={`Thumbnail ${index + 1}`} />
                            </div>
                        ))}
                    </div>

                    <div className="border border-gray-500/30 max-w-100 rounded overflow-hidden">
                        <img src={thumbnail || product.image?.[0] || assets.upload_area} alt="Selected product" />
                    </div>
                </div>

                <div className="text-sm w-full md:w-1/2">
                    <h1 className="text-3xl font-medium">{product.name}</h1>

                    <div className="flex items-center gap-2 mt-1">
                        <StarRating rating={product.averageRating || 0} size="sm" />
                        <span className="text-sm font-semibold text-gray-800">
                            {(product.averageRating || 0) > 0 ? Number(product.averageRating).toFixed(1) : "0.0"}
                        </span>
                        <span className="text-gray-400 text-xs">•</span>
                        <a
                            href="#reviews-section"
                            onClick={(e) => {
                                e.preventDefault();
                                document.getElementById('reviews-section')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="text-xs text-primary hover:underline font-medium cursor-pointer"
                        >
                            {product.reviewCount || 0} {product.reviewCount === 1 ? "review" : "reviews"}
                        </a>
                    </div>

                    <div className="mt-6">
                        {hasValidDiscount && (
                            <p className="text-gray-500/70 line-through">MRP: {currency}{regularPrice}</p>
                        )}
                        <p className="text-2xl font-medium">MRP: {currency}{effectivePrice}</p>
                        <span className="text-gray-500/70">(inclusive of all taxes)</span>
                    </div>

                    <div className="mt-3">
                        {isOutOfStock ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                                Out of Stock
                            </span>
                        ) : isLowStock ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                Low Stock: Only {product.stockQuantity} left
                            </span>
                        ) : isRecordedStock ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                In Stock ({product.stockQuantity} available)
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                In Stock
                            </span>
                        )}
                    </div>

                    <p className="text-base font-medium mt-6">About Product</p>
                    <ul className="list-disc ml-4 text-gray-500/70">
                        {(Array.isArray(product.description) ? product.description : [product.description || '']).map((desc, index) => (
                            <li key={index}>{desc}</li>
                        ))}
                    </ul>

                    <div className="flex items-center mt-10 gap-4 text-base">
                        {isOutOfStock ? (
                            <>
                                <button
                                    disabled
                                    aria-disabled="true"
                                    className="w-full py-3.5 font-medium bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed transition rounded select-none"
                                >
                                    Out of Stock
                                </button>
                                <button
                                    disabled
                                    aria-disabled="true"
                                    className="w-full py-3.5 font-medium bg-gray-200 text-gray-400 cursor-not-allowed transition rounded select-none"
                                >
                                    Buy now
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={() => addToCart(product._id)}
                                    className="w-full py-3.5 cursor-pointer font-medium bg-gray-100 text-gray-800/80 hover:bg-gray-200 transition"
                                >
                                    Add to Cart
                                </button>
                                <button
                                    onClick={() => {
                                        if (addToCart(product._id) !== false) {
                                            navigate("/cart");
                                        }
                                    }}
                                    className="w-full py-3.5 cursor-pointer font-medium bg-primary text-white hover:bg-primary-dull transition"
                                >
                                    Buy now
                                </button>
                            </>
                        )}
                    </div>

                    <button
                        onClick={handleOpenMessageModal}
                        className="w-full mt-3 py-3 border border-gray-300 hover:border-primary text-gray-700 hover:text-primary rounded-md font-medium transition cursor-pointer flex items-center justify-center gap-2 text-sm bg-white"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>Message Seller</span>
                    </button>
                </div>
            </div>

            {/* ------- Message Seller Modal -------- */}
            {showMessageModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl relative">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800">Message Seller</h3>
                            <button
                                onClick={() => setShowMessageModal(false)}
                                className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none"
                            >
                                &times;
                            </button>
                        </div>

                        <div className="flex items-center gap-3 my-4 p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                            <img
                                src={thumbnail || product.image?.[0] || assets.upload_area}
                                alt={product.name}
                                className="w-12 h-12 object-cover rounded border border-gray-200 bg-white"
                            />
                            <div className="min-w-0 flex-1">
                                <h4 className="text-xs font-semibold text-gray-800 truncate">{product.name}</h4>
                                <p className="text-xs text-primary font-medium mt-0.5">{currency}{effectivePrice}</p>
                            </div>
                        </div>

                        <form onSubmit={handleInitiateChat}>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                Your Inquiry / Question (Optional)
                            </label>
                            <textarea
                                value={initialMessageText}
                                onChange={(e) => setInitialMessageText(e.target.value)}
                                placeholder="Hi, is this product available? Can I get more details?"
                                rows={4}
                                maxLength={2000}
                                disabled={initiatingChat}
                                className="w-full text-sm p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none disabled:bg-gray-100"
                            />
                            <div className="flex justify-between items-center text-[11px] text-gray-400 mt-1 mb-4">
                                <span>Press Start to open customer chat</span>
                                <span>{initialMessageText.length}/2000</span>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowMessageModal(false)}
                                    disabled={initiatingChat}
                                    className="px-4 py-2 border border-gray-300 text-gray-600 rounded-full hover:bg-gray-100 text-sm font-medium transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={initiatingChat}
                                    className="px-6 py-2 bg-primary hover:bg-primary-dull text-white rounded-full text-sm font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {initiatingChat ? "Starting..." : "Start Conversation"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* ------- Customer Reviews Section -------- */}
            <ProductReviews
                productId={product._id}
                productName={product.name}
                productImage={thumbnail || product.image?.[0]}
                averageRating={product.averageRating || 0}
                reviewCount={product.reviewCount || 0}
            />

            {/* ------- Related Products -------- */}
            <div className="flex flex-col items-center mt-20">
                <div className="flex flex-col items-center w-max">
                    <p className="text-3xl font-medium">Related Products</p>
                    <div className="w-20 h-0.5 bg-primary rounded-full mt-2"></div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3 md:gap-6 mt-6 w-full">
                    {relatedProducts.filter((p) => p.inStock).map((p, index) => (
                        <ProductCard key={index} product={p} />
                    ))}
                </div>
                <button onClick={() => { navigate('/products'); scrollTo(0, 0) }} className="mx-auto cursor-pointer px-12 my-16 py-2.5 border rounded text-primary hover:bg-primary/10 transition">See More</button>
            </div>
        </div>
    );
};

export default ProductDetails;
