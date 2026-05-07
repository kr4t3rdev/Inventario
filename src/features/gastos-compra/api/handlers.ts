import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAuthGet } from "@/lib/auth-middleware"
import { z } from "zod"

export async function getGastosCompraHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const periodo = searchParams.get("periodo")
    const tipoOperacion = searchParams.get("tipoOperacion")
    const includeRestock = searchParams.get("includeRestock")

    const whereClause: any = {}

    if (periodo) {
      whereClause.periodo = periodo
    }

    if (tipoOperacion === 'restock') {
      whereClause.descripcion = { contains: 'Restock' }
    } else if (tipoOperacion === 'regular') {
      whereClause.descripcion = { not: { contains: 'Restock' } }
    }

    if (includeRestock === 'false') {
      whereClause.descripcion = { not: { contains: 'Restock' } }
    } else if (includeRestock === 'true') {
      whereClause.descripcion = { contains: 'Restock' }
    }

    const gastosCompra = await prisma.gastoCompra.findMany({
      where: whereClause,
      include: {
        producto: {
          include: {
            categoria: true,
            unidad: true,
          },
        },
        vendor: true,
      },
      orderBy: { createdAt: "desc" },
    })

    const gastosCompraWithMetadata = gastosCompra.map((gasto: { descripcion?: string | null }) => ({
      ...gasto,
      isRestock: gasto.descripcion?.includes('Restock') || false,
      tipoOperacion: gasto.descripcion?.includes('Restock') ? 'restock' : 'regular'
    }))

    return NextResponse.json(gastosCompraWithMetadata)
  } catch (error) {
    console.error("Error al obtener gastos de compra:", error)
    return NextResponse.json({ error: "Error al obtener gastos de compra" }, { status: 500 })
  }
}

const statsQuerySchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  fechaDesde: z.string().datetime().optional(),
  fechaHasta: z.string().datetime().optional(),
})

export const getGastoCompraStatsHandler = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const params = statsQuerySchema.parse({
      periodo: searchParams.get('periodo') || undefined,
      fechaDesde: searchParams.get('fechaDesde') || undefined,
      fechaHasta: searchParams.get('fechaHasta') || undefined,
    })

    const whereClause: Record<string, unknown> = {}

    if (params.periodo) {
      whereClause.periodo = params.periodo
    }

    if (params.fechaDesde || params.fechaHasta) {
      whereClause.fechaCompra = {}
      if (params.fechaDesde) {
        (whereClause.fechaCompra as Record<string, Date>).gte = new Date(params.fechaDesde)
      }
      if (params.fechaHasta) {
        (whereClause.fechaCompra as Record<string, Date>).lte = new Date(params.fechaHasta)
      }
    }

    const [
      totalStats,
      restockStats,
      regularStats,
      topProductos,
      topProveedores,
      porPeriodo,
      promedios,
    ] = await Promise.all([
      prisma.gastoCompra.aggregate({
        where: whereClause,
        _count: { gastoCompraId: true },
        _sum: { total: true, cantidad: true },
        _avg: { total: true, precioUnitario: true },
        _min: { total: true, fechaCompra: true },
        _max: { total: true, fechaCompra: true },
      }),
      prisma.gastoCompra.aggregate({
        where: { ...whereClause, descripcion: { contains: 'Restock' } },
        _count: { gastoCompraId: true },
        _sum: { total: true, cantidad: true },
      }),
      prisma.gastoCompra.aggregate({
        where: { ...whereClause, descripcion: { not: { contains: 'Restock' } } },
        _count: { gastoCompraId: true },
        _sum: { total: true, cantidad: true },
      }),
      prisma.gastoCompra.groupBy({
        by: ['productoId'],
        where: whereClause,
        _sum: { total: true, cantidad: true },
        _count: { gastoCompraId: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
      prisma.gastoCompra.groupBy({
        by: ['vendorId'],
        where: whereClause,
        _sum: { total: true },
        _count: { gastoCompraId: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
      prisma.gastoCompra.groupBy({
        by: ['periodo'],
        where: whereClause,
        _sum: { total: true },
        _count: { gastoCompraId: true },
        orderBy: { periodo: 'desc' },
        take: 12,
      }),
      prisma.gastoCompra.aggregate({
        where: whereClause,
        _avg: { total: true, cantidad: true, precioUnitario: true },
      }),
    ])

    const [productosTop, proveedoresTop] = await Promise.all([
      prisma.producto.findMany({
        where: { id: { in: topProductos.map((p: { productoId: string }) => p.productoId) } },
        select: { id: true, nombre: true },
      }),
      prisma.vendor.findMany({
        where: { vendorId: { in: topProveedores.map((v: { vendorId: string }) => v.vendorId) } },
        select: { vendorId: true, nombre: true },
      }),
    ])

    const topProductosConNombres = topProductos.map((p: { productoId: string }) => ({
      ...p,
      producto: productosTop.find((prod: { id: string }) => prod.id === p.productoId),
    }))

    const topProveedoresConNombres = topProveedores.map((v: { vendorId: string }) => ({
      ...v,
      proveedor: proveedoresTop.find((ven: { vendorId: string }) => ven.vendorId === v.vendorId),
    }))

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
    })
  } catch (error) {
    console.error('Error al obtener estadísticas de gastos de compra:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros de consulta inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al obtener estadísticas de gastos de compra' }, { status: 500 })
  }
})

const proveedorQuerySchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  fechaDesde: z.string().datetime().optional(),
  fechaHasta: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(50).default(10),
})

export const getGastoCompraStatsByProveedorHandler = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const params = proveedorQuerySchema.parse({
      periodo: searchParams.get('periodo') || undefined,
      fechaDesde: searchParams.get('fechaDesde') || undefined,
      fechaHasta: searchParams.get('fechaHasta') || undefined,
      limit: searchParams.get('limit') || '10',
    })

    const whereClause: Record<string, unknown> = {}
    if (params.periodo) whereClause.periodo = params.periodo
    if (params.fechaDesde || params.fechaHasta) {
      whereClause.fechaCompra = {}
      if (params.fechaDesde) (whereClause.fechaCompra as Record<string, Date>).gte = new Date(params.fechaDesde)
      if (params.fechaHasta) (whereClause.fechaCompra as Record<string, Date>).lte = new Date(params.fechaHasta)
    }

    const statsPorProveedor = await prisma.gastoCompra.groupBy({
      by: ['vendorId'],
      where: whereClause,
      _sum: { total: true, cantidad: true },
      _count: { gastoCompraId: true },
      _avg: { total: true, precioUnitario: true },
      orderBy: { _sum: { total: 'desc' } },
      take: params.limit,
    })

    const proveedores = await prisma.vendor.findMany({
      where: { vendorId: { in: statsPorProveedor.map((s: { vendorId: string }) => s.vendorId) } },
      select: { vendorId: true, nombre: true, contacto: true },
    })

    const resultado = statsPorProveedor.map((stat: { vendorId: string; _sum: { total: number | null; cantidad: number | null }; _count: { gastoCompraId: number }; _avg: { total: number | null; precioUnitario: number | null } }) => {
      const proveedor = proveedores.find((p: { vendorId: string }) => p.vendorId === stat.vendorId)
      return {
        proveedorId: stat.vendorId,
        proveedor,
        totalGastado: stat._sum.total || 0,
        cantidadCompras: stat._count.gastoCompraId,
        cantidadProductos: stat._sum.cantidad || 0,
        promedioGasto: stat._avg.total || 0,
        promedioPrecioUnitario: stat._avg.precioUnitario || 0,
      }
    })

    return NextResponse.json({ data: resultado, meta: { totalProveedores: resultado.length, filtros: { periodo: params.periodo, fechaDesde: params.fechaDesde, fechaHasta: params.fechaHasta } } })
  } catch (error) {
    console.error('Error al obtener estadísticas por proveedor:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros de consulta inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al obtener estadísticas por proveedor' }, { status: 500 })
  }
})

const periodoQuerySchema = z.object({
  year: z.coerce.number().min(2000).max(2100).optional(),
  limit: z.coerce.number().min(1).max(24).default(12),
})

export const getGastoCompraStatsByPeriodoHandler = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const params = periodoQuerySchema.parse({
      year: searchParams.get('year') || undefined,
      limit: searchParams.get('limit') || '12',
    })

    const whereClause: Record<string, unknown> = {}
    if (params.year) {
      whereClause.periodo = { startsWith: params.year.toString() }
    }

    const statsPorPeriodo = await prisma.gastoCompra.groupBy({
      by: ['periodo'],
      where: whereClause,
      _sum: { total: true, cantidad: true },
      _count: { gastoCompraId: true },
      _avg: { total: true },
      orderBy: { periodo: 'desc' },
      take: params.limit,
    })

    const totalGastos = statsPorPeriodo.reduce((acc: number, curr: { _sum: { total: number | null } }) => acc + (curr._sum.total || 0), 0)
    const promedioMensual = totalGastos / (statsPorPeriodo.length || 1)
    const periodosOrdenados = [...statsPorPeriodo].sort((a: { _sum: { total: number | null } }, b: { _sum: { total: number | null } }) => (b._sum.total || 0) - (a._sum.total || 0))
    const mejorPeriodo = periodosOrdenados[0]
    const peorPeriodo = periodosOrdenados[periodosOrdenados.length - 1]

    const resultado = statsPorPeriodo.map((stat: { periodo: string | null; _sum: { total: number | null; cantidad: number | null }; _count: { gastoCompraId: number }; _avg: { total: number | null } }) => {
      if (!stat.periodo) return null
      const [year, month] = stat.periodo.split('-')
      return {
        periodo: stat.periodo, year: parseInt(year), month: parseInt(month),
        mesNombre: new Date(parseInt(year), parseInt(month) - 1).toLocaleString('es-ES', { month: 'long' }),
        totalGastado: stat._sum.total || 0, cantidadCompras: stat._count.gastoCompraId,
        cantidadProductos: stat._sum.cantidad || 0, promedioGasto: stat._avg.total || 0,
      }
    })

    return NextResponse.json({
      data: resultado.filter((r): r is NonNullable<typeof r> => r !== null),
      resumen: { totalPeriodos: statsPorPeriodo.length, totalGastos, promedioMensual, mejorPeriodo: mejorPeriodo ? { periodo: mejorPeriodo.periodo, total: mejorPeriodo._sum.total || 0 } : null, peorPeriodo: peorPeriodo ? { periodo: peorPeriodo.periodo, total: peorPeriodo._sum.total || 0 } : null },
      meta: { filtros: { year: params.year, limit: params.limit } },
    })
  } catch (error) {
    console.error('Error al obtener estadísticas por período:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros de consulta inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al obtener estadísticas por período' }, { status: 500 })
  }
})

const productoQuerySchema = z.object({
  periodo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  fechaDesde: z.string().datetime().optional(),
  fechaHasta: z.string().datetime().optional(),
  limit: z.coerce.number().min(1).max(50).default(10),
})

export const getGastoCompraStatsByProductoHandler = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const params = productoQuerySchema.parse({
      periodo: searchParams.get('periodo') || undefined,
      fechaDesde: searchParams.get('fechaDesde') || undefined,
      fechaHasta: searchParams.get('fechaHasta') || undefined,
      limit: searchParams.get('limit') || '10',
    })

    const whereClause: Record<string, unknown> = {}
    if (params.periodo) whereClause.periodo = params.periodo
    if (params.fechaDesde || params.fechaHasta) {
      whereClause.fechaCompra = {}
      if (params.fechaDesde) (whereClause.fechaCompra as Record<string, Date>).gte = new Date(params.fechaDesde)
      if (params.fechaHasta) (whereClause.fechaCompra as Record<string, Date>).lte = new Date(params.fechaHasta)
    }

    const statsPorProducto = await prisma.gastoCompra.groupBy({
      by: ['productoId'],
      where: whereClause,
      _sum: { total: true, cantidad: true },
      _count: { gastoCompraId: true },
      _avg: { total: true, precioUnitario: true },
      orderBy: { _sum: { total: 'desc' } },
      take: params.limit,
    })

    const productos = await prisma.producto.findMany({
      where: { id: { in: statsPorProducto.map((s: { productoId: string }) => s.productoId) } },
      select: { id: true, nombre: true, categoria: { select: { nombre: true } }, unidad: { select: { simbolo: true } } },
    })

    const resultado = statsPorProducto.map((stat: { productoId: string; _sum: { total: number | null; cantidad: number | null }; _count: { gastoCompraId: number }; _avg: { total: number | null; precioUnitario: number | null } }) => {
      const producto = productos.find((p: { id: string }) => p.id === stat.productoId)
      return { productoId: stat.productoId, producto, totalGastado: stat._sum.total || 0, cantidadCompras: stat._count.gastoCompraId, cantidadProductos: stat._sum.cantidad || 0, promedioGasto: stat._avg.total || 0, promedioPrecioUnitario: stat._avg.precioUnitario || 0 }
    })

    return NextResponse.json({ data: resultado, meta: { totalProductos: resultado.length, filtros: { periodo: params.periodo, fechaDesde: params.fechaDesde, fechaHasta: params.fechaHasta } } })
  } catch (error) {
    console.error('Error al obtener estadísticas por producto:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros de consulta inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al obtener estadísticas por producto' }, { status: 500 })
  }
})

const exportQuerySchema = z.object({
  format: z.enum(['csv', 'excel', 'pdf']).default('csv'),
  periodo: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  productoId: z.string().optional(),
  proveedorId: z.string().optional(),
  fechaDesde: z.string().datetime().optional(),
  fechaHasta: z.string().datetime().optional(),
  tipoOperacion: z.enum(['restock', 'regular']).optional(),
})

function generateCSV(gastos: any[]): string {
  const headers = ['ID', 'Producto', 'Categoría', 'Proveedor', 'Número Factura', 'Cantidad', 'Precio Unitario', 'Total', 'Fecha Compra', 'Descripción', 'Período', 'Tipo', 'Fecha Registro']
  const escapeCSV = (value: unknown): string => {
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`
    return str
  }
  const rows = gastos.map((g) => [
    g.gastoCompraId, g.producto?.nombre || 'N/A', g.producto?.categoria?.nombre || 'N/A',
    g.vendor?.nombre || 'N/A', g.numeroFactura || 'N/A', g.cantidad, g.precioUnitario, g.total,
    g.fechaCompra.toISOString(), g.descripcion || '', g.periodo || '',
    g.descripcion?.includes('Restock') ? 'Restock' : 'Regular', g.createdAt.toISOString(),
  ])
  return [headers.join(','), ...rows.map((row) => row.map(escapeCSV).join(','))].join('\n')
}

export const exportGastosCompraHandler = withAuthGet(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const params = exportQuerySchema.parse({
      format: searchParams.get('format') || 'csv',
      periodo: searchParams.get('periodo') || undefined,
      productoId: searchParams.get('productoId') || undefined,
      proveedorId: searchParams.get('proveedorId') || undefined,
      fechaDesde: searchParams.get('fechaDesde') || undefined,
      fechaHasta: searchParams.get('fechaHasta') || undefined,
      tipoOperacion: searchParams.get('tipoOperacion') || undefined,
    })

    const whereClause: Record<string, unknown> = {}
    if (params.periodo) whereClause.periodo = params.periodo
    if (params.productoId) whereClause.productoId = params.productoId
    if (params.proveedorId) whereClause.proveedorId = params.proveedorId
    if (params.fechaDesde || params.fechaHasta) {
      whereClause.fechaCompra = {}
      if (params.fechaDesde) (whereClause.fechaCompra as Record<string, Date>).gte = new Date(params.fechaDesde)
      if (params.fechaHasta) (whereClause.fechaCompra as Record<string, Date>).lte = new Date(params.fechaHasta)
    }
    if (params.tipoOperacion === 'restock') whereClause.descripcion = { contains: 'Restock' }
    else if (params.tipoOperacion === 'regular') whereClause.descripcion = { not: { contains: 'Restock' } }

    const gastosCompra = await prisma.gastoCompra.findMany({
      where: whereClause,
      include: { producto: { select: { nombre: true, categoria: { select: { nombre: true } } } }, vendor: { select: { nombre: true, contacto: true } } },
      orderBy: { fechaCompra: 'desc' },
    })

    if (params.format === 'csv') {
      const csv = generateCSV(gastosCompra)
      return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="gastos-compra-${new Date().toISOString().split('T')[0]}.csv"` } })
    }
    if (params.format === 'excel') {
      const csv = generateCSV(gastosCompra)
      return new NextResponse(csv, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="gastos-compra-${new Date().toISOString().split('T')[0]}.xlsx"` } })
    }
    if (params.format === 'pdf') {
      return NextResponse.json({
        titulo: 'Reporte de Gastos de Compra', fechaGeneracion: new Date().toISOString(), filtros: { periodo: params.periodo, productoId: params.productoId, proveedorId: params.proveedorId, fechaDesde: params.fechaDesde, fechaHasta: params.fechaHasta, tipoOperacion: params.tipoOperacion },
        resumen: { totalRegistros: gastosCompra.length, montoTotal: gastosCompra.reduce((acc: number, g: { total: number }) => acc + g.total, 0), cantidadTotal: gastosCompra.reduce((acc: number, g: { cantidad: number }) => acc + g.cantidad, 0) },
        data: gastosCompra.map((g: any) => ({
          id: g.gastoCompraId, producto: g.producto?.nombre || 'N/A', categoria: g.producto?.categoria?.nombre || 'N/A',
          proveedor: g.vendor?.nombre || 'N/A', numeroFactura: g.numeroFactura || 'N/A', cantidad: g.cantidad,
          precioUnitario: g.precioUnitario, total: g.total, fechaCompra: g.fechaCompra.toISOString(),
          descripcion: g.descripcion || '', periodo: g.periodo || '', tipo: g.descripcion?.includes('Restock') ? 'Restock' : 'Regular', fechaRegistro: g.createdAt.toISOString(),
        })),
      })
    }
    return NextResponse.json({ error: 'Formato no soportado' }, { status: 400 })
  } catch (error) {
    console.error('Error al exportar gastos de compra:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Parámetros de consulta inválidos', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error al exportar gastos de compra' }, { status: 500 })
  }
})
