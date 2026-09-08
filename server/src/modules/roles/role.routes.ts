import { Router } from 'express';
import { getRoles, createRole } from './role.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/', getRoles);
router.post('/', requirePermission(PERMISSIONS.ADMIN_ROLE_MANAGE), createRole);

export default router;
