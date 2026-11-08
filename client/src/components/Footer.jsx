import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { assets, footerLinks } from "../assets/assets";
import { useAppContext } from "../context/AppContext";

const Footer = () => {
    const { axios } = useAppContext();
    const [storeContent, setStoreContent] = useState(null);

    useEffect(() => {
        const fetchFooterInfo = async () => {
            try {
                const { data } = await axios.get(`/api/store-content/public?_t=${Date.now()}`);
                const payload = data.content || data.data;
                if (data.success && payload) {
                    setStoreContent(payload);
                }
            } catch (err) {
                // Ignore silent footer load errors
            }
        };

        fetchFooterInfo();

        const handleUpdate = () => fetchFooterInfo();
        window.addEventListener('storeContentUpdated', handleUpdate);
        window.addEventListener('storage', handleUpdate);
        return () => {
            window.removeEventListener('storeContentUpdated', handleUpdate);
            window.removeEventListener('storage', handleUpdate);
        };
    }, [axios]);

    const supportInfo = storeContent?.support || {};
    const contactInfo = storeContent?.contact || {};
    const socialLinks = contactInfo.socialLinks || {};

    const activePhone = supportInfo.phone || contactInfo.phone;
    const activeEmail = supportInfo.email || contactInfo.email;

    // Dynamically enrich footer sections with latest configured social links
    const enrichedSections = footerLinks.map(section => {
        if (section.title === "Follow Us") {
            return {
                ...section,
                links: [
                    { text: "Instagram", url: socialLinks.instagram || "https://instagram.com/greencart" },
                    { text: "Twitter", url: socialLinks.twitter || "https://twitter.com/greencart" },
                    { text: "Facebook", url: socialLinks.facebook || "https://facebook.com/greencart" },
                    { text: "LinkedIn", url: socialLinks.linkedin || "https://linkedin.com/company/greencart" },
                ].filter(l => l.url)
            };
        }
        return section;
    });

    return (
        <footer className="px-6 md:px-16 lg:px-24 xl:px-32 mt-24 bg-primary/10 border-t border-emerald-100" aria-label="Footer">
            <div className="flex flex-col md:flex-row items-start justify-between gap-10 py-12 border-b border-gray-500/20 text-gray-500">
                <div>
                    <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                        <img className="w-36 md:w-40" src={assets.logo} alt="GreenCart Grocery" />
                    </Link>
                    <p className="max-w-[410px] mt-4 text-sm leading-relaxed text-gray-600">
                        GreenCart delivers fresh organic vegetables, pure dairy, pantry staples, and healthy groceries directly from local farms to your doorstep across Dhaka.
                    </p>
                    <div className="mt-4 flex items-center gap-3 text-xs text-emerald-800 font-semibold">
                        <span className="flex items-center gap-1.5 bg-emerald-100/80 px-2.5 py-1 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>100% Quality Guaranteed</span>
                        </span>
                        <span className="flex items-center gap-1.5 bg-emerald-100/80 px-2.5 py-1 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span>Cash on Delivery</span>
                        </span>
                    </div>

                    {(activePhone || activeEmail) && (
                        <div className="mt-4 pt-3 border-t border-emerald-200/50 text-xs text-gray-600 space-y-1.5">
                            {activePhone && (
                                <p className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-800">Hotline:</span>
                                    <a href={`tel:${activePhone.replace(/[^0-9+]/g, '')}`} className="hover:text-primary transition font-medium">
                                        {activePhone}
                                    </a>
                                </p>
                            )}
                            {activeEmail && (
                                <p className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-800">Support:</span>
                                    <a href={`mailto:${activeEmail}`} className="hover:text-primary transition font-medium">
                                        {activeEmail}
                                    </a>
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap justify-between w-full md:w-[50%] gap-6">
                    {enrichedSections.map((section, index) => (
                        <div key={index} className="min-w-[130px]">
                            <h3 className="font-bold text-sm uppercase tracking-wider text-gray-900 md:mb-4 mb-2">
                                {section.title}
                            </h3>
                            <ul className="text-sm space-y-2">
                                {section.links.map((link, i) => (
                                    <li key={i}>
                                        {link.url && link.url.startsWith('/') ? (
                                            <Link
                                                to={link.url}
                                                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                                className="hover:text-primary transition-colors font-medium"
                                            >
                                                {link.text}
                                            </Link>
                                        ) : (
                                            <a
                                                href={link.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hover:text-primary transition-colors font-medium inline-flex items-center gap-1"
                                            >
                                                <span>{link.text}</span>
                                                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>

            <div className="py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
                <p>
                    Copyright {new Date().getFullYear()} © <span className="font-bold text-primary">GreenCart Bangladesh</span>. All Rights Reserved.
                </p>
                <div className="flex items-center gap-4">
                    <Link to="/return-policy" className="hover:underline">Return Policy</Link>
                    <span>•</span>
                    <Link to="/delivery-information" className="hover:underline">Delivery Terms</Link>
                    <span>•</span>
                    <Link to="/payment-methods" className="hover:underline">Payment Methods</Link>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
