import jwt from "jsonwebtoken";

const authUser = async (req, res, next) => {
    const { token } = req.cookies || {};
    if (!token) {
        return res.status(401).json({ success: false, message: "Not Authorized" });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        return res.status(500).json({ success: false, message: "Server authentication configuration missing" });
    }

    try {
        const tokenDecode = jwt.verify(token, jwtSecret);

        if (tokenDecode && tokenDecode.id) {
            req.userId = tokenDecode.id;   // ✅ use req.userId, not req.body
            return next();
        } else {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

    } catch (error) {
        console.error("User auth error:", error.message);
        return res.status(401).json({ success: false, message: "Not Authorized" });
    }
};

export const optionalAuthUser = async (req, res, next) => {
    const { token } = req.cookies || {};
    if (!token || (typeof token === 'string' && !token.trim())) {
        return res.status(200).json({ success: false, user: null });
    }
    return authUser(req, res, next);
};

export default authUser;
