import mongoose from "mongoose";

const teamMemberSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Full name is required"],
        trim: true,
        minlength: [2, "Name must be at least 2 characters"],
        maxlength: [100, "Name cannot exceed 100 characters"]
    },
    email: {
        type: String,
        required: [true, "Official email is required"],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email address"]
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [12, "Password must be at least 12 characters"]
    },
    image: {
        type: String,
        default: "",
        trim: true,
        maxlength: [2048, "Image string cannot exceed 2048 characters"],
        validate: {
            validator: function (val) {
                if (!val) return true;
                const trimmed = val.trim();
                if (trimmed.length > 2048) {
                    return false;
                }
                const lower = trimmed.toLowerCase();
                if (lower.startsWith('javascript:') || lower.startsWith('file:') || lower.startsWith('vbscript:')) {
                    return false;
                }
                // Explicitly reject SVG and GIF in any form or MIME encoding
                if (lower.includes('image/svg') || lower.includes('<svg') || lower.includes('image/gif')) {
                    return false;
                }
                const httpRegex = /^https?:\/\/.+/i;
                const dataUriRegex = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/i;
                return httpRegex.test(trimmed) || dataUriRegex.test(trimmed);
            },
            message: "Image must be a valid HTTP/HTTPS URL or safe image data URI (PNG, JPEG, WebP only, max 2048 characters)"
        }
    },
    designation: {
        type: String,
        required: [true, "Designation is required"],
        trim: true,
        maxlength: [100, "Designation cannot exceed 100 characters"]
    },
    role: {
        type: String,
        required: [true, "Role is required"],
        enum: {
            values: ['Admin', 'CEO', 'CTO', 'Strategist'],
            message: "Role must be one of: Admin, CEO, CTO, Strategist"
        },
        default: 'Strategist'
    },
    status: {
        type: String,
        required: [true, "Status is required"],
        enum: {
            values: ['Active', 'Inactive'],
            message: "Status must be either Active or Inactive"
        },
        default: 'Active'
    },
    tokenVersion: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    toJSON: {
        transform: function (doc, ret) {
            delete ret.password;
            return ret;
        }
    },
    toObject: {
        transform: function (doc, ret) {
            delete ret.password;
            return ret;
        }
    }
});

// Helper function to return sanitized team member object without password
teamMemberSchema.methods.toSafeObject = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

const TeamMember = mongoose.models.TeamMember || mongoose.model("TeamMember", teamMemberSchema);

export default TeamMember;
