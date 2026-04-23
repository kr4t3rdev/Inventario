import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { calcularPrecioCostoCompra } from '@/lib/inventory-cost-utils'
import { applyPagoGastoWorkflow } from '@/lib/services/pago-gastos-workflow'
import { applyAnticipoAllocations, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'
import { FORMA_PAGO_ANTICIPO_PAGO } from '@/lib/constants/anticipos'
import { upsertStockUbicacion } from '@/lib/services/stock-ubicacion-service'

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

/**
 * @description Obtener compras de productos con filtros básicos.
 * Retorna cabeceras (CompraDocumento) con sus items.
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

    const whereClause: Record<string, any> = { deletedAt: null }

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
})

/**
 * @description Crear una compra múltiple de productos.
 * Crea una cabecera (CompraDocumento) con N items (CompraDocumentoItem).
 * Actualiza stock y costo ponderado por cada item.
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Compra creada con cabecera y detalle
 */
export const POST = withAuthPost(async (request: NextRequest, _context: any, user: any) => {
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
})
