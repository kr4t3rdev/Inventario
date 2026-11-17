import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { withAuthGet } from '@/lib/auth-middleware'
import { resolverMonedaPrincipal } from '@/lib/services/moneda-principal-service'

export const GET = withAuthGet(async (_request, _context, user) => {
  try {
    const [monedas, tasas, principal] = await Promise.all([
      prisma.moneda.findMany({ orderBy: { nombre: 'asc' } }),
      prisma.tasaCambio.findMany({ orderBy: { fechaVigencia: 'desc' }, take: 50 }),
      user.tenantId
        ? resolverMonedaPrincipal(user.tenantId)
        : Promise.resolve({ estado: 'AUSENTE' as const, moneda: null }),
    ])

    // La moneda principal proviene de la política contable del tenant; el
    // catálogo solo aporta el detalle (nombre/símbolo) y nunca un fallback.
    const monedaPrincipal =
      principal.estado === 'CONFIGURADA' && principal.moneda
        ? monedas.find((m) => m.codigo === principal.moneda) ?? null
        : null

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
