import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';
import {
  exportDeliveryMessages,
  getDeliveryMessages,
  getDeliverySummary,
  receiveWatiWebhook,
  resendMessage,
} from './whatsappDelivery.controller.js';

/** WATI's delivery webhook: no sign-in, the secret in the URL is checked instead. */
export const whatsappWebhookRouter = Router();
whatsappWebhookRouter.post('/webhook/:secret', receiveWatiWebhook);

/** WhatsApp delivery dashboard: Super Admin only. */
const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.ADMIN_ACCESS_CONTROL));
router.get('/summary', getDeliverySummary);
router.get('/messages', getDeliveryMessages);
router.get('/messages/export', exportDeliveryMessages);
router.post('/messages/:id/resend', resendMessage);

export default router;
