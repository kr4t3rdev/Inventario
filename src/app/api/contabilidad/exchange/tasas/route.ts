import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { withAuthGet } from '@/lib/auth-middleware'

export const GET = withAuthGet(async () => {
  try {
    const [monedas, tasas] = await Promise.all([
      prisma.moneda.findMany({ orderBy: { nombre: 'asc' } }),
      prisma.tasaCambio.findMany({ orderBy: { fechaVigencia: 'desc' }, take: 50 }),
    ])

    const monedaPrincipal = monedas.find((m) => m.esPrincipal) ?? monedas[0] ?? null

    return NextResponse.json({
      success: true,
      data: {
        monedaPrincipal,
        tasas: tasas.map((tasa) => ({
          tasaId: tasa.tasaId,
          monedaOrigenId: tasa.monedaOrigenId,
          monedaDestino: tasa.monedaDestino,
          tasa: Number(tasa.tasa),
          fechaVigencia: tasa.fechaVigencia,
        })),
      },
    })
  } catch (error) {
    console.error('[Exchange/Tasas] Error al obtener tasas:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener tasas' },
      { status: 500 },
    )
  }
})
