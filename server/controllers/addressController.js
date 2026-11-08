import Address from "../models/Address.js";


// Add Address : /api/address/add
export const addAddress = async (req, res) => {
    try {
        const userId = req.userId;
        const { address } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        if (!address || typeof address !== 'object' || Array.isArray(address)) {
            return res.status(400).json({ success: false, message: "Invalid address data" });
        }

        const {
            firstName,
            lastName,
            email,
            street,
            city,
            state,
            zipcode,
            country,
            phone
        } = address;

        await Address.create({
            userId,
            firstName,
            lastName,
            email,
            street,
            city,
            state,
            zipcode,
            country,
            phone
        });

        return res.json({ success: true, message: "Address added successfully" });
    } catch (error) {
        console.error(error.message);
        if (error.name === 'ValidationError' || error.name === 'CastError') {
            return res.status(400).json({ success: false, message: error.message });
        }
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

// Get Address by User ID : /api/address/get

export const getAddress = async (req, res) => {
    try {
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Not Authorized" });
        }

        const addresses = await Address.find({ userId });
        return res.json({ success: true, addresses });
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}
