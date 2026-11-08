import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: function () {
            return !this.clerkId;
        },
    },
    clerkId: {
        type: String,
        sparse: true,
        unique: true,
        index: true,
    },
    authProvider: {
        type: [String],
        enum: ['email', 'google'],
        default: ['email'],
    },
    cartItems: {
        type: Object,
        default: {}
    },

}, { minimize: false });

const User = mongoose.models.user || mongoose.model("user", userSchema);

export default User;