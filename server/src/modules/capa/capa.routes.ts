import { Router } from 'express';
import {
  createCapa,
  getCapasByIncident,
  getAllCapas,
  updateCapa,
  markCapaDone,
} from './capa.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.post('/incidents/:incidentId/capas', requirePermission(PERMISSIONS.CAPA_WRITE), createCapa);
router.get('/incidents/:incidentId/capas', requirePermission(PERMISSIONS.CAPA_READ), getCapasByIncident);
router.get('/capas', requirePermission(PERMISSIONS.CAPA_READ), getAllCapas);
router.patch('/capas/:id', requirePermission(PERMISSIONS.CAPA_WRITE), updateCapa);
router.post('/capas/:id/done', requirePermission(PERMISSIONS.CAPA_WRITE), markCapaDone);

export default router;
