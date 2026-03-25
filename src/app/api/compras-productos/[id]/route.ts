import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { withAuthGet, withAuth } from '@/lib/auth-middleware'
import { hasUnrevertedAnticipoExecution } from '@/lib/services/anticipos-guards'

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

/**
 * @description Obtener una compra de producto por ID
 * @param {NextRequest} request - Request de Next.js
 * @param {Object} context - Contexto con params
 * @returns {Promise<NextResponse>} Compra encontrada o error 404
 */
export const GET = withAuthGet(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  try {
    const { id } = await context.params

    const compra = await prisma.compraProducto.findUnique({
      where: { compraProductoId: id },
      include: {
        producto: {
          include: {
            categoria: true,
            unidad: true,
          },
        },
        proveedor: true,
        gastoCompra: true,
        cuentaPorPagar: true,
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
})

/**
 * @description Actualizar una compra de producto existente
 * @param {NextRequest} request - Request de Next.js
 * @param {Object} context - Contexto con params
 * @returns {Promise<NextResponse>} Compra actualizada
 */
export const PUT = withAuth(async (request: NextRequest, context: { params: Promise<{ id: string }> }, user: any) => {
  try {
    const { id } = await context.params
    const body = await request.json()
    const data = updateSchema.parse(body)

    const existingCompra = await prisma.compraProducto.findUnique({
      where: { compraProductoId: id },
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
        { error: 'Debe revertir el anticipo ejecutado antes de eliminar la compra' },
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
      // Actualizar compra
      const compraActualizada = await tx.compraProducto.update({
        where: { compraProductoId: id },
        data: {
          numeroFactura: data.numeroFactura,
          facturaUrl: data.facturaUrl,
          descripcion: data.descripcion,
          formaPago: data.formaPago,
          estado: data.estado,
          updatedById: user.userId || user.id,
        },
        include: {
          producto: {
            include: {
              categoria: true,
              unidad: true,
            },
          },
          proveedor: true,
          gastoCompra: true,
          cuentaPorPagar: true,
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
})

/**
 * @description Eliminar una compra de producto (soft delete)
 * @param {NextRequest} request - Request de Next.js
 * @param {Object} context - Contexto con params
 * @returns {Promise<NextResponse>} Confirmación de eliminación
 */
export const DELETE = withAuth(async (request: NextRequest, context: { params: Promise<{ id: string }> }, user: any) => {
  try {
    const { id } = await context.params

    const existingCompra = await prisma.compraProducto.findUnique({
      where: { compraProductoId: id },
      include: {
        producto: true,
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

    // Verificar si el producto ya ha sido vendido
    const ventas = await prisma.ventaItem.count({
      where: { productoId: existingCompra.productoId },
    })

    if (ventas > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar la compra porque el producto ya ha sido vendido' },
        { status: 400 }
      )
    }

    await prisma.$transaction(async (tx: any) => {
      // Soft delete de la compra
      await tx.compraProducto.update({
        where: { compraProductoId: id },
        data: {
          deletedAt: new Date(),
          updatedById: user.userId || user.id,
        },
      })

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

      // Si es tipo REGULAR (nuevo producto), eliminar el producto creado
      if (existingCompra.tipoOperacion === 'REGULAR') {
        await tx.producto.update({
          where: { id: existingCompra.productoId },
          data: { deletedAt: new Date() },
        })
      } else {
        // Si es RESTOCK, revertir el stock
        await tx.producto.update({
          where: { id: existingCompra.productoId },
          data: {
            stock: {
              decrement: existingCompra.cantidad,
            },
          },
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
})
