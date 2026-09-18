import { NextRequest } from 'next/server';
import { withAuthGet } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import { prisma } from '@/lib/prisma';
import { requireFeature, requireTenant } from '@/lib/services/tenant-scope';
import type { AuthenticatedUser } from '@/lib/auth-middleware';

const TURNOS_INCLUDE = {
  puntoDeVenta: { select: { pvId: true, nombre: true, tipoCaja: true } },
  empleado: { select: { empleadoId: true, nombre: true, apellido: true } },
  arqueos: { orderBy: { createdAt: 'desc' }, take: 1 },
  ventas: { select: { total: true } },
  _count: { select: { ventas: true } },
} as const;

/**
 * @description Obtiene el turno activo de un punto de venta mediante una ruta estable.
 * @param {NextRequest} _request - Request HTTP autenticado.
 * @param {{ params: Promise<{ puntoDeVentaId: string }> }} context - Parámetros de la ruta.
 * @param {AuthenticatedUser} user - Usuario autenticado.
 * @returns {Promise<Response>} Payload canónico `{ turno }`.
 */
export const GET = withAuthGet(
  async (
    _request: NextRequest,
    context: { params: Promise<{ puntoDeVentaId: string }> },
    user: AuthenticatedUser,
  ) => {
    try {
      requireFeature(user, 'turnos-pos', 'gestionar turnos POS');
      const tenantId = requireTenant(user);
      const { puntoDeVentaId } = await context.params;

      const turno = await prisma.turnoPuntoVenta.findFirst({
        where: {
          puntoDeVentaId,
          tenantId,
          estado: 'ABIERTO',
        },
        include: TURNOS_INCLUDE,
      });

      return successResponse({ turno });
    } catch (error) {
      console.error('Error al obtener turno activo POS:', error);
      return errorResponse('Error al cargar el turno activo', 500, 'TURNO_READ_FAILED');
    }
  },
);
