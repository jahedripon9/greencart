import mongoose from "mongoose";

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.warn("MONGODB_URI environment variable is not defined");
            return;
        }

        mongoose.connection.on('connected', () =>
            console.log("Database connected successfully")
        );
        await mongoose.connect(process.env.MONGODB_URI, { dbName: "greencart" });
    } catch (error) {
        console.error("Database connection error:", error.message);
    }
};

export default connectDB;
