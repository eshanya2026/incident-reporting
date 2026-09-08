import { Router } from 'express';
import { createOrUpdateRca, getRcaByIncident, approveRca } from './rca.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.post('/incidents/:incidentId/rca', requirePermission(PERMISSIONS.RCA_CREATE), createOrUpdateRca);
router.get('/incidents/:incidentId/rca', requirePermission(PERMISSIONS.RCA_READ), getRcaByIncident);
router.post('/rca/:id/approve', requirePermission(PERMISSIONS.RCA_APPROVE), approveRca);

export default router;
