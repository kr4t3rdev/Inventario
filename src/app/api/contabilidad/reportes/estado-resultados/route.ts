import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'

/**
 * @description Estado de resultados derivado de eventos contables.
 * Agrupa eventos INGRESO y EGRESO para calcular utilidad/pérdida del período.
 * Filtros: fechaDesde, fechaHasta, periodoId, desglosarPorCuenta (true|false).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { searchParams } = new URL(request.url)
    const fechaDesde = searchParams.get('fechaDesde') ?? undefined
    const fechaHasta = searchParams.get('fechaHasta') ?? undefined
    const periodoId = searchParams.get('periodoId') ?? undefined
    const desglosar = searchParams.get('desglosarPorCuenta') !== 'false'

    const whereEvento: Record<string, unknown> = {
      naturaleza: { in: ['INGRESO', 'EGRESO'] },
    }

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

    const eventos = await prisma.eventoContable.findMany({
      where: whereEvento,
      include: { lineas: true },
      orderBy: { fechaOperacion: 'asc' },
    })

    const ingresos = eventos.filter((e) => e.naturaleza === 'INGRESO')
    const egresos = eventos.filter((e) => e.naturaleza === 'EGRESO')

    const totalIngresos = ingresos.reduce((s, e) => s + Number(e.monto), 0)
    const totalEgresos = egresos.reduce((s, e) => s + Number(e.monto), 0)

    let desglose = undefined
    if (desglosar) {
      const lineasIngreso = eventos
        .filter((e) => e.naturaleza === 'INGRESO')
        .flatMap((e) => e.lineas.map((l) => ({ ...l, origenTipo: e.origenTipo })))

      const lineasEgreso = eventos
        .filter((e) => e.naturaleza === 'EGRESO')
        .flatMap((e) => e.lineas.map((l) => ({ ...l, origenTipo: e.origenTipo })))

      const agrupar = (lineas: Array<Record<string, unknown>>) =>
        Object.entries(
          lineas.reduce((acc: Record<string, number>, l: any) => {
            acc[l.cuenta] = (acc[l.cuenta] ?? 0) + Number(l.debito ?? l.credito ?? 0)
            return acc
          }, {})
        ).map(([cuenta, monto]) => ({ cuenta, monto }))
         .sort((a, b) => Number(b.monto) - Number(a.monto))

      desglose = {
        porCuentaIngresos: agrupar(lineasIngreso),
        porCuentaEgresos: agrupar(lineasEgreso),
        totalIngresos,
        totalEgresos,
      }
    }

    const utilidad = totalIngresos - totalEgresos

    return NextResponse.json({
      periodo: { fechaDesde: fechaDesde ?? null, fechaHasta: fechaHasta ?? null },
      resumen: {
        totalIngresos,
        totalEgresos,
        utilidad,
        totalEventos: eventos.length,
      },
      desglose,
    })
  } catch (error) {
    console.error('Error en estado de resultados:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
