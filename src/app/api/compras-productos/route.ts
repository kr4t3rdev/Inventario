import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { calcularPrecioCostoCompra } from '@/lib/inventory-cost-utils'
import { applyPagoGastoWorkflow } from '@/lib/services/pago-gastos-workflow'
import { applyAnticipoAllocations, executeAnticipo, isAnticipoWorkflowError } from '@/lib/services/anticipos-workflow'
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

const createSchema = z.object({
  productoId: z.string().min(1, 'Seleccione un producto'),
  precioCosto: z.coerce.number().positive('El precio de costo debe ser mayor a 0'),
  cantidad: z.coerce.number().int('La cantidad debe ser un entero').positive('La cantidad debe ser mayor a 0'),
  vendorId: z.string().min(1, 'Seleccione un proveedor'),
  numeroFactura: z.string().optional().default(''),
  facturaUrl: z.string().optional().default(''),
  formaPago: z.enum(['PAGO_PARCIAL', 'PAGO_COMPLETO', FORMA_PAGO_ANTICIPO_PAGO]),
  estado: z.enum(['PENDIENTE', 'PAGADA']),
  descripcionCompra: z.string().max(500).optional(),
  fechaVencimiento: z.string().optional(),
  anticipoPagoId: z.string().optional(),
  idempotencyKey: z.string().optional()
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
).refine(
  (data) => data.cantidad > 0,
  {
    message: 'La cantidad debe ser mayor a 0',
    path: ['cantidad'],
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

    const whereClause: Record<string, any> = {}

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
 * @description Crear una compra de producto existente, incrementando inventario en Producto y StockUbicacion.
 * @param {NextRequest} request - Request de Next.js
 * @returns {Promise<NextResponse>} Compra creada
 */
export const POST = withAuthPost(async (request: NextRequest, _context: any, user: any) => {
  try {
    const body = await request.json()
    const data = createSchema.parse(body)

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

    const resolvedEstado =
      data.formaPago === 'PAGO_COMPLETO' || data.formaPago === FORMA_PAGO_ANTICIPO_PAGO
        ? 'PAGADA'
        : 'PENDIENTE'

    const result = await prisma.$transaction(async (tx: any) => {
      const producto = await tx.producto.findUnique({
        where: { id: data.productoId },
        include: {
          vendor: true,
        },
      })

      if (!producto) {
        throw new Error('PRODUCTO_NOT_FOUND')
      }

      if (producto.vendorId && producto.vendorId !== data.vendorId) {
        throw new Error('PRODUCT_VENDOR_MISMATCH')
      }

      const stockAntes = producto.stock
      const stockDespues = stockAntes + data.cantidad
      const precioCostoAntes = producto.precioCosto
      const { precioCostoNuevo, metodoCosto } = calcularPrecioCostoCompra({
        stockAntes,
        precioCostoActual: precioCostoAntes,
        cantidadCompra: data.cantidad,
        costoUnitario: data.precioCosto
      })

      const productoActualizado = await tx.producto.update({
        where: { id: producto.id },
        data: {
          precioCosto: precioCostoNuevo,
          stock: {
            increment: data.cantidad
          }
        }
      })

      await upsertStockUbicacion(tx, {
        productoId: producto.id,
        tipoUbicacion: 'almacen',
        ubicacionId: producto.almacenId,
        modo: 'increment',
        delta: data.cantidad,
      })

      const totalCost = data.cantidad * data.precioCosto
      if (totalCost <= 0 || !Number.isFinite(totalCost)) {
        throw new Error('Invalid total cost')
      }

      const now = new Date()
      const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const descripcionCompra = data.descripcionCompra || `Compra - ${producto.nombre}`

      let gastoCompra = null
      let cuentaPorPagar = null

      if (data.formaPago === 'PAGO_COMPLETO' || data.formaPago === FORMA_PAGO_ANTICIPO_PAGO) {
        gastoCompra = await tx.gastoCompra.create({
          data: {
            productoId: producto.id,
            vendorId: data.vendorId,
            numeroFactura: data.numeroFactura,
            cantidad: data.cantidad,
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
            vendorId: data.vendorId,
            numeroFactura: data.numeroFactura,
            cantidad: data.cantidad,
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
            proveedorId: data.vendorId,
            proveedorNombre: gastoCompra.vendor?.nombre,
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
          proveedorId: data.vendorId,
          numeroFactura: data.numeroFactura,
          facturaUrl: data.facturaUrl,
          cantidad: data.cantidad,
          precioUnitario: data.precioCosto,
          total: totalCost,
          formaPago: data.formaPago,
          estado: resolvedEstado,
          tipoOperacion: 'REGULAR',
          descripcion: descripcionCompra,
          fechaCompra: now,
          gastoCompraId: gastoCompra?.gastoCompraId,
          cuentaPorPagarId: cuentaPorPagar?.cuentaPorPagarId,
        },
        include: {
          producto: true,
          proveedor: true
        }
      })

      // Record cost change due to restock (RESTOCK reason)
      if (precioCostoAntes !== precioCostoNuevo) {
        try {
          await tx.productoCostHistory.create({
            data: {
              productoId: producto.id,
              oldPrecioCosto: precioCostoAntes,
              newPrecioCosto: precioCostoNuevo,
              oldPrecioVenta: producto.precioVenta,
              newPrecioVenta: producto.precioVenta, // No cambia en restock
              reason: 'RESTOCK',
              changedBy: user?.id || user?.userId || 'system',
              changedAt: now,
              notes: `Restock: ${data.cantidad} unidades a ${data.precioCosto} c/u. Método: ${metodoCosto}`,
            },
          })
        } catch (historyError) {
          console.error('Error recording cost history for restock:', historyError)
          // Don't fail the transaction if history recording fails, but log it
        }
      }

      let ejecucionAnticipo: any = null
      if (data.formaPago === FORMA_PAGO_ANTICIPO_PAGO && data.anticipoPagoId && data.idempotencyKey) {
        // consume anticipo y crea reconciliación en la misma transacción
        const allocResult = await applyAnticipoAllocations(
          tx,
          [{ anticipoId: data.anticipoPagoId, montoAplicado: totalCost }],
          {
            documentoDestinoId: compraProducto.compraProductoId,
            contexto: 'COMPRA_PRODUCTO',
            usuarioId: user.userId || user.id,
            idempotencyKey: data.idempotencyKey,
            observaciones: `Anticipo aplicado a compra ${compraProducto.compraProductoId}`,
          }
        )

        // crear la reconciliación de gasto
        await applyPagoGastoWorkflow(tx, {
          tipoGasto: 'compra',
          referenciaId: gastoCompra.gastoCompraId,
          reconciliadoPor: user.userId || user.id,
          descripcion: `Pago anticipado de compra ${compraProducto.compraProductoId}`,
          monto: totalCost,
          moneda: 'CUP',
          estado: 'PAGADA',
          gastoCompraId: gastoCompra.gastoCompraId
        })

        ejecucionAnticipo = allocResult[0] ?? null
      }

      return {
        producto,
        productoActualizado,
        stockAntes,
        stockDespues,
        precioCostoAntes,
        precioCostoDespues: precioCostoNuevo,
        metodoCosto,
        compraProducto,
        gastoCompra,
        cuentaPorPagar,
        ejecucionAnticipo
      }
    })

    const response: any = {
      ...result,
      success: true
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error al crear compra de producto:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        code: 'VALIDATION_ERROR',
        message: 'Error de validación en la compra de producto',
        error: 'Error de validación en la compra de producto',
        details: error.flatten()
      }, { status: 400 })
    }
    if (isAnticipoWorkflowError(error)) {
      return NextResponse.json({
        code: error.code,
        message: error.message,
        error: error.message
      }, { status: error.status })
    }
    if (error instanceof Error && error.message === 'PRODUCTO_NOT_FOUND') {
      return NextResponse.json({
        code: 'PRODUCT_NOT_FOUND',
        message: 'El producto seleccionado no existe',
        error: 'El producto seleccionado no existe'
      }, { status: 404 })
    }
    if (error instanceof Error && error.message === 'PRODUCT_VENDOR_MISMATCH') {
      return NextResponse.json({
        code: 'PRODUCT_VENDOR_MISMATCH',
        message: 'El proveedor seleccionado no coincide con el proveedor del producto',
        error: 'El proveedor seleccionado no coincide con el proveedor del producto'
      }, { status: 422 })
    }
    return NextResponse.json({
      code: 'UNEXPECTED_ERROR',
      message: 'Error al crear compra de producto',
      error: 'Error al crear compra de producto'
    }, { status: 500 })
  }
})
