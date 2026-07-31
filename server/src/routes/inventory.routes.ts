import { Router } from 'express';
import * as ctrl from '../controllers/inventory.controller';
import { authenticate, requireManager, requireFeature } from '../middleware/auth';

export const inventoryRoutes = Router();

inventoryRoutes.use(authenticate, requireFeature('inventory'));

inventoryRoutes.get('/', ctrl.getInventory);
inventoryRoutes.get('/low-stock', ctrl.getLowStock);
inventoryRoutes.post('/custom', requireManager, ctrl.createCustomInventory);
inventoryRoutes.put('/item/:id', requireManager, ctrl.updateInventoryItem);
inventoryRoutes.post('/item/:id/adjust', requireManager, ctrl.adjustInventoryItem);
inventoryRoutes.delete('/item/:id', requireManager, ctrl.deleteCustomInventory);
inventoryRoutes.put('/:menuItemId', ctrl.updateInventory);
inventoryRoutes.post('/adjust', requireManager, ctrl.adjustInventory);
