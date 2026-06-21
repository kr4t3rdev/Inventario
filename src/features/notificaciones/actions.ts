/**
 * @description Server Actions para notificaciones.
 *
 * @module features/notificaciones/actions
 */
'use server';

import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { requireFeature } from '@/lib/services/tenant-scope';
import { verificarStockBajo } from '@/lib/verificar-stock';
import { createNotificacionSchema, updateNotificacionSchema } from './schemas';
import type { CreateNotificacionInput, UpdateNotificacionInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getNotificacionesAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  requireFeature(user, 'notificaciones', 'gestionar notificaciones');
  const notificaciones = await prisma.notification.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: 'desc' },
  });

  const resumen = {
    total: notificaciones.length,
    alta: notificaciones.filter((n) => n.prioridad === 'alta').length,
    media: notificaciones.filter((n) => n.prioridad === 'media').length,
    baja: notificaciones.filter((n) => n.prioridad === 'baja').length,
    noLeidas: notificaciones.filter((n) => !n.isRead).length,
  };

  return { notificaciones, resumen };
});

export const marcarNotificacionLeidaAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'notificaciones', 'gestionar notificaciones');
  const existente = await prisma.notification.findFirst({
    where: { id, userId: user.userId },
  });

  if (!existente) {
    throw new ActionError('Notificación no encontrada', 'NOT_FOUND');
  }

  const notificacion = await prisma.notification.update({
    where: { id: existente.id },
    data: { isRead: true },
  });
  return { success: true, notificacion };
});

export const createNotificacionAction = withAction(async (input: CreateNotificacionInput, user: AuthenticatedUser) => {
  requireFeature(user, 'notificaciones', 'gestionar notificaciones');
  const parsed = createNotificacionSchema.parse(input);

  if (user.role !== 'admin') {
    throw new ActionError('No autorizado', 'FORBIDDEN');
  }

  const notificacion = await prisma.notification.create({
    data: {
      title: parsed.title,
      message: parsed.message,
      type: parsed.type || 'info',
      prioridad: parsed.prioridad || 'media',
      userId: parsed.userId || user.userId,
    },
  });

  return notificacion;
});

export const updateNotificacionAction = withAction(async (input: UpdateNotificacionInput, user: AuthenticatedUser) => {
  requireFeature(user, 'notificaciones', 'gestionar notificaciones');
  const parsed = updateNotificacionSchema.parse(input);

  const existente = await prisma.notification.findFirst({
    where: { id: parsed.id, userId: user.userId },
  });

  if (!existente) {
    throw new ActionError('Notificación no encontrada', 'NOT_FOUND');
  }

  const notificacion = await prisma.notification.update({
    where: { id: existente.id },
    data: {
      ...(parsed.isRead !== undefined && { isRead: parsed.isRead }),
      ...(parsed.title !== undefined && { title: parsed.title }),
      ...(parsed.message !== undefined && { message: parsed.message }),
    },
  });

  return notificacion;
});

export const deleteNotificacionAction = withAction(async (id: string, user: AuthenticatedUser) => {
  requireFeature(user, 'notificaciones', 'gestionar notificaciones');

  const existente = await prisma.notification.findFirst({
    where: { id, userId: user.userId },
  });

  if (!existente) {
    throw new ActionError('Notificación no encontrada', 'NOT_FOUND');
  }

  await prisma.notification.delete({ where: { id: existente.id } });
  return { success: true };
});

export const verificarStockAction = withAction(async (_input: void, user: AuthenticatedUser) => {
  requireFeature(user, 'notificaciones', 'gestionar notificaciones');
  if (user.role !== 'admin') {
    throw new ActionError('No autorizado', 'FORBIDDEN');
  }

  const resultado = await verificarStockBajo();

  return {
    success: true,
    mensaje: `Verificación completada. ${resultado.productosStockBajo} productos con stock bajo, ${resultado.productosSinStock} productos sin stock, ${resultado.notificacionesCreadas} notificaciones creadas`,
    ...resultado,
  };
});
