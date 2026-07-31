import { Router } from 'express';
import { authenticatePlatform } from '../middleware/auth';
import { getPlatformOverview, updateOrganizationAdmin } from '../controllers/platformAdmin.controller';

export const platformRoutes = Router();

platformRoutes.use(authenticatePlatform);

platformRoutes.get('/overview', getPlatformOverview);
platformRoutes.patch('/organizations/:id', updateOrganizationAdmin);
