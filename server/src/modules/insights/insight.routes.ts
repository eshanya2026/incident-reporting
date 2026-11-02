import { Router } from 'express';
import { chatWithInsights, getChatStatus, getInsights, regenerateInsights } from './insight.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

// Access (Admin / Quality / HOD) and scope are decided per role inside the controller
router.get('/', getInsights);
router.post('/regenerate', regenerateInsights);
router.get('/chat', getChatStatus);
router.post('/chat', chatWithInsights);

export default router;
