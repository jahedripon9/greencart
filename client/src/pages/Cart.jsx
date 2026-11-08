import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { assets } from "../assets/assets";
import toast from "react-hot-toast";

const Cart = () => {

    const { products, currency, cartItems, setCartItems, removeFromCart, getCartCount, updateCartItem, navigate, getCartAmount, getEffectivePrice, fetchProducts, axios, user } = useAppContext();

    const [cartArray, setCartArray] = useState([])
    const [addresses, setAddresses] = useState([])
    const [showAddress, setShowAddress] = useState(false)
    const [selectedAddress, setSelectedAddress] = useState(null);
    const [paymentOption, setPaymentOption] = useState("COD");
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [checkoutKey, setCheckoutKey] = useState(null);

    // Email OTP Checkout Verification State
    const [selectedVerificationMethod, setSelectedVerificationMethod] = useState("email");
    const [otp, setOtp] = useState("");
    const [otpSent, setOtpSent] = useState(false);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [verificationToken, setVerificationToken] = useState(null);
    const [maskedEmail, setMaskedEmail] = useState("");
    const [cooldown, setCooldown] = useState(0);
    const [attemptsLeft, setAttemptsLeft] = useState(null);
    const [otpError, setOtpError] = useState("");

    // Coupon & Promotion State
    const [couponInput, setCouponInput] = useState("");
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
    const [couponError, setCouponError] = useState("");

    // Resend cooldown timer countdown
    useEffect(() => {
        let timer;
        if (cooldown > 0) {
            timer = setInterval(() => {
                setCooldown(prev => (prev > 1 ? prev - 1 : 0));
            }, 1000);
        }
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [cooldown]);

    // Invalidate idempotency key and verification state whenever cart or delivery address changes
    useEffect(() => {
        setCheckoutKey(null);
        setVerificationToken(null);
        setOtp("");
        setOtpSent(false);
        setOtpError("");
        setAttemptsLeft(null);
    }, [cartItems, selectedAddress]);

    const handleSendOtp = async () => {
        if (isSendingOtp || cooldown > 0) return;
        if (!user) {
            toast.error("Please login to verify");
            return;
        }

        setIsSendingOtp(true);
        setOtpError("");
        try {
            const { data } = await axios.post('/api/order/otp/send', {
                channel: 'email'
            });

            if (data.success) {
                setOtpSent(true);
                setMaskedEmail(data.maskedTarget || "");
                setCooldown(data.cooldownSeconds || 60);
                setAttemptsLeft(3);
                toast.success(data.message || "Verification code sent to your email");
            } else {
                toast.error(data.message);
                setOtpError(data.message);
            }
        } catch (error) {
            const msg = error.response?.data?.message || error.message;
            toast.error(msg);
            setOtpError(msg);
            if (error.response?.data?.retryAfter) {
                setCooldown(error.response.data.retryAfter);
            }
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (isVerifyingOtp) return;
        if (!/^\d{6}$/.test(otp.trim())) {
            toast.error("Please enter a valid 6-digit code");
            return;
        }

        setIsVerifyingOtp(true);
        setOtpError("");
        try {
            const { data } = await axios.post('/api/order/otp/verify', {
                otp: otp.trim()
            });

            if (data.success && data.verificationToken) {
                setVerificationToken(data.verificationToken);
                toast.success("Email verified successfully");
            } else {
                toast.error(data.message);
                setOtpError(data.message);
            }
        } catch (error) {
            const msg = error.response?.data?.message || error.message;
            toast.error(msg);
            setOtpError(msg);
            if (error.response?.data?.attemptsLeft !== undefined) {
                setAttemptsLeft(error.response.data.attemptsLeft);
            }
        } finally {
            setIsVerifyingOtp(false);
        }
    };

    // Auto-recalculate / check minOrderAmount when cart amount changes
    useEffect(() => {
        if (appliedCoupon) {
            const subtotal = getCartAmount();
            if (subtotal < (appliedCoupon.minOrderAmount || 0)) {
                toast.error(`Order fell below the minimum amount of ${currency}${appliedCoupon.minOrderAmount} for coupon "${appliedCoupon.code}"`);
                setAppliedCoupon(null);
            } else if (appliedCoupon.discountType === 'percentage') {
                const newDiscount = Math.min(
                    subtotal,
                    Math.round(((subtotal * appliedCoupon.discountValue) / 100) * 100) / 100
                );
                setAppliedCoupon(prev => prev ? { ...prev, discountAmount: newDiscount } : null);
            } else if (appliedCoupon.discountType === 'fixed') {
                const newDiscount = Math.min(appliedCoupon.discountValue, subtotal);
                setAppliedCoupon(prev => prev ? { ...prev, discountAmount: newDiscount } : null);
            }
        }
    }, [cartItems]);

    const handleApplyCoupon = async (e) => {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        if (!couponInput.trim()) return;
        if (!user) {
            toast.error("Please login to apply a coupon");
            return;
        }

        const subtotal = getCartAmount();
        if (subtotal <= 0) {
            toast.error("Add items to your cart before applying a coupon");
            return;
        }

        setIsValidatingCoupon(true);
        setCouponError("");
        try {
            const { data } = await axios.post('/api/coupon/validate', {
                code: couponInput.trim(),
                subtotal
            });

            if (data.success && data.coupon) {
                setAppliedCoupon(data.coupon);
                setCouponError("");
                toast.success(data.message || `Coupon "${data.coupon.code}" applied!`);
            } else {
                setCouponError(data.message || "Invalid coupon code");
                toast.error(data.message || "Invalid coupon code");
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || "Failed to validate coupon";
            setCouponError(msg);
            toast.error(msg);
        } finally {
            setIsValidatingCoupon(false);
        }
    };

    const handleRemoveCoupon = () => {
        setAppliedCoupon(null);
        setCouponInput("");
        setCouponError("");
        toast.success("Coupon removed");
    };

    const placeOrder = async () => {
        if (isPlacingOrder) return;

        if (!user) {
            toast.error("Please login to place an order");
            return;
        }

        if (paymentOption !== "COD") {
            toast.error("Online payment is not supported yet");
            return;
        }

        if (!selectedAddress) {
            toast.error("Please select or add a delivery address");
            return;
        }

        if (!verificationToken) {
            toast.error("Please verify your email before placing the order");
            return;
        }

        if (cartArray.length === 0) {
            toast.error("Cart is empty");
            return;
        }

        const orderItems = [];
        for (const item of cartArray) {
            if (!item || !item._id || !Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 99) {
                toast.error("Invalid item in cart");
                return;
            }

            // Customer-side stock validation before checkout
            if (item.stockQuantity === 0 || item.inStock === false) {
                toast.error(`"${item.name || 'Item'}" is currently out of stock. Please remove it from your cart.`);
                return;
            }

            if (item.stockQuantity !== null && item.stockQuantity !== undefined) {
                if (item.quantity > item.stockQuantity) {
                    toast.error(`Only ${item.stockQuantity} items available for "${item.name || 'Item'}". Please update your cart.`);
                    return;
                }
            }

            orderItems.push({
                product: item._id,
                quantity: item.quantity
            });
        }

        setIsPlacingOrder(true);

        // Reuse existing checkout key on retry; generate new one for fresh attempt
        let idempotencyKey = checkoutKey;
        if (!idempotencyKey) {
            idempotencyKey = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
            setCheckoutKey(idempotencyKey);
        }

        try {
            const { data } = await axios.post('/api/order/cod', {
                items: orderItems,
                address: selectedAddress._id,
                idempotencyKey,
                verificationToken,
                couponCode: appliedCoupon?.code || undefined
            });

            if (data.success) {
                toast.success(data.message);
                setCheckoutKey(null);
                setVerificationToken(null);
                setOtpSent(false);
                setOtp("");
                setAppliedCoupon(null);
                setCouponInput("");
                if (data.remainingCart !== undefined && data.remainingCart !== null && typeof data.remainingCart === 'object') {
                    setCartItems(data.remainingCart);
                }
                // Immediately refresh products in client state so stock levels are up to date across the entire app
                if (typeof fetchProducts === 'function') {
                    fetchProducts();
                }
                if (data.orderId) {
                    navigate(`/order/invoice/${data.orderId}`);
                } else {
                    navigate('/my-orders');
                }
            } else {
                toast.error(data.message);
            }
        } catch (error) {
            // Invalidate key if order was definitively rejected (e.g. out of stock / invalid data)
            if (error.response?.status === 400) {
                setCheckoutKey(null);
            }
            toast.error(error.response?.data?.message || error.message);
        } finally {
            setIsPlacingOrder(false);
        }
    }

    useEffect(() => {
        const fetchAddresses = async () => {
            try {
                const { data } = await axios.get('/api/address/get');
                if (data.success) {
                    setAddresses(data.addresses);
                    if (data.addresses.length > 0) {
                        setSelectedAddress(data.addresses[0]);
                    } else {
                        setSelectedAddress(null);
                    }
                } else {
                    toast.error(data.message);
                    setAddresses([]);
                    setSelectedAddress(null);
                }
            } catch (error) {
                toast.error(error.response?.data?.message || error.message);
                setAddresses([]);
                setSelectedAddress(null);
            }
        };

        if (user) {
            fetchAddresses();
        } else {
            setAddresses([]);
            setSelectedAddress(null);
        }
    }, [user, axios]);

    useEffect(() => {
        if (products.length > 0 && cartItems) {
            const tempArray = [];
            for (const key in cartItems) {
                const product = products.find((item) => item._id === key);
                if (product && cartItems[key] > 0) {
                    tempArray.push({ ...product, quantity: cartItems[key] });
                }
            }
            setCartArray(tempArray);
        } else {
            setCartArray([]);
        }
    }, [products, cartItems]);


    return products.length > 0 && cartItems ? (
        <div className="flex flex-col md:flex-row mt-16">
            <div className='flex-1 max-w-4xl'>
                <h1 className="text-3xl font-medium mb-6">
                    Shopping Cart <span className="text-sm text-primary">{getCartCount()} Items</span>
                </h1>

                <div className="grid grid-cols-[2fr_1fr_1fr] text-gray-500 text-base font-medium pb-3">
                    <p className="text-left">Product Details</p>
                    <p className="text-center">Subtotal</p>
                    <p className="text-center">Action</p>
                </div>

                {cartArray.map((product, index) => {
                    const isItemOutOfStock = product.stockQuantity === 0 || product.inStock === false;
                    const hasRecordedStock = product.stockQuantity !== null && product.stockQuantity !== undefined;
                    const isOverStock = hasRecordedStock && product.quantity > product.stockQuantity;
                    const maxOptionCount = Math.min(
                        Math.max(hasRecordedStock ? product.stockQuantity : 9, product.quantity, 1),
                        99
                    );

                    return (
                        <div key={index} className="grid grid-cols-[2fr_1fr_1fr] text-gray-500 items-center text-sm md:text-base font-medium pt-3">
                            <div className="flex items-center md:gap-6 gap-3">
                                <div onClick={() => {
                                    navigate(`/products/${product.category}/${product._id}`); scrollTo(0, 0);
                                }} className="cursor-pointer w-24 h-24 flex items-center justify-center border border-gray-300 rounded">
                                    <img className="max-w-full h-full object-cover" src={product.image[0]} alt={product.name} />
                                </div>
                                <div>
                                    <p className="hidden md:block font-semibold">{product.name}</p>
                                    <div className="font-normal text-gray-500/70">
                                        <p>Weight: <span>{product.width || "N/A"}</span></p>
                                        <div className='flex items-center'>
                                            <p>Qty:</p>
                                            <select
                                                onChange={e => updateCartItem(product._id, Number(e.target.value))}
                                                value={cartItems[product._id]}
                                                disabled={isItemOutOfStock}
                                                className={`outline-none ${isItemOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {Array(maxOptionCount).fill('').map((_, optIndex) => {
                                                    const optVal = optIndex + 1;
                                                    const isDisabled = hasRecordedStock && optVal > product.stockQuantity;
                                                    return (
                                                        <option key={optIndex} value={optVal} disabled={isDisabled}>
                                                            {optVal} {isDisabled ? '(unavailable)' : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                        {isItemOutOfStock ? (
                                            <p className="text-xs text-red-600 font-semibold mt-1">This product is currently out of stock.</p>
                                        ) : isOverStock ? (
                                            <p className="text-xs text-amber-600 font-semibold mt-1">Only {product.stockQuantity} items are available.</p>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                            <p className="text-center">{currency}{getEffectivePrice(product) * product.quantity}</p>
                            <button onClick={() => removeFromCart(product._id)} className="cursor-pointer mx-auto">
                                <img src={assets.remove_icon} alt="remove icon" className="inline-block w-6 h-6" />
                            </button>
                        </div>
                    );
                })}

                <button onClick={() => { navigate('/products'); scrollTo(0, 0) }} className="group cursor-pointer flex items-center mt-8 gap-2 text-primary font-medium">
                    <img src={assets.arrow_right_icon_colored} alt="arrow" className="group-hover:-translate-x-1 transition" />
                    Continue Shopping
                </button>

            </div>

            <div className="max-w-[360px] w-full bg-gray-100/40 p-5 max-md:mt-16 border border-gray-300/70">
                <h2 className="text-xl md:text-xl font-medium">Order Summary</h2>
                <hr className="border-gray-300 my-5" />

                <div className="mb-6">
                    <p className="text-sm font-medium uppercase">Delivery Address</p>
                    <div className="relative flex justify-between items-start mt-2">
                        <p className="text-gray-500">{selectedAddress ? `${selectedAddress.street}, ${selectedAddress.city}, ${selectedAddress.state}, ${selectedAddress.country}` : "No address found"}</p>
                        <button onClick={() => setShowAddress(!showAddress)} className="text-primary hover:underline cursor-pointer">
                            Change
                        </button>
                        {showAddress && (
                            <div className="absolute top-12 py-1 bg-white border border-gray-300 text-sm w-full">
                                {addresses.map((address, index) => (
                                    <p key={index} onClick={() => { setSelectedAddress(address); setShowAddress(false) }} className="text-gray-500 p-2 hover:bg-gray-100">
                                        {address.street}, {address.city}, {address.state}, {address.country}
                                    </p>
                                ))}
                                <p onClick={() => navigate("/add-address")} className="text-primary text-center cursor-pointer p-2 hover:bg-primary/10">
                                    Add address
                                </p>
                            </div>
                        )}
                    </div>

                    <p className="text-sm font-medium uppercase mt-6">Payment Method</p>

                    <select value={paymentOption} onChange={e => setPaymentOption(e.target.value)} className="w-full border border-gray-300 bg-white px-3 py-2 mt-2 outline-none">
                        <option value="COD">Cash On Delivery</option>
                        <option value="Online" disabled>Online Payment (Coming Soon)</option>
                    </select>

                    {/* Checkout Verification Method Selection */}
                    <div className="mt-6">
                        <p className="text-sm font-medium uppercase mb-2">Checkout Verification</p>

                        <div className="space-y-2 mb-3">
                            <label className="flex items-center gap-2 p-2.5 border border-primary/40 bg-white rounded cursor-pointer hover:bg-primary/5 transition">
                                <input
                                    type="radio"
                                    name="verificationMethod"
                                    value="email"
                                    checked={selectedVerificationMethod === "email"}
                                    onChange={() => setSelectedVerificationMethod("email")}
                                    className="accent-primary"
                                />
                                <span className="text-sm font-medium text-gray-800">Email OTP</span>
                                <span className="ml-auto text-[11px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">Available</span>
                            </label>

                            <label className="flex items-center gap-2 p-2.5 border border-gray-200 bg-gray-50 rounded opacity-60 cursor-not-allowed">
                                <input
                                    type="radio"
                                    name="verificationMethod"
                                    value="mobile"
                                    disabled
                                    className="cursor-not-allowed"
                                />
                                <span className="text-sm text-gray-500">Mobile OTP</span>
                                <span className="ml-auto text-[11px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded font-medium">Coming Soon</span>
                            </label>
                        </div>

                        {/* OTP Action Panel */}
                        <div className="border border-gray-300 bg-white p-3 rounded text-sm space-y-3">
                            {verificationToken ? (
                                <div className="flex items-center gap-2 text-green-700 bg-green-50 p-2.5 rounded border border-green-200">
                                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <div className="flex-1">
                                        <p className="font-medium text-xs">Email Verified</p>
                                        <p className="text-[11px] text-green-600">Ready to place COD order</p>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    {!otpSent ? (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-2.5">
                                                A 6-digit verification code will be sent to your account email to confirm this order.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleSendOtp}
                                                disabled={isSendingOtp || !user}
                                                className={`w-full py-2 px-3 text-xs font-medium rounded text-white bg-primary hover:bg-primary-dull transition ${isSendingOtp ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                            >
                                                {isSendingOtp ? "Sending Code..." : "Send Verification Code"}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-2.5">
                                            <div className="flex justify-between items-center text-xs">
                                                <span className="text-gray-500">Sent to:</span>
                                                <span className="font-medium text-gray-700">{maskedEmail}</span>
                                            </div>

                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={6}
                                                    placeholder="Enter 6-digit code"
                                                    value={otp}
                                                    onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                                    className="flex-1 border border-gray-300 px-3 py-1.5 text-center font-mono tracking-widest text-sm rounded outline-none focus:border-primary"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleVerifyOtp}
                                                    disabled={isVerifyingOtp || otp.length !== 6}
                                                    className={`px-3 py-1.5 text-xs font-medium rounded text-white bg-primary hover:bg-primary-dull transition ${isVerifyingOtp || otp.length !== 6 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                                >
                                                    {isVerifyingOtp ? "Verifying..." : "Verify"}
                                                </button>
                                            </div>

                                            {otpError && (
                                                <p className="text-xs text-red-600 font-medium">{otpError}</p>
                                            )}

                                            {attemptsLeft !== null && attemptsLeft > 0 && attemptsLeft < 3 && (
                                                <p className="text-xs text-amber-600">
                                                    ⚠ {attemptsLeft} attempt(s) remaining
                                                </p>
                                            )}

                                            <div className="flex justify-between items-center pt-1 text-xs text-gray-500">
                                                <span>Expires in 5m</span>
                                                <button
                                                    type="button"
                                                    onClick={handleSendOtp}
                                                    disabled={cooldown > 0 || isSendingOtp}
                                                    className={`text-primary hover:underline font-medium ${cooldown > 0 || isSendingOtp ? "opacity-50 cursor-not-allowed hover:no-underline" : "cursor-pointer"}`}
                                                >
                                                    {cooldown > 0 ? `Resend (${cooldown}s)` : "Resend Code"}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Coupon & Promotion Code Section */}
                <div className="mt-6 mb-4">
                    <p className="text-sm font-medium uppercase mb-2">Coupon & Promotion</p>
                    {appliedCoupon ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                                    %
                                </span>
                                <div>
                                    <p className="font-semibold text-emerald-900 leading-tight">
                                        {appliedCoupon.code}
                                    </p>
                                    <p className="text-xs text-emerald-700">
                                        {appliedCoupon.discountType === 'percentage'
                                            ? `${appliedCoupon.discountValue}% off (-${currency}${appliedCoupon.discountAmount || 0})`
                                            : `${currency}${appliedCoupon.discountValue} off (-${currency}${appliedCoupon.discountAmount || 0})`}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleRemoveCoupon}
                                className="text-xs font-medium text-red-600 hover:text-red-800 hover:underline cursor-pointer px-2 py-1"
                                title="Remove coupon"
                            >
                                Remove
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleApplyCoupon} className="space-y-1.5">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Enter coupon code"
                                    value={couponInput}
                                    onChange={e => {
                                        setCouponInput(e.target.value.toUpperCase());
                                        if (couponError) setCouponError("");
                                    }}
                                    className="flex-1 uppercase border border-gray-300 bg-white px-3 py-1.5 text-sm rounded outline-none focus:border-primary font-mono"
                                />
                                <button
                                    type="submit"
                                    disabled={isValidatingCoupon || !couponInput.trim()}
                                    className={`px-4 py-1.5 text-xs font-medium rounded text-white bg-primary hover:bg-primary-dull transition ${isValidatingCoupon || !couponInput.trim() ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                >
                                    {isValidatingCoupon ? "Checking..." : "Apply"}
                                </button>
                            </div>
                            {couponError && (
                                <p className="text-xs text-red-600 font-medium">{couponError}</p>
                            )}
                        </form>
                    )}
                </div>

                <hr className="border-gray-300" />

                <div className="text-gray-500 mt-4 space-y-2">
                    <p className="flex justify-between">
                        <span>Price</span><span>{currency}{getCartAmount()}</span>
                    </p>
                    {appliedCoupon && (appliedCoupon.discountAmount || 0) > 0 && (
                        <p className="flex justify-between text-emerald-700 font-medium text-sm">
                            <span>Coupon Discount ({appliedCoupon.code})</span>
                            <span>-{currency}{appliedCoupon.discountAmount}</span>
                        </p>
                    )}
                    <p className="flex justify-between">
                        <span>Shipping Fee</span><span className="text-green-600">Free</span>
                    </p>
                    <p className="flex justify-between">
                        <span>Tax (2%)</span>
                        <span>{currency}{Math.floor(Math.max(0, getCartAmount() - (appliedCoupon?.discountAmount || 0)) * 0.02)}</span>
                    </p>
                    <p className="flex justify-between text-lg font-medium mt-3 text-gray-900">
                        <span>Total Amount:</span>
                        <span>
                            {currency}
                            {Math.max(0, getCartAmount() - (appliedCoupon?.discountAmount || 0)) +
                                Math.floor(Math.max(0, getCartAmount() - (appliedCoupon?.discountAmount || 0)) * 0.02)}
                        </span>
                    </p>
                </div>

                <button
                    onClick={placeOrder}
                    disabled={isPlacingOrder || !verificationToken}
                    title={!verificationToken ? "Please verify your email before placing order" : ""}
                    className={`w-full py-3 mt-6 cursor-pointer bg-primary text-white font-medium hover:bg-primary-dull transition ${isPlacingOrder || !verificationToken ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                    {isPlacingOrder ? "Placing Order..." : (!verificationToken ? "Verify Email to Place Order" : (paymentOption === "COD" ? "Place Order" : "Proceed to Checkout"))}
                </button>
            </div>
        </div>
    ) : null
}

export default Cart;
