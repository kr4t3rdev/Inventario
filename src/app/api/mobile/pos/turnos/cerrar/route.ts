import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { requireFeature } from '@/lib/services/tenant-scope';
import { cerrarTurnoSchema } from '@/features/turnos-pos/schemas';
import { ActionError } from '@/lib/server-actions';

export const dynamic = 'force-dynamic';

/**
 * @description Mobile close-shift endpoint. Mirrors cerrarTurnoAction.
 * @param {Request} request - Incoming authenticated request with { turnoId }.
 * @returns {Promise<Response>} Closed turno payload.
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
    const parsed = cerrarTurnoSchema.parse(await request.json());

    const turno = await prisma.turnoPuntoVenta.findFirst({
      where: { id: parsed.turnoId, tenantId },
      include: {
        arqueos: { orderBy: { createdAt: 'desc' }, take: 1 },
        puntoDeVenta: { select: { pvId: true, nombre: true } },
      },
    });
    if (!turno) {
      return errorResponse('Turno no encontrado', 404, 'NOT_FOUND');
    }
    if (turno.estado !== 'ABIERTO') {
      return errorResponse('El turno ya está cerrado', 409, 'CONFLICT');
    }

    const ultimoArqueo = turno.arqueos[0] ?? null;
    if (!ultimoArqueo) {
      return errorResponse('Debe realizar el arqueo de caja antes de cerrar el turno', 409, 'NO_ARQUEO');
    }

    const ventaAgg = await prisma.venta.aggregate({
      where: { turnoId: parsed.turnoId, deletedAt: null },
      _sum: { total: true },
    });
    const totalVentaTurno = ventaAgg._sum.total ?? 0;

    const arqueoTotalPesos =
      (ultimoArqueo.totalEfectivoCup - turno.fondoInicialCup + ultimoArqueo.totalTarjeta + ultimoArqueo.totalTransferencia + ultimoArqueo.totalCredito) / 100;
    const diferencia = Math.abs(arqueoTotalPesos - totalVentaTurno);
    if (diferencia > 0.01) {
      return errorResponse(
        `El arqueo ($${arqueoTotalPesos.toFixed(2)}) no coincide con las ventas ($${totalVentaTurno.toFixed(2)}). Diferencia: $${diferencia.toFixed(2)}.`,
        400,
        'ARQUEO_MISMATCH',
      );
    }

    const cerrado = await prisma.turnoPuntoVenta.update({
      where: { id: parsed.turnoId },
      data: { estado: 'CERRADO', fechaCierre: new Date() },
    });

    return successResponse({ turno: { turnoId: cerrado.id, estado: cerrado.estado, fechaCierre: cerrado.fechaCierre?.toISOString() ?? null } });
  } catch (error) {
    if (error instanceof ActionError) {
      return errorResponse(error.message, 400, error.code);
    }
    console.error('Error cerrando turno (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}