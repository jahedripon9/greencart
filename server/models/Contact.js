import mongoose from "mongoose";

const contactSchema = new mongoose.Schema({
    sellerId: {
        type: String,
        required: [true, "Seller identity is required"],
        index: true,
        trim: true
    },
    userId: {
        type: String,
        default: null,
        index: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, "Full name is required"],
        trim: true,
        minlength: [2, "Name must be at least 2 characters"],
        maxlength: [100, "Name cannot exceed 100 characters"]
    },
    email: {
        type: String,
        required: [true, "Email address is required"],
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email address"]
    },
    phone: {
        type: String,
        default: "",
        trim: true,
        maxlength: [30, "Phone number cannot exceed 30 characters"]
    },
    image: {
        type: String,
        default: "",
        trim: true,
        maxlength: [2048, "Image URL cannot exceed 2048 characters"]
    },
    notes: {
        type: String,
        default: "",
        trim: true,
        maxlength: [1000, "Notes cannot exceed 1000 characters"]
    },
    status: {
        type: String,
        enum: ['Active', 'Lead', 'Customer', 'Inactive'],
        default: 'Customer'
    },
    totalOrders: {
        type: Number,
        default: 1,
        min: 0
    },
    latestOrderDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Enforce unique email per seller account for strict seller isolation
contactSchema.index({ sellerId: 1, email: 1 }, { unique: true });
contactSchema.index({ sellerId: 1, userId: 1 });
contactSchema.index({ sellerId: 1, name: 1 });
contactSchema.index({ sellerId: 1, phone: 1 });
contactSchema.index({ sellerId: 1, latestOrderDate: -1 });

const Contact = mongoose.models.Contact || mongoose.model("Contact", contactSchema);

export default Contact;
