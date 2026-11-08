import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import TeamMember from "../models/TeamMember.js";
import MerchantSession from "../models/MerchantSession.js";

const authSeller = async (req, res, next) => {
    const { sellerToken } = req.cookies || {};

    if (!sellerToken) {
        return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const sellerEmail = process.env.SELLER_EMAIL;
    const jwtSecret = process.env.JWT_SECRET;

    if (!sellerEmail?.trim() || !jwtSecret?.trim()) {
        return res.status(500).json({ success: false, message: "Server authentication configuration missing" });
    }

    try {
        const tokenDecode = jwt.verify(sellerToken, jwtSecret);
        if (!tokenDecode) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        // 1. Root Merchant Owner: Full Admin with authoritative session version verification
        if (tokenDecode.email && tokenDecode.email.toLowerCase() === sellerEmail.toLowerCase()) {
            if (mongoose.connection && mongoose.connection.readyState === 1) {
                const authoritativeVersion = await MerchantSession.getAuthoritativeVersion();
                const tokenSessionVersion = typeof tokenDecode.sessionVersion === 'number'
                    ? tokenDecode.sessionVersion
                    : -1; // Unversioned root tokens are rejected when DB is authoritative

                if (tokenSessionVersion !== authoritativeVersion) {
                    return res.status(401).json({ success: false, message: "Root merchant session has been revoked" });
                }
            } else {
                // If database is unavailable: fail closed in production mode!
                const isOfflineTest = (process.env.NODE_ENV === 'test' || process.execArgv.some(arg => arg.startsWith('--test'))) &&
                    process.env.NODE_ENV !== 'production';

                if (!isOfflineTest) {
                    return res.status(503).json({ success: false, message: "Database service unavailable" });
                }
            }

            req.sellerId = sellerEmail;
            req.sellerEmail = sellerEmail;
            req.sellerRole = 'Admin';
            req.seller = {
                id: sellerEmail,
                email: sellerEmail,
                name: 'Merchant Admin',
                designation: 'Store Owner',
                role: 'Admin',
                status: 'Active'
            };
            return next();
        }

        // For non-root tokens, must have a valid team member ID or sellerId
        const memberId = tokenDecode.id || tokenDecode._id || tokenDecode.sellerId;
        if (!memberId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        // 2. Team Member: authoritative database verification when connected
        if (mongoose.connection && mongoose.connection.readyState === 1) {
            const member = await TeamMember.findById(memberId).lean();

            if (!member) {
                return res.status(401).json({ success: false, message: "Not Authorized" });
            }

            // Immediately enforce deactivation
            if (member.status === 'Inactive') {
                return res.status(403).json({ success: false, message: "Account is inactive" });
            }

            // F-05: Enforce tokenVersion revocation
            const currentTokenVersion = member.tokenVersion || 0;
            const payloadTokenVersion = typeof tokenDecode.tokenVersion === 'number' ? tokenDecode.tokenVersion : 0;
            if (payloadTokenVersion !== currentTokenVersion) {
                return res.status(401).json({ success: false, message: "Token has been revoked" });
            }

            req.sellerId = String(member._id);
            req.sellerEmail = member.email;
            req.sellerRole = member.role;
            req.isTeamMember = true;
            req.seller = {
                id: String(member._id),
                email: member.email,
                name: member.name,
                designation: member.designation,
                role: member.role,
                image: member.image || '',
                status: member.status
            };
            return next();
        }

        // 3. Fallback strictly for offline unit testing where database is not connected
        const isOfflineTest = (process.env.NODE_ENV === 'test' || process.execArgv.some(arg => arg.startsWith('--test'))) &&
            process.env.NODE_ENV !== 'production';

        if (!isOfflineTest) {
            return res.status(503).json({ success: false, message: "Database service unavailable" });
        }

        if (tokenDecode.status === 'Inactive') {
            return res.status(403).json({ success: false, message: "Account is inactive" });
        }

        const validRoles = ['Admin', 'CEO', 'CTO', 'Strategist'];
        const testRole = (tokenDecode.role && validRoles.includes(tokenDecode.role)) ? tokenDecode.role : null;

        req.sellerId = String(memberId);
        req.sellerEmail = tokenDecode.email || null;
        req.sellerRole = testRole || (tokenDecode.isTeamMember ? 'Strategist' : null);
        req.isTeamMember = Boolean(tokenDecode.isTeamMember);
        req.seller = {
            id: req.sellerId,
            email: req.sellerEmail,
            name: tokenDecode.name || 'Seller User',
            designation: tokenDecode.designation || 'Team Member',
            role: req.sellerRole,
            image: tokenDecode.image || '',
            status: tokenDecode.status || 'Active'
        };
        return next();

    } catch (error) {
        console.error("Seller auth error:", error.message);
        return res.status(401).json({ success: false, message: "Not Authorized" });
    }
};

export const optionalAuthSeller = async (req, res, next) => {
    const { sellerToken } = req.cookies || {};
    if (!sellerToken || (typeof sellerToken === 'string' && !sellerToken.trim())) {
        return res.status(200).json({ success: false, user: null });
    }
    return authSeller(req, res, next);
};

export default authSeller;
