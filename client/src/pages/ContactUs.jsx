import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ContactUs = () => {
    const { user, setShowUserLogin, axios } = useAppContext();
    const navigate = useNavigate();

    const [contactSettings, setContactSettings] = useState({
        title: 'Get in Touch with GreenCart',
        description: "Have questions about our produce, your delivery, or corporate grocery orders? We'd love to hear from you.",
        phone: '+880 1700-000000',
        email: 'contact@greencart.com',
        whatsapp: '+880 1700-000000',
        whatsappLink: 'https://wa.me/880170000000',
        address: 'GreenCart Central Logistics Hub, Tejgaon Industrial Area, Dhaka 1208, Bangladesh',
        businessHours: 'Saturday - Thursday: 8:00 AM - 10:00 PM, Friday: 9:00 AM - 8:00 PM',
        googleMapsUrl: '',
        heading: 'Send Us a Message',
        sectionDescription: 'Fill out the form below and our team will get back to you within 24 hours.',
        instructions: '',
        announcement: '',
        socialLinks: {
            facebook: '',
            instagram: '',
            twitter: '',
            x: '',
            youtube: '',
            linkedin: ''
        }
    });

    const [name, setName] = useState(user?.name || '');
    const [email, setEmail] = useState(user?.email || '');
    const [orderNumber, setOrderNumber] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submittedSuccess, setSubmittedSuccess] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    // Fetch dynamic store contact info from Admin CMS
    useEffect(() => {
        window.scrollTo(0, 0);

        const fetchContactInfo = async () => {
            try {
                const { data } = await axios.get(`/api/store-content/public?_t=${Date.now()}`);
                const storePayload = data.content || data.data;
                if (data.success && storePayload?.contact) {
                    setContactSettings(storePayload.contact);
                }
            } catch (err) {
                console.error("Error loading contact settings:", err);
            }
        };

        fetchContactInfo();

        const handleUpdate = () => fetchContactInfo();
        window.addEventListener('storeContentUpdated', handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener('storeContentUpdated', handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [axios]);

    const cleanPhone = (num) => (num || '').replace(/[^0-9+]/g, '');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMsg(null);

        // Validation
        if (!name.trim() || name.trim().length < 2) {
            setErrorMsg("Please enter your full name (at least 2 characters)");
            return;
        }

        if (!email.trim() || !EMAIL_REGEX.test(email.trim())) {
            setErrorMsg("Please enter a valid email address");
            return;
        }

        if (!subject.trim() || subject.trim().length < 3) {
            setErrorMsg("Please enter a subject (at least 3 characters)");
            return;
        }

        if (!message.trim() || message.trim().length < 10) {
            setErrorMsg("Message must be at least 10 characters long");
            return;
        }

        setSubmitting(true);

        // If authenticated, route inquiry directly into the official customer messaging system
        if (user) {
            try {
                const compositeMessage = `[Contact Form Inquiry: ${subject.trim()}${orderNumber.trim() ? ` | Order: #${orderNumber.trim().toUpperCase()}` : ''}]\n\n${message.trim()}`;
                const { data } = await axios.post('/api/chat/customer/initiate', {
                    initialMessage: compositeMessage
                });

                if (data.success) {
                    setSubmittedSuccess(true);
                    toast.success("Support conversation initiated! Check your messages for real-time updates.");
                } else {
                    // Fallback to mailto if chat fails
                    triggerMailtoFallback();
                }
            } catch (err) {
                console.error("Support chat initiation error:", err.message);
                triggerMailtoFallback();
            } finally {
                setSubmitting(false);
            }
        } else {
            // Guest inquiry: Open mail client with pre-composed query
            setSubmitting(false);
            triggerMailtoFallback();
        }
    };

    const triggerMailtoFallback = () => {
        const targetEmail = contactSettings.email || 'support@greencart.com';
        const bodyContent = `Name: ${name.trim()}\nEmail: ${email.trim()}${orderNumber.trim() ? `\nOrder Number: ${orderNumber.trim()}` : ''}\n\nMessage:\n${message.trim()}`;
        const mailtoUrl = `mailto:${targetEmail}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(bodyContent)}`;
        window.location.href = mailtoUrl;
        setSubmittedSuccess(true);
    };

    return (
        <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6 lg:px-8 text-gray-700">
            {/* Header & Breadcrumb */}
            <div className="mb-6 text-center md:text-left">
                <nav className="text-xs text-gray-500 mb-2 flex items-center justify-center md:justify-start gap-2">
                    <Link to="/" className="hover:text-primary transition">Home</Link>
                    <span>/</span>
                    <span className="text-gray-900 font-medium">Contact Us</span>
                </nav>
                <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">
                    {contactSettings.title || 'Get in Touch with GreenCart'}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    {contactSettings.description || "Have questions about our produce, your delivery, or corporate grocery orders? We'd love to hear from you."}
                </p>
            </div>

            {/* Optional Announcement / Notice Banner */}
            {contactSettings.announcement && contactSettings.announcement.trim() && (
                <div className="mb-8 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-xs">
                    <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                    </svg>
                    <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 block">Notice / Announcement</span>
                        <p className="text-xs md:text-sm font-medium mt-0.5">{contactSettings.announcement}</p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Verified Business Information & Channels */}
                <div className="space-y-6">
                    <div className="bg-emerald-950 text-white rounded-3xl p-6 md:p-8 space-y-6 shadow-md">
                        <div>
                            <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider block mb-1">Direct Assistance</span>
                            <h2 className="text-xl font-bold">GreenCart Helpdesk</h2>
                            <p className="text-xs text-emerald-200/80 mt-1 leading-relaxed">
                                Our support team is ready to resolve delivery and order questions promptly.
                            </p>
                        </div>

                        <div className="space-y-4 text-xs md:text-sm text-emerald-100">
                            {contactSettings.email && contactSettings.email.trim() && (
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px] font-medium">Email Support</span>
                                        <a href={`mailto:${contactSettings.email}`} className="font-semibold text-white hover:underline break-all">
                                            {contactSettings.email}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {contactSettings.phone && contactSettings.phone.trim() && (
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px] font-medium">Customer Hotline</span>
                                        <a href={`tel:${cleanPhone(contactSettings.phone)}`} className="font-semibold text-white hover:underline">
                                            {contactSettings.phone}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {contactSettings.whatsapp && contactSettings.whatsapp.trim() && (
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <svg className="w-4 h-4 text-emerald-300 fill-current" viewBox="0 0 24 24">
                                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px] font-medium">WhatsApp Support</span>
                                        <a
                                            href={contactSettings.whatsappLink || `https://wa.me/${cleanPhone(contactSettings.whatsapp)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="font-semibold text-emerald-300 hover:underline"
                                        >
                                            {contactSettings.whatsapp}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {contactSettings.businessHours && contactSettings.businessHours.trim() && (
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px] font-medium">Support Hours</span>
                                        <span className="font-semibold text-white">{contactSettings.businessHours}</span>
                                    </div>
                                </div>
                            )}

                            {(contactSettings.address || contactSettings.googleMapsUrl) && (
                                <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                                        <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px] font-medium">Fulfillment Hub</span>
                                        {contactSettings.address && (
                                            <span className="font-semibold text-white block">{contactSettings.address}</span>
                                        )}
                                        {contactSettings.googleMapsUrl && contactSettings.googleMapsUrl.trim() && (
                                            <a
                                                href={contactSettings.googleMapsUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-emerald-300 hover:text-emerald-200 underline text-[11px] inline-flex items-center gap-1 mt-1 font-medium"
                                            >
                                                <span>View on Google Maps</span>
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Customer Support Instructions */}
                        {contactSettings.instructions && contactSettings.instructions.trim() && (
                            <div className="p-3.5 rounded-2xl bg-emerald-900/60 border border-emerald-700/60 text-emerald-100 flex items-start gap-2.5">
                                <svg className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div className="text-xs">
                                    <span className="font-bold text-white block mb-0.5">Support Instructions</span>
                                    <p className="text-emerald-200/90 leading-relaxed text-[11px]">{contactSettings.instructions}</p>
                                </div>
                            </div>
                        )}

                        {/* Customer Live Chat Channel */}
                        {user ? (
                            <div className="pt-2 border-t border-emerald-800">
                                <Link
                                    to="/messages"
                                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                    </svg>
                                    <span>Open Live Messages</span>
                                </Link>
                            </div>
                        ) : (
                            <div className="pt-2 border-t border-emerald-800">
                                <button
                                    type="button"
                                    onClick={() => setShowUserLogin(true)}
                                    className="w-full py-2.5 px-4 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition"
                                >
                                    Sign In for Live Chat
                                </button>
                            </div>
                        )}

                        {/* Social Links with Modern Vector Icons */}
                        {contactSettings.socialLinks && (
                            Boolean(
                                (contactSettings.socialLinks.facebook && contactSettings.socialLinks.facebook.trim()) ||
                                (contactSettings.socialLinks.instagram && contactSettings.socialLinks.instagram.trim()) ||
                                (contactSettings.socialLinks.youtube && contactSettings.socialLinks.youtube.trim()) ||
                                (contactSettings.socialLinks.linkedin && contactSettings.socialLinks.linkedin.trim()) ||
                                (contactSettings.socialLinks.x && contactSettings.socialLinks.x.trim()) ||
                                (contactSettings.socialLinks.twitter && contactSettings.socialLinks.twitter.trim())
                            )
                        ) && (
                            <div className="pt-3 border-t border-emerald-800/80">
                                <span className="text-[11px] text-emerald-300 font-semibold block mb-2 text-center md:text-left">
                                    Follow GreenCart
                                </span>
                                <div className="flex items-center justify-center md:justify-start gap-2.5 text-emerald-200">
                                    {contactSettings.socialLinks.facebook && contactSettings.socialLinks.facebook.trim() && (
                                        <a
                                            href={contactSettings.socialLinks.facebook}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Facebook"
                                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 hover:text-white flex items-center justify-center transition"
                                        >
                                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                                            </svg>
                                        </a>
                                    )}

                                    {contactSettings.socialLinks.instagram && contactSettings.socialLinks.instagram.trim() && (
                                        <a
                                            href={contactSettings.socialLinks.instagram}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="Instagram"
                                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 hover:text-white flex items-center justify-center transition"
                                        >
                                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                            </svg>
                                        </a>
                                    )}

                                    {contactSettings.socialLinks.youtube && contactSettings.socialLinks.youtube.trim() && (
                                        <a
                                            href={contactSettings.socialLinks.youtube}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="YouTube"
                                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 hover:text-white flex items-center justify-center transition"
                                        >
                                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                                            </svg>
                                        </a>
                                    )}

                                    {contactSettings.socialLinks.linkedin && contactSettings.socialLinks.linkedin.trim() && (
                                        <a
                                            href={contactSettings.socialLinks.linkedin}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="LinkedIn"
                                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 hover:text-white flex items-center justify-center transition"
                                        >
                                            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                            </svg>
                                        </a>
                                    )}

                                    {(contactSettings.socialLinks.x || contactSettings.socialLinks.twitter) && (contactSettings.socialLinks.x || contactSettings.socialLinks.twitter).trim() && (
                                        <a
                                            href={contactSettings.socialLinks.x || contactSettings.socialLinks.twitter}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title="X (Twitter)"
                                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 hover:text-white flex items-center justify-center transition"
                                        >
                                            <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                            </svg>
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column: Contact Inquiry Form */}
                <div className="lg:col-span-2">
                    <div className="bg-white border border-gray-200 rounded-3xl p-6 md:p-8 shadow-xs">
                        <h2 className="text-xl font-bold text-gray-900 mb-1">
                            {contactSettings.heading || contactSettings.sectionHeading || 'Send Us a Message'}
                        </h2>
                        <p className="text-xs text-gray-500 mb-6">
                            {contactSettings.sectionDescription || 'Fill out the form below and our team will get back to you within 24 hours.'}
                        </p>

                        {submittedSuccess ? (
                            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
                                <div className="w-12 h-12 rounded-full bg-emerald-100 text-primary flex items-center justify-center mx-auto">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <h3 className="text-base font-bold text-emerald-950">Inquiry Dispatched Successfully</h3>
                                <p className="text-xs text-emerald-800 max-w-md mx-auto">
                                    {user
                                        ? "Your support message has been sent to our customer service desk. You can monitor replies directly in your account Messages."
                                        : `Your email message draft was created for ${contactSettings.email}. Our team typically replies within 24 hours.`}
                                </p>
                                <div className="pt-2 flex justify-center gap-3">
                                    {user && (
                                        <Link
                                            to="/messages"
                                            className="px-5 py-2 bg-primary text-white text-xs font-bold rounded-full hover:bg-primary-dull transition"
                                        >
                                            View in Messages
                                        </Link>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSubmittedSuccess(false);
                                            setMessage('');
                                            setSubject('');
                                        }}
                                        className="px-5 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-semibold rounded-full hover:bg-gray-50 transition"
                                    >
                                        Send Another Inquiry
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {errorMsg && (
                                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                                        {errorMsg}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                            Your Name *
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Enter your full name"
                                            className="w-full text-sm border border-gray-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                            Email Address *
                                        </label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="your.email@example.com"
                                            className="w-full text-sm border border-gray-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                            Order Number (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={orderNumber}
                                            onChange={(e) => setOrderNumber(e.target.value)}
                                            placeholder="e.g. GC-K7M2Q9"
                                            className="w-full text-sm border border-gray-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                                            Subject *
                                        </label>
                                        <input
                                            type="text"
                                            value={subject}
                                            onChange={(e) => setSubject(e.target.value)}
                                            placeholder="e.g. Delivery delay inquiry"
                                            className="w-full text-sm border border-gray-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-semibold text-gray-700 uppercase">
                                            Your Message *
                                        </label>
                                        <span className="text-[11px] text-gray-400">{message.length}/2000 chars</span>
                                    </div>
                                    <textarea
                                        rows={4}
                                        maxLength={2000}
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Please describe your inquiry or issue in detail..."
                                        className="w-full text-sm border border-gray-300 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-medium"
                                        required
                                    />
                                </div>

                                <div className="pt-2 flex items-center justify-between">
                                    <p className="text-[11px] text-gray-400">
                                        * Required fields. We protect your personal information.
                                    </p>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-8 py-3 bg-primary hover:bg-primary-dull text-white text-sm font-bold rounded-2xl shadow-xs transition transform active:scale-98 disabled:opacity-50 cursor-pointer"
                                    >
                                        {submitting ? "Sending..." : "Submit Inquiry"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactUs;
