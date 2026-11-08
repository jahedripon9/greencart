import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema({
    actorId: {
        type: String,
        required: [true, "Actor ID is required"],
        index: true,
        trim: true
    },
    actorName: {
        type: String,
        required: [true, "Actor Name is required"],
        trim: true
    },
    actorEmail: {
        type: String,
        required: [true, "Actor Email is required"],
        lowercase: true,
        trim: true,
        index: true
    },
    actorRole: {
        type: String,
        required: [true, "Actor Role is required"],
        trim: true
    },
    action: {
        type: String,
        required: [true, "Action is required"],
        enum: ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE'],
        index: true
    },
    entityType: {
        type: String,
        required: [true, "Entity Type is required"],
        enum: ['PRODUCT', 'ORDER', 'CUSTOMER', 'TEAM_MEMBER'],
        index: true
    },
    entityId: {
        type: String,
        required: [true, "Entity ID is required"],
        index: true,
        trim: true
    },
    entityName: {
        type: String,
        required: [true, "Entity Name is required"],
        trim: true
    },
    description: {
        type: String,
        required: [true, "Description is required"],
        trim: true
    },
    changes: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    ipAddress: {
        type: String,
        default: "",
        trim: true
    },
    userAgent: {
        type: String,
        default: "",
        trim: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true,
        index: true
    }
}, {
    timestamps: { createdAt: true, updatedAt: false },
    minimize: false
});

// Performance and filtering indexes
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ entityType: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ actorEmail: 1, createdAt: -1 });

const ActivityLog = mongoose.models.ActivityLog || mongoose.model("ActivityLog", activityLogSchema);

export default ActivityLog;
