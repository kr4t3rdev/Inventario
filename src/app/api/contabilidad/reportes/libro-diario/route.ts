import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'

/**
 * @description Libro diario: listado cronológico de eventos contables con sus líneas de detalle.
 * Filtros opcionales: fechaDesde, fechaHasta, origenTipo, periodoId, limite.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fechaDesde') ?? undefined
    const fechaHasta = searchParams.get('fechaHasta') ?? undefined
    const origenTipo = searchParams.get('origenTipo') ?? undefined
    const periodoId = searchParams.get('periodoId') ?? undefined
    const limite = Math.min(parseInt(searchParams.get('limite') ?? '200'), 1000)
    const offset = parseInt(searchParams.get('offset') ?? '0')

    const where: Record<string, unknown> = {}
    if (origenTipo) where.origenTipo = origenTipo
    if (fechaDesde || fechaHasta) {
      where.fechaOperacion = {
        ...(fechaDesde && { gte: new Date(fechaDesde) }),
        ...(fechaHasta && { lte: new Date(fechaHasta) }),
      }
    }
    if (periodoId) {
      where.OR = [
        { periodoDiarioId: periodoId },
        { periodoMensualId: periodoId },
        { periodoAnualId: periodoId },
      ]
    }

    const [eventos, total] = await Promise.all([
      prisma.eventoContable.findMany({
        where,
        include: { lineas: { orderBy: { cuenta: 'asc' } } },
        orderBy: [{ fechaOperacion: 'asc' }, { fechaRegistro: 'asc' }],
        skip: offset,
        take: limite,
      }),
      prisma.eventoContable.count({ where }),
    ])

    const totalDebito = eventos.reduce((s, e) => s + Number(e.monto), 0)
    const totalCreditos = eventos.reduce((s, e) => s + Number(e.montoConvertido ?? e.monto), 0)

    return NextResponse.json({
      eventos,
      total,
      offset,
      limite,
      resumen: { totalEventos: eventos.length, totalDebito, totalCreditos },
    })
  } catch (error) {
    console.error('Error en libro diario:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
