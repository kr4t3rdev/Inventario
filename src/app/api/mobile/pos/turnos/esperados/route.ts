import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { requireFeature } from '@/lib/services/tenant-scope';

export const dynamic = 'force-dynamic';

/**
 * @description Mobile expected-amounts-for-arqueo endpoint. Mirrors getEsperadosArqueoAction.
 * @param {Request} request - Incoming authenticated request with ?turnoId=.
 * @returns {Promise<Response>} Expected amounts payload.
 */
export async function GET(request: Request) {
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
    const turnoId = new URL(request.url).searchParams.get('turnoId');
    if (!turnoId) {
      return errorResponse('El turno es requerido', 400, 'VALIDATION_ERROR');
    }

    const turno = await prisma.turnoPuntoVenta.findFirst({
      where: { id: turnoId, tenantId },
      include: {
        ventas: {
          where: { deletedAt: null },
          select: {
            metodoPago: true,
            montoEfectivo: true,
            montoTarjeta: true,
            montoTransferencia: true,
            montoCredito: true,
            total: true,
          },
        },
      },
    });
    if (!turno) {
      return errorResponse('Turno no encontrado', 404, 'NOT_FOUND');
    }

    const ventasEfectivoCup = turno.ventas
      .filter((v) => v.metodoPago === 'EFECTIVO' || v.metodoPago === 'MIXTO')
      .reduce((sum, v) => sum + (v.montoEfectivo ?? 0), 0);
    const ventasEfectivoUsd = 0;

    return successResponse({
      esperadoEfectivoCup: ventasEfectivoCup,
      esperadoEfectivoUsd: turno.fondoInicialUsd + ventasEfectivoUsd,
      esperadoTarjeta: turno.ventas
        .filter((v) => v.metodoPago === 'TARJETA' || v.metodoPago === 'MIXTO')
        .reduce((sum, v) => sum + (v.montoTarjeta ?? 0), 0),
      esperadoTransferencia: turno.ventas
        .filter((v) => v.metodoPago === 'TRANSFERENCIA' || v.metodoPago === 'MIXTO')
        .reduce((sum, v) => sum + (v.montoTransferencia ?? 0), 0),
      esperadoCredito: turno.ventas
        .filter((v) => v.metodoPago === 'CREDITO' || v.metodoPago === 'MIXTO')
        .reduce((sum, v) => sum + (v.montoCredito ?? 0), 0),
      fondoInicialCup: turno.fondoInicialCup,
      fondoInicialUsd: turno.fondoInicialUsd,
      ventasEfectivoCup,
      ventasEfectivoUsd,
    });
  } catch (error) {
    console.error('Error al consultar esperados (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}