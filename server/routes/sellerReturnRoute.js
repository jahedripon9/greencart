import express from "express";
import authSeller from "../middlewares/authSeller.js";
import { requireRole } from "../middlewares/authRole.js";
import {
    getAllReturnRequests,
    getReturnStats,
    getReturnById,
    updateReturnStatus,
    processRefund,
    getAdminPolicy,
    updateAdminPolicy
} from "../controllers/returnController.js";

const sellerReturnRouter = express.Router();

// Policy management (Admin only)
sellerReturnRouter.get("/policy", authSeller, requireRole("Admin"), getAdminPolicy);
sellerReturnRouter.put("/policy", authSeller, requireRole("Admin"), updateAdminPolicy);

// Summary statistics (Admin, CTO, CEO, Strategist)
sellerReturnRouter.get("/stats", authSeller, requireRole("Admin", "CTO", "CEO", "Strategist"), getReturnStats);

// List all returns (Admin, CTO, CEO, Strategist)
sellerReturnRouter.get("/", authSeller, requireRole("Admin", "CTO", "CEO", "Strategist"), getAllReturnRequests);

// Return request detail
sellerReturnRouter.get("/:returnId", authSeller, requireRole("Admin", "CTO", "CEO"), getReturnById);

// Update return status (Admin, CTO)
sellerReturnRouter.patch("/:returnId/status", authSeller, requireRole("Admin", "CTO"), updateReturnStatus);

// Process and complete refund (Admin only)
sellerReturnRouter.post("/:returnId/refund", authSeller, requireRole("Admin"), processRefund);

export default sellerReturnRouter;
