import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ESTADO_MAP: Record<string, string> = { ANULADO: 'CANCELADO' };

/**
 * @description Maps a Contrato row to the mobile contract contract.
 * @param {Record<string, any>} c - Raw contract row with client.
 * @returns {Record<string, unknown>} Mobile-shaped contract payload.
 */
export function mapContrato(c: any) {
  return {
    contratoId: c.contratoId,
    clienteId: c.clienteId,
    titulo: c.numeroContrato,
    descripcion: c.observaciones,
    monto: Number(c.monto ?? 0),
    estado: ESTADO_MAP[c.estado] ?? c.estado,
    fechaInicio: c.fechaInicio.toISOString(),
    fechaFin: c.fechaFin ? c.fechaFin.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    cliente: c.cliente ? { nombre: c.cliente.nombre } : undefined,
  };
}

const SELECT = {
  contratoId: true,
  clienteId: true,
  numeroContrato: true,
  observaciones: true,
  monto: true,
  estado: true,
  fechaInicio: true,
  fechaFin: true,
  createdAt: true,
  updatedAt: true,
  cliente: { select: { nombre: true } },
} as const;

/**
 * @description Mobile contracts list endpoint (tenant-scoped).
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Mapped contract list.
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
    const rows = await prisma.contrato.findMany({
      where: { tenantId },
      select: SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return successResponse({ items: rows.map(mapContrato) });
  } catch (error) {
    console.error('Error en mobile contracts route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}