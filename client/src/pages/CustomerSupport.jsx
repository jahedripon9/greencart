import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const CustomerSupport = () => {
    const { axios, user } = useAppContext();
    const [supportData, setSupportData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSupportContent = async () => {
            try {
                const { data } = await axios.get(`/api/store-content/public?_t=${Date.now()}`);
                const payload = data.content || data.data;
                if (data.success && payload?.support) {
                    setSupportData(payload.support);
                }
            } catch (err) {
                console.error("Failed to load support content:", err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchSupportContent();

        const handleUpdate = () => fetchSupportContent();
        window.addEventListener('storeContentUpdated', handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener('storeContentUpdated', handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [axios]);

    // Fallback defaults
    const support = supportData || {
        title: "Customer Support & Helpdesk",
        description: "We are committed to delivering the freshest groceries and supporting your shopping experience 7 days a week.",
        phone: "+880 1700-000000",
        email: "support@greencart.com",
        whatsapp: "+880 1700-000000",
        whatsappLink: "https://wa.me/8801700000000",
        businessHours: "8:00 AM - 10:00 PM (Everyday)",
        businessAddress: "GreenCart Central Logistics Hub, Tejgaon Industrial Area, Dhaka 1208, Bangladesh",
        instructions: "For urgent order inquiries, please have your Order ID ready when contacting our support agents."
    };

    return (
        <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 text-gray-700">
            {/* Header & Breadcrumb */}
            <div className="mb-8 text-center md:text-left">
                <nav className="text-xs text-gray-500 mb-2 flex items-center justify-center md:justify-start gap-2">
                    <Link to="/" className="hover:text-primary transition font-medium">Home</Link>
                    <span>/</span>
                    <span className="text-gray-900 font-semibold">Customer Support</span>
                </nav>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
                            {support.title}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1 max-w-2xl leading-relaxed">
                            {support.description}
                        </p>
                    </div>
                    <Link
                        to="/contact"
                        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary-dull text-white text-sm font-bold rounded-2xl shadow-xs transition"
                    >
                        <span>Send Message</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </Link>
                </div>
            </div>

            {/* Quick Contact Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
                {/* 1. Phone Card */}
                <div className="bg-white border border-gray-200/80 rounded-3xl p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                        </div>
                        <div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Phone Support</span>
                            <h3 className="text-base font-extrabold text-gray-900">Direct Call</h3>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                        Speak directly with a support specialist for urgent delivery coordination or questions.
                    </p>
                    <a
                        href={`tel:${support.phone.replace(/[^0-9+]/g, '')}`}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold rounded-xl border border-emerald-200 transition"
                    >
                        <span>Call {support.phone}</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </a>
                </div>

                {/* 2. WhatsApp Card */}
                <div className="bg-white border border-gray-200/80 rounded-3xl p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                        </div>
                        <div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Instant Chat</span>
                            <h3 className="text-base font-extrabold text-gray-900">WhatsApp Help</h3>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                        Chat directly with our support team on WhatsApp for fast photo sharing and live updates.
                    </p>
                    <a
                        href={`https://wa.me/${(support.whatsapp || '').replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-900 text-xs font-bold rounded-xl border border-teal-200 transition"
                    >
                        <span>Chat {support.whatsapp}</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                </div>

                {/* 3. Email Card */}
                <div className="bg-white border border-gray-200/80 rounded-3xl p-6 shadow-xs hover:shadow-md transition flex flex-col justify-between">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center shrink-0">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Email Inquiry</span>
                            <h3 className="text-base font-extrabold text-gray-900">Official Support</h3>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                        Send detailed order receipts, corporate requests, or account inquiries to our inbox.
                    </p>
                    <a
                        href={`mailto:${support.email}?subject=GreenCart%20Support%20Inquiry`}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-900 text-xs font-bold rounded-xl border border-sky-200 transition"
                    >
                        <span>Email {support.email}</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </a>
                </div>
            </div>

            {/* Operating Hours & Business Address */}
            <div className="bg-gradient-to-br from-emerald-50/70 via-teal-50/30 to-white border border-emerald-200/80 rounded-3xl p-6 sm:p-8 shadow-xs mb-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2.5 text-primary font-bold text-xs uppercase tracking-wider">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span>Availability & Working Hours</span>
                        </div>
                        <h2 className="text-2xl font-extrabold text-gray-900">
                            When can you reach us?
                        </h2>
                        <div className="bg-white/80 backdrop-blur-xs rounded-2xl p-4 border border-emerald-100 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold text-gray-700">Customer Support Desk:</span>
                                <span className="font-bold text-emerald-800">{support.businessHours}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold text-gray-700">Delivery Dispatch Window:</span>
                                <span className="font-bold text-emerald-800">9:00 AM - 8:00 PM (Daily)</span>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed">
                            {support.instructions}
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center gap-2.5 text-primary font-bold text-xs uppercase tracking-wider">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span>Central Logistics & Operations Hub</span>
                        </div>
                        <h2 className="text-2xl font-extrabold text-gray-900">
                            Visit or Send Mail
                        </h2>
                        <div className="bg-white/80 backdrop-blur-xs rounded-2xl p-4 border border-emerald-100 flex items-start gap-3">
                            <svg className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <p className="text-sm font-medium text-gray-700 leading-relaxed">
                                {support.businessAddress || support.address}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Link
                                to="/faqs"
                                className="px-4 py-2 bg-white hover:bg-emerald-50 text-gray-800 text-xs font-bold rounded-xl border border-gray-200 transition"
                            >
                                Browse FAQs
                            </Link>
                            <Link
                                to="/my-orders"
                                className="px-4 py-2 bg-white hover:bg-emerald-50 text-gray-800 text-xs font-bold rounded-xl border border-gray-200 transition"
                            >
                                Track / Return Order
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerSupport;
