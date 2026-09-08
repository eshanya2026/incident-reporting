import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead } from './notification.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

router.get('/', getNotifications);
router.patch('/:id/read', markAsRead);
router.post('/mark-all-read', markAllAsRead);

export default router;
