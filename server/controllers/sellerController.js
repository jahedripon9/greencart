import jwt from 'jsonwebtoken';
// Login Seller : /api/seller/login

export const sellerLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (password === process.env.SELLER_PASSWORD && email === process.env.SELLER_EMAIL) {
            const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '7d' });

            res.cookie("sellerToken", token, {
                httpOnly: true, // Prevents JavaScript access to the cookie
                secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict', // Adjust sameSite policy based on environment
                maxAge: 7 * 24 * 60 * 60 * 1000 // Cookie expiration time (7 days)
            })

            return res.json({ success: true, message: "Login Successful" });
        } else {
            return res.json({ success: false, message: "Invalid Email or Password" });
        }
    } catch (error) {
        console.log(error.message);
        res.json({ success: false, message: error.message });
    }

}

// Seller isAuth : /api/seller/is-auth
export const isSellerAuth = async (req, res) => {
    try {
        return res.json({ success: true });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: error.message });
    }
};

// Logout Seller: /api/seller/logout
export const SellerLogout = async (req, res) => {
    try {
        res.clearCookie('sellerToken', {
            httpOnly: true, // Prevents JavaScript access to the cookie
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict', // Adjust sameSite policy based on environment
        });
        return res.json({ success: true, message: "Seller logged out successfully" });
    } catch (error) {
        console.error(error.message);
        res.json({ success: false, message: error.message });
    }
};
