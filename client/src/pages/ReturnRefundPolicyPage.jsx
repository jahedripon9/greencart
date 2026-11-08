import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const ReturnRefundPolicyPage = () => {
    const { axios, currency } = useAppContext();
    const [policy, setPolicy] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPolicy = async () => {
            try {
                const { data } = await axios.get(`/api/returns/policy?_t=${Date.now()}`);
                if (data.success && data.policy) {
                    setPolicy(data.policy);
                }
            } catch (err) {
                console.error("Failed to load return policy:", err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchPolicy();

        const handleUpdate = () => fetchPolicy();
        window.addEventListener('storeContentUpdated', handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener('storeContentUpdated', handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [axios]);

    const returnWindowDays = policy?.returnWindowDays || 7;
    const eligibleReasons = policy?.eligibleReasons || [
        "Damaged or defective item received",
        "Wrong product delivered",
        "Expired product received",
        "Missing items from package",
        "Quality not as described",
        "Package tampered or broken seal"
    ];
    const nonReturnableCategories = policy?.nonReturnableCategories || [
        "Fresh Vegetables",
        "Fresh Fruits",
        "Dairy & Chilled Items",
        "Bakery & Bread",
        "Opened Hygiene & Personal Care"
    ];
    const conditionRequirements = policy?.conditionRequirements || [
        "Item must be unused and in original retail packaging",
        "All product tags, seals, barcodes, and accessories must remain intact",
        "Original GreenCart purchase invoice or order confirmation must be presented",
        "Photos of damaged or incorrect items must be provided with the request"
    ];

    return (
        <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 text-gray-700">
            {/* Header & Breadcrumb */}
            <div className="mb-8 text-center md:text-left">
                <nav className="text-xs text-gray-500 mb-2 flex items-center justify-center md:justify-start gap-2">
                    <Link to="/" className="hover:text-primary transition">Home</Link>
                    <span>/</span>
                    <span className="text-gray-900 font-medium">Return & Refund Policy</span>
                </nav>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
                            Return & Refund Policy
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Clear, transparent standards to guarantee satisfaction with every GreenCart order
                        </p>
                    </div>

                    {/* Quick Action Navigation Links */}
                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            to="/my-orders"
                            className="px-4 py-2 bg-primary hover:bg-primary-dull text-white text-xs font-semibold rounded-full shadow-xs transition"
                        >
                            My Orders
                        </Link>
                        <Link
                            to="/my-orders?tab=returns"
                            className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-full transition"
                        >
                            Refund History
                        </Link>
                    </div>
                </div>
            </div>

            {/* Official Store Notice */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8 text-amber-900 text-xs md:text-sm flex items-start gap-3 shadow-xs">
                <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                    <strong className="font-bold">Official Policy Terms:</strong> These return and refund terms are actively governed by GreenCart Store Management. All return verifications, physical hub inspections, and financial disbursements are executed under these rules.
                </div>
            </div>

            {/* Key Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-emerald-50/70 border border-emerald-100 rounded-3xl p-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-primary flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                        {returnWindowDays}d
                    </div>
                    <h3 className="font-bold text-gray-900 text-base">Return Window</h3>
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                        Submit requests within <strong>{returnWindowDays} days</strong> of order delivery.
                    </p>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-100 rounded-3xl p-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-primary flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                    </div>
                    <h3 className="font-bold text-gray-900 text-base">Free Return Pickup</h3>
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                        {policy?.shippingRules || "Doorstep collection within 24–48 hours of approval."}
                    </p>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-100 rounded-3xl p-6 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-primary flex items-center justify-center mx-auto mb-3 font-bold text-base">
                        {currency}
                    </div>
                    <h3 className="font-bold text-gray-900 text-base">3–5 Day Settlement</h3>
                    <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                        {policy?.refundProcessingEstimate || "Processed within 3–5 business days following inspection."}
                    </p>
                </div>
            </div>

            {/* Comprehensive Policy Document */}
            <div className="space-y-8 bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-xs mb-10">
                {/* 1. Return Eligibility & Window */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                        1. Return Eligibility & Window
                    </h2>
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">
                        Items delivered by GreenCart are eligible for return if a request is initiated within <strong>{returnWindowDays} calendar days</strong> of confirmed delivery. Only orders with status marked as <strong>Delivered</strong> are eligible for return requests.
                    </p>
                </section>

                {/* 2. Eligible vs Ineligible Return Conditions */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                        2. Eligible vs Ineligible Return Conditions
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Eligible */}
                        <div className="p-5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                            <h3 className="font-bold text-emerald-900 text-sm mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                                Qualifying Reasons
                            </h3>
                            <ul className="space-y-2 text-xs text-emerald-950">
                                {eligibleReasons.map((r, i) => (
                                    <li key={i} className="flex items-start gap-1.5">
                                        <span className="text-primary font-bold">✓</span>
                                        <span>{r}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Ineligible / Non-returnable */}
                        <div className="p-5 rounded-2xl bg-rose-50/60 border border-rose-100">
                            <h3 className="font-bold text-rose-900 text-sm mb-2 flex items-center gap-2">
                                <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Non-Returnable Categories
                            </h3>
                            <p className="text-xs text-rose-800 mb-2">
                                Due to freshness and hygiene constraints, items in these categories cannot be accepted once delivered intact:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {nonReturnableCategories.map((c, i) => (
                                    <span key={i} className="px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-700 text-xs font-medium">
                                        {c}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* 3. Return Request Procedure */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                        3. How to Request a Return
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                            <span className="font-mono text-xs font-bold text-primary">Step 1</span>
                            <h4 className="font-semibold text-gray-900 text-sm mt-1">Visit My Orders</h4>
                            <p className="text-xs text-gray-600 mt-1">
                                Navigate to <Link to="/my-orders" className="text-primary hover:underline font-medium">My Orders</Link> and find your delivered purchase.
                            </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                            <span className="font-mono text-xs font-bold text-primary">Step 2</span>
                            <h4 className="font-semibold text-gray-900 text-sm mt-1">Click Return Item</h4>
                            <p className="text-xs text-gray-600 mt-1">
                                Click the "Return Item" button beside the product, select your reason, and confirm quantity.
                            </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                            <span className="font-mono text-xs font-bold text-primary">Step 3</span>
                            <h4 className="font-semibold text-gray-900 text-sm mt-1">Track & Pickup</h4>
                            <p className="text-xs text-gray-600 mt-1">
                                Our agent picks up the parcel from your address. Track status anytime in <Link to="/my-orders?tab=returns" className="text-primary hover:underline font-medium">Returns & Refunds</Link>.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 4. Inspection, Rejection, and Delivery Charge Rules */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                        <h3 className="font-bold text-gray-900 text-base mb-2">Physical Hub Inspection</h3>
                        <p className="text-xs md:text-sm text-gray-600 leading-relaxed mb-2">
                            All returned goods are inspected at our fulfillment hub. Items must satisfy the condition rules:
                        </p>
                        <ul className="space-y-1.5 text-xs text-gray-600">
                            {conditionRequirements.map((req, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                    <span className="text-primary">•</span>
                                    <span>{req}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                        <h3 className="font-bold text-gray-900 text-base mb-2">Delivery Charges & Rejections</h3>
                        <p className="text-xs md:text-sm text-gray-600 leading-relaxed mb-2">
                            <strong>Free Pickup:</strong> Return shipping is 100% free for verified damaged, defective, or incorrect items.
                        </p>
                        <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                            <strong>Rejected Requests:</strong> If an item is unsealed, consumed, or tampered with, the return request will be marked as <em>Rejected</em> with a formal reason recorded in your portal.
                        </p>
                    </div>
                </section>

                {/* 5. Refund Processing & Disbursement Methods */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                        5. Refund Processing & Disbursement Methods
                    </h2>
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">
                        Following successful physical inspection at our central hub, refunds are released within <strong>3 to 5 business days</strong>. Supported payout methods include:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 font-medium text-gray-800">
                            <span className="block font-bold text-gray-900 text-sm mb-0.5">Original Payment</span>
                            Reversed directly to the originating payment account.
                        </div>
                        <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 font-medium text-gray-800">
                            <span className="block font-bold text-gray-900 text-sm mb-0.5">bKash / Nagad MFS</span>
                            Transferred directly to your verified mobile financial wallet.
                        </div>
                        <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 font-medium text-gray-800">
                            <span className="block font-bold text-gray-900 text-sm mb-0.5">Store Credit</span>
                            Instant credit usable on any future GreenCart purchase.
                        </div>
                    </div>
                </section>

                {/* 6. Contact & Support */}
                <section className="border-t border-gray-100 pt-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-2">Need Help with a Return?</h2>
                    <p className="text-xs text-gray-500 mb-4">
                        Our dedicated support team is available everyday from 8:00 AM to 10:00 PM (Bangladesh Time).
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm">
                        <Link to="/contact" className="px-5 py-2.5 bg-primary hover:bg-primary-dull text-white font-bold rounded-full transition shadow-xs">
                            Contact Customer Support
                        </Link>
                        <Link to="/track-order" className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full transition">
                            Track Order Progress
                        </Link>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ReturnRefundPolicyPage;
