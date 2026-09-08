import { Router } from 'express';
import { getCategories, createCategory } from './category.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/', getCategories);
router.post('/', requirePermission(PERMISSIONS.ADMIN_CATEGORY_MANAGE), createCategory);

export default router;
