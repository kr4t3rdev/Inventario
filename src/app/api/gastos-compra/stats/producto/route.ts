import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuthGet } from '@/lib/auth-middleware';

/**
 * Esquema de validación para parámetros
 */
const querySchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  fechaDesde: z.string().datetime().optional(),
  fechaHasta: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(50).default(10),
});

/**
 * @description Obtener estadísticas de gastos agrupadas por producto
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Estadísticas por producto
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    // Validar parámetros
    const params = querySchema.parse({
      periodo: searchParams.get('periodo') || undefined,
      fechaDesde: searchParams.get('fechaDesde') || undefined,
      fechaHasta: searchParams.get('fechaHasta') || undefined,
      limit: searchParams.get('limit') || '10',
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

    // Obtener estadísticas por producto
    const statsPorProducto = await prisma.gastoCompra.groupBy({
      by: ['productoId'],
      where: whereClause,
      _sum: {
        total: true,
        cantidad: true,
      },
      _count: {
        gastoCompraId: true,
      },
      _avg: {
        total: true,
        precioUnitario: true,
      },
      orderBy: {
        _sum: {
          total: 'desc',
        },
      },
      take: params.limit,
    });

    // Obtener información de productos
    const productos = await prisma.producto.findMany({
      where: {
        id: {
          in: statsPorProducto.map((s: { productoId: string }) => s.productoId),
        },
      },
      select: {
        id: true,
        nombre: true,
        categoria: {
          select: {
            nombre: true,
          },
        },
        unidad: {
          select: {
            simbolo: true,
          },
        },
      },
    });

    // Enriquecer estadísticas con información de productos
    const resultado = statsPorProducto.map((stat: {
      productoId: string;
      _sum: { total: number | null; cantidad: number | null };
      _count: { gastoCompraId: number };
      _avg: { total: number | null; precioUnitario: number | null };
    }) => {
      const producto = productos.find(
        (p: { id: string }) => p.id === stat.productoId
      );
      return {
        productoId: stat.productoId,
        producto,
        totalGastado: stat._sum.total || 0,
        cantidadCompras: stat._count.gastoCompraId,
        cantidadProductos: stat._sum.cantidad || 0,
        promedioGasto: stat._avg.total || 0,
        promedioPrecioUnitario: stat._avg.precioUnitario || 0,
      };
    });

    return NextResponse.json({
      data: resultado,
      meta: {
        totalProductos: resultado.length,
        filtros: {
          periodo: params.periodo,
          fechaDesde: params.fechaDesde,
          fechaHasta: params.fechaHasta,
        },
      },
    });
  } catch (error) {
    console.error('Error al obtener estadísticas por producto:', error);

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
      { error: 'Error al obtener estadísticas por producto' },
      { status: 500 }
    );
  }
});
