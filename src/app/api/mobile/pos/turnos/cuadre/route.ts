import { authenticateUser } from '@/lib/auth-middleware';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@/lib/prisma';
import { requireFeature } from '@/lib/services/tenant-scope';
import { getStockPorUbicacionBatch } from '@/lib/services/stock-ubicacion-queries';

export const dynamic = 'force-dynamic';

/**
 * @description Mobile turn closure report endpoint. Mirrors getCuadreTurnoAction.
 * @param {Request} request - Incoming authenticated request with ?turnoId=.
 * @returns {Promise<Response>} Cuadre payload.
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
        arqueos: { orderBy: { createdAt: 'desc' }, take: 1 },
        empleado: { select: { nombre: true, apellido: true } },
        puntoDeVenta: { select: { pvId: true, nombre: true, almacenId: true } },
      },
    });
    if (!turno) {
      return errorResponse('Turno no encontrado', 404, 'NOT_FOUND');
    }
    const ultimoArqueo = turno.arqueos[0] ?? null;
    if (!ultimoArqueo) {
      return errorResponse('Debe realizar el arqueo de caja primero', 409, 'NO_ARQUEO');
    }

    const ventaItems = await prisma.ventaItem.findMany({
      where: { venta: { turnoId, deletedAt: null } },
      select: {
        productoId: true,
        cantidad: true,
        precioUnitario: true,
        producto: {
          select: {
            id: true,
            nombre: true,
            precioVenta: true,
            fotos: true,
            codigoInterno: true,
            unidad: { select: { simbolo: true } },
          },
        },
      },
    });

    const ventasPorProducto = new Map<string, { cantidad: number; precioUnitario: number; producto: (typeof ventaItems)[0]['producto'] }>();
    for (const vi of ventaItems) {
      const existing = ventasPorProducto.get(vi.productoId);
      if (existing) existing.cantidad += vi.cantidad;
      else ventasPorProducto.set(vi.productoId, { cantidad: vi.cantidad, precioUnitario: vi.precioUnitario, producto: vi.producto });
    }

    const productIds = Array.from(ventasPorProducto.keys());
    let stockActualMap = new Map<string, number>();
    if (productIds.length > 0) {
      const stockBatch = await getStockPorUbicacionBatch(prisma as any, {
        productoIds: productIds,
        tipoUbicacion: 'punto_venta',
        ubicacionId: turno.puntoDeVentaId,
      });
      for (const [pid, s] of stockBatch) stockActualMap.set(pid, s.cantidad);
    }

    let totalStock = 0;
    let totalVendido = 0;
    let totalVentaMonto = 0;
    const productos = [];
    for (const [productoId, data] of ventasPorProducto) {
      const stockActual = stockActualMap.get(productoId) ?? 0;
      const vendido = data.cantidad;
      const precioTotal = vendido * data.precioUnitario;
      totalStock += stockActual + vendido;
      totalVendido += vendido;
      totalVentaMonto += precioTotal;
      productos.push({
        id: productoId,
        nombre: data.producto.nombre,
        codigoInterno: data.producto.codigoInterno,
        stockEnUbicacion: stockActual + vendido,
        vendidoEnTurno: vendido,
        precioVenta: precioTotal,
        restante: stockActual,
      });
    }
    productos.sort((a, b) => a.nombre.localeCompare(b.nombre));

    const ventasTurno = await prisma.venta.aggregate({
      where: { turnoId, deletedAt: null },
      _sum: { total: true },
    });
    const totalVentaTurno = ventasTurno._sum.total ?? 0;

    return successResponse({
      turno: {
        id: turno.id,
        puntoDeVentaId: turno.puntoDeVentaId,
        puntoDeVentaNombre: turno.puntoDeVenta.nombre,
        fondoInicialCup: turno.fondoInicialCup,
        fondoInicialUsd: turno.fondoInicialUsd,
        fechaApertura: turno.fechaApertura.toISOString(),
        fechaCierre: turno.fechaCierre ? turno.fechaCierre.toISOString() : null,
        estado: turno.estado,
        tipo: turno.tipo,
      },
      arqueo: ultimoArqueo,
      totalVentaTurno,
      productos,
      resumen: { totalStock, totalVendido, totalVentaMonto },
    });
  } catch (error) {
    console.error('Error al obtener cuadre (mobile):', error);
    return errorResponse('Error interno del servidor', 500, 'INTERNAL_ERROR');
  }
}