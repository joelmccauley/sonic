import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { requireOrganizationId } from '../config/tenantContext';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ── Logo upload ───────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (req, _file, cb) => cb(null, `logo-org${req.user?.organizationId ?? 0}` + path.extname(_file.originalname)),
});

export const logoUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpeg|jpg|gif|webp|svg\+xml)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

export async function uploadLogo(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new Error('No file uploaded');
    const organizationId = requireOrganizationId();
    const url = `/uploads/${req.file.filename}`;
    await prisma.setting.upsert({
      where: { organizationId_key: { organizationId, key: 'logo_url' } },
      update: { value: url },
      create: { organizationId, key: 'logo_url', value: url },
    });
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

export async function getSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    const result = Object.fromEntries(settings.map((s) => [s.key, s.value]));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getPublicSettings(_req: Request, res: Response, next: NextFunction) {
  try {
    const PUBLIC_KEYS = ['restaurant_name', 'address', 'phone', 'currency', 'timezone', 'receipt_footer', 'logo_url'];
    const settings = await prisma.setting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
    res.json(Object.fromEntries(settings.map((s) => [s.key, s.value])));
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction) {
  try {
    const data = z.record(z.string()).parse(req.body);
    const organizationId = requireOrganizationId();
    await Promise.all(
      Object.entries(data).map(([key, value]) =>
        prisma.setting.upsert({
          where: { organizationId_key: { organizationId, key } },
          update: { value },
          create: { organizationId, key, value },
        })
      )
    );
    const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    res.json(Object.fromEntries(settings.map((s) => [s.key, s.value])));
  } catch (err) {
    next(err);
  }
}
