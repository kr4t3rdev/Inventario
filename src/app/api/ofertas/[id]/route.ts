
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from "@/lib/auth-middleware"

const updateSchema = z.object({
  estado: z.enum(['PENDIENTE', 'ACEPTADA', 'RECHAZADA', 'FACTURADA']).optional(),
  observaciones: z.string().optional()
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const oferta = await prisma.oferta.findUnique({
      where: { id },
      include: {
        cliente: true,
        items: {
          include: {
            producto: {
              include: {
                unidad: true
              }
            },
            servicio: true
          }
        },
        venta: true
      }
    })

    if (!oferta) {
      return NextResponse.json({ error: 'Oferta no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ oferta })
  } catch (error) {
    console.error('Error fetching offer:', error)
    return NextResponse.json({ error: 'Error fetching offer' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json()
    const validatedData = updateSchema.parse(body)

    const oferta = await prisma.oferta.update({
      where: { id },
      data: validatedData,
      include: {
        items: true,
        cliente: true
      }
    })

    return NextResponse.json({ oferta })
  } catch (error) {
    console.error('Error updating offer:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error updating offer' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    // Verificar que la oferta existe
    const oferta = await prisma.oferta.findUnique({
      where: { id }
    })

    if (!oferta) {
      return NextResponse.json({ error: 'Oferta no encontrada' }, { status: 404 })
    }

    // No permitir eliminar ofertas facturadas
    if (oferta.estado === 'FACTURADA') {
      return NextResponse.json({ error: 'No se puede eliminar una oferta facturada' }, { status: 400 })
    }

    // Eliminar la oferta (los items se eliminan en cascada por la relación)
    await prisma.oferta.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Oferta eliminada exitosamente' }, { status: 200 })
  } catch (error) {
    console.error('Error deleting offer:', error)
    return NextResponse.json({ error: 'Error eliminando oferta' }, { status: 500 })
  }
}
