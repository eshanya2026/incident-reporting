import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser } from './user.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.ADMIN_USER_MANAGE), getUsers);
router.get('/:id', requirePermission(PERMISSIONS.ADMIN_USER_MANAGE), getUserById);
router.post('/', requirePermission(PERMISSIONS.ADMIN_USER_MANAGE), createUser);
router.patch('/:id', requirePermission(PERMISSIONS.ADMIN_USER_MANAGE), updateUser);

export default router;
