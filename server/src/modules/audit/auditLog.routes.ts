import express, { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';
import { activityLimiter } from '../../middleware/rateLimiter.js';
import {
  exportAuditEvents,
  forceEndSession,
  getAuditAiChats,
  getAuditDepartments,
  getAuditEvents,
  getAuditPeople,
  getAuditSessions,
  getAuditSummary,
  postActivity,
  postActivityBeacon,
} from './auditLog.controller.js';

const router = Router();

// Sent by the app for every signed-in user: screens opened and presence heartbeats
router.post('/activity/beacon', activityLimiter, express.text({ type: '*/*', limit: '64kb' }), postActivityBeacon);
router.post('/activity', activityLimiter, authenticate, postActivity);

// The audit log itself: Super Admin only
const superAdmin = [authenticate, requirePermission(PERMISSIONS.ADMIN_ACCESS_CONTROL)];
router.get('/summary', ...superAdmin, getAuditSummary);
router.get('/events', ...superAdmin, getAuditEvents);
router.get('/events/export', ...superAdmin, exportAuditEvents);
router.get('/people', ...superAdmin, getAuditPeople);
router.get('/departments', ...superAdmin, getAuditDepartments);
router.get('/sessions', ...superAdmin, getAuditSessions);
router.post('/sessions/:id/end', ...superAdmin, forceEndSession);
router.get('/ai-chats', ...superAdmin, getAuditAiChats);

export default router;
