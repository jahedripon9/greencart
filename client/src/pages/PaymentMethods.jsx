import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const PaymentMethods = () => {
    const { currency, axios } = useAppContext();
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPayments = async () => {
            try {
                const { data } = await axios.get(`/api/store-content/public?_t=${Date.now()}`);
                const payload = data.content || data.data;
                if (data.success && Array.isArray(payload?.paymentMethods)) {
                    setPaymentMethods(payload.paymentMethods);
                }
            } catch (err) {
                console.error("Failed to load payment methods:", err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPayments();

        const handleUpdate = () => fetchPayments();
        window.addEventListener('storeContentUpdated', handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener('storeContentUpdated', handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [axios]);

    const activeMethods = paymentMethods.length > 0 ? paymentMethods : [
        {
            id: "cod",
            name: "Cash on Delivery (COD)",
            description: "Pay in cash directly to our delivery courier after inspecting your grocery package at your doorstep.",
            instructions: "Please keep exact amount ready upon delivery for quick contactless handover.",
            isCheckoutSupported: true,
            isActive: true
        },
        {
            id: "bkash",
            name: "bKash Mobile Banking",
            description: "Instant mobile payment via bKash. Available for order settlement and bulk order prepayments.",
            instructions: "Pay to GreenCart Merchant Account: 01700-000000 using bKash App or dialing *247#.",
            isCheckoutSupported: false,
            isActive: true
        },
        {
            id: "nagad",
            name: "Nagad Digital Payment",
            description: "Secure government postal digital financial service with instant payment confirmation.",
            instructions: "Use Nagad App or dial *167# to complete payment to GreenCart official merchant account.",
            isCheckoutSupported: false,
            isActive: true
        },
        {
            id: "bank",
            name: "Direct Bank Transfer",
            description: "Electronic bank transfer (NPSB / BEFTN) designed for corporate and wholesale family grocery packages.",
            instructions: "Transfer to GreenCart Ltd, Account: 105-123456789, City Bank Bangladesh. Reference your Order ID.",
            isCheckoutSupported: false,
            isActive: true
        }
    ];

    const checkoutSupported = activeMethods.filter(m => m.isCheckoutSupported || m.type === 'checkout');
    const informationalMethods = activeMethods.filter(m => !m.isCheckoutSupported && m.type !== 'checkout');

    return (
        <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 text-gray-700">
            {/* Header & Breadcrumb */}
            <div className="mb-8 text-center md:text-left">
                <nav className="text-xs text-gray-500 mb-2 flex items-center justify-center md:justify-start gap-2">
                    <Link to="/" className="hover:text-primary transition font-medium">Home</Link>
                    <span>/</span>
                    <span className="text-gray-900 font-semibold">Payment Methods</span>
                </nav>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
                            Payment Methods & Security
                        </h1>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl leading-relaxed">
                            Transparent, verified, and secure payment options for all your household grocery purchases
                        </p>
                    </div>
                    <Link
                        to="/products"
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dull text-white text-sm font-bold rounded-2xl shadow-xs transition"
                    >
                        <span>Start Shopping</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </Link>
                </div>
            </div>

            {/* Section 1: Checkout-Supported Payment Methods */}
            <div className="mb-10">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary mb-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Instant Checkout Payment Methods</span>
                </div>
                <div className="grid grid-cols-1 gap-5">
                    {checkoutSupported.map((method) => (
                        <div
                            key={method.id}
                            className="bg-white border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-xs relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 bg-primary text-white text-[10px] sm:text-xs font-black uppercase tracking-wider px-4 py-1.5 rounded-bl-2xl shadow-xs">
                                Primary Checkout Method
                            </div>

                            <div className="flex items-start gap-4 sm:gap-5">
                                <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-primary flex items-center justify-center shrink-0">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                    </svg>
                                </div>
                                <div className="space-y-3 flex-1">
                                    <div>
                                        <h2 className="text-xl sm:text-2xl font-black text-gray-900">{method.name}</h2>
                                        <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
                                            {method.description}
                                        </p>
                                    </div>

                                    {method.instructions && (
                                        <div className="space-y-1.5 text-xs sm:text-sm text-gray-600 bg-emerald-50/60 rounded-2xl p-4 border border-emerald-100/80">
                                            <h3 className="font-extrabold text-gray-900 text-xs uppercase tracking-wider">Instructions:</h3>
                                            <p>{method.instructions}</p>
                                        </div>
                                    )}

                                    <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-emerald-800 pt-2">
                                        <span>✓ Zero advance payment required</span>
                                        <span>✓ Doorstep freshness inspection</span>
                                        <span>✓ Official printed receipt included</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Section 2: Informational / Alternative Payment Methods */}
            {informationalMethods.length > 0 && (
                <div className="mb-10">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <span>Alternative / Prepayment Options (Informational)</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {informationalMethods.map((method) => (
                            <div
                                key={method.id}
                                className="bg-white border border-gray-200/80 rounded-3xl p-6 shadow-xs flex flex-col justify-between"
                            >
                                <div>
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mb-4 font-black text-lg">
                                        {method.name.charAt(0)}
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 mb-1">{method.name}</h3>
                                    <p className="text-xs text-gray-500 leading-relaxed mb-4">
                                        {method.description}
                                    </p>
                                    {method.instructions && (
                                        <div className="p-3 bg-gray-50 rounded-xl text-xs text-gray-600 border border-gray-100 mb-4">
                                            <strong className="block text-gray-800 font-semibold mb-0.5">Instructions:</strong>
                                            {method.instructions}
                                        </div>
                                    )}
                                </div>
                                <span className="text-[11px] font-semibold text-gray-400 bg-gray-100/70 px-2.5 py-1 rounded-lg self-start">
                                    Settlement Support Available
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Security Guarantee Banner */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-3xl p-6 sm:p-8 shadow-md">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="space-y-2 text-center sm:text-left">
                        <h2 className="text-xl sm:text-2xl font-black">100% Transparent Grocery Transactions</h2>
                        <p className="text-xs sm:text-sm text-emerald-100 max-w-xl leading-relaxed">
                            Every delivery includes an official invoice with order item breakdown, tax details, and refund eligibility info.
                        </p>
                    </div>
                    <Link
                        to="/return-policy"
                        className="px-6 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 text-xs font-bold rounded-2xl shadow-xs transition shrink-0"
                    >
                        View Return & Refund Policy
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default PaymentMethods;
