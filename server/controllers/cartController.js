import mongoose from "mongoose";
import User from "../models/User.js";


// Upadate User CartData: /api/cart/update

export const updateCart = async (req, res) => {
    try {
        const userId = req.userId;
        const { cartItems } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        if (!cartItems || typeof cartItems !== 'object' || Array.isArray(cartItems)) {
            return res.status(400).json({ success: false, message: "Invalid cart data" });
        }

        const sanitizedCart = {};
        for (const [productId, quantity] of Object.entries(cartItems)) {
            if (typeof productId !== 'string' || !mongoose.Types.ObjectId.isValid(productId)) {
                return res.status(400).json({ success: false, message: "Invalid product ID in cart" });
            }

            if (
                typeof quantity !== 'number' ||
                !Number.isSafeInteger(quantity) ||
                quantity < 1 ||
                quantity > 99
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid item quantity. Must be an integer between 1 and 99."
                });
            }

            sanitizedCart[productId] = quantity;
        }

        await User.findByIdAndUpdate(userId, { cartItems: sanitizedCart });
        return res.json({ success: true, message: "Cart updated successfully", cartItems: sanitizedCart });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}
