import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { prisma, basePrisma } from '../config/database';
import { PLANS } from '../config/plans';
import { AppError } from '../middleware/errorHandler';
import { auditService } from '../services/audit.service';

const employeeSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email().optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.nativeEnum(Role),
  pin: z.string().length(4).regex(/^\d{4}$/),
  password: z.string().min(6),
});

export async function getEmployeeProfiles(_req: Request, res: Response, next: NextFunction) {
  try {
    // Minimal info needed for the lock screen — no sensitive data, any authenticated user can access
    const employees = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, username: true, firstName: true, lastName: true, role: true },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
    res.json(employees);
  } catch (err) {
    next(err);
  }
}

export async function getEmployees(_req: Request, res: Response, next: NextFunction) {
  try {
    const employees = await prisma.user.findMany({
      select: { id: true, username: true, email: true, firstName: true, lastName: true, role: true, isActive: true, imageUrl: true, createdAt: true },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
    res.json(employees);
  } catch (err) {
    next(err);
  }
}

export async function getEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const employee = await prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true, email: true, firstName: true, lastName: true, role: true, isActive: true, imageUrl: true, createdAt: true },
    });
    if (!employee) throw new AppError(404, 'Employee not found');
    res.json(employee);
  } catch (err) {
    next(err);
  }
}

export async function createEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const data = employeeSchema.parse(req.body);

    // Enforce plan employee limit
    const org = await basePrisma.organization.findUnique({ where: { id: req.user!.organizationId } });
    if (org) {
      const limit = PLANS[org.planTier].maxEmployees;
      if (limit !== null) {
        const count = await prisma.user.count({ where: { isActive: true } });
        if (count >= limit) {
          throw new AppError(403, `Your ${PLANS[org.planTier].name} plan allows up to ${limit} employees — upgrade to add more`);
        }
      }
    }

    const existing = await prisma.user.findFirst({ where: { username: data.username } });
    if (existing) throw new AppError(409, 'Username already taken');

    const [hashedPin, hashedPass] = await Promise.all([bcrypt.hash(data.pin, 12), bcrypt.hash(data.password, 12)]);

    const employee = await prisma.user.create({
      data: { ...data, pin: hashedPin, password: hashedPass, organizationId: req.user!.organizationId },
      select: { id: true, username: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
    });

    await auditService.log(req.user!.userId, 'CREATE_EMPLOYEE', 'User', String(employee.id));
    res.status(201).json(employee);
  } catch (err) {
    next(err);
  }
}

export async function updateEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const schema = employeeSchema.omit({ pin: true, password: true }).partial();
    const data = schema.parse(req.body);

    const employee = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, username: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    });
    res.json(employee);
  } catch (err) {
    next(err);
  }
}

export async function toggleEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user!.userId) throw new AppError(400, 'Cannot disable your own account');

    const user = await prisma.user.findUnique({ where: { id }, select: { isActive: true } });
    if (!user) throw new AppError(404, 'Employee not found');

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: { id: true, isActive: true },
    });
    await auditService.log(req.user!.userId, updated.isActive ? 'ENABLE_EMPLOYEE' : 'DISABLE_EMPLOYEE', 'User', String(id));
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function changePin(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    // Only self or manager can change PIN
    if (id !== req.user!.userId && !['OWNER', 'MANAGER'].includes(req.user!.role)) {
      throw new AppError(403, 'Not authorized to change this PIN');
    }
    const { pin } = z.object({ pin: z.string().length(4).regex(/^\d{4}$/) }).parse(req.body);
    const hashedPin = await bcrypt.hash(pin, 12);
    await prisma.user.update({ where: { id }, data: { pin: hashedPin } });
    res.json({ message: 'PIN updated successfully' });
  } catch (err) {
    next(err);
  }
}

export async function changeRole(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    const { role } = z.object({ role: z.nativeEnum(Role) }).parse(req.body);
    const updated = await prisma.user.update({ where: { id }, data: { role }, select: { id: true, role: true } });
    await auditService.log(req.user!.userId, 'CHANGE_ROLE', 'User', String(id), { role });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

export async function deleteEmployee(req: Request, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id);
    if (id === req.user!.userId) throw new AppError(400, 'Cannot delete your own account');
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Employee deactivated' });
  } catch (err) {
    next(err);
  }
}
