import { Router } from 'express';
import { getRcaMeetingByIncident, getRcaMeetingAttendeesPreview, uploadRcaReport } from './rcaMeeting.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/incidents/:incidentId/rca-meeting/attendees', requirePermission(PERMISSIONS.RCA_READ), getRcaMeetingAttendeesPreview);
router.get('/incidents/:incidentId/rca-meeting', requirePermission(PERMISSIONS.RCA_READ), getRcaMeetingByIncident);
router.post('/incidents/:incidentId/rca-meeting/report', requirePermission(PERMISSIONS.RCA_WRITE), uploadRcaReport);

export default router;
