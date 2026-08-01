import { Router } from 'express';
import * as ctrl from '../controllers/settings.controller';
import { authenticate, requireManager, requireOwner } from '../middleware/auth';

export const settingsRoutes = Router();

settingsRoutes.get('/', authenticate, ctrl.getSettings);
settingsRoutes.put('/', authenticate, requireOwner, ctrl.updateSettings);
settingsRoutes.get('/public', authenticate, ctrl.getPublicSettings);
settingsRoutes.post('/logo', authenticate, requireOwner, ctrl.logoUpload.single('logo'), ctrl.uploadLogo);
settingsRoutes.get('/store-status', authenticate, requireOwner, ctrl.getStoreStatus);
settingsRoutes.patch('/store-status', authenticate, requireOwner, ctrl.updateStoreStatus);
