import express from 'express';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware to parse JSON requests
app.use(express.json());

app.get('/', (req, res) => res.send("API is Working"));

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})
