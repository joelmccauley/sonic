import { Router } from 'express';
import { platformLogin } from '../controllers/platformAuth.controller';

export const platformAuthRoutes = Router();

platformAuthRoutes.post('/login', platformLogin);
