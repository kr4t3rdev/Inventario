
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/auth-middleware' // Assuming generic wrapper or I'll implement individual handlers
import { z } from 'zod'

const listaPrecioUpdateSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').optional(),
  descripcion: z.string().optional(),
  esDefault: z.boolean().optional(),
})

export const PUT = withAuth(async (req: Request, { params }: { params: { id: string } }) => {
  try {
    const body = await req.json()
    const validatedData = listaPrecioUpdateSchema.parse(body)
    const { id } = params

    // Si se marca como default, desmarcar las otras
    if (validatedData.esDefault) {
      await prisma.listaPrecio.updateMany({
        where: { esDefault: true, id: { not: id } },
        data: { esDefault: false },
      })
    }

    const listaActualizada = await prisma.listaPrecio.update({
      where: { id },
      data: validatedData,
    })

    return NextResponse.json(listaActualizada)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error updating price list:', error)
    return NextResponse.json(
      { error: 'Error al actualizar la lista de precios' },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (req: Request, { params }: { params: { id: string } }) => {
  try {
    const { id } = params

    // Verificar si está en uso por puntos de venta
    const usoPuntoVenta = await prisma.puntoDeVenta.count({
      where: { listaPrecioId: id },
    })

    if (usoPuntoVenta > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar una lista de precios asignada a un punto de venta' },
        { status: 400 }
      )
    }

    await prisma.listaPrecio.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Lista de precios eliminada correctamente' })
  } catch (error) {
    console.error('Error deleting price list:', error)
    return NextResponse.json(
      { error: 'Error al eliminar la lista de precios' },
      { status: 500 }
    )
  }
})

// GET individual si es necesario
export const GET = withAuth(async (req: Request, { params }: { params: { id: string } }) => {
  try {
    const { id } = params
    const lista = await prisma.listaPrecio.findUnique({
      where: { id },
      include: {
        puntosDeVenta: true,
      }
    })

    if (!lista) {
      return NextResponse.json({ error: 'Lista no encontrada' }, { status: 404 })
    }

    return NextResponse.json(lista)
  } catch (error) {
     console.error('Error getting price list:', error)
    return NextResponse.json(
      { error: 'Error al obtener la lista de precios' },
      { status: 500 }
    )
  }
})
