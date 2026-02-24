import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Get latest exchange rate USD -> destination currency (code: e.g., CUP, EUR, USD)
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const from = (url.searchParams.get('from') || 'USD').toUpperCase()
    const to = (url.searchParams.get('to') || 'CUP').toUpperCase()

    // Find origin currency record
    const origen = await prisma.moneda.findUnique({ where: { codigo: from } })
    // If not found, fallback to rate 1
    const rateRecord = await prisma.tasaCambio.findFirst({
      where: {
        monedaOrigenId: origen?.codigo ?? from,
        monedaDestino: to
      },
      orderBy: { fechaVigencia: 'desc' }
    })

    const rate = rateRecord?.tasa ?? 1
    return NextResponse.json({ rate, from, to })
  } catch (err) {
    console.error('exchange route error', err)
    return NextResponse.json({ error: 'Error al obtener tasa de cambio' }, { status: 500 })
  }
}
