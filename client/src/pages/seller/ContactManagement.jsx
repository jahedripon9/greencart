import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import Invoice from '../Invoice';
import {
    Users,
    Search,
    Edit3,
    Trash2,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    X,
    Mail,
    Phone,
    MessageSquare,
    Eye,
    RefreshCw,
    Package,
    Clock,
    Send,
    ExternalLink,
    Copy,
    Check
} from '../../components/seller/SellerIcons';

/**
 * Safely normalizes Google Drive image URLs to Google user-content embed URLs (lh3.googleusercontent.com/d/FILE_ID)
 * to prevent browser blocking caused by Google's Cross-Origin-Resource-Policy (CORP) header.
 */
export const normalizeTeamImageUrl = (image) => {
    if (!image || typeof image !== 'string') return image;
    const trimmed = image.trim();
    if (!trimmed) return trimmed;

    try {
        const parsed = new URL(trimmed);
        const host = parsed.hostname.toLowerCase();
        if (host === 'drive.google.com' || host === 'www.drive.google.com' || host === 'docs.google.com') {
            let fileId = null;

            // Pattern 1: /file/d/FILE_ID
            const fileMatch = parsed.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
            if (fileMatch && fileMatch[1]) {
                fileId = fileMatch[1];
            }

            // Pattern 2: query parameter id=FILE_ID
            if (!fileId) {
                const idParam = parsed.searchParams.get('id');
                if (idParam && /^[a-zA-Z0-9_-]+$/.test(idParam)) {
                    fileId = idParam;
                }
            }

            if (fileId) {
                return `https://lh3.googleusercontent.com/d/${fileId}`;
            }
        }
    } catch {
        // Not a standard URL, return trimmed as-is
    }

    return trimmed;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{5,20}$/;

const STATUS_CONFIG = {
    Active: {
        badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500'
    },
    Customer: {
        badge: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-500'
    },
    Lead: {
        badge: 'bg-amber-50 text-amber-700 border-amber-200',
        dot: 'bg-amber-500'
    },
    Inactive: {
        badge: 'bg-slate-100 text-slate-600 border-slate-200',
        dot: 'bg-slate-400'
    }
};

/**
 * Formats a 24-character MongoDB User ID into a shortened format: first 6 chars + ellipsis + last 4 chars.
 * E.g., 6ae4d4eb89c6c3caf20b0de8 -> 6ae4d4…0de8
 */
export const formatShortUserId = (id) => {
    if (!id) return '';
    const str = String(id).trim();
    if (str.length <= 10) return str;
    return `${str.slice(0, 6)}…${str.slice(-4)}`;
};

const ContactManagement = () => {
    const { axios, navigate, currency, sellerUser } = useAppContext();
    const currentRole = sellerUser?.role || 'Admin';
    const canMutate = ['Admin', 'CEO', 'CTO'].includes(currentRole);
    const canDelete = ['Admin', 'CEO'].includes(currentRole);

    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showUnregisteredModal, setShowUnregisteredModal] = useState(false);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState(null);

    // Selected Contact for Modal view / edit / delete
    const [selectedContact, setSelectedContact] = useState(null);
    const [profileData, setProfileData] = useState(null);
    const [loadingProfile, setLoadingProfile] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [copiedUserId, setCopiedUserId] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        image: '',
        notes: '',
        status: 'Active'
    });

    // Fetch contacts from backend
    const fetchContacts = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            const { data } = await axios.get('/api/seller/contacts');
            if (data.success) {
                setContacts(data.contacts || []);
            } else {
                toast.error(data.message || 'Failed to load contacts');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error fetching contacts');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchContacts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Filtered contacts by search (name, email, phone) and status
    const filteredContacts = useMemo(() => {
        return contacts.filter((c) => {
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch =
                !q ||
                c.name?.toLowerCase().includes(q) ||
                c.email?.toLowerCase().includes(q) ||
                c.phone?.toLowerCase().includes(q);

            const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [contacts, searchQuery, statusFilter]);

    // Open Add Modal
    const handleOpenAddModal = () => {
        setFormData({
            name: '',
            email: '',
            phone: '',
            image: '',
            notes: '',
            status: 'Active'
        });
        setShowAddModal(true);
    };

    // Open Edit Modal
    const handleOpenEditModal = (contact) => {
        setSelectedContact(contact);
        setFormData({
            name: contact.name || '',
            email: contact.email || '',
            phone: contact.phone || '',
            image: contact.image || '',
            notes: contact.notes || '',
            status: contact.status || 'Active'
        });
        setShowEditModal(true);
    };

    // Open View Profile Modal & load order history
    const handleOpenProfileModal = async (contact) => {
        setSelectedContact(contact);
        setShowProfileModal(true);
        setLoadingProfile(true);
        try {
            const { data } = await axios.get(`/api/seller/contacts/${contact._id}`);
            if (data.success) {
                setProfileData(data);
            } else {
                toast.error(data.message || 'Failed to load profile details');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error loading profile details');
        } finally {
            setLoadingProfile(false);
        }
    };

    // Open View Invoice Modal for specific order
    const handleViewInvoice = (order) => {
        if (!order || !order._id) return;
        setSelectedInvoiceOrder(order);
        setShowInvoiceModal(true);
    };

    // Copy original complete User ID to clipboard
    const handleCopyUserId = async (rawId) => {
        if (!rawId) return;
        const fullId = String(rawId).trim();
        if (!fullId) return;

        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(fullId);
            } else {
                const ta = document.createElement('textarea');
                ta.value = fullId;
                ta.style.position = 'fixed';
                ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            setCopiedUserId(true);
            toast.success('User ID copied!');
            setTimeout(() => setCopiedUserId(false), 2000);
        } catch {
            toast.error('Failed to copy User ID');
        }
    };

    // Handle Submit Add Contact
    const handleAddContact = async (e) => {
        e.preventDefault();
        if (actionLoading) return;

        if (!formData.name.trim()) return toast.error('Full Name is required');
        if (!formData.email.trim()) return toast.error('Email is required');
        if (!EMAIL_REGEX.test(formData.email.trim())) {
            return toast.error('Please enter a valid email address');
        }
        if (!formData.phone.trim()) return toast.error('Phone number is required');
        if (!PHONE_REGEX.test(formData.phone.trim())) {
            return toast.error('Please enter a valid phone number');
        }

        const payload = {
            name: formData.name.trim(),
            email: formData.email.trim().toLowerCase(),
            phone: formData.phone.trim(),
            image: normalizeTeamImageUrl(formData.image),
            notes: formData.notes.trim(),
            status: formData.status
        };

        setActionLoading(true);
        try {
            const { data } = await axios.post('/api/seller/contacts', payload);
            if (data.success) {
                toast.success(data.message || 'Contact added successfully');
                setShowAddModal(false);
                fetchContacts(true);
            } else {
                toast.error(data.message || 'Failed to add contact');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error adding contact');
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Submit Update Contact
    const handleUpdateContact = async (e) => {
        e.preventDefault();
        if (actionLoading || !selectedContact) return;

        if (!formData.name.trim()) return toast.error('Full Name cannot be empty');
        if (!formData.email.trim()) return toast.error('Email cannot be empty');
        if (!EMAIL_REGEX.test(formData.email.trim())) {
            return toast.error('Please enter a valid email address');
        }
        if (!formData.phone.trim()) return toast.error('Phone number cannot be empty');
        if (!PHONE_REGEX.test(formData.phone.trim())) {
            return toast.error('Please enter a valid phone number');
        }

        const payload = {
            name: formData.name.trim(),
            email: formData.email.trim().toLowerCase(),
            phone: formData.phone.trim(),
            image: normalizeTeamImageUrl(formData.image),
            notes: formData.notes.trim(),
            status: formData.status
        };

        setActionLoading(true);
        try {
            const { data } = await axios.put(`/api/seller/contacts/${selectedContact._id}`, payload);
            if (data.success) {
                toast.success(data.message || 'Contact updated successfully');
                setShowEditModal(false);
                fetchContacts(true);
            } else {
                toast.error(data.message || 'Failed to update contact');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error updating contact');
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Submit Delete Contact
    const handleDeleteContact = async () => {
        if (!selectedContact || actionLoading) return;

        setActionLoading(true);
        try {
            const { data } = await axios.delete(`/api/seller/contacts/${selectedContact._id}`);
            if (data.success) {
                toast.success(data.message || 'Contact deleted successfully');
                setShowDeleteModal(false);
                setSelectedContact(null);
                fetchContacts(true);
            } else {
                toast.error(data.message || 'Failed to delete contact');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error deleting contact');
        } finally {
            setActionLoading(false);
        }
    };

    // Direct Messaging: Connect to existing GreenCart chat
    const handleMessageContact = async (contact) => {
        if (!contact) return;
        try {
            const { data } = await axios.post(`/api/seller/contacts/${contact._id}/chat`);
            if (data.success && data.conversationId) {
                navigate(`/seller/messages?id=${data.conversationId}`);
            } else if (!data.isRegisteredCustomer) {
                setSelectedContact(contact);
                setShowUnregisteredModal(true);
            } else {
                toast.error(data.message || 'Unable to open conversation');
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to initiate chat');
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto font-sans">
            <div className={`space-y-6 ${showInvoiceModal ? 'no-print' : ''}`}>
                {/* Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Customer Directory</h1>
                        <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {contacts.length} {contacts.length === 1 ? 'Customer' : 'Customers'}
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                        Automated customer directory derived from your store's orders. View customer profiles, order history, and initiate direct communication.
                    </p>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                    <button
                        type="button"
                        onClick={() => fetchContacts(true)}
                        disabled={refreshing}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
                        title="Sync directory with latest store orders"
                    >
                        <RefreshCw className={`w-4 h-4 text-emerald-600 ${refreshing ? 'animate-spin' : ''}`} />
                        <span>{refreshing ? 'Syncing...' : 'Sync Directory'}</span>
                    </button>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search contacts by name, email, or phone number..."
                        className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400 text-slate-800"
                    />
                </div>

                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-slate-500 font-medium">Status:</span>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="Active">Active</option>
                            <option value="Customer">Customer</option>
                            <option value="Lead">Lead</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={() => fetchContacts(true)}
                        disabled={refreshing}
                        className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                        title="Refresh contacts"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Contacts Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((n) => (
                        <div key={n} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-slate-200" />
                                <div className="space-y-2 flex-1">
                                    <div className="h-4 bg-slate-200 rounded w-3/4" />
                                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                                </div>
                            </div>
                            <div className="h-3 bg-slate-200 rounded w-full" />
                            <div className="h-9 bg-slate-200 rounded-xl" />
                        </div>
                    ))}
                </div>
            ) : filteredContacts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Users className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800">No customers found</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {searchQuery || statusFilter !== 'ALL'
                            ? 'No customers match your current search or status filter. Try clearing filters.'
                            : 'Customers will appear here automatically as soon as orders are placed in GreenCart.'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredContacts.map((contact) => {
                        const statusCfg = STATUS_CONFIG[contact.status] || STATUS_CONFIG.Active;
                        const displayImage = normalizeTeamImageUrl(contact.image);

                        return (
                            <div
                                key={contact._id}
                                className="bg-white rounded-2xl border border-slate-200 hover:border-emerald-300 transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-2xs hover:shadow-md"
                            >
                                <div className="p-5 space-y-4">
                                    {/* Card Top: Large Profile Image & Status Pill */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="relative">
                                            {displayImage ? (
                                                <img
                                                    src={displayImage}
                                                    alt={contact.name}
                                                    className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-100 shadow-xs"
                                                    onError={(e) => {
                                                        e.currentTarget.onerror = null;
                                                        e.currentTarget.style.display = 'none';
                                                        if (e.currentTarget.nextSibling) {
                                                            e.currentTarget.nextSibling.style.display = 'flex';
                                                        }
                                                    }}
                                                />
                                            ) : null}
                                            <div
                                                className={`w-16 h-16 rounded-2xl bg-linear-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xl flex items-center justify-center uppercase shadow-xs ${
                                                    displayImage ? 'hidden' : 'flex'
                                                }`}
                                            >
                                                {contact.name.charAt(0)}
                                            </div>
                                        </div>

                                        <span
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusCfg.badge}`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                                            {contact.status}
                                        </span>
                                    </div>

                                    {/* Name */}
                                    <div>
                                        <h3 className="text-base font-bold text-slate-900 truncate" title={contact.name}>
                                            {contact.name}
                                        </h3>
                                    </div>

                                    {/* Contact Details: Email & Phone */}
                                    <div className="space-y-2 text-xs">
                                        <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                                            <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <a
                                                href={`mailto:${contact.email}`}
                                                className="truncate hover:text-emerald-700 transition-colors"
                                                title={contact.email}
                                            >
                                                {contact.email}
                                            </a>
                                        </div>

                                        <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <a
                                                href={`tel:${contact.phone}`}
                                                className="truncate hover:text-emerald-700 transition-colors"
                                                title={contact.phone}
                                            >
                                                {contact.phone || 'No phone recorded'}
                                            </a>
                                        </div>
                                    </div>

                                    {/* Order Statistics: Total Orders & Latest Order Date */}
                                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                                            <Package className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                            <span>{contact.totalOrders || 1} {(contact.totalOrders || 1) === 1 ? 'Order' : 'Orders'}</span>
                                        </div>
                                        {contact.latestOrderDate ? (
                                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span>Latest: {new Date(contact.latestOrderDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            </div>
                                        ) : null}
                                    </div>

                                    {contact.notes ? (
                                        <p className="text-[11px] text-slate-500 line-clamp-2 italic">
                                            "{contact.notes}"
                                        </p>
                                    ) : null}
                                </div>

                                {/* Card Actions Footer */}
                                <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-200/70 space-y-2">
                                    {/* Primary Action Buttons: Message & View Profile */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleMessageContact(contact)}
                                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors cursor-pointer"
                                            title="Message Contact"
                                        >
                                            <MessageSquare className="w-3.5 h-3.5" />
                                            <span>Message</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleOpenProfileModal(contact)}
                                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
                                            title="View Contact Profile and Order History"
                                        >
                                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                                            <span>View Profile</span>
                                        </button>
                                    </div>

                                    {/* Secondary Mutation Buttons: Edit & Delete */}
                                    {canMutate && (
                                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEditModal(contact)}
                                                className="inline-flex items-center gap-1 text-slate-500 hover:text-emerald-700 py-1 transition-colors cursor-pointer"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                                <span>Edit</span>
                                            </button>

                                            {canDelete && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedContact(contact);
                                                        setShowDeleteModal(true);
                                                    }}
                                                    className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-600 py-1 transition-colors cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    <span>Delete</span>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* Modal: Add New Contact */}
            {/* ------------------------------------------------------------- */}
            {showAddModal && (
                <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                                    <Users className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900">Add New Contact</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddContact} className="p-6 space-y-4">
                            {/* Full Name */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Full Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Alex Johnson"
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Primary Email <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="e.g. alex@example.com"
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Phone Number */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Phone Number <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    required
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    placeholder="e.g. +8801712345678"
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Profile Image URL */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Profile Image URL <span className="text-slate-400 font-normal lowercase">(optional, Google Drive supported)</span>
                                </label>
                                <input
                                    type="url"
                                    value={formData.image}
                                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                                    placeholder="https://drive.google.com/file/d/... or https://example.com/photo.jpg"
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Contact Status
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Customer">Customer</option>
                                    <option value="Lead">Lead</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Notes <span className="text-slate-400 font-normal lowercase">(optional)</span>
                                </label>
                                <textarea
                                    rows="2"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Key customer preferences, meeting notes, etc."
                                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                                />
                            </div>

                            {/* Actions */}
                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    <span>Create Contact</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Modal: Edit Contact */}
            {/* ------------------------------------------------------------- */}
            {showEditModal && selectedContact && (
                <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                                    <Edit3 className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900">Edit Contact</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowEditModal(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateContact} className="p-6 space-y-4">
                            {/* Full Name */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Full Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Email */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Primary Email <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Phone Number */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Phone Number <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="tel"
                                    required
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Profile Image URL */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Profile Image URL
                                </label>
                                <input
                                    type="url"
                                    value={formData.image}
                                    onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Contact Status
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Customer">Customer</option>
                                    <option value="Lead">Lead</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Notes
                                </label>
                                <textarea
                                    rows="2"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                                />
                            </div>

                            {/* Actions */}
                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                    <span>Save Changes</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Modal: View Profile & Order History */}
            {/* ------------------------------------------------------------- */}
            {showProfileModal && selectedContact && (
                <div className="customer-profile-modal no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                        {/* Profile Header */}
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                            <div className="flex items-center gap-2">
                                <Eye className="w-5 h-5 text-emerald-600" />
                                <h3 className="text-base font-bold text-slate-900">Contact Profile</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowProfileModal(false);
                                    setProfileData(null);
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
                            {/* Profile Info Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        {selectedContact.image ? (
                                            <img
                                                src={normalizeTeamImageUrl(selectedContact.image)}
                                                alt={selectedContact.name}
                                                className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-xs"
                                                onError={(e) => {
                                                    e.currentTarget.onerror = null;
                                                    e.currentTarget.style.display = 'none';
                                                    if (e.currentTarget.nextSibling) {
                                                        e.currentTarget.nextSibling.style.display = 'flex';
                                                    }
                                                }}
                                            />
                                        ) : null}
                                        <div
                                            className={`w-16 h-16 rounded-2xl bg-linear-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xl flex items-center justify-center uppercase shadow-xs ${
                                                selectedContact.image ? 'hidden' : 'flex'
                                            }`}
                                        >
                                            {selectedContact.name.charAt(0)}
                                        </div>
                                    </div>

                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">{selectedContact.name}</h2>
                                        <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{selectedContact.email}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-600 mt-0.5">
                                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                                            <span>{selectedContact.phone}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2">
                                    <span
                                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                                            STATUS_CONFIG[selectedContact.status]?.badge || STATUS_CONFIG.Active.badge
                                        }`}
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[selectedContact.status]?.dot || 'bg-emerald-500'}`} />
                                        {selectedContact.status}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowProfileModal(false);
                                            handleMessageContact(selectedContact);
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs cursor-pointer"
                                    >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        <span>Send Message</span>
                                    </button>
                                </div>
                            </div>

                            {/* Customer Account Status */}
                            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
                                <p className="text-xs font-semibold text-slate-700 uppercase tracking-wider">GreenCart Account Status</p>
                                {loadingProfile ? (
                                    <div className="h-4 bg-slate-100 rounded animate-pulse w-1/3" />
                                ) : profileData?.customer ? (
                                    <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-700 font-medium">
                                        <div className="flex items-center gap-1.5">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            <span>Registered GreenCart Customer</span>
                                        </div>
                                        {profileData.customer._id && (
                                            <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md px-2 py-0.5 font-mono text-[11px]">
                                                <span className="text-slate-500 font-sans text-[10px]">User ID:</span>
                                                <span title={`Full User ID: ${profileData.customer._id}`} className="font-semibold select-all">
                                                    {formatShortUserId(profileData.customer._id)}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyUserId(profileData.customer._id)}
                                                    className="p-0.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100 rounded transition-colors cursor-pointer"
                                                    title="Copy full User ID"
                                                    aria-label="Copy User ID"
                                                >
                                                    {copiedUserId ? (
                                                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                                                    ) : (
                                                        <Copy className="w-3.5 h-3.5 text-emerald-700" />
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                        <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                                        <span>Not yet registered as an online shopping customer on GreenCart.</span>
                                    </div>
                                )}
                            </div>

                            {/* Customer Orders & Engagement Summary */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-0.5">
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Orders</p>
                                    <p className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                                        <Package className="w-4 h-4 text-emerald-600" />
                                        <span>{profileData?.orders ? profileData.orders.length : (selectedContact.totalOrders || 1)} Orders</span>
                                    </p>
                                </div>
                                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-0.5">
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Latest Order Date</p>
                                    <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 pt-0.5">
                                        <Clock className="w-4 h-4 text-slate-400" />
                                        <span>
                                            {profileData?.orders?.[0]?.createdAt
                                                ? new Date(profileData.orders[0].createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                                                : selectedContact.latestOrderDate
                                                ? new Date(selectedContact.latestOrderDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                                                : 'N/A'}
                                        </span>
                                    </p>
                                </div>
                            </div>

                            {/* Order History Section */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                        <Package className="w-4 h-4 text-emerald-600" />
                                        <span>Order History</span>
                                    </h4>
                                    {profileData?.orders && (
                                        <span className="text-xs text-slate-500">
                                            {profileData.orders.length} Order{profileData.orders.length === 1 ? '' : 's'}
                                        </span>
                                    )}
                                </div>

                                {loadingProfile ? (
                                    <div className="space-y-2 animate-pulse">
                                        {[1, 2].map((n) => (
                                            <div key={n} className="h-16 bg-slate-100 rounded-xl border border-slate-200" />
                                        ))}
                                    </div>
                                ) : !profileData?.orders || profileData.orders.length === 0 ? (
                                    <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 space-y-1">
                                        <Clock className="w-6 h-6 mx-auto text-slate-400" />
                                        <p className="text-xs font-semibold text-slate-700">No order history recorded</p>
                                        <p className="text-[11px] text-slate-500">
                                            Orders placed with this contact's email address will appear here automatically.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {profileData.orders.map((order) => (
                                            <div
                                                key={order._id}
                                                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex items-center justify-between gap-3 text-xs"
                                            >
                                                <div className="space-y-1 flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-900">
                                                            {order.orderNumber || `ORD-${order._id.slice(-6).toUpperCase()}`}
                                                        </span>
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 font-semibold text-slate-700">
                                                            {order.status}
                                                        </span>
                                                    </div>
                                                    <p className="text-slate-500 text-[11px]">
                                                        {new Date(order.createdAt).toLocaleDateString([], {
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        })} • Payment: {order.paymentType}
                                                    </p>
                                                    <p className="text-slate-600 truncate text-[11px]">
                                                        Items: {order.items?.map((item) => `${item.name || item.product?.name || 'Item'} (${item.quantity})`).join(', ') || 'N/A'}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0">
                                                    <div className="text-right">
                                                        <span className="text-sm font-bold text-emerald-700 block">
                                                            {currency}{order.amount}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleViewInvoice(order)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs cursor-pointer"
                                                        title={`View invoice for order ${order.orderNumber || order._id}`}
                                                    >
                                                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                        <span>View Invoice</span>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowProfileModal(false);
                                    setProfileData(null);
                                }}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Modal: Unregistered Contact Messaging Dialog */}
            {/* ------------------------------------------------------------- */}
            {showUnregisteredModal && selectedContact && (
                <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
                            <MessageSquare className="w-6 h-6" />
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Contact Communication</h3>
                            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                                <span className="font-semibold text-slate-900">{selectedContact.name}</span> is not registered as an online GreenCart customer yet, so internal in-app chat is unavailable. You can reach out directly via:
                            </p>
                        </div>

                        <div className="space-y-2 pt-2">
                            <a
                                href={`mailto:${selectedContact.email}`}
                                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-xs font-semibold text-slate-800 transition-all"
                            >
                                <div className="flex items-center gap-2.5">
                                    <Mail className="w-4 h-4 text-emerald-600" />
                                    <span>Send Email ({selectedContact.email})</span>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            </a>

                            <a
                                href={`tel:${selectedContact.phone}`}
                                className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-xs font-semibold text-slate-800 transition-all"
                            >
                                <div className="flex items-center gap-2.5">
                                    <Phone className="w-4 h-4 text-emerald-600" />
                                    <span>Call Phone ({selectedContact.phone})</span>
                                </div>
                                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            </a>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setShowUnregisteredModal(false)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Modal: Delete Confirmation */}
            {/* ------------------------------------------------------------- */}
            {showDeleteModal && selectedContact && (
                <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6" />
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-slate-900">Remove Contact?</h3>
                            <p className="mt-1 text-sm text-slate-600">
                                Are you sure you want to delete <span className="font-semibold text-slate-900">{selectedContact.name}</span> ({selectedContact.email})?
                                This action will remove them from your store's contact directory.
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowDeleteModal(false)}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteContact}
                                disabled={actionLoading}
                                className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {actionLoading && <RefreshCw className="w-4 h-4 animate-spin" />}
                                <span>Delete Contact</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* ------------------------------------------------------------- */}
            {/* Modal: Order Invoice Modal */}
            {/* ------------------------------------------------------------- */}
            {showInvoiceModal && selectedInvoiceOrder && (
                <div className="invoice-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs">
                    <div className="invoice-modal-content bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[94vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex-1 overflow-y-auto">
                            <Invoice
                                orderId={selectedInvoiceOrder._id}
                                initialOrder={selectedInvoiceOrder}
                                onClose={() => {
                                    setShowInvoiceModal(false);
                                    setSelectedInvoiceOrder(null);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ContactManagement;
