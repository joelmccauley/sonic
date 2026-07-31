import { Router } from 'express';
import * as ctrl from '../controllers/menu.controller';
import { authenticate } from '../middleware/auth';
import { requireManager } from '../middleware/auth';

export const menuRoutes = Router();

// Categories
menuRoutes.get('/categories', authenticate, ctrl.getCategories);
menuRoutes.post('/categories', authenticate, requireManager, ctrl.createCategory);
menuRoutes.put('/categories/:id', authenticate, requireManager, ctrl.updateCategory);
menuRoutes.delete('/categories/:id', authenticate, requireManager, ctrl.deleteCategory);

// Items
menuRoutes.get('/items', authenticate, ctrl.getMenuItems);
menuRoutes.get('/items/:id', authenticate, ctrl.getMenuItem);
menuRoutes.post('/items', authenticate, requireManager, ctrl.createMenuItem);
menuRoutes.put('/items/:id', authenticate, requireManager, ctrl.updateMenuItem);
menuRoutes.patch('/items/:id/toggle', authenticate, requireManager, ctrl.toggleMenuItem);
menuRoutes.patch('/items/:id/availability', authenticate, ctrl.setItemAvailability);
menuRoutes.delete('/items/:id', authenticate, requireManager, ctrl.deleteMenuItem);

// Modifier groups
menuRoutes.get('/modifier-groups', authenticate, ctrl.getModifierGroups);
menuRoutes.post('/modifier-groups', authenticate, requireManager, ctrl.createModifierGroup);
menuRoutes.put('/modifier-groups/:id', authenticate, requireManager, ctrl.updateModifierGroup);
menuRoutes.delete('/modifier-groups/:id', authenticate, requireManager, ctrl.deleteModifierGroup);

// Modifiers
menuRoutes.post('/modifier-groups/:groupId/modifiers', authenticate, requireManager, ctrl.createModifier);
menuRoutes.put('/modifiers/:id', authenticate, requireManager, ctrl.updateModifier);
menuRoutes.delete('/modifiers/:id', authenticate, requireManager, ctrl.deleteModifier);
