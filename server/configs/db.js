import mongoose from "mongoose";

let cachedPromise = null;

const connectDB = async () => {
    if (mongoose.connection.readyState === 1) {
        return;
    }

    let uri = process.env.MONGODB_URI;
    if (!uri) {
        console.warn("MONGODB_URI environment variable is not defined");
        return;
    }

    if (!uri.includes("greencart")) {
        if (uri.includes("?")) {
            uri = uri.replace("?", "/greencart?");
        } else {
            uri = uri.endsWith("/") ? `${uri}greencart` : `${uri}/greencart`;
        }
    }

    if (!cachedPromise) {
        const opts = {
            dbName: "greencart",
            serverSelectionTimeoutMS: 5000,
        };

        cachedPromise = mongoose.connect(uri, opts)
            .then(() => {
                console.log("Database connected successfully");
            })
            .catch((error) => {
                cachedPromise = null;
                console.error("Database connection error:", error.message);
            });
    }

    return cachedPromise;
};

export default connectDB;
