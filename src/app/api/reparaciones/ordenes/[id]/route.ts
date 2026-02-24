import { type NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { withAuth } from "@/lib/auth-middleware"
import { notifyOrdenStatusChange } from "@/lib/notifications"

// GET: Obtener detalles de una orden
export const GET = withAuth(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  try {
    const orden = await prisma.ordenReparacion.findUnique({
      where: { id },
      include: {
        cliente: true,
        equipoTipo: {
            include: {
                piezas: true // Necesario para mostrar opciones en defectación
            }
        },
        equipos: {
          include: {
            equipoTipo: {
              include: {
                piezas: true
              }
            }
          }
        },
        tecnico: true,
        items: {
          include: {
            pieza: true,
            ordenEquipo: {
              include: {
                equipoTipo: true
              }
            }
          }
        },
        materiales: {
          include: {
            producto: true
          }
        },
        venta: {
          include: {
            factura: true
          }
        }
      }
    })

    if (!orden) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 })
    }

    return NextResponse.json(orden)
  } catch (error) {
    console.error("Error al obtener orden:", error)
    return NextResponse.json({ error: "Error al obtener orden" }, { status: 500 })
  }
})

// PUT: Actualizar orden (Estado, Diagnóstico, Items, Materiales)
export const PUT = withAuth(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }, user: any) => {
  const { id } = await params
  try {
    const data = await request.json()
    const { items, materiales, ...generalData } = data

    // 1. Actualizar datos generales (Estado, Diagnóstico, Fechas)
    const updateData: any = { ...generalData }
    
    // Si cambia el estado a TERMINADO, asegurar fechaEntrega si no existe (opcional, lógica de negocio)
    
    // Transacción para manejar items y materiales
    await prisma.$transaction(async (tx: any) => {
      
      // Actualizar cabecera
      const ordenActual = await tx.ordenReparacion.update({
        where: { id },
        data: updateData
      })

      // Manejo de Items de Reparación (Defectación)
      if (items) {
        // Validar que ordenEquipoId exista y pertenezca a la orden
        const ordenEquipoIds = items
          .filter((item: any) => item.ordenEquipoId)
          .map((item: any) => item.ordenEquipoId)
        if (ordenEquipoIds.length > 0) {
          const equiposExistentes = await tx.ordenReparacionEquipo.findMany({
            where: { id: { in: ordenEquipoIds }, ordenId: id },
            select: { id: true }
          })
          const equiposExistentesIds = new Set(equiposExistentes.map((e: { id: string }) => e.id))
          const equiposInvalidos = ordenEquipoIds.filter((eid: string) => !equiposExistentesIds.has(eid))
          if (equiposInvalidos.length > 0) {
            throw new Error(`Los siguientes equipos no existen en la orden: ${equiposInvalidos.join(', ')}`)
          }
        }

        // Validar que los piezaId existan en la tabla PiezaReparacion
        const piezaIds = items.filter((item: any) => item.piezaId).map((item: any) => item.piezaId)
        if (piezaIds.length > 0) {
          const piezasExistentes = await tx.piezaReparacion.findMany({
            where: { id: { in: piezaIds } },
            select: { id: true }
          })
          const piezasExistentesIds = new Set(piezasExistentes.map((p: { id: string }) => p.id))
          const piezasInvalidas = piezaIds.filter((id: string) => !piezasExistentesIds.has(id))
          if (piezasInvalidas.length > 0) {
            throw new Error(`Las siguientes piezas no existen en el catálogo: ${piezasInvalidas.join(', ')}`)
          }
        }

        // Borrar anteriores (estrategia simple: replace all)
        await tx.ordenReparacionItem.deleteMany({
          where: { ordenId: id }
        })

        if (items.length > 0) {
          await tx.ordenReparacionItem.createMany({
            data: items.map((item: any) => ({
              ordenId: id,
              ordenEquipoId: item.ordenEquipoId || null,
              piezaId: item.piezaId || null,
              defectacionId: item.defectacionId || null,
              precio: item.precio,
              observaciones: item.observaciones,
              tecnicoId: item.tecnicoId // Opcional si se asigna por item
            }))
          })
        }
      }

      // Manejo de Materiales (Repuestos)
      if (materiales) {
        // Validar que los productoId existan en la tabla Producto
        const productoIds = materiales.filter((mat: any) => mat.productoId).map((mat: any) => mat.productoId)
        if (productoIds.length > 0) {
          const productosExistentes = await tx.producto.findMany({
            where: { id: { in: productoIds } },
            select: { id: true }
          })
          const productosExistentesIds = new Set(productosExistentes.map((p: { id: string }) => p.id))
          const productosInvalidos = productoIds.filter((id: string) => !productosExistentesIds.has(id))
          if (productosInvalidos.length > 0) {
            throw new Error(`Los siguientes productos no existen en el inventario: ${productosInvalidos.join(', ')}`)
          }
        }

        await tx.ordenReparacionMaterial.deleteMany({
          where: { ordenId: id }
        })

        if (materiales.length > 0) {
          await tx.ordenReparacionMaterial.createMany({
            data: materiales.map((mat: any) => ({
              ordenId: id,
              productoId: mat.productoId,
              cantidad: mat.cantidad,
              precioUnitario: mat.precioUnitario,
              total: mat.total
            }))
          })
        }
      }

      // Recalcular Totales de la Orden
      const currentItems = await tx.ordenReparacionItem.findMany({ where: { ordenId: id } })
      const currentMaterials = await tx.ordenReparacionMaterial.findMany({ where: { ordenId: id } })

      const totalItems = currentItems.reduce((sum: number, item: { precio: number }) => sum + Number(item.precio), 0)
      const totalMaterials = currentMaterials.reduce((sum: number, mat: { total: number }) => sum + Number(mat.total), 0)
      
      const subtotal = totalItems + totalMaterials
      // Asumimos descuento viene en generalData o se mantiene
      let descuento = updateData.descuento !== undefined ? Number(updateData.descuento) : 0
      
      // Si es garantía, el descuento es el total (costo cero para el cliente)
      if (ordenActual.esGarantia) {
        descuento = subtotal
      }
      
      const total = subtotal - descuento

      // Preparar datos de actualización
      const updateOrderData: any = {
        subtotal,
        descuento,
        total
      }

      // Si se actualizaron items o materiales, asumir que los precios están en USD
      if (items || materiales) {
        updateOrderData.moneda = 'USD'
      }

      await tx.ordenReparacion.update({
        where: { id },
        data: updateOrderData
      })
    })

    const ordenActualizada = await prisma.ordenReparacion.findUnique({
      where: { id },
      include: { items: true, materiales: true }
    })

    return NextResponse.json(ordenActualizada)

  } catch (error) {
    console.error("Error al actualizar orden:", error)
    const errorMessage = error instanceof Error ? error.message : "Error al actualizar orden"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
})

// DELETE: Eliminar orden
export const DELETE = withAuth(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }, user: any) => {
    const { id } = await params
    try {
        if (user.role !== 'admin') {
             return NextResponse.json({ error: "Solo administradores pueden eliminar órdenes" }, { status: 403 })
        }

        await prisma.ordenReparacion.delete({
            where: { id }
        })

        return NextResponse.json({ message: "Orden eliminada correctamente" })
    } catch (error) {
        console.error("Error al eliminar orden:", error)
        return NextResponse.json({ error: "Error al eliminar orden" }, { status: 500 })
    }
})
