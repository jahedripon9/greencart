import cookieParser from 'cookie-parser';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 4000;

//Allow multiple origins 
const allowedOrigins = ["http://localhost:5173"]

// Middleware to parse JSON requests
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.get('/', (req, res) => res.send("API is Working"));

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})
