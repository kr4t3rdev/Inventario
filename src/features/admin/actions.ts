/**
 * @description Server Actions para administración platform-level.
 *
 * NO usa tenant scoping — es funcionalidad de super-admin.
 *
 * @module features/admin/actions
 */
'use server';

import { revalidatePath } from 'next/cache';
import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { sendEmailVerificationLink } from '@/lib/email';
import {
  createUserSchema, updateUserSchema, lockUnlockSchema, membershipActionSchema,
  createLicenciaSchema, updateLicenciaSchema, createPlanSchema, updatePlanSchema,
} from './schemas';
import type {
  CreateUserInput, UpdateUserInput, LockUnlockInput, MembershipActionInput,
  CreateLicenciaInput, UpdateLicenciaInput, CreatePlanInput, UpdatePlanInput,
} from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

// ─── User CRUD ─────────────────────────────────────────────

export const getUsersAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
  return prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
});

export const createUserAction = withAction(async (input: CreateUserInput, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
  const parsed = createUserSchema.parse(input);
  const hashedPassword = await bcrypt.hash(parsed.password, 12);

  const newUser = await prisma.user.create({
    data: {
      name: parsed.name,
      email: parsed.email,
      password: hashedPassword,
      role: parsed.role,
      isActive: true,
      expiresAt: parsed.daysToExpire
        ? new Date(Date.now() + parsed.daysToExpire * 24 * 60 * 60 * 1000)
        : null,
    },
  });

  try { await sendEmailVerificationLink(newUser as any); } catch {}

  revalidatePath('/admin');
  return newUser;
});

export const updateUserAction = withAction(async (input: UpdateUserInput, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
  const parsed = updateUserSchema.parse(input);
  const { userId, ...data } = parsed;

  const existing = await prisma.user.findUnique({ where: { userId } });
  if (!existing) throw new ActionError('Usuario no encontrado', 'NOT_FOUND');

  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.daysToExpire !== undefined) {
    updateData.expiresAt = data.daysToExpire
      ? new Date(Date.now() + data.daysToExpire * 24 * 60 * 60 * 1000)
      : null;
  }
  if (data.password) updateData.password = await bcrypt.hash(data.password, 12);

  const updated = await prisma.user.update({ where: { userId }, data: updateData });
  revalidatePath('/admin');
  return updated;
});

export const deleteUserAction = withAction(async (userId: string, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
  const existing = await prisma.user.findUnique({ where: { userId } });
  if (!existing) throw new ActionError('Usuario no encontrado', 'NOT_FOUND');
  await prisma.user.delete({ where: { userId } });
  revalidatePath('/admin');
  return { success: true, userId };
});

export const lockUserAction = withAction(async (input: LockUnlockInput, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
  const parsed = lockUnlockSchema.parse(input);
  const existing = await prisma.user.findUnique({ where: { userId: parsed.userId } });
  if (!existing) throw new ActionError('Usuario no encontrado', 'NOT_FOUND');
  const updated = await prisma.user.update({
    where: { userId: parsed.userId },
    data: { lockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
  revalidatePath('/admin');
  return { user: updated, message: 'Usuario bloqueado por 24 horas' };
});

export const unlockUserAction = withAction(async (input: LockUnlockInput, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
  const parsed = lockUnlockSchema.parse(input);
  const existing = await prisma.user.findUnique({ where: { userId: parsed.userId } });
  if (!existing) throw new ActionError('Usuario no encontrado', 'NOT_FOUND');
  const updated = await prisma.user.update({
    where: { userId: parsed.userId },
    data: { lockedUntil: null, loginAttempts: 0 },
  });
  revalidatePath('/admin');
  return { user: updated, message: 'Usuario desbloqueado correctamente' };
});

// ─── Admin Dashboard Data ──────────────────────────────────

export const getAdminTenantsAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
  return prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { users: true, productos: true, Almacen: true } } },
  });
});

export const getAdminSystemHealthAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
  const [users, tenants, sessions, licenses] = await Promise.all([
    prisma.user.count(),
    prisma.tenant.count(),
    prisma.userSession.count(),
    prisma.tenantLicense.count(),
  ]);
  return {
    users: { total: users },
    tenants: { total: tenants },
    sessions: { active: sessions },
    licenses: { total: licenses },
  };
});

// ─── Planes CRUD ──────────────────────────────────────────

export const getAdminPlanesAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
  return prisma.plan.findMany({ orderBy: { createdAt: 'desc' } });
});

export const createAdminPlanAction = withAction(async (input: CreatePlanInput, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
  const parsed = createPlanSchema.parse(input);
  const plan = await prisma.plan.create({
    data: {
      nombre: parsed.nombre,
      maxUsuarios: parsed.maxUsuarios,
      maxAlmacenes: parsed.maxAlmacenes,
      maxProductos: parsed.maxProductos,
    },
  });
  revalidatePath('/admin');
  return plan;
});

export const updateAdminPlanAction = withAction(async (input: UpdatePlanInput, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
  const parsed = updatePlanSchema.parse(input);
  const { planId, ...data } = parsed;
  const existing = await prisma.plan.findUnique({ where: { planId } });
  if (!existing) throw new ActionError('Plan no encontrado', 'NOT_FOUND');
  const plan = await prisma.plan.update({ where: { planId }, data });
  revalidatePath('/admin');
  return plan;
});

export const deleteAdminPlanAction = withAction(async (planId: string, user: AuthenticatedUser) => {
  if (user.role !== 'admin') throw new ActionError('Acceso restringido', 'FORBIDDEN');
  const existing = await prisma.plan.findUnique({ where: { planId } });
  if (!existing) throw new ActionError('Plan no encontrado', 'NOT_FOUND');
  await prisma.plan.delete({ where: { planId } });
  revalidatePath('/admin');
  return { success: true, planId };
});
