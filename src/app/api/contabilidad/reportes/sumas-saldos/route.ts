import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'

/**
 * @description Balance de sumas y saldos: débitos, créditos y saldo por cada cuenta contable.
 * Filtros: fechaDesde, fechaHasta, periodoId, agruparPor (cuenta | origenTipo).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fechaDesde') ?? undefined
    const fechaHasta = searchParams.get('fechaHasta') ?? undefined
    const periodoId = searchParams.get('periodoId') ?? undefined
    const agruparPor = searchParams.get('agruparPor') ?? 'cuenta'

    const whereEvento: Record<string, unknown> = {}
    if (fechaDesde || fechaHasta) {
      whereEvento.fechaOperacion = {
        ...(fechaDesde && { gte: new Date(fechaDesde) }),
        ...(fechaHasta && { lte: new Date(fechaHasta) }),
      }
    }
    if (periodoId) {
      whereEvento.OR = [
        { periodoDiarioId: periodoId },
        { periodoMensualId: periodoId },
        { periodoAnualId: periodoId },
      ]
    }

    const where: Record<string, unknown> = {}
    if (Object.keys(whereEvento).length > 0) {
      where.evento = whereEvento
    }

    const lineas = await prisma.eventoContableLinea.findMany({
      where,
      include: { evento: { select: { origenTipo: true } } },
    })

    const esPorCuenta = agruparPor === 'cuenta'
    const grupos = new Map<string, { debito: number; credito: number; movimientos: number }>()

    for (const linea of lineas) {
      const key = esPorCuenta ? linea.cuenta : linea.evento.origenTipo
      const grupo = grupos.get(key) ?? { debito: 0, credito: 0, movimientos: 0 }
      grupo.debito += Number(linea.debito)
      grupo.credito += Number(linea.credito)
      grupo.movimientos++
      grupos.set(key, grupo)
    }

    const cuentas = Array.from(grupos.entries())
      .map(([key, vals]) => ({
        [esPorCuenta ? 'cuenta' : 'origenTipo']: key,
        ...vals,
        saldo: vals.debito - vals.credito,
      }))
      .sort((a, b) => b.debito + b.credito - (a.debito + a.credito))

    const totalDebito = cuentas.reduce((s, c) => s + c.debito, 0)
    const totalCredito = cuentas.reduce((s, c) => s + c.credito, 0)

    return NextResponse.json({
      cuentas,
      totalDebito,
      totalCredito,
      diferencia: totalDebito - totalCredito,
      totalMovimientos: lineas.length,
    })
  } catch (error) {
    console.error('Error en sumas y saldos:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
