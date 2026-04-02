import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { verify_token } from '@/lib/auth-utils'
import { AuditLogService } from '@/lib/services/audit-log-service'

// Schema para crear/actualizar tasa de cambio
const TasaCambioSchema = z.object({
  monedaOrigenId: z.string().min(1),
  tasa: z.number().positive(),
})

// GET /api/contabilidad/exchange/tasas - Obtener tasas de cambio actuales
export async function GET() {
  try {
    // Obtener la moneda principal
    const monedaPrincipal = await prisma.moneda.findFirst({
      where: { esPrincipal: true }
    })

    if (!monedaPrincipal) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se ha configurado una moneda principal',
          code: 'NO_MAIN_CURRENCY'
        },
        { status: 400 }
      )
    }

    // Obtener las tasas más recientes para cada moneda
    const tasasActuales = await prisma.tasaCambio.findMany({
      where: {
        monedaDestino: monedaPrincipal.codigo
      },
      include: {
        monedaOrigen: true
      },
      orderBy: {
        fechaVigencia: 'desc'
      },
      distinct: ['monedaOrigenId']
    })

    return NextResponse.json({
      success: true,
      data: {
        monedaPrincipal,
        tasas: tasasActuales
      }
    })

  } catch (error) {
    console.error('Error fetching exchange rates:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener las tasas de cambio',
        code: 'FETCH_RATES_ERROR'
      },
      { status: 500 }
    )
  }
}

// POST /api/contabilidad/exchange/tasas - Actualizar tasa de cambio
export async function POST(request: NextRequest) {
  try {
    const user = await verify_token(request)
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = TasaCambioSchema.parse(body)

    // Verificar que la moneda origen existe y está activa
    const monedaOrigen = await prisma.moneda.findUnique({
      where: { codigo: validatedData.monedaOrigenId }
    })

    if (!monedaOrigen) {
      return NextResponse.json(
        {
          success: false,
          error: 'Moneda origen no encontrada',
          code: 'SOURCE_CURRENCY_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    if (!monedaOrigen.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'La moneda origen no está activa',
          code: 'SOURCE_CURRENCY_INACTIVE'
        },
        { status: 400 }
      )
    }

    // Obtener la moneda principal como destino
    const monedaPrincipal = await prisma.moneda.findFirst({
      where: { esPrincipal: true }
    })

    if (!monedaPrincipal) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se ha configurado una moneda principal',
          code: 'NO_MAIN_CURRENCY'
        },
        { status: 400 }
      )
    }

    // No permitir tasa de cambio para la moneda principal
    if (validatedData.monedaOrigenId === monedaPrincipal.codigo) {
      return NextResponse.json(
        {
          success: false,
          error: 'No se puede establecer tasa de cambio para la moneda principal',
          code: 'MAIN_CURRENCY_RATE_NOT_ALLOWED'
        },
        { status: 400 }
      )
    }

    // Crear nueva tasa de cambio
    const nuevaTasa = await prisma.tasaCambio.create({
      data: {
        monedaOrigenId: validatedData.monedaOrigenId,
        monedaDestino: monedaPrincipal.codigo,
        tasa: validatedData.tasa,
      },
      include: {
        monedaOrigen: true
      }
    })

    await AuditLogService.log({
      accion: 'CREATE',
      entidad: 'TASA_CAMBIO',
      entidadId: nuevaTasa.tasaId,
      usuarioId: user.userId,
      detalles: {
        monedaOrigenId: validatedData.monedaOrigenId,
        tasa: validatedData.tasa
      }
    })

    return NextResponse.json({
      success: true,
      data: nuevaTasa,
      message: 'Tasa de cambio actualizada exitosamente'
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

    console.error('Error updating exchange rate:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al actualizar la tasa de cambio',
        code: 'UPDATE_RATE_ERROR'
      },
      { status: 500 }
    )
  }
}