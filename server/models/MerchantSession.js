import mongoose from "mongoose";

const merchantSessionSchema = new mongoose.Schema({
    identifier: {
        type: String,
        required: true,
        unique: true,
        default: "root_merchant"
    },
    sessionVersion: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Authoritatively get or initialize the root merchant session version
merchantSessionSchema.statics.getAuthoritativeVersion = async function () {
    let doc = await this.findOne({ identifier: "root_merchant" }).lean();
    if (!doc) {
        doc = await this.findOneAndUpdate(
            { identifier: "root_merchant" },
            { $setOnInsert: { sessionVersion: 0 } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).lean();
    }
    return doc?.sessionVersion ?? 0;
};

// Authoritatively increment the root merchant session version (revokes all prior root JWTs)
merchantSessionSchema.statics.revokeAllSessions = async function () {
    const doc = await this.findOneAndUpdate(
        { identifier: "root_merchant" },
        { $inc: { sessionVersion: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return doc.sessionVersion;
};

const MerchantSession = mongoose.models.MerchantSession || mongoose.model("MerchantSession", merchantSessionSchema);
export default MerchantSession;
