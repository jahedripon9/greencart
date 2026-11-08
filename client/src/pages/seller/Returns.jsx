import React, { useEffect, useState, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Search,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Clock,
    DollarSign,
    Package,
    Shield,
    RotateCcw
} from '../../components/seller/SellerIcons';

const Returns = () => {
    const { currency, axios, sellerUser } = useAppContext();
    const isAdmin = (sellerUser?.role || 'Admin') === 'Admin';

    const [returns, setReturns] = useState([]);
    const [stats, setStats] = useState({
        totalRequests: 0,
        pendingRequests: 0,
        approvedReturns: 0,
        itemReceived: 0,
        refundProcessing: 0,
        completedRefunds: 0,
        totalRefundedAmount: 0
    });
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Detail Modal State
    const [selectedReturn, setSelectedReturn] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);

    // Reject Dialog State
    const [rejectModalOpen, setRejectModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    // Refund Dialog State
    const [refundModalOpen, setRefundModalOpen] = useState(false);
    const [refundAmount, setRefundAmount] = useState('');
    const [refundMethod, setRefundMethod] = useState('Original Payment');
    const [transactionReference, setTransactionReference] = useState('');
    const [refundNotes, setRefundNotes] = useState('');

    // Policy Settings Modal State
    const [policyModalOpen, setPolicyModalOpen] = useState(false);
    const [policyForm, setPolicyForm] = useState({
        returnWindowDays: 7,
        eligibleReasons: '',
        nonReturnableCategories: '',
        shippingRules: '',
        refundProcessingEstimate: '',
        policyContent: '',
        cancellationRules: ''
    });
    const [savingPolicy, setSavingPolicy] = useState(false);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [returnsRes, statsRes] = await Promise.all([
                axios.get('/api/seller/returns'),
                axios.get('/api/seller/returns/stats')
            ]);

            if (returnsRes.data.success) {
                setReturns(returnsRes.data.returns || []);
            }
            if (statsRes.data.success) {
                setStats(statsRes.data.stats || {});
            }
        } catch (error) {
            console.error("Failed to load return management data:", error.message);
            toast.error(error.response?.data?.message || "Failed to load returns");
        } finally {
            setLoading(false);
        }
    };

    const fetchPolicySettings = async () => {
        try {
            const { data } = await axios.get('/api/seller/returns/policy');
            if (data.success && data.policy) {
                setPolicyForm({
                    returnWindowDays: data.policy.returnWindowDays || 7,
                    eligibleReasons: (data.policy.eligibleReasons || []).join('\n'),
                    nonReturnableCategories: (data.policy.nonReturnableCategories || []).join(', '),
                    shippingRules: data.policy.shippingRules || '',
                    refundProcessingEstimate: data.policy.refundProcessingEstimate || '',
                    policyContent: data.policy.policyContent || '',
                    cancellationRules: data.policy.cancellationRules || ''
                });
            }
        } catch (err) {
            console.error("Failed to load policy:", err.message);
        }
    };

    useEffect(() => {
        fetchData();
    }, [axios]);

    const filteredReturns = useMemo(() => {
        return returns.filter((item) => {
            if (statusFilter !== 'ALL' && item.status !== statusFilter) {
                return false;
            }
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            const retNum = (item.returnNumber || '').toLowerCase();
            const ordNum = (item.orderNumber || '').toLowerCase();
            const custName = (item.pickupAddress?.firstName ? `${item.pickupAddress.firstName} ${item.pickupAddress.lastName}` : '').toLowerCase();
            const itemNames = (item.items || []).map(it => (it.name || '').toLowerCase()).join(' ');
            return retNum.includes(q) || ordNum.includes(q) || custName.includes(q) || itemNames.includes(q);
        });
    }, [returns, statusFilter, searchQuery]);

    // Handle Status Updates (Approve, Mark Item Received)
    const handleUpdateStatus = async (returnId, nextStatus, options = {}) => {
        setActionLoading(true);
        try {
            const payload = {
                status: nextStatus,
                ...options
            };

            const { data } = await axios.patch(`/api/seller/returns/${returnId}/status`, payload);
            if (data.success) {
                toast.success(data.message || `Status updated to ${nextStatus}`);
                setSelectedReturn(data.returnRequest);
                fetchData();
            } else {
                toast.error(data.message || "Failed to update status");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || "Status update failed");
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Reject Submission
    const handleConfirmReject = async (e) => {
        e.preventDefault();
        if (!rejectionReason.trim()) {
            toast.error("Please provide a rejection reason");
            return;
        }

        await handleUpdateStatus(selectedReturn._id, 'Rejected', {
            rejectionReason: rejectionReason.trim()
        });
        setRejectModalOpen(false);
        setRejectionReason('');
    };

    // Handle Refund Submission
    const handleConfirmRefund = async (e) => {
        e.preventDefault();
        const amt = Number(refundAmount);
        if (!Number.isFinite(amt) || amt <= 0) {
            toast.error("Please specify a valid refund amount");
            return;
        }

        setActionLoading(true);
        try {
            const { data } = await axios.post(`/api/seller/returns/${selectedReturn._id}/refund`, {
                amount: amt,
                refundMethod,
                transactionReference,
                notes: refundNotes
            });

            if (data.success) {
                toast.success(data.message || "Refund processed successfully");
                setSelectedReturn(data.returnRequest);
                setRefundModalOpen(false);
                fetchData();
            } else {
                toast.error(data.message || "Failed to process refund");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || "Refund processing failed");
        } finally {
            setActionLoading(false);
        }
    };

    // Handle Policy Settings Save
    const handleSavePolicy = async (e) => {
        e.preventDefault();
        setSavingPolicy(true);
        try {
            const payload = {
                returnWindowDays: Number(policyForm.returnWindowDays),
                eligibleReasons: policyForm.eligibleReasons.split('\n').map(s => s.trim()).filter(Boolean),
                nonReturnableCategories: policyForm.nonReturnableCategories.split(',').map(s => s.trim()).filter(Boolean),
                shippingRules: policyForm.shippingRules,
                refundProcessingEstimate: policyForm.refundProcessingEstimate,
                policyContent: policyForm.policyContent,
                cancellationRules: policyForm.cancellationRules
            };

            const { data } = await axios.put('/api/seller/returns/policy', payload);
            if (data.success) {
                toast.success("Policy settings updated successfully");
                setPolicyModalOpen(false);
            } else {
                toast.error(data.message || "Failed to update policy");
            }
        } catch (err) {
            toast.error(err.response?.data?.message || err.message || "Failed to save policy");
        } finally {
            setSavingPolicy(false);
        }
    };

    const renderBadge = (status) => {
        const config = {
            'Pending': 'bg-amber-100 text-amber-800 border-amber-300',
            'Approved': 'bg-blue-100 text-blue-800 border-blue-300',
            'Item Received': 'bg-indigo-100 text-indigo-800 border-indigo-300',
            'Refund Processing': 'bg-purple-100 text-purple-800 border-purple-300',
            'Completed': 'bg-emerald-100 text-emerald-800 border-emerald-300',
            'Rejected': 'bg-rose-100 text-rose-800 border-rose-300',
            'Cancelled': 'bg-gray-100 text-gray-600 border-gray-300'
        }[status] || 'bg-gray-100 text-gray-700 border-gray-200';

        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Return & Refund Management</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Review customer return requests, inspect physical goods, and execute atomic refunds
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {isAdmin && (
                        <button
                            type="button"
                            onClick={() => {
                                fetchPolicySettings();
                                setPolicyModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition cursor-pointer"
                        >
                            <Shield className="w-4 h-4 text-primary" />
                            <span>Policy Settings</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={fetchData}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-dull text-white rounded-xl text-xs sm:text-sm font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Total Requests</span>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalRequests || 0}</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-2xs">
                    <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider block">Pending Review</span>
                    <p className="text-2xl font-bold text-amber-700 mt-1">{stats.pendingRequests || 0}</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-blue-200/80 bg-blue-50/20 shadow-2xs">
                    <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider block">Approved Pickup</span>
                    <p className="text-2xl font-bold text-blue-700 mt-1">{stats.approvedReturns || 0}</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-purple-200/80 bg-purple-50/20 shadow-2xs">
                    <span className="text-xs font-semibold text-purple-700 uppercase tracking-wider block">Processing Refund</span>
                    <p className="text-2xl font-bold text-purple-700 mt-1">{(stats.itemReceived || 0) + (stats.refundProcessing || 0)}</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/20 shadow-2xs col-span-2 lg:col-span-1">
                    <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider block">Settled Refunds</span>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.completedRefunds || 0}</p>
                    <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                        Total: {currency}{stats.totalRefundedAmount?.toLocaleString() || 0}
                    </p>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by Return #, Order #, customer or item name..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                </div>

                {/* Status Tabs */}
                <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {['ALL', 'Pending', 'Approved', 'Item Received', 'Refund Processing', 'Completed', 'Rejected', 'Cancelled'].map((st) => (
                        <button
                            key={st}
                            type="button"
                            onClick={() => setStatusFilter(st)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                                statusFilter === st
                                    ? 'bg-slate-900 text-white shadow-xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                            }`}
                        >
                            {st}
                        </button>
                    ))}
                </div>
            </div>

            {/* Return Requests Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                            <tr>
                                <th className="py-3.5 px-4">Return / Order #</th>
                                <th className="py-3.5 px-4">Date & Customer</th>
                                <th className="py-3.5 px-4">Items</th>
                                <th className="py-3.5 px-4">Refund Amount</th>
                                <th className="py-3.5 px-4">Method</th>
                                <th className="py-3.5 px-4">Status</th>
                                <th className="py-3.5 px-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-400">
                                        <div className="flex items-center justify-center gap-2">
                                            <RefreshCw className="w-5 h-5 animate-spin text-primary" />
                                            <span>Loading return records...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredReturns.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-400">
                                        No return requests found matching current criteria.
                                    </td>
                                </tr>
                            ) : (
                                filteredReturns.map((ret) => {
                                    const custName = ret.pickupAddress?.firstName
                                        ? `${ret.pickupAddress.firstName} ${ret.pickupAddress.lastName}`
                                        : 'Customer';

                                    return (
                                        <tr key={ret._id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3.5 px-4 font-medium">
                                                <div className="font-mono text-slate-900 font-bold">#{ret.returnNumber}</div>
                                                <div className="text-xs text-slate-400">Ord #{ret.orderNumber}</div>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="text-slate-800 font-medium">{custName}</div>
                                                <div className="text-xs text-slate-400">{ret.createdAtFormatted || new Date(ret.createdAt).toLocaleDateString()}</div>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className="text-xs text-slate-700 font-semibold">
                                                    {(ret.items || []).length} item{ret.items?.length !== 1 ? 's' : ''}
                                                </span>
                                                <p className="text-xs text-slate-400 truncate max-w-[180px]">
                                                    {(ret.items || []).map(i => i.name).join(', ')}
                                                </p>
                                            </td>
                                            <td className="py-3.5 px-4 font-bold text-slate-900">
                                                {currency}{ret.totalRefundAmount?.toLocaleString()}
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 font-medium">
                                                    {ret.returnMethod || 'Pickup'}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                {renderBadge(ret.status)}
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedReturn(ret)}
                                                    className="px-3 py-1.5 bg-slate-100 hover:bg-primary hover:text-white rounded-lg text-xs font-semibold text-slate-700 transition cursor-pointer"
                                                >
                                                    Manage
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* DETAIL MODAL / DRAWER */}
            {selectedReturn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" role="dialog">
                    <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="font-mono text-lg font-bold">#{selectedReturn.returnNumber}</h3>
                                    {renderBadge(selectedReturn.status)}
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">Order #{selectedReturn.orderNumber} • Submitted {selectedReturn.createdAtFormatted}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedReturn(null)}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-5 text-sm">
                            {/* Action Control Panel */}
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                                <span className="font-semibold text-slate-700 text-xs uppercase tracking-wider">
                                    Operational Actions:
                                </span>

                                <div className="flex flex-wrap items-center gap-2">
                                    {selectedReturn.status === 'Pending' && (
                                        <>
                                            <button
                                                type="button"
                                                disabled={actionLoading}
                                                onClick={() => handleUpdateStatus(selectedReturn._id, 'Approved')}
                                                className="px-4 py-1.5 bg-primary hover:bg-primary-dull text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                                            >
                                                Approve Return
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setRejectModalOpen(true)}
                                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                                            >
                                                Reject Return
                                            </button>
                                        </>
                                    )}

                                    {selectedReturn.status === 'Approved' && (
                                        <button
                                            type="button"
                                            disabled={actionLoading}
                                            onClick={() => handleUpdateStatus(selectedReturn._id, 'Item Received', { restockInventory: true })}
                                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                                        >
                                            Mark Item Received & Restock
                                        </button>
                                    )}

                                    {['Approved', 'Item Received', 'Refund Processing'].includes(selectedReturn.status) && isAdmin && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setRefundAmount(selectedReturn.totalRefundAmount || '');
                                                setRefundModalOpen(true);
                                            }}
                                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer"
                                        >
                                            Process Refund ({currency}{selectedReturn.totalRefundAmount})
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Return Items */}
                            <div>
                                <h4 className="font-bold text-slate-900 mb-2">Returned Items</h4>
                                <div className="border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden">
                                    {(selectedReturn.items || []).map((it, idx) => (
                                        <div key={idx} className="p-3.5 flex items-center justify-between">
                                            <div>
                                                <p className="font-semibold text-slate-800">{it.name}</p>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Quantity: <strong>{it.quantity}</strong> • Reason: <span className="text-slate-700 font-medium">{it.reason}</span>
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-slate-900">{currency}{it.totalPrice?.toLocaleString()}</p>
                                                <p className="text-[11px] text-slate-400">{currency}{it.unitPrice} each</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Customer Notes & Rejection Remarks */}
                            {selectedReturn.customerNotes && (
                                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
                                    <strong>Customer Notes:</strong> {selectedReturn.customerNotes}
                                </div>
                            )}

                            {selectedReturn.rejectionReason && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
                                    <strong>Rejection Reason:</strong> {selectedReturn.rejectionReason}
                                </div>
                            )}

                            {/* Pickup Address */}
                            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1">
                                <span className="font-bold text-slate-700 block mb-1">Collection / Pickup Details:</span>
                                <p><span className="text-slate-500">Method:</span> <strong>{selectedReturn.returnMethod}</strong></p>
                                <p>
                                    <span className="text-slate-500">Address: </span>
                                    {selectedReturn.pickupAddress?.street}, {selectedReturn.pickupAddress?.city}, {selectedReturn.pickupAddress?.country}
                                </p>
                                {selectedReturn.pickupAddress?.phone && (
                                    <p><span className="text-slate-500">Phone:</span> {selectedReturn.pickupAddress?.phone}</p>
                                )}
                            </div>

                            {/* Status Timeline History */}
                            <div>
                                <h4 className="font-bold text-slate-900 mb-2">Audit & Status History</h4>
                                <div className="space-y-2 border-l-2 border-slate-200 ml-2 pl-3 text-xs">
                                    {(selectedReturn.statusHistory || []).map((h, idx) => (
                                        <div key={idx} className="relative">
                                            <span className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-primary" />
                                            <p className="font-semibold text-slate-800">
                                                {h.status} <span className="font-normal text-slate-400">by {h.changedBy} ({h.changedByRole || 'Staff'})</span>
                                            </p>
                                            <p className="text-[11px] text-slate-500">{new Date(h.timestamp).toLocaleString()}</p>
                                            {h.note && <p className="text-slate-600 italic mt-0.5">{h.note}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedReturn(null)}
                                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
                            >
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* REJECT MODAL */}
            {rejectModalOpen && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <form onSubmit={handleConfirmReject} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
                        <h3 className="text-lg font-bold text-slate-900">Reject Return Request</h3>
                        <p className="text-xs text-slate-500">
                            Please provide the explicit reason for rejecting this return. This explanation will be communicated directly to the customer.
                        </p>
                        <textarea
                            rows={3}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="e.g. Returned item package was opened and consumed; does not meet safety criteria."
                            className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-rose-500"
                            required
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setRejectModalOpen(false)}
                                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={actionLoading}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* REFUND MODAL */}
            {refundModalOpen && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <form onSubmit={handleConfirmRefund} className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4">
                        <h3 className="text-lg font-bold text-slate-900">Process Customer Refund</h3>
                        <p className="text-xs text-slate-500">
                            Complete financial disbursement for Return #{selectedReturn?.returnNumber}.
                        </p>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Refund Amount ({currency})
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                max={selectedReturn?.totalRefundAmount}
                                value={refundAmount}
                                onChange={(e) => setRefundAmount(e.target.value)}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary font-bold"
                                required
                            />
                            <span className="text-[11px] text-slate-400">Max authorized: {currency}{selectedReturn?.totalRefundAmount}</span>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Disbursement Method
                            </label>
                            <select
                                value={refundMethod}
                                onChange={(e) => setRefundMethod(e.target.value)}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="Original Payment">Original Payment Method</option>
                                <option value="COD Cash Refund">COD Cash Collection Refund</option>
                                <option value="Store Credit">Store Credit / Wallet</option>
                                <option value="bKash/Nagad MFS">bKash / Nagad Mobile Financial Service</option>
                                <option value="Bank Transfer">Direct Bank Transfer</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Transaction Reference (Optional)
                            </label>
                            <input
                                type="text"
                                value={transactionReference}
                                onChange={(e) => setTransactionReference(e.target.value)}
                                placeholder="e.g. TRX-9823412 or Cash Voucher #12"
                                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setRefundModalOpen(false)}
                                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={actionLoading}
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                            >
                                Confirm & Issue Refund
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* POLICY SETTINGS MODAL */}
            {policyModalOpen && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                    <form onSubmit={handleSavePolicy} className="bg-white rounded-3xl p-6 max-w-xl w-full border border-slate-200 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <h3 className="text-lg font-bold text-slate-900">Manage Return & Refund Policy</h3>
                            <button
                                type="button"
                                onClick={() => setPolicyModalOpen(false)}
                                className="text-slate-400 hover:text-slate-700"
                            >
                                ✕
                            </button>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Return Window (Days)
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="90"
                                value={policyForm.returnWindowDays}
                                onChange={(e) => setPolicyForm({ ...policyForm, returnWindowDays: e.target.value })}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary font-bold"
                                required
                            />
                            <p className="text-[11px] text-slate-400 mt-0.5">Configurable return eligibility window following delivery.</p>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Eligible Reasons (One per line)
                            </label>
                            <textarea
                                rows={3}
                                value={policyForm.eligibleReasons}
                                onChange={(e) => setPolicyForm({ ...policyForm, eligibleReasons: e.target.value })}
                                className="w-full text-sm border border-slate-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Non-Returnable Categories (Comma-separated)
                            </label>
                            <input
                                type="text"
                                value={policyForm.nonReturnableCategories}
                                onChange={(e) => setPolicyForm({ ...policyForm, nonReturnableCategories: e.target.value })}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Shipping Rules
                            </label>
                            <input
                                type="text"
                                value={policyForm.shippingRules}
                                onChange={(e) => setPolicyForm({ ...policyForm, shippingRules: e.target.value })}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                                Refund Processing Estimate
                            </label>
                            <input
                                type="text"
                                value={policyForm.refundProcessingEstimate}
                                onChange={(e) => setPolicyForm({ ...policyForm, refundProcessingEstimate: e.target.value })}
                                className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                                required
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setPolicyModalOpen(false)}
                                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={savingPolicy}
                                className="px-5 py-2 bg-primary hover:bg-primary-dull text-white rounded-xl text-xs font-bold shadow-xs transition"
                            >
                                {savingPolicy ? "Saving..." : "Save Policy"}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default Returns;
