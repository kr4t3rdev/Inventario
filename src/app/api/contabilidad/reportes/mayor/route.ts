import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'

/**
 * @description Mayor por cuenta: movimientos agrupados por cuenta contable con saldo acumulado.
 * Filtros: cuenta (obligatorio), fechaDesde, fechaHasta, periodoId.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { searchParams } = new URL(request.url)
    const cuenta = searchParams.get('cuenta')
    const fechaDesde = searchParams.get('fechaDesde') ?? undefined
    const fechaHasta = searchParams.get('fechaHasta') ?? undefined
    const periodoId = searchParams.get('periodoId') ?? undefined
    const limite = Math.min(parseInt(searchParams.get('limite') ?? '500'), 1000)

    if (!cuenta) {
      return NextResponse.json({ error: 'El parámetro cuenta es requerido' }, { status: 400 })
    }

    const whereLineas: Record<string, unknown> = { cuenta }
    if (fechaDesde || fechaHasta || periodoId) {
      const eventoWhere: Record<string, unknown> = {}
      if (fechaDesde || fechaHasta) {
        eventoWhere.fechaOperacion = {
          ...(fechaDesde && { gte: new Date(fechaDesde) }),
          ...(fechaHasta && { lte: new Date(fechaHasta) }),
        }
      }
      if (periodoId) {
        eventoWhere.OR = [
          { periodoDiarioId: periodoId },
          { periodoMensualId: periodoId },
          { periodoAnualId: periodoId },
        ]
      }
      whereLineas.evento = eventoWhere
    }

    const lineas = await prisma.eventoContableLinea.findMany({
      where: whereLineas,
      include: { evento: { select: { fechaOperacion: true, origenTipo: true, origenId: true, descripcion: true } } },
      orderBy: { evento: { fechaOperacion: 'asc' } },
      take: limite,
    })

    let saldoAcumulado = 0
    const movimientos = lineas.map((l) => {
      saldoAcumulado += Number(l.debito) - Number(l.credito)
      return {
        eventoId: l.eventoId,
        fechaOperacion: l.evento.fechaOperacion,
        origenTipo: l.evento.origenTipo,
        origenId: l.evento.origenId,
        descripcion: l.evento.descripcion,
        debito: Number(l.debito),
        credito: Number(l.credito),
        saldoAcumulado,
      }
    })

    const totalDebito = lineas.reduce((s, l) => s + Number(l.debito), 0)
    const totalCredito = lineas.reduce((s, l) => s + Number(l.credito), 0)

    return NextResponse.json({
      cuenta,
      movimientos,
      totalMovimientos: movimientos.length,
      totalDebito,
      totalCredito,
      saldoFinal: saldoAcumulado,
    })
  } catch (error) {
    console.error('Error en mayor por cuenta:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
