import { Router } from 'express';
import { uploadMiddleware, uploadFile, getAttachmentById, downloadAttachment } from './attachment.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

router.post('/', uploadMiddleware, uploadFile);
router.get('/:id', getAttachmentById);
router.get('/:id/download', downloadAttachment);

export default router;
