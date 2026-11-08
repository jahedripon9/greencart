import crypto from "crypto";
import OtpVerification from "../models/OtpVerification.js";
import User from "../models/User.js";
import { maskEmail, sendOtpNotification } from "../services/notificationService.js";

const COOLDOWN_SECONDS = 60;
const OTP_EXPIRY_MINUTES = 5;
const TOKEN_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 3;
export const MIN_OTP_SECRET_LENGTH = 32;

/**
 * Validates and retrieves the server-only OTP secret for OTP HMAC operations.
 * Requires OTP_SECRET to be configured with at least 32 characters.
 * Rejects missing or shorter values with a clear configuration error.
 * Does not fall back to JWT_SECRET and never exposes secret values.
 *
 * @returns {string} The validated OTP_SECRET
 * @throws {Error} Clear configuration error if missing or shorter than 32 characters
 */
export function getOtpSecret() {
    const secret = process.env.OTP_SECRET;
    if (!secret || typeof secret !== 'string' || !secret.trim()) {
        throw new Error("Server OTP secret misconfigured: OTP_SECRET is missing. A dedicated secret of at least 32 characters is required.");
    }
    const trimmedSecret = secret.trim();
    if (trimmedSecret.length < MIN_OTP_SECRET_LENGTH) {
        throw new Error(`Server OTP secret misconfigured: OTP_SECRET is too short. A minimum of ${MIN_OTP_SECRET_LENGTH} characters is required.`);
    }
    return trimmedSecret;
}

/**
 * Sends a 6-digit OTP to the authenticated user's email address.
 * POST /api/order/otp/send
 */
export async function sendCheckoutOtp(req, res) {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        const channel = req.body?.channel || 'email';
        if (channel === 'mobile') {
            return res.status(400).json({
                success: false,
                message: "Mobile OTP verification is coming soon. Please use Email OTP."
            });
        }

        if (channel !== 'email') {
            return res.status(400).json({
                success: false,
                message: "Invalid verification channel. Only email verification is currently supported."
            });
        }

        let otpSecret;
        try {
            otpSecret = getOtpSecret();
        } catch (configError) {
            return res.status(500).json({
                success: false,
                message: configError.message
            });
        }

        // Fetch user from DB to obtain verified account email (never trust client-supplied email)
        const user = await User.findById(userId);
        if (!user || !user.email) {
            return res.status(404).json({ success: false, message: "User account or email not found" });
        }

        const targetEmail = user.email.toLowerCase().trim();

        // Check 60-second resend cooldown for active requests
        const recentOtp = await OtpVerification.findOne({
            userId,
            channel: 'email'
        }).sort({ createdAt: -1 });

        if (recentOtp && !recentOtp.used) {
            const elapsedMs = Date.now() - new Date(recentOtp.createdAt).getTime();
            const cooldownMs = COOLDOWN_SECONDS * 1000;
            if (elapsedMs < cooldownMs) {
                const retryAfter = Math.ceil((cooldownMs - elapsedMs) / 1000);
                return res.status(429).json({
                    success: false,
                    message: `Please wait ${retryAfter} second(s) before requesting another verification code.`,
                    retryAfter
                });
            }
        }

        // Generate 6-digit CSPRNG OTP (100000 - 999999)
        const rawOtp = crypto.randomInt(100000, 1000000).toString();

        // Keyed HMAC-SHA256 bound to userId and dedicated OTP_SECRET
        const otpHash = crypto.createHmac('sha256', otpSecret)
            .update(`${userId}:${rawOtp}`)
            .digest('hex');

        // Invalidate previous unverified OTP records for this user & channel
        await OtpVerification.updateMany(
            { userId, channel: 'email', verified: false },
            { $set: { attemptsLeft: 0, expiresAt: new Date() } }
        );

        const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

        await OtpVerification.create({
            userId,
            channel: 'email',
            target: targetEmail,
            otpHash,
            attemptsLeft: MAX_ATTEMPTS,
            expiresAt,
            verified: false,
            used: false
        });

        // Dispatch email notification
        await sendOtpNotification({ toEmail: targetEmail, otpCode: rawOtp });

        return res.json({
            success: true,
            message: "Verification code sent to your email",
            maskedTarget: maskEmail(targetEmail),
            cooldownSeconds: COOLDOWN_SECONDS,
            expiresInSeconds: OTP_EXPIRY_MINUTES * 60
        });

    } catch (error) {
        console.error("sendCheckoutOtp error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to send verification code. Please try again." });
    }
}

/**
 * Verifies the 6-digit OTP and issues a single-use verificationToken.
 * POST /api/order/otp/verify
 */
export async function verifyCheckoutOtp(req, res) {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        const { otp } = req.body || {};
        if (!otp || typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid 6-digit numeric verification code"
            });
        }

        const cleanOtp = otp.trim();

        let otpSecret;
        try {
            otpSecret = getOtpSecret();
        } catch (configError) {
            return res.status(500).json({
                success: false,
                message: configError.message
            });
        }

        // Find the latest active unverified, unexpired OTP for this user
        const record = await OtpVerification.findOne({
            userId,
            channel: 'email',
            verified: false,
            expiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 });

        if (!record || record.attemptsLeft <= 0) {
            return res.status(400).json({
                success: false,
                message: "Verification code has expired or maximum attempts exceeded. Please request a new code."
            });
        }

        const candidateHash = crypto.createHmac('sha256', otpSecret)
            .update(`${userId}:${cleanOtp}`)
            .digest('hex');

        let isMatch = false;
        try {
            isMatch = crypto.timingSafeEqual(
                Buffer.from(candidateHash, 'hex'),
                Buffer.from(record.otpHash, 'hex')
            );
        } catch {
            isMatch = false;
        }

        if (!isMatch) {
            record.attemptsLeft -= 1;
            if (record.attemptsLeft <= 0) {
                record.expiresAt = new Date(); // Invalidate immediately
                await record.save();
                return res.status(400).json({
                    success: false,
                    message: "Incorrect verification code. Maximum attempts exceeded. Please request a new code.",
                    attemptsLeft: 0
                });
            }

            await record.save();
            return res.status(400).json({
                success: false,
                message: `Incorrect verification code. ${record.attemptsLeft} attempt(s) remaining.`,
                attemptsLeft: record.attemptsLeft
            });
        }

        // Verification successful — issue 32-byte cryptographic token
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const tokenExpiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

        record.verified = true;
        record.verifiedAt = new Date();
        record.verificationTokenHash = tokenHash;
        record.tokenExpiresAt = tokenExpiresAt;
        await record.save();

        return res.json({
            success: true,
            message: "Email verified successfully",
            verificationToken: rawToken
        });

    } catch (error) {
        console.error("verifyCheckoutOtp error:", error.message);
        return res.status(500).json({ success: false, message: "Verification failed. Please try again." });
    }
}
