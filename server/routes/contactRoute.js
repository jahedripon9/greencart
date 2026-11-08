import express from 'express';
import authSeller from '../middlewares/authSeller.js';
import { requireRole } from '../middlewares/authRole.js';
import {
    getContacts,
    getContactById,
    addContact,
    updateContact,
    deleteContact,
    initiateContactChat
} from '../controllers/contactController.js';

const contactRouter = express.Router();

// Read contacts & profiles: Allowed for Admin, CEO, CTO, Strategist
contactRouter.get('/', authSeller, requireRole('Admin', 'CEO', 'CTO', 'Strategist'), getContacts);
contactRouter.get('/:id', authSeller, requireRole('Admin', 'CEO', 'CTO', 'Strategist'), getContactById);

// Create, edit, and initiate chat: Allowed for Admin, CEO, CTO
contactRouter.post('/', authSeller, requireRole('Admin', 'CEO', 'CTO'), addContact);
contactRouter.put('/:id', authSeller, requireRole('Admin', 'CEO', 'CTO'), updateContact);
contactRouter.post('/:id/chat', authSeller, requireRole('Admin', 'CEO', 'CTO'), initiateContactChat);

// Delete contact: Admin and CEO privileged
contactRouter.delete('/:id', authSeller, requireRole('Admin', 'CEO'), deleteContact);

export default contactRouter;
