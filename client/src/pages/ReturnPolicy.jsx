import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const ReturnPolicy = () => {
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
        "Quality not as described"
    ];
    const nonReturnableCategories = policy?.nonReturnableCategories || [
        "Fresh Vegetables",
        "Fresh Fruits",
        "Dairy & Chilled Items",
        "Bakery & Bread"
    ];
    const conditionRequirements = policy?.conditionRequirements || [
        "Item must be unused and in original retail packaging",
        "All product tags, seals, barcodes, and accessories must remain intact",
        "Original GreenCart purchase invoice must be presented upon collection"
    ];

    return (
        <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 text-gray-700">
            {/* Header Breadcrumb & Title */}
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
                            Effective Date: {policy?.effectiveDateFormatted || new Date().toLocaleDateString('en-GB')}
                        </p>
                    </div>
                    <Link
                        to="/my-orders"
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dull text-white text-sm font-semibold rounded-full shadow-xs transition"
                    >
                        <span>View My Orders</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </Link>
                </div>
            </div>

            {/* Admin Policy Disclaimer Alert */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-8 text-amber-900 text-xs md:text-sm flex items-start gap-3 shadow-xs">
                <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                    <strong className="font-bold">Store Policy Notice:</strong> These terms represent the operational standards configured and authorized by GreenCart Store Management. All return eligibility checks and refund schedules are governed by these approved terms.
                </div>
            </div>

            {/* Key Policy Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-5 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-primary flex items-center justify-center mx-auto mb-3 font-bold text-lg">
                        {returnWindowDays}d
                    </div>
                    <h3 className="font-bold text-gray-900 text-base">Return Window</h3>
                    <p className="text-xs text-gray-600 mt-1">
                        Submit requests within <strong>{returnWindowDays} days</strong> of order delivery.
                    </p>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-5 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-primary flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                        </svg>
                    </div>
                    <h3 className="font-bold text-gray-900 text-base">Free Doorstep Pickup</h3>
                    <p className="text-xs text-gray-600 mt-1">
                        Picked up by our delivery agents within 24–48 hours of approval.
                    </p>
                </div>

                <div className="bg-emerald-50/70 border border-emerald-100 rounded-2xl p-5 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-primary flex items-center justify-center mx-auto mb-3 font-bold text-base">
                        {currency}
                    </div>
                    <h3 className="font-bold text-gray-900 text-base">Quick Refunds</h3>
                    <p className="text-xs text-gray-600 mt-1">
                        Processed within <strong>3–5 business days</strong> after item inspection.
                    </p>
                </div>
            </div>

            {/* Detailed Policy Sections */}
            <div className="space-y-8 bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-xs">
                {/* 1. Policy Overview */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                        1. Overview & Commitment
                    </h2>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        {policy?.policyContent || "At GreenCart, customer satisfaction and food safety are our top priorities. If your delivered items do not match our strict quality guidelines, you may request a hassle-free return and refund according to the terms below."}
                    </p>
                </section>

                {/* 2. Eligible Return Reasons */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                        2. Eligible Return Reasons
                    </h2>
                    <p className="text-sm text-gray-600 mb-3">
                        You may request a return if the delivered product meets any of the following criteria:
                    </p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                        {eligibleReasons.map((reason, idx) => (
                            <li key={idx} className="flex items-start gap-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <svg className="w-4 h-4 text-primary shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                                <span>{reason}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* 3. Non-Returnable Categories */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        3. Non-Returnable Items
                    </h2>
                    <p className="text-sm text-gray-600 mb-3">
                        Due to health, hygiene, and rapid perishability constraints, the following categories cannot be returned once delivered in sound condition:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {nonReturnableCategories.map((cat, idx) => (
                            <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span>{cat}</span>
                            </span>
                        ))}
                    </div>
                </section>

                {/* 4. Product Condition Requirements */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                        4. Product Condition for Collection
                    </h2>
                    <ul className="space-y-2 text-sm text-gray-600">
                        {conditionRequirements.map((req, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-2 shrink-0" />
                                <span>{req}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* 5. Shipping & Refund Estimates */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                        <h3 className="font-bold text-gray-900 text-base mb-2">Return Shipping</h3>
                        <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                            {policy?.shippingRules || "Free return pickup is arranged by GreenCart delivery agents within 24–48 hours of approval."}
                        </p>
                    </div>
                    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                        <h3 className="font-bold text-gray-900 text-base mb-2">Refund Processing</h3>
                        <p className="text-xs md:text-sm text-gray-600 leading-relaxed">
                            {policy?.refundProcessingEstimate || "Refunds are processed within 3–5 business days following physical inspection."}
                        </p>
                    </div>
                </section>

                {/* 6. Order Cancellation Policy */}
                <section>
                    <h2 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                        5. Order Cancellation Rules
                    </h2>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        {policy?.cancellationRules || "Orders can be cancelled before packing or dispatch without penalty. Once an order is in transit, cancellation cannot be processed directly; items must follow standard return inspection upon delivery."}
                    </p>
                </section>

                {/* 7. Support & Contact */}
                <section className="border-t border-gray-100 pt-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-3">Questions or Need Support?</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs md:text-sm">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">Email:</span>
                            <a href={`mailto:${policy?.contactInfo?.email || 'support@greencart.com'}`} className="text-primary hover:underline">
                                {policy?.contactInfo?.email || 'support@greencart.com'}
                            </a>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">Hotline:</span>
                            <span className="text-gray-700">{policy?.contactInfo?.phone || '+880 1700-000000'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">Hours:</span>
                            <span className="text-gray-700">{policy?.contactInfo?.hours || '8:00 AM - 10:00 PM'}</span>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default ReturnPolicy;
