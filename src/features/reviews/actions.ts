'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/services/tenant-scope';
import { withAction, ActionError } from '@/lib/server-actions';
import { reviewSchema } from './schemas';

/* ─── submitReviewAction ─── */

/**
 * @description Crea una reseña del usuario para su tenant.
 * Valida rating 1-5, verifica unique constraint, calcula isPositive.
 * Si existe un ReviewPrompt activo, lo vincula.
 */
export const submitReviewAction = withAction(
  async (
    input: { rating: number; comment?: string },
    user: { userId: string; role: string },
  ) => {
    const parsed = reviewSchema.parse(input);
    const tenantId = requireTenant(user);

    const existing = await prisma.review.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.userId } },
    });
    if (existing) {
      throw new ActionError('Ya calificaste el sistema', 'DUPLICATE');
    }

    const review = await prisma.review.create({
      data: {
        tenantId,
        userId: user.userId,
        rating: parsed.rating,
        comment: parsed.comment,
        isPositive: parsed.rating >= 4,
      },
    });

    // Vincular prompt activo si existe
    await prisma.reviewPrompt.updateMany({
      where: {
        tenantId,
        userId: user.userId,
        submittedAt: null,
        dismissedAt: null,
      },
      data: { submittedAt: new Date() },
    });

    revalidatePath('/');
    return { review };
  },
);

/* ─── approveReviewAction ─── */

/**
 * @description Aprueba una reseña para hacerla pública.
 * Solo accesible para admin/manager del mismo tenant.
 */
export const approveReviewAction = withAction(
  async (reviewId: string, user: { userId: string; role: string }) => {
    const tenantId = requireTenant(user);

    const review = await prisma.review.findFirst({
      where: { reviewId, tenantId },
    });
    if (!review) throw new ActionError('Reseña no encontrada', 'NOT_FOUND');
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new ActionError('No autorizado', 'FORBIDDEN');
    }

    const updated = await prisma.review.update({
      where: { reviewId },
      data: { isApproved: true },
    });

    revalidatePath('/busy/reviews');
    revalidatePath('/');
    return { review: updated };
  },
);

/* ─── rejectReviewAction ─── */

/**
 * @description Rechaza (elimina) una reseña no aprobada.
 * Solo accesible para admin/manager del mismo tenant.
 */
export const rejectReviewAction = withAction(
  async (reviewId: string, user: { userId: string; role: string }) => {
    const tenantId = requireTenant(user);

    const review = await prisma.review.findFirst({
      where: { reviewId, tenantId },
    });
    if (!review) throw new ActionError('Reseña no encontrada', 'NOT_FOUND');
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new ActionError('No autorizado', 'FORBIDDEN');
    }

    await prisma.review.delete({ where: { reviewId } });

    revalidatePath('/busy/reviews');
    revalidatePath('/');
    return { success: true };
  },
);

/* ─── getReviewStatsAction ─── */

/**
 * @description Retorna estadísticas agregadas de reseñas aprobadas
 * para el tenant del usuario autenticado.
 */
export const getReviewStatsAction = withAction(async (_: unknown, user: { userId: string }) => {
  const tenantId = requireTenant(user);

  const [totalApproved, positiveApproved, ratingAgg] = await Promise.all([
    prisma.review.count({ where: { tenantId, isApproved: true } }),
    prisma.review.count({
      where: { tenantId, isApproved: true, isPositive: true },
    }),
    prisma.review.aggregate({
      where: { tenantId, isApproved: true },
      _avg: { rating: true },
    }),
  ]);

  return {
    averageRating: ratingAgg._avg.rating ?? 0,
    totalApproved,
    totalPositive: positiveApproved,
  };
});

/* ─── getActiveTenantsCountAction ─── */

/**
 * @description Retorna la cantidad real de empresas activas (con licencia activa).
 */
export async function getActiveTenantsCountAction(): Promise<number> {
  try {
    return await prisma.tenant.count({
      where: {
        licencias: { some: { activa: true } },
      },
    });
  } catch {
    return 0;
  }
}

/* ─── getReviewStatsPublicAction ─── */

/**
 * @description Retorna estadísticas agregadas de reseñas para la landing pública.
 * Usa NEXT_PUBLIC_DEFAULT_TENANT_ID como tenant de referencia.
 */
export async function getReviewStatsPublicAction() {
  const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID;
  if (!tenantId) return { averageRating: 0, totalApproved: 0, totalPositive: 0 };

  const [totalApproved, positiveApproved, ratingAgg] = await Promise.all([
    prisma.review.count({ where: { tenantId, isApproved: true } }),
    prisma.review.count({
      where: { tenantId, isApproved: true, isPositive: true },
    }),
    prisma.review.aggregate({
      where: { tenantId, isApproved: true },
      _avg: { rating: true },
    }),
  ]);

  return {
    averageRating: ratingAgg._avg.rating ?? 0,
    totalApproved,
    totalPositive: positiveApproved,
  };
}

/* ─── getApprovedReviewsAction ─── */

export type ReviewWithUser = Prisma.ReviewGetPayload<{
  include: { user: { select: { name: true; email: true; avatar: true } } };
}>;

/**
 * @description Lista reseñas aprobadas para el tenant autenticado.
 */
export const getApprovedReviewsAction = withAction(
  async (
    input: { limit?: number; orderBy?: 'rating_desc' | 'newest' } = {},
    user: { userId: string },
  ) => {
    const tenantId = requireTenant(user);
    const { limit = 3, orderBy = 'rating_desc' } = input ?? {};

    const order: Prisma.ReviewOrderByWithRelationInput =
      orderBy === 'newest' ? { createdAt: 'desc' } : { rating: 'desc' };

    const reviews = await prisma.review.findMany({
      where: { tenantId, isApproved: true },
      orderBy: [order, { createdAt: 'desc' }],
      take: limit,
      include: {
        user: { select: { name: true, avatar: true } },
      },
    });

    return { reviews };
  },
);

/* ─── getApprovedReviewsPublicAction ─── */

/**
 * @description Lista reseñas aprobadas para la landing pública.
 * Usa NEXT_PUBLIC_DEFAULT_TENANT_ID como tenant de referencia.
 */
export async function getApprovedReviewsPublicAction(input?: { limit?: number }) {
  const tenantId = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID;
  if (!tenantId) return { reviews: [] };

  const { limit = 3 } = input ?? {};

  const reviews = await prisma.review.findMany({
    where: { tenantId, isApproved: true },
    orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: {
      user: { select: { name: true, avatar: true } },
    },
  });

  return { reviews };
}

/* ─── canPromptReviewAction ─── */

/**
 * @description Verifica si se debe mostrar el dialog de reseña al usuario.
 * Retorna true solo si: no tiene reseña, no tuvo prompt hoy, y sesión activa < 24h.
 */
export const canPromptReviewAction = withAction(
  async (_: unknown, user: { userId: string }) => {
    const tenantId = requireTenant(user);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [existingReview, todayPrompt, lastSession] = await Promise.all([
      prisma.review.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.userId } },
      }),
      prisma.reviewPrompt.findFirst({
        where: {
          tenantId,
          userId: user.userId,
          promptedAt: { gte: todayStart },
        },
      }),
      prisma.userSession.findFirst({
        where: { userId: user.userId, isActive: true },
        orderBy: { lastActive: 'desc' },
        select: { lastActive: true },
      }),
    ]);

    if (existingReview) return { canPrompt: false };
    if (todayPrompt) return { canPrompt: false };

    const isActiveRecently =
      lastSession &&
      lastSession.lastActive > new Date(Date.now() - 24 * 60 * 60 * 1000);

    if (!isActiveRecently) return { canPrompt: false };

    return { canPrompt: true };
  },
);

/* ─── dismissReviewPromptAction ─── */

/**
 * @description Registra que el usuario cerró el dialog de reseña sin enviar.
 */
export const dismissReviewPromptAction = withAction(
  async (_: unknown, user: { userId: string }) => {
    const tenantId = requireTenant(user);

    await prisma.reviewPrompt.create({
      data: { tenantId, userId: user.userId, dismissedAt: new Date() },
    });

    return { success: true };
  },
);

/* ─── getPendingReviewsAction ─── */

/**
 * @description Lista reseñas pendientes de aprobación (admin/manager).
 */
export const getPendingReviewsAction = withAction(
  async (
    _: unknown,
    user: { userId: string; role: string },
  ) => {
    const tenantId = requireTenant(user);
    if (user.role !== 'admin' && user.role !== 'manager') {
      throw new ActionError('No autorizado', 'FORBIDDEN');
    }

    const reviews = await prisma.review.findMany({
      where: { tenantId, isApproved: false },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, email: true, avatar: true } },
      },
    });

    const stats = await prisma.review.aggregate({
      where: { tenantId },
      _count: true,
    });

    return { reviews, total: stats._count };
  },
);
