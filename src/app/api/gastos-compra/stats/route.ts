import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuthGet } from '@/lib/auth-middleware';

/**
 * Esquema de validación para parámetros de estadísticas
 */
const querySchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  fechaDesde: z.string().datetime().optional(),
  fechaHasta: z.string().datetime().optional(),
});

/**
 * @description Obtener estadísticas generales de gastos de compra
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Estadísticas de gastos de compra
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    // Validar parámetros
    const params = querySchema.parse({
      periodo: searchParams.get('periodo') || undefined,
      fechaDesde: searchParams.get('fechaDesde') || undefined,
      fechaHasta: searchParams.get('fechaHasta') || undefined,
    });

    // Construir cláusula WHERE
    const whereClause: Record<string, unknown> = {};

    if (params.periodo) {
      whereClause.periodo = params.periodo;
    }

    if (params.fechaDesde || params.fechaHasta) {
      whereClause.fechaCompra = {};
      if (params.fechaDesde) {
        (whereClause.fechaCompra as Record<string, Date>).gte = new Date(params.fechaDesde);
      }
      if (params.fechaHasta) {
        (whereClause.fechaCompra as Record<string, Date>).lte = new Date(params.fechaHasta);
      }
    }

    // Ejecutar estadísticas en paralelo
    const [
      totalStats,
      restockStats,
      regularStats,
      topProductos,
      topProveedores,
      porPeriodo,
      promedios,
    ] = await Promise.all([
      // Estadísticas totales
      prisma.gastoCompra.aggregate({
        where: whereClause,
        _count: { gastoCompraId: true },
        _sum: { total: true, cantidad: true },
        _avg: { total: true, precioUnitario: true },
        _min: { total: true, fechaCompra: true },
        _max: { total: true, fechaCompra: true },
      }),

      // Estadísticas de restock
      prisma.gastoCompra.aggregate({
        where: {
          ...whereClause,
          descripcion: { contains: 'Restock' },
        },
        _count: { gastoCompraId: true },
        _sum: { total: true, cantidad: true },
      }),

      // Estadísticas de compras regulares
      prisma.gastoCompra.aggregate({
        where: {
          ...whereClause,
          descripcion: { not: { contains: 'Restock' } },
        },
        _count: { gastoCompraId: true },
        _sum: { total: true, cantidad: true },
      }),

      // Top 5 productos por gasto
      prisma.gastoCompra.groupBy({
        by: ['productoId'],
        where: whereClause,
        _sum: { total: true, cantidad: true },
        _count: { gastoCompraId: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),

      // Top 5 proveedores por gasto
      prisma.gastoCompra.groupBy({
        by: ['vendorId'],
        where: whereClause,
        _sum: { total: true },
        _count: { gastoCompraId: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),

      // Gastos por período
      prisma.gastoCompra.groupBy({
        by: ['periodo'],
        where: whereClause,
        _sum: { total: true },
        _count: { gastoCompraId: true },
        orderBy: { periodo: 'desc' },
        take: 12,
      }),

      // Promedios generales
      prisma.gastoCompra.aggregate({
        where: whereClause,
        _avg: {
          total: true,
          cantidad: true,
          precioUnitario: true,
        },
      }),
    ]);

    // Obtener nombres de productos y proveedores para los top 5
    const [productosTop, proveedoresTop] = await Promise.all([
      prisma.producto.findMany({
        where: {
          id: { in: topProductos.map((p: { productoId: string }) => p.productoId) },
        },
        select: { id: true, nombre: true },
      }),
      prisma.vendor.findMany({
        where: {
          vendorId: { in: topProveedores.map((v: { vendorId: string }) => v.vendorId) },
        },
        select: { vendorId: true, nombre: true },
      }),
    ]);

    // Enriquecer datos de top productos
    const topProductosConNombres = topProductos.map((p: { productoId: string }) => ({
      ...p,
      producto: productosTop.find((prod: { id: string }) => prod.id === p.productoId),
    }));

    // Enriquecer datos de top proveedores
    const topProveedoresConNombres = topProveedores.map((v: { vendorId: string }) => ({
      ...v,
      proveedor: proveedoresTop.find((ven: { vendorId: string }) => ven.vendorId === v.vendorId),
    }));

    return NextResponse.json({
      general: {
        totalGastos: totalStats._count.gastoCompraId,
        montoTotal: totalStats._sum.total || 0,
        cantidadTotal: totalStats._sum.cantidad || 0,
        promedioGasto: totalStats._avg.total || 0,
        promedioCantidad: promedios._avg.cantidad || 0,
        promedioPrecioUnitario: promedios._avg.precioUnitario || 0,
        montoMinimo: totalStats._min.total || 0,
        montoMaximo: totalStats._max.total || 0,
        fechaPrimerGasto: totalStats._min.fechaCompra,
        fechaUltimoGasto: totalStats._max.fechaCompra,
      },
      porTipo: {
        restock: {
          cantidad: restockStats._count.gastoCompraId,
          montoTotal: restockStats._sum.total || 0,
          cantidadProductos: restockStats._sum.cantidad || 0,
        },
        regular: {
          cantidad: regularStats._count.gastoCompraId,
          montoTotal: regularStats._sum.total || 0,
          cantidadProductos: regularStats._sum.cantidad || 0,
        },
      },
      topProductos: topProductosConNombres,
      topProveedores: topProveedoresConNombres,
      porPeriodo,
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de gastos de compra:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Parámetros de consulta inválidos',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al obtener estadísticas de gastos de compra' },
      { status: 500 }
    );
  }
});
