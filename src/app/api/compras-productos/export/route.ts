import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { withAuthGet } from '@/lib/auth-middleware'

const querySchema = z.object({
  search: z.string().optional(),
  tipoOperacion: z.enum(['RESTOCK', 'REGULAR']).optional(),
  estado: z.enum(['PENDIENTE', 'PAGADA']).optional(),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO']).optional(),
  proveedorId: z.string().optional(),
  fechaDesde: z.string().optional(),
  fechaHasta: z.string().optional(),
  montoMin: z.coerce.number().optional(),
  montoMax: z.coerce.number().optional(),
  format: z.enum(['csv', 'json']).optional().default('json'),
})

/**
 * @description Exportar compras de productos a CSV o JSON
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Archivo exportado
 */
export const GET = withAuthGet(async (request: NextRequest, _context: any, _user: any) => {
  try {
    const { searchParams } = new URL(request.url)
    const params = querySchema.parse({
      search: searchParams.get('search') || undefined,
      tipoOperacion: searchParams.get('tipoOperacion') || undefined,
      estado: searchParams.get('estado') || undefined,
      formaPago: searchParams.get('formaPago') || undefined,
      proveedorId: searchParams.get('proveedorId') || undefined,
      fechaDesde: searchParams.get('fechaDesde') || undefined,
      fechaHasta: searchParams.get('fechaHasta') || undefined,
      montoMin: searchParams.get('montoMin') || undefined,
      montoMax: searchParams.get('montoMax') || undefined,
      format: searchParams.get('format') || undefined,
    })

    const whereClause: Record<string, any> = {
      deletedAt: null,
    }

    if (params.tipoOperacion) {
      whereClause.tipoOperacion = params.tipoOperacion
    }

    if (params.estado) {
      whereClause.estado = params.estado
    }

    if (params.formaPago) {
      whereClause.formaPago = params.formaPago
    }

    if (params.proveedorId) {
      whereClause.proveedorId = params.proveedorId
    }

    if (params.fechaDesde || params.fechaHasta) {
      whereClause.fechaCompra = {}
      if (params.fechaDesde) {
        whereClause.fechaCompra.gte = new Date(params.fechaDesde)
      }
      if (params.fechaHasta) {
        whereClause.fechaCompra.lte = new Date(params.fechaHasta)
      }
    }

    if (params.montoMin !== undefined || params.montoMax !== undefined) {
      whereClause.total = {}
      if (params.montoMin !== undefined) {
        whereClause.total.gte = params.montoMin
      }
      if (params.montoMax !== undefined) {
        whereClause.total.lte = params.montoMax
      }
    }

    if (params.search) {
      whereClause.OR = [
        { numeroFactura: { contains: params.search, mode: 'insensitive' } },
        { producto: { nombre: { contains: params.search, mode: 'insensitive' } } },
        { proveedor: { nombre: { contains: params.search, mode: 'insensitive' } } },
      ]
    }

    const compras = await prisma.compraProducto.findMany({
      where: whereClause,
      include: {
        producto: {
          select: {
            id: true,
            nombre: true,
            precioCosto: true,
            precioVenta: true,
          },
        },
        proveedor: {
          select: {
            vendorId: true,
            nombre: true,
          },
        },
        createdBy: {
          select: {
            userId: true,
            name: true,
          },
        },
      },
      orderBy: { fechaCompra: 'desc' },
    })

    // Transformar datos para exportación
    const data = compras.map((compra: any) => ({
      id: compra.compraProductoId,
      fecha: compra.fechaCompra.toISOString().split('T')[0],
      tipoOperacion: compra.tipoOperacion,
      producto: compra.producto?.nombre || 'N/A',
      proveedor: compra.proveedor?.nombre || 'N/A',
      numeroFactura: compra.numeroFactura || 'N/A',
      cantidad: compra.cantidad,
      precioUnitario: compra.precioUnitario,
      total: compra.total,
      formaPago: compra.formaPago,
      estado: compra.estado,
      margen: compra.producto ? ((compra.producto.precioVenta - compra.producto.precioCosto) / compra.producto.precioCosto * 100).toFixed(2) + '%' : 'N/A',
      creadoPor: compra.createdBy?.name || 'N/A',
      descripcion: compra.descripcion || '',
    }))

    if (params.format === 'csv') {
      // Generar CSV
      const headers = [
        'ID',
        'Fecha',
        'Tipo',
        'Producto',
        'Proveedor',
        'Nro Factura',
        'Cantidad',
        'Precio Unitario',
        'Total',
        'Forma Pago',
        'Estado',
        'Margen',
        'Creado Por',
        'Descripción',
      ]

      const csvRows = [
        headers.join(','),
        ...data.map((row: any) => [
          row.id,
          row.fecha,
          row.tipoOperacion,
          `"${row.producto}"`,
          `"${row.proveedor}"`,
          row.numeroFactura,
          row.cantidad,
          row.precioUnitario,
          row.total,
          row.formaPago,
          row.estado,
          row.margen,
          `"${row.creadoPor}"`,
          `"${row.descripcion}"`,
        ].join(',')),
      ]

      const csv = csvRows.join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="compras_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // Retornar JSON
    return NextResponse.json({
      compras: data,
      total: data.length,
      exportDate: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error al exportar compras:', error)
    return NextResponse.json({ error: 'Error al exportar compras' }, { status: 500 })
  }
})
