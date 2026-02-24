import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Schema para validar nueva moneda
const MonedaSchema = z.object({
  codigo: z.string().min(2).max(5).toUpperCase(),
  nombre: z.string().min(1),
  simbolo: z.string().min(1),
  esPrincipal: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true)
})

// GET /api/contabilidad/exchange/monedas - Listar monedas disponibles
export async function GET() {
  try {
    const monedas = await prisma.moneda.findMany({
      orderBy: [
        { esPrincipal: 'desc' },
        { codigo: 'asc' }
      ],
      include: {
        tasasCambio: {
          orderBy: {
            fechaVigencia: 'desc'
          },
          take: 1
        },
        _count: {
          select: {
            tasasCambio: true,
            transacciones: true
          }
        }
      }
    })
    
    // Transformar para incluir la tasa actual de forma directa
    const monedasConTasaActual = monedas.map((moneda: { tasasCambio: { tasa: unknown }[] } & Record<string, unknown>) => {
      const { tasasCambio, ...resto } = moneda
      return {
        ...resto,
        tasaCambio: tasasCambio.length > 0 ? Number(tasasCambio[0].tasa) : 1
      }
    })

    return NextResponse.json({
      success: true,
      data: monedasConTasaActual
    })
  } catch (error) {
    console.error('Error fetching currencies:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error al obtener las monedas',
        code: 'FETCH_CURRENCIES_ERROR'
      },
      { status: 500 }
    )
  }
}

// POST /api/contabilidad/exchange/monedas - Crear nueva moneda
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = MonedaSchema.parse(body)

    // Verificar si ya existe una moneda con ese código
    const existingMoneda = await prisma.moneda.findUnique({
      where: { codigo: validatedData.codigo }
    })

    if (existingMoneda) {
      return NextResponse.json(
        {
          success: false,
          error: 'Ya existe una moneda con ese código',
          code: 'CURRENCY_CODE_EXISTS'
        },
        { status: 400 }
      )
    }

    // Si se marca como principal, desmarcar otras monedas principales
    if (validatedData.esPrincipal) {
      await prisma.moneda.updateMany({
        where: { esPrincipal: true },
        data: { esPrincipal: false }
      })
    }

    const nuevaMoneda = await prisma.moneda.create({
      data: validatedData
    })

    return NextResponse.json({
      success: true,
      data: nuevaMoneda,
      message: 'Moneda creada exitosamente'
    }, { status: 201 })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Datos de entrada inválidos',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }

    console.error('Error creating currency:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al crear la moneda',
        code: 'CREATE_CURRENCY_ERROR'
      },
      { status: 500 }
    )
  }
}