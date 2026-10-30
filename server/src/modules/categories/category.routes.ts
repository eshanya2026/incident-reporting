import { Router } from 'express';
import { getCategories, createCategory, addSubcategory, setCategoryActive, setSubcategoryActive } from './category.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/', getCategories);
router.post('/', requirePermission(PERMISSIONS.ADMIN_CATEGORY_MANAGE), createCategory);
router.post('/:id/subcategories', requirePermission(PERMISSIONS.ADMIN_CATEGORY_MANAGE), addSubcategory);
// Categories and subcategories can only be created or disabled/re-enabled, never deleted —
// once in use on an incident, a category/subcategory must stay resolvable for that record.
router.patch('/:id/active', requirePermission(PERMISSIONS.ADMIN_CATEGORY_MANAGE), setCategoryActive);
router.patch('/:id/subcategories/:code/active', requirePermission(PERMISSIONS.ADMIN_CATEGORY_MANAGE), setSubcategoryActive);

export default router;
