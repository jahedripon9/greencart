import express from 'express';
import authSeller from '../middlewares/authSeller.js';
import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    triggerPendingCheck
} from '../controllers/notificationController.js';

const notificationRouter = express.Router();

// Enforce authSeller on all notification routes
notificationRouter.use(authSeller);

notificationRouter.get('/', getNotifications);
notificationRouter.get('/unread-count', getUnreadCount);
notificationRouter.patch('/read-all', markAllAsRead);
notificationRouter.patch('/:id/read', markAsRead);
notificationRouter.delete('/:id', deleteNotification);
notificationRouter.post('/check-pending', triggerPendingCheck);

export default notificationRouter;
