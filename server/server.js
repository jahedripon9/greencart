import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { cleanupTempFiles } from './configs/multer.js';
import connectDB from './configs/db.js';
import 'dotenv/config'
import userRouter from './routes/userRoute.js';
import sellerRouter from './routes/sellerRoute.js';
import connectCloudinary from './configs/cloudinary.js';
import productRouter from './routes/productRoute.js';
import cartRouter from './routes/cartRoute.js';
import addressRouter from './routes/addressRoute.js';
import orderRouter from './routes/orderRoute.js';
import chatRouter from './routes/chatRoute.js';
import reviewRouter from './routes/reviewRoute.js';
import notificationRouter from './routes/notificationRoute.js';
import couponRouter from './routes/couponRoute.js';
import returnRouter from './routes/returnRoute.js';
import storeContentRouter from './routes/storeContentRoute.js';
import { startPendingOrderScheduler } from './services/notificationService.js';

const app = express();
const PORT = process.env.PORT || 4000;

await connectDB();
await connectCloudinary();

//Allow multiple origin
const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    process.env.CLIENT_URL
].filter(Boolean);

// Middleware to parse JSON requests
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.get('/', (req, res) => res.send("API is Working"));
app.use('/api/user', userRouter);
app.use('/api/seller', sellerRouter);
app.use('/api/product', productRouter)
app.use('/api/cart', cartRouter)
app.use('/api/address', addressRouter)
app.use('/api/order', orderRouter)
app.use('/api/chat', chatRouter);
app.use('/api/review', reviewRouter);
app.use('/api/notification', notificationRouter);
app.use('/api/coupon', couponRouter);
app.use('/api/returns', returnRouter);
app.use('/api/store-content', storeContentRouter);

// Global error handler
app.use(async (err, req, res, next) => {
    console.error(err);

    // Deterministic cleanup of partially written files on upload/middleware errors
    try {
        await cleanupTempFiles(req);
    } catch (cleanupErr) {
        console.error("Error during temp file cleanup in error handler:", cleanupErr.message);
    }

    if (res.headersSent) {
        return next(err);
    }

    let status = 500;
    let message = "Internal server error";

    if (err instanceof multer.MulterError || err?.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            status = 413;
            message = "File too large";
        } else if (err.code === 'LIMIT_FILE_COUNT') {
            status = 400;
            message = "Too many files uploaded";
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            status = 400;
            message = "Unexpected upload field";
        } else {
            status = 400;
            message = "File upload error";
        }
    } else if (err?.message === 'Only JPEG, PNG, and WebP images are allowed') {
        status = 400;
        message = "Only JPEG, PNG, and WebP images are allowed";
    } else {
        const rawStatus = Number(err?.status || err?.statusCode);
        if (Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599) {
            status = rawStatus;
        }
        message = status < 500 ? "Invalid request" : "Internal server error";
    }

    return res.status(status).json({ success: false, message });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    // Automatically schedule background scanner for pending orders in production
    startPendingOrderScheduler();
})
