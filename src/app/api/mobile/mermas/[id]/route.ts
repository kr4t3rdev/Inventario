import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service';
import { revertirMovimientosDeOrigen } from '@/features/inventario/movimientos';
import { mapMerma } from '../route';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const SELECT = {
  mermaId: true,
  productoId: true,
  cantidad: true,
  motivo: true,
  createdAt: true,
  updatedAt: true,
  producto: { select: { id: true, nombre: true, codigoInterno: true } },
} as const;

/**
 * @description Mobile merma detail endpoint (tenant-scoped).
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with merma id.
 * @returns {Promise<Response>} Mapped merma payload.
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
    const merma = await prisma.merma.findFirst({
      where: { mermaId: id, tenantId },
      select: SELECT,
    });
    if (!merma) {
      return errorResponse('Merma no encontrada', 404, 'NOT_FOUND');
    }
    return successResponse(mapMerma(merma as any));
  } catch (error) {
    console.error('Error en mobile merma detail route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Deletes a merma and restores stock to its warehouse.
 * @param {Request} request - Incoming authenticated request.
 * @param {RouteContext} context - Route params with merma id.
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
    const existing = await prisma.merma.findFirst({
      where: { mermaId: id, tenantId },
      select: { mermaId: true, productoId: true, cantidad: true, almacenId: true },
    });
    if (!existing) {
      return errorResponse('Merma no encontrada', 404, 'NOT_FOUND');
    }

    // Alineado con deleteMermaAction (desktop): anular espejos, revertir
    // kardex y restaurar stock. El kardex y el stock requieren ubicación
    // (almacenId); la anulación del espejo no y siempre aplica.
    await prisma.$transaction(async (tx: any) => {
      await tx.ajusteInventario.updateMany({
        where: { tenantId, origenMermaId: id },
        data: { estado: 'ANULADO' },
      });
      if (existing.almacenId) {
        await revertirMovimientosDeOrigen(tx, {
          tenantId,
          tipoOrigen: 'MERMA',
          origenId: id,
          creadoPorId: authResult.user.userId,
        });
        await tx.merma.delete({ where: { mermaId: id } });
        await upsertStockUbicacion(tx, {
          tenantId,
          productoId: existing.productoId,
          tipoUbicacion: 'almacen',
          ubicacionId: existing.almacenId!,
          modo: 'increment',
          delta: existing.cantidad,
        });
      } else {
        await tx.merma.delete({ where: { mermaId: id } });
      }
    });

    return successResponse({ success: true, mermaId: id });
  } catch (error) {
    console.error('Error eliminando merma (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}