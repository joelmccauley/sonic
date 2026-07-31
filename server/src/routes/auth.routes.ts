import { Router } from 'express';
import { login, loginPin, signup, googleAuth, refreshToken, getMe, logout, getStoreInfo } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';

export const authRoutes = Router();

authRoutes.post('/login', login);
authRoutes.post('/login-pin', loginPin);
authRoutes.post('/signup', signup);
authRoutes.post('/google', googleAuth);
authRoutes.get('/store/:slug', getStoreInfo);
authRoutes.post('/refresh', authenticate, refreshToken);
authRoutes.get('/me', authenticate, getMe);
authRoutes.post('/logout', authenticate, logout);
