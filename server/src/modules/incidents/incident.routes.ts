import { Router } from 'express';
import {
  createIncident,
  getIncidents,
  getIncidentById,
  triageIncident,
  assignInvestigator,
  closeIncident,
} from './incident.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.post('/', requirePermission(PERMISSIONS.INCIDENT_CREATE), createIncident);
router.get('/', getIncidents);
router.get('/:id', getIncidentById);
router.post('/:id/triage', requirePermission(PERMISSIONS.INCIDENT_TRIAGE), triageIncident);
router.post('/:id/assign-investigator', requirePermission(PERMISSIONS.INCIDENT_ASSIGN), assignInvestigator);
router.post('/:id/close', requirePermission(PERMISSIONS.INCIDENT_CLOSE), closeIncident);

export default router;
