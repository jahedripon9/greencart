import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Store,
    PlusCircle,
    Edit3,
    Trash2,
    CheckCircle2,
    AlertCircle,
    X,
    RefreshCw,
    Phone,
    Mail,
    MapPin,
    Clock,
    DollarSign,
    Percent,
    Ticket,
    Shield,
    RotateCcw
} from '../../components/seller/SellerIcons';

const TABS = [
    { id: 'support', name: 'Customer Support', icon: Phone },
    { id: 'delivery', name: 'Delivery Information', icon: MapPin },
    { id: 'returns', name: 'Return & Refund Policy', icon: RotateCcw },
    { id: 'payments', name: 'Payment Methods', icon: DollarSign },
    { id: 'bestsellers', name: 'Best Sellers', icon: Store },
    { id: 'deals', name: 'Offers & Deals', icon: Percent },
    { id: 'contact', name: 'Contact Us', icon: Mail },
    { id: 'faqs', name: 'FAQs Management', icon: Shield }
];

const FAQ_CATEGORIES = [
    { id: 'orders', label: 'Orders & Delivery' },
    { id: 'payments', label: 'Payments' },
    { id: 'returns', label: 'Returns & Refunds' },
    { id: 'account', label: 'Account & Security' },
    { id: 'products', label: 'Products & Quality' },
    { id: 'general', label: 'General' }
];

const StoreContentManagement = () => {
    const { axios, currency } = useAppContext();
    const [activeTab, setActiveTab] = useState('support');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Store Content state (support, delivery, payments, bestSellers, offersDeals, contact, faqs)
    const [contentData, setContentData] = useState(null);
    const [savedContact, setSavedContact] = useState(null);
    const [contactNotice, setContactNotice] = useState(null);

    // Separate Return Policy state (connected to ReturnRefundPolicy model)
    const [returnPolicyData, setReturnPolicyData] = useState(null);

    // FAQ CRUD state
    const [faqsList, setFaqsList] = useState([]);
    const [faqCategoryFilter, setFaqCategoryFilter] = useState('all');
    const [faqSearch, setFaqSearch] = useState('');
    const [showFaqModal, setShowFaqModal] = useState(false);
    const [editingFaq, setEditingFaq] = useState(null);
    const [faqFormData, setFaqFormData] = useState({
        question: '',
        answer: '',
        category: 'general',
        displayOrder: 0,
        isPublished: true
    });
    const [showDeleteFaqModal, setShowDeleteFaqModal] = useState(false);
    const [faqToDelete, setFaqToDelete] = useState(null);

    // Load initial data
    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [storeRes, returnRes] = await Promise.allSettled([
                axios.get('/api/store-content/admin'),
                axios.get('/api/seller/returns/policy')
            ]);

            if (storeRes.status === 'fulfilled' && storeRes.value?.data?.success) {
                const data = storeRes.value.data.content || storeRes.value.data.data;
                setContentData(data);
                if (data.contact) {
                    setSavedContact(JSON.parse(JSON.stringify(data.contact)));
                }
                setFaqsList(data.faqs || []);
            } else {
                toast.error("Failed to load store content settings");
            }

            if (returnRes.status === 'fulfilled' && returnRes.value?.data?.success) {
                setReturnPolicyData(returnRes.value.data.policy);
            }
        } catch (err) {
            console.error("Error loading store content:", err);
            toast.error("Error fetching store management settings");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // -------------------------------------------------------------------------
    // Tab Save Handlers
    // -------------------------------------------------------------------------

    const notifyContentUpdated = (sectionName) => {
        window.dispatchEvent(new CustomEvent('storeContentUpdated', { detail: { section: sectionName } }));
        try {
            localStorage.setItem('greencart_content_updated', Date.now().toString());
        } catch {
            // Ignore storage error
        }
    };

    // Save Section in StoreContent
    const handleSaveSection = async (sectionName, sectionPayload) => {
        setSaving(true);
        try {
            const { data } = await axios.put(`/api/store-content/admin/section/${sectionName}`, {
                sectionData: sectionPayload
            });

            if (data.success) {
                toast.success(`${sectionName.charAt(0).toUpperCase() + sectionName.slice(1)} settings updated successfully!`);
                const updatedPayload = data.content || data.data;
                if (updatedPayload && updatedPayload[sectionName]) {
                    setContentData(prev => ({
                        ...prev,
                        [sectionName]: updatedPayload[sectionName]
                    }));
                }
                if (sectionName === 'contact') {
                    const saved = updatedPayload?.contact || sectionPayload;
                    setSavedContact(JSON.parse(JSON.stringify(saved)));
                    setContactNotice(`Contact Us settings saved successfully at ${new Date().toLocaleTimeString()}`);
                    setTimeout(() => setContactNotice(null), 8000);
                }
                notifyContentUpdated(sectionName);
                fetchAllData();
            } else {
                toast.error(data.message || "Failed to update settings");
            }
        } catch (err) {
            console.error(`Error saving ${sectionName}:`, err);
            toast.error(err.response?.data?.message || `Failed to update ${sectionName} settings`);
        } finally {
            setSaving(false);
        }
    };

    // Save Payment Methods
    const handleSavePayments = async (methods) => {
        setSaving(true);
        try {
            const { data } = await axios.put('/api/store-content/admin/payments', {
                paymentMethods: methods
            });

            if (data.success) {
                toast.success("Payment methods updated successfully!");
                setContentData(prev => ({
                    ...prev,
                    paymentMethods: data.paymentMethods
                }));
                notifyContentUpdated('payments');
                fetchAllData();
            } else {
                toast.error(data.message || "Failed to update payment methods");
            }
        } catch (err) {
            console.error("Error saving payment methods:", err);
            toast.error(err.response?.data?.message || "Failed to update payment methods");
        } finally {
            setSaving(false);
        }
    };

    // Save Return Policy (to ReturnRefundPolicy model)
    const handleSaveReturnPolicy = async () => {
        if (!returnPolicyData) return;
        setSaving(true);
        try {
            const { data } = await axios.put('/api/seller/returns/policy', returnPolicyData);
            if (data.success) {
                toast.success("Return & Refund Policy updated successfully!");
                setReturnPolicyData(data.policy);
                notifyContentUpdated('returns');
            } else {
                toast.error(data.message || "Failed to update return policy");
            }
        } catch (err) {
            console.error("Error saving return policy:", err);
            toast.error(err.response?.data?.message || "Failed to update return policy");
        } finally {
            setSaving(false);
        }
    };

    // -------------------------------------------------------------------------
    // FAQ CRUD Handlers
    // -------------------------------------------------------------------------

    const handleOpenCreateFaq = () => {
        setEditingFaq(null);
        setFaqFormData({
            question: '',
            answer: '',
            category: 'general',
            displayOrder: faqsList.length,
            isPublished: true
        });
        setShowFaqModal(true);
    };

    const handleOpenEditFaq = (faq) => {
        setEditingFaq(faq);
        setFaqFormData({
            question: faq.question,
            answer: faq.answer,
            category: faq.category || 'general',
            displayOrder: typeof faq.displayOrder === 'number' ? faq.displayOrder : 0,
            isPublished: faq.isPublished !== false
        });
        setShowFaqModal(true);
    };

    const handleSaveFaq = async (e) => {
        e.preventDefault();
        if (!faqFormData.question.trim() || !faqFormData.answer.trim()) {
            toast.error("Question and answer are required");
            return;
        }

        setSaving(true);
        try {
            if (editingFaq) {
                // Update existing
                const { data } = await axios.put(`/api/store-content/admin/faqs/${editingFaq._id}`, faqFormData);
                if (data.success) {
                    toast.success("FAQ updated successfully");
                    setShowFaqModal(false);
                    notifyContentUpdated('faqs');
                    fetchAllData();
                } else {
                    toast.error(data.message || "Failed to update FAQ");
                }
            } else {
                // Create new
                const { data } = await axios.post('/api/store-content/admin/faqs', faqFormData);
                if (data.success) {
                    toast.success("FAQ created successfully");
                    setShowFaqModal(false);
                    notifyContentUpdated('faqs');
                    fetchAllData();
                } else {
                    toast.error(data.message || "Failed to create FAQ");
                }
            }
        } catch (err) {
            console.error("Error saving FAQ:", err);
            toast.error(err.response?.data?.message || "Error saving FAQ");
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteFaq = async () => {
        if (!faqToDelete) return;
        setSaving(true);
        try {
            const { data } = await axios.delete(`/api/store-content/admin/faqs/${faqToDelete._id}`);
            if (data.success) {
                toast.success("FAQ deleted successfully");
                setShowDeleteFaqModal(false);
                setFaqToDelete(null);
                notifyContentUpdated('faqs');
                fetchAllData();
            } else {
                toast.error(data.message || "Failed to delete FAQ");
            }
        } catch (err) {
            console.error("Error deleting FAQ:", err);
            toast.error(err.response?.data?.message || "Failed to delete FAQ");
        } finally {
            setSaving(false);
        }
    };

    const handleToggleFaqPublished = async (faq) => {
        try {
            const updatedPublished = !faq.isPublished;
            const { data } = await axios.put(`/api/store-content/admin/faqs/${faq._id}`, {
                isPublished: updatedPublished
            });
            if (data.success) {
                toast.success(updatedPublished ? "FAQ published" : "FAQ unpublished");
                setFaqsList(prev => prev.map(f => f._id === faq._id ? { ...f, isPublished: updatedPublished } : f));
                notifyContentUpdated('faqs');
            }
        } catch (err) {
            toast.error("Failed to toggle publish status");
        }
    };

    // -------------------------------------------------------------------------
    // Render Functions for Tabs
    // -------------------------------------------------------------------------

    // TAB 1: Support Settings
    const renderSupportTab = () => {
        const support = contentData?.support || {};

        return (
            <div className="space-y-6">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
                    <h3 className="text-base font-bold text-slate-800 mb-1">Customer Support Configuration</h3>
                    <p className="text-xs text-slate-500 mb-6">
                        Manage your customer support desk information, contact hotline, WhatsApp number, and operational hours.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Page Title</label>
                            <input
                                type="text"
                                value={support.title || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    support: { ...prev.support, title: e.target.value }
                                }))}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Page Description</label>
                            <textarea
                                rows={2}
                                value={support.description || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    support: { ...prev.support, description: e.target.value }
                                }))}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Support Phone Number</label>
                            <input
                                type="text"
                                value={support.phone || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    support: { ...prev.support, phone: e.target.value }
                                }))}
                                placeholder="+880 1700-000000"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Support Email Address</label>
                            <input
                                type="email"
                                value={support.email || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    support: { ...prev.support, email: e.target.value }
                                }))}
                                placeholder="support@greencart.com"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">WhatsApp Support Number</label>
                            <input
                                type="text"
                                value={support.whatsapp || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    support: {
                                        ...prev.support,
                                        whatsapp: e.target.value,
                                        whatsappLink: e.target.value ? `https://wa.me/${e.target.value.replace(/[^0-9]/g, '')}` : ''
                                    }
                                }))}
                                placeholder="+880 1700-000000"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Support Availability / Business Hours</label>
                            <input
                                type="text"
                                value={support.businessHours || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    support: { ...prev.support, businessHours: e.target.value }
                                }))}
                                placeholder="8:00 AM - 10:00 PM (Everyday)"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Fulfillment Hub / Business Address</label>
                            <input
                                type="text"
                                value={support.businessAddress || support.address || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    support: {
                                        ...prev.support,
                                        businessAddress: e.target.value,
                                        address: e.target.value
                                    }
                                }))}
                                placeholder="Tejgaon Central Hub, Dhaka, Bangladesh"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Additional Support Guidelines</label>
                            <textarea
                                rows={3}
                                value={support.instructions || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    support: { ...prev.support, instructions: e.target.value }
                                }))}
                                placeholder="Provide extra instructions for order cancellations, live chat, or urgent inquiries..."
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleSaveSection('support', support)}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? 'Saving...' : 'Save Customer Support Settings'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // TAB 2: Delivery Settings
    const renderDeliveryTab = () => {
        const delivery = contentData?.delivery || {};
        const zones = delivery.zones || delivery.deliveryZones || [];

        const updateZone = (index, field, value) => {
            const nextZones = [...zones];
            nextZones[index] = { ...nextZones[index], [field]: value };
            if (field === 'charge') nextZones[index].fee = value;
            if (field === 'fee') nextZones[index].charge = value;
            setContentData(prev => ({
                ...prev,
                delivery: { ...prev.delivery, zones: nextZones, deliveryZones: nextZones }
            }));
        };

        const addZone = () => {
            const newZone = {
                name: 'New Delivery Zone',
                estimatedTime: '24–48 Hours',
                charge: 60,
                fee: 60,
                freeDeliveryAbove: 1000,
                areas: ['All Local Areas']
            };
            setContentData(prev => ({
                ...prev,
                delivery: { ...prev.delivery, zones: [...zones, newZone], deliveryZones: [...zones, newZone] }
            }));
        };

        const removeZone = (index) => {
            const nextZones = zones.filter((_, i) => i !== index);
            setContentData(prev => ({
                ...prev,
                delivery: { ...prev.delivery, zones: nextZones, deliveryZones: nextZones }
            }));
        };

        return (
            <div className="space-y-6">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
                    <h3 className="text-base font-bold text-slate-800 mb-1">Delivery Information & Rates</h3>
                    <p className="text-xs text-slate-500 mb-6">
                        Configure delivery fees, standard delivery times, free shipping threshold, and zone management.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Page Title</label>
                            <input
                                type="text"
                                value={delivery.title || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    delivery: { ...prev.delivery, title: e.target.value }
                                }))}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Inside-City Delivery Charge ({currency})</label>
                            <input
                                type="number"
                                min="0"
                                value={delivery.insideCityCharge ?? delivery.standardCharge ?? 60}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    delivery: {
                                        ...prev.delivery,
                                        insideCityCharge: Number(e.target.value),
                                        standardCharge: Number(e.target.value)
                                    }
                                }))}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Outside-City Delivery Charge ({currency})</label>
                            <input
                                type="number"
                                min="0"
                                value={delivery.outsideCityCharge ?? 120}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    delivery: { ...prev.delivery, outsideCityCharge: Number(e.target.value) }
                                }))}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Express Delivery Charge ({currency})</label>
                            <input
                                type="number"
                                min="0"
                                value={delivery.expressCharge ?? 150}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    delivery: { ...prev.delivery, expressCharge: Number(e.target.value) }
                                }))}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Free Delivery Minimum Order ({currency})</label>
                            <input
                                type="number"
                                min="0"
                                value={delivery.freeDeliveryThreshold ?? 1000}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    delivery: { ...prev.delivery, freeDeliveryThreshold: Number(e.target.value) }
                                }))}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Estimated Time (Inside City)</label>
                            <input
                                type="text"
                                value={delivery.estimatedTimeInsideCity || delivery.estimatedTimeInside || '24–48 Hours'}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    delivery: {
                                        ...prev.delivery,
                                        estimatedTimeInsideCity: e.target.value,
                                        estimatedTimeInside: e.target.value
                                    }
                                }))}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Estimated Time (Outside City)</label>
                            <input
                                type="text"
                                value={delivery.estimatedTimeOutsideCity || delivery.estimatedTimeOutside || '48–72 Hours'}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    delivery: {
                                        ...prev.delivery,
                                        estimatedTimeOutsideCity: e.target.value,
                                        estimatedTimeOutside: e.target.value
                                    }
                                }))}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Estimated Time (Express Service)</label>
                            <input
                                type="text"
                                value={delivery.estimatedTimeExpress || '60–90 Minutes'}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    delivery: { ...prev.delivery, estimatedTimeExpress: e.target.value }
                                }))}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Special Handling / Cold Chain Instructions</label>
                            <textarea
                                rows={2}
                                value={delivery.instructions || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    delivery: { ...prev.delivery, instructions: e.target.value }
                                }))}
                                placeholder="Notes about insulated packaging, frozen goods handling, or verification requirements..."
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Delivery Zones Sub-editor */}
                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h4 className="text-sm font-bold text-slate-800">Custom Delivery Zones & Coverage</h4>
                                <p className="text-xs text-slate-500">Configure regional zones, specific areas, and flat rates</p>
                            </div>
                            <button
                                type="button"
                                onClick={addZone}
                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                            >
                                <PlusCircle className="w-4 h-4" />
                                Add Zone
                            </button>
                        </div>

                        <div className="space-y-4">
                            {zones.map((zone, idx) => (
                                <div key={idx} className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 relative">
                                    <button
                                        type="button"
                                        onClick={() => removeZone(idx)}
                                        className="absolute top-3 right-3 text-slate-400 hover:text-rose-600 transition"
                                        title="Delete Zone"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mr-6">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Zone Name</label>
                                            <input
                                                type="text"
                                                value={zone.name || ''}
                                                onChange={(e) => updateZone(idx, 'name', e.target.value)}
                                                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Estimated Timeline</label>
                                            <input
                                                type="text"
                                                value={zone.estimatedTime || ''}
                                                onChange={(e) => updateZone(idx, 'estimatedTime', e.target.value)}
                                                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Delivery Fee ({currency})</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={zone.charge ?? zone.fee ?? 0}
                                                onChange={(e) => updateZone(idx, 'charge', Number(e.target.value))}
                                                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            />
                                        </div>

                                        <div className="sm:col-span-3">
                                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                                                Covered Areas (comma separated)
                                            </label>
                                            <input
                                                type="text"
                                                value={Array.isArray(zone.areas) ? zone.areas.join(', ') : (zone.areas || '')}
                                                onChange={(e) => {
                                                    const areasArray = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                                                    updateZone(idx, 'areas', areasArray);
                                                }}
                                                placeholder="e.g. Uttara, Gulshan, Banani, Dhanmondi"
                                                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleSaveSection('delivery', delivery)}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? 'Saving...' : 'Save Delivery Settings'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // TAB 3: Return Policy Settings (Interfacing directly with existing ReturnRefundPolicy model)
    const renderReturnsTab = () => {
        const policy = returnPolicyData || {};

        return (
            <div className="space-y-6">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Return & Refund Policy Settings</h3>
                            <p className="text-xs text-slate-500">
                                This configuration syncs customer-facing return policy terms directly with backend return request validation rules.
                            </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-full text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Synchronized System Policy
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Return Window (Days from Delivery)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="90"
                                value={policy.returnWindowDays ?? 7}
                                onChange={(e) => setReturnPolicyData(prev => ({
                                    ...prev,
                                    returnWindowDays: Number(e.target.value)
                                }))}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                                Customers can initiate returns within this window following successful delivery.
                            </span>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Refund Processing Estimate
                            </label>
                            <input
                                type="text"
                                value={policy.refundProcessingEstimate || '3-5 business days'}
                                onChange={(e) => setReturnPolicyData(prev => ({
                                    ...prev,
                                    refundProcessingEstimate: e.target.value
                                }))}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                                Displayed to customers upon return approval.
                            </span>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Eligible Return Reasons (one per line)
                            </label>
                            <textarea
                                rows={4}
                                value={Array.isArray(policy.eligibleReasons) ? policy.eligibleReasons.join('\n') : (policy.eligibleReasons || '')}
                                onChange={(e) => setReturnPolicyData(prev => ({
                                    ...prev,
                                    eligibleReasons: e.target.value.split('\n').filter(Boolean)
                                }))}
                                placeholder="Damaged or broken product&#10;Expired item received&#10;Wrong item delivered&#10;Quality not as expected"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Non-Returnable Categories / Exceptions (one per line)
                            </label>
                            <textarea
                                rows={3}
                                value={Array.isArray(policy.nonReturnableCategories) ? policy.nonReturnableCategories.join('\n') : (policy.nonReturnableCategories || '')}
                                onChange={(e) => setReturnPolicyData(prev => ({
                                    ...prev,
                                    nonReturnableCategories: e.target.value.split('\n').filter(Boolean)
                                }))}
                                placeholder="Perishable dairy opened after 24 hours&#10;Items with missing security seal&#10;Customized gift packages"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-xs"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Condition Requirements & Inspection Guidelines
                            </label>
                            <textarea
                                rows={3}
                                value={policy.conditionRequirements || ''}
                                onChange={(e) => setReturnPolicyData(prev => ({
                                    ...prev,
                                    conditionRequirements: e.target.value
                                }))}
                                placeholder="Items must include original tags, packaging, and accessories..."
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={handleSaveReturnPolicy}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? 'Saving...' : 'Save Return & Refund Policy'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // TAB 4: Payment Methods Settings
    const renderPaymentsTab = () => {
        const methods = contentData?.paymentMethods || [];

        const updateMethod = (idx, field, value) => {
            const next = [...methods];
            next[idx] = { ...next[idx], [field]: value };
            setContentData(prev => ({ ...prev, paymentMethods: next }));
        };

        const toggleActive = (idx) => {
            const next = [...methods];
            next[idx] = { ...next[idx], isActive: !next[idx].isActive };
            setContentData(prev => ({ ...prev, paymentMethods: next }));
        };

        return (
            <div className="space-y-6">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
                    <div className="mb-6">
                        <h3 className="text-base font-bold text-slate-800 mb-1">Payment Methods & Customer Guidance</h3>
                        <p className="text-xs text-slate-500">
                            Configure active payment methods and guidance displayed on the Payment Methods page.
                        </p>
                    </div>

                    {/* Notice on checkout vs informational methods */}
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 mb-6 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <strong className="block font-bold mb-0.5">Payment Method Types:</strong>
                            <p className="leading-relaxed">
                                <strong>Checkout-Supported:</strong> Cash on Delivery (COD) is integrated into our order placement flow.
                                <br />
                                <strong>Informational:</strong> Mobile financial services (bKash, Nagad) and Bank Transfer provide verified business payment credentials and guidelines for manual orders and customer assurance.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {methods.map((method, idx) => {
                            const isCheckout = method.type === 'checkout';

                            return (
                                <div
                                    key={method._id || idx}
                                    className={`border rounded-2xl p-5 transition ${method.isActive
                                        ? 'bg-white border-slate-200'
                                        : 'bg-slate-50 border-slate-200/60 opacity-80'
                                        }`}
                                >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${isCheckout
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                {isCheckout ? 'Checkout Supported' : 'Informational'}
                                            </span>
                                            <h4 className="text-sm font-bold text-slate-900">{method.name}</h4>
                                            <span className="text-xs text-slate-400 font-mono">({method.methodCode})</span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <label className="text-xs text-slate-600 font-medium">Status:</label>
                                            <button
                                                type="button"
                                                onClick={() => toggleActive(idx)}
                                                className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${method.isActive
                                                    ? 'bg-emerald-500 text-white'
                                                    : 'bg-slate-200 text-slate-600'
                                                    }`}
                                            >
                                                {method.isActive ? 'Active' : 'Disabled'}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Display Name</label>
                                            <input
                                                type="text"
                                                value={method.name || ''}
                                                onChange={(e) => updateMethod(idx, 'name', e.target.value)}
                                                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Display Order</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={method.displayOrder ?? idx}
                                                onChange={(e) => updateMethod(idx, 'displayOrder', Number(e.target.value))}
                                                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Short Description</label>
                                            <input
                                                type="text"
                                                value={method.description || ''}
                                                onChange={(e) => updateMethod(idx, 'description', e.target.value)}
                                                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            />
                                        </div>

                                        <div className="sm:col-span-2">
                                            <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">Customer Instructions</label>
                                            <textarea
                                                rows={2}
                                                value={method.instructions || ''}
                                                onChange={(e) => updateMethod(idx, 'instructions', e.target.value)}
                                                placeholder="Provide step-by-step guidance for payment or fee details..."
                                                className="w-full text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleSavePayments(methods)}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? 'Saving...' : 'Save Payment Methods'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // TAB 5: Best Sellers Settings
    const renderBestSellersTab = () => {
        const bestSellers = contentData?.bestSellers || {};

        return (
            <div className="space-y-6">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
                    <h3 className="text-base font-bold text-slate-800 mb-1">Best Sellers Section & Page</h3>
                    <p className="text-xs text-slate-500 mb-6">
                        Configure customer titles, visibility, and product display count for best-selling items.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Section Title</label>
                            <input
                                type="text"
                                value={bestSellers.title || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    bestSellers: { ...prev.bestSellers, title: e.target.value }
                                }))}
                                placeholder="Best Selling Groceries"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Section Subtitle</label>
                            <textarea
                                rows={2}
                                value={bestSellers.subtitle || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    bestSellers: { ...prev.bestSellers, subtitle: e.target.value }
                                }))}
                                placeholder="Our top customer favorites, most ordered pantry staples, and fresh picks"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Product Display Limit (4 - 24)
                            </label>
                            <input
                                type="number"
                                min="4"
                                max="24"
                                value={bestSellers.productLimit ?? 12}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    bestSellers: { ...prev.bestSellers, productLimit: Number(e.target.value) }
                                }))}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="text-[11px] text-slate-400 mt-0.5 block">
                                Real customer sales orders are dynamically ranked up to this limit.
                            </span>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Page Visibility Status</label>
                            <div className="pt-2">
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={bestSellers.isVisible !== false}
                                        onChange={(e) => setContentData(prev => ({
                                            ...prev,
                                            bestSellers: { ...prev.bestSellers, isVisible: e.target.checked }
                                        }))}
                                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">
                                        Best Sellers Page is publicly visible and active
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleSaveSection('bestSellers', bestSellers)}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? 'Saving...' : 'Save Best Sellers Settings'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // TAB 6: Offers & Deals Settings
    const renderDealsTab = () => {
        const offersDeals = contentData?.offersDeals || {};

        return (
            <div className="space-y-6">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
                    <h3 className="text-base font-bold text-slate-800 mb-1">Offers & Deals Section</h3>
                    <p className="text-xs text-slate-500 mb-6">
                        Configure titles, promotional banners, and visibility for customer vouchers and discounts.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Section Title</label>
                            <input
                                type="text"
                                value={offersDeals.title || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    offersDeals: { ...prev.offersDeals, title: e.target.value }
                                }))}
                                placeholder="Special Offers & Exclusive Discounts"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Section Subtitle</label>
                            <textarea
                                rows={2}
                                value={offersDeals.subtitle || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    offersDeals: { ...prev.offersDeals, subtitle: e.target.value }
                                }))}
                                placeholder="Save more on your daily grocery shopping with our verified coupon codes"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Promotional Banner Announcement</label>
                            <input
                                type="text"
                                value={offersDeals.bannerText || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    offersDeals: { ...prev.offersDeals, bannerText: e.target.value }
                                }))}
                                placeholder="Limited time offers! Apply promo codes at checkout for instant savings."
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Page Visibility</label>
                            <div className="pt-2">
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={offersDeals.isVisible !== false}
                                        onChange={(e) => setContentData(prev => ({
                                            ...prev,
                                            offersDeals: { ...prev.offersDeals, isVisible: e.target.checked }
                                        }))}
                                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                    />
                                    <span className="text-sm font-medium text-slate-700">
                                        Offers & Deals page is publicly visible
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={() => handleSaveSection('offersDeals', offersDeals)}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? 'Saving...' : 'Save Offers & Deals Settings'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // TAB 7: Contact Us Settings
    const renderContactTab = () => {
        const contact = contentData?.contact || {};
        const social = contact.socialLinks || {};

        const isValidUrlOrEmpty = (url) => {
            if (!url || !url.trim()) return true;
            try {
                const parsed = new URL(url.trim());
                return parsed.protocol === 'http:' || parsed.protocol === 'https:';
            } catch {
                return false;
            }
        };

        const handleContactReset = () => {
            if (!savedContact) return;
            setContentData(prev => ({
                ...prev,
                contact: JSON.parse(JSON.stringify(savedContact))
            }));
            toast.success("Contact Us form reset to saved values.");
        };

        const handleContactSubmit = (e) => {
            if (e) e.preventDefault();

            // 1. Email validation
            if (contact.email && contact.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) {
                toast.error("Please provide a valid support email address (e.g. contact@greencart.com)");
                return;
            }

            // 2. Phone validation
            if (contact.phone && contact.phone.trim() && !/^[+0-9\s\-()]{6,25}$/.test(contact.phone.trim())) {
                toast.error("Please provide a valid phone number (e.g. +880 1700-000000)");
                return;
            }

            // 3. WhatsApp validation
            if (contact.whatsapp && contact.whatsapp.trim() && !/^[+0-9\s\-()]{6,25}$/.test(contact.whatsapp.trim())) {
                toast.error("Please provide a valid WhatsApp number (e.g. +880 1700-000000)");
                return;
            }

            // 4. URL validation for optional link fields
            const urlsToCheck = [
                { label: 'Google Maps URL', val: contact.googleMapsUrl },
                { label: 'Facebook URL', val: social.facebook },
                { label: 'Instagram URL', val: social.instagram },
                { label: 'YouTube URL', val: social.youtube },
                { label: 'LinkedIn URL', val: social.linkedin },
                { label: 'X (Twitter) URL', val: social.x || social.twitter }
            ];

            for (const item of urlsToCheck) {
                if (item.val && !isValidUrlOrEmpty(item.val)) {
                    toast.error(`Please provide a valid URL for ${item.label} (must start with http:// or https://)`);
                    return;
                }
            }

            const cleanTwitterOrX = (social.x || social.twitter || '').trim();
            const payload = {
                ...contact,
                title: (contact.title || '').trim(),
                description: (contact.description || '').trim(),
                phone: (contact.phone || '').trim(),
                email: (contact.email || '').trim(),
                whatsapp: (contact.whatsapp || '').trim(),
                address: (contact.address || '').trim(),
                googleMapsUrl: (contact.googleMapsUrl || '').trim(),
                businessHours: (contact.businessHours || '').trim(),
                heading: (contact.heading || '').trim(),
                sectionHeading: (contact.heading || contact.sectionHeading || '').trim(),
                sectionDescription: (contact.sectionDescription || '').trim(),
                instructions: (contact.instructions || '').trim(),
                announcement: (contact.announcement || '').trim(),
                socialLinks: {
                    facebook: (social.facebook || '').trim(),
                    instagram: (social.instagram || '').trim(),
                    youtube: (social.youtube || '').trim(),
                    linkedin: (social.linkedin || '').trim(),
                    twitter: cleanTwitterOrX,
                    x: cleanTwitterOrX
                }
            };

            handleSaveSection('contact', payload);
        };

        return (
            <div className="space-y-6">
                {/* Save Confirmation Alert */}
                {contactNotice && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4 flex items-center justify-between text-xs animate-fadeIn">
                        <div className="flex items-center gap-2.5">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            <span className="font-semibold">{contactNotice}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setContactNotice(null)}
                            className="text-emerald-600 hover:text-emerald-800 p-1"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Card 1: Contact Information */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                                <Phone className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Contact Information</h3>
                                <p className="text-xs text-slate-500">Core business phone, support email, physical hub, and operational hours</p>
                            </div>
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                            Required on /contact
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Page Title *
                            </label>
                            <input
                                type="text"
                                value={contact.title || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: { ...prev.contact, title: e.target.value }
                                }))}
                                placeholder="e.g. Get in Touch with GreenCart"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Page Description / Subtitle
                            </label>
                            <textarea
                                rows={2}
                                value={contact.description || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: { ...prev.contact, description: e.target.value }
                                }))}
                                placeholder="Describe your customer support commitment and assistance scope..."
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Contact Phone Number *
                            </label>
                            <input
                                type="text"
                                value={contact.phone || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: { ...prev.contact, phone: e.target.value }
                                }))}
                                placeholder="+880 1700-000000"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">Rendered with clickable tel: links on customer pages.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Support Email Address *
                            </label>
                            <input
                                type="email"
                                value={contact.email || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: { ...prev.contact, email: e.target.value }
                                }))}
                                placeholder="contact@greencart.com"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">Rendered with clickable mailto: links and fallback inquiry drafts.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                WhatsApp Number
                            </label>
                            <input
                                type="text"
                                value={contact.whatsapp || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: { ...prev.contact, whatsapp: e.target.value }
                                }))}
                                placeholder="+880 1700-000000"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">Automatically generates direct https://wa.me link.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Business Hours
                            </label>
                            <input
                                type="text"
                                value={contact.businessHours || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: { ...prev.contact, businessHours: e.target.value }
                                }))}
                                placeholder="Saturday - Thursday: 8:00 AM - 10:00 PM"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Business / Fulfillment Hub Address
                            </label>
                            <input
                                type="text"
                                value={contact.address || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: { ...prev.contact, address: e.target.value }
                                }))}
                                placeholder="GreenCart Central Logistics Hub, Tejgaon Industrial Area, Dhaka 1208, Bangladesh"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Google Maps URL
                            </label>
                            <input
                                type="text"
                                value={contact.googleMapsUrl || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: { ...prev.contact, googleMapsUrl: e.target.value }
                                }))}
                                placeholder="https://maps.google.com/?q=Tejgaon+Dhaka"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">Optional. Customers can click to navigate directly in Google Maps.</p>
                        </div>
                    </div>
                </div>

                {/* Card 2: Social Media Links */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                                <Mail className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Social Media Links</h3>
                                <p className="text-xs text-slate-500">Provide verified official profiles. Empty channels will be automatically hidden on the customer page.</p>
                            </div>
                        </div>
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                            Optional Channels
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                                Facebook Profile / Page URL
                            </label>
                            <input
                                type="text"
                                value={social.facebook || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: {
                                        ...prev.contact,
                                        socialLinks: { ...prev.contact?.socialLinks, facebook: e.target.value }
                                    }
                                }))}
                                placeholder="https://facebook.com/greencart"
                                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                                Instagram Profile URL
                            </label>
                            <input
                                type="text"
                                value={social.instagram || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: {
                                        ...prev.contact,
                                        socialLinks: { ...prev.contact?.socialLinks, instagram: e.target.value }
                                    }
                                }))}
                                placeholder="https://instagram.com/greencart"
                                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                                YouTube Channel URL
                            </label>
                            <input
                                type="text"
                                value={social.youtube || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: {
                                        ...prev.contact,
                                        socialLinks: { ...prev.contact?.socialLinks, youtube: e.target.value }
                                    }
                                }))}
                                placeholder="https://youtube.com/@greencart"
                                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                                LinkedIn Company Page URL
                            </label>
                            <input
                                type="text"
                                value={social.linkedin || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: {
                                        ...prev.contact,
                                        socialLinks: { ...prev.contact?.socialLinks, linkedin: e.target.value }
                                    }
                                }))}
                                placeholder="https://linkedin.com/company/greencart"
                                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                                X (Twitter) Profile URL
                            </label>
                            <input
                                type="text"
                                value={social.x || social.twitter || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setContentData(prev => ({
                                        ...prev,
                                        contact: {
                                            ...prev.contact,
                                            socialLinks: {
                                                ...prev.contact?.socialLinks,
                                                twitter: val,
                                                x: val
                                            }
                                        }
                                    }));
                                }}
                                placeholder="https://x.com/greencart"
                                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Card 3: Additional Information & Notice */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                                <Shield className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-slate-800">Additional Information & Support Notice</h3>
                                <p className="text-xs text-slate-500">Customise section titles, support guidance, and optional customer announcements</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Contact Section Heading
                            </label>
                            <input
                                type="text"
                                value={contact.heading || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: { ...prev.contact, heading: e.target.value, sectionHeading: e.target.value }
                                }))}
                                placeholder="e.g. Send Us a Message"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Contact Section Description
                            </label>
                            <input
                                type="text"
                                value={contact.sectionDescription || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: { ...prev.contact, sectionDescription: e.target.value }
                                }))}
                                placeholder="Fill out the form below and our team will get back to you within 24 hours."
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Customer Support Instructions
                            </label>
                            <textarea
                                rows={2}
                                value={contact.instructions || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: { ...prev.contact, instructions: e.target.value }
                                }))}
                                placeholder="e.g. For quick resolution regarding delivered items, please keep your Order ID handy."
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">Highlighted in an informative callout box on the customer page. Left empty to hide.</p>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Optional Announcement / Notice
                            </label>
                            <input
                                type="text"
                                value={contact.announcement || ''}
                                onChange={(e) => setContentData(prev => ({
                                    ...prev,
                                    contact: { ...prev.contact, announcement: e.target.value }
                                }))}
                                placeholder="e.g. Holiday delivery hours: Our dispatch hub operates until 6:00 PM on national holidays."
                                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                            />
                            <p className="text-[11px] text-slate-400 mt-1">Optional. Displays an alert notice banner at the top of /contact when provided.</p>
                        </div>
                    </div>
                </div>

                {/* Card 4: Action & Save Bar */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-slate-500">
                        Changes are saved to the central database and immediately synchronize with the customer-facing <span className="font-semibold text-slate-700">/contact</span> page.
                    </p>
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={handleContactReset}
                            className="px-4 py-2.5 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Cancel / Reset</span>
                        </button>

                        <button
                            type="button"
                            disabled={saving}
                            onClick={handleContactSubmit}
                            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    <span>Saving Changes...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Save Contact Us Settings</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    // TAB 8: FAQs Management (Full CRUD)
    const renderFaqsTab = () => {
        const filtered = faqsList.filter((f) => {
            const matchesCat = faqCategoryFilter === 'all' || f.category === faqCategoryFilter;
            if (!matchesCat) return false;
            if (!faqSearch.trim()) return true;
            const q = faqSearch.toLowerCase();
            return f.question?.toLowerCase().includes(q) || f.answer?.toLowerCase().includes(q);
        });

        return (
            <div className="space-y-6">
                <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Frequently Asked Questions (FAQs)</h3>
                            <p className="text-xs text-slate-500">
                                Create, edit, reorder, or publish/unpublish customer questions and answers.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleOpenCreateFaq}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-xs transition cursor-pointer self-start sm:self-auto"
                        >
                            <PlusCircle className="w-4 h-4" />
                            Add New FAQ
                        </button>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="flex flex-col sm:flex-row gap-3 mb-6">
                        <div className="flex-1">
                            <input
                                type="text"
                                value={faqSearch}
                                onChange={(e) => setFaqSearch(e.target.value)}
                                placeholder="Search questions or answers..."
                                className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                        <div className="sm:w-56">
                            <select
                                value={faqCategoryFilter}
                                onChange={(e) => setFaqCategoryFilter(e.target.value)}
                                className="w-full text-xs border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                            >
                                <option value="all">All Categories</option>
                                {FAQ_CATEGORIES.map(c => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Table / List */}
                    {filtered.length > 0 ? (
                        <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                                        <th className="py-3 px-4">Order</th>
                                        <th className="py-3 px-4">Question</th>
                                        <th className="py-3 px-4">Category</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map((faq) => {
                                        const catObj = FAQ_CATEGORIES.find(c => c.id === faq.category);

                                        return (
                                            <tr key={faq._id} className="hover:bg-slate-50/60 transition">
                                                <td className="py-3 px-4 font-mono text-slate-400">
                                                    #{faq.displayOrder ?? 0}
                                                </td>
                                                <td className="py-3 px-4 font-medium text-slate-800 max-w-md">
                                                    <div className="font-semibold text-slate-900">{faq.question}</div>
                                                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{faq.answer}</div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[11px] font-medium">
                                                        {catObj ? catObj.label : faq.category}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleFaqPublished(faq)}
                                                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition cursor-pointer ${faq.isPublished !== false
                                                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                                            }`}
                                                    >
                                                        {faq.isPublished !== false ? 'Published' : 'Hidden'}
                                                    </button>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEditFaq(faq)}
                                                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                                                            title="Edit FAQ"
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setFaqToDelete(faq);
                                                                setShowDeleteFaqModal(true);
                                                            }}
                                                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                                            title="Delete FAQ"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200/60 p-6">
                            <p className="text-xs text-slate-500 mb-3">No FAQs found matching your filter criteria.</p>
                            <button
                                type="button"
                                onClick={handleOpenCreateFaq}
                                className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition"
                            >
                                Add Your First FAQ
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                        <Store className="w-7 h-7 text-emerald-600" />
                        Store Content Management
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                        Configure public store information, policy terms, customer support details, and FAQs in real-time.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={fetchAllData}
                    disabled={loading}
                    className="self-start sm:self-auto px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-2xs"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Tab Navigation Strip */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 no-scrollbar">
                {TABS.map((tab) => {
                    const active = activeTab === tab.id;
                    const Icon = tab.icon;

                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition cursor-pointer ${active
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/60'
                                }`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.name}
                        </button>
                    );
                })}
            </div>

            {/* Tab Contents */}
            {loading ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center animate-pulse">
                    <div className="w-8 h-8 bg-emerald-600/20 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                    </div>
                    <p className="text-xs font-semibold text-slate-600">Loading store configuration...</p>
                </div>
            ) : (
                <div>
                    {activeTab === 'support' && renderSupportTab()}
                    {activeTab === 'delivery' && renderDeliveryTab()}
                    {activeTab === 'returns' && renderReturnsTab()}
                    {activeTab === 'payments' && renderPaymentsTab()}
                    {activeTab === 'bestsellers' && renderBestSellersTab()}
                    {activeTab === 'deals' && renderDealsTab()}
                    {activeTab === 'contact' && renderContactTab()}
                    {activeTab === 'faqs' && renderFaqsTab()}
                </div>
            )}

            {/* Create/Edit FAQ Modal */}
            {showFaqModal && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-slate-200 relative animate-in fade-in zoom-in-95 duration-150">
                        <button
                            type="button"
                            onClick={() => setShowFaqModal(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h3 className="text-base font-bold text-slate-900 mb-1">
                            {editingFaq ? 'Edit FAQ Item' : 'Create New FAQ Item'}
                        </h3>
                        <p className="text-xs text-slate-500 mb-5">
                            Customer answers are rendered with Markdown line breaks supported.
                        </p>

                        <form onSubmit={handleSaveFaq} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Question *</label>
                                <input
                                    type="text"
                                    value={faqFormData.question}
                                    onChange={(e) => setFaqFormData({ ...faqFormData, question: e.target.value })}
                                    placeholder="e.g. How can I pay with bKash?"
                                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Category</label>
                                    <select
                                        value={faqFormData.category}
                                        onChange={(e) => setFaqFormData({ ...faqFormData, category: e.target.value })}
                                        className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                                    >
                                        {FAQ_CATEGORIES.map(c => (
                                            <option key={c.id} value={c.id}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Display Order</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={faqFormData.displayOrder}
                                        onChange={(e) => setFaqFormData({ ...faqFormData, displayOrder: Number(e.target.value) })}
                                        className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Answer *</label>
                                <textarea
                                    rows={4}
                                    value={faqFormData.answer}
                                    onChange={(e) => setFaqFormData({ ...faqFormData, answer: e.target.value })}
                                    placeholder="Enter detailed, easy-to-read answer..."
                                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                    required
                                />
                            </div>

                            <div className="pt-1">
                                <label className="inline-flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={faqFormData.isPublished}
                                        onChange={(e) => setFaqFormData({ ...faqFormData, isPublished: e.target.checked })}
                                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                    />
                                    <span className="text-xs font-semibold text-slate-700">Publish immediately on website</span>
                                </label>
                            </div>

                            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowFaqModal(false)}
                                    className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer"
                                >
                                    {saving ? 'Saving...' : (editingFaq ? 'Save Changes' : 'Create FAQ')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete FAQ Confirmation Modal */}
            {showDeleteFaqModal && faqToDelete && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center animate-in fade-in zoom-in-95 duration-150">
                        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mb-1">Delete FAQ?</h3>
                        <p className="text-xs text-slate-500 mb-6">
                            Are you sure you want to delete "{faqToDelete.question}"? This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowDeleteFaqModal(false);
                                    setFaqToDelete(null);
                                }}
                                className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={saving}
                                onClick={handleDeleteFaq}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 cursor-pointer"
                            >
                                {saving ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StoreContentManagement;
