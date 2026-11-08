import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const DeliveryInformation = () => {
    const { currency, axios } = useAppContext();
    const [deliveryData, setDeliveryData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [openFaq, setOpenFaq] = useState(null);

    useEffect(() => {
        const fetchDeliveryContent = async () => {
            try {
                const { data } = await axios.get(`/api/store-content/public?_t=${Date.now()}`);
                const payload = data.content || data.data;
                if (data.success && payload?.delivery) {
                    setDeliveryData(payload.delivery);
                }
            } catch (err) {
                console.error("Failed to load delivery content:", err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchDeliveryContent();

        const handleUpdate = () => fetchDeliveryContent();
        window.addEventListener('storeContentUpdated', handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener('storeContentUpdated', handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [axios]);

    const delivery = deliveryData || {
        title: "Fast, Reliable & Temperature-Safe Grocery Delivery",
        description: "GreenCart delivers farm-fresh organic produce, chilled dairy, and pantry essentials directly to your doorstep.",
        insideCityCharge: 60,
        outsideCityCharge: 120,
        freeDeliveryThreshold: 1000,
        estimatedTimeInsideCity: "24–48 Hours",
        estimatedTimeOutsideCity: "48–72 Hours",
        instructions: "Perishable vegetables, fruits, and dairy products are transported in temperature-regulated containers to guarantee farm freshness.",
        zones: [
            {
                name: "Dhaka North Express Zone",
                areas: ["Gulshan", "Banani", "Baridhara", "Uttara", "Nikunja", "Bashundhara"],
                estimatedTime: "Same-Day / 24 Hours",
                charge: 60,
                freeDeliveryAbove: 1000
            },
            {
                name: "Dhaka South & Central Zone",
                areas: ["Dhanmondi", "Mohammadpur", "Mirpur", "Tejgaon", "Khilgaon", "Motijheel"],
                estimatedTime: "24–48 Hours",
                charge: 60,
                freeDeliveryAbove: 1000
            },
            {
                name: "Greater Dhaka & Suburbs",
                areas: ["Savar", "Gazipur", "Keraniganj", "Narayanganj"],
                estimatedTime: "48–72 Hours",
                charge: 120,
                freeDeliveryAbove: 1500
            }
        ]
    };

    const toggleFaq = (index) => {
        setOpenFaq(openFaq === index ? null : index);
    };

    const deliveryFaqs = [
        {
            q: "How long does delivery take inside Dhaka?",
            a: `Standard delivery inside Dhaka metropolitan areas takes ${delivery.estimatedTimeInsideCity}. Priority express delivery is arranged for essential orders.`
        },
        {
            q: "How can I qualify for Free Delivery?",
            a: `Orders qualifying above ${currency}${delivery.freeDeliveryThreshold} enjoy 100% Free Doorstep Delivery. For smaller orders, a modest fee of ${currency}${delivery.insideCityCharge} covers temperature-safe insulated transport.`
        },
        {
            q: "How do you handle perishable greens, fruits, and dairy during transit?",
            a: delivery.instructions || "All perishables are packed in insulated, food-grade temperature-safe crates to ensure field-picked crispness upon arrival."
        },
        {
            q: "Can I inspect the delivery package before paying?",
            a: "Yes! With Cash on Delivery, you are fully entitled to inspect the freshness and condition of your items at your doorstep before handing over payment."
        }
    ];

    return (
        <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 text-gray-700">
            {/* Header & Breadcrumb */}
            <div className="mb-8 text-center md:text-left">
                <nav className="text-xs text-gray-500 mb-2 flex items-center justify-center md:justify-start gap-2">
                    <Link to="/" className="hover:text-primary transition font-medium">Home</Link>
                    <span>/</span>
                    <span className="text-gray-900 font-semibold">Delivery Information</span>
                </nav>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
                            {delivery.title}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl leading-relaxed">
                            {delivery.description}
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

            {/* Core Pricing & Delivery Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
                {/* Inside City */}
                <div className="bg-gradient-to-br from-emerald-50/80 to-white border border-emerald-200/80 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                    <div>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full">
                            Inside Dhaka
                        </span>
                        <h3 className="text-3xl font-black text-gray-900 mt-3">
                            {currency}{delivery.insideCityCharge}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Estimated time: <strong className="text-gray-800">{delivery.estimatedTimeInsideCity}</strong>
                        </p>
                    </div>
                    <p className="text-xs text-emerald-700 font-semibold mt-4 pt-3 border-t border-emerald-100">
                        ✓ Free above {currency}{delivery.freeDeliveryThreshold}
                    </p>
                </div>

                {/* Outside City */}
                <div className="bg-gradient-to-br from-blue-50/80 to-white border border-blue-200/80 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                    <div>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-800 bg-blue-100/80 px-2.5 py-1 rounded-full">
                            Outside Dhaka / Suburbs
                        </span>
                        <h3 className="text-3xl font-black text-gray-900 mt-3">
                            {currency}{delivery.outsideCityCharge}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Estimated time: <strong className="text-gray-800">{delivery.estimatedTimeOutsideCity}</strong>
                        </p>
                    </div>
                    <p className="text-xs text-blue-700 font-semibold mt-4 pt-3 border-t border-blue-100">
                        ✓ Insulated cold-chain transit
                    </p>
                </div>

                {/* Free Delivery Condition */}
                <div className="bg-gradient-to-br from-amber-50/80 to-white border border-amber-200/80 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                    <div>
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 bg-amber-100/80 px-2.5 py-1 rounded-full">
                            Free Shipping Threshold
                        </span>
                        <h3 className="text-3xl font-black text-gray-900 mt-3">
                            {currency}{delivery.freeDeliveryThreshold}+
                        </h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Automatic 100% shipping waiver applied directly at cart
                        </p>
                    </div>
                    <p className="text-xs text-amber-800 font-semibold mt-4 pt-3 border-t border-amber-100">
                        ✓ No voucher code required
                    </p>
                </div>
            </div>

            {/* Delivery Zones Section */}
            {Array.isArray(delivery.zones) && delivery.zones.length > 0 && (
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-gray-900">
                                Active Delivery Zones & Coverage Areas
                            </h2>
                            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                                Verified delivery coverage across metropolitan and suburban zones
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {delivery.zones.map((zone, idx) => (
                            <div key={idx} className="bg-white border border-gray-200/80 rounded-3xl p-5 shadow-xs flex flex-col justify-between">
                                <div>
                                    <div className="flex items-center justify-between text-xs font-bold mb-2">
                                        <span className="text-primary">{zone.name}</span>
                                        <span className="text-gray-500">{currency}{zone.charge ?? zone.fee ?? 60} fee</span>
                                    </div>
                                    <p className="text-xs text-gray-400 mb-3">
                                        Delivery window: <strong className="text-gray-700 font-semibold">{zone.estimatedTime}</strong>
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-gray-100">
                                        {Array.isArray(zone.areas) && zone.areas.map((area, aIdx) => (
                                            <span key={aIdx} className="bg-gray-100/80 text-gray-700 text-[11px] font-medium px-2.5 py-0.5 rounded-lg">
                                                {area}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <p className="text-[11px] text-emerald-700 font-medium mt-3 pt-2 border-t border-gray-100">
                                    Free delivery over {currency}{zone.freeDeliveryAbove || delivery.freeDeliveryThreshold}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Delivery FAQ Accordion */}
            <div className="bg-white border border-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-xs">
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 mb-6">
                    Frequently Asked Delivery Questions
                </h2>
                <div className="space-y-3">
                    {deliveryFaqs.map((faq, index) => (
                        <div key={index} className="border border-gray-200/80 rounded-2xl overflow-hidden transition">
                            <button
                                type="button"
                                onClick={() => toggleFaq(index)}
                                className="w-full px-5 py-4 text-left font-bold text-sm text-gray-900 flex justify-between items-center hover:bg-gray-50 transition"
                            >
                                <span>{faq.q}</span>
                                <svg
                                    className={`w-4 h-4 text-gray-500 transform transition-transform ${openFaq === index ? 'rotate-180 text-primary' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {openFaq === index && (
                                <div className="px-5 pb-4 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3 bg-gray-50/50">
                                    {faq.a}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DeliveryInformation;
