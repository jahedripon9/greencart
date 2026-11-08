import mongoose from "mongoose";

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error("MONGODB_URI environment variable is not defined");
        }

        mongoose.connection.on('connected', () =>
            console.log("Database connected successfully")
        );
        await mongoose.connect(process.env.MONGODB_URI, { dbName: "greencart" });
    } catch (error) {
        console.error("Database connection error:", error.message);
        throw error;
    }
};

export default connectDB;