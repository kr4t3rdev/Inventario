import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'

/**
 * @description Concilia el snapshot de un período con los eventos contables registrados.
 * Verifica que el resumen del snapshot (totales de ingresos/gastos) coincida
 * con la suma de eventos del subledger en el mismo período.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateUser(request)
    if ('status' in authResult) return authResult as Response

    const { searchParams } = new URL(request.url)
    const periodoId = searchParams.get('periodoId')

    if (!periodoId) {
      return NextResponse.json({ error: 'El parámetro periodoId es requerido' }, { status: 400 })
    }

    const client = prisma as unknown as Record<string, unknown>
    const periodoContable = client.periodoContable as
      | { findUnique: (args: Record<string, unknown>) => Promise<Record<string, unknown> | null> }
      | undefined

    if (!periodoContable?.findUnique) {
      return NextResponse.json({ error: 'Modelo PeriodoContable no disponible' }, { status: 503 })
    }

    const periodo = await periodoContable.findUnique({
      where: { periodoId },
      select: { tipo: true, codigo: true, snapshots: { orderBy: { version: 'desc' }, take: 1 } },
      include: { snapshots: { orderBy: { version: 'desc' }, take: 1 } },
    } as Record<string, unknown>) as Record<string, unknown> | null

    if (!periodo) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
    }

    const tipo = periodo.tipo as string
    const campoPeriodo =
      tipo === 'DIARIO' ? 'periodoDiarioId' :
      tipo === 'MENSUAL' ? 'periodoMensualId' :
      'periodoAnualId'

    const events = await prisma.eventoContable.findMany({
      where: { [campoPeriodo]: periodoId } as Record<string, unknown>,
    })

    const totalEventos = events.length
    const montoEventos = events.reduce((s, e) => s + Number(e.monto), 0)
    const ingresosEventos = events.filter((e) => e.naturaleza === 'INGRESO').reduce((s, e) => s + Number(e.monto), 0)
    const egresosEventos = events.filter((e) => e.naturaleza === 'EGRESO').reduce((s, e) => s + Number(e.monto), 0)

    const snapshots = (periodo.snapshots as Array<Record<string, unknown>>) ?? []
    const snapshotActual = snapshots[0] ?? null
    const resumenSnapshot = snapshotActual?.resumenJson as Record<string, unknown> | null ?? null

    const ingresoSnapshot = Number((resumenSnapshot as any)?.totalIngresos ?? 0)
    const egresosSnapshot = Number((resumenSnapshot as any)?.totalGastos ?? 0)
    const diferenciaSnapshot = Number((resumenSnapshot as any)?.diferencia ?? 0)
    const difIngresos = ingresosEventos - ingresoSnapshot
    const difEgresos = egresosEventos - egresosSnapshot

    const conciliado = difIngresos === 0 && difEgresos === 0

    return NextResponse.json({
      periodo: { id: periodoId, codigo: periodo.codigo, tipo },
      snapshot: snapshotActual
        ? { version: snapshotActual.version, totalIngresos: ingresoSnapshot, totalEgresos: egresosSnapshot, diferencia: diferenciaSnapshot }
        : null,
      subledger: {
        totalEventos,
        montoTotal: montoEventos,
        totalIngresos: ingresosEventos,
        totalEgresos: egresosEventos,
      },
      diferencias: {
        ingresos: difIngresos,
        egresos: difEgresos,
      },
      conciliado,
      message: conciliado
        ? 'Snapshot y subledger cuadran'
        : `Diferencias detectadas: ingresos (${difIngresos}), egresos (${difEgresos})`,
    })
  } catch (error) {
    console.error('Error en conciliación snapshot vs subledger:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
