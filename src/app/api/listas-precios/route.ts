
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuthGet, withAuthPost } from '@/lib/auth-middleware'
import { z } from 'zod'

const listaPrecioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  descripcion: z.string().optional(),
  esDefault: z.boolean().optional().default(false),
})

export const GET = withAuthGet(async () => {
  try {
    const listas = await prisma.listaPrecio.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: {
            puntosDeVenta: true,
            precios: true,
          },
        },
      },
    })
    return NextResponse.json(listas)
  } catch (error) {
    console.error('Error fetching price lists:', error)
    return NextResponse.json(
      { error: 'Error al obtener las listas de precios' },
      { status: 500 }
    )
  }
})

export const POST = withAuthPost(async (req) => {
  try {
    const body = await req.json()
    const validatedData = listaPrecioSchema.parse(body)

    // Si se marca como default, desmarcar las otras
    if (validatedData.esDefault) {
      await prisma.listaPrecio.updateMany({
        where: { esDefault: true },
        data: { esDefault: false },
      })
    }

    const nuevaLista = await prisma.listaPrecio.create({
      data: validatedData,
    })

    return NextResponse.json(nuevaLista, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      )
    }
    console.error('Error creating price list:', error)
    return NextResponse.json(
      { error: 'Error al crear la lista de precios' },
      { status: 500 }
    )
  }
})
