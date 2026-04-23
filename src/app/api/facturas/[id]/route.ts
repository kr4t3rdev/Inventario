import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/lib/auth-middleware"
import { z } from "zod"
import { hasUnrevertedAnticipoExecution } from "@/lib/services/anticipos-guards"

// Schema para actualizar factura
const UpdateFacturaSchema = z.object({
  estado: z.enum(['PENDIENTE', 'PAGADA', 'ANULADA', 'VENCIDA']).optional(),
  tipoDocumento: z.enum(['FACTURA', 'NOTA_CREDITO', 'FACTURA_RECTIFICATIVA', 'PROFORMA']).optional(),
  fechaVencimiento: z.string().datetime().optional().nullable(),
  observaciones: z.string().optional().nullable(),
  terminosPago: z.string().optional().nullable(),
  metodoPago: z.string().optional().nullable(),
})

/**
 * @description Obtener una factura específica por ID
 */
export const GET = withAuth(async (request: NextRequest, context: any, user: any) => {
  try {
    const { id } = await context.params

    const facturaInclude = {
      serie: true,
      cliente: {
        select: {
          clienteId: true,
          nombre: true,
          direccion: true,
          telefono: true,
          numeroCuentaCUP: true,
          numeroCuentaUSD: true,
          numeroContrato: true,
        },
      },
      venta: {
        include: {
          cliente: {
            select: {
              clienteId: true,
              nombre: true,
              direccion: true,
              telefono: true,
              numeroCuentaCUP: true,
              numeroCuentaUSD: true,
              numeroContrato: true,
            },
          },
          puntoDeVenta: { select: { pvId: true, nombre: true } },
          producto: { select: { id: true, nombre: true, precioVenta: true } },
          oferta: {
            select: {
              id: true,
              numeroOferta: true,
              subtotal: true,
              impuestos: true,
              total: true,
              items: {
                select: {
                  id: true,
                  cantidad: true,
                  precioUnitario: true,
                  total: true,
                  producto: { select: { nombre: true } },
                  servicio: { select: { nombre: true } },
                  productoId: true,
                  servicioId: true,
                },
              },
            },
          },
          ordenReparacion: {
            select: {
              id: true,
              numeroOrden: true,
              marca: true,
              modelo: true,
              equipoTipo: { select: { nombre: true } },
              items: {
                select: {
                  id: true,
                  precio: true,
                  complejidad: true,
                  defectacion: { select: { defecto: true, costo: true } },
                  pieza: { select: { nombre: true, costoPequeno: true, costoMediano: true, costoGrande: true } },
                },
              },
            },
          },
        },
      },
    }

    let factura = await prisma.factura.findUnique({
      where: { idFactura: id },
      include: facturaInclude,
    })

    if (!factura) {
      factura = await prisma.factura.findUnique({
        where: { ventaId: id },
        include: facturaInclude,
      })
    }

    if (!factura) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
    }

    if (factura.venta) {
      const items = await prisma.ventaItem.findMany({
        where: { ventaId: factura.venta.ventaId },
        include: {
          producto: {
            select: {
              id: true,
              nombre: true,
              precioVenta: true,
              unidad: { select: { simbolo: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      })

      if (items.length > 0) {
        ;(factura.venta as any).items = items
      } else {
        const legacyItems = await prisma.venta.findMany({
          where: { ventaPadreId: factura.venta.ventaId },
          include: {
            producto: {
              select: {
                id: true,
                nombre: true,
                precioVenta: true,
                unidad: { select: { simbolo: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        })
        ;(factura.venta as any).items = legacyItems
      }
    }

    return NextResponse.json(factura)
  } catch (error) {
    console.error("Error al obtener factura:", error)
    return NextResponse.json(
      { error: "Error al obtener factura" },
      { status: 500 }
    )
  }
})

/**
 * @description Actualizar una factura
 */
export const PATCH = withAuth(async (request: NextRequest, context: any, user: any) => {
  try {
    const { id } = await context.params
    const body = await request.json()
    const validatedData = UpdateFacturaSchema.parse(body)

    // Verificar que la factura existe
    const facturaExistente = await prisma.factura.findUnique({
      where: { idFactura: id },
    })

    if (!facturaExistente) {
      return NextResponse.json(
        { error: "Factura no encontrada" },
        { status: 404 }
      )
    }

    if (validatedData.estado === 'ANULADA') {
      const requiresReversion = await hasUnrevertedAnticipoExecution(prisma, id)
      if (requiresReversion) {
        return NextResponse.json(
          { error: 'Debe revertir el anticipo ejecutado antes de anular la factura' },
          { status: 409 }
        )
      }
    }

    // Preparar datos para actualizar
    const updateData: any = {}
    if (validatedData.estado !== undefined) {
      updateData.estado = validatedData.estado
    }
    if (validatedData.tipoDocumento !== undefined) {
      updateData.tipoDocumento = validatedData.tipoDocumento
    }
    if (validatedData.fechaVencimiento !== undefined) {
      updateData.fechaVencimiento = validatedData.fechaVencimiento ? new Date(validatedData.fechaVencimiento) : null
    }
    if (validatedData.observaciones !== undefined) {
      updateData.observaciones = validatedData.observaciones
    }
    if (validatedData.terminosPago !== undefined) {
      updateData.terminosPago = validatedData.terminosPago
    }
    if (validatedData.metodoPago !== undefined) {
      updateData.metodoPago = validatedData.metodoPago
    }
    updateData.actualizadoPor = user.userId

    // Actualizar la factura
    const facturaActualizada = await prisma.factura.update({
      where: { idFactura: id },
      data: updateData,
    })

    return NextResponse.json(facturaActualizada)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Error de validación", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error al actualizar factura:", error)
    return NextResponse.json(
      { error: "Error al actualizar factura" },
      { status: 500 }
    )
  }
})

/**
 * @description Eliminar una factura (solo si no está vinculada a venta)
 */
export const DELETE = withAuth(async (request: NextRequest, context: any, user: any) => {
  try {
    const { id } = await context.params

    // Verificar que la factura existe
    const facturaExistente = await prisma.factura.findUnique({
      where: { idFactura: id },
    })

    if (!facturaExistente) {
      return NextResponse.json(
        { error: "Factura no encontrada" },
        { status: 404 }
      )
    }

    const requiresReversion = await hasUnrevertedAnticipoExecution(prisma, id)
    if (requiresReversion) {
      return NextResponse.json(
        { error: 'Debe revertir el anticipo ejecutado antes de eliminar la factura' },
        { status: 409 }
      )
    }

    // Verificar que no está vinculada a una venta (opcional, pero recomendado)
    if (facturaExistente.ventaId) {
      return NextResponse.json(
        { error: "No se puede eliminar una factura vinculada a una venta" },
        { status: 400 }
      )
    }

    // Eliminar la factura
    await prisma.factura.delete({
      where: { idFactura: id },
    })

    return NextResponse.json({ success: true, message: "Factura eliminada exitosamente" })
  } catch (error) {
    console.error("Error al eliminar factura:", error)
    return NextResponse.json(
      { error: "Error al eliminar factura" },
      { status: 500 }
    )
  }
})
