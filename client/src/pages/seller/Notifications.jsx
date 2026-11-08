import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import toast from 'react-hot-toast';
import {
    Bell,
    CheckCheck,
    Check,
    ShoppingBag,
    AlertTriangle,
    Users,
    Clock,
    Shield,
    Trash2,
    RefreshCw,
    Search,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Filter,
    Package
} from '../../components/seller/SellerIcons';

export const formatRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.max(0, Math.floor((now - date) / 1000));
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatFullDateTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
};

const getCategoryMetadata = (type) => {
    switch (type) {
        case 'new_order':
            return {
                label: 'New Order',
                category: 'Orders',
                icon: ShoppingBag,
                iconClass: 'text-emerald-700 bg-emerald-100 border-emerald-300',
                badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                accentBorder: 'border-l-emerald-500',
                actionLabel: 'View Order',
                targetPath: (data) => data?.orderId ? `/seller/orders` : '/seller/orders'
            };
        case 'low_stock':
            return {
                label: 'Low Stock Alert',
                category: 'Inventory',
                icon: AlertTriangle,
                iconClass: 'text-amber-700 bg-amber-100 border-amber-300',
                badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
                accentBorder: 'border-l-amber-500',
                actionLabel: 'Manage Stock',
                targetPath: () => '/seller/product-list'
            };
        case 'new_customer':
            return {
                label: 'New Customer',
                category: 'Customers',
                icon: Users,
                iconClass: 'text-blue-700 bg-blue-100 border-blue-300',
                badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
                accentBorder: 'border-l-blue-500',
                actionLabel: 'View Directory',
                targetPath: () => '/seller/contacts'
            };
        case 'pending_reminder':
            return {
                label: 'Pending Reminder',
                category: 'Orders',
                icon: Clock,
                iconClass: 'text-orange-700 bg-orange-100 border-orange-300',
                badgeClass: 'bg-orange-50 text-orange-800 border-orange-200',
                accentBorder: 'border-l-orange-500',
                actionLabel: 'Inspect Order',
                targetPath: (data) => data?.orderId ? `/seller/orders` : '/seller/orders'
            };
        case 'system':
        default:
            return {
                label: 'System Notice',
                category: 'System',
                icon: Shield,
                iconClass: 'text-purple-700 bg-purple-100 border-purple-300',
                badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
                accentBorder: 'border-l-purple-500',
                actionLabel: 'View System',
                targetPath: () => '/seller'
            };
    }
};

const TAB_FILTERS = [
    { id: 'all', label: 'All Alerts' },
    { id: 'unread', label: 'Unread' },
    { id: 'orders', label: 'Orders' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'customers', label: 'Customers' },
    { id: 'system', label: 'System' }
];

const Notifications = () => {
    const { axios, isSeller } = useAppContext();
    const navigate = useNavigate();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [scanningPending, setScanningPending] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [actionInProgress, setActionInProgress] = useState({});

    // Fetch Notifications
    const fetchNotifications = useCallback(async (isSilent = false) => {
        if (!isSeller) return;
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            const params = {
                page,
                limit: 15,
                filter: activeTab
            };
            if (searchQuery.trim()) {
                params.search = searchQuery.trim();
            }

            const { data } = await axios.get('/api/seller/notifications', { params });
            if (data.success) {
                setNotifications(data.notifications || []);
                setPage(data.pagination?.page || 1);
                setTotalPages(data.pagination?.totalPages || 1);
                setTotalItems(data.pagination?.total || 0);
                setUnreadCount(data.unreadCount || 0);
            } else {
                toast.error(data.message || 'Failed to fetch notifications');
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
            toast.error(error.response?.data?.message || 'Error fetching notifications');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [axios, isSeller, page, activeTab, searchQuery]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    // Reset to page 1 when filter or search changes
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
        setPage(1);
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
        setPage(1);
    };

    // Trigger Pending Order Scanner
    const handleScanPendingOrders = async () => {
        setScanningPending(true);
        try {
            const { data } = await axios.post('/api/seller/notifications/check-pending');
            if (data.success) {
                if (data.count > 0) {
                    toast.success(`Generated ${data.count} pending order reminder(s)`);
                } else {
                    toast.success('No overdue pending orders found');
                }
                fetchNotifications(true);
            } else {
                toast.error(data.message || 'Pending check failed');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error scanning pending orders');
        } finally {
            setScanningPending(false);
        }
    };

    // Mark single notification as read
    const handleMarkAsRead = async (id) => {
        setActionInProgress(prev => ({ ...prev, [id]: true }));
        try {
            const { data } = await axios.patch(`/api/seller/notifications/${id}/read`);
            if (data.success) {
                setNotifications(prev =>
                    prev.map(item => item._id === id ? { ...item, isRead: true } : item)
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to mark as read');
        } finally {
            setActionInProgress(prev => ({ ...prev, [id]: false }));
        }
    };

    // Mark all notifications as read
    const handleMarkAllRead = async () => {
        try {
            const { data } = await axios.patch('/api/seller/notifications/read-all');
            if (data.success) {
                setNotifications(prev => prev.map(item => ({ ...item, isRead: true })));
                setUnreadCount(0);
                toast.success('All notifications marked as read');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to mark all as read');
        }
    };

    // Delete single notification
    const handleDelete = async (id) => {
        setActionInProgress(prev => ({ ...prev, [id]: true }));
        try {
            const { data } = await axios.delete(`/api/seller/notifications/${id}`);
            if (data.success) {
                const deletedItem = notifications.find(item => item._id === id);
                if (deletedItem && !deletedItem.isRead) {
                    setUnreadCount(prev => Math.max(0, prev - 1));
                }
                setNotifications(prev => prev.filter(item => item._id !== id));
                setTotalItems(prev => Math.max(0, prev - 1));
                toast.success('Notification removed');
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete notification');
        } finally {
            setActionInProgress(prev => ({ ...prev, [id]: false }));
        }
    };

    // Direct resource navigation
    const handleNavigate = async (notification) => {
        if (!notification.isRead) {
            await handleMarkAsRead(notification._id);
        }
        const meta = getCategoryMetadata(notification.type);
        const path = meta.targetPath(notification.data);
        navigate(path);
    };

    // Derived statistics for overview cards
    const stats = useMemo(() => {
        const orderAlerts = notifications.filter(n => n.type === 'new_order' || n.type === 'pending_reminder').length;
        const inventoryAlerts = notifications.filter(n => n.type === 'low_stock').length;
        return {
            total: totalItems,
            unread: unreadCount,
            orders: orderAlerts,
            inventory: inventoryAlerts
        };
    }, [notifications, totalItems, unreadCount]);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-6">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Bell className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
                                Notification Center
                                {unreadCount > 0 && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                        {unreadCount} Unread
                                    </span>
                                )}
                            </h1>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Real-time alerts, inventory warnings, customer activity, and system notices.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Top Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        type="button"
                        onClick={handleScanPendingOrders}
                        disabled={scanningPending}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                        title="Scan orders pending for more than 24 hours"
                    >
                        <Clock className={`w-4 h-4 text-orange-600 ${scanningPending ? 'animate-spin' : ''}`} />
                        <span>{scanningPending ? 'Scanning...' : 'Check Pending'}</span>
                    </button>

                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer"
                        >
                            <CheckCheck className="w-4 h-4" />
                            <span>Mark All Read</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => fetchNotifications(false)}
                        disabled={refreshing}
                        className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300 rounded-lg transition-colors shadow-2xs cursor-pointer"
                        aria-label="Refresh notifications"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Quick KPI Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Records</span>
                        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
                            <Bell className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-slate-900 mt-2">{stats.total}</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Unread Alerts</span>
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                            <Check className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-emerald-700 mt-2">{stats.unread}</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Page Orders</span>
                        <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                            <ShoppingBag className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-blue-700 mt-2">{stats.orders}</div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Page Low Stock</span>
                        <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="text-2xl font-bold text-amber-700 mt-2">{stats.inventory}</div>
                </div>
            </div>

            {/* Filter Tabs and Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Filter Category Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                        {TAB_FILTERS.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => handleTabChange(tab.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                                    activeTab === tab.id
                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                }`}
                            >
                                {tab.label}
                                {tab.id === 'unread' && unreadCount > 0 && (
                                    <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                                        activeTab === 'unread'
                                            ? 'bg-emerald-800 text-white'
                                            : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                        {unreadCount}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Search Field */}
                    <div className="relative w-full md:w-72">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search alerts by title or message..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-colors"
                        />
                    </div>
                </div>
            </div>

            {/* Notification Card List */}
            <div className="space-y-3">
                {loading ? (
                    <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center space-y-4">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600 mx-auto" />
                        <p className="text-xs font-medium text-slate-500">Loading alerts...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                            <Bell className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-semibold text-slate-800">No notifications found</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                            {searchQuery
                                ? `No results matching "${searchQuery}". Try adjusting your search query.`
                                : activeTab === 'unread'
                                ? "You're completely caught up! No unread notifications."
                                : "Notifications will appear here as orders are placed, stock runs low, or system updates occur."}
                        </p>
                        {(searchQuery || activeTab !== 'all') && (
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('all');
                                    setSearchQuery('');
                                }}
                                className="mt-4 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer"
                            >
                                Clear all filters
                            </button>
                        )}
                    </div>
                ) : (
                    notifications.map((item) => {
                        const meta = getCategoryMetadata(item.type);
                        const IconComp = meta.icon;
                        const isProcessing = !!actionInProgress[item._id];

                        return (
                            <div
                                key={item._id}
                                className={`group bg-white rounded-xl border border-l-4 transition-all hover:shadow-xs p-4 sm:p-5 ${
                                    meta.accentBorder
                                } ${
                                    !item.isRead
                                        ? 'border-slate-300 bg-emerald-50/10'
                                        : 'border-slate-200/80'
                                }`}
                            >
                                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                    {/* Left: Type Icon & Main Content */}
                                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                                        {/* Category Icon */}
                                        <div className={`p-2.5 rounded-xl border shrink-0 ${meta.iconClass}`}>
                                            <IconComp className="w-5 h-5" />
                                        </div>

                                        {/* Body Content */}
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                {/* Badge */}
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider border ${meta.badgeClass}`}>
                                                    {meta.label}
                                                </span>

                                                {/* Unread indicator */}
                                                {!item.isRead && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                                        Unread
                                                    </span>
                                                )}

                                                {/* Timestamp */}
                                                <span
                                                    className="text-xs text-slate-400 ml-auto shrink-0"
                                                    title={formatFullDateTime(item.createdAt)}
                                                >
                                                    {formatRelativeTime(item.createdAt)}
                                                </span>
                                            </div>

                                            {/* Title */}
                                            <h3 className={`text-sm font-semibold tracking-tight ${
                                                !item.isRead ? 'text-slate-900' : 'text-slate-800'
                                            }`}>
                                                {item.title}
                                            </h3>

                                            {/* Message */}
                                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                                {item.message}
                                            </p>

                                            {/* Context Data Pills (Order ID, Stock Info, Amount, etc.) */}
                                            {item.data && Object.keys(item.data).length > 0 && (
                                                <div className="pt-1 flex flex-wrap items-center gap-2 text-xs">
                                                    {item.data.orderId && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[11px] border border-slate-200">
                                                            Order #{item.data.orderId.toString().slice(-6)}
                                                        </span>
                                                    )}
                                                    {item.data.amount !== undefined && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-medium text-[11px] border border-emerald-200">
                                                            Amount: ${Number(item.data.amount).toFixed(2)}
                                                        </span>
                                                    )}
                                                    {item.data.productName && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded font-medium text-[11px] border border-amber-200 truncate max-w-xs">
                                                            <Package className="w-3 h-3 shrink-0" />
                                                            {item.data.productName}
                                                        </span>
                                                    )}
                                                    {item.data.currentStock !== undefined && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 rounded font-medium text-[11px] border border-red-200">
                                                            Remaining: {item.data.currentStock}
                                                        </span>
                                                    )}
                                                    {item.data.customerName && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium text-[11px] border border-blue-200">
                                                            Customer: {item.data.customerName}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Actions */}
                                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleNavigate(item)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 transition-colors cursor-pointer"
                                        >
                                            <span>{meta.actionLabel}</span>
                                            <ExternalLink className="w-3.5 h-3.5" />
                                        </button>

                                        <div className="flex items-center gap-1">
                                            {!item.isRead && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleMarkAsRead(item._id)}
                                                    disabled={isProcessing}
                                                    title="Mark as Read"
                                                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                                    aria-label="Mark as read"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => handleDelete(item._id)}
                                                disabled={isProcessing}
                                                title="Delete Notification"
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                                aria-label="Delete notification"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
                    <p className="text-xs text-slate-500">
                        Showing Page <span className="font-semibold text-slate-800">{page}</span> of{' '}
                        <span className="font-semibold text-slate-800">{totalPages}</span> ({totalItems} total alerts)
                    </p>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Previous
                        </button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum = i + 1;
                                if (totalPages > 5 && page > 3) {
                                    pageNum = page - 2 + i;
                                    if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        type="button"
                                        onClick={() => setPage(pageNum)}
                                        className={`w-7 h-7 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                                            page === pageNum
                                                ? 'bg-emerald-600 text-white'
                                                : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        >
                            Next
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Notifications;
