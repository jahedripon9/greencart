import express from "express";
import authSeller from "../middlewares/authSeller.js";
import { requireRole } from "../middlewares/authRole.js";
import {
    getPublicStoreContent,
    getPublicFAQs,
    getAdminStoreContent,
    updateAdminSection,
    updatePaymentMethods,
    createFAQ,
    updateFAQ,
    deleteFAQ
} from "../controllers/storeContentController.js";

const storeContentRouter = express.Router();

// Public routes
storeContentRouter.get("/public", getPublicStoreContent);
storeContentRouter.get("/faqs", getPublicFAQs);

// Protected Admin routes
storeContentRouter.get("/admin", authSeller, requireRole("Admin"), getAdminStoreContent);
storeContentRouter.put("/admin/section/:section", authSeller, requireRole("Admin"), updateAdminSection);
storeContentRouter.put("/admin/payments", authSeller, requireRole("Admin"), updatePaymentMethods);
storeContentRouter.post("/admin/faqs", authSeller, requireRole("Admin"), createFAQ);
storeContentRouter.put("/admin/faqs/:id", authSeller, requireRole("Admin"), updateFAQ);
storeContentRouter.delete("/admin/faqs/:id", authSeller, requireRole("Admin"), deleteFAQ);

export default storeContentRouter;
