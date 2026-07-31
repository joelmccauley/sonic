import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function platformLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const data = loginSchema.parse(req.body);

    const email = data.email.trim().toLowerCase();
    if (email !== env.PLATFORM_ADMIN_EMAIL.toLowerCase() || data.password !== env.PLATFORM_ADMIN_PASSWORD) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { scope: 'platform_admin', email: env.PLATFORM_ADMIN_EMAIL },
      env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ token, admin: { email: env.PLATFORM_ADMIN_EMAIL } });
  } catch (err) {
    next(err);
  }
}
