import mongoose from "mongoose";

const rateLimitRecordSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true
    },
    totalHits: {
        type: Number,
        default: 0
    },
    resetTime: {
        type: Date,
        required: true
    }
}, { timestamps: true });

// TTL Index: automatically removes expired documents after resetTime
rateLimitRecordSchema.index({ resetTime: 1 }, { expireAfterSeconds: 0 });

const RateLimitRecord = mongoose.models.RateLimitRecord || mongoose.model("RateLimitRecord", rateLimitRecordSchema);
export default RateLimitRecord;
