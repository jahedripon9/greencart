import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';
import connectDB from './configs/db.js';
import 'dotenv/config'
import userRouter from './routes/userRoute.js';
import sellerRouter from './routes/sellerRoute.js';
import connectCloudinary from './configs/cloudinary.js';
import productRouter from './routes/productRoute.js';
import cartRouter from './routes/cartRoute.js';
import addressRouter from './routes/addressRoute.js';

const app = express();
const PORT = process.env.PORT || 4000;

await connectDB();
await connectCloudinary();

//Allow multiple origin
const allowedOrigins = ["http://localhost:5173"]

// Middleware to parse JSON requests
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.get('/', (req, res) => res.send("API is Working"));
app.use('/api/user', userRouter);
app.use('/api/seller', sellerRouter);
app.use('/api/product', productRouter)
app.use('/apo/cart', cartRouter)
app.use('/apo/address', addressRouter)

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})
