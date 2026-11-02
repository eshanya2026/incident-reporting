import { Router } from 'express';
import { listTemplates, previewTemplate, saveTemplate, resetTemplate, sendTestTemplate } from './whatsappTemplate.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate, requirePermission(PERMISSIONS.ADMIN_WHATSAPP_TEMPLATES));

router.get('/', listTemplates);
router.post('/:key/preview', previewTemplate);
router.put('/:key', saveTemplate);
router.post('/:key/reset', resetTemplate);
router.post('/:key/test', sendTestTemplate);

export default router;
