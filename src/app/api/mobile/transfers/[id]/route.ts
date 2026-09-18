import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { mapTransferencia } from '../route';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
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
 * @description Mobile transfer detail endpoint (tenant-scoped).
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with transfer id.
 * @returns {Promise<Response>} Mapped transfer payload.
 */
export async function GET(request: Request, context: RouteContext) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    const { id } = await context.params;
    const transferencia = await prisma.transferencia.findFirst({
      where: { transferenciaId: id, tenantId, deletedAt: null },
      select: SELECT,
    });
    if (!transferencia) {
      return errorResponse('Transferencia no encontrada', 404, 'NOT_FOUND');
    }
    return successResponse(mapTransferencia(transferencia as any));
  } catch (error) {
    console.error('Error en mobile transfer detail route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Cancels a transfer (soft-delete) and reverts stock when applicable.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with transfer id.
 * @returns {Promise<Response>} Deletion confirmation.
 */
export async function DELETE(request: Request, context: RouteContext) {
  const authResult = await authenticateUser(request as never);
  if ('status' in authResult) {
    return authResult as Response;
  }
  const tenantId = authResult.user.tenantId;
  if (!tenantId) {
    return errorResponse('Tenant no identificado', 403, 'TENANT_REQUIRED');
  }

  try {
    const { id } = await context.params;
    const existing = await prisma.transferencia.findFirst({
      where: { transferenciaId: id, tenantId },
      select: {
        transferenciaId: true,
        estado: true,
        deletedAt: true,
        productoId: true,
        cantidad: true,
        origenId: true,
        destinoId: true,
        puntoDeVentaOrigenId: true,
        puntoDeVentaDestinoId: true,
      },
    });
    if (!existing) {
      return errorResponse('Transferencia no encontrada', 404, 'NOT_FOUND');
    }

    // Idempotente: si ya fue cancelada, no vuelve a mover stock.
    if (existing.deletedAt || existing.estado === 'CANCELADA') {
      return successResponse({ success: true, transferenciaId: id });
    }

    await prisma.$transaction(async (tx: any) => {
      const claim = await tx.transferencia.updateMany({
        where: { transferenciaId: id, tenantId, deletedAt: null, estado: existing.estado },
        data: { estado: 'CANCELADA', deletedAt: new Date() },
      });
      if (claim.count !== 1) {
        throw new Error('TRANSFER_CONFLICT');
      }

      // Solo revertir stock si la transferencia estaba COMPLETADA.
      if (existing.estado === 'COMPLETADA') {
        const tipoOrigen = existing.origenId ? 'almacen' : 'punto_venta';
        const tipoDestino = existing.destinoId ? 'almacen' : 'punto_venta';
        const origenUbicacionId = existing.origenId || existing.puntoDeVentaOrigenId;
        const destinoUbicacionId = existing.destinoId || existing.puntoDeVentaDestinoId;

        await upsertStockUbicacion(tx, {
          tenantId,
          productoId: existing.productoId,
          tipoUbicacion: tipoOrigen as 'almacen' | 'punto_venta',
          ubicacionId: origenUbicacionId!,
          modo: 'increment',
          delta: existing.cantidad,
        });
        await upsertStockUbicacion(tx, {
          tenantId,
          productoId: existing.productoId,
          tipoUbicacion: tipoDestino as 'almacen' | 'punto_venta',
          ubicacionId: destinoUbicacionId!,
          modo: 'increment',
          delta: -existing.cantidad,
        });
      }
    });

    return successResponse({ success: true, transferenciaId: id });
  } catch (error) {
    console.error('Error eliminando transferencia (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}