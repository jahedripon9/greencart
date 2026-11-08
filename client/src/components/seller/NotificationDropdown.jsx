import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    ExternalLink,
    RefreshCw,
    X
} from './SellerIcons';

export const formatTimeAgo = (dateStr) => {
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const getNotificationConfig = (type) => {
    switch (type) {
        case 'new_order':
            return {
                label: 'Order',
                icon: ShoppingBag,
                iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
                badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                targetPath: '/seller/orders'
            };
        case 'low_stock':
            return {
                label: 'Low Stock',
                icon: AlertTriangle,
                iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
                badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
                targetPath: '/seller/product-list'
            };
        case 'new_customer':
            return {
                label: 'Customer',
                icon: Users,
                iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
                badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
                targetPath: '/seller/contacts'
            };
        case 'pending_reminder':
            return {
                label: 'Reminder',
                icon: Clock,
                iconBg: 'bg-orange-50 text-orange-600 border-orange-200',
                badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
                targetPath: '/seller/orders'
            };
        case 'system':
        default:
            return {
                label: 'System',
                icon: Shield,
                iconBg: 'bg-purple-50 text-purple-600 border-purple-200',
                badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
                targetPath: '/seller'
            };
    }
};

const NotificationDropdown = () => {
    const { axios, isSeller } = useAppContext();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState('all'); // 'all' or 'unread'
    const dropdownRef = useRef(null);

    // Fetch unread count for badge
    const fetchUnreadCount = useCallback(async () => {
        if (!isSeller) return;
        try {
            const { data } = await axios.get('/api/seller/notifications/unread-count');
            if (data.success) {
                setUnreadCount(data.unreadCount || 0);
            }
        } catch {
            // Silently ignore background poll errors
        }
    }, [axios, isSeller]);

    // Fetch recent notifications for dropdown
    const fetchDropdownNotifications = useCallback(async () => {
        if (!isSeller) return;
        setLoading(true);
        try {
            const { data } = await axios.get('/api/seller/notifications', {
                params: { page: 1, limit: 8, filter }
            });
            if (data.success) {
                setNotifications(data.notifications || []);
                setUnreadCount(data.unreadCount || 0);
            }
        } catch (error) {
            console.error('Failed to load notifications:', error);
        } finally {
            setLoading(false);
        }
    }, [axios, isSeller, filter]);

    // Polling unread count every 45s and on mount
    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 45000);
        return () => clearInterval(interval);
    }, [fetchUnreadCount]);

    // Fetch items when dropdown opens or filter toggles
    useEffect(() => {
        if (isOpen) {
            fetchDropdownNotifications();
        }
    }, [isOpen, fetchDropdownNotifications]);

    // Handle outside click to close dropdown
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Mark single notification as read
    const handleMarkAsRead = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            const { data } = await axios.patch(`/api/seller/notifications/${id}/read`);
            if (data.success) {
                setNotifications(prev =>
                    prev.map(item => item._id === id ? { ...item, isRead: true } : item)
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to update notification');
        }
    };

    // Mark all as read
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

    // Handle notification click: mark read and navigate
    const handleItemClick = async (notif) => {
        if (!notif.isRead) {
            await handleMarkAsRead(notif._id);
        }
        setIsOpen(false);
        const config = getNotificationConfig(notif.type);
        navigate(config.targetPath);
    };

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            {/* Bell Icon Button */}
            <button
                type="button"
                onClick={() => setIsOpen(prev => !prev)}
                className={`relative p-2 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer ${
                    isOpen
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                aria-label="Notifications"
                aria-expanded={isOpen}
            >
                <Bell className="w-5 h-5" />

                {/* Unread Badge */}
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown Popover */}
            {isOpen && (
                <div
                    className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                    role="dialog"
                    aria-label="Notification Center"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/70">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 text-sm">Notifications</span>
                            {unreadCount > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {unreadCount > 0 && (
                                <button
                                    type="button"
                                    onClick={handleMarkAllRead}
                                    className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
                                >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    Mark all read
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                                aria-label="Close"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-50/40 border-b border-slate-100 text-xs">
                        <button
                            type="button"
                            onClick={() => setFilter('all')}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                                filter === 'all'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            All
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilter('unread')}
                            className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                                filter === 'unread'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            Unread ({unreadCount})
                        </button>
                    </div>

                    {/* Notification List */}
                    <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
                        {loading ? (
                            <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                                <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                                <span className="text-xs">Loading notifications...</span>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="py-10 text-center px-4">
                                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                                    <Bell className="w-5 h-5" />
                                </div>
                                <p className="text-xs font-medium text-slate-700">No notifications found</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    {filter === 'unread' ? "You're all caught up!" : "No notifications to show yet."}
                                </p>
                            </div>
                        ) : (
                            notifications.map((item) => {
                                const config = getNotificationConfig(item.type);
                                const IconComponent = config.icon;
                                return (
                                    <div
                                        key={item._id}
                                        onClick={() => handleItemClick(item)}
                                        className={`group relative flex items-start gap-3 p-3 transition-colors cursor-pointer hover:bg-slate-50 ${
                                            !item.isRead ? 'bg-emerald-50/30' : ''
                                        }`}
                                    >
                                        {/* Type Icon */}
                                        <div className={`p-2 rounded-lg border shrink-0 ${config.iconBg}`}>
                                            <IconComponent className="w-4 h-4" />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0 pr-4">
                                            <div className="flex items-center justify-between gap-1 mb-0.5">
                                                <h4 className={`text-xs font-semibold truncate ${
                                                    !item.isRead ? 'text-slate-900' : 'text-slate-700'
                                                }`}>
                                                    {item.title}
                                                </h4>
                                                <span className="text-[10px] text-slate-400 shrink-0">
                                                    {formatTimeAgo(item.createdAt)}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                                                {item.message}
                                            </p>
                                        </div>

                                        {/* Read Status Dot / Mark as read action */}
                                        {!item.isRead && (
                                            <div className="absolute right-3 top-3 flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    title="Mark as read"
                                                    onClick={(e) => handleMarkAsRead(item._id, e)}
                                                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-emerald-100 text-emerald-700 transition-opacity"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                                <span className="w-2 h-2 rounded-full bg-emerald-600 group-hover:hidden" />
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                navigate('/seller/notifications');
                            }}
                            className="w-full py-1.5 px-3 text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <span>View All Notifications</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationDropdown;
