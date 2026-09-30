import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser, resetUserPassword, bulkImportUsers } from './user.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission, requireAnyPermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requireAnyPermission(
    PERMISSIONS.ADMIN_USER_MANAGE,
    PERMISSIONS.INCIDENT_TRIAGE,
    PERMISSIONS.CAPA_WRITE,
    PERMISSIONS.INCIDENT_READ_ALL
  ),
  getUsers
);
router.post('/bulk-import', requirePermission(PERMISSIONS.ADMIN_USER_MANAGE), bulkImportUsers);
router.get('/:id', requirePermission(PERMISSIONS.ADMIN_USER_MANAGE), getUserById);
router.post('/', requirePermission(PERMISSIONS.ADMIN_USER_MANAGE), createUser);
router.patch('/:id', requirePermission(PERMISSIONS.ADMIN_USER_MANAGE), updateUser);
router.post('/:id/reset-password', requirePermission(PERMISSIONS.ADMIN_USER_MANAGE), resetUserPassword);

export default router;
