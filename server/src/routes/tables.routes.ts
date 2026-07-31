import { Router } from 'express';
import * as ctrl from '../controllers/tables.controller';
import { authenticate } from '../middleware/auth';
import { requireManager } from '../middleware/auth';

export const tablesRoutes = Router();

tablesRoutes.use(authenticate);

tablesRoutes.get('/', ctrl.getAllTables);
tablesRoutes.get('/sections', ctrl.getSections);
tablesRoutes.get('/:id', ctrl.getTable);
tablesRoutes.post('/', requireManager, ctrl.createTable);
tablesRoutes.put('/:id', requireManager, ctrl.updateTable);
tablesRoutes.patch('/:id/status', ctrl.updateTableStatus);
tablesRoutes.delete('/:id', requireManager, ctrl.deleteTable);
