import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Ticket,
    PlusCircle,
    Search,
    Filter,
    Edit3,
    Trash2,
    CheckCircle2,
    AlertCircle,
    X,
    RefreshCw,
    TrendingUp,
    Calendar,
    Clock,
    Percent
} from '../../components/seller/SellerIcons';

const initialFormData = {
    code: '',
    discountType: 'percentage',
    discountValue: '',
    minOrderAmount: '',
    expiryDate: '',
    usageLimit: '100',
    active: true,
    description: ''
};

const Coupons = () => {
    const { axios, currency } = useAppContext();

    const [coupons, setCoupons] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);

    // Filter & Search states
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');

    // Modals
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    // Form data
    const [formData, setFormData] = useState(initialFormData);
    const [selectedCoupon, setSelectedCoupon] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [togglingId, setTogglingId] = useState(null);

    // Fetch stats
    const fetchStats = async () => {
        try {
            setStatsLoading(true);
            const { data } = await axios.get('/api/seller/coupons/stats');
            if (data.success) {
                setStats(data.stats);
            }
        } catch (err) {
            console.error('Failed to fetch coupon stats:', err.message);
        } finally {
            setStatsLoading(false);
        }
    };

    // Fetch coupons list
    const fetchCoupons = async () => {
        try {
            setLoading(true);
            const params = {};
            if (searchQuery.trim()) params.search = searchQuery.trim();
            if (statusFilter !== 'all') params.status = statusFilter;
            if (typeFilter !== 'all') params.discountType = typeFilter;

            const { data } = await axios.get('/api/seller/coupons', { params });
            if (data.success) {
                setCoupons(data.coupons || []);
            } else {
                toast.error(data.message || 'Failed to load coupons');
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to load coupons';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCoupons();
    }, [statusFilter, typeFilter]);

    useEffect(() => {
        fetchStats();
    }, []);

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchCoupons();
    };

    // Open create modal
    const handleOpenCreateModal = () => {
        // Set default expiry date to 30 days from now
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30);
        const dateStr = defaultDate.toISOString().split('T')[0];

        setFormData({
            ...initialFormData,
            expiryDate: dateStr
        });
        setSelectedCoupon(null);
        setShowCreateModal(true);
    };

    // Open edit modal
    const handleOpenEditModal = (coupon) => {
        setSelectedCoupon(coupon);
        const expStr = coupon.expiryDate
            ? new Date(coupon.expiryDate).toISOString().split('T')[0]
            : '';

        setFormData({
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            minOrderAmount: coupon.minOrderAmount || '0',
            expiryDate: expStr,
            usageLimit: coupon.usageLimit,
            active: coupon.active,
            description: coupon.description || ''
        });
        setShowEditModal(true);
    };

    // Open delete confirmation modal
    const handleOpenDeleteModal = (coupon) => {
        setSelectedCoupon(coupon);
        setShowDeleteModal(true);
    };

    // Toggle active status
    const handleToggleStatus = async (coupon) => {
        setTogglingId(coupon._id);
        try {
            const { data } = await axios.patch(`/api/seller/coupons/${coupon._id}/status`);
            if (data.success) {
                toast.success(data.message || `Coupon ${data.coupon.active ? 'activated' : 'deactivated'}`);
                setCoupons(prev => prev.map(c => c._id === coupon._id ? data.coupon : c));
                fetchStats();
            } else {
                toast.error(data.message);
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to toggle status';
            toast.error(msg);
        } finally {
            setTogglingId(null);
        }
    };

    // Create coupon submit
    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const payload = {
                code: formData.code.trim().toUpperCase(),
                discountType: formData.discountType,
                discountValue: Number(formData.discountValue),
                minOrderAmount: Number(formData.minOrderAmount) || 0,
                expiryDate: formData.expiryDate,
                usageLimit: Number(formData.usageLimit),
                active: formData.active,
                description: formData.description.trim()
            };

            const { data } = await axios.post('/api/seller/coupons', payload);
            if (data.success) {
                toast.success(data.message || 'Coupon created successfully');
                setShowCreateModal(false);
                fetchCoupons();
                fetchStats();
            } else {
                toast.error(data.message);
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to create coupon';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Edit coupon submit
    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!selectedCoupon) return;
        setSubmitting(true);

        try {
            const payload = {
                code: formData.code.trim().toUpperCase(),
                discountType: formData.discountType,
                discountValue: Number(formData.discountValue),
                minOrderAmount: Number(formData.minOrderAmount) || 0,
                expiryDate: formData.expiryDate,
                usageLimit: Number(formData.usageLimit),
                active: formData.active,
                description: formData.description.trim()
            };

            const { data } = await axios.put(`/api/seller/coupons/${selectedCoupon._id}`, payload);
            if (data.success) {
                toast.success(data.message || 'Coupon updated successfully');
                setShowEditModal(false);
                setCoupons(prev => prev.map(c => c._id === selectedCoupon._id ? data.coupon : c));
                fetchStats();
            } else {
                toast.error(data.message);
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to update coupon';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    // Delete coupon submit
    const handleDeleteSubmit = async () => {
        if (!selectedCoupon) return;
        setSubmitting(true);
        try {
            const { data } = await axios.delete(`/api/seller/coupons/${selectedCoupon._id}`);
            if (data.success) {
                toast.success(data.message || 'Coupon deleted');
                setShowDeleteModal(false);
                setCoupons(prev => prev.filter(c => c._id !== selectedCoupon._id));
                fetchStats();
            } else {
                toast.error(data.message);
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to delete coupon';
            toast.error(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const isCouponExpired = (expiryDate) => {
        return new Date(expiryDate) <= new Date();
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                            <Ticket className="w-6 h-6" />
                        </div>
                        Coupon & Promotion Manager
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Create, manage, and monitor discount coupons and promotional campaigns
                    </p>
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <button
                        type="button"
                        onClick={() => { fetchCoupons(); fetchStats(); }}
                        className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs cursor-pointer"
                        title="Refresh list"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm transition shadow-xs cursor-pointer"
                    >
                        <PlusCircle className="w-4 h-4" />
                        <span>Create Coupon</span>
                    </button>
                </div>
            </div>

            {/* Performance Statistics Banner */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-slate-500">
                        <span className="text-xs font-semibold uppercase tracking-wider">Total Coupons</span>
                        <Ticket className="w-4 h-4 text-slate-400" />
                    </div>
                    <p className="text-2xl font-bold text-slate-900">
                        {statsLoading ? '...' : (stats?.totalCoupons || 0)}
                    </p>
                    <p className="text-xs text-slate-400">All configured campaigns</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-emerald-600">
                        <span className="text-xs font-semibold uppercase tracking-wider">Active Promos</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <p className="text-2xl font-bold text-emerald-700">
                        {statsLoading ? '...' : (stats?.activeCoupons || 0)}
                    </p>
                    <p className="text-xs text-slate-400">Currently live & redeemable</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-blue-600">
                        <span className="text-xs font-semibold uppercase tracking-wider">Redemptions</span>
                        <TrendingUp className="w-4 h-4 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-blue-700">
                        {statsLoading ? '...' : (stats?.totalRedemptions || 0)}
                    </p>
                    <p className="text-xs text-slate-400">Total times coupons were used</p>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-purple-600">
                        <span className="text-xs font-semibold uppercase tracking-wider">Customer Savings</span>
                        <Percent className="w-4 h-4 text-purple-500" />
                    </div>
                    <p className="text-2xl font-bold text-purple-700">
                        {statsLoading ? '...' : `${currency}${stats?.totalDiscountGranted || 0}`}
                    </p>
                    <p className="text-xs text-slate-400">Total discounts granted</p>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <form onSubmit={handleSearchSubmit} className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search by coupon code or promotion description..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-20 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    />
                    <button
                        type="submit"
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition cursor-pointer"
                    >
                        Search
                    </button>
                </form>

                <div className="flex items-center gap-2.5">
                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-semibold text-slate-600">Status:</span>
                        <select
                            value={statusFilter}
                            onChange={e => setStatusFilter(e.target.value)}
                            className="bg-transparent text-xs font-medium text-slate-800 outline-none cursor-pointer"
                        >
                            <option value="all">All</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="expired">Expired</option>
                        </select>
                    </div>

                    {/* Discount Type Filter */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                        <span className="text-xs font-semibold text-slate-600">Type:</span>
                        <select
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value)}
                            className="bg-transparent text-xs font-medium text-slate-800 outline-none cursor-pointer"
                        >
                            <option value="all">All Types</option>
                            <option value="percentage">Percentage (%)</option>
                            <option value="fixed">Fixed Amount</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Coupons Table / Grid */}
            {loading ? (
                <div className="py-20 text-center space-y-3">
                    <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="text-sm text-slate-500">Loading coupons...</p>
                </div>
            ) : coupons.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <Ticket className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-800">No coupons found</h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {searchQuery || statusFilter !== 'all' || typeFilter !== 'all'
                            ? "No coupons match your filter criteria. Try adjusting your search."
                            : "No coupons have been created yet. Launch your first promotional coupon to boost customer checkouts."}
                    </p>
                    <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition cursor-pointer"
                    >
                        <PlusCircle className="w-4 h-4" />
                        <span>Create First Coupon</span>
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                                <tr>
                                    <th className="py-3.5 px-4">Coupon Code</th>
                                    <th className="py-3.5 px-4">Discount</th>
                                    <th className="py-3.5 px-4">Min. Order</th>
                                    <th className="py-3.5 px-4">Usage / Limit</th>
                                    <th className="py-3.5 px-4">Expiry Date</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {coupons.map((coupon) => {
                                    const expired = isCouponExpired(coupon.expiryDate);
                                    const usagePercent = Math.min(100, Math.round(((coupon.usedCount || 0) / coupon.usageLimit) * 100));

                                    return (
                                        <tr key={coupon._id} className="hover:bg-slate-50/70 transition-colors">
                                            {/* Code & Description */}
                                            <td className="py-4 px-4">
                                                <div className="space-y-0.5">
                                                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-sm">
                                                        {coupon.code}
                                                    </span>
                                                    {coupon.description && (
                                                        <p className="text-xs text-slate-500 truncate max-w-xs" title={coupon.description}>
                                                            {coupon.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Discount Value */}
                                            <td className="py-4 px-4 font-semibold text-slate-800">
                                                {coupon.discountType === 'percentage' ? (
                                                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-200">
                                                        {coupon.discountValue}% OFF
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full text-xs font-bold border border-blue-200">
                                                        {currency}{coupon.discountValue} FLAT
                                                    </span>
                                                )}
                                            </td>

                                            {/* Minimum Order */}
                                            <td className="py-4 px-4 text-slate-600 text-xs">
                                                {coupon.minOrderAmount > 0 ? (
                                                    <span>{currency}{coupon.minOrderAmount}</span>
                                                ) : (
                                                    <span className="text-slate-400 italic">No minimum</span>
                                                )}
                                            </td>

                                            {/* Usage Progress */}
                                            <td className="py-4 px-4 min-w-[140px]">
                                                <div className="space-y-1.5">
                                                    <div className="flex justify-between text-xs">
                                                        <span className="font-semibold text-slate-700">{coupon.usedCount || 0} used</span>
                                                        <span className="text-slate-400">of {coupon.usageLimit}</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${
                                                                usagePercent >= 100
                                                                    ? 'bg-rose-500'
                                                                    : usagePercent >= 80
                                                                    ? 'bg-amber-500'
                                                                    : 'bg-emerald-500'
                                                            }`}
                                                            style={{ width: `${usagePercent}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Expiry Date */}
                                            <td className="py-4 px-4 text-xs">
                                                <div className="flex items-center gap-1.5 text-slate-600">
                                                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>
                                                        {new Date(coupon.expiryDate).toLocaleDateString('en-US', {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            year: 'numeric'
                                                        })}
                                                    </span>
                                                </div>
                                                {expired && (
                                                    <span className="text-[10px] text-rose-600 font-semibold uppercase tracking-wider block mt-0.5">
                                                        Expired
                                                    </span>
                                                )}
                                            </td>

                                            {/* Status Badge */}
                                            <td className="py-4 px-4 text-center">
                                                {expired ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                                        Expired
                                                    </span>
                                                ) : coupon.active ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-4 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {/* Toggle Status Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleStatus(coupon)}
                                                        disabled={togglingId === coupon._id}
                                                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                                            coupon.active
                                                                ? 'text-amber-700 bg-amber-50/70 border-amber-200 hover:bg-amber-100'
                                                                : 'text-emerald-700 bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100'
                                                        }`}
                                                        title={coupon.active ? 'Deactivate coupon' : 'Activate coupon'}
                                                    >
                                                        {coupon.active ? 'Deactivate' : 'Activate'}
                                                    </button>

                                                    {/* Edit Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditModal(coupon)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-700 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition cursor-pointer"
                                                        title="Edit coupon"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>

                                                    {/* Delete Button */}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenDeleteModal(coupon)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer"
                                                        title="Delete coupon"
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
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Modal: Create Coupon */}
            {/* ------------------------------------------------------------- */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                                    <Ticket className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900">Create Promotional Coupon</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
                            {/* Code */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Coupon Code <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. SUMMER20"
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    className="w-full uppercase font-mono font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                                />
                                <p className="text-[11px] text-slate-400 mt-0.5">Normalized automatically to uppercase.</p>
                            </div>

                            {/* Discount Type */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Discount Type <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${formData.discountType === 'percentage' ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-semibold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                        <input
                                            type="radio"
                                            name="discountType"
                                            value="percentage"
                                            checked={formData.discountType === 'percentage'}
                                            onChange={e => setFormData({ ...formData, discountType: e.target.value })}
                                            className="accent-emerald-600"
                                        />
                                        <span className="text-xs">Percentage (%)</span>
                                    </label>
                                    <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${formData.discountType === 'fixed' ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-semibold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                        <input
                                            type="radio"
                                            name="discountType"
                                            value="fixed"
                                            checked={formData.discountType === 'fixed'}
                                            onChange={e => setFormData({ ...formData, discountType: e.target.value })}
                                            className="accent-emerald-600"
                                        />
                                        <span className="text-xs">Fixed Amount ({currency})</span>
                                    </label>
                                </div>
                            </div>

                            {/* Discount Value & Min Order Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Discount Value <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        min="0.01"
                                        max={formData.discountType === 'percentage' ? "100" : undefined}
                                        placeholder={formData.discountType === 'percentage' ? "e.g. 20 (for 20%)" : "e.g. 50"}
                                        value={formData.discountValue}
                                        onChange={e => setFormData({ ...formData, discountValue: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Min. Order ({currency})
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        placeholder="0 (no minimum)"
                                        value={formData.minOrderAmount}
                                        onChange={e => setFormData({ ...formData, minOrderAmount: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                                    />
                                </div>
                            </div>

                            {/* Expiry Date & Usage Limit Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Expiry Date <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.expiryDate}
                                        onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Usage Limit <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        placeholder="e.g. 100"
                                        value={formData.usageLimit}
                                        onChange={e => setFormData({ ...formData, usageLimit: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                                    />
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Description / Campaign Notes
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Summer special 20% off all orders over $100"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                                />
                            </div>

                            {/* Active Toggle */}
                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="createActiveToggle"
                                    checked={formData.active}
                                    onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                                />
                                <label htmlFor="createActiveToggle" className="text-xs font-medium text-slate-700 cursor-pointer">
                                    Activate immediately upon creation
                                </label>
                            </div>

                            {/* Live Customer Preview */}
                            {formData.code && (
                                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1 text-xs">
                                    <span className="font-semibold text-emerald-900 uppercase text-[10px] tracking-wider block">Customer Checkout Preview:</span>
                                    <p className="font-mono font-bold text-emerald-800 text-sm">
                                        {formData.code} &bull; {formData.discountType === 'percentage' ? `${formData.discountValue || 0}% OFF` : `${currency}${formData.discountValue || 0} OFF`}
                                    </p>
                                    <p className="text-emerald-700">
                                        {Number(formData.minOrderAmount) > 0 ? `Minimum order ${currency}${formData.minOrderAmount}` : 'No minimum order required'}
                                    </p>
                                </div>
                            )}

                            {/* Buttons */}
                            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                                >
                                    {submitting ? 'Creating...' : 'Create Coupon'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Modal: Edit Coupon */}
            {/* ------------------------------------------------------------- */}
            {showEditModal && selectedCoupon && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
                    <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
                        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                                    <Edit3 className="w-5 h-5" />
                                </div>
                                <h3 className="text-base font-bold text-slate-900">Edit Coupon: {selectedCoupon.code}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowEditModal(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                            {/* Code */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Coupon Code <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.code}
                                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    className="w-full uppercase font-mono font-semibold px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                                />
                            </div>

                            {/* Discount Type */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                                    Discount Type <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${formData.discountType === 'percentage' ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-semibold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                        <input
                                            type="radio"
                                            name="editDiscountType"
                                            value="percentage"
                                            checked={formData.discountType === 'percentage'}
                                            onChange={e => setFormData({ ...formData, discountType: e.target.value })}
                                            className="accent-emerald-600"
                                        />
                                        <span className="text-xs">Percentage (%)</span>
                                    </label>
                                    <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition ${formData.discountType === 'fixed' ? 'border-emerald-500 bg-emerald-50/50 text-emerald-900 font-semibold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                        <input
                                            type="radio"
                                            name="editDiscountType"
                                            value="fixed"
                                            checked={formData.discountType === 'fixed'}
                                            onChange={e => setFormData({ ...formData, discountType: e.target.value })}
                                            className="accent-emerald-600"
                                        />
                                        <span className="text-xs">Fixed Amount ({currency})</span>
                                    </label>
                                </div>
                            </div>

                            {/* Discount Value & Min Order Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Discount Value <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        min="0.01"
                                        max={formData.discountType === 'percentage' ? "100" : undefined}
                                        value={formData.discountValue}
                                        onChange={e => setFormData({ ...formData, discountValue: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Min. Order ({currency})
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.minOrderAmount}
                                        onChange={e => setFormData({ ...formData, minOrderAmount: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                                    />
                                </div>
                            </div>

                            {/* Expiry Date & Usage Limit Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Expiry Date <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.expiryDate}
                                        onChange={e => setFormData({ ...formData, expiryDate: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                        Usage Limit <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min={selectedCoupon.usedCount || 1}
                                        value={formData.usageLimit}
                                        onChange={e => setFormData({ ...formData, usageLimit: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                                    />
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        Current used count: {selectedCoupon.usedCount || 0}
                                    </p>
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                                    Description / Campaign Notes
                                </label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                                />
                            </div>

                            {/* Active Toggle */}
                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="editActiveToggle"
                                    checked={formData.active}
                                    onChange={e => setFormData({ ...formData, active: e.target.checked })}
                                    className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                                />
                                <label htmlFor="editActiveToggle" className="text-xs font-medium text-slate-700 cursor-pointer">
                                    Coupon is active
                                </label>
                            </div>

                            {/* Buttons */}
                            <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                                >
                                    {submitting ? 'Updating...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* Modal: Delete Confirmation */}
            {/* ------------------------------------------------------------- */}
            {showDeleteModal && selectedCoupon && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
                        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <div className="text-center space-y-1.5">
                            <h3 className="text-base font-bold text-slate-900">
                                Delete Coupon "{selectedCoupon.code}"?
                            </h3>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                This will permanently remove the coupon. Customers will no longer be able to apply this code at checkout. Existing completed orders will preserve their historical discount records.
                            </p>
                        </div>

                        <div className="pt-2 flex items-center justify-center gap-3">
                            <button
                                type="button"
                                onClick={() => setShowDeleteModal(false)}
                                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteSubmit}
                                disabled={submitting}
                                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                            >
                                {submitting ? 'Deleting...' : 'Confirm Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Coupons;
