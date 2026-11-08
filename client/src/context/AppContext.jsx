/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import axios from "axios";

axios.defaults.withCredentials = true;
axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL;

export const AppContext = createContext();

export const mergeCarts = (guestCart = {}, dbCart = {}) => {
    const merged = {};

    // 1. Process Database Cart
    if (dbCart && typeof dbCart === 'object' && !Array.isArray(dbCart)) {
        for (const [id, qty] of Object.entries(dbCart)) {
            if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
                if (typeof qty === 'number' && Number.isSafeInteger(qty) && qty >= 1) {
                    merged[id] = Math.min(qty, 99);
                }
            }
        }
    }

    // 2. Additive Merge with Guest Cart
    if (guestCart && typeof guestCart === 'object' && !Array.isArray(guestCart)) {
        for (const [id, qty] of Object.entries(guestCart)) {
            if (typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id)) {
                if (typeof qty === 'number' && Number.isSafeInteger(qty) && qty >= 1) {
                    const current = merged[id] || 0;
                    merged[id] = Math.min(current + qty, 99);
                }
            }
        }
    }

    return merged;
};

export const getRequestPathname = (url) => {
    if (!url || typeof url !== 'string') return '';
    try {
        if (/^(?:https?:)?\/\//i.test(url)) {
            return new URL(url).pathname;
        }
        const cleanPath = url.split(/[?#]/)[0];
        return cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath;
    } catch {
        const noOrigin = url.replace(/^(?:https?:)?\/\/[^/]+/i, '');
        const cleanPath = noOrigin.split(/[?#]/)[0];
        return cleanPath.startsWith('/') ? cleanPath : '/' + cleanPath;
    }
};

export const isSellerApiUrl = (url) => {
    const pathname = getRequestPathname(url);
    if (!pathname) return false;

    // Direct seller routes
    if (pathname.startsWith('/api/seller/')) return true;

    // Seller product management routes
    if (pathname.startsWith('/api/product/seller/')) return true;
    if (pathname === '/api/product/add') return true;
    if (pathname === '/api/product/stock') return true;
    if (pathname === '/api/product/update' || pathname.startsWith('/api/product/update/')) return true;
    if (pathname === '/api/product/delete' || pathname.startsWith('/api/product/delete/')) return true;

    // Seller order management routes
    if (pathname.startsWith('/api/order/seller')) return true;
    if (pathname === '/api/order/status') return true;

    // Seller chat and review moderation routes
    if (pathname.startsWith('/api/chat/seller')) return true;
    if (pathname.startsWith('/api/review/seller')) return true;

    // Seller store content management routes
    if (pathname.startsWith('/api/store-content/admin')) return true;

    return false;
};

export const AppContextProvider = ({ children }) => {

    const currency = import.meta.env.VITE_CURRENCY || "৳";

    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [isSeller, setIsSeller] = useState(false);
    const [sellerUser, setSellerUser] = useState(null);
    const [showUserLogin, setShowUserLogin] = useState(false);
    const [products, setProducts] = useState([]);
    const [cartItems, setCartItems] = useState({});
    const [searchQuery, setSearchQuery] = useState("");
    const [promotions, setPromotions] = useState([]);

    // Seller session expiration & late response tracking refs
    const hasSellerAuthFailedRef = useRef(false);
    const lastSellerToastRef = useRef(0);

    const handleSetIsSeller = useCallback((val) => {
        if (typeof val === 'function') {
            setIsSeller((prev) => {
                const next = val(prev);
                if (next) {
                    hasSellerAuthFailedRef.current = false;
                }
                return next;
            });
        } else {
            if (val) {
                hasSellerAuthFailedRef.current = false;
            }
            setIsSeller(val);
        }
    }, []);

    // In-flight sequential queue for cart synchronization
    const isSyncingRef = useRef(false);
    const pendingCartRef = useRef(null);
    const userRef = useRef(user);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    const syncCartToBackend = useCallback(async (cartData, overrideUser) => {
        const activeUser = overrideUser !== undefined ? overrideUser : userRef.current;
        if (!activeUser) return; // Guest carts remain in local state

        pendingCartRef.current = cartData;
        if (isSyncingRef.current) return;

        isSyncingRef.current = true;
        try {
            while (pendingCartRef.current !== null) {
                const payload = pendingCartRef.current;
                pendingCartRef.current = null;
                try {
                    await axios.post('/api/cart/update', { cartItems: payload });
                } catch (error) {
                    toast.error("Failed to sync cart with server. Please check your connection.");
                    console.error("Cart sync error:", error.response?.data?.message || error.message);
                }
            }
        } finally {
            isSyncingRef.current = false;
        }
    }, []);

    // Fetch seller status 

    const fetchSeller = async () => {
        try {
            const { data } = await axios.get('/api/seller/is-auth');
            if (data.success && !hasSellerAuthFailedRef.current) {
                setIsSeller(true);
                setSellerUser(data.user || null);
            } else {
                setIsSeller(false);
                setSellerUser(null);
            }
        } catch {
            setIsSeller(false);
            setSellerUser(null);
        }
    }

    // Isolated Axios response interceptor for seller session expiration
    useEffect(() => {
        const interceptorId = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error?.response?.status === 401) {
                    const reqUrl = error.config?.url;
                    if (isSellerApiUrl(reqUrl)) {
                        hasSellerAuthFailedRef.current = true;
                        setIsSeller(false);
                        setSellerUser(null);
                        const pathname = getRequestPathname(reqUrl);
                        // Suppress toast for login failures (handled by SellerLogin) and initial silent auth checks
                        if (pathname !== '/api/seller/login' && pathname !== '/api/seller/is-auth') {
                            const now = Date.now();
                            if (now - lastSellerToastRef.current > 3000) {
                                lastSellerToastRef.current = now;
                                toast.error("Seller session expired. Please log in again.");
                            }
                        }
                    }
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptorId);
        };
    }, []);

    // Fetch User Auth Status , User Data and Cart Items 

    const fetchUser = async () => {
        try {
            const { data } = await axios.get('/api/user/is-auth');
            if (data.success && data.user) {
                userRef.current = data.user;
                setUser(data.user);
                setCartItems(prevCart => {
                    const dbCart = data.user.cartItems || {};
                    const merged = mergeCarts(prevCart, dbCart);
                    if (Object.keys(prevCart).length > 0) {
                        syncCartToBackend(merged, data.user);
                    }
                    return merged;
                });
                return data.user;
            } else {
                userRef.current = null;
                setUser(null);
                setCartItems({});
                return null;
            }
        } catch {
            userRef.current = null;
            setUser(null);
            setCartItems({});
            return null;
        }
    }

    const handleSetUser = (newUser) => {
        userRef.current = newUser;
        setUser(newUser);
        if (newUser) {
            setCartItems(prevCart => {
                const dbCart = newUser.cartItems || {};
                const merged = mergeCarts(prevCart, dbCart);
                if (Object.keys(prevCart).length > 0) {
                    syncCartToBackend(merged, newUser);
                }
                return merged;
            });
        }
    };

    // In-flight deduplication ref for product catalog requests
    const inFlightProductsRequestRef = useRef(null);

    // Fetch all products
    const fetchProducts = useCallback(async () => {
        if (inFlightProductsRequestRef.current) {
            return inFlightProductsRequestRef.current;
        }

        const requestPromise = (async () => {
            try {
                const { data } = await axios.get('/api/product/list');

                if (data.success) {
                    setProducts(data.products);
                    return { success: true, products: data.products };
                } else {
                    const message = data.message || "Failed to load products";
                    toast.error(message);
                    return { success: false, message };
                }

            } catch (error) {
                const message = error.response?.data?.message || error.message || "Failed to load products";
                toast.error(message);
                return { success: false, message };
            } finally {
                if (inFlightProductsRequestRef.current === requestPromise) {
                    inFlightProductsRequestRef.current = null;
                }
            }
        })();

        inFlightProductsRequestRef.current = requestPromise;
        return requestPromise;
    }, []);

    // Fetch active public promotions for ticker and popup
    const fetchPromotions = useCallback(async () => {
        try {
            const { data } = await axios.get('/api/coupon/promotions');
            if (data && data.success && Array.isArray(data.coupons)) {
                setPromotions(data.coupons);
                return data.coupons;
            } else {
                setPromotions([]);
                return [];
            }
        } catch {
            setPromotions([]);
            return [];
        }
    }, []);
    // addToCart function to add items to the cart with stock protection
    const addToCart = (itemId, quantity = 1) => {
        if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
            toast.error("Please specify a valid quantity of at least 1");
            return false;
        }

        const product = products.find((p) => p._id === itemId);
        if (product) {
            // Out-of-stock check
            if (product.stockQuantity === 0 || product.inStock === false) {
                toast.error("This product is currently out of stock.");
                return false;
            }

            // Recorded stock check
            if (product.stockQuantity !== null && product.stockQuantity !== undefined) {
                const currentQty = cartItems[itemId] || 0;
                if (currentQty + quantity > product.stockQuantity) {
                    if (product.stockQuantity <= 0) {
                        toast.error("This product is currently out of stock.");
                    } else if (currentQty >= product.stockQuantity) {
                        toast.error(`Only ${product.stockQuantity} items are available.`);
                    } else {
                        const remaining = product.stockQuantity - currentQty;
                        toast.error(`Only ${product.stockQuantity} items are available (${remaining} more can be added).`);
                    }
                    return false;
                }
            }
        }

        let cartData = structuredClone(cartItems);
        const currentQty = cartData[itemId] || 0;

        if (currentQty + quantity > 99) {
            toast.error("Maximum quantity of 99 reached for this item");
            return false;
        }

        cartData[itemId] = currentQty + quantity;
        setCartItems(cartData);
        syncCartToBackend(cartData);
        toast.success("Item added to cart");
        return true;
    };

    // updateCartItem function to update the quantity of items in the cart with stock protection
    const updateCartItem = (itemId, quantity) => {
        if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
            toast.error("Quantity must be at least 1");
            return false;
        }

        const product = products.find((p) => p._id === itemId);
        if (product) {
            // Out-of-stock check
            if (product.stockQuantity === 0 || product.inStock === false) {
                toast.error("This product is currently out of stock.");
                return false;
            }

            // Recorded stock limit check
            if (product.stockQuantity !== null && product.stockQuantity !== undefined) {
                if (quantity > product.stockQuantity) {
                    toast.error(`Only ${product.stockQuantity} items are available.`);
                    return false;
                }
            }
        }

        const validQty = Math.min(quantity, 99);
        let cartData = structuredClone(cartItems);
        cartData[itemId] = validQty;
        setCartItems(cartData);
        syncCartToBackend(cartData);
        toast.success("Cart updated");
        return true;
    };

    const removeFromCart = (itemId) => {
        let cartData = structuredClone(cartItems);
        if (cartData[itemId]) {
            cartData[itemId] -= 1;
            if (cartData[itemId] === 0) {
                delete cartData[itemId];

            }
        }
        setCartItems(cartData);
        syncCartToBackend(cartData);
        toast.success("Item removed from cart");
    }
    // Get Cart Item Count

    const getCartCount = () => {
        let totalCount = 0;
        for (const item in cartItems) {
            totalCount += cartItems[item]
        }
        return totalCount;
    }

    // Calculates effective selling price based on Regular Price and Offer Price rules
    const getEffectivePrice = (product) => {
        if (!product) return 0;
        let regularPrice = typeof product.price === 'number' && Number.isFinite(product.price) && product.price > 0 ? product.price : null;
        if (regularPrice === null && typeof product.offerPrice === 'number' && Number.isFinite(product.offerPrice) && product.offerPrice > 0) {
            regularPrice = product.offerPrice;
        }
        if (regularPrice === null) return 0;
        const hasValidDiscount = typeof product.offerPrice === 'number' && Number.isFinite(product.offerPrice) && product.offerPrice > 0 && product.offerPrice < regularPrice;
        return hasValidDiscount ? product.offerPrice : regularPrice;
    };

    // Get Cart Total Amount 
    const getCartAmount = () => {
        let totalAmount = 0;
        for (const items in cartItems) {
            let itemInfo = products.find((product) => product._id === items);
            if (itemInfo && cartItems[items] > 0) {
                totalAmount += getEffectivePrice(itemInfo) * cartItems[items];
            }
        }
        return Math.floor(totalAmount * 100) / 100;
    }

    useEffect(() => {
        fetchUser();
        fetchSeller();
        fetchProducts();
        fetchPromotions();

        // 60-second periodic poll for dynamic coupon announcements
        const promotionInterval = setInterval(() => {
            fetchPromotions();
        }, 60000);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                fetchPromotions();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(promotionInterval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const value = { navigate, user, setUser: handleSetUser, fetchUser, isSeller, setIsSeller: handleSetIsSeller, sellerUser, setSellerUser, showUserLogin, setShowUserLogin, products, currency, cartItems, setCartItems, addToCart, updateCartItem, removeFromCart, searchQuery, setSearchQuery, getCartAmount, getCartCount, getEffectivePrice, axios, fetchProducts, syncCartToBackend, promotions, setPromotions, fetchPromotions };
    return <AppContext.Provider value={value}>
        {children}
    </AppContext.Provider>
}

export const useAppContext = () => {
    return useContext(AppContext)
}
