import { Router } from 'express';
import { uploadMiddleware, uploadFile, getAttachmentById } from './attachment.controller.js';
import { authenticate } from '../../middleware/authenticate.js';

const router = Router();

router.use(authenticate);

router.post('/', uploadMiddleware, uploadFile);
router.get('/:id', getAttachmentById);

export default router;
