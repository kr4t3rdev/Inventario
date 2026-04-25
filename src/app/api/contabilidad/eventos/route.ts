import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { authenticateUser } from '@/lib/auth-middleware'

const MODELO_DISPONIBLE = 'eventoContable' in prisma

export async function GET(request: NextRequest) {
  const authResult = await authenticateUser(request)
  if ('error' in authResult) {
    const errRes = authResult as { error: string; status: number }
    return NextResponse.json({ error: errRes.error }, { status: errRes.status })
  }

  if (!MODELO_DISPONIBLE) {
    return NextResponse.json({ eventos: [], total: 0, message: 'Modelo EventoContable no disponible aún' })
  }

  try {
    const { searchParams } = new URL(request.url)
    const origenTipo = searchParams.get('origenTipo') ?? undefined
    const fechaDesde = searchParams.get('fechaDesde') ?? undefined
    const fechaHasta = searchParams.get('fechaHasta') ?? undefined
    const limite = parseInt(searchParams.get('limite') ?? '50')
    const estado = searchParams.get('estado') ?? undefined
    const natura = searchParams.get('naturaleza') ?? undefined

    const where: Record<string, unknown> = {}
    if (origenTipo) where.origenTipo = origenTipo
    if (estado) where.estado = estado
    if (natura) where.naturaleza = natura
    if (fechaDesde || fechaHasta) {
      where.fechaOperacion = {
        ...(fechaDesde && { gte: new Date(fechaDesde) }),
        ...(fechaHasta && { lte: new Date(fechaHasta) }),
      }
    }

    const [eventos, total] = await Promise.all([
      (prisma as unknown as Record<string, unknown>).eventoContable !== undefined
        ? (prisma.eventoContable.findMany as (args: Record<string, unknown>) => Promise<unknown[]>)({
            where,
            include: { lineas: true },
            orderBy: { fechaOperacion: 'desc' as const },
            take: Math.min(limite, 200),
          })
        : [],
      (prisma as unknown as Record<string, unknown>).eventoContable !== undefined
        ? (prisma.eventoContable.count as (args?: Record<string, unknown>) => Promise<number>)({ where })
        : 0,
    ])

    return NextResponse.json({ eventos, total })
  } catch (error) {
    console.error('Error listando eventos contables:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}