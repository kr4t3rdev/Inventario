import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { revertirMovimientosDeOrigen } from '@/features/inventario/movimientos';
import { calcularUnidadesMovidas } from '@/features/transferencias/lib/stock-pv';
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
 * Shares the semantics of the desktop `deleteTransferenciaAction` (Sesión B):
 * the claim is atomic and tenant-scoped, the reverted quantity is exactly the
 * one the transfer moved (COMPLETADA and PARCIAL) and the kardex is
 * compensated.
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

  const { id } = await context.params;

  try {
    const existing = await prisma.transferencia.findFirst({
      where: { transferenciaId: id, tenantId },
      select: {
        transferenciaId: true,
        estado: true,
        deletedAt: true,
        productoId: true,
        cantidad: true,
        cantidadRecibida: true,
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
    if (existing.deletedAt) {
      return successResponse({ success: true, transferenciaId: id });
    }
    // Compatibilidad con filas legacy CANCELADA sin deletedAt: se ocultan sin
    // tocar stock (nunca movieron o ya fueron revertidas).
    if (existing.estado === 'CANCELADA') {
      await prisma.$transaction(async (tx: any) => {
        await tx.transferencia.updateMany({
          where: { transferenciaId: id, tenantId, deletedAt: null, estado: 'CANCELADA' },
          data: { deletedAt: new Date() },
        });
      });
      return successResponse({ success: true, transferenciaId: id });
    }

    await prisma.$transaction(async (tx: any) => {
      // Reclamo atómico y tenant-scoped: incluye la cantidad recibida porque
      // una PARCIAL puede recibir más unidades sin cambiar de estado, y sin
      // ese dato dos cancelaciones concurrentes podrían revertir dos veces.
      const claim = await tx.transferencia.updateMany({
        where: {
          transferenciaId: id,
          tenantId,
          deletedAt: null,
          estado: existing.estado,
          cantidadRecibida: existing.cantidadRecibida ?? null,
        },
        data: { estado: 'CANCELADA', deletedAt: new Date() },
      });
      if (claim.count !== 1) {
        const latest = await tx.transferencia.findFirst({
          where: { transferenciaId: id, tenantId },
          select: { deletedAt: true, estado: true },
        });
        if (!latest || latest.deletedAt || latest.estado === 'CANCELADA') {
          // Idempotente: otra cancelación ya se aplicó.
          return;
        }
        const conflicto = Object.assign(new Error('TRANSFER_CONFLICT'), {
          code: 'TRANSFER_CONFLICT',
        });
        throw conflicto;
      }

      // Revertir el stock si la transferencia movió unidades: COMPLETADA movió
      // su total (o lo recibido si llegó por partes) y PARCIAL movió lo
      // recibido. PENDIENTE/APROBADA/EN_TRANSITO nunca movieron stock.
      const cantidadMovida = calcularUnidadesMovidas({
        estado: existing.estado,
        cantidad: existing.cantidad,
        cantidadRecibida: existing.cantidadRecibida ?? null,
      });
      if (cantidadMovida > 0) {
        const tipoOrigen = existing.origenId ? ('almacen' as const) : ('punto_venta' as const);
        const tipoDestino = existing.destinoId ? ('almacen' as const) : ('punto_venta' as const);
        const origenUbicacionId = existing.origenId || existing.puntoDeVentaOrigenId;
        const destinoUbicacionId = existing.destinoId || existing.puntoDeVentaDestinoId;

        await upsertStockUbicacion(tx, {
          tenantId,
          productoId: existing.productoId,
          tipoUbicacion: tipoOrigen,
          ubicacionId: origenUbicacionId!,
          modo: 'increment',
          delta: cantidadMovida,
        });
        await upsertStockUbicacion(tx, {
          tenantId,
          productoId: existing.productoId,
          tipoUbicacion: tipoDestino,
          ubicacionId: destinoUbicacionId!,
          modo: 'increment',
          delta: -cantidadMovida,
        });

        // Kardex: compensación de las líneas originales con su costo histórico.
        await revertirMovimientosDeOrigen(tx, {
          tenantId,
          tipoOrigen: 'TRANSFERENCIA',
          origenId: id,
          creadoPorId: authResult.user.userId,
        });
      }
    });

    return successResponse({ success: true, transferenciaId: id });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'TRANSFER_CONFLICT') {
      console.warn('Conflicto al cancelar transferencia (mobile):', id);
      return errorResponse(
        'La transferencia cambió; vuelve a cargarla e inténtalo de nuevo',
        409,
        'CONFLICT',
      );
    }
    console.error('Error eliminando transferencia (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}