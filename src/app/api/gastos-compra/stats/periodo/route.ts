import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuthGet } from '@/lib/auth-middleware';

/**
 * Esquema de validación para parámetros
 */
const querySchema = z.object({
  year: z.coerce.number().min(2000).max(2100).optional(),
  limit: z.coerce.number().min(1).max(24).default(12),
});

/**
 * @description Obtener estadísticas de gastos agrupadas por período
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Estadísticas por período
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    // Validar parámetros
    const params = querySchema.parse({
      year: searchParams.get('year') || undefined,
      limit: searchParams.get('limit') || '12',
    });

    // Construir cláusula WHERE
    const whereClause: Record<string, unknown> = {};

    if (params.year) {
      whereClause.periodo = {
        startsWith: params.year.toString(),
      };
    }

    // Obtener estadísticas por período
    const statsPorPeriodo = await prisma.gastoCompra.groupBy({
      by: ['periodo'],
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
      },
      orderBy: {
        periodo: 'desc',
      },
      take: params.limit,
    });

    // Calcular estadísticas adicionales
    const totalGastos = statsPorPeriodo.reduce(
      (acc: number, curr: { _sum: { total: number | null } }) => acc + (curr._sum.total || 0),
      0
    );
    const promedioMensual = totalGastos / (statsPorPeriodo.length || 1);

    // Encontrar el mejor y peor período
    const periodosOrdenados = [...statsPorPeriodo].sort(
      (a: { _sum: { total: number | null } }, b: { _sum: { total: number | null } }) =>
        (b._sum.total || 0) - (a._sum.total || 0)
    );

    const mejorPeriodo = periodosOrdenados[0];
    const peorPeriodo = periodosOrdenados[periodosOrdenados.length - 1];

    // Formatear resultado
    const resultado = statsPorPeriodo.map((stat: {
      periodo: string | null;
      _sum: { total: number | null; cantidad: number | null };
      _count: { gastoCompraId: number };
      _avg: { total: number | null };
    }) => {
      if (!stat.periodo) return null;
      const [year, month] = stat.periodo.split('-');
      return {
        periodo: stat.periodo,
        year: parseInt(year),
        month: parseInt(month),
        mesNombre: new Date(parseInt(year), parseInt(month) - 1).toLocaleString('es-ES', {
          month: 'long',
        }),
        totalGastado: stat._sum.total || 0,
        cantidadCompras: stat._count.gastoCompraId,
        cantidadProductos: stat._sum.cantidad || 0,
        promedioGasto: stat._avg.total || 0,
      };
    });

    return NextResponse.json({
      data: resultado.filter((r): r is NonNullable<typeof r> => r !== null),
      resumen: {
        totalPeriodos: statsPorPeriodo.length,
        totalGastos,
        promedioMensual,
        mejorPeriodo: mejorPeriodo
          ? {
              periodo: mejorPeriodo.periodo,
              total: mejorPeriodo._sum.total || 0,
            }
          : null,
        peorPeriodo: peorPeriodo
          ? {
              periodo: peorPeriodo.periodo,
              total: peorPeriodo._sum.total || 0,
            }
          : null,
      },
      meta: {
        filtros: {
          year: params.year,
          limit: params.limit,
        },
      },
    });
  } catch (error) {
    console.error('Error al obtener estadísticas por período:', error);

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
      { error: 'Error al obtener estadísticas por período' },
      { status: 500 }
    );
  }
});
