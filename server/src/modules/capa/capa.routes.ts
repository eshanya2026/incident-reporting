import { Router } from 'express';
import {
  createCapa,
  getCapasByIncident,
  getAllCapas,
  completeCapa,
  verifyCapa,
} from './capa.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.post('/incidents/:incidentId/capas', requirePermission(PERMISSIONS.CAPA_CREATE), createCapa);
router.get('/incidents/:incidentId/capas', requirePermission(PERMISSIONS.CAPA_READ), getCapasByIncident);
router.get('/capas', requirePermission(PERMISSIONS.CAPA_READ), getAllCapas);
router.post('/capas/:id/complete', requirePermission(PERMISSIONS.CAPA_COMPLETE), completeCapa);
router.post('/capas/:id/verify', requirePermission(PERMISSIONS.CAPA_VERIFY), verifyCapa);

export default router;
