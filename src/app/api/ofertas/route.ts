
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { authenticateUser } from "@/lib/auth-middleware"

const ofertaItemSchema = z.object({
  productoId: z.string().optional(),
  servicioId: z.string().optional(),
  cantidad: z.number().int().positive(),
  precioUnitario: z.number().nonnegative(),
  total: z.number().nonnegative()
})

const ofertaSchema = z.object({
  clienteId: z.string().min(1, "Cliente requerido"),
  fechaVencimiento: z.string().optional(), // Receive as string, convert to Date
  subtotal: z.number().nonnegative(),
  impuestos: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  observaciones: z.string().optional(),
  items: z.array(ofertaItemSchema).min(1, "Al menos un item requerido")
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    
    const whereClause: any = {}
    if (estado) {
      whereClause.estado = estado
    }

    const ofertas = await prisma.oferta.findMany({
      where: whereClause,
      include: {
        cliente: true,
        items: {
          include: {
            producto: true,
            servicio: true
          }
        },
        venta: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ ofertas })
  } catch (error) {
    console.error('Error fetching offers:', error)
    return NextResponse.json({ error: 'Error fetching offers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResultUser = await authenticateUser(request)
    if ('status' in authResultUser) return authResultUser as Response
    const user = authResultUser.user

    const body = await request.json()
    const validatedData = ofertaSchema.parse(body)

    // Generate numeroOferta (simple sequential or timestamp based for now)
    const count = await prisma.oferta.count()
    const numeroOferta = `OF-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`

    const oferta = await prisma.oferta.create({
      data: {
        numeroOferta,
        clienteId: validatedData.clienteId,
        fechaVencimiento: validatedData.fechaVencimiento ? new Date(validatedData.fechaVencimiento) : null,
        subtotal: validatedData.subtotal,
        impuestos: validatedData.impuestos,
        total: validatedData.total,
        observaciones: validatedData.observaciones,
        items: {
          create: validatedData.items.map(item => ({
            productoId: item.productoId,
            servicioId: item.servicioId,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
            total: item.total
          }))
        }
      },
      include: {
        items: true,
        cliente: true
      }
    })

    return NextResponse.json({ oferta }, { status: 201 })
  } catch (error) {
    console.error('Error creating offer:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation error', details: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Error creating offer' }, { status: 500 })
  }
}
