import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    History,
    Search,
    Filter,
    Calendar,
    RefreshCw,
    Eye,
    X,
    ChevronLeft,
    ChevronRight,
    Users,
    Package,
    ShoppingBag,
    Contact,
    Shield,
    Activity,
    Info,
    Check
} from '../../components/seller/SellerIcons';

/**
 * Formats timestamps in Bangladesh Standard Time (Asia/Dhaka, UTC+6)
 */
export const formatDhakaTime = (isoString) => {
    if (!isoString) return '—';
    try {
        const d = new Date(isoString);
        if (Number.isNaN(d.getTime())) return '—';
        const formatted = new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Asia/Dhaka',
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        }).format(d);
        return `${formatted} (BST)`;
    } catch {
        return String(isoString);
    }
};

/**
 * Role badge styling
 */
export const getRoleBadge = (role) => {
    const normalized = (role || '').toLowerCase();
    if (normalized === 'admin') {
        return 'bg-purple-50 text-purple-700 border-purple-200/80';
    }
    if (normalized === 'ceo') {
        return 'bg-blue-50 text-blue-700 border-blue-200/80';
    }
    if (normalized === 'cto') {
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
    }
    if (normalized === 'strategist') {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
};

/**
 * Action badge styling
 */
export const getActionBadge = (action) => {
    const act = (action || '').toUpperCase();
    if (act === 'CREATE') {
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
    }
    if (act === 'UPDATE') {
        return 'bg-blue-50 text-blue-700 border-blue-200/80';
    }
    if (act === 'DELETE') {
        return 'bg-rose-50 text-rose-700 border-rose-200/80';
    }
    if (act === 'STATUS_CHANGE') {
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
};

/**
 * Entity type badge styling
 */
export const getEntityBadge = (entityType) => {
    const ent = (entityType || '').toUpperCase();
    if (ent === 'PRODUCT') {
        return 'bg-teal-50 text-teal-700 border-teal-200/80';
    }
    if (ent === 'ORDER') {
        return 'bg-indigo-50 text-indigo-700 border-indigo-200/80';
    }
    if (ent === 'CUSTOMER') {
        return 'bg-cyan-50 text-cyan-700 border-cyan-200/80';
    }
    if (ent === 'TEAM_MEMBER') {
        return 'bg-violet-50 text-violet-700 border-violet-200/80';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200';
};

const ActivityLogs = () => {
    const { axios, sellerUser } = useAppContext();

    const isAdmin = sellerUser?.role === 'Admin';

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState({ total: 0, products: 0, orders: 0, customers: 0, teamMembers: 0 });
    const [actors, setActors] = useState([]);

    // Filters & Pagination state
    const [page, setPage] = useState(1);
    const [limit] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);

    const [search, setSearch] = useState('');
    const [selectedModule, setSelectedModule] = useState('ALL');
    const [selectedAction, setSelectedAction] = useState('ALL');
    const [selectedActor, setSelectedActor] = useState('ALL');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Modal state
    const [selectedLog, setSelectedLog] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [viewRawJson, setViewRawJson] = useState(false);

    const fetchLogs = useCallback(async () => {
        if (!isAdmin) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const params = {
                page,
                limit,
                search: search.trim() || undefined,
                module: selectedModule !== 'ALL' ? selectedModule : undefined,
                action: selectedAction !== 'ALL' ? selectedAction : undefined,
                actor: selectedActor !== 'ALL' ? selectedActor : undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            };

            const { data } = await axios.get('/api/seller/activity-logs', { params });

            if (data.success) {
                setLogs(data.logs || []);
                setTotalPages(data.pagination?.totalPages || 1);
                setTotalLogs(data.pagination?.totalLogs || 0);
                if (data.stats) setStats(data.stats);
                if (data.actors) setActors(data.actors);
            } else {
                setError(data.message || 'Failed to load activity logs');
            }
        } catch (err) {
            console.error('Fetch activity logs error:', err);
            const msg = err.response?.data?.message || err.message || 'Error loading activity logs';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [axios, isAdmin, page, limit, search, selectedModule, selectedAction, selectedActor, startDate, endDate]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleResetFilters = () => {
        setSearch('');
        setSelectedModule('ALL');
        setSelectedAction('ALL');
        setSelectedActor('ALL');
        setStartDate('');
        setEndDate('');
        setPage(1);
    };

    const handleOpenDetails = (log) => {
        setSelectedLog(log);
        setViewRawJson(false);
        setShowModal(true);
    };

    const handleCloseDetails = () => {
        setSelectedLog(null);
        setShowModal(false);
    };

    if (!isAdmin) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center">
                    <Shield className="w-12 h-12 text-rose-600 mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-rose-900 mb-1">Access Restricted</h2>
                    <p className="text-sm text-rose-700 mb-4">
                        The Activity Log section contains privileged audit records and is strictly restricted to Administrator accounts.
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-semibold">
                        Your Role: {sellerUser?.role || 'Unauthorized'}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200/60">
                            <History className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Admin Activity Log</h1>
                            <p className="text-xs sm:text-sm text-slate-500">
                                Authoritative audit trail of administrative mutations, configuration updates, and business events.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Dhaka Time (BST)</span>
                    </span>
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200/80 rounded-xl shadow-xs hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
                        title="Refresh activity logs"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Quick Metrics / Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200/70 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-xs font-medium uppercase tracking-wider">Total Actions</span>
                        <Activity className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{stats.total || totalLogs}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Recorded operations</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200/70 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-xs font-medium uppercase tracking-wider">Products</span>
                        <Package className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{stats.products || 0}</div>
                    <div className="text-[11px] text-teal-600 font-medium mt-0.5">Catalog changes</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200/70 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-xs font-medium uppercase tracking-wider">Orders</span>
                        <ShoppingBag className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{stats.orders || 0}</div>
                    <div className="text-[11px] text-indigo-600 font-medium mt-0.5">Status & workflow updates</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200/70 shadow-xs">
                    <div className="flex items-center justify-between text-slate-500 mb-1">
                        <span className="text-xs font-medium uppercase tracking-wider">Team & Customers</span>
                        <Users className="w-4 h-4 text-violet-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{(stats.teamMembers || 0) + (stats.customers || 0)}</div>
                    <div className="text-[11px] text-violet-600 font-medium mt-0.5">Accounts & Directory</div>
                </div>
            </div>

            {/* Filter Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs space-y-3">
                <div className="flex flex-col lg:flex-row gap-3">
                    {/* Search bar */}
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Search by description, record name, ID, or actor..."
                            className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Module Filter */}
                    <div className="w-full sm:w-auto">
                        <select
                            value={selectedModule}
                            onChange={(e) => {
                                setSelectedModule(e.target.value);
                                setPage(1);
                            }}
                            className="w-full sm:w-44 px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700"
                        >
                            <option value="ALL">All Modules</option>
                            <option value="PRODUCT">Products</option>
                            <option value="ORDER">Orders</option>
                            <option value="CUSTOMER">Customers</option>
                            <option value="TEAM_MEMBER">Team Members</option>
                        </select>
                    </div>

                    {/* Action Filter */}
                    <div className="w-full sm:w-auto">
                        <select
                            value={selectedAction}
                            onChange={(e) => {
                                setSelectedAction(e.target.value);
                                setPage(1);
                            }}
                            className="w-full sm:w-40 px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700"
                        >
                            <option value="ALL">All Actions</option>
                            <option value="CREATE">CREATE</option>
                            <option value="UPDATE">UPDATE</option>
                            <option value="STATUS_CHANGE">STATUS_CHANGE</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                    </div>

                    {/* User / Actor filter */}
                    {actors.length > 0 && (
                        <div className="w-full sm:w-auto">
                            <select
                                value={selectedActor}
                                onChange={(e) => {
                                    setSelectedActor(e.target.value);
                                    setPage(1);
                                }}
                                className="w-full sm:w-48 px-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-slate-700"
                            >
                                <option value="ALL">All Actors</option>
                                {actors.map(email => (
                                    <option key={email} value={email}>{email}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Secondary row: Date range & Reset */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Date Range:</span>
                        </div>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setPage(1);
                            }}
                            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            title="Start Date"
                        />
                        <span className="text-xs text-slate-400">to</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setPage(1);
                            }}
                            className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            title="End Date"
                        />
                    </div>

                    {(search || selectedModule !== 'ALL' || selectedAction !== 'ALL' || selectedActor !== 'ALL' || startDate || endDate) && (
                        <button
                            onClick={handleResetFilters}
                            className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold px-2.5 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs sm:text-sm text-rose-700 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>{error}</span>
                    </div>
                    <button
                        onClick={fetchLogs}
                        className="px-3 py-1 bg-white border border-rose-300 rounded-lg text-rose-700 font-semibold hover:bg-rose-100 text-xs transition-colors shrink-0"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Activity Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-slate-700">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200/70 text-[11px] uppercase tracking-wider font-semibold text-slate-500">
                                <th className="py-3.5 px-4 sm:px-6">Date & Time (Dhaka)</th>
                                <th className="py-3.5 px-4">User / Actor</th>
                                <th className="py-3.5 px-3">Role</th>
                                <th className="py-3.5 px-3">Action</th>
                                <th className="py-3.5 px-3">Module</th>
                                <th className="py-3.5 px-4">Description</th>
                                <th className="py-3.5 px-4 text-right">Details</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                            {loading ? (
                                Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="py-4 px-4 sm:px-6"><div className="h-4 bg-slate-200 rounded-md w-36" /></td>
                                        <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded-md w-28" /></td>
                                        <td className="py-4 px-3"><div className="h-5 bg-slate-200 rounded-full w-16" /></td>
                                        <td className="py-4 px-3"><div className="h-5 bg-slate-200 rounded-full w-20" /></td>
                                        <td className="py-4 px-3"><div className="h-5 bg-slate-200 rounded-full w-20" /></td>
                                        <td className="py-4 px-4"><div className="h-4 bg-slate-200 rounded-md w-48" /></td>
                                        <td className="py-4 px-4 text-right"><div className="h-6 bg-slate-200 rounded-md w-16 ml-auto" /></td>
                                    </tr>
                                ))
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-16 text-center text-slate-500">
                                        <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <div className="font-semibold text-slate-700 text-base">No activity logs found</div>
                                        <div className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                            {search || selectedModule !== 'ALL' || selectedAction !== 'ALL' || selectedActor !== 'ALL' || startDate || endDate
                                                ? 'No activities match the current filters. Try resetting your search parameters.'
                                                : 'Administrative activities will be logged here automatically as changes occur.'}
                                        </div>
                                        {(search || selectedModule !== 'ALL' || selectedAction !== 'ALL' || selectedActor !== 'ALL' || startDate || endDate) && (
                                            <button
                                                onClick={handleResetFilters}
                                                className="mt-4 px-4 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
                                            >
                                                Clear all filters
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => {
                                    const timeDisplay = log.dhakaTime || formatDhakaTime(log.createdAt);
                                    return (
                                        <tr key={log._id || log.createdAt} className="hover:bg-slate-50/70 transition-colors group">
                                            {/* Timestamp */}
                                            <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                                                <div className="font-medium text-slate-900">{timeDisplay}</div>
                                            </td>

                                            {/* Actor */}
                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 text-[11px] uppercase shrink-0">
                                                        {(log.actorName || log.actorEmail || 'A').charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-900 leading-tight">{log.actorName}</div>
                                                        <div className="text-[11px] text-slate-400 font-mono">{log.actorEmail}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Role */}
                                            <td className="py-3.5 px-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${getRoleBadge(log.actorRole)}`}>
                                                    {log.actorRole}
                                                </span>
                                            </td>

                                            {/* Action */}
                                            <td className="py-3.5 px-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border tracking-wider uppercase ${getActionBadge(log.action)}`}>
                                                    {log.action}
                                                </span>
                                            </td>

                                            {/* Module */}
                                            <td className="py-3.5 px-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${getEntityBadge(log.entityType)}`}>
                                                    {log.entityType}
                                                </span>
                                            </td>

                                            {/* Description & Target */}
                                            <td className="py-3.5 px-4 max-w-xs sm:max-w-md">
                                                <div className="text-slate-900 font-medium truncate" title={log.description}>
                                                    {log.description}
                                                </div>
                                                {log.entityName && log.entityName !== log.description && (
                                                    <div className="text-[11px] text-slate-400 truncate">
                                                        Target: <span className="text-slate-600 font-mono">{log.entityName}</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Action Button */}
                                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                <button
                                                    onClick={() => handleOpenDetails(log)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-all shadow-2xs"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>Details</span>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loading && totalLogs > 0 && (
                    <div className="px-4 sm:px-6 py-3.5 bg-slate-50/60 border-t border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
                        <div>
                            Showing <span className="font-semibold text-slate-900">{Math.min((page - 1) * limit + 1, totalLogs)}</span> to{' '}
                            <span className="font-semibold text-slate-900">{Math.min(page * limit, totalLogs)}</span> of{' '}
                            <span className="font-semibold text-slate-900">{totalLogs}</span> entries
                        </div>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span>Previous</span>
                            </button>

                            <div className="px-2 font-medium text-slate-700">
                                Page {page} of {totalPages}
                            </div>

                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                <span>Next</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Details Modal */}
            {showModal && selectedLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between bg-slate-50/70">
                            <div className="flex items-center gap-2.5">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border tracking-wider uppercase ${getActionBadge(selectedLog.action)}`}>
                                    {selectedLog.action}
                                </span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getEntityBadge(selectedLog.entityType)}`}>
                                    {selectedLog.entityType}
                                </span>
                                <h3 className="text-base font-bold text-slate-900 truncate">
                                    Activity Details
                                </h3>
                            </div>
                            <button
                                onClick={handleCloseDetails}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                                aria-label="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6 text-xs sm:text-sm">
                            {/* Metadata Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                                <div>
                                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Date & Time (Dhaka)</div>
                                    <div className="text-slate-900 font-semibold mt-0.5">
                                        {selectedLog.dhakaTime || formatDhakaTime(selectedLog.createdAt)}
                                    </div>
                                </div>

                                <div>
                                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Actor / User</div>
                                    <div className="text-slate-900 font-semibold mt-0.5 flex items-center gap-1.5">
                                        <span>{selectedLog.actorName}</span>
                                        <span className={`text-[10px] px-2 py-0.2 rounded-full font-semibold border ${getRoleBadge(selectedLog.actorRole)}`}>
                                            {selectedLog.actorRole}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-mono">{selectedLog.actorEmail}</div>
                                </div>

                                <div>
                                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Entity Affected</div>
                                    <div className="text-slate-900 font-semibold mt-0.5">{selectedLog.entityName}</div>
                                    <div className="text-[11px] text-slate-500 font-mono truncate" title={selectedLog.entityId}>
                                        ID: {selectedLog.entityId}
                                    </div>
                                </div>

                                <div>
                                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Client & IP Address</div>
                                    <div className="text-slate-900 font-mono mt-0.5 text-xs">
                                        {selectedLog.ipAddress || 'Not recorded'}
                                    </div>
                                    {selectedLog.userAgent && (
                                        <div className="text-[10px] text-slate-400 truncate mt-0.5" title={selectedLog.userAgent}>
                                            {selectedLog.userAgent}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Description</div>
                                <div className="p-3 bg-white border border-slate-200 rounded-xl text-slate-900 font-medium">
                                    {selectedLog.description}
                                </div>
                            </div>

                            {/* Changes Diff View */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                        Recorded Changes & Parameters
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setViewRawJson(prev => !prev)}
                                        className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
                                    >
                                        {viewRawJson ? 'View Diff Cards' : 'View Raw JSON'}
                                    </button>
                                </div>

                                {viewRawJson ? (
                                    <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs overflow-x-auto max-h-72">
                                        {JSON.stringify(selectedLog.changes || {}, null, 2)}
                                    </pre>
                                ) : selectedLog.changes ? (
                                    <div className="space-y-3">
                                        {/* If both before and after are present */}
                                        {selectedLog.changes.before && selectedLog.changes.after ? (
                                            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                                                <div className="grid grid-cols-3 bg-slate-100/70 p-2.5 font-semibold text-[11px] text-slate-600 uppercase tracking-wider">
                                                    <div>Field</div>
                                                    <div>Before</div>
                                                    <div>After</div>
                                                </div>
                                                {Object.keys(selectedLog.changes.after).map((key) => {
                                                    const beforeVal = selectedLog.changes.before[key];
                                                    const afterVal = selectedLog.changes.after[key];
                                                    return (
                                                        <div key={key} className="grid grid-cols-3 p-2.5 text-xs items-center hover:bg-slate-50">
                                                            <div className="font-semibold text-slate-700 font-mono">{key}</div>
                                                            <div className="text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-100 font-mono text-[11px] break-all">
                                                                {beforeVal !== undefined ? JSON.stringify(beforeVal) : '—'}
                                                            </div>
                                                            <div className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-100 font-mono text-[11px] break-all">
                                                                {afterVal !== undefined ? JSON.stringify(afterVal) : '—'}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        ) : selectedLog.changes.after ? (
                                            <div className="p-4 bg-emerald-50/50 border border-emerald-200/60 rounded-xl space-y-2">
                                                <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                                                    Initial Created Values
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                    {Object.entries(selectedLog.changes.after).map(([k, v]) => (
                                                        <div key={k} className="p-2 bg-white rounded-lg border border-emerald-100">
                                                            <span className="font-semibold text-slate-700 font-mono">{k}: </span>
                                                            <span className="text-emerald-800 font-mono">{JSON.stringify(v)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : selectedLog.changes.before ? (
                                            <div className="p-4 bg-rose-50/50 border border-rose-200/60 rounded-xl space-y-2">
                                                <div className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                                                    Values Prior to Deletion
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                    {Object.entries(selectedLog.changes.before).map(([k, v]) => (
                                                        <div key={k} className="p-2 bg-white rounded-lg border border-rose-100">
                                                            <span className="font-semibold text-slate-700 font-mono">{k}: </span>
                                                            <span className="text-rose-800 font-mono">{JSON.stringify(v)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                                                No specific field delta recorded
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
                                        No before/after delta recorded for this event
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-3 border-t border-slate-200/80 bg-slate-50 flex items-center justify-end">
                            <button
                                onClick={handleCloseDetails}
                                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl text-xs transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityLogs;
