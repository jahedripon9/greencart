import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const CATEGORIES = [
    { id: 'all', label: 'All Questions' },
    { id: 'orders', label: 'Orders & Delivery' },
    { id: 'payments', label: 'Payments' },
    { id: 'returns', label: 'Returns & Refunds' },
    { id: 'account', label: 'Account & Security' },
    { id: 'products', label: 'Products & Quality' },
    { id: 'general', label: 'General' }
];

const FAQsPage = () => {
    const { axios } = useAppContext();
    const [faqs, setFaqs] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedIds, setExpandedIds] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        window.scrollTo(0, 0);

        const fetchFaqs = async () => {
            setLoading(true);
            try {
                const { data } = await axios.get(`/api/store-content/faqs?_t=${Date.now()}`);
                if (data.success) {
                    setFaqs(data.faqs || []);
                    // Expand the first FAQ by default for welcoming user experience
                    if (data.faqs && data.faqs.length > 0) {
                        setExpandedIds({ [data.faqs[0]._id]: true });
                    }
                } else {
                    setFaqs([]);
                }
            } catch (err) {
                console.error("Error loading FAQs:", err);
                setError("Unable to load frequently asked questions at this moment.");
            } finally {
                setLoading(false);
            }
        };

        fetchFaqs();

        const handleUpdate = () => fetchFaqs();
        window.addEventListener('storeContentUpdated', handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener('storeContentUpdated', handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [axios]);

    const toggleFaq = (id) => {
        setExpandedIds((prev) => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const expandAll = () => {
        const next = {};
        filteredFaqs.forEach((f) => {
            next[f._id] = true;
        });
        setExpandedIds(next);
    };

    const collapseAll = () => {
        setExpandedIds({});
    };

    // Filter FAQs by category and search text
    const filteredFaqs = useMemo(() => {
        return faqs.filter((faq) => {
            const matchesCategory =
                selectedCategory === 'all' || faq.category === selectedCategory;

            if (!matchesCategory) return false;

            if (!searchQuery.trim()) return true;

            const query = searchQuery.toLowerCase();
            const questionMatch = faq.question?.toLowerCase().includes(query);
            const answerMatch = faq.answer?.toLowerCase().includes(query);
            return questionMatch || answerMatch;
        });
    }, [faqs, selectedCategory, searchQuery]);

    return (
        <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-gray-700">
            {/* Breadcrumb Navigation */}
            <nav className="text-xs text-gray-500 mb-4 flex items-center gap-2">
                <Link to="/" className="hover:text-primary transition">Home</Link>
                <span>/</span>
                <span className="text-gray-900 font-medium">Frequently Asked Questions</span>
            </nav>

            {/* Header Hero */}
            <div className="text-center max-w-2xl mx-auto mb-8">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-3">
                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Help & Answers
                </span>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight mb-2">
                    Frequently Asked Questions
                </h1>
                <p className="text-sm text-gray-500">
                    Find quick answers to common questions about ordering, delivery, payments, and our refund policies.
                </p>

                {/* Search Input */}
                <div className="mt-6 relative max-w-lg mx-auto">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search questions by keyword (e.g. delivery, bKash, refund)..."
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent shadow-xs font-medium"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs text-gray-400 hover:text-gray-600"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
                {CATEGORIES.map((cat) => {
                    const active = selectedCategory === cat.id;
                    return (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${active
                                ? 'bg-primary text-white shadow-xs'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                        >
                            {cat.label}
                        </button>
                    );
                })}
            </div>

            {/* Expand / Collapse Quick Controls */}
            {filteredFaqs.length > 0 && (
                <div className="flex items-center justify-between mb-4 px-1">
                    <span className="text-xs text-gray-500 font-medium">
                        Showing {filteredFaqs.length} {filteredFaqs.length === 1 ? 'question' : 'questions'}
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={expandAll}
                            className="text-xs text-primary hover:underline font-medium"
                        >
                            Expand All
                        </button>
                        <span className="text-gray-300">|</span>
                        <button
                            type="button"
                            onClick={collapseAll}
                            className="text-xs text-gray-500 hover:underline font-medium"
                        >
                            Collapse All
                        </button>
                    </div>
                </div>
            )}

            {/* FAQ List */}
            {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl mb-6">
                    {error}
                </div>
            )}

            {loading ? (
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="bg-white border border-gray-100 rounded-2xl p-5 animate-pulse">
                            <div className="h-5 bg-gray-200 rounded w-2/3 mb-2" />
                            <div className="h-4 bg-gray-100 rounded w-full" />
                        </div>
                    ))}
                </div>
            ) : filteredFaqs.length > 0 ? (
                <div className="space-y-3">
                    {filteredFaqs.map((faq) => {
                        const isExpanded = !!expandedIds[faq._id];

                        return (
                            <div
                                key={faq._id}
                                className={`border rounded-2xl transition duration-200 overflow-hidden ${isExpanded
                                    ? 'bg-white border-primary/40 shadow-xs'
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                    }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleFaq(faq._id)}
                                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 cursor-pointer focus:outline-none"
                                >
                                    <span className="text-sm sm:text-base font-bold text-gray-900">
                                        {faq.question}
                                    </span>
                                    <span
                                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-sm transition-transform duration-200 ${isExpanded
                                            ? 'bg-primary text-white rotate-180'
                                            : 'bg-gray-100 text-gray-600'
                                            }`}
                                    >
                                        ↓
                                    </span>
                                </button>

                                {isExpanded && (
                                    <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-gray-100 whitespace-pre-line">
                                        {faq.answer}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-16 bg-gray-50 rounded-3xl border border-gray-200/60 p-8">
                    <div className="w-14 h-14 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-base font-bold text-gray-800 mb-1">No matching questions found</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
                        {searchQuery
                            ? `We couldn't find any questions matching "${searchQuery}". Try a different keyword or contact our support team.`
                            : "There are currently no questions published in this category."}
                    </p>
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="text-xs font-semibold text-primary hover:underline"
                        >
                            Clear search filter
                        </button>
                    )}
                </div>
            )}

            {/* Need More Assistance Support Banner */}
            <div className="mt-12 bg-linear-to-r from-emerald-950 to-teal-950 text-white rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xs">
                <div>
                    <h3 className="text-lg font-bold">Still have questions?</h3>
                    <p className="text-xs text-emerald-200/80 mt-1 max-w-md leading-relaxed">
                        Cannot find the answer you are looking for? Our friendly customer support team is available every day.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3 shrink-0">
                    <Link
                        to="/contact"
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition shadow-xs"
                    >
                        Send Inquiry
                    </Link>
                    <Link
                        to="/contact-support"
                        className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition"
                    >
                        Customer Support Info
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default FAQsPage;
