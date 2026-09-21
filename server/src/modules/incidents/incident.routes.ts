import { Router } from 'express';
import {
  createIncident,
  getIncidents,
  getIncidentById,
  getIncidentTimeline,
  getTriageQueue,
  getReviewQueue,
  getMyDepartmentIncidents,
  requestInfo,
  respondToInfoRequest,
  rejectIncident,
  assignIncident,
  returnToQuality,
  submitForClosure,
  reviewIncident,
} from './incident.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

// Work queues (before /:id)
router.get('/triage-queue', requirePermission(PERMISSIONS.INCIDENT_TRIAGE), getTriageQueue);
router.get('/review-queue', requirePermission(PERMISSIONS.INCIDENT_REVIEW), getReviewQueue);
router.get('/my-department', requirePermission(PERMISSIONS.INCIDENT_READ_ASSIGNED), getMyDepartmentIncidents);

// Reporting and reading (lists and details are scoped to what the user may see)
router.post('/', requirePermission(PERMISSIONS.INCIDENT_CREATE), createIncident);
router.get('/', getIncidents);
router.get('/:id', getIncidentById);
router.get('/:id/timeline', getIncidentTimeline);

// Workflow actions. The workflow rules additionally check status, the specific person
// (reporter / responsible HOD) and each step's conditions.
router.post('/:id/request-info', requirePermission(PERMISSIONS.INCIDENT_TRIAGE), requestInfo);
router.post('/:id/respond', requirePermission(PERMISSIONS.INCIDENT_RESUBMIT), respondToInfoRequest);
router.post('/:id/reject', requirePermission(PERMISSIONS.INCIDENT_TRIAGE), rejectIncident);
router.post('/:id/assign', requirePermission(PERMISSIONS.INCIDENT_TRIAGE), assignIncident);
router.post('/:id/return-to-quality', requirePermission(PERMISSIONS.INCIDENT_RETURN_TO_QUALITY), returnToQuality);
router.post('/:id/submit-closure', requirePermission(PERMISSIONS.INCIDENT_SUBMIT_CLOSURE), submitForClosure);
router.post('/:id/review', requirePermission(PERMISSIONS.INCIDENT_REVIEW), reviewIncident);

export default router;
