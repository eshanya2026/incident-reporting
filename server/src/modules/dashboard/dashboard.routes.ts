import { Router } from 'express';
import { getDashboardOverview } from './dashboard.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);
router.use(requirePermission(PERMISSIONS.DASHBOARD_VIEW));

// Everything a role's dashboard shows, scoped by role; ?period=3m|6m|12m|all (default 12m)
router.get('/overview', getDashboardOverview);

export default router;
