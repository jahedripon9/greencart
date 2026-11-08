import express from 'express';
import authSeller from '../middlewares/authSeller.js';
import { requireRole } from '../middlewares/authRole.js';
import {
    getTeamMembers,
    getTeamMemberById,
    addTeamMember,
    updateTeamMember,
    toggleTeamMemberStatus,
    deleteTeamMember
} from '../controllers/teamController.js';

const teamRouter = express.Router();

// All Team Management endpoints are strictly restricted to Admin role
teamRouter.get('/', authSeller, requireRole('Admin'), getTeamMembers);
teamRouter.post('/', authSeller, requireRole('Admin'), addTeamMember);
teamRouter.get('/:id', authSeller, requireRole('Admin'), getTeamMemberById);
teamRouter.put('/:id', authSeller, requireRole('Admin'), updateTeamMember);
teamRouter.patch('/:id/status', authSeller, requireRole('Admin'), toggleTeamMemberStatus);
teamRouter.delete('/:id', authSeller, requireRole('Admin'), deleteTeamMember);

export default teamRouter;
