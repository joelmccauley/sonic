import { Router } from 'express';
import { authenticateCustomer } from '../middleware/auth';
import { getCustomerAccount, getStorefront, loginCustomer, loginCustomerWithPassword, placeOrder } from '../controllers/publicOrdering.controller';

export const publicOrderingRoutes = Router();

publicOrderingRoutes.get('/stores/:slug', getStorefront);
publicOrderingRoutes.post('/stores/:slug/orders', placeOrder);
publicOrderingRoutes.post('/stores/:slug/customer/login', loginCustomer);
publicOrderingRoutes.post('/stores/:slug/customer/password-login', loginCustomerWithPassword);
publicOrderingRoutes.get('/stores/:slug/customer/me', authenticateCustomer, getCustomerAccount);
