import { Router } from 'express';
import * as ctrl from '../controllers/discounts.controller';
import { authenticate, requireManager, requireFeature } from '../middleware/auth';

export const discountsRoutes = Router();

discountsRoutes.use(authenticate, requireFeature('discounts'));

discountsRoutes.get('/', ctrl.getDiscounts);
discountsRoutes.post('/', requireManager, ctrl.createDiscount);
discountsRoutes.put('/:id', requireManager, ctrl.updateDiscount);
discountsRoutes.patch('/:id/toggle', requireManager, ctrl.toggleDiscount);
discountsRoutes.delete('/:id', requireManager, ctrl.deleteDiscount);
