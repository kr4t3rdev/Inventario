/**
 * @description Server Actions para notificaciones.
 *
 * @module features/notificaciones/actions
 */
'use server';

import { withAction, ActionError } from '@/lib/server-actions';
import { prisma } from '@/lib/prisma';
import { verificarStockBajo } from '@/lib/verificar-stock';
import { createNotificacionSchema, updateNotificacionSchema } from './schemas';
import type { CreateNotificacionInput, UpdateNotificacionInput } from './schemas';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

export const getNotificacionesAction = withAction(async (_input: void, user: AuthenticatedUser) => {
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
  const notificacion = await prisma.notification.update({
    where: { id, userId: user.userId },
    data: { isRead: true },
  });
  return { success: true, notificacion };
});

export const createNotificacionAction = withAction(async (input: CreateNotificacionInput, user: AuthenticatedUser) => {
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
  const parsed = updateNotificacionSchema.parse(input);

  const notificacion = await prisma.notification.update({
    where: { id: parsed.id, userId: user.userId },
    data: {
      ...(parsed.isRead !== undefined && { isRead: parsed.isRead }),
      ...(parsed.title !== undefined && { title: parsed.title }),
      ...(parsed.message !== undefined && { message: parsed.message }),
    },
  });

  return notificacion;
});

export const deleteNotificacionAction = withAction(async (id: string, user: AuthenticatedUser) => {
  await prisma.notification.delete({ where: { id, userId: user.userId } });
  return { success: true };
});

export const verificarStockAction = withAction(async (_input: void, user: AuthenticatedUser) => {
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
