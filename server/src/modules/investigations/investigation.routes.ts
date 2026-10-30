import { Router } from 'express';
import {
  startInvestigation,
  getInvestigationByIncident,
  getInvestigationsByIncident,
  updateInvestigation,
  completeInvestigation,
} from './investigation.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.post('/incidents/:incidentId/investigation', requirePermission(PERMISSIONS.INVESTIGATION_WRITE), startInvestigation);
router.get('/incidents/:incidentId/investigation', requirePermission(PERMISSIONS.INVESTIGATION_READ), getInvestigationByIncident);
router.get('/incidents/:incidentId/investigations', requirePermission(PERMISSIONS.INVESTIGATION_READ), getInvestigationsByIncident);
router.patch('/investigations/:id', requirePermission(PERMISSIONS.INVESTIGATION_WRITE), updateInvestigation);
router.post('/investigations/:id/complete', requirePermission(PERMISSIONS.INVESTIGATION_WRITE), completeInvestigation);

export default router;
