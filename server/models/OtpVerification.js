import mongoose from "mongoose";

const otpVerificationSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    channel: {
        type: String,
        enum: ['email'],
        default: 'email',
        required: true
    },
    target: {
        type: String,
        required: true
    },
    otpHash: {
        type: String,
        required: true
    },
    attemptsLeft: {
        type: Number,
        default: 3,
        min: 0
    },
    expiresAt: {
        type: Date,
        required: true
    },
    verified: {
        type: Boolean,
        default: false
    },
    verifiedAt: {
        type: Date
    },
    verificationTokenHash: {
        type: String,
        index: true
    },
    tokenExpiresAt: {
        type: Date
    },
    used: {
        type: Boolean,
        default: false
    },
    usedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// TTL index to automatically purge expired records
otpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound query index
otpVerificationSchema.index({ userId: 1, channel: 1, createdAt: -1 });

const OtpVerification = mongoose.models.otpVerification || mongoose.model("otpVerification", otpVerificationSchema);

export default OtpVerification;
