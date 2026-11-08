import express from "express";
import authUser from "../middlewares/authUser.js";
import {
    getPublicPolicy,
    createReturnRequest,
    getMyReturns,
    getReturnById,
    cancelReturnRequest
} from "../controllers/returnController.js";

const returnRouter = express.Router();

// Public Return & Refund Policy
returnRouter.get("/policy", getPublicPolicy);

// Customer Return Endpoints
returnRouter.post("/request", authUser, createReturnRequest);
returnRouter.get("/my-returns", authUser, getMyReturns);
returnRouter.get("/:returnId", authUser, getReturnById);
returnRouter.post("/:returnId/cancel", authUser, cancelReturnRequest);

export default returnRouter;
