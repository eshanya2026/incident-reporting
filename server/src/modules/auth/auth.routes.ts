import { Router } from 'express';
import { login, refreshToken, logout, getMe, changePassword } from './auth.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authLimiter } from '../../middleware/rateLimiter.js';

const router = Router();

router.post('/login', authLimiter, login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.post('/change-password', authenticate, changePassword);

export default router;
