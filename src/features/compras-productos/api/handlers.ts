import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireTenant } from '@/lib/services/tenant-scope'
import { calcularPrecioCostoCompra } from '@/lib/inventory-cost-utils'
import { applyPagoGastoWorkflow } from '@/lib/services/pago-gastos-workflow'
import { applyAnticipoAllocations, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'
import { FORMA_PAGO_ANTICIPO_PAGO } from '@/lib/constants/anticipos'
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service'
import { hasUnrevertedAnticipoExecution } from '@/lib/services/anticipos-guards'
import type { AuthenticatedUser } from '@/lib/auth-middleware'

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

const itemSchema = z.object({
  productoId: z.string().min(1, 'Seleccione un producto'),
  precioCosto: z.coerce.number().positive('El precio de costo debe ser mayor a 0'),
  cantidad: z.coerce.number().int('La cantidad debe ser un entero').positive('La cantidad debe ser mayor a 0'),
})

const createSchema = z.object({
  proveedorId: z.string().min(1, 'Seleccione un proveedor'),
  numeroFactura: z.string().optional().default(''),
  facturaUrl: z.string().optional().default(''),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO', FORMA_PAGO_ANTICIPO_PAGO]),
  estado: z.enum(['PENDIENTE', 'PAGADA']),
  descripcionCompra: z.string().max(500).optional(),
  fechaVencimiento: z.string().optional(),
  anticipoPagoId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Debe incluir al menos un producto'),
}).refine(
  (data) => {
    if (data.formaPago === 'PAGO_COMPLETO' || data.formaPago === FORMA_PAGO_ANTICIPO_PAGO) {
      return data.estado === 'PAGADA'
    }
    return data.estado === 'PENDIENTE'
  },
  {
    message: 'Estado no coincide con la forma de pago',
    path: ['estado'],
  }
).refine(
  (data) => (data.formaPago === FORMA_PAGO_ANTICIPO_PAGO ? !!data.anticipoPagoId : true),
  {
    message: `Debe indicar un anticipo para forma de pago ${FORMA_PAGO_ANTICIPO_PAGO}`,
    path: ['anticipoPagoId'],
  }
).refine(
  (data) => (data.formaPago === FORMA_PAGO_ANTICIPO_PAGO ? !!data.idempotencyKey : true),
  {
    message: 'Debe indicar idempotencyKey para ejecutar anticipo',
    path: ['idempotencyKey'],
  }
)

const updateSchema = z.object({
  numeroFactura: z.string().optional(),
  facturaUrl: z.string().optional(),
  descripcion: z.string().max(500).optional(),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO']).optional(),
  estado: z.enum(['PENDIENTE', 'PAGADA']).optional(),
}).refine(
  (data) => {
    if (data.formaPago === 'PAGO_COMPLETO' && data.estado) {
      return data.estado === 'PAGADA'
    }
    if (data.formaPago === 'PAGO_PARCIAL' && data.estado) {
      return data.estado === 'PENDIENTE'
    }
    return true
  },
  {
    message: 'Estado no coincide con la forma de pago',
    path: ['estado'],
  }
)

const exportQuerySchema = z.object({
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
 * @description Obtener compras de productos con filtros básicos.
 * Retorna cabeceras (CompraDocumento) con sus items.
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Lista de compras de productos
 */
export async function getComprasProductosHandler(request: NextRequest, _context: any, user: AuthenticatedUser) {
  try {
    const tenantId = requireTenant(user);
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

    const whereClause: Record<string, any> = { tenantId, deletedAt: null }

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
        { items: { some: { producto: { nombre: { contains: params.search, mode: 'insensitive' } } } } },
        { proveedor: { nombre: { contains: params.search, mode: 'insensitive' } } },
      ]
    }

    const page = params.page
    const limit = params.limit
    const skip = (page - 1) * limit

    const [compras, total] = await Promise.all([
      prisma.compraDocumento.findMany({
        where: whereClause,
        include: {
          proveedor: { select: { vendorId: true, nombre: true } },
          items: {
            include: {
              producto: { select: { id: true, nombre: true } },
            },
          },
        },
        orderBy: { fechaCompra: 'desc' },
        skip,
        take: limit,
      }),
      prisma.compraDocumento.count({ where: whereClause }),
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
}

/**
 * @description Crear una compra múltiple de productos.
 * Crea una cabecera (CompraDocumento) con N items (CompraDocumentoItem).
 * Actualiza stock y costo ponderado por cada item.
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Compra creada con cabecera y detalle
 */
export async function createCompraProductoHandler(request: NextRequest, _context: any, user: any) {
  try {
    const body = await request.json()
    const data = createSchema.parse(body)

    // Verificar factura duplicada (solo si se proporciona número de factura)
    if (data.numeroFactura && data.numeroFactura.trim() !== '') {
      const existingCompra = await prisma.compraDocumento.findFirst({
        where: {
          numeroFactura: data.numeroFactura.trim(),
          proveedorId: data.proveedorId,
          deletedAt: null,
        },
      })

      if (existingCompra) {
        return NextResponse.json({
          error: 'Ya existe una compra con este número de factura para el mismo proveedor',
          compraExistente: existingCompra.compraDocumentoId,
        }, { status: 409 })
      }
    }

    const resolvedEstado =
      data.formaPago === 'PAGO_COMPLETO' || data.formaPago === FORMA_PAGO_ANTICIPO_PAGO
        ? 'PAGADA'
        : 'PENDIENTE'

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Validar todos los productos ANTES de crear nada
      const productosValidados: Array<{
        producto: any
        stockAntes: number
        precioCostoAntes: number
        precioCostoNuevo: number
        metodoCosto: string
        stockDespues: number
        item: z.infer<typeof itemSchema>
      }> = []

      for (const item of data.items) {
        const producto = await tx.producto.findUnique({
          where: { id: item.productoId },
          include: { vendor: true },
        })

        if (!producto) {
          throw new Error(`PRODUCTO_NOT_FOUND:${item.productoId}`)
        }

        if (producto.vendorId && producto.vendorId !== data.proveedorId) {
          throw new Error(`PRODUCT_VENDOR_MISMATCH:${item.productoId}`)
        }

        const stockAntes = producto.stock
        const precioCostoAntes = producto.precioCosto
        const { precioCostoNuevo, metodoCosto } = calcularPrecioCostoCompra({
          stockAntes,
          precioCostoActual: precioCostoAntes,
          cantidadCompra: item.cantidad,
          costoUnitario: item.precioCosto,
        })

        productosValidados.push({
          producto,
          stockAntes,
          precioCostoAntes,
          precioCostoNuevo,
          metodoCosto,
          stockDespues: stockAntes + item.cantidad,
          item,
        })
      }

      // 2. Calcular total general
      const totalGeneral = productosValidados.reduce(
        (sum, pv) => sum + pv.item.cantidad * pv.item.precioCosto,
        0
      )

      if (totalGeneral <= 0 || !Number.isFinite(totalGeneral)) {
        throw new Error('INVALID_TOTAL_COST')
      }

      // 3. Crear GastoCompra (uno solo para toda la compra)
      const now = new Date()
      const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const descripcionCompra = data.descripcionCompra || `Compra múltiple - ${data.items.length} productos`

      const gastoCompra = await tx.gastoCompra.create({
        data: {
          productoId: productosValidados[0].producto.id,
          vendorId: data.proveedorId,
          numeroFactura: data.numeroFactura,
          cantidad: data.items.reduce((sum, item) => sum + item.cantidad, 0),
          precioUnitario: Math.round(totalGeneral / data.items.reduce((sum, item) => sum + item.cantidad, 0)),
          total: totalGeneral,
          fechaCompra: now,
          descripcion: descripcionCompra,
          periodo,
        },
        include: { producto: true, vendor: true },
      })

      // 4. Crear CuentaPorPagar si es pago parcial
      let cuentaPorPagar = null
      if (data.formaPago === 'PAGO_PARCIAL') {
        cuentaPorPagar = await tx.cuentaPorPagar.create({
          data: {
            numeroFactura: data.numeroFactura,
            tipo: 'compra',
            gastoCompraId: gastoCompra.gastoCompraId,
            proveedorId: data.proveedorId,
            proveedorNombre: gastoCompra.vendor?.nombre,
            montoDeuda: totalGeneral,
            saldoPendiente: totalGeneral,
            estado: 'PENDIENTE',
            fechaEmision: now,
            ...(data.fechaVencimiento ? { fechaVencimiento: new Date(data.fechaVencimiento) } : {}),
          },
        })
      }

      // 5. Crear cabecera (CompraDocumento)
      const compraDocumento = await tx.compraDocumento.create({
        data: {
          proveedorId: data.proveedorId,
          numeroFactura: data.numeroFactura,
          facturaUrl: data.facturaUrl,
          formaPago: data.formaPago,
          estado: resolvedEstado,
          tipoOperacion: 'REGULAR',
          descripcion: descripcionCompra,
          fechaCompra: now,
          total: totalGeneral,
          gastoCompraId: gastoCompra.gastoCompraId,
          cuentaPorPagarId: cuentaPorPagar?.cuentaPorPagarId,
          updatedById: user.userId || user.id,
        },
      })

      // 6. Crear items y actualizar stock/costo por cada producto
      const itemsCreados: any[] = []
      const costHistoryEntries: any[] = []

      for (const pv of productosValidados) {
        // Actualizar stock y costo ponderado del producto
        await tx.producto.update({
          where: { id: pv.producto.id },
          data: {
            precioCosto: pv.precioCostoNuevo,
            stock: { increment: pv.item.cantidad },
          },
        })

        // Actualizar StockUbicacion
        await upsertStockUbicacion(tx, {
          productoId: pv.producto.id,
          tipoUbicacion: 'almacen',
          ubicacionId: pv.producto.almacenId,
          modo: 'increment',
          delta: pv.item.cantidad,
        })

        // Crear línea de detalle
        const totalLinea = pv.item.cantidad * pv.item.precioCosto
        const itemCreado = await tx.compraDocumentoItem.create({
          data: {
            compraDocumentoId: compraDocumento.compraDocumentoId,
            productoId: pv.producto.id,
            cantidad: pv.item.cantidad,
            precioUnitario: pv.item.precioCosto,
            totalLinea,
          },
        })

        itemsCreados.push({
          ...itemCreado,
          producto: pv.producto,
          stockAntes: pv.stockAntes,
          stockDespues: pv.stockDespues,
          precioCostoAntes: pv.precioCostoAntes,
          precioCostoDespues: pv.precioCostoNuevo,
          metodoCosto: pv.metodoCosto,
        })

        // Registrar cambio de costo si aplica
        if (pv.precioCostoAntes !== pv.precioCostoNuevo) {
          costHistoryEntries.push({
            productoId: pv.producto.id,
            oldPrecioCosto: pv.precioCostoAntes,
            newPrecioCosto: pv.precioCostoNuevo,
            oldPrecioVenta: pv.producto.precioVenta,
            newPrecioVenta: pv.producto.precioVenta,
            reason: 'RESTOCK',
            changedBy: user?.id || user?.userId || 'system',
            changedAt: now,
            notes: `Restock: ${pv.item.cantidad} unidades a ${pv.item.precioCosto} c/u. Método: ${pv.metodoCosto}`,
          })
        }
      }

      // 7. Registrar historial de costos (batch)
      for (const entry of costHistoryEntries) {
        try {
          await tx.productoCostHistory.create({ data: entry })
        } catch (historyError) {
          console.error('Error recording cost history for restock:', historyError)
        }
      }

      // 8. Ejecutar anticipo si aplica
      let ejecucionAnticipo: any = null
      if (data.formaPago === FORMA_PAGO_ANTICIPO_PAGO && data.anticipoPagoId && data.idempotencyKey) {
        const allocResult = await applyAnticipoAllocations(
          tx,
          [{ anticipoId: data.anticipoPagoId, montoAplicado: totalGeneral }],
          {
            documentoDestinoId: compraDocumento.compraDocumentoId,
            contexto: 'COMPRA_PRODUCTO',
            usuarioId: user.userId || user.id,
            idempotencyKey: data.idempotencyKey,
            observaciones: `Anticipo aplicado a compra múltiple ${compraDocumento.compraDocumentoId}`,
          }
        )

        await applyPagoGastoWorkflow(tx, {
          tipoGasto: 'compra',
          referenciaId: gastoCompra.gastoCompraId,
          reconciliadoPor: user.userId || user.id,
          descripcion: `Pago anticipado de compra múltiple ${compraDocumento.compraDocumentoId}`,
          monto: totalGeneral,
          moneda: 'CUP',
          estado: 'PAGADA',
          gastoCompraId: gastoCompra.gastoCompraId,
        })

        ejecucionAnticipo = allocResult[0] ?? null
      }

      return {
        compraDocumento,
        items: itemsCreados,
        gastoCompra,
        cuentaPorPagar,
        ejecucionAnticipo,
      }
    })

    return NextResponse.json({ ...result, success: true }, { status: 201 })
  } catch (error) {
    console.error('Error al crear compra de producto:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        code: 'VALIDATION_ERROR',
        message: 'Error de validación en la compra de producto',
        error: 'Error de validación en la compra de producto',
        details: error.flatten(),
      }, { status: 400 })
    }
    if (isAnticipoWorkflowError(error)) {
      return NextResponse.json({
        code: error.code,
        message: error.message,
        error: error.message,
      }, { status: error.status })
    }
    if (error instanceof Error && error.message.startsWith('PRODUCTO_NOT_FOUND')) {
      const productoId = error.message.split(':')[1]
      return NextResponse.json({
        code: 'PRODUCT_NOT_FOUND',
        message: `El producto ${productoId} no existe`,
        error: `El producto ${productoId} no existe`,
      }, { status: 404 })
    }
    if (error instanceof Error && error.message.startsWith('PRODUCT_VENDOR_MISMATCH')) {
      const productoId = error.message.split(':')[1]
      return NextResponse.json({
        code: 'PRODUCT_VENDOR_MISMATCH',
        message: `El producto ${productoId} no pertenece al proveedor seleccionado`,
        error: `El producto ${productoId} no pertenece al proveedor seleccionado`,
      }, { status: 422 })
    }
    return NextResponse.json({
      code: 'UNEXPECTED_ERROR',
      message: 'Error al crear compra de producto',
      error: 'Error al crear compra de producto',
    }, { status: 500 })
  }
}

/**
 * @description Obtener una compra de producto por ID (cabecera + items)
 * @param {NextRequest} request - Request de Next.js
 * @param {Object} context - Contexto con params
 * @returns {Promise<NextResponse>} Compra encontrada o error 404
 */
export async function getCompraProductoByIdHandler(request: NextRequest, context: { params: Promise<{ id: string }> }, _user: any) {
  try {
    const { id } = await context.params

    const compra = await prisma.compraDocumento.findUnique({
      where: { compraDocumentoId: id },
      include: {
        proveedor: true,
        gastoCompra: true,
        cuentaPorPagar: true,
        items: {
          include: {
            producto: {
              include: {
                categoria: true,
                unidad: true,
              },
            },
          },
        },
      },
    })

    if (!compra) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ compra })
  } catch (error) {
    console.error('Error al obtener compra:', error)
    return NextResponse.json({ error: 'Error al obtener compra' }, { status: 500 })
  }
}

/**
 * @description Actualizar una compra de producto existente (cabecera)
 * @param {NextRequest} request - Request de Next.js
 * @param {Object} context - Contexto con params
 * @returns {Promise<NextResponse>} Compra actualizada
 */
export async function updateCompraProductoHandler(request: NextRequest, context: { params: Promise<{ id: string }> }, user: any) {
  try {
    const { id } = await context.params
    const body = await request.json()
    const data = updateSchema.parse(body)

    const existingCompra = await prisma.compraDocumento.findUnique({
      where: { compraDocumentoId: id },
      include: {
        gastoCompra: true,
        cuentaPorPagar: true,
      },
    })

    if (!existingCompra) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }

    const requiresReversion = await hasUnrevertedAnticipoExecution(prisma, id)
    if (requiresReversion) {
      return NextResponse.json(
        { error: 'Debe revertir el anticipo ejecutado antes de modificar la compra' },
        { status: 409 }
      )
    }

    // Verificar si la compra ya tiene pagos realizados
    if (existingCompra.cuentaPorPagar) {
      const pagos = await prisma.pagoCuentaPorPagar.count({
        where: { cuentaPorPagarId: existingCompra.cuentaPorPagar.cuentaPorPagarId },
      })

      if (pagos > 0 && data.formaPago) {
        return NextResponse.json(
          { error: 'No se puede modificar la forma de pago porque ya existen pagos realizados' },
          { status: 400 }
        )
      }
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Actualizar cabecera
      const compraActualizada = await tx.compraDocumento.update({
        where: { compraDocumentoId: id },
        data: {
          numeroFactura: data.numeroFactura,
          facturaUrl: data.facturaUrl,
          descripcion: data.descripcion,
          formaPago: data.formaPago,
          estado: data.estado,
          updatedById: user.userId || user.id,
        },
        include: {
          proveedor: true,
          gastoCompra: true,
          cuentaPorPagar: true,
          items: {
            include: {
              producto: {
                include: { categoria: true, unidad: true },
              },
            },
          },
        },
      })

      // Actualizar gastoCompra relacionado si existe
      if (existingCompra.gastoCompra && data.numeroFactura !== undefined) {
        await tx.gastoCompra.update({
          where: { gastoCompraId: existingCompra.gastoCompra.gastoCompraId },
          data: {
            numeroFactura: data.numeroFactura || undefined,
            descripcion: data.descripcion,
          },
        })
      }

      // Actualizar cuentaPorPagar si cambia el estado
      if (existingCompra.cuentaPorPagar && data.estado) {
        const nuevoEstado = data.estado === 'PAGADA' ? 'PAGADA' : 'PENDIENTE'
        await tx.cuentaPorPagar.update({
          where: { cuentaPorPagarId: existingCompra.cuentaPorPagar.cuentaPorPagarId },
          data: { estado: nuevoEstado },
        })
      }

      return compraActualizada
    })

    return NextResponse.json({
      success: true,
      compra: result,
      message: 'Compra actualizada correctamente',
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error al actualizar compra:', error)
    return NextResponse.json({ error: 'Error al actualizar compra' }, { status: 500 })
  }
}

/**
 * @description Eliminar una compra de producto (soft delete de cabecera + items)
 * Revierte stock de cada item y soft delete de gasto/cxp.
 * @param {NextRequest} request - Request de Next.js
 * @param {Object} context - Contexto con params
 * @returns {Promise<NextResponse>} Confirmación de eliminación
 */
export async function deleteCompraProductoHandler(request: NextRequest, context: { params: Promise<{ id: string }> }, user: any) {
  try {
    const { id } = await context.params

    const existingCompra = await prisma.compraDocumento.findUnique({
      where: { compraDocumentoId: id },
      include: {
        items: {
          include: { producto: true },
        },
        gastoCompra: true,
        cuentaPorPagar: true,
      },
    })

    if (!existingCompra) {
      return NextResponse.json({ error: 'Compra no encontrada' }, { status: 404 })
    }

    // Verificar si la compra ya tiene pagos realizados
    if (existingCompra.cuentaPorPagar) {
      const pagos = await prisma.pagoCuentaPorPagar.count({
        where: { cuentaPorPagarId: existingCompra.cuentaPorPagar.cuentaPorPagarId },
      })

      if (pagos > 0) {
        return NextResponse.json(
          { error: 'No se puede eliminar la compra porque ya existen pagos realizados' },
          { status: 400 }
        )
      }
    }

    // Verificar si algún producto de los items ya ha sido vendido
    for (const item of existingCompra.items) {
      const ventas = await prisma.ventaItem.count({
        where: { productoId: item.productoId },
      })

      if (ventas > 0) {
        return NextResponse.json(
          { error: `No se puede eliminar la compra porque el producto "${item.producto.nombre}" ya ha sido vendido` },
          { status: 400 }
        )
      }
    }

    await prisma.$transaction(async (tx: any) => {
      // Soft delete de la cabecera
      await tx.compraDocumento.update({
        where: { compraDocumentoId: id },
        data: {
          deletedAt: new Date(),
          updatedById: user.userId || user.id,
        },
      })

      // Revertir stock por cada item
      for (const item of existingCompra.items) {
        if (existingCompra.tipoOperacion === 'REGULAR') {
          // Si es REGULAR, soft delete del producto
          await tx.producto.update({
            where: { id: item.productoId },
            data: { deletedAt: new Date() },
          })
        } else {
          // Si es RESTOCK, revertir el stock
          await tx.producto.update({
            where: { id: item.productoId },
            data: {
              stock: { decrement: item.cantidad },
            },
          })
        }
      }

      // Soft delete del gastoCompra relacionado
      if (existingCompra.gastoCompra) {
        await tx.gastoCompra.update({
          where: { gastoCompraId: existingCompra.gastoCompra.gastoCompraId },
          data: { deletedAt: new Date() },
        })
      }

      // Soft delete de la cuentaPorPagar relacionada
      if (existingCompra.cuentaPorPagar) {
        await tx.cuentaPorPagar.update({
          where: { cuentaPorPagarId: existingCompra.cuentaPorPagar.cuentaPorPagarId },
          data: { deletedAt: new Date() },
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Compra eliminada correctamente',
    })
  } catch (error) {
    console.error('Error al eliminar compra:', error)
    return NextResponse.json({ error: 'Error al eliminar compra' }, { status: 500 })
  }
}

/**
 * @description Exportar compras de productos a CSV o JSON
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Archivo exportado
 */
export async function exportComprasProductosHandler(request: NextRequest, _context: any, _user: any) {
  try {
    const { searchParams } = new URL(request.url)
    const params = exportQuerySchema.parse({
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
      creadoPor: 'N/A',
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
}
