import mongoose from "mongoose";
import ActivityLog from "../models/ActivityLog.js";
import { queryActivityLogs, formatDhakaTime } from "../services/activityLogService.js";

/**
 * Get Activity Logs (Admin Only)
 * GET /api/seller/activity-logs
 */
export const getActivityLogs = async (req, res) => {
    try {
        const result = await queryActivityLogs(req.query);

        // Fetch distinct actors and stats for dashboard filter dropdowns
        let stats = {
            total: result.pagination.totalLogs,
            products: 0,
            orders: 0,
            customers: 0,
            teamMembers: 0
        };

        let actorsList = [];

        try {
            if (mongoose.connection && mongoose.connection.readyState === 1) {
                const [productCount, orderCount, customerCount, teamCount, distinctActors] = await Promise.all([
                    ActivityLog.countDocuments({ entityType: 'PRODUCT' }),
                    ActivityLog.countDocuments({ entityType: 'ORDER' }),
                    ActivityLog.countDocuments({ entityType: 'CUSTOMER' }),
                    ActivityLog.countDocuments({ entityType: 'TEAM_MEMBER' }),
                    ActivityLog.distinct('actorEmail')
                ]);

                stats.products = productCount;
                stats.orders = orderCount;
                stats.customers = customerCount;
                stats.teamMembers = teamCount;
                actorsList = distinctActors || [];
            }
        } catch (_) {
            // Stats fallback
        }

        return res.json({
            success: true,
            logs: result.logs,
            pagination: result.pagination,
            stats,
            actors: actorsList
        });

    } catch (error) {
        console.error("Get activity logs error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Get Single Activity Log (Admin Only)
 * GET /api/seller/activity-logs/:id
 */
export const getActivityLogById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: "Invalid activity log ID" });
        }

        const log = await ActivityLog.findById(id).lean();
        if (!log) {
            return res.status(404).json({ success: false, message: "Activity log not found" });
        }

        return res.json({
            success: true,
            log: {
                ...log,
                dhakaTime: formatDhakaTime(log.createdAt)
            }
        });

    } catch (error) {
        console.error("Get activity log by ID error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Enforces API immutability for Activity Logs.
 * Rejects all mutating actions (POST, PUT, PATCH, DELETE) with HTTP 405 Method Not Allowed.
 */
export const rejectActivityLogMutation = (req, res) => {
    return res.status(405).json({
        success: false,
        message: "Activity logs are immutable and cannot be created, modified, or deleted through the API"
    });
};
