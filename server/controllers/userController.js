import User from "../models/User.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { verifyClerkSessionToken, ClerkConfigurationError } from "../services/clerkService.js";

// Register User: /api/user/register 
export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password || typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name.trim() || !email.trim()) {
            return res.json({ success: false, message: "Missing Details" });
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return res.status(500).json({ success: false, message: "Server authentication configuration missing" });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.json({ success: false, message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({ name: name.trim(), email: normalizedEmail, password: hashedPassword });

        const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '7d' });

        res.cookie("token", token, {
            httpOnly: true, // Prevents JavaScript access to the cookie
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Adjust sameSite policy based on environment
            maxAge: 7 * 24 * 60 * 60 * 1000 // Cookie expiration time (7 days)
        });

        return res.json({ success: true, user: { _id: user._id, email: user.email, name: user.name } })

    } catch (error) {
        if (error && error.code === 11000) {
            return res.json({ success: false, message: "User already exists" });
        }
        console.error(error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Login User: /api/user/login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password || typeof email !== 'string' || typeof password !== 'string' || !email.trim())
            return res.json({ success: false, message: "Email and Password are required" });

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return res.status(500).json({ success: false, message: "Server authentication configuration missing" });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const user = await User.findOne({ email: normalizedEmail });
        if (!user) {
            return res.json({ success: false, message: "Invalid email or Password" });
        }

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch)
            return res.json({ success: false, message: "Invalid Email or Password" });

        const token = jwt.sign({ id: user._id }, jwtSecret, { expiresIn: '7d' });

        res.cookie("token", token, {
            httpOnly: true, // Prevents JavaScript access to the cookie
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Adjust sameSite policy based on environment
            maxAge: 7 * 24 * 60 * 60 * 1000 // Cookie expiration time (7 days)
        });

        return res.json({ success: true, user: { _id: user._id, email: user.email, name: user.name } })


    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Check Auth : /api/user/is-auth
export const isAuth = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("-password");
        if (!user) {
            return res.status(200).json({ success: false, message: "User not found", user: null });
        }
        return res.json({ success: true, user });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
// export const isAuth = async (req, res) => {
//     try {
//         const { userId } = req.body;
//         const user = await User.findById(userId).select("-password")
//         return res.json({ success: true, user });
//     } catch (error) {
//         console.error(error.message);
//         res.json({ success: false, message: error.message });
//     }
// };

// Logout User: /api/user/logout
export const logout = async (req, res) => {
    try {
        res.clearCookie('token', {
            httpOnly: true, // Prevents JavaScript access to the cookie
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Adjust sameSite policy based on environment
        });
        return res.json({ success: true, message: "User logged out successfully" });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Handles Clerk Google OAuth token exchange, account resolution, and Option B password-challenge linking.
 * POST /api/user/clerk/google
 */
export const clerkGoogleAuth = async (req, res) => {
    try {
        const { clerkToken, linkPassword } = req.body;

        if (!clerkToken || typeof clerkToken !== 'string' || !clerkToken.trim()) {
            return res.status(400).json({ success: false, message: "Clerk authentication token is required" });
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return res.status(500).json({ success: false, message: "Server authentication configuration missing" });
        }

        // 1. Verify Clerk Token cryptographically & retrieve authoritative identity
        let claims;
        try {
            claims = await verifyClerkSessionToken(clerkToken);
        } catch (verifyErr) {
            if (verifyErr?.isConfigurationError || verifyErr instanceof ClerkConfigurationError || verifyErr?.name === 'ClerkConfigurationError') {
                return res.status(500).json({ success: false, message: "Server authentication configuration missing" });
            }
            return res.status(401).json({ success: false, message: "Invalid or expired Google authentication token" });
        }

        const { clerkId, email, emailVerified, name } = claims;

        // 2. Strict Email Verification Assertion
        if (!emailVerified) {
            return res.status(403).json({ success: false, message: "Google email address is not verified" });
        }

        const normalizedEmail = email.toLowerCase().trim();

        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        };

        // 3. Case 1: Returning Google Customer (User already has this clerkId)
        let userByClerk = await User.findOne({ clerkId });
        if (userByClerk) {
            const token = jwt.sign({ id: userByClerk._id }, jwtSecret, { expiresIn: '7d' });
            res.cookie("token", token, cookieOptions);
            return res.json({
                success: true,
                message: "Logged in successfully with Google",
                user: { _id: userByClerk._id, email: userByClerk.email, name: userByClerk.name }
            });
        }

        // 4. Case 2: User exists by Email (Option B Account Linking Challenge)
        const existingEmailUser = await User.findOne({ email: normalizedEmail });

        if (existingEmailUser) {
            // Case 2A: Account already linked to a different clerkId
            if (existingEmailUser.clerkId && existingEmailUser.clerkId !== clerkId) {
                return res.status(409).json({
                    success: false,
                    message: "An account with this email is already linked to another Google identity"
                });
            }

            // Case 2B: Account created with password, not linked to clerkId yet
            if (existingEmailUser.password) {
                // If password challenge not provided, prompt the client for link password
                if (!linkPassword || typeof linkPassword !== 'string') {
                    return res.status(200).json({
                        success: false,
                        requirePasswordLink: true,
                        email: existingEmailUser.email,
                        message: "An account with this email already exists. Please enter your existing password to link your Google account."
                    });
                }

                // Verify submitted password against existing password hash
                const isPasswordValid = await bcrypt.compare(linkPassword, existingEmailUser.password);
                if (!isPasswordValid) {
                    return res.status(401).json({
                        success: false,
                        requirePasswordLink: true,
                        message: "Incorrect password. Could not link Google account."
                    });
                }
            }

            // Password verified: Link clerkId to existing user document
            existingEmailUser.clerkId = clerkId;
            if (!Array.isArray(existingEmailUser.authProvider)) {
                existingEmailUser.authProvider = ['email'];
            }
            if (!existingEmailUser.authProvider.includes('google')) {
                existingEmailUser.authProvider.push('google');
            }
            await existingEmailUser.save();

            const token = jwt.sign({ id: existingEmailUser._id }, jwtSecret, { expiresIn: '7d' });
            res.cookie("token", token, cookieOptions);

            return res.json({
                success: true,
                message: "Account linked successfully with Google",
                user: { _id: existingEmailUser._id, email: existingEmailUser.email, name: existingEmailUser.name }
            });
        }

        // 5. Case 3: Brand New Customer Registration via Google
        const newUser = await User.create({
            name: name || 'Customer',
            email: normalizedEmail,
            clerkId,
            authProvider: ['google']
        });

        const token = jwt.sign({ id: newUser._id }, jwtSecret, { expiresIn: '7d' });
        res.cookie("token", token, cookieOptions);

        return res.json({
            success: true,
            message: "Account created successfully with Google",
            user: { _id: newUser._id, email: newUser.email, name: newUser.name }
        });

    } catch (error) {
        if (error && error.code === 11000) {
            return res.status(409).json({ success: false, message: "Account already exists" });
        }
        console.error("Clerk Google auth error:", error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
