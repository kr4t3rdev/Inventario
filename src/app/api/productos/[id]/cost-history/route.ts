import { NextRequest, NextResponse } from 'next/server';

import { withAuthGet } from '@/lib/auth-middleware';
import { prisma } from '@/lib/prisma';

type CostHistoryRouteContext = { params: Promise<{ id: string }> };

/**
 * @description GET /api/productos/[id]/cost-history - Obtiene el historial de cambios de costos de un producto
 * @param {NextRequest} request - La solicitud HTTP
 * @param {CostHistoryRouteContext} context - Contexto con parámetros de ruta
 * @returns {Promise<NextResponse>} Respuesta JSON con historial paginado de cambios de costos
 */
async function GET(request: NextRequest, context: CostHistoryRouteContext) {
  return withAuthGet(async () => {
    try {
      const { id } = await context.params;
      const { searchParams } = new URL(request.url);

      // Get pagination parameters
      const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      // Validate product exists
      const producto = await prisma.producto.findUnique({
        where: { id },
        select: { id: true },
      });

      if (!producto) {
        return NextResponse.json(
          { error: 'Producto no encontrado' },
          { status: 404 }
        );
      }

      // Build date filter
      const dateFilter: Record<string, any> = {};
      if (startDate) {
        try {
          const startDateTime = new Date(startDate);
          if (!isNaN(startDateTime.getTime())) {
            dateFilter.gte = startDateTime;
          }
        } catch (err) {
          return NextResponse.json(
            { error: 'Formato de startDate inválido. Use ISO-8601 (e.g., 2024-01-15T00:00:00Z)' },
            { status: 400 }
          );
        }
      }

      if (endDate) {
        try {
          const endDateTime = new Date(endDate);
          if (!isNaN(endDateTime.getTime())) {
            dateFilter.lte = endDateTime;
          }
        } catch (err) {
          return NextResponse.json(
            { error: 'Formato de endDate inválido. Use ISO-8601 (e.g., 2024-01-15T23:59:59Z)' },
            { status: 400 }
          );
        }
      }

      // Build where clause
      const whereClause: Record<string, any> = { productoId: id };
      if (Object.keys(dateFilter).length > 0) {
        whereClause.changedAt = dateFilter;
      }

      // Get total count for pagination
      const total = await prisma.productoCostHistory.count({
        where: whereClause,
      });

      // Get paginated results
      const skip = (page - 1) * limit;
      const history = await prisma.productoCostHistory.findMany({
        where: whereClause,
        orderBy: { changedAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          oldPrecioCosto: true,
          newPrecioCosto: true,
          oldPrecioVenta: true,
          newPrecioVenta: true,
          reason: true,
          changedBy: true,
          changedAt: true,
          notes: true,
        },
      });

      // Calculate change percentages
      const historyWithChanges = history.map((record) => {
        const costChange =
          record.oldPrecioCosto && record.newPrecioCosto
            ? ((record.newPrecioCosto - record.oldPrecioCosto) / record.oldPrecioCosto) * 100
            : null;

        const priceChange =
          record.oldPrecioVenta && record.newPrecioVenta
            ? ((record.newPrecioVenta - record.oldPrecioVenta) / record.oldPrecioVenta) * 100
            : null;

        return {
          ...record,
          costChangePercent: costChange,
          priceChangePercent: priceChange,
        };
      });

      return NextResponse.json(
        {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
          history: historyWithChanges,
        },
        { status: 200 }
      );
    } catch (error) {
      console.error('[cost-history] Error:', error);
      return NextResponse.json(
        { error: 'Error interno del servidor' },
        { status: 500 }
      );
    }
  })(request);
}

export { GET };
