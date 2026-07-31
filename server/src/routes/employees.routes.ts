import { Router } from 'express';
import * as ctrl from '../controllers/employees.controller';
import { authenticate, requireManager, requireOwner } from '../middleware/auth';

export const employeesRoutes = Router();

employeesRoutes.use(authenticate);

employeesRoutes.get('/profiles', ctrl.getEmployeeProfiles); // any authenticated user (for lock screen)
employeesRoutes.get('/', requireManager, ctrl.getEmployees);
employeesRoutes.get('/:id', requireManager, ctrl.getEmployee);
employeesRoutes.post('/', requireOwner, ctrl.createEmployee);
employeesRoutes.put('/:id', requireManager, ctrl.updateEmployee);
employeesRoutes.patch('/:id/toggle', requireOwner, ctrl.toggleEmployee);
employeesRoutes.patch('/:id/pin', ctrl.changePin);
employeesRoutes.patch('/:id/role', requireOwner, ctrl.changeRole);
employeesRoutes.delete('/:id', requireOwner, ctrl.deleteEmployee);
