import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { basePrisma, prisma } from '../config/database';
import { requireOrganizationId } from '../config/tenantContext';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from '../middleware/errorHandler';
import { ORDER_TYPE_SETTING_KEYS, hasAtLeastOneEnabledOrderType } from '../config/orderTypes';

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
    const PUBLIC_KEYS = [
      'restaurant_name',
      'address',
      'phone',
      'currency',
      'timezone',
      'receipt_footer',
      'logo_url',
      'storefront_background_color',
      'storefront_surface_color',
      'storefront_surface_alt_color',
      'storefront_primary_color',
      'storefront_accent_color',
      'storefront_border_color',
      'storefront_muted_text_color',
      'storefront_text_color',
      ...ORDER_TYPE_SETTING_KEYS,
    ];
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
    const existingOrderTypes = await prisma.setting.findMany({
      where: { organizationId, key: { in: [...ORDER_TYPE_SETTING_KEYS] } },
      select: { key: true, value: true },
    });
    const nextOrderTypeSettings: Record<string, string | undefined> = Object.fromEntries(
      existingOrderTypes.map((setting) => [setting.key, setting.value])
    );
    for (const key of ORDER_TYPE_SETTING_KEYS) {
      if (data[key] !== undefined) nextOrderTypeSettings[key] = data[key];
    }
    if (!hasAtLeastOneEnabledOrderType(nextOrderTypeSettings)) {
      throw new AppError(400, 'At least one order type must remain enabled');
    }
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

export async function getStoreStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = requireOrganizationId();
    const org = await basePrisma.organization.findUnique({ where: { id: organizationId }, select: { isActive: true } });
    if (!org) throw new Error('Organization not found');
    res.json({ isActive: org.isActive });
  } catch (err) {
    next(err);
  }
}

export async function updateStoreStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const organizationId = requireOrganizationId();
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const org = await basePrisma.organization.update({ where: { id: organizationId }, data: { isActive }, select: { isActive: true } });
    res.json({ isActive: org.isActive });
  } catch (err) {
    next(err);
  }
}
