import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * @description Computes a display type string for a transfer (Almacén / Punto de Venta).
 * @param {Record<string, any>} t - Transfer row with origin/destination relations.
 * @returns {string} Human-readable transfer direction.
 */
function tipoTransferencia(t: any): string {
  const origen = t.origen ? 'Almacén' : t.puntoDeVentaOrigen ? 'Punto de Venta' : '';
  const destino = t.destino ? 'Almacén' : t.puntoDeVentaDestino ? 'Punto de Venta' : '';
  return origen && destino ? `${origen} → ${destino}` : origen || destino;
}

/**
 * @description Maps a Transferencia row to the mobile transfer contract.
 * @param {Record<string, any>} t - Raw transfer row with relations.
 * @returns {Record<string, unknown>} Mobile-shaped transfer payload.
 */
export function mapTransferencia(t: any) {
  return {
    transferenciaId: t.transferenciaId,
    numeroTransferencia: t.numeroTransferencia,
    productoId: t.productoId,
    cantidad: t.cantidad,
    descripcion: t.descripcion,
    estado: t.estado,
    tipoTransferencia: tipoTransferencia(t),
    origenId: t.origenId,
    destinoId: t.destinoId,
    puntoDeVentaOrigenId: t.puntoDeVentaOrigenId,
    puntoDeVentaDestinoId: t.puntoDeVentaDestinoId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    producto: t.producto
      ? { id: t.producto.id, nombre: t.producto.nombre, codigoInterno: t.producto.codigoInterno }
      : undefined,
    origen: t.origen ? { almacenId: t.origen.almacenId, nombre: t.origen.nombre } : undefined,
    destino: t.destino ? { almacenId: t.destino.almacenId, nombre: t.destino.nombre } : undefined,
  };
}

const SELECT = {
  transferenciaId: true,
  numeroTransferencia: true,
  productoId: true,
  cantidad: true,
  descripcion: true,
  estado: true,
  createdAt: true,
  updatedAt: true,
  origenId: true,
  destinoId: true,
  puntoDeVentaOrigenId: true,
  puntoDeVentaDestinoId: true,
  producto: { select: { id: true, nombre: true, codigoInterno: true } },
  origen: { select: { almacenId: true, nombre: true } },
  destino: { select: { almacenId: true, nombre: true } },
} as const;

/**
 * @description Mobile transfers list endpoint.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Mapped transfer list.
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
    const rows = await prisma.transferencia.findMany({
      where: { tenantId, deletedAt: null },
      select: SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return successResponse({ items: rows.map(mapTransferencia) });
  } catch (error) {
    console.error('Error en mobile transfers route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}