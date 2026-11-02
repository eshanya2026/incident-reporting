import { Router } from 'express';
import { getRoles, createRole, getAccessMatrix, setRolePermissions, resetRolePermissions } from './role.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission, requireAnyPermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/', requireAnyPermission(PERMISSIONS.ADMIN_USER_MANAGE, PERMISSIONS.ADMIN_ROLE_MANAGE), getRoles);
router.post('/', requirePermission(PERMISSIONS.ADMIN_ACCESS_CONTROL), createRole);

// Access Control: Super Admin decides which roles see which screens
router.get('/access-control', requirePermission(PERMISSIONS.ADMIN_ACCESS_CONTROL), getAccessMatrix);
router.put('/:id/permissions', requirePermission(PERMISSIONS.ADMIN_ACCESS_CONTROL), setRolePermissions);
router.post('/:id/reset', requirePermission(PERMISSIONS.ADMIN_ACCESS_CONTROL), resetRolePermissions);

export default router;
