import { Router } from 'express';
import { getIncidentRegisterReport, getCapaRegisterReport } from './report.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/incidents', requirePermission(PERMISSIONS.REPORT_VIEW_DEPARTMENT), getIncidentRegisterReport);
router.get('/capa', requirePermission(PERMISSIONS.REPORT_VIEW_DEPARTMENT), getCapaRegisterReport);

export default router;
