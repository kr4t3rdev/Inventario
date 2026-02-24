import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuthGet } from '@/lib/auth-middleware';

/**
 * Esquema de validación para parámetros de exportación
 */
const querySchema = z.object({
  format: z.enum(['csv', 'excel', 'pdf']).default('csv'),
  periodo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  productoId: z.string().optional(),
  proveedorId: z.string().optional(),
  fechaDesde: z.string().datetime().optional(),
  fechaHasta: z.string().datetime().optional(),
  tipoOperacion: z.enum(['restock', 'regular']).optional(),
});

/**
 * @description Exportar gastos de compra en formato CSV, Excel o PDF
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Archivo exportado
 */
export const GET = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    // Validar parámetros
    const params = querySchema.parse({
      format: searchParams.get('format') || 'csv',
      periodo: searchParams.get('periodo') || undefined,
      productoId: searchParams.get('productoId') || undefined,
      proveedorId: searchParams.get('proveedorId') || undefined,
      fechaDesde: searchParams.get('fechaDesde') || undefined,
      fechaHasta: searchParams.get('fechaHasta') || undefined,
      tipoOperacion: searchParams.get('tipoOperacion') || undefined,
    });

    // Construir cláusula WHERE
    const whereClause: Record<string, unknown> = {};

    if (params.periodo) {
      whereClause.periodo = params.periodo;
    }

    if (params.productoId) {
      whereClause.productoId = params.productoId;
    }

    if (params.proveedorId) {
      whereClause.proveedorId = params.proveedorId;
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

    if (params.tipoOperacion === 'restock') {
      whereClause.descripcion = { contains: 'Restock' };
    } else if (params.tipoOperacion === 'regular') {
      whereClause.descripcion = { not: { contains: 'Restock' } };
    }

    // Obtener datos con relaciones
    const gastosCompra = await prisma.gastoCompra.findMany({
      where: whereClause,
      include: {
        producto: {
          select: {
            nombre: true,
            categoria: {
              select: { nombre: true },
            },
          },
        },
        vendor: {
          select: {
            nombre: true,
            contacto: true,
          },
        },
      },
      orderBy: { fechaCompra: 'desc' },
    });

    // Generar contenido según formato
    if (params.format === 'csv') {
      const csv = generateCSV(gastosCompra);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="gastos-compra-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    if (params.format === 'excel') {
      // Por ahora retornamos CSV con extensión Excel
      const csv = generateCSV(gastosCompra);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="gastos-compra-${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      });
    }

    if (params.format === 'pdf') {
      // Generar reporte JSON estructurado para PDF
      const reportData = {
        titulo: 'Reporte de Gastos de Compra',
        fechaGeneracion: new Date().toISOString(),
        filtros: {
          periodo: params.periodo,
          productoId: params.productoId,
          proveedorId: params.proveedorId,
          fechaDesde: params.fechaDesde,
          fechaHasta: params.fechaHasta,
          tipoOperacion: params.tipoOperacion,
        },
        resumen: {
          totalRegistros: gastosCompra.length,
          montoTotal: gastosCompra.reduce((acc: number, g: { total: number }) => acc + g.total, 0),
          cantidadTotal: gastosCompra.reduce((acc: number, g: { cantidad: number }) => acc + g.cantidad, 0),
        },
        data: gastosCompra.map((g: any) => ({
          id: g.gastoCompraId,
          producto: g.producto?.nombre || 'N/A',
          categoria: g.producto?.categoria?.nombre || 'N/A',
          proveedor: g.vendor?.nombre || 'N/A',
          numeroFactura: g.numeroFactura || 'N/A',
          cantidad: g.cantidad,
          precioUnitario: g.precioUnitario,
          total: g.total,
          fechaCompra: g.fechaCompra.toISOString(),
          descripcion: g.descripcion || '',
          periodo: g.periodo || '',
          tipo: g.descripcion?.includes('Restock') ? 'Restock' : 'Regular',
          fechaRegistro: g.createdAt.toISOString(),
        })),
      };

      return NextResponse.json(reportData);
    }

    return NextResponse.json({ error: 'Formato no soportado' }, { status: 400 });
  } catch (error) {
    console.error('Error al exportar gastos de compra:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Parámetros de consulta inválidos',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: 'Error al exportar gastos de compra' }, { status: 500 });
  }
});

/**
 * Genera contenido CSV
 */
function generateCSV(gastos: any[]): string {
  const headers = [
    'ID',
    'Producto',
    'Categoría',
    'Proveedor',
    'Número Factura',
    'Cantidad',
    'Precio Unitario',
    'Total',
    'Fecha Compra',
    'Descripción',
    'Período',
    'Tipo',
    'Fecha Registro',
  ];

  const rows = gastos.map((g) => [
    g.gastoCompraId,
    g.producto?.nombre || 'N/A',
    g.producto?.categoria?.nombre || 'N/A',
    g.vendor?.nombre || 'N/A',
    g.numeroFactura || 'N/A',
    g.cantidad,
    g.precioUnitario,
    g.total,
    g.fechaCompra.toISOString(),
    g.descripcion || '',
    g.periodo || '',
    g.descripcion?.includes('Restock') ? 'Restock' : 'Regular',
    g.createdAt.toISOString(),
  ]);

  // Escapar campos que contienen comas o comillas
  const escapeCSV = (value: unknown): string => {
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  return [headers.join(','), ...rows.map((row) => row.map(escapeCSV).join(','))].join('\n');
}
