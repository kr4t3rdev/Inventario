import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Schema para conversión de moneda
const ConversionSchema = z.object({
  monto: z.number().positive(),
  monedaOrigen: z.string().min(1),
  monedaDestino: z.string().min(1),
  tasaPersonalizada: z.number().positive().optional() // Tasa opcional para usar en lugar de la actual
})

// POST /api/contabilidad/exchange/convertir - Convertir entre monedas
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = ConversionSchema.parse(body)

    const { monto, monedaOrigen, monedaDestino, tasaPersonalizada } = validatedData

    // Verificar que ambas monedas existen y están activas
    const [monedaOrigenData, monedaDestinoData] = await Promise.all([
      prisma.moneda.findUnique({ where: { codigo: monedaOrigen } }),
      prisma.moneda.findUnique({ where: { codigo: monedaDestino } })
    ])

    if (!monedaOrigenData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Moneda origen no encontrada',
          code: 'SOURCE_CURRENCY_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    if (!monedaDestinoData) {
      return NextResponse.json(
        {
          success: false,
          error: 'Moneda destino no encontrada',
          code: 'TARGET_CURRENCY_NOT_FOUND'
        },
        { status: 404 }
      )
    }

    if (!monedaOrigenData.isActive || !monedaDestinoData.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'Una o ambas monedas no están activas',
          code: 'CURRENCY_INACTIVE'
        },
        { status: 400 }
      )
    }

    // Si las monedas son iguales, no hay conversión
    if (monedaOrigen === monedaDestino) {
      return NextResponse.json({
        success: true,
        data: {
          montoOriginal: monto,
          montoConvertido: monto,
          monedaOrigen: monedaOrigenData,
          monedaDestino: monedaDestinoData,
          tasaUtilizada: 1,
          tipoConversion: 'sin_conversion'
        }
      })
    }

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

    let montoConvertido: number
    let tasaUtilizada: number
    let tipoConversion: string

    if (tasaPersonalizada) {
      // Usar tasa personalizada
      montoConvertido = monto * tasaPersonalizada
      tasaUtilizada = tasaPersonalizada
      tipoConversion = 'tasa_personalizada'
    } else {
      // Lógica de conversión basada en la moneda principal
      if (monedaOrigen === monedaPrincipal.codigo) {
        // Convertir de moneda principal a otra moneda
        const tasaCambio = await prisma.tasaCambio.findFirst({
          where: { 
            monedaOrigenId: monedaDestino,
            monedaDestino: monedaPrincipal.codigo
          },
          orderBy: { fechaVigencia: 'desc' }
        })

        if (!tasaCambio) {
          return NextResponse.json(
            {
              success: false,
              error: `No se encontró tasa de cambio para ${monedaDestino}`,
              code: 'EXCHANGE_RATE_NOT_FOUND'
            },
            { status: 404 }
          )
        }

        // Conversión inversa: dividir por la tasa
        tasaUtilizada = 1 / Number(tasaCambio.tasa)
        montoConvertido = monto * tasaUtilizada
        tipoConversion = 'principal_a_secundaria'

      } else if (monedaDestino === monedaPrincipal.codigo) {
        // Convertir de otra moneda a moneda principal
        const tasaCambio = await prisma.tasaCambio.findFirst({
          where: { 
            monedaOrigenId: monedaOrigen,
            monedaDestino: monedaPrincipal.codigo
          },
          orderBy: { fechaVigencia: 'desc' }
        })

        if (!tasaCambio) {
          return NextResponse.json(
            {
              success: false,
              error: `No se encontró tasa de cambio para ${monedaOrigen}`,
              code: 'EXCHANGE_RATE_NOT_FOUND'
            },
            { status: 404 }
          )
        }

        tasaUtilizada = Number(tasaCambio.tasa)
        montoConvertido = monto * tasaUtilizada
        tipoConversion = 'secundaria_a_principal'

      } else {
        // Convertir entre dos monedas secundarias (vía moneda principal)
        const [tasaOrigen, tasaDestino] = await Promise.all([
          prisma.tasaCambio.findFirst({
            where: { 
              monedaOrigenId: monedaOrigen,
              monedaDestino: monedaPrincipal.codigo
            },
            orderBy: { fechaVigencia: 'desc' }
          }),
          prisma.tasaCambio.findFirst({
            where: { 
              monedaOrigenId: monedaDestino,
              monedaDestino: monedaPrincipal.codigo
            },
            orderBy: { fechaVigencia: 'desc' }
          })
        ])

        if (!tasaOrigen || !tasaDestino) {
          return NextResponse.json(
            {
              success: false,
              error: 'No se encontraron las tasas de cambio necesarias',
              code: 'EXCHANGE_RATES_NOT_FOUND'
            },
            { status: 404 }
          )
        }

        // Convertir: origen -> principal -> destino
        const montoPrincipal = monto * Number(tasaOrigen.tasa)
        tasaUtilizada = Number(tasaOrigen.tasa) / Number(tasaDestino.tasa)
        montoConvertido = montoPrincipal / Number(tasaDestino.tasa)
        tipoConversion = 'secundaria_a_secundaria'
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        montoOriginal: monto,
        montoConvertido: Number(montoConvertido.toFixed(4)),
        monedaOrigen: monedaOrigenData,
        monedaDestino: monedaDestinoData,
        tasaUtilizada: Number(tasaUtilizada.toFixed(6)),
        tipoConversion,
        fechaConversion: new Date().toISOString()
      }
    })

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

    console.error('Error converting currency:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al convertir la moneda',
        code: 'CURRENCY_CONVERSION_ERROR'
      },
      { status: 500 }
    )
  }
}