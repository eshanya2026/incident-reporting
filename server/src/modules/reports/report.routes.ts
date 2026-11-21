import { Router } from 'express';
import { getIncidentRegisterReport, getCapaRegisterReport } from './report.controller.js';
import { downloadMonthlyReportPdf, getMonthlyReport, getTrends } from './qualityReport.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireAnyPermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/incidents', requireAnyPermission(PERMISSIONS.REPORT_VIEW_ALL, PERMISSIONS.REPORT_VIEW_DEPARTMENT), getIncidentRegisterReport);
router.get('/capa', requireAnyPermission(PERMISSIONS.REPORT_VIEW_ALL, PERMISSIONS.REPORT_VIEW_DEPARTMENT), getCapaRegisterReport);

// Monthly quality committee report and trends (HOD: own department only)
const canViewReports = requireAnyPermission(PERMISSIONS.REPORT_VIEW_ALL, PERMISSIONS.REPORT_VIEW_DEPARTMENT);
router.get('/monthly', canViewReports, getMonthlyReport);
router.get('/monthly/pdf', canViewReports, downloadMonthlyReportPdf);
router.get('/trends', canViewReports, getTrends);

export default router;
