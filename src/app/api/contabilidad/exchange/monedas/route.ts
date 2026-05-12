import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { withAuthGet } from '@/lib/auth-middleware'

export const GET = withAuthGet(async () => {
  try {
    const monedas = await prisma.moneda.findMany({
      orderBy: { nombre: 'asc' },
    })

    return NextResponse.json({
      success: true,
      data: monedas,
    })
  } catch (error) {
    console.error('[Exchange/Monedas] Error al obtener monedas:', error)
    return NextResponse.json(
      { success: false, error: 'Error al obtener monedas' },
      { status: 500 },
    )
  }
})
