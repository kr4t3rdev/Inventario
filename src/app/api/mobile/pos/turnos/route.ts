import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { requireFeature } from '@/lib/services/tenant-scope';
import { abrirTurnoSchema } from '@/features/turnos-pos/schemas';
import type { ActionError } from '@/lib/server-actions';

export const dynamic = 'force-dynamic';

const TURNOS_INCLUDE = {
  puntoDeVenta: { select: { pvId: true, nombre: true, tipoCaja: true } },
  empleado: { select: { empleadoId: true, nombre: true, apellido: true } },
  arqueos: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  ventas: { select: { total: true } },
  _count: { select: { ventas: true } },
} as const;

export { TURNOS_INCLUDE };

/**
 * @description Maps a TurnoPuntoVenta row (with relations) to the mobile turno contract.
 * @param {Record<string, any>} turno - Raw turno row.
 * @returns {Record<string, unknown>} Mobile-shaped turno payload.
 */
export function mapTurno(turno: any) {
  return {
    turnoId: turno.id,
    puntoDeVentaId: turno.puntoDeVentaId,
    puntoDeVentaNombre: turno.puntoDeVenta?.nombre,
    empleadoId: turno.empleadoId ?? null,
    tipo: turno.tipo,
    estado: turno.estado,
    fechaApertura: (turno.fechaApertura as Date).toISOString(),
    fechaCierre: turno.fechaCierre ? (turno.fechaCierre as Date).toISOString() : null,
    fondoInicialCup: turno.fondoInicialCup,
    fondoInicialUsd: turno.fondoInicialUsd,
    observaciones: turno.observaciones ?? null,
    ventasTotal: turno.ventas?.reduce((a: number, v: { total: number }) => a + v.total, 0) ?? 0,
    ventasCount: turno._count?.ventas ?? 0,
    empleado: turno.empleado
      ? { nombre: turno.empleado.nombre, apellido: turno.empleado.apellido }
      : undefined,
  };
}

/**
 * @description Mobile open-shift endpoint. Mirrors abrirTurnoAction.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Created turno payload.
 */
export async function POST(request: Request) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    requireFeature(authResult.user, 'turnos-pos', 'gestionar turnos POS');
    const parsed = abrirTurnoSchema.parse(await request.json());

    const pv = await prisma.puntoDeVenta.findFirst({
      where: { pvId: parsed.puntoDeVentaId, tenantId },
      select: { pvId: true, nombre: true },
    });
    if (!pv) {
      return errorResponse('Punto de venta no encontrado', 404, 'NOT_FOUND');
    }

    const turnoActivo = await prisma.turnoPuntoVenta.findFirst({
      where: { puntoDeVentaId: parsed.puntoDeVentaId, estado: 'ABIERTO' },
      select: { id: true },
    });
    if (turnoActivo) {
      return errorResponse('Ya existe un turno abierto en este punto de venta', 409, 'CONFLICT');
    }

    const turno = await prisma.turnoPuntoVenta.create({
      data: {
        tenantId,
        puntoDeVentaId: parsed.puntoDeVentaId,
        empleadoId: parsed.empleadoId ?? null,
        fondoInicialCup: parsed.fondoInicialCup ?? 0,
        fondoInicialUsd: parsed.fondoInicialUsd ?? 0,
        observaciones: parsed.observaciones ?? null,
        estado: 'ABIERTO',
        tipo: 'NORMAL',
      },
      include: TURNOS_INCLUDE,
    });

    return successResponse({ turno: mapTurno(turno) }, 201);
  } catch (error) {
    if ((error as ActionError).code === 'FEATURE_NOT_AVAILABLE') {
      return errorResponse('Función no disponible en tu plan', 403, 'FEATURE_NOT_AVAILABLE');
    }
    console.error('Error abriendo turno (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}