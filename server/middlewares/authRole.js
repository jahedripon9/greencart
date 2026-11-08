/**
 * Role-Based Access Control (RBAC) Authorization Middleware
 *
 * Enforces least-privilege role permissions on protected Seller Dashboard routes.
 * Must be mounted AFTER authSeller middleware.
 */

export const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        const userRole = req.sellerRole || req.seller?.role;

        if (!userRole) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: `Access forbidden: Role '${userRole}' has insufficient role permissions to access this resource`
            });
        }

        next();
    };
};

export const requireAdmin = requireRole('Admin');

export const restrictRole = (...forbiddenRoles) => {
    return (req, res, next) => {
        const userRole = req.sellerRole || req.seller?.role;

        if (!userRole) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        if (forbiddenRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                message: `Access forbidden: Role '${userRole}' is restricted from performing this action`
            });
        }

        next();
    };
};
