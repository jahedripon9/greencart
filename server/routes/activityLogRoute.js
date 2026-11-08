import express from 'express';
import authSeller from '../middlewares/authSeller.js';
import { requireAdmin } from '../middlewares/authRole.js';
import {
    getActivityLogs,
    getActivityLogById,
    rejectActivityLogMutation
} from '../controllers/activityLogController.js';

const activityLogRouter = express.Router();

// Read operations strictly restricted to Admin role
activityLogRouter.get('/', authSeller, requireAdmin, getActivityLogs);
activityLogRouter.get('/:id', authSeller, requireAdmin, getActivityLogById);

// Strict API Immutability: Block all mutation attempts (CREATE, UPDATE, DELETE)
activityLogRouter.post('/', authSeller, requireAdmin, rejectActivityLogMutation);
activityLogRouter.put('/', authSeller, requireAdmin, rejectActivityLogMutation);
activityLogRouter.patch('/', authSeller, requireAdmin, rejectActivityLogMutation);
activityLogRouter.delete('/', authSeller, requireAdmin, rejectActivityLogMutation);
activityLogRouter.post('/:id', authSeller, requireAdmin, rejectActivityLogMutation);
activityLogRouter.put('/:id', authSeller, requireAdmin, rejectActivityLogMutation);
activityLogRouter.patch('/:id', authSeller, requireAdmin, rejectActivityLogMutation);
activityLogRouter.delete('/:id', authSeller, requireAdmin, rejectActivityLogMutation);

export default activityLogRouter;
