import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/contabilidad/exchange/tasas/historial - Obtener historial de tasas de cambio
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const monedaId = searchParams.get('monedaId')
    const fechaDesde = searchParams.get('fechaDesde')
    const fechaHasta = searchParams.get('fechaHasta')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    // Construir filtros
    const where: any = {}

    if (monedaId) {
      where.monedaOrigenId = monedaId
    }

    if (fechaDesde || fechaHasta) {
      where.fechaVigencia = {}
      if (fechaDesde) {
        where.fechaVigencia.gte = new Date(fechaDesde)
      }
      if (fechaHasta) {
        where.fechaVigencia.lte = new Date(fechaHasta)
      }
    }

    // Obtener historial con paginación
    const [historial, total] = await Promise.all([
      prisma.tasaCambio.findMany({
        where,
        include: {
          monedaOrigen: true
        },
        orderBy: {
          fechaVigencia: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.tasaCambio.count({ where })
    ])

    // Calcular estadísticas si se especifica una moneda
    let estadisticas = null
    if (monedaId) {
      const tasas = await prisma.tasaCambio.findMany({
        where: { monedaOrigenId: monedaId },
        select: { tasa: true },
        orderBy: { fechaVigencia: 'desc' },
        take: 30 // Últimas 30 tasas para estadísticas
      })

        if (tasas.length > 0) {
        const valores = tasas.map((t: { tasa: unknown }) => Number(t.tasa))
        const suma = valores.reduce((a: number, b: number) => a + b, 0)
        const promedio = suma / valores.length
        const maximo = Math.max(...valores)
        const minimo = Math.min(...valores)

        estadisticas = {
          promedio: promedio.toFixed(4),
          maximo: maximo.toFixed(4),
          minimo: minimo.toFixed(4),
          ultimaTasa: valores[0].toFixed(4),
          totalRegistros: tasas.length
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        historial,
        estadisticas,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      }
    })

  } catch (error) {
    console.error('Error fetching exchange rate history:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener el historial de tasas de cambio',
        code: 'FETCH_RATE_HISTORY_ERROR'
      },
      { status: 500 }
    )
  }
}