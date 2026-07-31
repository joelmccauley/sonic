import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const env = {
  PORT: parseInt(process.env.PORT ?? '3001', 10),
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  isDev: (process.env.NODE_ENV ?? 'development') === 'development',

  DATABASE_URL: required('DATABASE_URL'),

  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '8h',

  CLIENT_URL: process.env.CLIENT_URL ?? 'http://localhost:5173',

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',

  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ?? '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  STRIPE_PRICE_STARTER: process.env.STRIPE_PRICE_STARTER ?? '',
  STRIPE_PRICE_PROFESSIONAL: process.env.STRIPE_PRICE_PROFESSIONAL ?? '',
  STRIPE_PRICE_ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE ?? '',

  PLATFORM_ADMIN_EMAIL: process.env.PLATFORM_ADMIN_EMAIL ?? 'admin@sonicpos.com',
  PLATFORM_ADMIN_PASSWORD: process.env.PLATFORM_ADMIN_PASSWORD ?? 'sonicadmin123',

  PRINTER_IP: process.env.PRINTER_IP ?? '192.168.1.100',
  PRINTER_PORT: parseInt(process.env.PRINTER_PORT ?? '9100', 10),

  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
} as const;
