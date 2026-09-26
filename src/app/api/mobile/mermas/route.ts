import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { notificarMerma } from '@/lib/notificaciones-utils';
import { registrarMermaEnTransaccion } from '@/features/mermas/services/registrar-merma-service';

export const dynamic = 'force-dynamic';

/**
 * @description Maps a Merma row to the mobile merma contract.
 * @param {Record<string, any>} m - Raw merma row with product.
 * @returns {Record<string, unknown>} Mobile-shaped merma payload.
 */
export function mapMerma(m: any) {
  return {
    mermaId: m.mermaId,
    productoId: m.productoId,
    cantidad: m.cantidad,
    motivo: m.motivo ?? '',
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    producto: m.producto
      ? { id: m.producto.id, nombre: m.producto.nombre, codigoInterno: m.producto.codigoInterno }
      : undefined,
  };
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
 * @description Mobile merma list endpoint.
 * @param {Request} request - Incoming authenticated request.
 * @returns {Promise<Response>} Mapped merma list.
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
    const rows = await prisma.merma.findMany({
      where: { tenantId },
      select: SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return successResponse({ items: rows.map(mapMerma) });
  } catch (error) {
    console.error('Error en mobile mermas route:', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}

/**
 * @description Creates a merma and decrements the stock at the product's warehouse.
 * @param {Request} request - Incoming authenticated request with { productoId, cantidad, motivo }.
 * @returns {Promise<Response>} Created mapped merma.
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
    const body = (await request.json()) as { productoId?: unknown; cantidad?: unknown; motivo?: unknown };
    const productoId = typeof body.productoId === 'string' ? body.productoId : '';
    const cantidad = typeof body.cantidad === 'number' && Number.isFinite(body.cantidad) ? body.cantidad : 0;
    // Enteros estrictos: el kardex (registrarMovimiento) rechaza fracciones y
    // sin esta guarda llegarían como 500.
    if (!productoId || cantidad <= 0 || !Number.isInteger(cantidad)) {
      return errorResponse('Datos inválidos', 400, 'VALIDATION_ERROR');
    }

    const producto = await prisma.producto.findUnique({
      where: { id: productoId },
      select: { id: true, tenantId: true, precioCosto: true, almacenId: true },
    });
    if (!producto || producto.tenantId !== tenantId) {
      return errorResponse('Producto no encontrado', 404, 'NOT_FOUND');
    }
    if (!producto.almacenId) {
      return errorResponse('El producto no tiene almacén asignado', 400, 'VALIDATION_ERROR');
    }

    const stockUbicacion = await prisma.stockUbicacion.findUnique({
      where: {
        productoId_tipoUbicacion_ubicacionId: {
          productoId,
          tipoUbicacion: 'almacen',
          ubicacionId: producto.almacenId,
        },
      },
      select: { cantidadDisponible: true },
    });
    if (!stockUbicacion || stockUbicacion.cantidadDisponible < cantidad) {
      return errorResponse('Stock insuficiente en el almacén', 409, 'STOCK_INSUFICIENTE');
    }

    const motivo = typeof body.motivo === 'string' && body.motivo.trim() ? body.motivo.trim() : null;

    // Núcleo compartido con el desktop: merma con creadoPorId, stock,
    // kardex (SALIDA-0) y espejo AjusteInventario en una sola transacción.
    const merma = await prisma.$transaction(async (tx: any) =>
      registrarMermaEnTransaccion(tx, {
        tenantId,
        productoId,
        cantidad,
        motivo,
        almacenId: producto.almacenId!,
        creadoPorId: authResult.user.userId,
        costoUnitario: producto.precioCosto,
        stockDisponibleAntes: stockUbicacion.cantidadDisponible,
      }, { select: SELECT }),
    );

    try {
      await notificarMerma(merma.mermaId);
    } catch (notifyError) {
      console.error('Error enviando notificación de merma (mobile):', notifyError);
    }

    return successResponse(mapMerma(merma), 201);
  } catch (error) {
    console.error('Error creando merma (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}