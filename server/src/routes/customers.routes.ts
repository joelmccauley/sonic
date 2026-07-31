import { Router } from 'express';
import * as ctrl from '../controllers/customers.controller';
import { authenticate, requireFeature } from '../middleware/auth';

export const customersRoutes = Router();

customersRoutes.use(authenticate, requireFeature('customers'));

customersRoutes.get('/', ctrl.getCustomers);
customersRoutes.get('/search', ctrl.searchCustomers);
customersRoutes.get('/:id', ctrl.getCustomer);
customersRoutes.post('/', ctrl.createCustomer);
customersRoutes.put('/:id', ctrl.updateCustomer);
customersRoutes.get('/:id/orders', ctrl.getCustomerOrders);
customersRoutes.post('/:id/points', ctrl.addLoyaltyPoints);
