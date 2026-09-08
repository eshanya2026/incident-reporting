import { Router } from 'express';
import {
  startInvestigation,
  getInvestigationByIncident,
  updateInvestigation,
  completeInvestigation,
} from './investigation.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.post('/incidents/:incidentId/investigation', requirePermission(PERMISSIONS.INVESTIGATION_CREATE), startInvestigation);
router.get('/incidents/:incidentId/investigation', requirePermission(PERMISSIONS.INVESTIGATION_READ), getInvestigationByIncident);
router.patch('/investigations/:id', requirePermission(PERMISSIONS.INVESTIGATION_UPDATE), updateInvestigation);
router.post('/investigations/:id/complete', requirePermission(PERMISSIONS.INVESTIGATION_COMPLETE), completeInvestigation);

export default router;
