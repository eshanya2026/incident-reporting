import { Router } from 'express';
import {
  getDashboardSummary,
  getSeverityDistribution,
  getCategoryDistribution,
  getDepartmentTrend,
  getCapaStatusSummary,
} from './dashboard.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

router.get('/summary', getDashboardSummary);
router.get('/severity', getSeverityDistribution);
router.get('/categories', getCategoryDistribution);
router.get('/department-trend', getDepartmentTrend);
router.get('/capa-status', getCapaStatusSummary);

export default router;
