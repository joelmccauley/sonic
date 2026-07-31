import { Router } from 'express';
import * as ctrl from '../controllers/shifts.controller';
import { authenticate, requireManager } from '../middleware/auth';

export const shiftsRoutes = Router();

shiftsRoutes.use(authenticate);

shiftsRoutes.post('/clock-in', ctrl.clockIn);
shiftsRoutes.patch('/clock-out', ctrl.clockOut);
shiftsRoutes.get('/active', ctrl.getActiveShift);
shiftsRoutes.get('/', requireManager, ctrl.getShifts);
shiftsRoutes.get('/:id', requireManager, ctrl.getShift);
shiftsRoutes.patch('/:id', requireManager, ctrl.updateShift);
