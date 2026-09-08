import { Router } from 'express';
import { getDepartments, createDepartment, updateDepartment } from './department.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/', getDepartments);
router.post('/', requirePermission(PERMISSIONS.ADMIN_DEPARTMENT_MANAGE), createDepartment);
router.patch('/:id', requirePermission(PERMISSIONS.ADMIN_DEPARTMENT_MANAGE), updateDepartment);

export default router;
