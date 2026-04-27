import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'

const MODELO_DISPONIBLE = 'eventoContable' in prisma

/**
 * @description Obtiene eventos contables asociados a un período, con resumen por cuenta y por origen.
 * Detecta automáticamente si el período es DIARIO/MENSUAL/ANUAL para filtrar por el campo correspondiente.
 * @param {NextRequest} request - Request HTTP con query params opcionales (cuenta, origenTipo, includeSummary)
 * @param {{ params: Promise<{ id: string }> }} context - Contexto con ID del período
 * @returns {Promise<NextResponse>} Lista de eventos + resumen agregado
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateUser(request)
  if ('status' in authResult) return authResult as Response

  if (!MODELO_DISPONIBLE) {
    return NextResponse.json({ eventos: [], resumen: null })
  }

  try {
    const { id: periodoId } = await params
    const { searchParams } = new URL(request.url)
    const incluirResumen = searchParams.get('includeSummary') !== 'false'
    const limite = parseInt(searchParams.get('limite') ?? '200')
    const cuentaFilter = searchParams.get('cuenta') ?? undefined
    const origenFilter = searchParams.get('origenTipo') ?? undefined

    const client = prisma as unknown as Record<string, unknown>
    const periodoContable = client.periodoContable as
      | { findUnique: (args: Record<string, unknown>) => Promise<{ tipo: string } | null> }
      | undefined

    if (!periodoContable?.findUnique) {
      return NextResponse.json({ error: 'Modelo PeriodoContable no disponible' }, { status: 503 })
    }

    const periodo = await periodoContable.findUnique({
      where: { periodoId },
      select: { tipo: true },
    } as Record<string, unknown>)

    if (!periodo) {
      return NextResponse.json({ error: 'Período no encontrado' }, { status: 404 })
    }

    const campoPeriodo =
      periodo.tipo === 'DIARIO' ? 'periodoDiarioId' :
      periodo.tipo === 'MENSUAL' ? 'periodoMensualId' :
      'periodoAnualId'

    const where: Record<string, unknown> = { [campoPeriodo]: periodoId }
    if (origenFilter) where.origenTipo = origenFilter

    const eventoContable = client.eventoContable as
      | { findMany: (args: Record<string, unknown>) => Promise<unknown[]>; count: (args?: Record<string, unknown>) => Promise<number> }
      | undefined

    if (!eventoContable?.findMany) {
      return NextResponse.json({ eventos: [], resumen: null })
    }

    const eventosWhere = { ...where } as Record<string, unknown>
    if (cuentaFilter) {
      eventosWhere.lineas = { some: { cuenta: cuentaFilter } }
    }

    const [eventos, total] = await Promise.all([
      eventoContable.findMany({
        where: eventosWhere,
        include: { lineas: true },
        orderBy: { fechaOperacion: 'desc' as const },
        take: Math.min(limite, 500),
      }),
      eventoContable.count({ where: eventosWhere }),
    ])

    let resumen = null
    if (incluirResumen) {
      const allEvents = await eventoContable.findMany({
        where: where as Record<string, unknown>,
        include: { lineas: true },
      }) as Array<Record<string, unknown>>

      const lineas = allEvents.flatMap((e: any) =>
        (e.lineas ?? []).map((l: any) => ({
          cuenta: l.cuenta,
          debito: Number(l.debito ?? 0),
          credito: Number(l.credito ?? 0),
          origenTipo: e.origenTipo,
        }))
      )

      const totalDebito = lineas.reduce((s: number, l: any) => s + l.debito, 0)
      const totalCredito = lineas.reduce((s: number, l: any) => s + l.credito, 0)

      const porCuenta = Object.entries(
        lineas.reduce((acc: Record<string, { debito: number; credito: number }>, l: any) => {
          if (!acc[l.cuenta]) acc[l.cuenta] = { debito: 0, credito: 0 }
          acc[l.cuenta].debito += l.debito
          acc[l.cuenta].credito += l.credito
          return acc
        }, {})
      ).map(([cuenta, vals]) => ({ cuenta, ...vals }))
       .sort((a: any, b: any) => b.debito + b.credito - (a.debito + a.credito))

      const porOrigen = Object.entries(
        lineas.reduce((acc: Record<string, { debito: number; credito: number }>, l: any) => {
          if (!acc[l.origenTipo]) acc[l.origenTipo] = { debito: 0, credito: 0 }
          acc[l.origenTipo].debito += l.debito
          acc[l.origenTipo].credito += l.credito
          return acc
        }, {})
      ).map(([origenTipo, vals]) => ({ origenTipo, ...vals }))
       .sort((a: any, b: any) => b.debito + b.credito - (a.debito + a.credito))

      resumen = {
        totalDebito,
        totalCredito,
        totalEventos: allEvents.length,
        porCuenta,
        porOrigen,
      }
    }

    return NextResponse.json({ eventos, total, resumen })
  } catch (error) {
    console.error('Error al obtener eventos del período:', error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
