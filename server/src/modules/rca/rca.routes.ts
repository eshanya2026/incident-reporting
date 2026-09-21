import { Router } from 'express';
import { createOrUpdateRca, getRcaByIncident } from './rca.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.post('/incidents/:incidentId/rca', requirePermission(PERMISSIONS.RCA_WRITE), createOrUpdateRca);
router.get('/incidents/:incidentId/rca', requirePermission(PERMISSIONS.RCA_READ), getRcaByIncident);

export default router;
