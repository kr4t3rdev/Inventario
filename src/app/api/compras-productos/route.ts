import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'

/**
 * @description Valida el contrato del proveedor antes de realizar una compra
 * @param {string} vendorId - ID del proveedor
 * @returns {Promise<{esValido: boolean, mensaje?: string, detalles?: any}>} Resultado de la validación
 */
async function validarContratoProveedor(vendorId: string): Promise<{
  esValido: boolean
  mensaje?: string
  detalles?: any
  advertencia?: string
}> {
  // Obtener configuración de días de alerta
  const config = await prisma.configuracionSistema.findFirst()
  const diasAvisoVencimiento = config?.diasAvisoVencimientoContrato ?? 30

  // Buscar contrato activo del proveedor
  const contrato = await prisma.contrato.findFirst({
    where: {
      vendorId: vendorId,
      estado: 'ACTIVO'
    },
    orderBy: {
      fechaFin: 'desc'
    }
  })

  if (!contrato) {
    return {
      esValido: false,
      mensaje: 'El proveedor no tiene un contrato activo',
      detalles: {
        tieneContrato: false,
        estado: null
      }
    }
  }

  // Si tiene fecha de fin, verificar si está vencido o próximo a vencer
  if (contrato.fechaFin) {
    const hoy = new Date()
    const fechaFin = new Date(contrato.fechaFin)
    const diferenciaTiempo = fechaFin.getTime() - hoy.getTime()
    const diferenciaDias = Math.ceil(diferenciaTiempo / (1000 * 3600 * 24))

    if (diferenciaDias < 0) {
      return {
        esValido: false,
        mensaje: 'El contrato del proveedor está vencido',
        detalles: {
          tieneContrato: true,
          estado: 'VENCIDO',
          fechaVencimiento: contrato.fechaFin,
          diasVencido: Math.abs(diferenciaDias)
        }
      }
    }

    if (diferenciaDias <= diasAvisoVencimiento) {
      return {
        esValido: true,
        advertencia: `Advertencia: El contrato del proveedor vence en ${diferenciaDias} días (${contrato.fechaFin.toISOString().split('T')[0]})`,
        detalles: {
          tieneContrato: true,
          estado: 'PROXIMO_VENCIMIENTO',
          fechaVencimiento: contrato.fechaFin,
          diasRestantes: diferenciaDias,
          diasAlerta: diasAvisoVencimiento
        }
      }
    }
  }

  return {
    esValido: true,
    detalles: {
      tieneContrato: true,
      estado: 'ACTIVO',
      fechaVencimiento: contrato.fechaFin
    }
  }
}

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
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

const createSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio'),
  descripcion: z.string().optional(),
  categoriaId: z.string().min(1, 'Seleccione una categoría'),
  subcategoriaId: z.string().optional(),
  precioCosto: z.coerce.number().positive('El precio de costo debe ser mayor a 0'),
  precioVenta: z.coerce.number().positive('El precio de venta debe ser mayor a 0'),
  stock: z.coerce.number().int('La cantidad debe ser un entero').positive('La cantidad debe ser mayor a 0'),
  stockMinimo: z.coerce.number().int().min(0).optional(),
  fotos: z.array(z.string()).optional(),
  unidadId: z.string().min(1, 'Seleccione una unidad'),
  vendorId: z.string().min(1, 'Seleccione un proveedor'),
  almacenId: z.string().min(1, 'Seleccione un almacén'),
  numeroFactura: z.string().optional().default(''),
  facturaUrl: z.string().optional().default(''),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO']),
  estado: z.enum(['PENDIENTE', 'PAGADA']),
  descripcionCompra: z.string().max(500).optional(),
  fechaVencimiento: z.string().optional(),
}).refine(
  (data) => {
    if (data.formaPago === 'PAGO_COMPLETO') {
      return data.estado === 'PAGADA'
    }
    return data.estado === 'PENDIENTE'
  },
  {
    message: 'Estado no coincide con la forma de pago',
    path: ['estado'],
  }
).refine(
  (data) => data.precioVenta >= data.precioCosto * 1.1,
  {
    message: 'El precio de venta debe tener al menos un 10% de margen sobre el costo',
    path: ['precioVenta'],
  }
)

/**
 * @description Obtener compras de productos con filtros básicos.
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Lista de compras de productos
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
      page: searchParams.get('page') || undefined,
      limit: searchParams.get('limit') || undefined,
    })

    const whereClause: Record<string, any> = {
      deletedAt: null, // Exclude soft-deleted records by default
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

    const page = params.page
    const limit = params.limit
    const skip = (page - 1) * limit

    const [compras, total] = await Promise.all([
      prisma.compraProducto.findMany({
        where: whereClause,
        include: {
          producto: { select: { id: true, nombre: true } },
          proveedor: { select: { vendorId: true, nombre: true } },
        },
        orderBy: { fechaCompra: 'desc' },
        skip,
        take: limit,
      }),
      prisma.compraProducto.count({ where: whereClause }),
    ])

    return NextResponse.json({
      compras,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    })
  } catch (error) {
    console.error('Error al obtener compras de productos:', error)
    return NextResponse.json({ error: 'Error al obtener compras de productos' }, { status: 500 })
  }
})

/**
 * @description Crear una compra de producto y registrar el stock inicial.
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Compra creada
 */
export const POST = withAuthPost(async (request: NextRequest, _context: any, user: any) => {
  try {
    const body = await request.json()
    const data = createSchema.parse(body)

    if (data.subcategoriaId && data.categoriaId) {
      const subcategoria = await prisma.categoria.findUnique({
        where: { catId: data.subcategoriaId },
        select: { parentId: true }
      })

      if (!subcategoria || subcategoria.parentId !== data.categoriaId) {
        return NextResponse.json({
          error: 'La subcategoría debe pertenecer a la categoría seleccionada'
        }, { status: 400 })
      }
    }

    // Validación del contrato del proveedor
    const contratoValidacion = await validarContratoProveedor(data.vendorId)
    if (!contratoValidacion.esValido) {
      return NextResponse.json({
        error: contratoValidacion.mensaje,
        contrato: contratoValidacion.detalles
      }, { status: 400 })
    }

    // Verificar factura duplicada (solo si se proporciona número de factura)
    if (data.numeroFactura && data.numeroFactura.trim() !== '') {
      const existingCompra = await prisma.compraProducto.findFirst({
        where: {
          numeroFactura: data.numeroFactura.trim(),
          proveedorId: data.vendorId,
        },
      })

      if (existingCompra) {
        return NextResponse.json({
          error: 'Ya existe una compra con este número de factura para el mismo proveedor',
          compraExistente: existingCompra.compraProductoId,
        }, { status: 409 })
      }
    }

    const resolvedEstado = data.formaPago === 'PAGO_COMPLETO' ? 'PAGADA' : 'PENDIENTE'

    const result = await prisma.$transaction(async (tx: any) => {
      const producto = await tx.producto.create({
        data: {
          nombre: data.nombre,
          descripcion: data.descripcion,
          precioCosto: data.precioCosto,
          precioVenta: data.precioVenta,
          stock: data.stock,
          stockMinimo: data.stockMinimo ?? 0,
          fotos: data.fotos ?? [],
          categoriaId: data.categoriaId,
          subcategoriaId: data.subcategoriaId || null,
          unidadId: data.unidadId,
          vendorId: data.vendorId,
          almacenId: data.almacenId,
        },
        include: {
          vendor: true
        }
      })

      const totalCost = data.stock * data.precioCosto
      if (totalCost <= 0 || !Number.isFinite(totalCost)) {
        throw new Error('Invalid total cost')
      }

      const now = new Date()
      const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const descripcionCompra = data.descripcionCompra || `Compra - ${producto.nombre}`

      let gastoCompra = null
      let cuentaPorPagar = null

      if (data.formaPago === 'PAGO_COMPLETO') {
        gastoCompra = await tx.gastoCompra.create({
          data: {
            productoId: producto.id,
            vendorId: producto.vendorId,
            numeroFactura: data.numeroFactura,
            cantidad: data.stock,
            precioUnitario: data.precioCosto,
            total: totalCost,
            fechaCompra: now,
            descripcion: descripcionCompra,
            periodo: periodo,
          },
          include: {
            producto: true,
            vendor: true
          }
        })
      } else {
        // Para pago parcial, crear primero el gastoCompra
        gastoCompra = await tx.gastoCompra.create({
          data: {
            productoId: producto.id,
            vendorId: producto.vendorId,
            numeroFactura: data.numeroFactura,
            cantidad: data.stock,
            precioUnitario: data.precioCosto,
            total: totalCost,
            fechaCompra: now,
            descripcion: descripcionCompra,
            periodo: periodo,
          },
          include: {
            producto: true,
            vendor: true
          }
        })

        // Luego crear la cuenta por pagar vinculada al gastoCompra
        cuentaPorPagar = await tx.cuentaPorPagar.create({
          data: {
            numeroFactura: data.numeroFactura,
            tipo: 'compra',
            gastoCompraId: gastoCompra.gastoCompraId,
            proveedorId: producto.vendorId,
            proveedorNombre: producto.vendor?.nombre,
            montoDeuda: totalCost,
            saldoPendiente: totalCost,
            estado: 'PENDIENTE',
            fechaEmision: now,
            ...(data.fechaVencimiento ? { fechaVencimiento: new Date(data.fechaVencimiento) } : {})
          }
        })
      }

      const compraProducto = await tx.compraProducto.create({
        data: {
          productoId: producto.id,
          proveedorId: producto.vendorId,
          numeroFactura: data.numeroFactura,
          facturaUrl: data.facturaUrl,
          cantidad: data.stock,
          precioUnitario: data.precioCosto,
          total: totalCost,
          formaPago: data.formaPago,
          estado: resolvedEstado,
          tipoOperacion: 'REGULAR',
          descripcion: descripcionCompra,
          fechaCompra: now,
          gastoCompraId: gastoCompra?.gastoCompraId,
          cuentaPorPagarId: cuentaPorPagar?.cuentaPorPagarId,
          createdById: user.userId || user.id,
        },
        include: {
          producto: true,
          proveedor: true
        }
      })

      return {
        producto,
        compraProducto,
        gastoCompra,
        cuentaPorPagar
      }
    })

    const response: any = {
      ...result,
      success: true
    }

    // Incluir advertencia si existe
    if (contratoValidacion.advertencia) {
      response.advertencia = contratoValidacion.advertencia
      response.contrato = contratoValidacion.detalles
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error al crear compra de producto:', error)
    return NextResponse.json({ error: 'Error al crear compra de producto' }, { status: 500 })
  }
})
