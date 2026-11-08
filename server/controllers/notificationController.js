import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { isModelRunnable, checkPendingOrderReminders } from "../services/notificationService.js";

/**
 * Resolves caller scope for Notification isolation.
 * Platform Admin & Executive Staff: store-wide access.
 * Tenant Sellers: strictly isolated to their req.sellerId.
 */
export const getCallerNotificationScope = (req) => {
    const rootAdminEmail = process.env.SELLER_EMAIL?.toLowerCase();
    const reqEmail = req?.sellerEmail?.toLowerCase();
    const callerRole = req?.sellerRole || req?.seller?.role;

    const isStore = Boolean(
        !req?.sellerId ||
        req?.isTeamMember ||
        (rootAdminEmail && reqEmail === rootAdminEmail) ||
        callerRole === 'Admin' ||
        callerRole === 'CEO' ||
        callerRole === 'CTO' ||
        callerRole === 'Strategist'
    );

    if (isStore) {
        // Platform wide: notifications with no sellerId (store-wide) OR all tenant notifications
        return { isStoreAdmin: true, query: {} };
    }

    // Tenant seller: strictly scoped to sellerId
    const sellerId = String(req.sellerId);
    return {
        isStoreAdmin: false,
        query: { sellerId }
    };
};

/**
 * GET /api/seller/notifications
 * Lists notifications with pagination, type/status filtering, and unread count.
 */
export const getNotifications = async (req, res) => {
    try {
        if (!req.sellerId && !req.sellerEmail) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        const { isStoreAdmin, query: scopeQuery } = getCallerNotificationScope(req);

        // Run non-blocking pending order scanner in the background
        if (isModelRunnable(Notification, 'find')) {
            checkPendingOrderReminders().catch(() => {});
        }

        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
        const skip = (page - 1) * limit;

        const filter = (req.query.filter || 'all').toLowerCase();
        const query = { ...scopeQuery };

        if (filter === 'unread') {
            query.isRead = false;
        } else if (filter === 'read') {
            query.isRead = true;
        } else if (filter === 'orders' || filter === 'order') {
            query.type = { $in: ['new_order', 'pending_reminder', 'order'] };
        } else if (filter === 'inventory' || filter === 'low_stock') {
            query.type = 'low_stock';
        } else if (filter === 'customers' || filter === 'new_customer') {
            query.type = 'new_customer';
        } else if (filter === 'pending_reminder' || filter === 'pending') {
            query.type = 'pending_reminder';
        } else if (filter === 'system') {
            query.type = 'system';
        }

        if (req.query.type && filter === 'all') {
            query.type = req.query.type;
        }

        if (req.query.search && typeof req.query.search === 'string') {
            const trimmed = req.query.search.trim();
            if (trimmed) {
                const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                query.$or = [
                    { title: { $regex: escaped, $options: 'i' } },
                    { message: { $regex: escaped, $options: 'i' } }
                ];
            }
        }

        if (!isModelRunnable(Notification, 'find')) {
            return res.json({
                success: true,
                notifications: [],
                pagination: { page, limit, total: 0, totalPages: 0 },
                unreadCount: 0,
                isStoreAdmin
            });
        }

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments(query),
            Notification.countDocuments({ ...scopeQuery, isRead: false })
        ]);

        const totalPages = Math.ceil(total / limit) || (total > 0 ? 1 : 0);

        return res.json({
            success: true,
            notifications,
            pagination: {
                page,
                limit,
                total,
                totalPages
            },
            unreadCount,
            isStoreAdmin
        });

    } catch (err) {
        console.error("getNotifications error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * GET /api/seller/notifications/unread-count
 * Returns the unread notification count for the caller.
 */
export const getUnreadCount = async (req, res) => {
    try {
        if (!req.sellerId && !req.sellerEmail) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        const { query: scopeQuery } = getCallerNotificationScope(req);

        if (!isModelRunnable(Notification, 'countDocuments')) {
            return res.json({ success: true, unreadCount: 0 });
        }

        const unreadCount = await Notification.countDocuments({ ...scopeQuery, isRead: false });
        return res.json({ success: true, unreadCount });
    } catch (err) {
        console.error("getUnreadCount error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * PATCH /api/seller/notifications/:id/read
 * Marks an individual notification as read.
 */
export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid notification ID" });
        }

        const { isStoreAdmin, query: scopeQuery } = getCallerNotificationScope(req);
        const callerIdentifier = req.sellerId || req.sellerEmail || 'admin';

        if (!isModelRunnable(Notification, 'findOneAndUpdate')) {
            return res.json({ success: true, message: "Marked as read" });
        }

        const notification = await Notification.findOneAndUpdate(
            { _id: id, ...scopeQuery },
            {
                $set: { isRead: true, readAt: new Date() },
                $addToSet: { readBy: String(callerIdentifier) }
            },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found or access denied" });
        }

        return res.json({
            success: true,
            message: "Notification marked as read",
            notification
        });
    } catch (err) {
        console.error("markAsRead error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * PATCH /api/seller/notifications/read-all
 * Marks all notifications matching the caller's authorized scope as read.
 */
export const markAllAsRead = async (req, res) => {
    try {
        const { query: scopeQuery } = getCallerNotificationScope(req);
        const callerIdentifier = req.sellerId || req.sellerEmail || 'admin';

        if (!isModelRunnable(Notification, 'updateMany')) {
            return res.json({ success: true, message: "All notifications marked as read", modifiedCount: 0 });
        }

        const result = await Notification.updateMany(
            { ...scopeQuery, isRead: false },
            {
                $set: { isRead: true, readAt: new Date() },
                $addToSet: { readBy: String(callerIdentifier) }
            }
        );

        return res.json({
            success: true,
            message: "All notifications marked as read",
            modifiedCount: result.modifiedCount || 0
        });
    } catch (err) {
        console.error("markAllAsRead error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * DELETE /api/seller/notifications/:id
 * Deletes an individual notification if within the caller's authorized scope.
 */
export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid notification ID" });
        }

        const { query: scopeQuery } = getCallerNotificationScope(req);

        if (!isModelRunnable(Notification, 'findOneAndDelete')) {
            return res.json({ success: true, message: "Notification deleted successfully" });
        }

        const deleted = await Notification.findOneAndDelete({ _id: id, ...scopeQuery });

        if (!deleted) {
            return res.status(404).json({ success: false, message: "Notification not found or access denied" });
        }

        return res.json({
            success: true,
            message: "Notification deleted successfully"
        });
    } catch (err) {
        console.error("deleteNotification error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * POST /api/seller/notifications/check-pending
 * Evaluates pending orders and generates pending reminders.
 */
export const triggerPendingCheck = async (req, res) => {
    try {
        const result = await checkPendingOrderReminders({ force: true });
        return res.json({
            success: true,
            message: "Pending order scan completed",
            result
        });
    } catch (err) {
        console.error("triggerPendingCheck error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
