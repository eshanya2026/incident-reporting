import { Router } from 'express';
import { getLocations, createLocation, updateLocation } from './location.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requirePermission } from '../../middleware/authorize.js';
import { PERMISSIONS } from '../../common/enums/permissions.js';

const router = Router();

router.use(authenticate);

router.get('/', getLocations);
router.post('/', requirePermission(PERMISSIONS.ADMIN_LOCATION_MANAGE), createLocation);
router.patch('/:id', requirePermission(PERMISSIONS.ADMIN_LOCATION_MANAGE), updateLocation);

export default router;
